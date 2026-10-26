/* THE POWER-UP TIMELINE: the first 30 minutes of one run, drawn straight from the game's own numbers (HallProfile.config.items),
   so Hall Rules and the control room always show the real schedule. Used wherever an element has data-pchart. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function mmss(sec) { sec = Math.round(sec); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function nice(sec) { return sec % 60 === 0 ? (sec / 60) + ' MINUTE' + (sec === 60 ? '' : 'S') : sec + ' SECONDS'; }
  function svg() {
    var P = window.HallProfile, it = P && P.config && P.config.items; if (!it) return '';
    var MIN = 30, L = 34, R = 690, X = function (sec) { return L + (R - L) * sec / (MIN * 60); };
    var mg = it.magnet, mu = it.multi, ba = it.battery, pk = P.config.pack || { firstSec: 300, everySec: 300, slowPct: 20, slowSec: 60 }, o = [], i, t, y, H = 820, ht = P.config.heart || { firstSec: 300, everySec: 300 };
    o.push('<svg viewBox="0 0 720 ' + H + '" xmlns="' + NS + '" role="img" aria-label="Timeline of the coin magnet, the coin multiplier, the phone battery, the black pack and the red heart over the first 30 minutes of one run" font-family="Cinzel, Georgia, serif">');
    o.push('<rect width="720" height="' + H + '" fill="#12050a"/><rect x="1" y="1" width="718" height="' + (H - 2) + '" fill="none" stroke="#d9ac5c" stroke-opacity=".6"/>');
    o.push('<text x="360" y="34" text-anchor="middle" fill="#f6dc95" font-size="22" font-weight="700" letter-spacing="3">THE FIRST 30 MINUTES OF ONE RUN</text>');
    /* the time grid */
    for (t = 0; t <= MIN; t += 5) { o.push('<line x1="' + X(t * 60) + '" y1="54" x2="' + X(t * 60) + '" y2="700" stroke="#fff" stroke-opacity="' + (t % 10 === 0 ? '.16' : '.08') + '"/>'); o.push('<text x="' + X(t * 60) + '" y="726" text-anchor="middle" fill="#fff" font-size="16" fill-opacity=".85">' + t + ':00</text>'); }
    o.push('<text x="360" y="754" text-anchor="middle" fill="#fff" font-size="15" fill-opacity=".7" letter-spacing="2">TIME ALIVE IN ONE RUN</text>');
    /* lane 1: the coin magnet */
    y = 112; o.push('<text x="' + L + '" y="' + (y - 44) + '" fill="#ff8b80" font-size="19" font-weight="700" letter-spacing="1.5">COIN MAGNET</text><text x="' + L + '" y="' + (y - 24) + '" fill="#fff" font-size="15" fill-opacity=".9">FIRST AT ' + mmss(mg.firstSec) + ', THEN EVERY ' + mmss(mg.everySec) + ' &middot; LASTS ' + mg.durSec + ' SECONDS' + (mg.durSec < mg.everySec ? ' &middot; OFF BEFORE THE NEXT' : '') + '</text>');
    o.push('<line x1="' + L + '" y1="' + y + '" x2="' + R + '" y2="' + y + '" stroke="#ff8b80" stroke-opacity=".35"/>');
    for (t = mg.firstSec; t < MIN * 60; t += mg.everySec) { var x = X(t); o.push('<rect x="' + x + '" y="' + (y - 7) + '" width="' + Math.max(2, (R - L) * mg.durSec / (MIN * 60)) + '" height="14" rx="2" fill="#e03a3a" fill-opacity=".8"/>'); if (t !== mg.firstSec) continue; o.push('<path d="M' + (x - 6) + ' ' + (y + 10) + ' v-11 a6 6 0 0 1 12 0 v11" fill="none" stroke="#0d0709" stroke-width="7"/><path d="M' + (x - 6) + ' ' + (y + 10) + ' v-11 a6 6 0 0 1 12 0 v11" fill="none" stroke="#e03a3a" stroke-width="4.4"/><rect x="' + (x - 8.2) + '" y="' + (y + 6) + '" width="4.4" height="4.4" fill="#fff"/><rect x="' + (x + 3.8) + '" y="' + (y + 6) + '" width="4.4" height="4.4" fill="#fff"/>'); }
    /* lane 2: the coin multiplier */
    y = 222; o.push('<text x="' + L + '" y="' + (y - 44) + '" fill="#d9a8ff" font-size="19" font-weight="700" letter-spacing="1.5">COIN MULTIPLIER</text><text x="' + L + '" y="' + (y - 24) + '" fill="#fff" font-size="15" fill-opacity=".9">A CHAIN EVERY ' + mmss(mu.periodSec) + ' FROM ' + mmss(mu.firstSec) + ' &middot; x2 TO x' + mu.max + '</text>');
    o.push('<line x1="' + L + '" y1="' + y + '" x2="' + R + '" y2="' + y + '" stroke="#d9a8ff" stroke-opacity=".35"/>');
    var hitSec = (mu.max - 1) * mu.gapSec;
    for (t = mu.firstSec; t < MIN * 60; t += mu.periodSec) {
      var cx = X(t); o.push('<rect x="' + X(t + hitSec) + '" y="' + (y - 5) + '" width="' + (R - L) * mu.cooldownSec / (MIN * 60) + '" height="10" rx="3" fill="#fff" fill-opacity=".18"/>');
      for (i = 0; i < mu.chips; i++) o.push('<circle cx="' + (X(t + i * mu.gapSec)) + '" cy="' + y + '" r="5.2" fill="#8a22e8" stroke="#ffffff" stroke-width="1.6"/>');
      o.push('<text x="' + (cx + 2) + '" y="' + (y + 28) + '" fill="#d9a8ff" font-size="14" font-weight="700">x' + mu.max + '</text>');
    }
    /* lane 3: the phone battery */
    y = 332; o.push('<text x="' + L + '" y="' + (y - 44) + '" fill="#6af0a0" font-size="19" font-weight="700" letter-spacing="1.5">PHONE BATTERY</text><text x="' + L + '" y="' + (y - 24) + '" fill="#fff" font-size="15" fill-opacity=".9">FIRST AT ' + mmss(ba.firstSec) + ', THEN EVERY ' + mmss(ba.everySec) + ' &middot; +' + ba.gain + '% POWER</text>');
    o.push('<line x1="' + L + '" y1="' + y + '" x2="' + R + '" y2="' + y + '" stroke="#6af0a0" stroke-opacity=".35"/>');
    for (t = ba.firstSec; t <= MIN * 60; t += ba.everySec) { var bx = X(t); o.push('<rect x="' + (bx - 9) + '" y="' + (y - 7) + '" width="18" height="14" rx="2.5" fill="#1fbf6a" stroke="#c8ffe0" stroke-width="1.4"/><rect x="' + (bx + 9) + '" y="' + (y - 3) + '" width="2.5" height="6" fill="#c8ffe0"/><path d="M' + (bx + 1.5) + ' ' + (y - 5) + ' l-5 6 h4 l-1.5 5 l5.5 -7 h-4z" fill="#fff"/>'); }
    /* lane 4: the black pack: a random lane every 5 minutes, slows the run for 60 seconds */
    y = 442; o.push('<text x="' + L + '" y="' + (y - 44) + '" fill="#d7bd86" font-size="19" font-weight="700" letter-spacing="1.5">BLACK PACK</text><text x="' + L + '" y="' + (y - 24) + '" fill="#fff" font-size="15" fill-opacity=".9">FIRST AT ' + mmss(pk.firstSec) + ', THEN EVERY ' + mmss(pk.everySec) + ' &middot; RANDOM LANE &middot; SLOWS YOU ' + pk.slowPct + '% FOR ' + pk.slowSec + ' SECONDS</text>');
    o.push('<line x1="' + L + '" y1="' + y + '" x2="' + R + '" y2="' + y + '" stroke="#d7bd86" stroke-opacity=".35"/>');
    for (t = pk.firstSec; t <= MIN * 60; t += pk.everySec) { var px = X(t); o.push('<rect x="' + px + '" y="' + (y - 6) + '" width="' + Math.max(2, (R - L) * pk.slowSec / (MIN * 60)) + '" height="12" rx="3" fill="#fff" fill-opacity=".16"/>'); o.push('<rect x="' + (px - 8) + '" y="' + (y - 8) + '" width="16" height="16" rx="2.5" fill="#17100c" stroke="#d7bd86" stroke-width="1.6"/><path d="M' + (px - 4) + ' ' + y + ' h8 M' + px + ' ' + (y - 4) + ' v8" stroke="#d7bd86" stroke-width="1.4"/>'); }
    /* lane 5: the red 8-bit heart: a random lane every 5 minutes, gives back half of your health */
    y = 552; o.push('<text x="' + L + '" y="' + (y - 44) + '" fill="#ff7b90" font-size="19" font-weight="700" letter-spacing="1.5">RED HEART</text><text x="' + L + '" y="' + (y - 24) + '" fill="#fff" font-size="15" fill-opacity=".9">FIRST AT ' + mmss(ht.firstSec) + ', THEN EVERY ' + mmss(ht.everySec) + ' &middot; RANDOM LANE &middot; GIVES BACK HALF YOUR HEALTH</text>');
    o.push('<line x1="' + L + '" y1="' + y + '" x2="' + R + '" y2="' + y + '" stroke="#ff7b90" stroke-opacity=".35"/>');
    for (t = ht.firstSec; t <= MIN * 60; t += ht.everySec) o.push(heartSvg(X(t), y, 1.7));
    /* the phone power: with every battery caught, and with none */
    var C = { top: 630, bot: 704 }, PY = function (v) { return C.bot - (C.bot - C.top) * v / 100; };
    o.push('<text x="' + L + '" y="594" fill="#fff" font-size="19" font-weight="700" letter-spacing="1.5">PHONE POWER</text><text x="' + L + '" y="614" fill="#fff" font-size="15" fill-opacity=".9">STARTS AT ' + ba.start + '%, LOSES ' + ba.drainPerMin + '% A MINUTE</text>');
    o.push('<line x1="' + L + '" y1="' + PY(0) + '" x2="' + R + '" y2="' + PY(0) + '" stroke="#ff6b6b" stroke-opacity=".6"/><line x1="' + L + '" y1="' + PY(20) + '" x2="' + R + '" y2="' + PY(20) + '" stroke="#ff6b6b" stroke-opacity=".25" stroke-dasharray="4 5"/><text x="' + (L + 4) + '" y="' + (PY(20) - 5) + '" fill="#ff9a8f" font-size="13">UNDER 20% IT TURNS RED</text>');
    var pw = ba.start, pts = [], none = [], s, drain = ba.drainPerMin / 60, CATCH = [1, 1, 0, 1, 0, 1, 1, 0, 1, 0];   /* a normal player: catches 6 of every 10 batteries */
    for (s = 0; s <= MIN * 60; s += 5) { if (s > 0) pw = Math.max(0, pw - drain * 5); if (s >= ba.firstSec && (s - ba.firstSec) % ba.everySec === 0 && CATCH[((s - ba.firstSec) / ba.everySec) % CATCH.length]) pw = Math.min(100, pw + ba.gain); pts.push(X(s) + ',' + PY(pw)); var nn = Math.max(0, ba.start - drain * s); none.push(X(s) + ',' + PY(nn)); }
    o.push('<polyline points="' + none.join(' ') + '" fill="none" stroke="#ff6b6b" stroke-width="2.4" stroke-dasharray="7 6"/>');
    o.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="#6af0a0" stroke-width="3.2"/>');
    o.push('<text x="' + (X(8.5 * 60)) + '" y="' + (PY(26)) + '" fill="#ff9a8f" font-size="14">NO BATTERIES: DEAD AT ' + mmss(ba.start / drain) + '</text><text x="' + (X(12.5 * 60)) + '" y="' + (PY(100) - 8) + '" fill="#6af0a0" font-size="14">CATCH 6 OF 10 BATTERIES: YOU STAY ALIVE</text>');
    o.push('<text x="360" y="786" text-anchor="middle" fill="#f6dc95" font-size="14" letter-spacing="1">THE CHART STOPS AT 30 MINUTES. THE SAME PACE REPEATS FOR THE WHOLE RUN.</text>');
    o.push('</svg>');
    return o.join('');
  }
  /* an 8-bit heart made of little squares, centred on (cx, cy); u is the size of one square */
  var HEART = ['011000110', '111101111', '111111111', '111111111', '011111110', '001111100', '000111000', '000010000'];
  function heartSvg(cx, cy, u) {
    var o = [], r, c, x0 = cx - 4.5 * u, y0 = cy - 4 * u;
    for (r = 0; r < 8; r++) for (c = 0; c < 9; c++) if (HEART[r].charAt(c) === '1') o.push('<rect x="' + (x0 + c * u - u * 0.5).toFixed(2) + '" y="' + (y0 + r * u - u * 0.5).toFixed(2) + '" width="' + (u * 2).toFixed(2) + '" height="' + (u * 2).toFixed(2) + '" fill="#16000a"/>');
    for (r = 0; r < 8; r++) for (c = 0; c < 9; c++) if (HEART[r].charAt(c) === '1') o.push('<rect x="' + (x0 + c * u).toFixed(2) + '" y="' + (y0 + r * u).toFixed(2) + '" width="' + (u + 0.15).toFixed(2) + '" height="' + (u + 0.15).toFixed(2) + '" fill="' + ((r >= 4 || c >= 6) ? '#c3112b' : '#ff2f4a') + '"/>');
    return o.join('');
  }
  function hm(sec) { var h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60); return h + ':' + (m < 10 ? '0' : '') + m; }
  function mm(sec) { var m = Math.floor(sec / 60), s = Math.round(sec % 60); return m + ':' + (s < 10 ? '0' : '') + s; }
  /* WHEN CARDS DROP IN ONE RUN (and the slowdown pack and the red heart): the four hours of one run, drawn from the game's real numbers */
  function cards() {
    var P = window.HallProfile, cf = P && P.config; if (!cf || !cf.sight) return '';
    var sg = cf.sight, st = cf.stagger, fo = cf.foil, pk = cf.pack, ht = cf.heart || { firstSec: 300, everySec: 300 }, lk = sg.locksSec || [0, 0, 0, 7200, 10800];
    var L = 34, R = 690, SPAN = 4 * 3600, X = function (s) { return L + (R - L) * s / SPAN; }, o = [], t, y, H = 820;
    var lane = function (yy, color, name, desc) { o.push('<text x="' + L + '" y="' + (yy - 46) + '" fill="' + color + '" font-size="19" font-weight="700" letter-spacing="1.5">' + name + '</text><text x="' + L + '" y="' + (yy - 26) + '" fill="#fff" font-size="14.5" fill-opacity=".9">' + desc + '</text><line x1="' + L + '" y1="' + yy + '" x2="' + R + '" y2="' + yy + '" stroke="' + color + '" stroke-opacity=".35"/>'); };
    o.push('<svg viewBox="0 0 720 ' + H + '" xmlns="' + NS + '" role="img" aria-label="Timeline of one run over four hours: the first card, a new card every ' + mm(sg.everySec) + ', stagger cards, foil halves, when Prestige and Legendary open, the black slowdown pack every ' + mm(pk.everySec) + ' and the red heart every ' + mm(ht.everySec) + '" font-family="Cinzel, Georgia, serif">');
    o.push('<rect width="720" height="' + H + '" fill="#12050a"/><rect x="1" y="1" width="718" height="' + (H - 2) + '" fill="none" stroke="#d9ac5c" stroke-opacity=".6"/>');
    o.push('<text x="360" y="34" text-anchor="middle" fill="#f6dc95" font-size="22" font-weight="700" letter-spacing="3">WHEN CARDS DROP IN ONE RUN</text>');
    for (t = 0; t <= 4; t++) { o.push('<line x1="' + X(t * 3600) + '" y1="54" x2="' + X(t * 3600) + '" y2="740" stroke="#fff" stroke-opacity="' + (t % 2 === 0 ? '.16' : '.09') + '"/><text x="' + X(t * 3600) + '" y="764" text-anchor="middle" fill="#fff" font-size="16" fill-opacity=".85">' + t + ':00</text>'); }
    o.push('<text x="360" y="790" text-anchor="middle" fill="#fff" font-size="14" fill-opacity=".7" letter-spacing="2">HOURS : MINUTES ALIVE IN ONE RUN (DYING STARTS IT OVER)</text>');
    /* 1: the first card */
    y = 118; lane(y, '#ffd45a', 'FIRST CARD &middot; ONCE EVER', 'A GIFT IN YOUR VERY FIRST RUN, AT 0:30: CARD NUMBER 1');
    o.push('<rect x="' + (X(30) - 7) + '" y="' + (y - 10) + '" width="14" height="20" rx="2" fill="#2a1a05" stroke="#ffd45a" stroke-width="1.8"/><path d="M' + X(30) + ' ' + (y - 5) + ' l1.8 4 4 .3 -3 2.6 1 4 -3.8 -2.2 -3.8 2.2 1 -4 -3 -2.6 4 -.3z" fill="#ffd45a"/>');
    /* 2: sightings */
    y = 218; lane(y, '#ff8b80', 'SIGHTINGS &middot; ALWAYS NEW', 'A NEW CARD EVERY ' + mm(sg.everySec) + ' FROM THE RARITY LOTTERY. NEVER A DUPLICATE');
    for (t = sg.everySec; t <= SPAN; t += sg.everySec) o.push('<circle cx="' + X(t).toFixed(1) + '" cy="' + y + '" r="4.3" fill="#e03a3a" stroke="#ffc2b8" stroke-width="1.3"/>');
    /* 3: stagger */
    y = 318; lane(y, '#d9a8ff', 'STAGGER &middot; DUPLICATES', 'FROM ' + mm(st.firstSec) + ', THEN EVERY ' + mm(st.everySec) + '. A DUPLICATE OF A CARD YOU OWN');
    for (t = st.firstSec; t <= SPAN; t += st.everySec) o.push('<circle cx="' + X(t).toFixed(1) + '" cy="' + y + '" r="5.2" fill="#8a22e8" stroke="#ead2ff" stroke-width="1.4"/>');
    /* 4: foil */
    y = 418; lane(y, '#ffd45a', 'FOIL &middot; TORN HALVES', 'AT 1 MINUTE OF TOTAL PLAY, THEN EVERY ' + (fo.everySec / 60) + ' MINUTES OF TOTAL PLAY');
    for (t = fo.firstSec; t <= SPAN; t += fo.everySec) { var fx = X(t); o.push('<rect x="' + (fx - 6) + '" y="' + (y - 9) + '" width="12" height="18" rx="2" fill="#3a2606" stroke="#ffd45a" stroke-width="1.6"/><path d="M' + fx + ' ' + (y - 8) + ' l-2.5 5 3 3 -3 5 2.5 4" fill="none" stroke="#ffd45a" stroke-width="1.3"/>'); }
    /* 5: prestige and legendary */
    y = 518; lane(y, '#fff', 'PRESTIGE AND LEGENDARY', 'THEY JOIN THE SIGHTINGS LOTTERY AFTER THIS MUCH TIME ALIVE IN ONE RUN');
    o.push('<rect x="' + X(lk[3]) + '" y="' + (y - 11) + '" width="' + (X(lk[4]) - X(lk[3])) + '" height="22" rx="4" fill="#6a1fc2" stroke="#d9a8ff"/><text x="' + ((X(lk[3]) + X(lk[4])) / 2) + '" y="' + (y + 5) + '" text-anchor="middle" fill="#fff" font-size="13">PRESTIGE AT ' + hm(lk[3]) + '</text>');
    o.push('<rect x="' + X(lk[4]) + '" y="' + (y - 11) + '" width="' + (R - X(lk[4])) + '" height="22" rx="4" fill="#a8741a" stroke="#ffe08a"/><text x="' + ((X(lk[4]) + R) / 2) + '" y="' + (y + 5) + '" text-anchor="middle" fill="#fff" font-size="13">LEGENDARY AT ' + hm(lk[4]) + '</text>');
    /* 6: the black slowdown pack */
    y = 618; lane(y, '#d7bd86', 'SLOWDOWN PACK &middot; NOT A CARD', 'A BLACK PACK FROM ' + mm(pk.firstSec) + ', THEN EVERY ' + mm(pk.everySec) + ' &middot; RANDOM LANE &middot; ' + pk.slowPct + '% SLOWER FOR ' + pk.slowSec + ' SECONDS');
    for (t = pk.firstSec; t <= SPAN; t += pk.everySec) o.push('<rect x="' + (X(t) - 2.2).toFixed(1) + '" y="' + (y - 4.5) + '" width="4.4" height="9" rx="1" fill="#17100c" stroke="#d7bd86" stroke-width="1"/>');
    /* 7: the red heart */
    y = 718; lane(y, '#ff7b90', 'RED HEART &middot; NOT A CARD', 'A RED HEART FROM ' + mm(ht.firstSec) + ', THEN EVERY ' + mm(ht.everySec) + ' &middot; RANDOM LANE &middot; GIVES BACK HALF YOUR HEALTH');
    for (t = ht.firstSec; t <= SPAN; t += ht.everySec) o.push(heartSvg(X(t), y, 1.1));
    o.push('</svg>');
    return o.join('');
  }
  /* the black pack row for the cards infographic: same scale as the picture above it (0:00 to 4:00 hours alive across its time axis), drawn from the real numbers */
  function packStrip() {
    var P = window.HallProfile, pk = P && P.config && P.config.pack; if (!pk) return '';
    var X0 = 276, X1 = 1243, SPAN = 4 * 3600, X = function (sec) { return X0 + (X1 - X0) * sec / SPAN; }, o = [], t, k;
    o.push('<svg viewBox="0 0 1344 130" xmlns="' + NS + '" role="img" aria-label="The black pack: a slowdown pack in a random lane every ' + (pk.everySec / 60) + ' minutes, slowing the run ' + pk.slowPct + ' percent for ' + pk.slowSec + ' seconds" font-family="Cinzel, Georgia, serif">');
    o.push('<rect width="1344" height="130" fill="#0b0407"/><line x1="40" y1="1" x2="1300" y2="1" stroke="#d9ac5c" stroke-opacity=".45"/>');
    for (k = 1; k <= 4; k++) o.push('<line x1="' + (X0 + (X1 - X0) * k / 4) + '" y1="0" x2="' + (X0 + (X1 - X0) * k / 4) + '" y2="130" stroke="#d9ac5c" stroke-opacity=".28" stroke-dasharray="6 6"/>');
    o.push('<line x1="' + X0 + '" y1="0" x2="' + X0 + '" y2="130" stroke="#d9ac5c" stroke-opacity=".28" stroke-dasharray="6 6"/>');
    o.push('<rect x="64" y="34" width="34" height="34" rx="5" fill="#17100c" stroke="#d7bd86" stroke-width="2.4"/><path d="M73 51 h16 M81 43 v16" stroke="#d7bd86" stroke-width="2.4"/>');
    o.push('<text x="112" y="46" fill="#f1d9a0" font-size="24">SLOWDOWN</text><text x="112" y="72" fill="#f1d9a0" font-size="24">PACK</text><text x="112" y="100" fill="#f1d9a0" fill-opacity=".85" font-size="19">Random lane</text>');
    for (t = pk.firstSec; t <= SPAN; t += pk.everySec) { var px = X(t); o.push('<rect x="' + (px - 7) + '" y="42" width="14" height="14" rx="2" fill="#17100c" stroke="#d7bd86" stroke-width="1.6"/><path d="M' + (px - 3.5) + ' 49 h7 M' + px + ' 45.5 v7" stroke="#d7bd86" stroke-width="1.3"/>'); }
    o.push('<text x="' + (X0 + 21) + '" y="100" fill="#fff" fill-opacity=".92" font-size="19">Every ' + (pk.everySec / 60) + ' min, random lane. Run into it: ' + pk.slowPct + '% slower for ' + pk.slowSec + ' seconds. No points, no cards.</text>');
    o.push('</svg>');
    return o.join('');
  }
  function fill(root) { Array.prototype.forEach.call((root || document).querySelectorAll('[data-pstrip]'), function (el) { var h = packStrip(); if (h) el.innerHTML = h; }); Array.prototype.forEach.call((root || document).querySelectorAll('[data-cchart]'), function (el) { var h = cards(); if (h) el.innerHTML = h; }); Array.prototype.forEach.call((root || document).querySelectorAll('[data-pchart]'), function (el) { var h = svg(); if (h) el.innerHTML = h; }); }
  window.HallPower = { svg: svg, cards: cards, packStrip: packStrip, fill: fill };
})();
