/* THE HALL: a three-lane runner for the phone. Pseudo-3D canvas, no libraries.
   The hall (backdrop), the runner, the boxes and the coin all come from the artwork in assets/game. */
(function () {
  'use strict';
  var root = document.getElementById('hallApp');
  if (!root) return;

  var LANE = 0.40;            // lane width as a share of the screen width (at the bottom of the screen)
  var XW = 0.78;              // where the side walls stand, as a share of the screen width, measured from the middle of the road
  var PZ = 1.22;              // how far ahead of the camera the runner stands (1 = bottom of the screen)
  var SP = 1 / PZ;            // the runner's perspective scale
  var HORIZON = 0.385;        // where the floor meets the far end of the hall, as a share of the height
  var TEX_W = 256, TEX_H = 512;

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pad(n, l) { n = String(Math.floor(n)); while (n.length < l) n = '0' + n; return n; }

  /* ---------- screen furniture (score, start / game over cards) ---------- */
  var cv = el('canvas', 'hcv'); root.appendChild(cv);
  var ctx = cv.getContext('2d');
  var hud = el('div', 'hhud', '<div class="hs"><small>SCORE</small><b>00000</b><div class="hhp"><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="hr"><div class="hc"><span class="hcoin"></span><b>0</b></div><div class="hk"><span class="hcardi"></span><b>0</b></div><div class="hsl"></div></div>');
  root.appendChild(hud);
  var MPH = 6.5, MILES = 0.001806;   // game speed units to miles per hour, and game distance units to miles (1 unit is about 2.9 metres)
  var hbot = el('div', 'hbot', '<div class="hsp"><svg viewBox="0 0 60 36" aria-hidden="true"><path class="gtr" d="M6 32 A24 24 0 0 1 54 32"/><path class="gfl" d="M6 32 A24 24 0 0 1 54 32" stroke-dasharray="75.4" stroke-dashoffset="75.4"/><line class="gnd" x1="30" y1="32" x2="30" y2="13"/><circle class="ghb" cx="30" cy="32" r="2.6"/></svg><b class="hv">0</b><span>MPH</span></div><div class="hdi"><b class="hd">0.00</b><span>MILES</span></div>');
  root.appendChild(hbot);
  var hbuff = el('div', 'hbuff', '<div class="hbm" hidden><i class="hbi"></i><span>MAGNET</span><b></b><u><i></i></u></div><div class="hbx" hidden><i class="hbi">&times;</i><span>COINS</span><b></b><u><i></i></u></div>');
  root.appendChild(hbuff);
  var elBm = hbuff.querySelector('.hbm'), elBx = hbuff.querySelector('.hbx'), lastBm = '', lastBx = '', lastBp = -1;
  function phoneBat(bp, hot) {   // the phone's own battery readout, live during a run
    var a = document.querySelector('.bpct'), b = document.querySelector('.batt'); if (!a || !b) return;
    a.textContent = bp + '%'; b.style.setProperty('--bp', bp + '%'); var low = bp <= 20 && S.mode !== 'idle';
    a.classList.toggle('low', low); b.classList.toggle('low', low);
    if (hot) { a.classList.add('hot'); b.classList.add('hot'); setTimeout(function () { a.classList.remove('hot'); b.classList.remove('hot'); }, 900); }
  }
  function resetBat() { lastBp = -1; phoneBat(69, false); }
  var elMph = hbot.querySelector('.hv'), elNeedle = hbot.querySelector('.gnd'), elArc = hbot.querySelector('.gfl'), elDist = hbot.querySelector('.hd'), lastMph = -1, lastDist = '', lastSlow = null;
  var hpSegs = hud.querySelectorAll('.hhp i'), elScore = hud.querySelector('.hs b'), elCoins = hud.querySelector('.hc b'), elCards = hud.querySelector('.hk b'), elSlow = hud.querySelector('.hsl');
  var ovStart = el('div', 'hov hstart', '<div class="ht gold">THE HALL</div><div class="hline"></div><div class="hsub">RUN THE HALL &middot; STEER CLEAR OF THE BOXES &middot; COLLECT THE COINS</div><div class="hbest">BEST <b>00000</b></div><div class="htap">TAP TO RUN</div><div class="hkeys">SWIPE LEFT OR RIGHT TO CHANGE LANE &middot; UP TO JUMP &middot; DOWN TO SLIDE</div>');
  var ovDead = el('div', 'hov hdead', '<div class="ht gold">GAME OVER</div><div class="hline"></div><div class="hres"><span>SCORE</span><b class="rs">0</b></div><div class="hres"><span>COINS</span><b class="rc">0</b></div><div class="hres"><span>CARDS</span><b class="rk">0</b></div><div class="hres"><span>BEST</span><b class="rb">0</b></div><button type="button" class="hagain">RUN AGAIN</button>');
  var ovLife = el('div', 'hov hlife', '<div class="ht gold">ANOTHER LIFE?</div><div class="hline"></div><div class="hlt">YOU CRASHED. KEEP THIS RUN GOING WITH ONE EXTRA LIFE.</div><div class="hcost"><span>COST</span><b class="lc">0</b><em>10% OF YOUR POINTS</em></div><div class="hpts">YOUR POINTS <b class="lp">0</b></div><button type="button" class="hbuy">BUY A LIFE</button><button type="button" class="hno">NO THANKS</button><div class="hmsg"></div><div class="hnote">ONE EXTRA LIFE PER RUN &middot; CRASH AGAIN AND THE RUN ENDS</div>');
  root.appendChild(ovStart); root.appendChild(ovDead); root.appendChild(ovLife);
  ovDead.style.display = 'none'; ovLife.style.display = 'none';

  /* ---------- artwork ---------- */
  var imgs = {}, pending = 0;
  function load(name, src) { pending++; var im = new Image(); var done = function () { pending--; }; im.onload = done; im.onerror = done; im.src = src; imgs[name] = im; }
  load('back', 'assets/game/hall-back-open.webp');
  load('runA', 'assets/game/runA.webp');
  load('runB', 'assets/game/runB.webp');
  load('box', 'assets/game/box.webp');
  load('coin', 'assets/game/coin-sheet.webp');
  load('coinG', 'assets/game/coin-gold.webp');   // the coins you collect: gold with black lines (the black sheet above is the big coin in the far background)
  load('wall', 'assets/game/wall.webp');
  load('floor', 'assets/game/floor.webp');
  load('slide', 'assets/game/slide.webp');
  load('pack', 'assets/game/pack.webp');

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
  /* PHONES ONLY: the picture is drawn a little less sharp when the phone cannot keep up, and the game clock always follows real time (computers are untouched) */
  var TOUCH = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches), qLevel = 0, qEma = 0.0167, qN = 0, QS = [1, 0.82, 0.68, 0.55], FSTEP = [2, 2, 3, 4];
  var W = 0, H = 0, y0 = 0, dpr = 1, active = false, raf = 0, last = 0, S, embers = [], bestScore = 0, cardImgs = {};
  for (var q = 0; q < 26; q++) embers.push({ x: Math.random(), y: Math.random(), v: 0.03 + Math.random() * 0.08, r: 0.6 + Math.random() * 1.4, p: Math.random() * 6 });

  function fresh() {
    return { rh: { n: 0, last: 0, mean: 0, m2: 0, min: 1e9 }, mode: 'idle', hp: 6, inv: 0, alive: 0, climbT: 0, slowT: 0, slowF: 1, nextSight: 1e9, nextPack: 1e9, packLane: null, cards: [], runOwned: new Set(), rc: null, t: 0, dist: 0, v: 1.4, scrollZ: 0, score: 0, coins: 0, lane: 0, px: 0, vx: 0, jt: -1, sl: -1, ents: [], lastZ: 15, curve: 0, curveT: 0, curveNext: 4, sway: 0, camX: 0, flash: 0, shake: 0, run: 0, net: null, netBeat: 10, batt: 100, magT: 0, mult: 1, multT: 0, multCool: 0, itemReq: { magnet: 0, multi: 0, battery: 0 }, diedBy: '', battLow: 0, netFoilAt: 60, netStaggerAt: 2100, firstReq: [false, false], dropSeen: {}, dropGot: 0, hintUntil: 0, jumps: 0, slides: 0, lanes: 0, boxesJumped: 0, hits: 0, packs: 0 };
  }
  S = fresh();
  function showBest() { ovStart.querySelector('.hbest b').textContent = pad(bestScore, 5); }
  showBest();

  function resize() {
    var w = root.clientWidth, h = root.clientHeight; if (!w || !h) return;
    dpr = Math.min(2, window.devicePixelRatio || 1) * (TOUCH ? QS[qLevel] : 1);
    W = w; H = h; y0 = Math.round(H * HORIZON);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(root); window.addEventListener('resize', resize);

  /* ---------- spawning: boxes (obstacles) and coins ---------- */
  function specialNear(z, lane) { for (var i = 0; i < S.ents.length; i++) { var e = S.ents[i]; if ((e.k === 'card' || e.k === 'pack' || e.k === 'item') && e.lane === lane && Math.abs(e.z - z) < 1.8) return true; } return false; }
  function box(z, lane) { if (specialNear(z, lane - 1)) return; var r = Math.random(); S.ents.push({ k: 'box', z: z, lane: lane - 1, sc: 0.94 + Math.random() * 0.12, tier: r < 0.55 ? 0 : r < 0.8 ? 1 : 2 }); }
  function coin(z, lane) { S.ents.push({ k: 'coin', z: z, lane: lane - 1, ph: Math.random() * 20, got: false }); }
  function pattern() {
    var z = S.lastZ + 2.3 + Math.random() * 1.6 - Math.min(0.9, S.dist / 1400), r = Math.random(), l = (Math.random() * 3) | 0, o = (l + 1 + ((Math.random() * 2) | 0)) % 3, i, len = 1.2, l3 = 3 - l - o;
    if (r < 0.16) { box(z, l); for (i = 0; i < 5; i++) coin(z - 0.4 + i * 0.5, o); len = 2.2; }
    else if (r < 0.28) { box(z, l); box(z + 0.25, o); for (i = 0; i < 5; i++) coin(z + 0.1 + i * 0.5, l3); len = 2.4; }
    else if (r < 0.46) { box(z, l); for (i = 0; i < 6; i++) coin(z - 0.4 + i * 0.5, o); for (i = 0; i < 3; i++) coin(z + 1.6 + i * 0.5, l3); len = 3.2; }
    else if (r < 0.66) { for (i = 0; i < 7; i++) coin(z + i * 0.5, l); len = 3.4; }
    else if (r < 0.82) { var seq = l === 1 ? [1, 0, 0, 1, 2, 2, 1] : l === 0 ? [0, 1, 1, 2, 2, 1, 0] : [2, 1, 1, 0, 0, 1, 2]; for (i = 0; i < 7; i++) coin(z + i * 0.5, seq[i]); len = 3.4; }
    else if (r < 0.92) { for (i = 0; i < 6; i++) { coin(z + i * 0.5, l); coin(z + i * 0.5, o); } len = 3; }
    else { box(z, l); box(z + 1.7, o); for (i = 0; i < 4; i++) coin(z + 0.5 + i * 0.4, l3); for (i = 0; i < 4; i++) coin(z + 2.2 + i * 0.4, l); len = 3.6; }
    S.lastZ = z + len;
  }

  /* ---------- card sightings and the pack ---------- */
  function cardImg(n) { var im = cardImgs[n]; if (!im) { im = new Image(); im.src = HallProfile.card(n).file; cardImgs[n] = im; } return im; }
  // which card a sighting is: a lottery with no time limit for Common, Uncommon and Rare (always a card you do not have yet); Prestige joins at 2:00 alive and Legendary at 3:00, at their small odds. A sighting is never a duplicate
  function pickCard() {
    var P = HallProfile, cfg = P.config.sight, list = P.cards(); if (!list.length) return null;
    var test = S.rc.test, own = P.owned(), byTier = [[], [], [], [], [], []], i, t;
    function have(c) { return own.has(c.n) || S.runOwned.has(c.n); }
    list.forEach(function (c) { byTier[c.tier].push(c); });
    function complete(tr) { return byTier[tr].every(have); }
    var tier = 0, open = [], w = [], total = 0, r;
    for (t = 1; t <= 5; t++) {
      if (!(test || S.alive >= cfg.locksSec[t - 1])) continue;
      if (complete(t)) continue;   // a sighting is never a duplicate, so a finished tier drops out
      open.push(t); w.push(cfg.odds[t - 1]);
    }
    if (!open.length) return null;   // every card is collected
    w.forEach(function (x) { total += x; }); r = Math.random() * total;
    for (i = 0; i < open.length; i++) { r -= w[i]; if (r <= 0) { tier = open[i]; break; } }
    if (!tier) tier = open[open.length - 1];
    var cand = byTier[tier].filter(function (c) { return !have(c); });
    return cand[(Math.random() * cand.length) | 0];
  }
    // a lane for something floating ahead: never on top of a box, and (for the pack) never the lane the last pack used
  function freeLane(z, avoid) {
    var lanes = [-1, 0, 1].filter(function (l) { return l !== avoid; }).sort(function () { return Math.random() - 0.5; }), i, j, bad;
    for (var dz = 0; dz < 12; dz += 1.4) for (i = 0; i < lanes.length; i++) { bad = false; for (j = 0; j < S.ents.length; j++) { var e = S.ents[j]; if (e.lane === lanes[i] && Math.abs(e.z - (z + dz)) < 1.8) bad = true; } if (!bad) return { lane: lanes[i], z: z + dz }; }
    return { lane: lanes[0], z: z };
  }
  function spawnCard() {
    var c = pickCard(); if (!c) return; cardImg(c.n);
    var spot = freeLane(16.5, null); S.ents.push({ k: 'card', n: c.n, tier: c.tier, z: spot.z, lane: spot.lane, ph: Math.random() * 6, got: false });
  }
  /* ---------- power-ups: the coin magnet, the coin multiplier and the phone battery ---------- */
  function itemDue(kind, t) {   // how many of this power-up are due by this many seconds alive (the server uses the same timetable)
    var it = HallProfile.config.items[kind], x = t - it.firstSec + 3; if (x < 0) return 0;
    if (kind === 'multi') { var k = Math.floor(x / it.periodSec), w = x - k * it.periodSec; return k * it.chips + Math.min(it.chips, Math.floor(w / it.gapSec) + 1); }
    return 1 + Math.floor(x / it.everySec);
  }
  function requestItem(kind, nr) {
    var cur = S; if (nr) nr.drop(kind).then(function (r) { if (S === cur && r && r.dropId) spawnItem(kind, r.dropId); }, function () {}); else spawnItem(kind, null);
  }
  function spawnItem(kind, dropId) {
    var spot = freeLane(16.5, null); S.ents.push({ k: 'item', item: kind, z: spot.z, lane: spot.lane, ph: Math.random() * 6, got: false, dropId: dropId });
    hint(kind === 'magnet' ? 'A COIN MAGNET! RUN INTO IT!' : kind === 'multi' ? 'A COIN MULTIPLIER! RUN INTO IT!' : 'A PHONE BATTERY! RUN INTO IT!', 3);
  }
  function collectItem(e) {
    var cf = HallProfile.config.items, nr = HallProfile.netRun && HallProfile.netRun(); if (e.dropId && nr) nr.collect(e.dropId).then(function () {}, function () {});
    if (window.MIMUAudio && MIMUAudio.pack) MIMUAudio.pack();
    if (e.item === 'magnet') { S.magT = cf.magnet.durSec; hint('COIN MAGNET! ' + cf.magnet.durSec + ' SECONDS', 3); }
    else if (e.item === 'multi') {
      if (S.mult >= cf.multi.max || S.multCool > 0) return;
      S.mult++; S.multT = cf.multi.levelSec; if (S.mult >= cf.multi.max) S.multCool = cf.multi.cooldownSec;
      hint('COIN MULTIPLIER x' + S.mult + (S.mult >= cf.multi.max ? '! MAXED, THEN A COOLDOWN' : '!'), 3);
    } else { S.batt = Math.min(cf.battery.start, S.batt + cf.battery.gain); S.battLow = 0; hint('PHONE BATTERY +' + cf.battery.gain + '%', 3); phoneBat(Math.round(S.batt), true); lastBp = Math.round(S.batt); }
  }
  function tickItems(dt) {
    var cf = HallProfile.config.items, nr = HallProfile.netRun && HallProfile.netRun(), kinds = ['magnet', 'multi', 'battery'], i, kind, due;
    if (nr && !S.net && !S.netFailed) return;   /* wait for the server run to open; if it was refused (under 5 NFTs) this is a demo run and the power-ups come from the game itself */
    for (i = 0; i < kinds.length; i++) {
      kind = kinds[i]; due = itemDue(kind, S.alive);
      while (S.itemReq[kind] < due) { S.itemReq[kind]++; if (kind === 'multi' && (S.multCool > 0 || S.mult >= cf.multi.max)) continue; requestItem(kind, S.netFailed ? null : nr); }
    }
    if (S.magT > 0) S.magT = Math.max(0, S.magT - dt);
    if (S.mult > 1) { S.multT -= dt; if (S.multT <= 0) { S.mult--; S.multT = S.mult > 1 ? cf.multi.levelSec : 0; } }
    if (S.multCool > 0) S.multCool = Math.max(0, S.multCool - dt);
    S.batt -= dt * cf.battery.drainPerMin / 60;
    if (S.batt <= 20 && S.battLow < 1) { S.battLow = 1; hint('LOW BATTERY! GRAB A GREEN BATTERY', 4); }
    if (S.batt <= 8 && S.battLow < 2) { S.battLow = 2; hint('PHONE ABOUT TO DIE!', 4); }
    if (S.batt <= 0) { S.batt = 0; S.diedBy = 'battery'; phoneBat(0, false); die(true); }
  }
  function spawnPack() {
    var spot = freeLane(16.5, S.packLane); S.packLane = spot.lane; S.ents.push({ k: 'pack', z: spot.z, lane: spot.lane, ph: Math.random() * 6, got: false });
  }
  function collectCard(e) {
    if (e.drop) {   // a card the server dropped: the server decides, we just show it
      var nr = HallProfile.netRun && HallProfile.netRun(), cur = S; S.dropGot++; S.cardPulse = 1; if (window.MIMUAudio && MIMUAudio.card) MIMUAudio.card();
      if (nr) nr.collect(e.drop.id).then(function (r) { if (S === cur || true) hint(r.already ? '' : r.foil ? (r.complete ? 'FOIL CARD COMPLETE!' : r.wasNew ? 'FOIL HALF COLLECTED' : 'YOU ALREADY HAD THAT HALF') : (r.wasNew ? 'NEW CARD ADDED TO YOUR DECK!' : 'DUPLICATE ADDED: YOU NOW HAVE ' + r.count), 4); }, function (er) { hint(String((er && er.message) || 'THAT CARD FLOATED AWAY').toUpperCase(), 3); });
      return;
    }
    S.cards.push(e.n); S.runOwned.add(e.n); S.cardPulse = 1;
    HallProfile.addCard(e.n);                                  // does nothing until somebody is signed in
    if (window.MIMUAudio && MIMUAudio.card) MIMUAudio.card();
  }
  function collectPack() {
    S.packs++; S.slowT = HallProfile.config.pack.slowSec; S.packPulse = 1;
    if (window.MIMUAudio && MIMUAudio.pack) MIMUAudio.pack();
  }
  /* ---------- update ---------- */
  function start() {
    S = fresh(); S.mode = 'run'; S.v = 4.6; showHp();
    // this run's timetable (admin test mode makes the card sightings and the pack come quickly)
    var cf = HallProfile.config, test = HallProfile.isTest();
    S.rc = { test: test, sightEvery: test ? HallProfile.testConfig.sight.everySec : cf.sight.everySec, packEvery: test ? HallProfile.testConfig.pack.everySec : cf.pack.everySec };
    S.nextSight = S.rc.sightEvery; S.nextPack = test ? HallProfile.testConfig.pack.firstSec : cf.pack.firstSec;
    ovStart.style.display = 'none'; ovDead.style.display = 'none'; root.classList.remove('phonedead'); resetBat();
    /* signed in: the server opens a run for us, and later hands out the new-player card, echo cards and the wanted card */
    var cur = S, nr = HallProfile.netRun && HallProfile.netRun();
    if (window.HallNet && HallNet.ev) HallNet.ev('played');
    if (nr) nr.start().then(function (info) { if (S === cur) { S.net = info; S.netStaggerAt = info.staggerFirst || 2100; S.netFoilAt = info.foilAt != null ? info.foilAt : 60; } }, function (e) { if (S === cur) { S.net = null; S.netFailed = true; if (e && e.data && (e.data.nft || e.status === 403)) hint(String(e.data.error || 'THIS IS A DEMO RUN.'), 7); } });
  }
  /* ---------- cards the server puts in a run: the new-player card, echoes and the wanted card ---------- */
  var elHint = el('div', 'hhint', ''); root.appendChild(elHint);
  function hint(text, secs) { elHint.textContent = text; elHint.classList.add('on'); S.hintUntil = S.t + (secs || 4); }
  function spawnDrop(kind, r) {
    if (!r || !r.dropId || S.dropSeen[r.dropId]) return; S.dropSeen[r.dropId] = 1;
    var c = HallProfile.card(r.card); if (!c) return; cardImg(c.n);
    var spot = freeLane(16.5, null); S.ents.push({ k: 'card', n: c.n, tier: c.tier, z: spot.z, lane: spot.lane, ph: Math.random() * 6, got: false, drop: { id: r.dropId, kind: kind, half: r.half || '' } });
    hint(kind === 'wanted' ? 'THE WANTED CARD! RUN INTO IT!' : kind === 'foil' ? (r.half === 'B' ? 'BOTH HALVES OF A FOIL CARD! JUMP IT!' : 'A GLOWING FOIL HALF! JUMP IT!') : kind === 'stagger' ? 'A STAGGER CARD: A DUPLICATE! RUN INTO IT!' : 'YOUR FIRST CARD! RUN INTO IT!', 5);
    if (window.MIMUAudio && MIMUAudio.pack) MIMUAudio.pack();
  }
  function netTick() {
    var nr = HallProfile.netRun && HallProfile.netRun(), cur = S; if (!nr || !S.net) return;
    if (S.alive >= S.netBeat) {
      S.netBeat = S.alive + 10;
      nr.beat({ score: Math.floor(S.score), alive: Math.floor(S.alive), coins: S.coins, hp: S.hp, cards: S.cards.length + S.dropGot, speed: Math.round(S.v * MPH * 10) }).then(function (r) { if (S === cur && r && r.wanted) spawnDrop('wanted', r.wanted); }, function () {});
    }
    if (S.net.offerFirst) for (var i = 0; i < 2; i++) if (!S.firstReq[i] && S.alive >= S.net.firstOffers[i]) { S.firstReq[i] = true; nr.drop('first').then(function (r) { if (S === cur && r && r.dropId) spawnDrop('first', r); }, function () {}); }
    if (S.alive >= S.netStaggerAt) { S.netStaggerAt = S.alive + 60; nr.drop('stagger').then(function (r) { if (S === cur && r && r.dropId) { S.netStaggerAt = S.alive + (S.net.staggerEvery || 900); spawnDrop('stagger', r); } }, function () {}); }
    if (S.alive >= S.netFoilAt) { S.netFoilAt = S.alive + 60; nr.drop('foil').then(function (r) { if (S === cur && r && r.dropId) { S.netFoilAt = S.alive + (S.net.foilEvery || 1800); spawnDrop('foil', r); } }, function () {}); }
  }
  function die(silent) {
    S.mode = 'dead'; S.flash = 1; S.shake = 1; if (!silent && window.MIMUAudio && MIMUAudio.hit) MIMUAudio.hit();
    if (!silent && !S.lifeUsed) { showOffer(); return; }   // the first crash of a run: offer the one extra life
    finalize();
  }
  /* ---------- the one extra life: bought after the first crash, for 10% of the player's points ---------- */
  function fmtN(n) { return Math.floor(n || 0).toLocaleString('en-US'); }
  function showOffer() {
    S.offer = true;
    var signed = HallProfile.isSignedIn(), pts = Math.floor((HallProfile.totals().points != null ? HallProfile.totals().points : HallProfile.totals().lifetime) || 0), cost = HallProfile.lifeCost();
    S.lifeCost = cost; ovLife.querySelector('.lc').textContent = signed ? fmtN(cost) + ' PTS' : 'FREE (DEMO)';
    ovLife.querySelector('.lp').textContent = signed ? fmtN(pts) : '—';
    var buy = ovLife.querySelector('.hbuy'), msg = ovLife.querySelector('.hmsg'); buy.disabled = signed && pts < cost; msg.textContent = signed ? (pts < cost ? 'NOT ENOUGH POINTS FOR A LIFE' : '') : 'DEMO RUN · NOTHING IS SPENT OR SAVED';
    setTimeout(function () { if (S.mode === 'dead' && S.offer) ovLife.style.display = 'flex'; }, 650);
  }
  function revive() {
    S.offer = false; S.lifeUsed = true; S.mode = 'run'; S.hp = 6; showHp(); S.inv = 2.6; S.flash = 0.7; S.shake = 0; S.jt = -1; S.sl = -1;
    for (var i = S.ents.length - 1; i >= 0; i--) if (S.ents[i].k === 'box' && S.ents[i].z < PZ + 2.5) S.ents.splice(i, 1);   // clear the boxes right in front so the new life gets a fair start
    ovLife.style.display = 'none';
    if (window.MIMUAudio && MIMUAudio.card) MIMUAudio.card();
  }
  function decline() { if (!S.offer) return; S.offer = false; ovLife.style.display = 'none'; finalize(); }
  function leave() { forfeit(); decline(); }
  function finalize() {
    var sc = Math.floor(S.score), isBest = sc > bestScore; ovDead.querySelector('.ht').textContent = S.diedBy === 'battery' ? 'PHONE DIED' : 'GAME OVER'; root.classList.toggle('phonedead', S.diedBy === 'battery');
    if (isBest) bestScore = sc;
    ovDead.querySelector('.rs').textContent = sc; ovDead.querySelector('.rc').textContent = S.coins; ovDead.querySelector('.rk').textContent = S.cards.length; ovDead.querySelector('.rb').textContent = bestScore + (isBest ? '  NEW' : '');
    showBest();
    // demo runs are not saved or ranked: this only does something once somebody is signed in
    if (window.HallProfile) HallProfile.recordRun({ score: sc, coins: S.coins, cards: S.cards.slice(), seconds: Math.round(S.alive), distance: Math.round(S.dist * 2.906), jumps: S.jumps, slides: S.slides, lanes: S.lanes, boxesJumped: S.boxesJumped, hits: S.hits, packs: S.packs, extraLife: !!S.lifeUsed, rhythm: rhythm() });
    setTimeout(function () { if (S.mode === 'dead') ovDead.style.display = 'flex'; }, 650);
  }
  // There is no pause. Leaving the game in any way (home bar, lock, closing the phone, another browser tab, or the page stalling) ends the run.
  function forfeit() { if (S.mode === 'run') die(true); }
  ovLife.querySelector('.hno').addEventListener('click', function () { decline(); });
  ovLife.querySelector('.hbuy').addEventListener('click', function () {
    var b = this, signed = HallProfile.isSignedIn(), msg = ovLife.querySelector('.hmsg'); b.disabled = true; msg.textContent = signed ? 'BUYING…' : '';
    (signed ? HallProfile.buyLife(S.lifeCost) : Promise.resolve()).then(function () { if (S.offer) revive(); }, function (e) { msg.textContent = String((e && e.message) || 'COULD NOT BUY A LIFE').toUpperCase(); b.disabled = false; });
  });

  // Boxes hurt by kind: health is six segments. A plain box takes 2 (three hits end the run), a blue box 3 (two hits), a red box all 6 (one hit).
  var DMG = [2, 6, 3];
  function showHp() { for (var i = 0; i < hpSegs.length; i++) hpSegs[i].classList.toggle('off', i >= S.hp); }
  function hurt(e) {
    S.hits++; S.hp = Math.max(0, S.hp - DMG[e.tier || 0]); showHp();
    if (S.hp <= 0) { die(); return; }
    S.inv = 1.3; S.flash = 0.6; S.shake = 0.7;
    if (window.MIMUAudio && MIMUAudio.hurt) MIMUAudio.hurt();
  }
  function update(dt) {
    S.t += dt;
    var running = S.mode === 'run', cf = HallProfile.config, climbMul = 1;
    if (running) {
      S.alive += dt;
      // the pack: 20% slower for 60 seconds, eased in and out. The climb is frozen while it lasts, so afterwards you are back at the speed you had when you grabbed it.
      if (S.slowT > 0) S.slowT = Math.max(0, S.slowT - dt); else S.climbT += dt;
      S.slowF += ((S.slowT > 0 ? 1 - cf.pack.slowPct / 100 : 1) - S.slowF) * Math.min(1, dt * 1.6);
      climbMul = Math.pow(1 + cf.climb.pct / 100, S.climbT / cf.climb.everySec);        // a slow forever climb: no ceiling
    }
    var v = S.mode === 'run' ? (4.6 + 4.2 * (1 - Math.exp(-S.dist / 650))) * climbMul * S.slowF : S.mode === 'dead' ? Math.max(0, S.v - dt * 14) : 1.3;
    S.v = v;
    var step = v * dt;
    S.scrollZ += step;
    if (running) {
      S.dist += step;
      S.score += step * 20;   /* distance points: 20 per game unit (about 11,000 a mile) */
      S.run += dt * (6 + v);
      if (S.alive >= S.nextSight) { S.nextSight += S.rc.sightEvery; spawnCard(); }
      if (S.alive >= S.nextPack) { S.nextPack += S.rc.packEvery; spawnPack(); }
      netTick(); tickItems(dt);
      // the road: now and then it swings and curves, and it always drifts a little
      S.curveNext -= dt;
      if (S.curveNext <= 0) { var r = Math.random(); S.curveT = r < 0.36 ? 0 : (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5); S.curveNext = 3 + Math.random() * 5; }
      S.curve += (S.curveT - S.curve) * Math.min(1, dt * 0.85);
      // lane movement
      var target = S.lane, k = 1 - Math.exp(-dt * 13), nx = S.px + (target - S.px) * k;
      S.vx = (nx - S.px) / Math.max(dt, 0.001); S.px = nx;
      if (S.jt >= 0) { S.jt += dt / 0.62; if (S.jt >= 1) S.jt = -1; }
      if (S.sl >= 0) { S.sl += dt / 0.7; if (S.sl >= 1) S.sl = -1; }
      // world
      for (var i = S.ents.length - 1; i >= 0; i--) {
        var e = S.ents[i], pz = e.z; e.z -= step;
        if (e.k === 'coin' && !e.got) {   // the coin magnet: coins near you (your lane and the lanes beside you) fly into the runner
          if (S.magT > 0 && !e.mag && e.z < PZ + HallProfile.config.items.magnet.reachZ && e.z > PZ - 0.05 && Math.abs(e.lane - S.px) <= 1.01) e.mag = true;
          if (e.mag) { e.lane += (S.px - e.lane) * Math.min(1, dt * 9); e.z -= step * 0.55; if (e.z <= PZ + 0.12 && Math.abs(e.lane - S.px) < 0.45) { e.got = true; S.coins += S.mult; S.score += 25; if (window.MIMUAudio && MIMUAudio.coin) MIMUAudio.coin(); } }
        }
        if (e.lane === Math.round(S.px) && Math.abs(S.px - e.lane) < 0.62) {
          var cross = pz >= PZ - 0.10 && e.z <= PZ + 0.10;
          if (cross) {
            if (e.k === 'coin' && !e.got) { e.got = true; S.coins += S.mult; S.score += 25; S.shake = 0; if (window.MIMUAudio && MIMUAudio.coin) MIMUAudio.coin(); }
            else if (e.k === 'item' && !e.got) { e.got = true; collectItem(e); }
            else if (e.k === 'card' && !(e.drop && e.drop.kind === 'foil') && !e.got) { e.got = true; collectCard(e); }   /* regular cards are picked up by running into them: only a foil card needs a jump */   /* the magnet, the multiplier and the battery are picked up just by running through them: no jump needed */
            else if ((e.k === 'card' || e.k === 'pack' || e.k === 'item') && !e.got) { if ((S.jt >= 0 ? Math.sin(Math.PI * S.jt) : 0) >= 0.45) { e.got = true; if (e.k === 'card') collectCard(e); else if (e.k === 'item') collectItem(e); else collectPack(); } }
            else if (e.k === 'box') { var jh = S.jt >= 0 ? Math.sin(Math.PI * S.jt) : 0; if (jh < 0.42 && S.inv <= 0) { hurt(e); e.z = -1; if (S.mode !== 'run') break; } else if (jh >= 0.42 && !e.jumped) { e.jumped = true; S.boxesJumped++; } }
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
      for (var j = S.ents.length - 1; j >= 0; j--) { S.ents[j].z -= step; if (S.ents[j].z < 0.62) S.ents.splice(j, 1); }   // things that reach the runner's back are gone, as in a live run
    }
    S.sway = Math.sin(S.t * 0.9) * 0.6 + Math.sin(S.t * 0.37 + 1) * 0.4;
    S.camX = S.sway * 0.012 * W + S.curve * 0.012 * W;
    S.inv = Math.max(0, S.inv - dt); S.flash = Math.max(0, S.flash - dt * 1.6); S.shake = Math.max(0, S.shake - dt * 3);
    for (var m = 0; m < embers.length; m++) { var em = embers[m]; em.y -= em.v * dt; em.x += Math.sin(S.t * 0.6 + em.p) * 0.01 * dt; if (em.y < -0.02) { em.y = 1.02; em.x = Math.random(); } }
    // hud
    var sc2 = pad(S.score, 5); if (elScore.textContent !== sc2) elScore.textContent = sc2;
    if (elCoins.textContent !== String(S.coins)) elCoins.textContent = S.coins;
    var ncards = S.cards.length + S.dropGot; if (elCards.textContent !== String(ncards)) elCards.textContent = ncards;
    if (S.hintUntil && S.t > S.hintUntil) { S.hintUntil = 0; elHint.classList.remove('on'); }
    if (S.mode === 'idle') hbot.style.display = 'none'; else { hbot.style.display = '';
      var mph = Math.round(S.v * MPH), dd = (S.dist * MILES).toFixed(2), slow = S.slowT > 0;
      if (mph !== lastMph) { lastMph = mph; elMph.textContent = mph; var f = Math.max(0, Math.min(Math.log(Math.max(mph, 25) / 25) / Math.log(16), 1)); elNeedle.style.transform = 'rotate(' + (-90 + f * 180).toFixed(1) + 'deg)'; elArc.setAttribute('stroke-dashoffset', (75.4 * (1 - f)).toFixed(1)); }
      if (dd !== lastDist) { lastDist = dd; elDist.textContent = dd; }
      if (slow !== lastSlow) { lastSlow = slow; hbot.classList.toggle('slow', slow); }
    }
    var bp = S.mode === 'idle' ? 69 : Math.max(0, Math.round(S.batt)); if (bp !== lastBp) { lastBp = bp; phoneBat(bp, false); }
    var cfi = HallProfile.config.items, bm = S.magT > 0 ? Math.ceil(S.magT) + 's|' + Math.round(S.magT / cfi.magnet.durSec * 100) : '', bx = S.mult > 1 ? 'x' + S.mult + '|' + Math.round(S.multT / cfi.multi.levelSec * 100) : S.multCool > 0 && S.mode === 'run' ? 'CD ' + Math.floor(S.multCool / 60) + ':' + pad(Math.floor(S.multCool % 60), 2) + '|0' : '';
    if (bm !== lastBm) { lastBm = bm; elBm.hidden = !bm; if (bm) { var pm = bm.split('|'); elBm.querySelector('b').textContent = pm[0]; elBm.querySelector('u i').style.width = pm[1] + '%'; } }
    if (bx !== lastBx) { lastBx = bx; elBx.hidden = !bx; if (bx) { var px2 = bx.split('|'); elBx.querySelector('b').textContent = px2[0]; elBx.querySelector('u i').style.width = px2[1] + '%'; elBx.classList.toggle('cool', S.mult <= 1); } }
    var sl = S.slowT > 0 ? 'SLOW ' + Math.floor(S.slowT / 60) + ':' + pad(Math.floor(S.slowT % 60), 2) : ''; if (elSlow.textContent !== sl) elSlow.textContent = sl;
    S.cardPulse = Math.max(0, (S.cardPulse || 0) - dt * 2); S.packPulse = Math.max(0, (S.packPulse || 0) - dt * 2);
  }

  /* ---------- drawing ---------- */
  function cxAt(s) { return W / 2 + S.camX + S.curve * 0.52 * W * (1 - s) * (1 - s) + S.sway * 0.035 * W * (1 - s); }

  function drawFloor() {
    var hh = H - y0, y, s, d, v, x0, wd, fsrc = imgs.floor.naturalWidth ? imgs.floor : tex, fw = imgs.floor.naturalWidth ? imgs.floor.naturalWidth : TEX_W, fh = imgs.floor.naturalWidth ? imgs.floor.naturalHeight : TEX_H;
    var fstep = TOUCH ? FSTEP[qLevel] : 2;
    for (y = y0 + 2; y < H; y += fstep) {
      s = (y - y0) / hh; if (s < 0.03) continue;
      d = 1 / s; v = ((((d + S.scrollZ) * 0.30) % 1) + 1) % 1 * (fh - 2);
      x0 = cxAt(s) - W * XW * s; wd = W * XW * 2 * s;
      ctx.drawImage(fsrc, 0, v | 0, fw, 2, x0, y, wd, fstep + 0.6);
    }
    // haze where the floor runs into the far end of the hall, and a soft dark at the bottom
    var g = ctx.createLinearGradient(0, y0 - 2, 0, y0 + hh * 0.28);
    g.addColorStop(0, 'rgba(8,10,22,.7)'); g.addColorStop(1, 'rgba(6,8,18,0)'); ctx.fillStyle = g; ctx.fillRect(0, y0 - 2, W, hh * 0.28 + 2);
    var g2 = ctx.createLinearGradient(0, H * 0.78, 0, H); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,.5)'); ctx.fillStyle = g2; ctx.fillRect(0, H * 0.78, W, H * 0.22);
    // warm light from the hall lying on the polished stone
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var sh = ctx.createLinearGradient(0, y0, 0, H); sh.addColorStop(0, 'rgba(80,100,170,.14)'); sh.addColorStop(.5, 'rgba(60,80,150,.08)'); sh.addColorStop(1, 'rgba(40,55,110,.04)');
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

  /* the side walls of the hall: a photographed-looking wall (black veined marble, brass, crimson velvet, carved wood) stood either side
     of the road, drawn in thin vertical slices so it runs away in perspective and bends with the road. */
  var HN = 1.45;              // wall height, in "screen heights from the horizon to the bottom of the screen"
  var BAY = 3.4;              // length of one wall bay in road units (the wall picture holds two bays, the second mirrored)
  function wp(z, side, h) { var s = 1 / z; return [cxAt(s) + side * XW * W * s, y0 + (H - y0) * s * (1 - h)]; }
  function drawWalls() {
    var im = imgs.wall; if (!im.naturalWidth) return;
    var hh = H - y0, TW = im.naturalWidth, TH = im.naturalHeight, TILE = BAY * 2, side, z, zn, dz, s1, s2, x1, x2, xl, xw, u, sx, sw, yt, yb, a;
    for (side = -1; side <= 1; side += 2) {
      z = 26;
      while (z > 0.62) {
        dz = Math.max(0.004, 1.6 * z * z / (XW * W)); zn = Math.max(0.62, z - dz);
        s1 = 1 / z; s2 = 1 / zn;
        x1 = cxAt(s1) + side * XW * W * s1; x2 = cxAt(s2) + side * XW * W * s2;
        u = ((((z + zn) / 2 + S.scrollZ) / TILE) % 1 + 1) % 1;
        sx = u * TW; sw = Math.max(1, (z - zn) / TILE * TW); if (sx + sw > TW) sw = TW - sx;
        yt = y0 + hh * s2 * (1 - HN); yb = y0 + hh * s2;
        xl = Math.min(x1, x2); xw = Math.abs(x2 - x1) + 0.8;
        if (sw > 0.5) ctx.drawImage(im, sx, 0, sw, TH, xl, yt, xw, yb - yt);
        a = clamp((z - 3) / 22, 0, 1); a = a * a * 0.78;
        if (a > 0.01) { ctx.fillStyle = 'rgba(2,0,1,' + a + ')'; ctx.fillRect(xl, yt, xw, yb - yt); }
        z = zn;
      }
    }
    // the brass candelabra on every bay: a live flame glow over the picture
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var k0 = Math.floor(S.scrollZ / BAY), k, zc, fl, p, rad, rg;
    for (k = k0 + 8; k >= k0; k--) {
      zc = k * BAY + BAY / 2 - S.scrollZ; if (zc < 0.9 || zc > 24) continue;
      for (side = -1; side <= 1; side += 2) {
        p = wp(zc, side, HN * 0.44); rad = 0.085 * hh / zc * (0.9 + 0.1 * Math.sin(S.t * 9 + k * 2.3 + side));
        rg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], rad * 2.4); rg.addColorStop(0, 'rgba(255,200,110,.55)'); rg.addColorStop(.4, 'rgba(255,150,60,.18)'); rg.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p[0], p[1], rad * 2.4, 0, 6.3); ctx.fill();
      }
    }
    ctx.restore();
  }
  function shadow(x, y, w) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.22, 0, 0, 6.3); ctx.fill(); ctx.restore(); }

  var AURA = [null, { c: 'rgba(255,36,48,', rim: 'rgba(255,70,80,' }, { c: 'rgba(70,140,255,', rim: 'rgba(110,170,255,' }];
  function drawBox(e) {
    var hh = H - y0, s = 1 / e.z, y = y0 + s * hh, im = imgs.box; if (e.z < 0.62 || !im.naturalWidth || y > H + 90) return;
    var x = cxAt(s) + e.lane * LANE * W * s, bw = 0.42 * W * s * e.sc, bh = bw * im.naturalHeight / im.naturalWidth, au = AURA[e.tier], pulse = 0.82 + 0.18 * Math.sin(S.t * 5 + e.z * 2);
    ctx.save(); ctx.globalAlpha = clamp((s - 0.05) / 0.08, 0, 1);
    shadow(x, y, bw * 0.55);
    if (au) {
      // the glow lights the floor around the box, then a soft coloured edge light hugs the box itself
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var gy = y - bh * 0.35, gr = bw * 1.15, g = ctx.createRadialGradient(x, gy, bw * 0.1, x, gy, gr);
      g.addColorStop(0, au.c + (0.85 * pulse) + ')'); g.addColorStop(0.55, au.c + (0.34 * pulse) + ')'); g.addColorStop(1, au.c + '0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, gy + bh * 0.1, gr, gr * 0.78, 0, 0, 6.3); ctx.fill(); ctx.restore();
      ctx.shadowColor = au.rim + (0.95 * pulse) + ')'; ctx.shadowBlur = Math.max(4, bw * 0.46 * pulse);
      ctx.drawImage(im, x - bw / 2, y - bh * 0.9, bw, bh);
      ctx.shadowBlur = Math.max(3, bw * 0.2); ctx.drawImage(im, x - bw / 2, y - bh * 0.9, bw, bh);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    }
    ctx.drawImage(im, x - bw / 2, y - bh * 0.9, bw, bh);
    ctx.restore();
  }
  function drawCoin(e) {
    if (e.got) return;
    var hh = H - y0, s = 1 / e.z, y = y0 + s * hh, im = imgs.coinG && imgs.coinG.naturalWidth ? imgs.coinG : imgs.coin; if (e.z < 0.62 || !im.naturalWidth || y > H + 60) return;
    var x = cxAt(s) + e.lane * LANE * W * s, cw = 0.17 * W * s, cy = y - cw * 0.85 - Math.sin(S.t * 4 + e.ph) * cw * 0.06;
    var fr = Math.floor(S.t * 10 + e.ph) % 20, fx = (fr % 5) * 192, fy = ((fr / 5) | 0) * 192;
    ctx.save(); ctx.globalAlpha = clamp((s - 0.05) / 0.08, 0, 1);
    shadow(x, y, cw * 0.32);
    ctx.globalCompositeOperation = 'lighter';
    var rg = ctx.createRadialGradient(x, cy, 0, x, cy, cw * 0.95); rg.addColorStop(0, 'rgba(255,205,110,.55)'); rg.addColorStop(.55, 'rgba(255,170,60,.22)'); rg.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, cy, cw * 0.95, 0, 6.3); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(im, fx, fy, 192, 192, x - cw / 2, cy - cw / 2, cw, cw);
    if (S.mode === 'run') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.22; ctx.drawImage(im, fx, fy, 192, 192, x - cw / 2, cy - cw / 2, cw, cw); }
    ctx.restore();
  }

  /* a card sighting: the front of the card floating above the boxes, in an aura the colour of its rarity (half strength) */
  /* a foil piece: the same card art, ripped down the middle along a jagged tear, with a gold glow on the tear and a slow rainbow shimmer over the picture (the design is untouched, only the material changes) */
  function drawFoil(im, e, x, cy, cw, ch) {
    var half = e.drop.half || 'L', both = half === 'B', l = x - cw / 2, r = x + cw / 2, t = cy - ch / 2, b = cy + ch / 2, n = 9, gap = both ? cw * 0.05 : 0, sides = both ? ['L', 'R'] : [half], si, k, tear = [];
    for (k = 0; k <= n; k++) tear.push(x + (((k * 37 + e.n * 11) % 7) - 3) * cw * 0.011);
    sides.forEach(function (side) {
      var dx = both ? (side === 'L' ? -gap : gap) : (side === 'L' ? cw * 0.25 : -cw * 0.25);
      ctx.save(); ctx.translate(dx, 0); ctx.beginPath();
      if (side === 'L') { ctx.moveTo(l, t); for (k = 0; k <= n; k++) ctx.lineTo(tear[k], t + ch * k / n); ctx.lineTo(l, b); }
      else { ctx.moveTo(r, t); for (k = 0; k <= n; k++) ctx.lineTo(tear[k], t + ch * k / n); ctx.lineTo(r, b); }
      ctx.closePath(); ctx.save(); ctx.clip();
      if (im.naturalWidth) ctx.drawImage(im, l, t, cw, ch); else { ctx.fillStyle = '#0b0708'; ctx.fillRect(l, t, cw, ch); }
      var sh = (S.t * 0.45 + e.ph) % 1, g = ctx.createLinearGradient(l - cw * 0.5 + sh * cw * 2, t, l + sh * cw * 2, b);
      g.addColorStop(0, 'rgba(255,90,160,0)'); g.addColorStop(0.2, 'rgba(255,200,80,0.42)'); g.addColorStop(0.4, 'rgba(120,255,200,0.34)'); g.addColorStop(0.6, 'rgba(110,170,255,0.38)'); g.addColorStop(0.8, 'rgba(230,120,255,0.34)'); g.addColorStop(1, 'rgba(255,90,160,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(l, t, cw, ch);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(255,215,120,0.12)'; ctx.fillRect(l, t, cw, ch);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,215,100,0.95)'; ctx.shadowColor = 'rgba(255,200,70,0.95)'; ctx.shadowBlur = Math.max(5, cw * 0.18); ctx.lineWidth = Math.max(1, cw * 0.03); ctx.stroke();
      ctx.restore();
    });
  }
  function drawCard(e) {
    if (e.got) return;
    var hh = H - y0, s = 1 / e.z, y = y0 + s * hh; if (e.z < 0.62 || y > H + 120) return;
    var tr = HallProfile.tiers[e.tier - 1], im = cardImg(e.n), x = cxAt(s) + e.lane * LANE * W * s, cw = 0.24 * W * s, ch = cw * 1.386;
    var cy = y - 0.70 * W * s + Math.sin(S.t * 2.6 + e.ph) * 0.02 * W * s, pulse = 0.8 + 0.2 * Math.sin(S.t * 4 + e.ph), g, gr = ch * 0.95;
    var dk = e.drop ? e.drop.kind : '';
    ctx.save(); ctx.globalAlpha = clamp((s - 0.05) / 0.08, 0, 1);
    shadow(x, y, cw * 0.5);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; if (dk === 'wanted') pulse = 0.9 + 0.3 * Math.sin(S.t * 7);
    var cols = dk === 'wanted' ? [['255,190,50', 0]] : dk === 'foil' ? [['255,205,90', 0]] : dk === 'stagger' ? [['190,140,255', 0]] : e.tier === 5 ? [['71,209,255', -0.28], ['195,88,209', 0.28]] : [[tr.glow, 0]];
    cols.forEach(function (cc) { g = ctx.createRadialGradient(x + cc[1] * cw, cy, ch * 0.1, x + cc[1] * cw, cy, gr); g.addColorStop(0, 'rgba(' + cc[0] + ',' + (0.5 * pulse) + ')'); g.addColorStop(0.6, 'rgba(' + cc[0] + ',' + (0.2 * pulse) + ')'); g.addColorStop(1, 'rgba(' + cc[0] + ',0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + cc[1] * cw, cy, gr, 0, 6.3); ctx.fill(); });
    ctx.restore();
    ctx.shadowColor = 'rgba(' + tr.glow + ',' + (0.5 * pulse) + ')'; ctx.shadowBlur = Math.max(4, cw * 0.5);
    if (dk === 'foil') drawFoil(im, e, x, cy, cw, ch);
    else if (im.naturalWidth) ctx.drawImage(im, x - cw / 2, cy - ch / 2, cw, ch); else { ctx.fillStyle = '#0b0708'; ctx.fillRect(x - cw / 2, cy - ch / 2, cw, ch); }
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.strokeStyle = dk === 'wanted' ? 'rgba(255,200,70,0.95)' : dk === 'stagger' ? 'rgba(205,165,255,0.95)' : 'rgba(' + tr.glow + ',0.55)'; ctx.lineWidth = Math.max(0.8, cw * (dk ? 0.04 : 0.025)); if (dk !== 'foil') ctx.strokeRect(x - cw / 2, cy - ch / 2, cw, ch);
    if (dk === 'wanted' || dk === 'first' || dk === 'stagger' || dk === 'foil') { ctx.font = '700 ' + Math.max(8, cw * 0.2) + 'px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = dk === 'wanted' || dk === 'foil' ? '#ffd45a' : dk === 'stagger' ? '#d9bcff' : '#fff3c9'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.fillText(dk === 'wanted' ? 'WANTED' : dk === 'stagger' ? 'STAGGER' : dk === 'foil' ? 'FOIL' : 'FIRST', x, cy - ch / 2 - Math.max(3, cw * 0.06)); }
    ctx.restore();
  }
  /* power-ups: drawn in code to match the chosen look: a red and gold U magnet, a black poker-chip coin with a gold rim, and a green glowing battery with a bolt */
  function drawItem(e) {
    if (e.got) return;
    var hh = H - y0, s = 1 / e.z, y = y0 + s * hh; if (e.z < 0.62 || y > H + 120) return;
    var x = cxAt(s) + e.lane * LANE * W * s, iw = 0.30 * W * s, cy = y - 0.66 * W * s + Math.sin(S.t * 2.4 + e.ph) * 0.02 * W * s, pulse = 0.8 + 0.2 * Math.sin(S.t * 4 + e.ph), kind = e.item, g, i;
    var glow = kind === 'magnet' ? '255,170,60' : kind === 'multi' ? '255,205,90' : '60,255,130';
    ctx.save(); ctx.globalAlpha = clamp((s - 0.05) / 0.08, 0, 1);
    shadow(x, y, iw * 0.3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    g = ctx.createRadialGradient(x, cy, iw * 0.1, x, cy, iw * 0.95); g.addColorStop(0, 'rgba(' + glow + ',' + (0.55 * pulse) + ')'); g.addColorStop(0.6, 'rgba(' + glow + ',' + (0.2 * pulse) + ')'); g.addColorStop(1, 'rgba(' + glow + ',0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy, iw * 0.95, 0, 6.3); ctx.fill(); ctx.restore();
    ctx.translate(x, cy); ctx.lineCap = 'butt';
    if (kind === 'magnet') {
      var r = iw * 0.26, t = iw * 0.17, leg = iw * 0.34;
      ctx.lineWidth = t; ctx.strokeStyle = '#d9ac5c'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI, false); ctx.moveTo(-r, 0); ctx.lineTo(-r, -leg * 0.5); ctx.moveTo(r, 0); ctx.lineTo(r, -leg * 0.5); ctx.stroke();
      ctx.lineWidth = t * 0.28; ctx.strokeStyle = '#fff0c4'; ctx.beginPath(); ctx.arc(0, 0, r - t * 0.28, 0.15, Math.PI - 0.15, false); ctx.stroke();
      ctx.lineWidth = t; ctx.strokeStyle = '#d6203a'; ctx.beginPath(); ctx.moveTo(-r, -leg * 0.5); ctx.lineTo(-r, -leg); ctx.moveTo(r, -leg * 0.5); ctx.lineTo(r, -leg); ctx.stroke();
      ctx.fillStyle = '#e9e6df'; ctx.fillRect(-r - t / 2, -leg - t * 0.18, t, t * 0.18); ctx.fillRect(r - t / 2, -leg - t * 0.18, t, t * 0.18);
      ctx.fillStyle = '#ffd45a'; for (i = 0; i < 3; i++) { var ang = S.t * 3 + i * 2.1 + e.ph, rr = iw * (0.34 + 0.08 * Math.sin(S.t * 5 + i)); ctx.beginPath(); ctx.arc(Math.cos(ang) * rr, -leg * 0.6 + Math.sin(ang) * rr * 0.5, iw * 0.04, 0, 6.3); ctx.fill(); }
    } else if (kind === 'multi') {
      var R2 = iw * 0.40;
      ctx.fillStyle = '#0b0809'; ctx.beginPath(); ctx.arc(0, 0, R2, 0, 6.3); ctx.fill();
      ctx.lineWidth = R2 * 0.13; ctx.strokeStyle = '#d9ac5c'; ctx.stroke();
      ctx.fillStyle = '#d9ac5c'; for (i = 0; i < 8; i++) { ctx.save(); ctx.rotate(i * Math.PI / 4 + S.t * 0.6); ctx.fillRect(-R2 * 0.09, -R2 * 0.99, R2 * 0.18, R2 * 0.2); ctx.restore(); }
      ctx.lineWidth = R2 * 0.05; ctx.strokeStyle = 'rgba(255,220,140,0.7)'; ctx.beginPath(); ctx.arc(0, 0, R2 * 0.7, 0, 6.3); ctx.stroke();
      ctx.font = '700 ' + Math.max(8, R2 * 0.8) + 'px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd45a'; ctx.shadowColor = 'rgba(255,200,70,0.9)'; ctx.shadowBlur = R2 * 0.3; ctx.fillText('x' + Math.min(HallProfile.config.items.multi.max, S.mult + 1), 0, R2 * 0.04);
    } else {
      var bw = iw * 0.46, bh = iw * 0.74;
      ctx.fillStyle = '#d9ac5c'; ctx.fillRect(-bw * 0.22, -bh / 2 - iw * 0.07, bw * 0.44, iw * 0.07);
      ctx.fillStyle = '#0a0d0a'; ctx.strokeStyle = '#d9ac5c'; ctx.lineWidth = iw * 0.05; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-bw / 2, -bh / 2, bw, bh, iw * 0.07); else ctx.rect(-bw / 2, -bh / 2, bw, bh); ctx.fill(); ctx.stroke();
      g = ctx.createLinearGradient(0, bh / 2, 0, -bh / 2); g.addColorStop(0, '#0fae4a'); g.addColorStop(1, '#5cffa0'); ctx.fillStyle = g; ctx.shadowColor = 'rgba(60,255,130,0.95)'; ctx.shadowBlur = iw * 0.2;
      ctx.fillRect(-bw / 2 + iw * 0.05, -bh / 2 + iw * 0.05, bw - iw * 0.1, bh - iw * 0.1); ctx.shadowBlur = 0;
      ctx.fillStyle = '#fffbd0'; ctx.beginPath(); ctx.moveTo(iw * 0.03, -bh * 0.36); ctx.lineTo(-bw * 0.28, iw * 0.03); ctx.lineTo(-iw * 0.01, iw * 0.03); ctx.lineTo(-iw * 0.05, bh * 0.36); ctx.lineTo(bw * 0.28, -iw * 0.04); ctx.lineTo(iw * 0.01, -iw * 0.04); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  /* the black pack: same height, a dark-gold glow; jump into it to slow the world down */
  function drawPack(e) {
    if (e.got) return;
    var hh = H - y0, s = 1 / e.z, y = y0 + s * hh, im = imgs.pack; if (e.z < 0.62 || !im.naturalWidth || y > H + 120) return;
    var x = cxAt(s) + e.lane * LANE * W * s, pw = 0.34 * W * s, ph = pw * im.naturalHeight / im.naturalWidth, cy = y - 0.66 * W * s + Math.sin(S.t * 2.2 + e.ph) * 0.02 * W * s, pulse = 0.8 + 0.2 * Math.sin(S.t * 3 + e.ph);
    ctx.save(); ctx.globalAlpha = clamp((s - 0.05) / 0.08, 0, 1);
    shadow(x, y, pw * 0.3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(x, cy, pw * 0.1, x, cy, pw * 0.9); g.addColorStop(0, 'rgba(232,198,115,' + (0.42 * pulse) + ')'); g.addColorStop(0.6, 'rgba(200,150,60,' + (0.16 * pulse) + ')'); g.addColorStop(1, 'rgba(200,150,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy, pw * 0.9, 0, 6.3); ctx.fill(); ctx.restore();
    ctx.shadowColor = 'rgba(232,198,115,' + (0.7 * pulse) + ')'; ctx.shadowBlur = Math.max(4, pw * 0.3);
    ctx.drawImage(im, x - pw / 2, cy - ph / 2, pw, ph);
    ctx.restore();
  }
  function drawPlayer() {
    var hh = H - y0, y = y0 + SP * hh, x = cxAt(SP) + S.px * LANE * W * SP, jh = S.jt >= 0 ? Math.sin(Math.PI * S.jt) : 0;
    var im = (Math.floor(S.run) % 2 === 0) ? imgs.runA : imgs.runB; if (!im.naturalWidth) return;
    var sh = H * 0.25, sw = sh * im.naturalWidth / im.naturalHeight, bob = (S.mode === 'dead' ? 0 : Math.abs(Math.sin(S.run * Math.PI)) * sh * 0.025);
    var lift = jh * H * 0.11 + bob, tilt = clamp(S.vx * 0.012, -0.16, 0.16);
    shadow(x, y, sw * 0.34 * (1 - jh * 0.35));
    // sliding: the runner throws himself down on his side and skims along on one hand and one foot (his own sliding picture),
    // blending in from the running frame and springing back up at the end
    var env = S.sl < 0 ? 0 : (S.sl < 0.14 ? S.sl / 0.14 : S.sl > 0.8 ? (1 - S.sl) / 0.2 : 1), sim = imgs.slide;
    ctx.save(); if (S.mode === 'dead') ctx.globalAlpha = 0.9; else if (S.inv > 0 && Math.floor(S.t * 14) % 2) ctx.globalAlpha = 0.42;
    if (env > 0 && sim.naturalWidth) {
      var ssw = sw * 1.36, ssh = ssw * sim.naturalHeight / sim.naturalWidth, a = env * env * (3 - 2 * env);
      // dust kicked up behind the slide
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (var q = 0; q < 6; q++) {
        var ph = (S.t * 2.2 + q / 6) % 1, dx = x + (q % 2 ? 1 : -1) * ssw * (0.12 + 0.34 * ph), dy = y - ssh * 0.12 + ph * H * 0.012, dr = ssh * (0.12 + 0.2 * ph);
        var dg = ctx.createRadialGradient(dx, dy, 0, dx, dy, dr); dg.addColorStop(0, 'rgba(255,210,150,' + (0.22 * a * (1 - ph)) + ')'); dg.addColorStop(1, 'rgba(255,190,120,0)');
        ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(dx, dy, dr, 0, 6.3); ctx.fill();
      }
      ctx.restore();
      if (a < 1) { ctx.save(); ctx.translate(x, y - lift); ctx.rotate(tilt); ctx.globalAlpha *= (1 - a); ctx.drawImage(im, -sw / 2, -sh * 0.97, sw, sh); ctx.restore(); }
      ctx.save(); ctx.translate(x, y); ctx.rotate(tilt * 0.5); ctx.globalAlpha *= a; ctx.drawImage(sim, -ssw / 2, -ssh * 0.96, ssw, ssh); ctx.restore();
      ctx.restore(); return;
    }
    ctx.save(); ctx.translate(x, y - lift); ctx.rotate(tilt);
    ctx.drawImage(im, -sw / 2, -sh * 0.97, sw, sh);
    ctx.restore(); ctx.restore();
  }

  /* the big coin hanging in the smoke at the far end keeps spinning (frames from the rotating-coin video, blended so it turns smoothly) */
  /* The coin is drawn in device pixels from a pre-scaled strip of its frames, away from the camera sway and tilt, so it never re-samples a little differently every frame (that was the shimmer during a run). */
  var coinAtlas = null, coinAtlasD = 0, coinOff = null, coinOffD = 0, coinMask = null, coinVid = null;
  function bgVideo() { if (coinVid === null) coinVid = document.querySelector('video.bg') || false; var v = coinVid; return v && v.videoWidth && v.readyState >= 2 && !v.paused && v.offsetWidth > 0 ? v : null; }
  function drawFarCoin(bx, bw, bh) {
    var ci = imgs.coin; if (!ci.naturalWidth) return;
    var x = bx + 375 / 752 * bw, y = 298 / 500 * bh + Math.sin(S.t * 0.9) * 2, D = 176 / 752 * bw / 0.80, ph = (S.t / 8) * 20, i0 = Math.floor(ph) % 20, f = ph - Math.floor(ph), i1 = (i0 + 1) % 20;
    var m = ctx.getTransform ? ctx.getTransform() : null;
    if (!m || !m.transformPoint) {
      ctx.save();
      ctx.drawImage(ci, (i0 % 5) * 192, ((i0 / 5) | 0) * 192, 192, 192, x - D / 2, y - D / 2, D, D);
      ctx.globalAlpha = f; ctx.drawImage(ci, (i1 % 5) * 192, ((i1 / 5) | 0) * 192, 192, 192, x - D / 2, y - D / 2, D, D);
      ctx.restore(); return;
    }
    var Dd = Math.max(8, Math.round(D * dpr)), vv = bgVideo();
    if (vv) {   // the page's own background video is playing: borrow the coin from it (it turns at the full video frame rate, so it is smooth); the sprite strip below is the fallback
      if (!coinOff || coinOffD !== Dd) {
        coinOff = document.createElement('canvas'); coinOff.width = coinOff.height = Dd; coinOffD = Dd;
        coinMask = coinOff.getContext('2d').createRadialGradient(Dd / 2, Dd / 2, Dd * 0.40, Dd / 2, Dd / 2, Dd * 0.47); coinMask.addColorStop(0, 'rgba(0,0,0,1)'); coinMask.addColorStop(1, 'rgba(0,0,0,0)');
      }
      var og = coinOff.getContext('2d'), kk = vv.videoWidth / 1920, cc = 290 * kk, q = m.transformPoint({ x: x, y: y });
      og.globalCompositeOperation = 'source-over'; og.clearRect(0, 0, Dd, Dd);
      og.drawImage(vv, (947 - 145) * kk, (525 - 145) * kk, cc, cc, 0, 0, Dd, Dd);
      og.globalCompositeOperation = 'destination-in'; og.fillStyle = coinMask; og.fillRect(0, 0, Dd, Dd);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(coinOff, Math.round(q.x - Dd / 2), Math.round(q.y - Dd / 2)); ctx.restore(); return;
    }
    if (!coinAtlas || coinAtlasD !== Dd) {
      coinAtlas = document.createElement('canvas'); coinAtlas.width = Dd * 5; coinAtlas.height = Dd * 4; coinAtlasD = Dd;
      var g = coinAtlas.getContext('2d'); g.imageSmoothingEnabled = true; if ('imageSmoothingQuality' in g) g.imageSmoothingQuality = 'high';
      for (var k = 0; k < 20; k++) g.drawImage(ci, (k % 5) * 192, ((k / 5) | 0) * 192, 192, 192, (k % 5) * Dd, ((k / 5) | 0) * Dd, Dd, Dd);
    }
    var p = m.transformPoint({ x: x, y: y }), px = Math.round(p.x - Dd / 2), py = Math.round(p.y - Dd / 2);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(coinAtlas, (i0 % 5) * Dd, ((i0 / 5) | 0) * Dd, Dd, Dd, px, py, Dd, Dd);
    ctx.globalAlpha = f; ctx.drawImage(coinAtlas, (i1 % 5) * Dd, ((i1 / 5) | 0) * Dd, Dd, Dd, px, py, Dd, Dd);
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
    if (bi.naturalWidth) { var bh = y0 + 4, bw = bh * bi.naturalWidth / bi.naturalHeight, bx = (W - bw) / 2 - S.curve * 0.05 * W - S.camX * 0.6; ctx.drawImage(bi, bx, 0, bw, bh); drawFarCoin(bx, bw, bh); }
    drawFloor(); drawWalls(); drawLines();
    // everything on the road, far to near
    var list = [], j;
    for (j = 0; j < S.ents.length; j++) list.push({ z: S.ents[j].z, e: S.ents[j] });
    list.push({ z: PZ, p: 1 });
    list.sort(function (a, b) { return b.z - a.z; });
    for (j = 0; j < list.length; j++) { var it = list[j]; if (it.p) drawPlayer(); else if (it.e) { if (it.e.k === 'box') drawBox(it.e); else if (it.e.k === 'card') drawCard(it.e); else if (it.e.k === 'pack') drawPack(it.e); else if (it.e.k === 'item') drawItem(it.e); else drawCoin(it.e); } }
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
    var raw = (now - last) / 1000 || 0.016, dt = Math.min(0.05, raw); last = now;
    if (TOUCH && raw < 0.5) { qEma += (raw - qEma) * 0.08; if (++qN > 12 && qEma > 0.0245 && qLevel < QS.length - 1 && S.mode !== 'dead') { qLevel = Math.min(QS.length - 1, qLevel + (qEma > 0.05 ? 2 : 1)); qN = 0; qEma = 0.0167; resize(); } }
    if (raw > 0.5 && S.mode === 'run') leave();   // the page stalled or was frozen: no pausing by freezing it
    if (!W) { resize(); if (!W) return; }
    if (pending > 0) return;
    /* a slow frame no longer slows the game: the missing time is played out in small steps, so the road, jumps and boxes move at the same real speed as on a computer */
    var left = Math.min(raw, 0.25), steps = left > 0.05 ? Math.ceil(left / 0.033) : 1, i2;
    if (steps === 1) update(dt); else for (i2 = 0; i2 < steps; i2++) update(left / steps);
    render();
  }

  /* ---------- controls ---------- */
  /* the rhythm of the player's lane changes: only counts and averages are kept (how many moves, the average gap, how much the gaps vary), sent with the run so the server can tell a person from a script */
  function beat() { var r = S.rh, t = (window.performance && performance.now) ? performance.now() : Date.now(); if (r.last) { var g = t - r.last, d = g - (r.n ? r.mean : 0); r.n++; r.mean += d / r.n; r.m2 += d * (g - r.mean); if (g < r.min) r.min = g; } r.last = t; }
  function rhythm() { var r = S.rh; return { n: r.n, mean: Math.round(r.mean * 10) / 10, sd: Math.round(Math.sqrt(r.n > 1 ? r.m2 / (r.n - 1) : 0) * 10) / 10, min: r.n ? Math.round(r.min) : 0 }; }
  function lane(d) { if (S.mode !== 'run') return; var nl = clamp(S.lane + d, -1, 1); if (nl !== S.lane) { S.lanes++; beat(); } S.lane = nl; }   /* only lane changes feed the rhythm: they follow the boxes, so they are never steady. Holding the jump key or spamming taps jumps at an even pace and must never look like a script */
  function jump() { if (S.mode !== 'run' || S.jt >= 0) return; S.sl = -1; S.jt = 0; S.jumps++; }
  function slide() { if (S.mode !== 'run' || S.jt >= 0 || S.sl >= 0) return; S.sl = 0; S.slides++; }
  var down = null;
  root.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; down = { x: e.clientX, y: e.clientY, t: Date.now(), used: false }; });
  root.addEventListener('pointermove', function (e) {
    if (!down || down.used) return;
    var dx = e.clientX - down.x, dy = e.clientY - down.y, th = Math.max(22, W * 0.07);
    if (Math.abs(dx) > th && Math.abs(dx) > Math.abs(dy)) { lane(dx > 0 ? 1 : -1); down.used = true; }
    else if (dy < -th && Math.abs(dy) > Math.abs(dx)) { jump(); down.used = true; }
    else if (dy > th && Math.abs(dy) > Math.abs(dx)) { slide(); down.used = true; }
  });
  function up(e) {
    if (!down) return; var d = down; down = null;
    if (d.used) return;
    if (S.mode === 'idle') start();
    else if (e && e.pointerType === 'touch' && S.mode === 'run' && Date.now() - d.t < 320 && Math.abs(e.clientX - d.x) < 14 && Math.abs(e.clientY - d.y) < 14) jump();   /* phones: a tap jumps, swiping up still jumps too */
  }
  root.addEventListener('pointerup', up); root.addEventListener('pointercancel', function () { down = null; });
  ovDead.querySelector('.hagain').addEventListener('click', function () { start(); });
  window.addEventListener('keydown', function (e) {
    if (!active) return; var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { lane(-1); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { lane(1); e.preventDefault(); }
    else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') { if (S.mode === 'idle' || (S.mode === 'dead' && !S.offer)) { start(); } else jump(); e.preventDefault(); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { slide(); e.preventDefault(); }
  });

  /* ---------- game controllers: stick or d-pad to change lane, up / A / X to jump, down / B to slide, Start or A to run ---------- */
  var padPrev = {};
  function padTick() {
    if (!active || !navigator.getGamepads) return; var pads = navigator.getGamepads(), i, g, cur, ax, go;
    for (i = 0; i < pads.length; i++) {
      g = pads[i]; if (!g || !g.connected) continue; ax = g.axes || [];
      cur = { l: !!(g.buttons[14] && g.buttons[14].pressed) || ax[0] < -0.55, r: !!(g.buttons[15] && g.buttons[15].pressed) || ax[0] > 0.55, u: !!(g.buttons[12] && g.buttons[12].pressed) || ax[1] < -0.6 || !!(g.buttons[0] && g.buttons[0].pressed) || !!(g.buttons[2] && g.buttons[2].pressed), d: !!(g.buttons[13] && g.buttons[13].pressed) || ax[1] > 0.6 || !!(g.buttons[1] && g.buttons[1].pressed), s: !!(g.buttons[9] && g.buttons[9].pressed) };
      go = padPrev[i] || {};
      if (cur.l && !go.l) lane(-1); if (cur.r && !go.r) lane(1);
      if ((cur.u && !go.u) || (cur.s && !go.s)) { if (S.mode === 'idle' || (S.mode === 'dead' && !S.offer)) start(); else if (cur.u && !go.u) jump(); }
      if (cur.d && !go.d) slide();
      padPrev[i] = cur;
    }
  }
  setInterval(padTick, 33);

  /* ---------- the phone calls these ---------- */
  document.addEventListener('visibilitychange', function () { if (document.hidden) leave(); });
  window.addEventListener('pagehide', leave);
  window.HallRunner = {
    open: function () { leave(); root.classList.remove('phonedead'); resetBat(); active = true; resize(); if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
    close: function () { leave(); active = false; resetBat(); },
    state: function () { return S; },
    // what the admin page shows about the run in progress on this device
    live: function () { return { mode: S.mode, score: Math.floor(S.score), alive: Math.floor(S.alive), speed: S.v, hp: S.hp, cards: S.cards.length, coins: S.coins, slow: S.slowT > 0, life: !!S.lifeUsed }; }
  };
})();
