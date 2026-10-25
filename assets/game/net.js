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
    market: {
      shelf: function () { return call('/market/shelf'); },
      listings: function () { return call('/market/listings'); },
      sellable: function () { return call('/market/sellable'); },
      buy: function (n) { return call('/market/buy', { body: { n: n } }).then(function (r) { return refreshMe().then(function () { return r; }); }); },
      sell: function (n) { return call('/market/sell', { body: { n: n } }).then(function (r) { return refreshMe().then(function () { return r; }); }); }
    }
  };
  function finishRun(r) {
    if (!S.run) return false; var id = S.run.runId; S.run = null;
    var body = { runId: id, score: r.score, coins: r.coins, cards: r.cards, seconds: r.seconds, distance: r.distance, jumps: r.jumps, slides: r.slides, lanes: r.lanes, boxesJumped: r.boxesJumped, hits: r.hits, packs: r.packs, extraLife: r.extraLife };
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
    S.glyphP = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'assets/game/glyph-connect.js?v=20261023r'; s.onload = res; s.onerror = function () { S.glyphP = null; rej(new Error('Glyph could not load. Check your connection and try again.')); }; document.head.appendChild(s); });
    return S.glyphP;
  }
  function signIn() {
    return loadGlyph().then(function () { return window.MimuGlyph.connect(); }).then(function (id) {
      return call('/auth/nonce', { body: {}, noAuth: true }).then(function (n) {
        var message = 'Sign in to MIMU Games\nThis only proves you own this wallet. It costs nothing, sends no transaction and cannot move your assets.\n\nDomain: ' + location.host + '\nAddress: ' + id.address + '\nNonce: ' + n.nonce + '\nIssued: ' + n.issuedAt;
        return window.MimuGlyph.signMessage(message).then(function (signature) {
          return call('/auth/verify', { body: { address: id.address, nonce: n.nonce, issuedAt: n.issuedAt, signature: signature, name: id.name, picture: id.picture }, noAuth: true });
        });
      });
    }).then(function (r) { activate(r.token, r.expiresAt, r.me); return r; });
  }

  /* ---------- the entrance: CONNECT GLYPH ---------- */
  var note = null;
  function showNote(html) {
    if (!note) { note = document.createElement('div'); note.id = 'glyphNote'; note.setAttribute('role', 'status'); document.body.appendChild(note); }
    note.innerHTML = html; note.classList.add('on');
  }
  function hideNote() { if (note) note.classList.remove('on'); }
  var GLYPH_LIVE = false;   // flip to true when HYPE has approved the demo and Glyph is ready: until then everyone plays the demo
  function connectThen(go) {
    if (S.active || !GLYPH_LIVE) { go(); return; }
    var attempt = function () {
      showNote('<span class="gn">OPENING GLYPH&hellip;</span><small>APPROVE THE SIGN-IN IN THE GLYPH WINDOW</small>');
      signIn().then(function () { hideNote(); go(); }, function (e) {
        var m = String((e && e.message) || 'Sign-in did not finish.'); if (/Refusing|Glyph is not ready/.test(m)) m = 'Sign-in did not finish.';
        showNote('<span class="gn bad">' + esc(m.toUpperCase()) + '</span><span class="gb"><button type="button" id="gnRetry">TRY AGAIN</button><button type="button" id="gnGuest">CONTINUE AS A GUEST (DEMO)</button></span>');
        $('gnRetry').onclick = attempt; $('gnGuest').onclick = function () { hideNote(); go(); };
      });
    };
    attempt();
  }
  /* a returning player is welcomed back without opening Glyph again */
  function restore() {
    if (!GLYPH_LIVE) { lsDel(SKEY); return; }
    var s = lsGet(SKEY); if (!s || !s.token || !s.exp || s.exp < Date.now() + 60000) { lsDel(SKEY); return; }
    S.token = s.token; S.me = s.me || null; if (S.me) { S.active = true; P.connect(adapter); }
    call('/me').then(function (me) { S.me = me; S.active = true; saveSession(); if (P.isSignedIn()) { P.notify('connect'); } else P.connect(adapter); var b = $('enter'); if (b) { var i = b.querySelector('.inner'); if (i) i.textContent = 'WELCOME BACK'; } ev('signedIn'); }).catch(function (e) { if (e.status === 401) { signOutLocal(); } });
  }

  /* ---------- funnel and usage counts ---------- */
  function hooks() {
    var gate = $('gate'); if (gate) gate.addEventListener('click', function () { ev('loaded'); if (GLYPH_LIVE) setTimeout(function () { loadGlyph().catch(function () {}); }, 1500); });
    var loader = $('loader'); if (loader && window.MutationObserver) new MutationObserver(function () { if (loader.classList.contains('done')) ev('finished'); }).observe(loader, { attributes: true, attributeFilter: ['class'] });
    var scr = $('pScreen'); if (scr && window.MutationObserver) new MutationObserver(function () { if (scr.classList.contains('unlocked')) ev('unlocked'); if (scr.classList.contains('inapp') && scr.dataset.app) ev('app:' + scr.dataset.app); }).observe(scr, { attributes: true, attributeFilter: ['class', 'data-app'] });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) { t.addEventListener('click', function () { var h = (t.getAttribute('href') || '').replace('#', ''); if (/^[a-z]{2,12}$/.test(h)) ev('tab:' + h); }); });
    var en = $('enter'); if (en) en.addEventListener('click', function () { ev('entered'); }, true);
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
      approve: function (key, on) { return call('/admin/approve', { body: { key: key, on: !!on }, admin: tk() }).then(adminFeed, fail); },
      wantedLaunch: function (card, hours) { return call('/admin/wanted/launch', { body: { card: card, hours: hours }, admin: tk() }).then(adminFeed, fail); },
      wantedEnd: function () { return call('/admin/wanted/end', { body: {}, admin: tk() }).then(adminFeed, fail); },
      flag: function (runId, action) { return call('/admin/flag', { body: { runId: runId, action: action }, admin: tk() }).then(adminFeed, fail); }
    });
    adminFeed().catch(fail); clearInterval(adm.timer); adm.timer = setInterval(function () { adminFeed().catch(function (e) { if (e && e.status === 401) adminLogout(); }); }, 4000);
  }

  window.HallNet = { api: call, ev: ev, connectThen: connectThen, signIn: signIn, restore: restore, admin: { login: adminLogin, start: adminStart, stop: function () { clearInterval(adm.timer); adm.timer = 0; }, logout: adminLogout, token: admToken, feed: adminFeed }, base: API };
  P.whenReady(restore);
})();
