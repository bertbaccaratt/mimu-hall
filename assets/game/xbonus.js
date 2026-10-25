/* X BONUS: post your picture on X, paste the link, earn bonus points every 12 hours.
   The picture is one real frame from the game (share-run.jpg); the page draws the player's name and numbers on it. The server checks the post (public, tags @mimuonape, has a picture, new, one use each). */
(function () {
  'use strict';
  var P = window.HallProfile; if (!P) return;
  var ST = null, off = 0, msg = '', ok = false, busy = false, link = '', img = null, shown = false;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return P.big ? P.big(n) : Math.floor(n || 0).toLocaleString('en-US'); }
  function now() { return Date.now() + off; }
  function A() { return P.xbonus ? P.xbonus() : null; }
  function left(ms) { ms = Math.max(0, ms); var h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000); return h + 'H ' + (m < 10 ? '0' : '') + m + 'M ' + (s < 10 ? '0' : '') + s + 'S'; }
  function state() {   // locked | demo | norun | ready | wait
    if (!P.isSignedIn() || !A()) return 'demo'; if (!ST) return 'load'; if (!ST.ran) return 'norun'; return ST.canClaim && now() >= ST.nextAt ? 'ready' : 'wait';
  }
  function load() {
    var a = A(); if (!a) { ST = null; return Promise.resolve(); }
    return a.status().then(function (s) { ST = s; off = s.now - Date.now(); paintBox(); if (cur() === 'xbonus') paintPage(); }, function () {});
  }
  function cur() { var s = $('pScreen'); return s && s.classList.contains('inapp') ? s.dataset.app : ''; }

  /* ---------- the box at the very top of Badges: green when you are covered, red and wiggling when you can post and earn ---------- */
  function boxInner() {
    var s = state(), amt = ST ? ST.amount : 50000;
    if (s === 'demo') return ['off', 'X BONUS &middot; SIGN IN FIRST', 'SIGN IN WITH GLYPH, FINISH A RUN, THEN POST ON X TO EARN ' + fmt(amt) + ' POINTS EVERY 12 HOURS'];
    if (s === 'load') return ['off', 'X BONUS', 'LOADING&hellip;'];
    if (s === 'norun') return ['off', 'X BONUS &middot; LOCKED', 'FINISH ONE RUN IN THE HALL TO UNLOCK ' + fmt(amt) + ' BONUS POINTS'];
    if (s === 'ready') return ['red', 'POST ON X &middot; EARN ' + fmt(amt) + ' POINTS', 'TAP HERE FOR THE STEPS. YOUR X BONUS IS READY'];
    return ['green', 'X BONUS CLAIMED', 'NEXT BONUS IN <span class="xbt">' + left(ST.nextAt - now()) + '</span> &middot; ' + fmt(ST.xPoints) + ' X POINTS EARNED'];
  }
  function paintBox() {
    var el = $('xbBox'); if (!el) return; var b = boxInner();
    el.className = 'xbox ' + b[0]; el.innerHTML = '<b>' + b[1] + '</b><span>' + b[2] + '</span><i class="xbgo">' + (b[0] === 'off' ? '' : '&rsaquo;') + '</i>';
    el.onclick = function () { if (typeof window.MimuOpenApp === 'function' && state() !== 'demo') window.MimuOpenApp('xbonus'); };
  }

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
    var rx = 620, words = fmt(D.points).split(' '); txt(c, 'TOTAL POINTS', rx, 260, 24, { c: '#e9c982', ls: 8, w: 500 });
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

  /* ---------- the page: the steps, the picture, the claim ---------- */
  function paintPage() {
    var el = $('xbApp'); if (!el) return; el.classList.add('page'); var s = state(), amt = ST ? ST.amount : 50000, tag = ST ? ST.tag : '@mimuonape';
    var chip = s === 'ready' ? '<div class="xbchip red">YOUR BONUS IS READY</div>' : s === 'wait' ? '<div class="xbchip green">CLAIMED &middot; NEXT IN <span class="xbt">' + left(ST.nextAt - now()) + '</span></div>' : s === 'norun' ? '<div class="xbchip off">FINISH ONE RUN TO UNLOCK</div>' : '<div class="xbchip off">SIGN IN TO USE THE X BONUS</div>';
    var keep = el.querySelector('.pg'), top = keep ? keep.scrollTop : 0, typed = $('xbLink') ? $('xbLink').value : link;
    el.innerHTML = '<div class="pg cm"><div class="pgh"><h2 class="gold">X BONUS</h2><div class="pgsub">EARN ' + fmt(amt) + ' POINTS EVERY 12 HOURS</div></div>' + chip +
      '<div class="xbsteps"><b>HOW TO GET YOUR BONUS</b><ol>' +
      '<li><span>1</span><div>SAVE YOUR PICTURE BELOW.</div></li>' +
      '<li><span>2</span><div>POST IT ON X AND TAG <b>' + esc(tag.toUpperCase()) + '</b>. THE PICTURE MUST BE IN THE POST.</div></li>' +
      '<li><span>3</span><div>COPY THE LINK TO YOUR POST.</div></li>' +
      '<li><span>4</span><div>PASTE THE LINK HERE AND PRESS CLAIM. YOUR POINTS ARE ADDED TO YOUR SCORE AT ONCE.</div></li></ol>' +
      '<p>YOUR POST MUST BE PUBLIC AND NEW. EACH POST CAN BE USED ONCE. THE FIRST POST LINKS YOUR X ACCOUNT TO YOUR PLAYER' + (ST && ST.handle ? ': <b>@' + esc(ST.handle.toUpperCase()) + '</b>' : '') + '.</p></div>' +
      '<div class="xbpic"><canvas id="xbCv" width="1080" height="1080" aria-label="Your Hall picture to post on X"></canvas></div>' +
      '<div class="xbrow"><button type="button" class="xbbtn" id="xbSave">SAVE PICTURE</button><a class="xbbtn alt" id="xbOpen" href="https://x.com/intent/post?text=' + encodeURIComponent(tag + ' ') + '" target="_blank" rel="noopener noreferrer">OPEN X</a></div>' +
      '<div class="xbform"><label>LINK TO YOUR POST<input id="xbLink" type="url" inputmode="url" autocomplete="off" placeholder="https://x.com/yourname/status/..." value="' + esc(typed) + '"></label>' +
      '<button type="button" class="xbbtn go" id="xbClaim"' + (s === 'ready' && !busy ? '' : ' disabled') + '>' + (busy ? 'CHECKING&hellip;' : 'CLAIM ' + fmt(amt) + ' POINTS') + '</button>' +
      (msg ? '<div class="xbmsg' + (ok ? ' ok' : '') + '">' + esc(msg) + '</div>' : '') + '</div></div>';
    var pg = el.querySelector('.pg'); if (pg) pg.scrollTop = top; paintCard();
    $('xbSave').onclick = save; $('xbLink').oninput = function () { link = this.value; };
    $('xbClaim').onclick = function () {
      var u = ($('xbLink').value || '').trim(); if (!u) { msg = 'PASTE THE LINK TO YOUR POST FIRST'; ok = false; paintPage(); return; }
      busy = true; msg = ''; paintPage();
      A().claim(u).then(function (r) { busy = false; ok = true; link = ''; msg = 'DONE! ' + fmt(ST.amount) + ' POINTS ADDED TO YOUR SCORE'; return load(); }, function (e) { busy = false; ok = false; msg = String((e && e.message) || 'COULD NOT CHECK THE POST').toUpperCase(); paintPage(); });
    };
  }
  setInterval(function () {
    var a = document.querySelectorAll('.xbt'); if (!a.length || !ST) return; var t = left(ST.nextAt - now()); Array.prototype.forEach.call(a, function (e) { e.textContent = t; });
    if (ST.nextAt && now() >= ST.nextAt && !ST.canClaim) { ST.canClaim = true; paintBox(); if (cur() === 'xbonus') paintPage(); }
  }, 1000);
  window.HallXBonus = {
    paintBox: function () { paintBox(); if (!ST || !shown) { shown = true; load(); } else if (P.isSignedIn()) load(); },
    open: function (name) { if (name !== 'xbonus') return; msg = ''; paintPage(); load(); }
  };
  P.onChange(function (what) { if (what === 'connect' || what === 'scores') { ST = null; if ($('xbBox')) { paintBox(); load(); } if (cur() === 'xbonus') paintPage(); } });
})();
