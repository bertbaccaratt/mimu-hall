/* The phone's talking and trading apps: PHONE (keypad), MESSAGES (texts between players, plus MIMU and HYPE), MAIL (emails from MIMU) and MARKETPLACE (buy and sell cards).
   Everything arrives through HallProfile once somebody is signed in (the Cloudflare adapter supplies messages, mail and market); until then each app shows an empty, honest state. */
(function () {
  'use strict';
  var P = window.HallProfile; if (!P) return;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Math.floor(n || 0).toLocaleString('en-US'); }
  function pad3(n) { n = String(n); while (n.length < 3) n = '0' + n; return n; }
  function when(ts) { try { return new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase(); } catch (e) { return ''; } }
  function current() { var s = $('pScreen'); return s && s.classList.contains('inapp') ? s.dataset.app : ''; }
  function lines(s) { return esc(s).replace(/\r?\n/g, '<br>'); }
  var LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="1.8"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>';
  function locked(el, title, sub, line1, line2) {
    el.classList.add('page');
    el.innerHTML = '<div class="pg cm"><div class="pgh"><h2 class="gold">' + title + '</h2><div class="pgsub">' + sub + '</div></div><div class="empty">' + LOCK + '<br>' + line1 + '<br><span style="opacity:.7">' + line2 + '</span></div></div>';
  }

  /* ---------- PHONE: keypad with a busy line ---------- */
  var ph = { num: '', st: 'dial', timers: [], ctx: null, nodes: [] };
  var KEYS = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
  function audioOn() { var A = window.MIMUAudio; return !(A && A.isMuted && A.isMuted()); }
  function level() { var A = window.MIMUAudio; return A && A.getVolume ? A.getVolume() : 0.6; }
  function tones(spec) {   // spec: [[startSec, durSec, [freqs]], ...]
    if (!audioOn()) return; var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      if (!ph.ctx) ph.ctx = new AC(); var c = ph.ctx, t0 = c.currentTime + 0.02, v = 0.09 * level();
      spec.forEach(function (s) { s[2].forEach(function (f) { var o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + s[0]); g.gain.linearRampToValueAtTime(v, t0 + s[0] + 0.01); g.gain.setValueAtTime(v, t0 + s[0] + s[1] - 0.02); g.gain.linearRampToValueAtTime(0, t0 + s[0] + s[1]); o.connect(g); g.connect(c.destination); o.start(t0 + s[0]); o.stop(t0 + s[0] + s[1] + 0.02); ph.nodes.push(o); }); });
    } catch (e) {}
  }
  function stopTones() { ph.nodes.forEach(function (o) { try { o.stop(); } catch (e) {} }); ph.nodes = []; }
  function clearTimers() { ph.timers.forEach(clearTimeout); ph.timers = []; stopTones(); }
  function paintPhone() {
    var n = $('kpN'), s = $('kpS'), call = $('kpCall'); if (!n) return;
    n.textContent = ph.num; s.textContent = ph.st === 'calling' ? 'CALLING…' : ph.st === 'busy' ? 'LINE BUSY' : ''; s.className = 'kps' + (ph.st === 'busy' ? ' busy' : '');
    call.className = 'kpcall' + (ph.st === 'dial' ? '' : ' end'); call.setAttribute('aria-label', ph.st === 'dial' ? 'Call' : 'End call');
    $('phoneApp').classList.toggle('inc', ph.st !== 'dial');
  }
  function press(k) { if (ph.st !== 'dial' || ph.num.length >= 15) return; ph.num += k; tones([[0, 0.09, [697, 1209]]]); paintPhone(); }
  function dial() {
    if (ph.st !== 'dial') { clearTimers(); ph.st = 'dial'; paintPhone(); return; }
    if (!ph.num) return;
    ph.st = 'calling'; paintPhone();
    tones([[0, 1.0, [440, 480]]]);
    ph.timers.push(setTimeout(function () {
      ph.st = 'busy'; paintPhone();
      var sp = []; for (var i = 0; i < 6; i++) sp.push([i * 1, 0.5, [480, 620]]); tones(sp);
      ph.timers.push(setTimeout(function () { if (ph.st === 'busy') { ph.st = 'dial'; paintPhone(); } }, 6200));
    }, 1300));
  }
  function buildPhone() {
    var el = $('phoneApp'); if (!el || el.dataset.b) return; el.dataset.b = '1'; el.classList.add('page');
    el.innerHTML = '<div class="pg cm kp"><div class="kpdisp"><div class="kpn" id="kpN"></div><div class="kps" id="kpS"></div></div><div class="kpgrid">' +
      KEYS.map(function (k) { return '<button type="button" class="kpk" data-k="' + k[0] + '"><b>' + k[0] + '</b><small>' + k[1] + '</small></button>'; }).join('') +
      '</div><div class="kpact"><span></span><button type="button" class="kpcall" id="kpCall" aria-label="Call"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg></button><button type="button" class="kpdel" id="kpDel" aria-label="Delete">&#9003;</button></div></div>';
    el.addEventListener('click', function (ev) {
      var k = ev.target.closest('.kpk'); if (k) { press(k.getAttribute('data-k')); return; }
      if (ev.target.closest('#kpCall')) { dial(); return; }
      if (ev.target.closest('#kpDel') && ph.st === 'dial') { ph.num = ph.num.slice(0, -1); paintPhone(); }
    });
    window.addEventListener('keydown', function (ev) {
      if (current() !== 'phone' || ev.ctrlKey || ev.metaKey) return;
      if (/^[0-9*#]$/.test(ev.key)) press(ev.key); else if (ev.key === 'Backspace' && ph.st === 'dial') { ph.num = ph.num.slice(0, -1); paintPhone(); } else if (ev.key === 'Enter') dial();
    });
    paintPhone();
  }

  /* ---------- MESSAGES ---------- */
  var ms = { view: 'list', id: null, name: '', system: false, blocked: false, poll: 0, err: '', pending: null };
  function M() { return P.messages ? P.messages() : null; }
  function avatar(name, system) { var c = (name || '?').charAt(0).toUpperCase(); return '<span class="cmav' + (system ? ' sys' : '') + '">' + esc(c) + '</span>'; }
  function drawMessages() {
    var el = $('msgApp'); if (!el) return; el.classList.add('page'); clearInterval(ms.poll);
    if (!P.isSignedIn() || !M()) { ms.view = 'list'; locked(el, 'MESSAGES', 'TEXTS', 'TEXTS OPEN WITH SIGN-IN', 'TEXT OTHER PLAYERS · NOTICES FROM MIMU · NEWS FROM HYPE'); return; }
    if (ms.view === 'thread') return drawThread();
    if (ms.view === 'new') return drawNew();
    el.innerHTML = '<div class="pg cm"><div class="pgh"><h2 class="gold">MESSAGES</h2><div class="pgsub">TEXTS</div></div><div class="cmbar"><button type="button" class="cmbtn" id="msNew">NEW TEXT</button></div><div class="sec" id="msList"><div class="empty">LOADING</div></div></div>';
    $('msNew').addEventListener('click', function () { ms.view = 'new'; drawMessages(); });
    var load = function () {
      M().threads().then(function (rows) {
        var box = $('msList'); if (!box) return;
        if (!rows || !rows.length) { box.innerHTML = '<div class="empty">NO TEXTS YET<br><span style="opacity:.7">PRESS NEW TEXT TO START ONE</span></div>'; return; }
        box.innerHTML = rows.map(function (r) { return '<button type="button" class="cmrow" data-id="' + esc(r.id) + '" data-sys="' + (r.system ? 1 : 0) + '" data-bl="' + (r.blocked ? 1 : 0) + '" data-n="' + esc(r.name) + '">' + avatar(r.name, r.system) + '<span class="cmmid"><b>' + esc(r.name) + (r.blocked ? ' &middot; BLOCKED' : '') + '</b><em>' + esc(r.last || '') + '</em></span><span class="cmtm">' + when(r.ts) + (r.unread ? '<i class="cmud"></i>' : '') + '</span></button>'; }).join('');
      }, function () { var box = $('msList'); if (box) box.innerHTML = '<div class="empty">COULD NOT LOAD TEXTS</div>'; });
    };
    load(); ms.poll = setInterval(function () { if (current() === 'messages' && ms.view === 'list') load(); }, 10000);
    $('msList').addEventListener('click', function (ev) { var b = ev.target.closest('.cmrow'); if (!b) return; ms.view = 'thread'; ms.id = b.getAttribute('data-id'); ms.name = b.getAttribute('data-n'); ms.system = b.getAttribute('data-sys') === '1'; ms.blocked = b.getAttribute('data-bl') === '1'; ms.err = ''; drawMessages(); });
  }
  function drawNew() {
    var el = $('msgApp');
    el.innerHTML = '<div class="pg cm"><div class="cmhead"><button type="button" class="cmback" id="msBack" aria-label="Back">&lsaquo;</button><h3>NEW TEXT</h3><span></span></div><div class="cmbar"><input class="cminp" id="msQ" maxlength="30" placeholder="SEARCH PLAYERS" autocomplete="off"></div><div class="sec" id="msPl"><div class="empty">LOADING</div></div></div>';
    $('msBack').addEventListener('click', function () { ms.view = 'list'; drawMessages(); });
    var all = [], paint = function () { var q = ($('msQ').value || '').toLowerCase(), box = $('msPl'); var r = all.filter(function (p) { return !q || String(p.name).toLowerCase().indexOf(q) > -1; }).slice(0, 60); box.innerHTML = r.length ? r.map(function (p) { return '<button type="button" class="cmrow" data-id="' + esc(p.id) + '" data-n="' + esc(p.name) + '" data-bl="0" data-sys="0">' + avatar(p.name) + '<span class="cmmid"><b>' + esc(p.name) + '</b></span></button>'; }).join('') : '<div class="empty">NO PLAYERS FOUND</div>'; };
    M().players().then(function (rows) { all = rows || []; paint(); }, function () { $('msPl').innerHTML = '<div class="empty">COULD NOT LOAD PLAYERS</div>'; });
    $('msQ').addEventListener('input', paint);
    $('msPl').addEventListener('click', function (ev) { var b = ev.target.closest('.cmrow'); if (!b) return; ms.view = 'thread'; ms.id = b.getAttribute('data-id'); ms.name = b.getAttribute('data-n'); ms.system = false; ms.blocked = false; ms.err = ''; drawMessages(); });
  }
  function drawThread() {
    var el = $('msgApp');
    el.innerHTML = '<div class="pg cm th"><div class="cmhead"><button type="button" class="cmback" id="msBack" aria-label="Back">&lsaquo;</button><h3>' + esc(ms.name) + '</h3>' + (ms.system ? '<span></span>' : '<button type="button" class="cmbtn red" id="msBlock">' + (ms.blocked ? 'UNBLOCK' : 'BLOCK') + '</button>') + '</div><div class="cmlog" id="msLog"></div>' +
      (ms.system ? '<div class="cmfoot note">YOU CANNOT REPLY TO ' + esc(ms.name) + '</div>' : ms.blocked ? '<div class="cmfoot note">YOU BLOCKED THIS PLAYER &middot; UNBLOCK TO TEXT</div>' : '<form class="cmfoot" id="msForm"><input class="cminp" id="msIn" maxlength="280" placeholder="TEXT" autocomplete="off"><button type="submit" class="cmbtn">SEND</button></form>') + '<div class="cmerr" id="msErr">' + esc(ms.err) + '</div></div>';
    $('msBack').addEventListener('click', function () { ms.view = 'list'; drawMessages(); });
    var bl = $('msBlock'); if (bl) bl.addEventListener('click', function () { var on = !ms.blocked; M().block(ms.id, on).then(function () { ms.blocked = on; drawMessages(); }, function () { ms.err = 'COULD NOT CHANGE BLOCK'; drawMessages(); }); });
    var log = function (stick) {
      M().thread(ms.id).then(function (rows) {
        var box = $('msLog'); if (!box) return; var atEnd = stick || box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
        box.innerHTML = (rows && rows.length ? rows : []).map(function (m) { return '<div class="cmb' + (m.me ? ' me' : '') + '"><span>' + lines(m.body) + '</span><small>' + when(m.ts) + '</small></div>'; }).join('') || '<div class="empty">NO TEXTS YET</div>';
        if (atEnd) box.scrollTop = box.scrollHeight;
      });
    };
    log(true); ms.poll = setInterval(function () { if (current() === 'messages' && ms.view === 'thread') log(false); }, 6000);
    var f = $('msForm'); if (f) f.addEventListener('submit', function (ev) { ev.preventDefault(); var i = $('msIn'), t = (i.value || '').trim(); if (!t) return; i.value = ''; M().send(ms.id, t).then(function () { ms.err = ''; $('msErr').textContent = ''; log(true); }, function (e) { $('msErr').textContent = String((e && e.message) || 'COULD NOT SEND').toUpperCase(); }); });
  }

  /* ---------- MAIL ---------- */
  var ml = { open: null };
  function drawMail() {
    var el = $('mailApp'); if (!el) return; el.classList.add('page');
    var A = P.mail ? P.mail() : null;
    if (!P.isSignedIn() || !A) { locked(el, 'MAIL', 'FROM MIMU', 'MAIL OPENS WITH SIGN-IN', 'MIMU SENDS THE BIG NEWS HERE'); return; }
    el.innerHTML = '<div class="pg cm"><div class="pgh"><h2 class="gold">MAIL</h2><div class="pgsub">FROM MIMU</div></div><div class="sec" id="mlList"><div class="empty">LOADING</div></div></div>';
    A.inbox().then(function (rows) {
      var box = $('mlList'); if (!box) return;
      if (!rows || !rows.length) { box.innerHTML = '<div class="empty">NO MAIL YET</div>'; return; }
      box.innerHTML = rows.map(function (r) { return '<button type="button" class="cmrow ml" data-id="' + esc(r.id) + '">' + avatar('M', true) + '<span class="cmmid"><b>' + esc(r.subject) + '</b><em>MIMU</em></span><span class="cmtm">' + when(r.ts) + (r.read ? '' : '<i class="cmud blue"></i>') + '</span></button>'; }).join('');
      box.addEventListener('click', function (ev) { var b = ev.target.closest('.cmrow'); if (!b) return; var id = b.getAttribute('data-id'), m = rows.filter(function (x) { return String(x.id) === id; })[0]; if (!m) return; openMail(m); if (A.read) A.read(m.id); });
    }, function () { var box = $('mlList'); if (box) box.innerHTML = '<div class="empty">COULD NOT LOAD MAIL</div>'; });
  }
  function openMail(m) {
    var el = $('mailApp');
    el.innerHTML = '<div class="pg cm"><div class="cmhead"><button type="button" class="cmback" id="mlBack" aria-label="Back">&lsaquo;</button><h3>MAIL</h3><span></span></div><div class="mlmsg"><h4>' + esc(m.subject) + '</h4><div class="mlfrom">FROM MIMU &middot; ' + when(m.ts) + '</div><div class="mlbody">' + lines(m.body) + '</div></div></div>';
    $('mlBack').addEventListener('click', drawMail);
  }

  /* ---------- MARKETPLACE ---------- */
  /* three shelves: FACE DOWN cards come from the Hall and cost coins (deliberately dear); FACE UP cards come from other players and cost points (far dearer); SELL puts your own cards up */
  var mk = { tab: 'down', msg: '' };
  function drawMarket() {
    var el = $('mktApp'); if (!el) return; el.classList.add('page');
    var A = P.market ? P.market() : null, t = P.totals ? P.totals() : {}, on = P.isSignedIn() && A;
    var tabs = [['down', 'FACE DOWN &middot; COINS'], ['up', 'FACE UP &middot; POINTS'], ['sell', 'SELL']];
    var lockSub = { down: 'FACE DOWN CARDS FROM THE HALL, FOR COINS', up: 'FACE UP CARDS FROM PLAYERS, FOR POINTS', sell: 'SELL ANY CARD YOU HAVE COLLECTED' }[mk.tab];
    el.innerHTML = '<div class="pg cm"><div class="pgh"><h2 class="gold">MARKETPLACE</h2><div class="pgsub">FACE DOWN FOR COINS &middot; FACE UP FOR POINTS</div></div>' +
      '<div class="howto"><div class="hth"><b>HOW TO USE THE MARKETPLACE</b></div>' +
      '<div class="hex"><figure><div class="hcard"><img src="assets/game/card-back.webp" alt="A card you do not have yet, face down"></div><figcaption>FACE DOWN<br>FROM THE HALL<br>COSTS COINS</figcaption></figure><span class="har">&rsaquo;</span><figure><div class="hcard own"><img src="assets/game/cards/ex/049.webp" alt="Good Boy Gary, a collected card, face up"></div><figcaption>FACE UP &middot; #049<br>FROM A PLAYER<br>COSTS POINTS</figcaption></figure></div>' +
      '<div class="hsub">THIS IS HOW EVERY CARD LOOKS IN <b>COLLECTED</b>: FACE DOWN UNTIL YOU HAVE IT, THEN IT FLIPS OVER. THE DIAMONDS SHOW HOW RARE IT IS AND THE NUMBER IS ITS PLACE FROM 1 TO 120.</div>' +
      '<ol class="hsteps"><li><b>FACE DOWN CARDS COME FROM THE HALL.</b> THEY ARE CARDS YOU DO NOT HAVE YET, AND THEY COST <b>COINS</b>. THEY ARE PRICED HIGH ON PURPOSE, SO RUNNING STAYS THE BEST WAY TO BUILD A DECK.</li>' +
      '<li><b>FACE UP CARDS COME FROM PLAYERS.</b> THESE ARE CARDS OTHER PLAYERS HAVE ALREADY COLLECTED, AND THEY COST <b>POINTS</b>, DRAMATICALLY MORE THAN A FACE DOWN CARD. THE SELLER SETS THE PRICE. POINTS YOU SPEND COME OFF YOUR LEADERBOARD SCORE AND GO TO THE SELLER.</li>' +
      '<li><b>NEGOTIATE.</b> PRESS TEXT ON A FACE UP LISTING TO MESSAGE THE SELLER. ASK THEM TO LOWER THE PRICE OR MAKE AN OFFER. IF THEY AGREE, THEY CHANGE THE PRICE AND YOU BUY IT.</li>' +
      '<li><b>SELL.</b> ANY CARD YOU HAVE COLLECTED, EARNED OR BOUGHT, CAN GO TO THE HALL FOR A SET NUMBER OF POINTS, OR BE LISTED FACE UP FOR YOUR OWN PRICE IN POINTS WHILE BUYERS TEXT YOU.</li>' +
      '<li><b>CHECK</b> YOUR DECK IN COLLECTED ANY TIME. ONLY COINS AND POINTS CHANGE HANDS, NEVER MONEY. SALES ARE FINAL.</li></ol></div>' +
      '<div class="mkstats"><div><small>COIN BALANCE</small><b>' + fmt(t.balance) + '</b></div><div><small>COINS EARNED</small><b>' + fmt(t.coins) + '</b></div><div><small>YOUR POINTS</small><b>' + fmt(t.lifetime) + '</b></div></div>' +
      '<div class="tabs3 t3" id="mkTabs">' + tabs.map(function (x) { return '<button' + (mk.tab === x[0] ? ' class="on"' : '') + ' data-k="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="cmerr" id="mkMsg">' + esc(mk.msg) + '</div><div class="sec" id="mkList">' + (on ? '<div class="empty">LOADING</div>' : '<div class="empty">' + LOCK + '<br>THE SHELVES OPEN WITH SIGN-IN<br><span style="opacity:.7">' + lockSub + '</span></div>') + '</div></div>';
    $('mkTabs').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (!b) return; mk.tab = b.getAttribute('data-k'); mk.msg = ''; drawMarket(); });
    if (!on) return;
    var tab = mk.tab, src = tab === 'down' ? (A.shelf || A.listings) : tab === 'up' ? A.listings : A.sellable;
    function thumb(r, c) { var back = tab === 'down'; return '<span class="mkn"><img class="mkt" alt="" loading="lazy" src="' + (back || !c ? 'assets/game/card-back.webp' : esc(c.file)) + '"><b>' + pad3(r.n) + '</b></span>'; }
    function row(r) {
      var c = P.card ? P.card(r.n) : null, name = tab === 'down' ? 'FACE DOWN CARD' : esc(c ? c.name : 'CARD'), sub = esc(r.tier || '') + (tab === 'down' ? ' &middot; FROM THE HALL' : '') + (r.count > 1 ? ' &middot; ' + r.count + ' COPIES' : '');
      var seller = tab === 'up' && r.seller ? '<em class="sl">SOLD BY ' + esc(String(r.seller).toUpperCase()) + ' <button type="button" class="mkmsg" data-id="' + esc(r.sellerId || '') + '" data-name="' + esc(r.seller) + '">TEXT</button></em>' : '';
      var list = tab === 'sell' && A.list ? '<span class="mkl"><input class="mkp" type="number" min="1" inputmode="numeric" placeholder="YOUR PRICE IN POINTS" aria-label="Your price in points"><button type="button" class="mklist" data-n="' + r.n + '">LIST</button></span>' : '';
      var label = tab === 'down' ? fmt(r.price) + ' COINS' : tab === 'up' ? fmt(r.price) + ' PTS' : 'SELL +' + fmt(r.value) + ' PTS';
      return '<div class="mkrow">' + thumb(r, c) + '<span class="cmmid"><b>' + name + '</b><em>' + sub + '</em>' + seller + list + '</span><button type="button" class="cmbtn" data-n="' + r.n + '"' + (r.id != null ? ' data-id="' + esc(r.id) + '"' : '') + '>' + label + '</button></div>';
    }
    src.call(A).then(function (rows) {
      var box = $('mkList'); if (!box) return;
      if (!rows || !rows.length) { box.innerHTML = '<div class="empty">' + (tab === 'sell' ? 'YOU HAVE NO CARDS TO SELL YET' : tab === 'up' ? 'NO PLAYER HAS A CARD FOR SALE RIGHT NOW' : 'THE HALL HAS NOTHING FACE DOWN FOR SALE') + '</div>'; return; }
      box.innerHTML = rows.map(row).join('');
      box.addEventListener('click', function (ev) {
        var tx = ev.target.closest('.mkmsg'); if (tx) { ms.pending = { id: tx.getAttribute('data-id'), name: tx.getAttribute('data-name') }; var mi = $('msgIcon'); if (mi) mi.click(); return; }
        function fail(e) { mk.msg = String((e && e.message) || 'NOT AVAILABLE').toUpperCase(); drawMarket(); }
        var li = ev.target.closest('.mklist'); if (li) { var inp = li.parentNode.querySelector('.mkp'), pr = parseInt(inp.value, 10), n2 = parseInt(li.getAttribute('data-n'), 10); if (!(pr > 0)) { mk.msg = 'TYPE A PRICE IN POINTS FIRST'; $('mkMsg').textContent = mk.msg; return; } li.disabled = true; A.list(n2, pr).then(function () { mk.msg = 'LISTED CARD ' + pad3(n2) + ' FACE UP FOR ' + fmt(pr) + ' POINTS'; drawMarket(); }, fail); return; }
        var b = ev.target.closest('.cmbtn'); if (!b) return; b.disabled = true;
        var n = parseInt(b.getAttribute('data-n'), 10), id = b.getAttribute('data-id'), p;
        if (tab === 'down') p = A.buy(n); else if (tab === 'up') p = (A.buyListing || A.buy)(id != null ? id : n); else p = A.sell(n);
        p.then(function () { mk.msg = tab === 'sell' ? 'SOLD CARD ' + pad3(n) + ' TO THE HALL' : 'BOUGHT CARD ' + pad3(n); drawMarket(); }, fail);
      });
    }, function () { var box = $('mkList'); if (box) box.innerHTML = '<div class="empty">COULD NOT LOAD THE SHELVES</div>'; });
  }

  /* ---------- X and OPENSEA: phone-view pictures of the Mimu On Ape pages, each with a button that opens the real page ---------- */
  var SHOTS = {
    x: { name: 'Mimu On Ape', sub: '@mimuonape', url: 'https://x.com/mimuonape', btn: 'Open on X', img: 'assets/game/x-profile.jpg', alt: 'The Mimu On Ape profile on X: MIMU, @mimuonape, 3,470 followers', cls: 'xshot',
      logo: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' },
    os: { name: 'MIMU On Ape', sub: 'OpenSea collection', url: 'https://opensea.io/collection/mimuonape', btn: 'Open on OpenSea', img: 'assets/game/opensea-collection.jpg', alt: 'The MIMU On Ape collection on OpenSea: items, floor price, volume and holders', cls: 'osshot',
      logo: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#2081e2"/><path fill="#fff" d="M11.200 4.800c.2-.4.7-.3.8.1.8 2 1.300 4.200 1.300 6.400 0 .3-.2.5-.5.500H7c-.4 0-.6-.4-.4-.7zM14.400 9c0-.2.3-.3.4-.1 1.400 1.400 2.700 3.300 3.400 5 .1.2-.1.4-.3.4h-3.500c-.3 0-.5-.2-.5-.5zM5.400 15.400c0-.2.2-.3.3-.3h12.600c.3 0 .4.2.4.4-.3 1.900-1.900 3.400-3.800 3.400H9.200c-2.100 0-3.700-1.400-3.800-3.500z"/></svg>' }
  };
  function drawShot(id, key) {
    var el = $(id), s = SHOTS[key]; if (!el || el.dataset.b) return; el.dataset.b = '1'; el.classList.add('page');
    el.innerHTML = '<div class="xapp"><div class="xh">' + s.logo + '<div style="flex:1;min-width:0"><b>' + esc(s.name) + '</b><span>' + esc(s.sub) + '</span></div><a class="xopen" href="' + s.url + '" target="_blank" rel="noopener noreferrer">' + s.btn + '</a></div><div class="xbody"><div class="' + s.cls + '"><img src="' + s.img + '" alt="' + esc(s.alt) + '" width="750" height="1624" decoding="async"></div></div></div>';
  }

  /* ---------- HOME WIDGETS: my ranking and my deck, under the app icons ---------- */
  function short(n) { n = Math.floor(n || 0); return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : n.toLocaleString('en-US'); }
  var CIRC = 2 * Math.PI * 18;
  function buildWidgets() {
    var g = document.querySelector('.agrid'); if (!g || $('wLb')) return;
    g.insertAdjacentHTML('beforeend',
      '<button type="button" class="wid wlb" id="wLb" aria-label="My ranking"><span class="wt">MY RANKING</span><span class="wrk"><i id="wRk">&mdash;</i><small id="wRkOf">SIGN IN TO RANK</small></span><span class="wst"><span><small>TOTAL</small><b id="wTot">0</b></span><span><small>BEST</small><b id="wBest">0</b></span><span><small>LAST</small><b id="wLast">0</b></span></span></button>' +
      '<button type="button" class="wid wdk" id="wDk" aria-label="My deck"><span class="wt">THE FULL DECK</span><span class="wmid"><svg viewBox="0 0 44 44" class="wring"><circle cx="22" cy="22" r="18" class="rb"/><circle cx="22" cy="22" r="18" class="rf" id="wRf" stroke-dasharray="' + CIRC.toFixed(2) + '" stroke-dashoffset="' + CIRC.toFixed(2) + '"/></svg><span class="wpc" id="wPc">0%</span><span class="wcn"><b id="wCn">0<small>/120</small></b><small id="wLeft">120 TO GO</small></span></span><span class="wtb" id="wTb"></span></button>');
    $('wLb').addEventListener('click', function () { var b = $('lbIcon'); if (b) b.click(); });
    $('wDk').addEventListener('click', function () { var b = $('collIcon'); if (b) b.click(); });
    paintWidgets();
  }
  function paintWidgets() {
    if (!$('wLb')) return;
    var t = P.totals ? P.totals() : {}, own = P.owned ? P.owned() : new Set(), cards = P.cards ? P.cards() : [], total = cards.length || 120, n = 0, byT = {}, i;
    cards.forEach(function (c) { if (own.has && own.has(c.n)) { n++; byT[c.tier] = (byT[c.tier] || 0) + 1; } });
    var pct = total ? n / total : 0, signed = P.isSignedIn();
    $('wRk').innerHTML = signed && t.rank ? '#' + fmt(t.rank) : '&mdash;'; $('wRkOf').textContent = !signed ? 'SIGN IN TO RANK' : t.rank ? 'OF ' + fmt(t.players || t.rank) + ' PLAYERS' : 'NO RANKED RUN YET';
    $('wTot').textContent = short(t.lifetime); $('wBest').textContent = short(t.best); $('wLast').textContent = short(t.last);
    $('wRf').setAttribute('stroke-dashoffset', (CIRC * (1 - pct)).toFixed(2)); $('wPc').textContent = Math.round(pct * 100) + '%';
    $('wCn').innerHTML = n + '<small>/' + total + '</small>'; $('wLeft').textContent = (total - n) + ' TO GO';
    $('wTb').innerHTML = (P.tiers || []).map(function (tr) { var c = byT[tr.n] || 0, w = tr.count ? Math.round(c / tr.count * 100) : 0; return '<span title="' + esc(tr.name) + ' ' + c + '/' + tr.count + '"><i style="width:' + w + '%;background:' + (tr.grad || tr.color) + '"></i></span>'; }).join('');
  }
  P.whenReady(function () { buildWidgets(); paintWidgets(); });
  buildWidgets();

  /* ---------- CAMERA: a viewfinder, a shutter that flashes and clicks, and a photo gallery with a full-screen viewer ---------- */
  var cam = { n: 0, built: false };
  var PICS = [1, 2, 3, 4, 5, 6, 7, 11, 9, 8, 10, 12].map(function (i) { return 'assets/game/photos/p' + i + '.webp'; });
  function camToast(txt) { var t = $('camToast'); if (!t) return; t.innerHTML = txt; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); }
  function buildCamera() {
    var el = $('camApp'); if (!el || cam.built) { if (el) closeGallery(); return; } cam.built = true; el.classList.add('page');
    el.innerHTML = '<div class="cam"><div class="camvf"><img src="assets/game/camera-photo.webp" alt="The camera view: Mimu, ready for a photo"><div class="camgrid"></div></div>' +
      '<div class="camct"><span>&#9889;&#xFE0E; AUTO</span><span>HDR</span></div><div class="cammd">PHOTO</div>' +
      '<button type="button" class="camth" id="camGal" aria-label="Open photos"><img src="' + PICS[PICS.length - 1] + '" alt=""><b id="camN"></b></button>' +
      '<div class="camcb"><button type="button" class="camshut" id="camSh" aria-label="Take a photo"><i></i></button></div><div class="camflash" id="camFl"></div><div class="camtoast" id="camToast"></div></div>';
    $('camSh').addEventListener('click', function () {
      var f = $('camFl'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
      tones([[0, 0.03, [1800]], [0.05, 0.05, [900]]]);
      cam.n++; $('camN').textContent = cam.n; camToast('&#128248; SAVED TO PHOTOS: <b>MIMU, CAUGHT IN 4K</b>');
    });
    $('camGal').addEventListener('click', function () { tones([[0, 0.03, [700]]]); openGallery(); });
  }
  function closeGallery() { var g = document.querySelector('#camApp .camgal'); if (g) g.remove(); }
  function openGallery() {
    var cv = document.querySelector('#camApp .cam'); if (!cv) return; closeGallery();
    var g = document.createElement('div'); g.className = 'camgal';
    function grid() {
      g.innerHTML = '<div class="cgh"><button type="button" class="cgx" id="galX">&lsaquo; CAMERA</button><b>PHOTOS</b><span>' + PICS.length + '</span></div><div class="cgg">' + PICS.map(function (s, i) { return '<button type="button" data-i="' + i + '"><img src="' + s + '" alt="Photo ' + (i + 1) + '" loading="lazy"></button>'; }).join('') + '</div>';
      g.querySelector('#galX').addEventListener('click', function () { g.remove(); tones([[0, 0.03, [500]]]); });
      Array.prototype.forEach.call(g.querySelectorAll('.cgg button'), function (b) { b.addEventListener('click', function () { view(+b.getAttribute('data-i')); }); });
    }
    function view(i) {
      var N = PICS.length; g.innerHTML = '<div class="cgh"><button type="button" class="cgx" id="galB">&lsaquo; PHOTOS</button><b>' + (i + 1) + ' OF ' + N + '</b><span></span></div><div class="cgv"><img src="' + PICS[i] + '" alt="Photo ' + (i + 1) + '"></div><button type="button" class="cga l" id="galP" aria-label="Previous">&lsaquo;</button><button type="button" class="cga r" id="galN" aria-label="Next">&rsaquo;</button>';
      g.querySelector('#galB').addEventListener('click', grid);
      g.querySelector('#galP').addEventListener('click', function () { view((i + N - 1) % N); }); g.querySelector('#galN').addEventListener('click', function () { view((i + 1) % N); });
      var x0 = null, gv = g.querySelector('.cgv');
      gv.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
      gv.addEventListener('pointerup', function (e) { if (x0 == null) return; var dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) view(dx < 0 ? (i + 1) % N : (i + N - 1) % N); });
    }
    grid(); cv.appendChild(g);
  }

  /* ---------- the phone asks for an app ---------- */
  window.HallComms = {
    open: function (name) {
      if (name === 'phone') buildPhone();
      if (name === 'messages') { ms.view = 'list'; if (ms.pending) { ms.view = 'thread'; ms.id = ms.pending.id; ms.name = ms.pending.name; ms.system = false; ms.blocked = false; ms.err = ''; ms.pending = null; } drawMessages(); }
      if (name === 'mail') drawMail();
      if (name === 'market') drawMarket();
      if (name === 'camera') buildCamera();
      if (name === 'x') drawShot('xApp', 'x');
      if (name === 'opensea') drawShot('osApp', 'os');
    }
  };
  var scr = $('pScreen'); if (scr && window.MutationObserver) new MutationObserver(function () { if (current() !== 'phone' && ph.st !== 'dial') { clearTimers(); ph.st = 'dial'; paintPhone(); } }).observe(scr, { attributes: true, attributeFilter: ['class'] });
  P.onChange(function (what) {
    if (what !== 'connect' && what !== 'scores' && what !== 'cards') return;
    paintWidgets();
    var a = current();
    if (a === 'messages') drawMessages(); else if (a === 'mail') drawMail(); else if (a === 'market') drawMarket();
  });
})();
