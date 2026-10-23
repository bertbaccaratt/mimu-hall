/* THE HALL: a three-lane runner for the phone. Pseudo-3D canvas, no libraries.
   The hall (backdrop), the runner, the boxes and the coin all come from the artwork in assets/game. */
(function () {
  'use strict';
  var root = document.getElementById('hallApp');
  if (!root) return;

  var BEST_KEY = 'hall-best';
  var LANE = 0.36;            // lane width as a share of the screen width (at the bottom of the screen)
  var XW = 0.74;              // where the side walls stand, as a share of the screen width, measured from the middle of the road
  var PZ = 1.22;              // how far ahead of the camera the runner stands (1 = bottom of the screen)
  var SP = 1 / PZ;            // the runner's perspective scale
  var HORIZON = 0.385;        // where the floor meets the far end of the hall, as a share of the height
  var TEX_W = 256, TEX_H = 512;

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pad(n, l) { n = String(Math.floor(n)); while (n.length < l) n = '0' + n; return n; }

  /* ---------- screen furniture (score, pause, start / pause / game over cards) ---------- */
  var cv = el('canvas', 'hcv'); root.appendChild(cv);
  var ctx = cv.getContext('2d');
  var hud = el('div', 'hhud', '<div class="hs"><small>SCORE</small><b>00000</b></div><button type="button" class="hpause" aria-label="Pause"><i></i><i></i></button><div class="hc"><span class="hcoin"></span><b>0</b></div>');
  root.appendChild(hud);
  var elScore = hud.querySelector('.hs b'), elCoins = hud.querySelector('.hc b'), btnPause = hud.querySelector('.hpause');
  var ovStart = el('div', 'hov hstart', '<div class="ht gold">THE HALL</div><div class="hline"></div><div class="hsub">RUN THE HALL &middot; STEER CLEAR OF THE BOXES &middot; COLLECT THE COINS</div><div class="hbest">BEST <b>00000</b></div><div class="htap">TAP TO RUN</div><div class="hkeys">SWIPE LEFT OR RIGHT TO CHANGE LANE &middot; SWIPE UP TO JUMP</div>');
  var ovPause = el('div', 'hov hpaused', '<div class="ht gold">PAUSED</div><div class="htap">TAP TO KEEP RUNNING</div>');
  var ovDead = el('div', 'hov hdead', '<div class="ht gold">GAME OVER</div><div class="hline"></div><div class="hres"><span>SCORE</span><b class="rs">0</b></div><div class="hres"><span>COINS</span><b class="rc">0</b></div><div class="hres"><span>BEST</span><b class="rb">0</b></div><button type="button" class="hagain">RUN AGAIN</button>');
  root.appendChild(ovStart); root.appendChild(ovPause); root.appendChild(ovDead);
  [ovPause, ovDead].forEach(function (o) { o.style.display = 'none'; });

  /* ---------- artwork ---------- */
  var imgs = {}, pending = 0;
  function load(name, src) { pending++; var im = new Image(); var done = function () { pending--; }; im.onload = done; im.onerror = done; im.src = src; imgs[name] = im; }
  load('back', 'assets/game/hall-back.webp');
  load('runA', 'assets/game/runA.webp');
  load('runB', 'assets/game/runB.webp');
  load('box', 'assets/game/box.webp');
  load('coin', 'assets/game/coin-sheet.webp');

  /* the marble floor, painted once: black stone with fine gold veins */
  var tex = document.createElement('canvas'); tex.width = TEX_W; tex.height = TEX_H;
  (function () {
    var t = tex.getContext('2d'), g = t.createLinearGradient(0, 0, TEX_W, 0);
    g.addColorStop(0, '#120c14'); g.addColorStop(.5, '#1a1016'); g.addColorStop(1, '#110b13');
    t.fillStyle = g; t.fillRect(0, 0, TEX_W, TEX_H);
    for (var i = 0; i < 90; i++) { t.fillStyle = 'rgba(' + (60 + Math.random() * 60 | 0) + ',' + (40 + Math.random() * 40 | 0) + ',' + (30 + Math.random() * 30 | 0) + ',' + (0.03 + Math.random() * 0.05) + ')'; t.beginPath(); t.arc(Math.random() * TEX_W, Math.random() * TEX_H, 4 + Math.random() * 26, 0, 6.3); t.fill(); }
    function vein(alpha, w) {
      var x = Math.random() * TEX_W, y = Math.random() * TEX_H, a = Math.random() * 6.3;
      t.lineWidth = w; t.strokeStyle = 'rgba(214,170,100,' + alpha + ')';
      for (var off = -TEX_H; off <= TEX_H; off += TEX_H) {
        t.beginPath(); var px = x, py = y + off, aa = a; t.moveTo(px, py);
        for (var k = 0; k < 26; k++) { aa += (Math.random() - .5) * .9; px += Math.cos(aa) * 12; py += Math.sin(aa) * 12; t.lineTo(px, py); }
        t.stroke();
      }
    }
    for (var v = 0; v < 26; v++) vein(0.10 + Math.random() * 0.14, 0.7 + Math.random() * 1.3);
    for (var w = 0; w < 9; w++) vein(0.28 + Math.random() * 0.2, 0.6);
  })();

  /* ---------- state ---------- */
  var W = 0, H = 0, y0 = 0, dpr = 1, active = false, raf = 0, last = 0, S, embers = [], bestScore = 0;
  try { bestScore = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) {}
  for (var q = 0; q < 26; q++) embers.push({ x: Math.random(), y: Math.random(), v: 0.03 + Math.random() * 0.08, r: 0.6 + Math.random() * 1.4, p: Math.random() * 6 });

  function fresh() {
    return { mode: 'idle', paused: false, t: 0, dist: 0, v: 1.4, scrollZ: 0, score: 0, coins: 0, lane: 0, px: 0, vx: 0, jt: -1, ents: [], lastZ: 15, curve: 0, curveT: 0, curveNext: 4, sway: 0, camX: 0, flash: 0, shake: 0, run: 0 };
  }
  S = fresh();
  function showBest() { ovStart.querySelector('.hbest b').textContent = pad(bestScore, 5); }
  showBest();

  function resize() {
    var w = root.clientWidth, h = root.clientHeight; if (!w || !h) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = w; H = h; y0 = Math.round(H * HORIZON);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(root); window.addEventListener('resize', resize);

  /* ---------- spawning: boxes (obstacles) and coins ---------- */
  function box(z, lane) { S.ents.push({ k: 'box', z: z, lane: lane, sc: 0.78 + Math.random() * 0.34 }); }
  function coin(z, lane) { S.ents.push({ k: 'coin', z: z, lane: lane, ph: Math.random() * 20, got: false }); }
  function pattern() {
    var z = S.lastZ + 3.0 + Math.random() * 2.2 - Math.min(1.2, S.dist / 900), r = Math.random(), l = (Math.random() * 3) | 0, o = (l + 1 + ((Math.random() * 2) | 0)) % 3, i, len = 1.2;
    if (r < 0.30) { box(z, l); }
    else if (r < 0.50) { box(z, l); box(z + 0.25, o); }
    else if (r < 0.66) { box(z, l); for (i = 0; i < 4; i++) coin(z - 0.3 + i * 0.5, o); len = 1.8; }
    else if (r < 0.80) { for (i = 0; i < 5; i++) coin(z + i * 0.5, l); len = 2.2; }
    else if (r < 0.90) { var seq = l === 1 ? [1, 0, 1, 2, 1] : l === 0 ? [0, 1, 2, 1, 0] : [2, 1, 0, 1, 2]; for (i = 0; i < 5; i++) coin(z + i * 0.55, seq[i]); len = 2.4; }
    else { box(z, l); box(z + 1.6, o); for (i = 0; i < 3; i++) coin(z + 0.4 + i * 0.5, 3 - l - o); len = 2.2; }
    S.lastZ = z + len;
  }

  /* ---------- update ---------- */
  function start() {
    S = fresh(); S.mode = 'run'; S.v = 4.6;
    ovStart.style.display = 'none'; ovDead.style.display = 'none'; ovPause.style.display = 'none';
  }
  function die() {
    S.mode = 'dead'; S.flash = 1; S.shake = 1;
    var sc = Math.floor(S.score), isBest = sc > bestScore;
    if (isBest) { bestScore = sc; try { localStorage.setItem(BEST_KEY, String(bestScore)); } catch (e) {} }
    ovDead.querySelector('.rs').textContent = sc; ovDead.querySelector('.rc').textContent = S.coins; ovDead.querySelector('.rb').textContent = bestScore + (isBest ? '  NEW' : '');
    showBest();
    setTimeout(function () { if (S.mode === 'dead') ovDead.style.display = 'flex'; }, 650);
  }
  function setPaused(p) { if (S.mode !== 'run') return; S.paused = p; ovPause.style.display = p ? 'flex' : 'none'; }

  function update(dt) {
    S.t += dt;
    var running = S.mode === 'run' && !S.paused;
    var v = S.mode === 'run' ? (S.paused ? 0 : 4.6 + 4.2 * (1 - Math.exp(-S.dist / 650))) : S.mode === 'dead' ? Math.max(0, S.v - dt * 14) : 1.3;
    S.v = v;
    var step = v * dt;
    S.scrollZ += step;
    if (running) {
      S.dist += step;
      S.score += step * 4;
      S.run += dt * (6 + v);
      // the road: now and then it swings and curves, and it always drifts a little
      S.curveNext -= dt;
      if (S.curveNext <= 0) { var r = Math.random(); S.curveT = r < 0.36 ? 0 : (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5); S.curveNext = 3 + Math.random() * 5; }
      S.curve += (S.curveT - S.curve) * Math.min(1, dt * 0.85);
      // lane movement
      var target = S.lane, k = 1 - Math.exp(-dt * 13), nx = S.px + (target - S.px) * k;
      S.vx = (nx - S.px) / Math.max(dt, 0.001); S.px = nx;
      if (S.jt >= 0) { S.jt += dt / 0.62; if (S.jt >= 1) S.jt = -1; }
      // world
      for (var i = S.ents.length - 1; i >= 0; i--) {
        var e = S.ents[i], pz = e.z; e.z -= step;
        if (e.lane === Math.round(S.px) && Math.abs(S.px - e.lane) < 0.62) {
          var cross = pz >= PZ - 0.10 && e.z <= PZ + 0.10;
          if (cross) {
            if (e.k === 'coin' && !e.got) { e.got = true; S.coins++; S.score += 25; S.shake = 0; }
            else if (e.k === 'box') { var jh = S.jt >= 0 ? Math.sin(Math.PI * S.jt) : 0; if (jh < 0.42) { die(); break; } }
          }
        }
        if (e.z < 0.55 || (e.got && e.z < PZ - 0.2)) S.ents.splice(i, 1);
      }
      S.lastZ -= step;
      while (S.lastZ < 15) pattern();
    } else if (S.mode === 'idle') {
      S.curve += (Math.sin(S.t * 0.25) * 0.5 - S.curve) * Math.min(1, dt * 0.5);
      S.run += dt * 3;
    } else if (S.mode === 'dead') {
      for (var j = 0; j < S.ents.length; j++) S.ents[j].z -= step;
    }
    S.sway = Math.sin(S.t * 0.9) * 0.6 + Math.sin(S.t * 0.37 + 1) * 0.4;
    S.camX = S.sway * 0.012 * W + S.curve * 0.012 * W;
    S.flash = Math.max(0, S.flash - dt * 1.6); S.shake = Math.max(0, S.shake - dt * 3);
    for (var m = 0; m < embers.length; m++) { var em = embers[m]; em.y -= em.v * dt; em.x += Math.sin(S.t * 0.6 + em.p) * 0.01 * dt; if (em.y < -0.02) { em.y = 1.02; em.x = Math.random(); } }
    // hud
    var sc2 = pad(S.score, 5); if (elScore.textContent !== sc2) elScore.textContent = sc2;
    if (elCoins.textContent !== String(S.coins)) elCoins.textContent = S.coins;
  }

  /* ---------- drawing ---------- */
  function cxAt(s) { return W / 2 + S.camX + S.curve * 0.52 * W * (1 - s) * (1 - s) + S.sway * 0.035 * W * (1 - s); }

  function drawFloor() {
    var hh = H - y0, y, s, d, v, x0, wd;
    for (y = y0 + 2; y < H; y += 2) {
      s = (y - y0) / hh; if (s < 0.03) continue;
      d = 1 / s; v = ((((d + S.scrollZ) * 0.45) % 1) + 1) % 1 * (TEX_H - 2);
      x0 = cxAt(s) - W * XW * s; wd = W * XW * 2 * s;
      ctx.drawImage(tex, 0, v | 0, TEX_W, 2, x0, y, wd, 2.6);
    }
    // haze where the floor runs into the far end of the hall, and a soft dark at the bottom
    var g = ctx.createLinearGradient(0, y0 - 2, 0, y0 + hh * 0.28);
    g.addColorStop(0, 'rgba(24,10,8,.7)'); g.addColorStop(1, 'rgba(10,4,4,0)'); ctx.fillStyle = g; ctx.fillRect(0, y0 - 2, W, hh * 0.28 + 2);
    var g2 = ctx.createLinearGradient(0, H * 0.78, 0, H); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,.5)'); ctx.fillStyle = g2; ctx.fillRect(0, H * 0.78, W, H * 0.22);
    // warm light from the hall lying on the polished stone
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var sh = ctx.createLinearGradient(0, y0, 0, H); sh.addColorStop(0, 'rgba(150,80,40,.16)'); sh.addColorStop(.5, 'rgba(110,55,30,.12)'); sh.addColorStop(1, 'rgba(70,35,22,.06)');
    ctx.fillStyle = sh; ctx.fillRect(0, y0, W, hh);
    ctx.restore();
    // lamp light pooling on the floor
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (var j = 0; j < 5; j++) {
      var zz = 3.4 - (S.scrollZ % 3.4) + j * 3.4; s = 1 / zz; var py = y0 + s * hh; if (py > H + 10) continue;
      for (var c = -1; c <= 1; c++) {
        var px = cxAt(s) + c * LANE * W * s * 1.0, rx = W * 0.26 * s, ry = W * 0.05 * s + 1;
        var rg = ctx.createRadialGradient(px, py, 0, px, py, rx); rg.addColorStop(0, 'rgba(255,170,80,' + (0.13 * Math.min(1, s * 3)) + ')'); rg.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.save(); ctx.translate(px, py); ctx.scale(1, ry / rx); ctx.translate(-px, -py); ctx.fillStyle = rg; ctx.fillRect(px - rx, py - rx, rx * 2, rx * 2); ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawLines() {
    var hh = H - y0, i, y, s, pts, glow, n, gr = ctx.createLinearGradient(0, y0, 0, H);
    gr.addColorStop(0, 'rgba(255,222,150,0)'); gr.addColorStop(.18, 'rgba(255,222,150,.7)'); gr.addColorStop(1, 'rgba(255,226,160,1)');
    for (glow = 1; glow >= 0; glow--) {
      ctx.fillStyle = glow ? 'rgba(255,190,100,.13)' : gr;
      for (i = 0; i < 4; i++) {
        var off = (i - 1.5) * LANE * W; pts = [];
        for (y = y0 + 3; y <= H + 6; y += 5) { s = (y - y0) / hh; pts.push([cxAt(s) + off * s, y, Math.max(0.6, (glow ? 11 : 3.2) * s * (W / 340))]); }
        ctx.beginPath(); ctx.moveTo(pts[0][0] - pts[0][2], pts[0][1]);
        for (n = 1; n < pts.length; n++) ctx.lineTo(pts[n][0] - pts[n][2], pts[n][1]);
        for (n = pts.length - 1; n >= 0; n--) ctx.lineTo(pts[n][0] + pts[n][2], pts[n][1]);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  /* the side walls of the hall: dark stone panels, gold trim, pillars with candle sconces and crimson banners.
     They stand either side of the road and bend with it. */
  function mix(a, b, t) { return a + (b - a) * t; }
  function rgb(r, g, b, a) { return 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + (a == null ? 1 : a) + ')'; }
  function wp(z, side, h) { var s = 1 / z; return [cxAt(s) + side * XW * W * s, y0 + (H - y0) * s * (1 - h)]; }
  function poly(pts, fill, stroke, lw) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function wquad(z1, z2, h1, h2, side, fill) { poly([wp(z1, side, h1), wp(z1, side, h2), wp(z2, side, h2), wp(z2, side, h1)], fill); }
  function drawWalls() {
    var PER = 3.4, n0 = Math.floor(S.scrollZ / PER), n, side, zc, f;
    for (n = n0 + 8; n >= n0 - 1; n--) {
      zc = n * PER - S.scrollZ;
      for (side = -1; side <= 1; side += 2) {
        // wall panel between two pillars
        var qn = Math.max(0.6, zc + 0.24), qf = Math.min(28, zc + PER - 0.24);
        if (qn < qf) {
          f = clamp(qn / 22, 0, 1);
          wquad(qn, qf, 0, 1.35, side, rgb(mix(36, 12, f), mix(17, 6, f), mix(19, 8, f)));
          wquad(qn, qf, 0, 0.22, side, rgb(mix(20, 8, f), mix(9, 4, f), mix(10, 5, f)));                    // dark wainscot
          wquad(qn, qf, 1.30, 1.35, side, rgb(mix(214, 70, f), mix(160, 46, f), mix(80, 24, f)));
          wquad(qn, qf, 0.22, 0.245, side, rgb(mix(214, 70, f), mix(160, 46, f), mix(80, 24, f)));            // gold trim
          wquad(qn, qf, 1.2, 1.22, side, rgb(mix(214, 70, f), mix(160, 46, f), mix(80, 24, f), 0.8));
          // crimson banner hung in the middle of the panel
          var zb = zc + PER / 2, zh = 0.44, sb = 1 / zb;
          if (zb - zh > 0.6 && zb < 26) {
            var bf = clamp(zb / 22, 0, 1), top = 1.08, bot = 0.45, nt = 0.55;
            poly([wp(zb - zh, side, top), wp(zb + zh, side, top), wp(zb + zh, side, bot), wp(zb, side, nt), wp(zb - zh, side, bot)], rgb(mix(130, 36, bf), mix(18, 6, bf), mix(28, 8, bf)), rgb(mix(226, 80, bf), mix(172, 52, bf), mix(88, 26, bf)), Math.max(0.7, 2 * sb * (W / 340)));
            var dm = wp(zb, side, 0.78), dw = 0.13 * W * sb * 0.9;
            ctx.fillStyle = rgb(mix(226, 80, bf), mix(172, 52, bf), mix(88, 26, bf)); ctx.beginPath(); ctx.moveTo(dm[0], dm[1] - dw); ctx.lineTo(dm[0] + dw * 0.6, dm[1]); ctx.lineTo(dm[0], dm[1] + dw); ctx.lineTo(dm[0] - dw * 0.6, dm[1]); ctx.closePath(); ctx.fill();
          }
        }
        // pillar
        var pn = Math.max(0.6, zc - 0.24), pf = Math.min(28, zc + 0.24);
        if (pn < pf) {
          f = clamp(pn / 22, 0, 1);
          wquad(pn, pf, 0, 1.35, side, rgb(mix(62, 20, f), mix(34, 10, f), mix(34, 12, f)));
          wquad(pn, Math.min(pf, pn + 0.07), 0, 1.35, side, rgb(mix(96, 30, f), mix(58, 16, f), mix(52, 16, f)));  // lit edge
          wquad(pn, pf, 0.88, 0.93, side, rgb(mix(214, 70, f), mix(160, 46, f), mix(80, 24, f)));
          wquad(pn, pf, 0, 0.06, side, rgb(mix(214, 70, f), mix(160, 46, f), mix(80, 24, f)));
          // candle sconce
          if (zc > 0.7) {
            var sp = wp(zc, side, 0.44), ss = 1 / zc, fl = 0.9 + 0.1 * Math.sin(S.t * 9 + n * 2 + side), gx = sp[0] - side * 0.025 * W * ss, gr = 0.2 * (H - y0) * ss * 0.5 * fl;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            var rg = ctx.createRadialGradient(gx, sp[1], 0, gx, sp[1], gr * 2.4); rg.addColorStop(0, 'rgba(255,190,100,.8)'); rg.addColorStop(.35, 'rgba(255,150,60,.28)'); rg.addColorStop(1, 'rgba(255,130,40,0)');
            ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(gx, sp[1], gr * 2.4, 0, 6.3); ctx.fill(); ctx.restore();
            ctx.fillStyle = rgb(mix(226, 90, f), mix(214, 80, f), mix(180, 60, f)); ctx.fillRect(gx - gr * 0.12, sp[1] - gr * 0.1, gr * 0.24, gr * 0.9);
            ctx.fillStyle = '#ffd890'; ctx.beginPath(); ctx.ellipse(gx, sp[1] - gr * 0.3, gr * 0.14, gr * 0.36 * fl, 0, 0, 6.3); ctx.fill();
          }
        }
      }
    }
  }

  function shadow(x, y, w) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.22, 0, 0, 6.3); ctx.fill(); ctx.restore(); }

  function drawBox(e) {
    var hh = H - y0, s = 1 / e.z, y = y0 + s * hh, im = imgs.box; if (!im.naturalWidth || y > H + 80) return;
    var x = cxAt(s) + e.lane * LANE * W * s, bw = 0.30 * W * s * e.sc, bh = bw * im.naturalHeight / im.naturalWidth;
    ctx.save(); ctx.globalAlpha = clamp((s - 0.05) / 0.08, 0, 1);
    shadow(x, y, bw * 0.55);
    ctx.drawImage(im, x - bw / 2, y - bh * 0.9, bw, bh);
    ctx.restore();
  }

  function drawCoin(e) {
    if (e.got) return;
    var hh = H - y0, s = 1 / e.z, y = y0 + s * hh, im = imgs.coin; if (!im.naturalWidth || y > H + 60) return;
    var x = cxAt(s) + e.lane * LANE * W * s, cw = 0.15 * W * s, cy = y - cw * 0.85 - Math.sin(S.t * 4 + e.ph) * cw * 0.06;
    var fr = Math.floor(S.t * 10 + e.ph) % 20, fx = (fr % 5) * 192, fy = ((fr / 5) | 0) * 192;
    ctx.save(); ctx.globalAlpha = clamp((s - 0.05) / 0.08, 0, 1);
    shadow(x, y, cw * 0.32);
    ctx.globalCompositeOperation = 'lighter';
    var rg = ctx.createRadialGradient(x, cy, 0, x, cy, cw * 0.95); rg.addColorStop(0, 'rgba(255,205,110,.55)'); rg.addColorStop(.55, 'rgba(255,170,60,.22)'); rg.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, cy, cw * 0.95, 0, 6.3); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(im, fx, fy, 192, 192, x - cw / 2, cy - cw / 2, cw, cw);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.35; ctx.drawImage(im, fx, fy, 192, 192, x - cw / 2, cy - cw / 2, cw, cw);
    ctx.restore();
  }

  function drawPlayer() {
    var hh = H - y0, y = y0 + SP * hh, x = cxAt(SP) + S.px * LANE * W * SP, jh = S.jt >= 0 ? Math.sin(Math.PI * S.jt) : 0;
    var im = (Math.floor(S.run) % 2 === 0) ? imgs.runA : imgs.runB; if (!im.naturalWidth) return;
    var sh = H * 0.27, sw = sh * im.naturalWidth / im.naturalHeight, bob = (S.mode === 'dead' ? 0 : Math.abs(Math.sin(S.run * Math.PI)) * sh * 0.025);
    var lift = jh * H * 0.11 + bob, tilt = clamp(S.vx * 0.012, -0.16, 0.16);
    shadow(x, y, sw * 0.34 * (1 - jh * 0.35));
    ctx.save(); ctx.translate(x, y - lift); ctx.rotate(tilt);
    if (S.mode === 'dead') ctx.globalAlpha = 0.9;
    // a soft gold edge light so the runner sits in the hall's light
    ctx.drawImage(im, -sw / 2, -sh * 0.97, sw, sh);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#030102'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    var shk = S.shake * 6 * (Math.random() - 0.5);
    ctx.translate(shk, shk * 0.6);
    ctx.translate(W / 2, H * 0.72); ctx.rotate(S.curve * 0.010 + S.sway * 0.003); ctx.translate(-W / 2, -H * 0.72);
    // far end of the hall (the artwork), sliding a little against the road as it bends
    var bi = imgs.back;
    if (bi.naturalWidth) { var bh = y0 + 4, bw = bh * bi.naturalWidth / bi.naturalHeight, bx = (W - bw) / 2 - S.curve * 0.05 * W - S.camX * 0.6; ctx.drawImage(bi, bx, 0, bw, bh); }
    drawFloor(); drawWalls(); drawLines();
    // everything on the road, far to near
    var list = [], j;
    for (j = 0; j < S.ents.length; j++) list.push({ z: S.ents[j].z, e: S.ents[j] });
    list.push({ z: PZ, p: 1 });
    list.sort(function (a, b) { return b.z - a.z; });
    for (j = 0; j < list.length; j++) { var it = list[j]; if (it.p) drawPlayer(); else if (it.e) { if (it.e.k === 'box') drawBox(it.e); else drawCoin(it.e); } }
    // embers
    ctx.globalCompositeOperation = 'lighter';
    for (j = 0; j < embers.length; j++) { var em = embers[j], a = 0.35 + 0.35 * Math.sin(S.t * 2 + em.p); ctx.fillStyle = 'rgba(255,190,100,' + a + ')'; ctx.beginPath(); ctx.arc(em.x * W, em.y * H, em.r, 0, 6.3); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    // vignette
    var vg = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.25, W / 2, H * 0.5, H * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    var tg = ctx.createLinearGradient(0, 0, 0, H * 0.16); tg.addColorStop(0, 'rgba(0,0,0,.55)'); tg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H * 0.16);
    if (S.flash > 0) { ctx.fillStyle = 'rgba(190,20,30,' + (S.flash * 0.45) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  function frame(now) {
    if (!active) { raf = 0; return; }
    raf = requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    if (!W) { resize(); if (!W) return; }
    if (pending > 0) return;
    update(dt); render();
  }

  /* ---------- controls ---------- */
  function lane(d) { if (S.mode !== 'run' || S.paused) return; S.lane = clamp(S.lane + d, -1, 1); }
  function jump() { if (S.mode !== 'run' || S.paused || S.jt >= 0) return; S.jt = 0; }
  var down = null;
  root.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; down = { x: e.clientX, y: e.clientY, t: Date.now(), used: false }; });
  root.addEventListener('pointermove', function (e) {
    if (!down || down.used) return;
    var dx = e.clientX - down.x, dy = e.clientY - down.y, th = Math.max(22, W * 0.07);
    if (Math.abs(dx) > th && Math.abs(dx) > Math.abs(dy)) { lane(dx > 0 ? 1 : -1); down.used = true; }
    else if (dy < -th && Math.abs(dy) > Math.abs(dx)) { jump(); down.used = true; }
  });
  function up() {
    if (!down) return; var d = down; down = null;
    if (d.used) return;
    if (S.mode === 'idle') start(); else if (S.mode === 'run' && S.paused) setPaused(false);
  }
  root.addEventListener('pointerup', up); root.addEventListener('pointercancel', function () { down = null; });
  btnPause.addEventListener('click', function () { setPaused(!S.paused); });
  ovDead.querySelector('.hagain').addEventListener('click', function () { start(); });
  window.addEventListener('keydown', function (e) {
    if (!active) return; var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { lane(-1); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { lane(1); e.preventDefault(); }
    else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') { if (S.mode === 'idle' || S.mode === 'dead') { start(); } else jump(); e.preventDefault(); }
    else if (k === 'p' || k === 'P') { setPaused(!S.paused); }
  });

  /* ---------- the phone calls these ---------- */
  window.HallRunner = {
    open: function () { active = true; resize(); if (S.mode === 'run') setPaused(true); if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
    close: function () { active = false; if (S.mode === 'run') setPaused(true); },
    state: function () { return S; }
  };
})();
