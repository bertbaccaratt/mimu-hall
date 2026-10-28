/* NET: the page's connection to the MIMU Games server (Cloudflare). Sign-in with a Glyph wallet signature, the saved player (cards, points, coins, stats),
   verified runs, texts, mail, the Marketplace, anonymous visit counts, and the control room's live feed. Everything here is a no-op until a player is signed in,
   and nothing the page claims is trusted: the server checks every run and decides every card. */
(function () {
  'use strict';
  var P = window.HallProfile; if (!P) return;
  var API = (function () { try { return localStorage.getItem('mimu-api') || ''; } catch (e) { return ''; } })() || 'https://mimu-games-api.mutualmimu.workers.dev';
  var SKEY = 'mimu-session', VKEY = 'mimu-vid';
  var S = { token: null, me: null, run: null, glyphP: null, active: false, sent: {} };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  /* ---------- talking to the server ---------- */
  function call(path, o) {
    o = o || {}; var h = { 'Content-Type': 'application/json' }; if (S.token && !o.noAuth) h.Authorization = 'Bearer ' + S.token; if (o.admin) h['X-Admin-Token'] = o.admin;
    return fetch(API + path, { method: o.method || (o.body ? 'POST' : 'GET'), headers: h, body: o.body ? JSON.stringify(o.body) : undefined, cache: 'no-store' }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && S.token && !o.admin && !o.noAuth) { signOutLocal(); }
        if (!r.ok) { var e = new Error(j.error || 'SOMETHING WENT WRONG'); e.status = r.status; e.data = j; throw e; }
        return j;
      });
    });
  }

  /* ---------- anonymous visit counts (a random id, never a wallet, never an IP) ---------- */
  function vid() { var v = lsGet(VKEY); if (!v || String(v).length < 8) { v = 'v' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); lsSet(VKEY, v); } return v; }
  function ev(k) { if (S.sent[k]) return; S.sent[k] = 1; try { call('/ev', { body: { vid: vid(), k: k }, noAuth: true }).catch(function () {}); } catch (e) {} }
  try { call('/visit', { body: { vid: vid() }, noAuth: true }).catch(function () {}); } catch (e) {}

  /* ---------- the signed-in player ---------- */
  function refreshMe() { return call('/me').then(function (me) { S.me = me; saveSession(); P.notify('cards'); P.notify('scores'); return me; }); }
  function saveSession() { var s = lsGet(SKEY) || {}; lsSet(SKEY, { token: S.token, exp: s.exp, me: S.me }); }
  function signOutLocal() { S.token = null; S.me = null; S.active = false; lsDel(SKEY); P.disconnect(); }
  function setMe(patch) { if (!S.me) return; for (var k in patch) S.me[k] = patch[k]; saveSession(); }
  /* under 5 NFTs: the demo run only. The player is NOT kept signed in, so they see exactly what a guest sees (no Marketplace, texts, mail or saved anything) */
  function refused(me) { return !!(me && me.nft && me.nft.enabled && me.nft.eligible === false); }
  function activate(token, exp, me) {
    S.token = token; S.me = me; lsSet(SKEY, { token: token, exp: exp, me: me });
    if (!S.active) { S.active = true; P.connect(adapter); } else P.notify('connect');
    ev('signedIn');
  }
  var adapter = {
    username: function () { return S.me ? S.me.name : ''; },
    owned: function () { return new Set(Object.keys(S.me ? S.me.cards : {}).map(Number)); },
    counts: function () { return S.me ? S.me.cards : {}; },
    foil: function () { return S.me ? S.me.foil || {} : {}; },
    totals: function () { return S.me ? S.me.totals : { lifetime: 0, best: 0, last: 0, coins: 0, balance: 0 }; },
    stats: function () { return S.me ? S.me.stats : {}; },
    nft: function () { return S.me ? S.me.nft || null : null; },   // { enabled, need, count, eligible, foilGranted }: the Mimu On Ape holder reward
    addCard: function (n) { if (S.me) { S.me.cards[n] = (S.me.cards[n] || 0) + 1; } return true; },   // shown at once; the server adds the card for real when the run is verified
    recordRun: function (r) { return finishRun(r); },
    leaderboard: function (kind) { return call('/leaderboard?kind=' + encodeURIComponent(kind)).catch(function () { return []; }); },
    deckBoard: function () { return call('/deckboard').catch(function () { return []; }); },
    track: function (m, n) { call('/track', { body: { metric: m, n: n || 1 } }).catch(function () {}); },
    buyLife: function () { if (!S.run) return Promise.reject(new Error('NO RUN IN PROGRESS')); return call('/run/life', { body: { runId: S.run.runId } }).then(function (r) { setMe({ totals: r.totals }); P.notify('scores'); return r; }); },
    onDisconnect: function () { try { if (window.MimuGlyph) window.MimuGlyph.disconnect(); } catch (e) {} S.token = null; S.me = null; S.active = false; lsDel(SKEY); },
    run: {
      start: function () { return call('/run/start', { method: 'POST', body: {} }).then(function (r) { S.run = r; return r; }); },
      beat: function (d) { if (!S.run) return Promise.resolve({}); d.runId = S.run.runId; return call('/run/beat', { body: d }); },
      drop: function (kind) { if (!S.run) return Promise.resolve({ none: true }); return call('/run/drop', { body: { runId: S.run.runId, kind: kind } }); },
      collect: function (dropId) { if (!S.run) return Promise.reject(new Error('NO RUN')); return call('/run/collect', { body: { runId: S.run.runId, dropId: dropId } }).then(function (r) { if (S.me && r.card && !r.already) { if (r.foil) { S.me.foil = S.me.foil || {}; S.me.foil[r.card] = r.halves; saveSession(); P.notify('foil'); } else { S.me.cards[r.card] = r.count; saveSession(); P.notify('cards'); } } return r; }); }
    },
    messages: {
      threads: function () { return call('/msg/threads'); },
      thread: function (id) { return call('/msg/thread?id=' + encodeURIComponent(id)); },
      send: function (id, body) { return call('/msg/send', { body: { to: id, body: body } }); },
      block: function (id, on) { return call('/msg/block', { body: { id: id, on: !!on } }); },
      players: function () { return call('/msg/players'); }
    },
    mail: {
      inbox: function () { return call('/mail'); },
      read: function (id) { call('/mail/read', { body: { id: id } }).catch(function () {}); }
    },
    give: {
      status: function () { return call('/give/status'); },
      players: function () { return call('/msg/players'); },
      send: function (to, amount) { return call('/give', { body: { to: to, amount: amount } }).then(function (r) { return refreshMe().then(function () { return r; }); }); }
    },
    xbonus: {
      status: function () { return call('/x/status'); },
      claim: function (url) { return call('/x/claim', { body: { url: url } }).then(function (r) { return refreshMe().then(function () { return r; }); }); }
    },
    market: {
      listings: function () { return call('/market/listings'); },
      sellable: function () { return call('/market/sellable'); },
      list: function (n, price) { return call('/market/list', { body: { n: n, price: price } }); },
      cancel: function (id) { return call('/market/cancel', { body: { id: id } }); },
      buy: function (id) { return call('/market/buy', { body: { id: Number(id) } }).then(function (r) { return refreshMe().then(function () { return r; }); }); }
    }
  };
  function finishRun(r) {
    if (!S.run) return false; var id = S.run.runId; S.run = null;
    var body = { runId: id, score: r.score, coins: r.coins, cards: r.cards, seconds: r.seconds, distance: r.distance, jumps: r.jumps, slides: r.slides, lanes: r.lanes, boxesJumped: r.boxesJumped, hits: r.hits, packs: r.packs, extraLife: r.extraLife, rhythm: r.rhythm };
    call('/run/finish', { body: body }).then(function (j) {
      if (j.held) return refreshMe();
      setMe({ totals: j.totals, cards: j.cards, stats: j.stats }); P.notify('scores'); P.notify('cards');
    }).catch(function () { refreshMe().catch(function () {}); });
    ev('finishedRun'); return true;
  }

  /* ---------- Glyph sign-in ---------- */
  function loadGlyph() {
    if (window.MimuGlyph) return Promise.resolve();
    if (S.glyphP) return S.glyphP;
    S.glyphP = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'assets/game/glyph-connect.js?v=20261027l'; s.onload = res; s.onerror = function () { S.glyphP = null; rej(new Error('Glyph could not load. Check your connection and try again.')); }; document.head.appendChild(s); });
    return S.glyphP;
  }
  /* ---------- linked wallets: right after the Glyph sign-in ----------
     Glyph lists the wallets a player linked in their Glyph account. The server cannot ask Glyph to confirm that list, so each wallet signs ONE sentence that names this account
     (a message that costs nothing and cannot move anything); the server checks the signature and counts that wallet's Mimu On Ape. Done once per wallet. A SKIP always works. */
  function callTok(token, path, body) {
    return fetch(API + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || 'SOMETHING WENT WRONG'); e.status = r.status; throw e; } return j; });
    });
  }
  function shortAddr(a) { return String(a).slice(0, 6) + '\u2026' + String(a).slice(-4); }
  function toHex(s) { var b = new TextEncoder().encode(s), h = '0x'; for (var i = 0; i < b.length; i++) h += (b[i] < 16 ? '0' : '') + b[i].toString(16); return h; }
  function walletSign(addr, message) {   // a browser wallet (MetaMask, Rabby, Coinbase Wallet...): choose the account, sign the sentence
    var e = window.ethereum; if (!e) return Promise.reject(new Error('NO_WALLET'));
    var provs = e.providers && e.providers.length ? e.providers : [e], want = String(addr).toLowerCase();
    var has = function (a) { return (a || []).some(function (x) { return String(x).toLowerCase() === want; }); };
    var pick = function (i) { return i >= provs.length ? Promise.resolve(null) : provs[i].request({ method: 'eth_accounts' }).then(function (a) { return has(a) ? provs[i] : pick(i + 1); }, function () { return pick(i + 1); }); };
    return pick(0).then(function (p) {
      if (p) return p;
      return provs[0].request({ method: 'eth_requestAccounts' }).then(function (a) { if (!has(a)) throw new Error('IN YOUR WALLET, SWITCH TO ' + shortAddr(addr) + ' AND TRY AGAIN'); return provs[0]; });
    }).then(function (p) { return p.request({ method: 'personal_sign', params: [toHex(message), addr] }); });
  }
  function linkStep(r) {
    var G = window.MimuGlyph, list = []; try { list = (G && G.linked && G.linked()) || []; } catch (e) { list = []; }
    var me = r && r.me, nft = me && me.nft; if (!list.length || !r.token || !nft || !nft.enabled) return Promise.resolve();
    var own = String((me && me.address) || '').toLowerCase();
    return callTok(r.token, '/nft/links').then(function (j) {
      var done = {}, st = { count: nft.count || 0, eligible: nft.eligible }; (j.links || []).forEach(function (l) { done[String(l.wallet).toLowerCase()] = 1; });
      var todo = list.filter(function (w) { var a = String(w.address).toLowerCase(); return a !== own && !done[a]; });
      var skipped = lsGet('mimu-lnk-skip'); if (!todo.length || (nft.eligible && skipped && Date.now() - skipped < 3 * 86400000)) return;
      return new Promise(function (resolve) {
        var rows = todo.map(function (w) { return { address: String(w.address).toLowerCase(), type: String(w.type || '').replace(/_/g, ' '), ok: false }; });
        function paint(msg, manual) {
          var enough = st.eligible === true;
          showNote('<span class="gn">MIMU ON APE IN ANOTHER WALLET?</span>' +
            '<small>YOU LINKED THESE WALLETS IN GLYPH. SIGN ONE SENTENCE IN EACH WALLET AND ITS MIMUS COUNT. IT COSTS NOTHING AND NOTHING MOVES.</small>' +
            '<div class="lkn">' + (enough ? 'YOU ARE IN: ' : 'YOU NEED ' + (nft.need || 5) + ' TO PLAY: ') + '<b>' + st.count + '</b> MIMU' + (st.count === 1 ? '' : 'S') + ' COUNTED</div>' +
            '<div class="lkl">' + rows.map(function (w, i) { return '<div class="lkr' + (w.ok ? ' ok' : '') + '"><span class="lka" title="' + esc(w.address) + '">' + esc(shortAddr(w.address)) + (w.type ? ' <em>' + esc(w.type.toUpperCase()) + '</em>' : '') + '</span>' + (w.ok ? '<span class="lkd">&#10003; COUNTED</span>' : '<button type="button" class="lkv" data-i="' + i + '">VERIFY</button>') + '</div>'; }).join('') + '</div>' +
            (manual ? '<div class="lkm"><small>NO WALLET FOUND IN THIS BROWSER. COPY THE SENTENCE, SIGN IT IN THE WALLET THAT HOLDS THE MIMUS (SIGN MESSAGE), THEN PASTE THE SIGNATURE.</small><textarea id="lkTxt" readonly rows="4">' + esc(manual.message) + '</textarea><input id="lkSig" placeholder="PASTE THE SIGNATURE (0x...)" autocomplete="off"><span class="gb"><button type="button" id="lkCopy">COPY THE SENTENCE</button><button type="button" id="lkSend">SUBMIT</button></span></div>' : '') +
            '<small class="lkmsg" id="lkMsg">' + esc(msg || '') + '</small>' +
            '<span class="gb"><button type="button" id="lkGo">' + (rows.every(function (w) { return w.ok; }) || enough ? 'CONTINUE' : 'SKIP FOR NOW') + '</button></span>');
          note.classList.add('lk');   // a solid panel in the middle: the CONNECT GLYPH button must not show through
          $('lkGo').onclick = function () { if (enough) lsSet('mimu-lnk-skip', Date.now()); resolve(); };
          Array.prototype.forEach.call(document.querySelectorAll('#glyphNote .lkv'), function (b) { b.onclick = function () { verify(+b.getAttribute('data-i')); }; });
          if (manual) { $('lkCopy').onclick = function () { try { navigator.clipboard.writeText(manual.message); $('lkMsg').textContent = 'COPIED'; } catch (e) { $('lkTxt').select(); } }; $('lkSend').onclick = function () { send(manual.row, manual.issued, ($('lkSig').value || '').trim()); }; }
        }
        function send(i, issued, signature) {
          return callTok(r.token, '/nft/link', { wallet: rows[i].address, issued: issued, signature: signature }).then(function (j) {
            rows[i].ok = true; if (j.nft) { st.count = j.nft.count || 0; st.eligible = j.nft.eligible; nft = j.nft; r.me.nft = j.nft; } paint('');
          }, function (e) { paint(String(e.message || 'COULD NOT LINK').toUpperCase(), null); });
        }
        function verify(i) {
          var addr = rows[i].address; paint('CHECK YOUR WALLET: APPROVE THE SIGN MESSAGE REQUEST');
          callTok(r.token, '/nft/link/challenge', { wallet: addr }).then(function (c) {
            return walletSign(addr, c.message).then(function (sig) { return send(i, c.issued, sig); }, function (e) {
              if (e && e.message === 'NO_WALLET') return paint('', { message: c.message, issued: c.issued, row: i });
              paint(/rejected|denied|cancel/i.test(String(e && e.message)) ? 'NOT SIGNED. TAP VERIFY WHEN YOU ARE READY.' : String((e && e.message) || 'NOT SIGNED').toUpperCase());
            });
          }, function (e) { paint(String(e.message || 'COULD NOT START').toUpperCase()); });
        }
        paint('');
      });
    }, function () { /* the link list could not be read: carry on with the normal sign-in */ });
  }  function signIn() {
    return loadGlyph().then(function () { return window.MimuGlyph.connect(); }).then(function (id) {
      return call('/auth/nonce', { body: {}, noAuth: true }).then(function (n) {
        var message = 'Sign in to MIMU Games\nThis only proves you own this wallet. It costs nothing, sends no transaction and cannot move your assets.\n\nDomain: ' + location.host + '\nAddress: ' + id.address + '\nNonce: ' + n.nonce + '\nIssued: ' + n.issuedAt;
        return window.MimuGlyph.signMessage(message).then(function (signature) {
          return call('/auth/verify', { body: { address: id.address, nonce: n.nonce, issuedAt: n.issuedAt, signature: signature, name: id.name, picture: id.picture }, noAuth: true, admin: gAdmin() ? admToken() : undefined });
        });
      });
    }).then(function (r) { return linkStep(r).then(function () { return r; }, function () { return r; }); }).then(function (r) { if (refused(r.me)) { S.token = null; S.me = null; S.active = false; lsDel(SKEY); r.refused = true; S.demoOnly = true; return r; } activate(r.token, r.expiresAt, r.me); return r; });
  }

  /* ---------- the entrance: CONNECT GLYPH ---------- */
  var note = null;
  function showNote(html) {
    if (!note) { note = document.createElement('div'); note.id = 'glyphNote'; note.setAttribute('role', 'status'); document.body.appendChild(note); }
    note.innerHTML = html; note.classList.remove('lk'); note.classList.add('on');
  }
  function hideNote() { if (note) note.classList.remove('on'); }
  var GLYPH_LIVE = true;   // Glyph sign-in is on. The CONNECT GLYPH button stays locked until the Hall run starts (see the lock below), and the server refuses sign-ins before then too

  /* ---------- the lock on CONNECT GLYPH: locked until the start, then it opens by itself ----------
     The time comes from the server (/schedule) and is corrected for the visitor's clock, so a wrong clock cannot open it early. If the server cannot be reached the page's own copy of the start time is used.
     A control room admin who is signed in on this tab gets early access (the server checks the admin token), so launch day can be rehearsed. */
  var G = { start: Date.UTC(2026, 9, 26, 19, 0, 0), off: 0, synced: false, was: null, timer: 0, syncAt: 0, syncing: false };
  function gNow() { return Date.now() + G.off; }
  function gAdmin() { try { return !!(adm && admToken()); } catch (e) { return false; } }   // adm is set up further down
  function gOpen() { return gAdmin() || gNow() >= G.start; }
  function gLeft(ms) {
    ms = Math.max(0, ms); var d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return (d ? d + 'D ' : '') + p(h) + ':' + p(m) + ':' + p(s);
  }
  function gWhen() { try { return new Date(G.start).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).toUpperCase() + ' PT'; } catch (e) { return ''; } }
  function gPaint() {
    var b = $('enter'); if (!b) return; var open = gOpen(), lk = $('enterLock');
    b.classList.toggle('locked', !open); b.setAttribute('aria-disabled', open ? 'false' : 'true');
    if (lk) lk.innerHTML = open ? '' : '<span class="elt">OPENS ' + esc(gWhen()) + '</span><span class="elc">' + gLeft(G.start - gNow()) + '</span>';
    if (G.was === false && open) { b.classList.add('opened'); setTimeout(function () { b.classList.remove('opened'); }, 2600); }   // it just opened: a golden flash
    G.was = open;
  }
  function gSync() {
    if (G.syncing) return Promise.resolve(); G.syncing = true;
    return call('/schedule', { noAuth: true }).then(function (s) { if (s && s.start) { G.start = s.start; G.off = s.now - Date.now(); G.synced = true; } G.syncAt = Date.now(); gPaint(); }, function () {}).then(function () { G.syncing = false; });
  }
  function gStart() {
    gPaint(); gSync();
    if (!G.timer) G.timer = setInterval(function () {
      gPaint();
      var every = G.synced ? 60000 : 8000, near = G.start - gNow(); if (near < 15000 && near > -15000) every = 3000;   // look again right around the opening
      if (Date.now() - G.syncAt > every) gSync();
    }, 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { gPaint(); gSync(); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', gStart); else gStart();
  function connectThen(go) {
    if (!gOpen() && !S.active) { gPaint(); gSync(); return; }   // still locked: nothing opens
    if (S.active || !GLYPH_LIVE || S.demoOnly) { go(); return; }   // demoOnly: signed in but under 5 NFTs, so no more sign-in windows until the page is reloaded
    var cur = 0;
    var attempt = function () {
      var id = ++cur; S.signing = true;
      showNote('<span class="gn">OPENING GLYPH&hellip;</span><small>APPROVE THE SIGN-IN IN THE GLYPH WINDOW. IF NOTHING OPENS, YOUR BROWSER MAY BE BLOCKING POP-UPS</small>');
      signIn().then(function (r) {
        S.signing = false; if (id !== cur && !S.active) return;   // an older try that finished late is ignored unless it really signed the player in
        if (r && r.refused) { showNote('<span class="gn bad">YOU NEED 5 MIMU ON APE NFTS TO PLAY FOR REAL</span><small>YOU CAN PLAY THE DEMO RUN</small><span class="gb"><button type="button" id="gnDemo">PLAY THE DEMO</button></span>'); $('gnDemo').onclick = function () { hideNote(); go(); }; return; }
        hideNote(); go();
      }, function (e) {
        if (id !== cur) return; S.signing = false;
        var m = String((e && e.message) || 'Sign-in did not finish.'); if (/Refusing|Glyph is not ready/.test(m)) m = 'Sign-in did not finish.';
        showNote('<span class="gn bad">' + esc(m.toUpperCase()) + '</span><span class="gb"><button type="button" id="gnRetry">TRY AGAIN</button><button type="button" id="gnGuest">CONTINUE AS A GUEST (DEMO)</button></span>');
        $('gnRetry').onclick = attempt; $('gnGuest').onclick = function () { hideNote(); go(); };
      });
    };
    /* the browser blocked the Glyph window: say so, and tell them how to allow it (TRY AGAIN is a fresh tap, which the browser trusts) */
    S.onBlocked = function () {
      if (!S.signing || S.active) return;
      showNote('<span class="gn bad">YOUR BROWSER BLOCKED THE GLYPH WINDOW</span><small>ALLOW POP-UPS FOR THIS SITE: TAP THE POP-UP BLOCKED ICON AT THE RIGHT END OF THE ADDRESS BAR (OR THE LOCK ICON, THEN SITE SETTINGS) AND CHOOSE ALLOW. THEN TAP TRY AGAIN</small><span class="gb"><button type="button" id="gnRetry">TRY AGAIN</button><button type="button" id="gnGuest">CONTINUE AS A GUEST (DEMO)</button></span>');
      $('gnRetry').onclick = function () { if (S.active) { hideNote(); go(); } else attempt(); }; $('gnGuest').onclick = function () { S.signing = false; hideNote(); go(); };
    };
    attempt();
  }
  /* every window the page opens is watched: a null answer means the browser's pop-up blocker said no (only while the Glyph sign-in is running) */
  (function () { var open = window.open; if (typeof open !== 'function') return; window.open = function () { var w = null; try { w = open.apply(window, arguments); } catch (e) { w = null; } if (!w && S.signing && S.onBlocked) { try { S.onBlocked(); } catch (e) {} } return w; }; })();
  /* a returning player is welcomed back without opening Glyph again */
  function restore() {
    if (!GLYPH_LIVE) { lsDel(SKEY); return; }
    var s = lsGet(SKEY); if (!s || !s.token || !s.exp || s.exp < Date.now() + 60000) { lsDel(SKEY); return; }
    if (refused(s.me)) { lsDel(SKEY); return; }
    S.token = s.token; S.me = s.me || null; if (S.me) { S.active = true; P.connect(adapter); }
    call('/me').then(function (me) { if (refused(me)) { signOutLocal(); return; } S.me = me; S.active = true; saveSession(); if (P.isSignedIn()) { P.notify('connect'); } else P.connect(adapter); var b = $('enter'); if (b) { var i = b.querySelector('.inner'); if (i) i.textContent = 'WELCOME BACK'; } ev('signedIn'); }).catch(function (e) { if (e.status === 401) { signOutLocal(); } });
  }

  /* ---------- funnel and usage counts ---------- */
  function hooks() {
    var gate = $('gate'); if (gate) gate.addEventListener('click', function () { ev('loaded'); if (GLYPH_LIVE) setTimeout(function () { loadGlyph().catch(function () {}); }, 1500); });
    var loader = $('loader'); if (loader && window.MutationObserver) new MutationObserver(function () { if (loader.classList.contains('done')) ev('finished'); }).observe(loader, { attributes: true, attributeFilter: ['class'] });
    var scr = $('pScreen'); if (scr && window.MutationObserver) new MutationObserver(function () { if (scr.classList.contains('unlocked')) ev('unlocked'); if (scr.classList.contains('inapp') && scr.dataset.app) ev('app:' + scr.dataset.app); }).observe(scr, { attributes: true, attributeFilter: ['class', 'data-app'] });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) { t.addEventListener('click', function () { var h = (t.getAttribute('href') || '').replace('#', ''); if (/^[a-z]{2,12}$/.test(h)) ev('tab:' + h); }); });
    var en = $('enter'); if (en) en.addEventListener('click', function () { if (!en.classList.contains('locked')) ev('entered'); }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hooks); else hooks();

  /* ---------- the control room: server login and the live feed ---------- */
  var adm = { token: null, timer: 0, last: null };
  function admToken() { if (adm.token) return adm.token; try { adm.token = sessionStorage.getItem('hall-admin-token'); } catch (e) {} return adm.token; }
  function adminLogin(password) { return call('/admin/login', { body: { password: password }, noAuth: true }).then(function (r) { adm.token = r.token; try { sessionStorage.setItem('hall-admin-token', r.token); } catch (e) {} return r; }); }
  function adminLogout() { adm.token = null; clearInterval(adm.timer); adm.timer = 0; try { sessionStorage.removeItem('hall-admin-token'); } catch (e) {} if (window.HallAdmin) { HallAdmin.setFeed(null); HallAdmin.setHandlers({}); } }
  function adminFeed() { return call('/admin/feed', { admin: admToken() }).then(function (f) { adm.last = f; if (window.HallAdmin) HallAdmin.setFeed(f); return f; }); }
  function adminStart() {
    if (!window.HallAdmin) return;
    var tk = function () { return admToken(); }, fail = function (e) { if (e && e.status === 401) adminLogout(); throw e; };
    HallAdmin.setHandlers({
      hype: function (to, body) { return call('/admin/hype', { body: { to: to, body: body }, admin: tk() }).then(adminFeed, fail); },
      mail: function (subject, body) { return call('/admin/mail', { body: { subject: subject, body: body }, admin: tk() }).then(adminFeed, fail); },
      markRead: function (name) { var t = adm.last && (adm.last.hypeThreads || []).filter(function (x) { return x.name === name; })[0]; if (t && t.id) call('/admin/read', { body: { id: t.id }, admin: tk() }).then(adminFeed, function () {}); },
      texts: function (qs) { return call('/admin/texts' + (qs || ''), { admin: tk() }).catch(fail); },
      approve: function (key, on) { return call('/admin/approve', { body: { key: key, on: !!on }, admin: tk() }).then(adminFeed, fail); },
      wantedLaunch: function (card, hours) { return call('/admin/wanted/launch', { body: { card: card, hours: hours }, admin: tk() }).then(adminFeed, fail); },
      wantedEnd: function () { return call('/admin/wanted/end', { body: {}, admin: tk() }).then(adminFeed, fail); },
      xrecheck: function (id) { return call('/admin/x/recheck', { body: { id: id }, admin: tk() }).then(function (r) { return adminFeed().then(function () { return r; }); }, fail); },
      flag: function (runId, action) { return call('/admin/flag', { body: { runId: runId, action: action }, admin: tk() }).then(adminFeed, fail); }
    });
    adminFeed().catch(fail); clearInterval(adm.timer);
    var fast = function () { if (adm.fbusy || adm.busy || document.hidden || !adm.last) return; adm.fbusy = true; call('/admin/live', { admin: admToken() }).then(function (p) { if (!adm.last || adm.busy) return; var f = adm.last, v = {}; for (var k in f.visitors) v[k] = f.visitors[k]; for (k in p.visitors) v[k] = p.visitors[k]; var runs = {}; for (k in f.runs) runs[k] = f.runs[k]; runs.today = p.runs.today; var m = {}; for (k in f) m[k] = f[k]; m.visitors = v; m.runs = runs; m.live = p.live; m.signedIn = p.signedIn; m.activity = p.activity; adm.last = m; if (window.HallAdmin) HallAdmin.setFeed(m); }).catch(function () {}).then(function () { adm.fbusy = false; }); };
    var pull = function () { if (adm.busy || document.hidden) return; adm.busy = true; adminFeed().catch(function (e) { if (e && e.status === 401) adminLogout(); }).then(function () { adm.busy = false; }); };
    clearInterval(adm.ftimer); adm.ftimer = setInterval(fast, 1000); adm.timer = setInterval(pull, 3000); if (!adm.vis) { adm.vis = true; document.addEventListener('visibilitychange', function () { if (!document.hidden && adm.timer) pull(); }); }   /* the numbers are about 2 seconds old at most */
  }

  window.HallNet = { api: call, vid: vid, ev: ev, connectThen: connectThen, signIn: signIn, restore: restore, admin: { login: adminLogin, start: adminStart, stop: function () { clearInterval(adm.timer); clearInterval(adm.ftimer); adm.timer = 0; }, logout: adminLogout, token: admToken, feed: adminFeed }, base: API };
  P.whenReady(restore);
})();
