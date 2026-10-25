/* THE X APP: post your picture on X, paste the link, earn bonus points every 12 hours.
   The picture is one real frame from the game (share-run.jpg); the page draws the player's name and numbers on it. The server checks the post (public, tags @mimuonape, has a picture, new, one use each). */
(function () {
  'use strict';
  var P = window.HallProfile; if (!P) return;
  var ST = null, off = 0, msg = '', ok = false, busy = false, link = '', img = null;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return P.big ? P.big(n) : Math.floor(n || 0).toLocaleString('en-US'); }
  function now() { return Date.now() + off; }
  function A() { return P.xbonus ? P.xbonus() : null; }
  var EVERY = 12 * 3600000;
  function left(ms) { ms = Math.max(0, ms); var h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000); return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  function state() {   // demo | load | norun | ready | wait
    if (!P.isSignedIn() || !A()) return 'demo'; if (!ST) return 'load'; if (!ST.ran) return 'norun'; return ST.canClaim && now() >= ST.nextAt ? 'ready' : 'wait';
  }
  function cur() { var s = $('pScreen'); return s && s.classList.contains('inapp') ? s.dataset.app : ''; }
  function load() {
    var a = A(); if (!a) { ST = null; return Promise.resolve(); }
    return a.status().then(function (s) { ST = s; off = s.now - Date.now(); icon(); if (cur() === 'x') paintPage(); }, function () {});
  }
  /* the X icon on the home screen: green when the bonus is claimed, red and wiggling when a new one is ready */
  function icon() { var b = $('xIcon'); if (!b) return; var st = state(); b.classList.toggle('xred', st === 'ready'); b.classList.toggle('xgreen', st === 'wait'); b.setAttribute('aria-label', st === 'ready' ? 'X: your bonus is ready, post to earn points' : st === 'wait' ? 'X: bonus claimed' : 'X'); }

  /* ---------- the picture: one real run frame, the player's numbers drawn over it ---------- */
  var GOLD = '#f6dc95', GOLD2 = '#d9ac5c';
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function txt(c, s, x, y, size, o) { o = o || {}; c.font = (o.w || 700) + ' ' + size + "px 'Cinzel', Georgia, serif"; c.textAlign = o.a || 'left'; c.fillStyle = o.c || GOLD; try { c.letterSpacing = (o.ls || 0) + 'px'; } catch (e) {} if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = 24; } c.fillText(s, x, y); c.shadowBlur = 0; try { c.letterSpacing = '0px'; } catch (e) {} }
  function frameLine(c, x, y, w, h, r, lw) { var g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#fff0b8'); g.addColorStop(.5, GOLD2); g.addColorStop(1, '#8f5f1a'); c.lineWidth = lw; c.strokeStyle = g; rr(c, x, y, w, h, r); c.stroke(); }
  function stat(c, label, val, x, y) { txt(c, label, x, y, 19, { c: '#e9c982', ls: 3, w: 500 }); txt(c, val, x, y + 44, 38, { c: '#fff' }); }
  function sparkle(c, x, y, s, a) { c.save(); c.globalAlpha = a; c.fillStyle = '#ffe9a8'; c.beginPath(); c.moveTo(x, y - s); c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s); c.quadraticCurveTo(x, y, x - s, y); c.quadraticCurveTo(x, y, x, y - s); c.fill(); c.restore(); }
  function data() {
    var t = P.totals ? P.totals() : {}, total = (P.cards && P.cards().length) || 120, own = P.owned ? P.owned().size : 0, fm = P.foil ? P.foil() : {}, fc = 0, k, stt = P.stats ? P.stats() : {};
    for (k in fm) if (String(fm[k] || '').length >= 2) fc++;
    return { name: P.isSignedIn() ? String(P.username() || 'RUNNER') : 'GUEST', rank: t.rank || 0, points: t.lifetime || 0, coins: t.coins || 0, reg: Math.round(own / total * 1000) / 10, foil: Math.round(fc / total * 1000) / 10, x: stt.xPoints || 0 };
  }
  function draw(cv) {
    var c = cv.getContext('2d'), W = 1080, H = 1080, D = data(), f = img; if (!f) return;
    var g = c.createRadialGradient(W / 2, H * .45, 80, W / 2, H / 2, W * .8); g.addColorStop(0, '#7a1624'); g.addColorStop(.6, '#3a0a12'); g.addColorStop(1, '#12030a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.globalAlpha = .08; for (var i = 0; i < 14; i++) { c.fillStyle = '#ffd98a'; c.fillRect(0, i * 80, W, 2); } c.globalAlpha = 1;
    frameLine(c, 24, 24, W - 48, H - 48, 20, 5); frameLine(c, 40, 40, W - 80, H - 80, 14, 2);
    txt(c, 'THE HALL', W / 2, 118, 76, { a: 'center', w: 900, c: GOLD, ls: 14, glow: 'rgba(255,190,80,.5)' });
    var cw = 470, ch = 658, cx = 90, cy = 180;
    c.save(); c.shadowColor = 'rgba(255,205,90,.7)'; c.shadowBlur = 50; rr(c, cx, cy, cw, ch, 22); c.fillStyle = '#000'; c.fill(); c.restore();
    c.save(); rr(c, cx, cy, cw, ch, 22); c.clip();
    var sc = cw / f.width, dh = f.height * sc; c.drawImage(f, cx, cy + ch - dh, cw, dh);
    var sh = c.createLinearGradient(cx, cy, cx + cw, cy + ch); sh.addColorStop(0, 'rgba(255,90,160,0)'); sh.addColorStop(.3, 'rgba(255,210,90,.14)'); sh.addColorStop(.5, 'rgba(255,240,200,.1)'); sh.addColorStop(.7, 'rgba(255,190,120,.12)'); sh.addColorStop(1, 'rgba(230,120,255,0)'); c.globalCompositeOperation = 'screen'; c.fillStyle = sh; c.fillRect(cx, cy, cw, ch); c.globalCompositeOperation = 'source-over';
    var np = c.createLinearGradient(0, cy + ch - 130, 0, cy + ch); np.addColorStop(0, 'rgba(10,0,4,0)'); np.addColorStop(1, 'rgba(10,0,4,.95)'); c.fillStyle = np; c.fillRect(cx, cy + ch - 130, cw, 130); c.restore();
    var nm = D.name.toUpperCase(), ns = 40; c.font = '700 ' + ns + "px 'Cinzel', Georgia, serif"; while (c.measureText(nm).width > cw - 50 && ns > 20) { ns -= 2; c.font = '700 ' + ns + "px 'Cinzel', Georgia, serif"; }
    txt(c, nm, cx + cw / 2, cy + ch - 34, ns, { a: 'center', c: '#fff', ls: 3 }); frameLine(c, cx, cy, cw, ch, 22, 6);
    c.save(); c.beginPath(); c.arc(cx + 62, cy + 62, 42, 0, 7); c.fillStyle = '#2b0407'; c.fill(); c.lineWidth = 4; c.strokeStyle = GOLD; c.stroke(); c.restore(); txt(c, D.rank ? '#' + D.rank : '#-', cx + 62, cy + 77, D.rank > 99 ? 30 : 38, { a: 'center', c: GOLD });
    sparkle(c, cx + cw - 40, cy + 60, 26, .95); sparkle(c, cx + cw - 90, cy + 110, 14, .8); sparkle(c, cx + 60, cy + 400, 16, .7);
    var rx = 620, words = fmt(D.points).split(' '); txt(c, 'LIFETIME TOTAL', rx, 260, 24, { c: '#e9c982', ls: 8, w: 500 });
    var bs = words[0].length > 7 ? 70 : 100; txt(c, words[0], rx, 350, bs, { c: GOLD, glow: 'rgba(255,190,80,.55)', w: 900 }); if (words[1]) txt(c, words[1], rx + 4, 400, 44, { c: GOLD, ls: 8 });
    c.fillStyle = GOLD2; c.fillRect(rx + 4, 436, 360, 2);
    stat(c, 'COINS', fmt(D.coins), rx + 4, 500); stat(c, 'REGULAR DECK', D.reg + '%', rx + 4, 620); stat(c, 'FOIL DECK', D.foil + '%', rx + 4, 740);
    c.fillStyle = 'rgba(255,205,90,.14)'; rr(c, 90, 880, W - 180, 86, 18); c.fill(); frameLine(c, 90, 880, W - 180, 86, 18, 2); txt(c, 'X POST BONUS  +' + fmt(D.x) + ' PTS', W / 2, 936, 38, { a: 'center', c: '#fff', ls: 4 });
    txt(c, 'PLAY FREE  ·  MIMU.GAMES', W / 2, 1020, 28, { a: 'center', c: GOLD, ls: 8 });
  }
  function loadImg() { return new Promise(function (res) { if (img) return res(); var i = new Image(); i.onload = function () { img = i; res(); }; i.onerror = res; i.src = 'assets/game/share-run.jpg'; }); }
  function fonts() { try { return Promise.all([document.fonts.load("700 40px Cinzel"), document.fonts.load("900 40px Cinzel"), document.fonts.load("500 20px Cinzel")]); } catch (e) { return Promise.resolve(); } }
  function paintCard() { var cv = $('xbCv'); if (!cv) return; Promise.all([loadImg(), fonts()]).then(function () { var c2 = $('xbCv'); if (c2) draw(c2); }); }
  function save() {
    var cv = $('xbCv'); if (!cv) return; draw(cv);
    cv.toBlob(function (b) {
      if (!b) return; var file; try { file = new File([b], 'the-hall.png', { type: 'image/png' }); } catch (e) { file = null; }
      if (file && navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) { navigator.share({ files: [file] }).catch(function () {}); return; }
      var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'the-hall.png'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }, 'image/png');
  }

  /* ---------- the page ---------- */
  var XLOGO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
  var CIRC = 2 * Math.PI * 52;
  function hero(s, amt) {
    var pct = 0, big = '', sub = '', cls = 'off', title = '';
    if (s === 'ready') { cls = 'red'; pct = 1; big = 'READY'; title = 'POST ON X &middot; EARN ' + fmt(amt) + ' POINTS'; sub = 'FOLLOW THE 4 STEPS BELOW'; }
    else if (s === 'wait') { cls = 'green'; pct = Math.min(1, Math.max(0, (now() - ST.lastAt) / EVERY)); big = '<span class="xbt">' + left(ST.nextAt - now()) + '</span>'; title = 'X BONUS CLAIMED'; sub = 'NEXT BONUS OF ' + fmt(amt) + ' POINTS OPENS WHEN THE CLOCK ENDS'; }
    else if (s === 'norun') { big = 'LOCKED'; title = 'FINISH ONE RUN TO UNLOCK'; sub = 'PLAY THE HALL ONCE, THEN COME BACK HERE'; }
    else if (s === 'load') { big = '&hellip;'; title = 'X BONUS'; sub = 'LOADING'; }
    else { big = 'SIGN IN'; title = 'SIGN IN TO USE THE X BONUS'; sub = 'SIGN IN WITH GLYPH, FINISH A RUN, THEN POST ON X TO EARN ' + fmt(amt) + ' POINTS EVERY 12 HOURS'; }
    return '<div class="xhero ' + cls + '"><div class="xring"><svg viewBox="0 0 120 120"><circle class="rb" cx="60" cy="60" r="52"/><circle class="rf" cx="60" cy="60" r="52" stroke-dasharray="' + CIRC.toFixed(1) + '" stroke-dashoffset="' + (CIRC * (1 - pct)).toFixed(1) + '" transform="rotate(-90 60 60)"/></svg><div class="xrc"><span class="xlg">' + XLOGO + '</span><b>' + big + '</b></div></div><div class="xht"><b>' + title + '</b><span>' + sub + '</span></div></div>';
  }
  function paintPage() {
    var el = $('xApp'); if (!el) return; el.classList.add('page'); var s = state(), amt = ST ? ST.amount : 50000, tag = ST ? ST.tag : '@mimuonape';
    var keep = el.querySelector('.pg'), top = keep ? keep.scrollTop : 0, typed = $('xbLink') ? $('xbLink').value : link;
    var steps = [['1', 'SAVE YOUR PICTURE', 'IT HAS YOUR NAME, RANK AND NUMBERS ON A REAL FRAME FROM THE HALL.'], ['2', 'POST IT ON X', 'TAG <b>' + esc(tag.toUpperCase()) + '</b> AND KEEP THE PICTURE IN THE POST. MAKE THE POST PUBLIC.'], ['3', 'COPY THE LINK', 'OPEN YOUR POST ON X, PRESS SHARE, THEN COPY LINK.'], ['4', 'PASTE IT AND CLAIM', 'THE POINTS ARE ADDED TO YOUR SCORE AT ONCE.']];
    el.innerHTML = '<div class="pg cm xa"><div class="pgh"><h2 class="gold">X BONUS</h2><div class="pgsub">POST ON X &middot; EARN ' + fmt(amt) + ' POINTS EVERY 12 HOURS</div></div>' + hero(s, amt) +
      '<div class="xstats"><div><small>X POINTS EARNED</small><b>' + fmt(ST ? ST.xPoints : 0) + '</b></div><div><small>POSTS CLAIMED</small><b>' + fmt(ST ? ST.posts : 0) + '</b></div><div><small>YOUR X ACCOUNT</small><b>' + (ST && ST.handle ? '@' + esc(ST.handle.toUpperCase()) : 'NOT LINKED') + '</b></div></div>' +
      '<div class="xsteps">' + steps.map(function (x) { return '<div class="xstep"><i>' + x[0] + '</i><div><b>' + x[1] + '</b><span>' + x[2] + '</span></div></div>'; }).join('') + '</div>' +
      '<div class="xbpic"><canvas id="xbCv" width="1080" height="1080" aria-label="Your Hall picture to post on X"></canvas></div>' +
      '<div class="xbrow"><button type="button" class="xbbtn" id="xbSave">SAVE PICTURE</button><a class="xbbtn alt" id="xbOpen" href="https://x.com/intent/post?text=' + encodeURIComponent(tag + ' ') + '" target="_blank" rel="noopener noreferrer"><span class="xlg">' + XLOGO + '</span> OPEN X</a></div>' +
      '<div class="xbform"><label>PASTE THE LINK TO YOUR POST<input id="xbLink" type="url" inputmode="url" autocomplete="off" placeholder="https://x.com/yourname/status/..." value="' + esc(typed) + '"></label>' +
      '<button type="button" class="xbbtn go" id="xbClaim"' + (s === 'ready' && !busy ? '' : ' disabled') + '>' + (busy ? 'CHECKING&hellip;' : s === 'ready' ? 'CLAIM ' + fmt(amt) + ' POINTS' : s === 'wait' ? 'NEXT BONUS NOT READY YET' : 'CLAIM LOCKED') + '</button>' +
      (msg ? '<div class="xbmsg' + (ok ? ' ok' : '') + '">' + esc(msg) + '</div>' : '') + '</div>' +
      '<div class="xrules"><b>THE RULES</b><span>YOUR POST MUST BE PUBLIC, NEW, AND TAG ' + esc(tag.toUpperCase()) + ' WITH THE PICTURE. EACH POST COUNTS ONCE. YOUR FIRST POST LINKS YOUR X ACCOUNT TO YOUR PLAYER, AND LATER POSTS MUST COME FROM IT. A NEW BONUS OPENS 12 HOURS AFTER YOUR LAST ONE.</span></div></div>';
    var pg = el.querySelector('.pg'); if (pg) pg.scrollTop = top; paintCard();
    $('xbSave').onclick = save; $('xbLink').oninput = function () { link = this.value; };
    $('xbClaim').onclick = function () {
      var u = ($('xbLink').value || '').trim(); if (!u) { msg = 'PASTE THE LINK TO YOUR POST FIRST'; ok = false; paintPage(); return; }
      busy = true; msg = ''; paintPage();
      A().claim(u).then(function () { busy = false; ok = true; link = ''; msg = 'DONE! ' + fmt(ST.amount) + ' POINTS ADDED TO YOUR SCORE'; return load(); }, function (e) { busy = false; ok = false; msg = String((e && e.message) || 'COULD NOT CHECK THE POST').toUpperCase(); paintPage(); });
    };
  }
  setInterval(function () {
    if (!ST || cur() !== 'x') return; var a = document.querySelectorAll('#xApp .xbt'); Array.prototype.forEach.call(a, function (e) { e.textContent = left(ST.nextAt - now()); });
    if (ST.nextAt && now() >= ST.nextAt && !ST.canClaim) { ST.canClaim = true; paintPage(); }
  }, 1000);
  setInterval(function () { if (ST && ST.nextAt && now() >= ST.nextAt && !ST.canClaim) { ST.canClaim = true; } icon(); }, 1000);
  setInterval(function () { if (P.isSignedIn()) load(); }, 5 * 60000);
  window.HallXBonus = { open: function (name) { if (name !== 'x') return; msg = ''; paintPage(); load(); } };
  P.onChange(function (what) { if (what === 'connect') ST = null; if (what === 'connect' || what === 'scores') { icon(); load(); if (cur() === 'x') paintPage(); } });
  if (P.isSignedIn()) load();
})();
