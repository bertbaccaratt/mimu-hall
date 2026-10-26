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
    var mg = it.magnet, mu = it.multi, ba = it.battery, pk = P.config.pack || { firstSec: 300, everySec: 300, slowPct: 20, slowSec: 60 }, o = [], i, t, y, H = 670;
    o.push('<svg viewBox="0 0 720 ' + H + '" xmlns="' + NS + '" role="img" aria-label="Timeline of the coin magnet, the coin multiplier, the phone battery and the black pack over the first 30 minutes of one run" font-family="Cinzel, Georgia, serif">');
    o.push('<rect width="720" height="' + H + '" fill="#12050a"/><rect x="1" y="1" width="718" height="' + (H - 2) + '" fill="none" stroke="#d9ac5c" stroke-opacity=".6"/>');
    o.push('<text x="360" y="34" text-anchor="middle" fill="#f6dc95" font-size="22" font-weight="700" letter-spacing="3">THE FIRST 30 MINUTES OF ONE RUN</text>');
    /* the time grid */
    for (t = 0; t <= MIN; t += 5) { o.push('<line x1="' + X(t * 60) + '" y1="54" x2="' + X(t * 60) + '" y2="590" stroke="#fff" stroke-opacity="' + (t % 10 === 0 ? '.16' : '.08') + '"/>'); o.push('<text x="' + X(t * 60) + '" y="616" text-anchor="middle" fill="#fff" font-size="16" fill-opacity=".85">' + t + ':00</text>'); }
    o.push('<text x="360" y="644" text-anchor="middle" fill="#fff" font-size="15" fill-opacity=".7" letter-spacing="2">TIME ALIVE IN ONE RUN</text>');
    /* lane 1: the coin magnet */
    y = 112; o.push('<text x="' + L + '" y="' + (y - 44) + '" fill="#9fd7ff" font-size="19" font-weight="700" letter-spacing="1.5">COIN MAGNET</text><text x="' + L + '" y="' + (y - 24) + '" fill="#fff" font-size="15" fill-opacity=".9">FIRST AT ' + mmss(mg.firstSec) + ', THEN EVERY ' + mmss(mg.everySec) + ' &middot; LASTS ' + mg.durSec + ' SECONDS' + (mg.durSec < mg.everySec ? ' &middot; OFF BEFORE THE NEXT' : '') + '</text>');
    o.push('<line x1="' + L + '" y1="' + y + '" x2="' + R + '" y2="' + y + '" stroke="#9fd7ff" stroke-opacity=".35"/>');
    for (t = mg.firstSec; t < MIN * 60; t += mg.everySec) { var x = X(t); o.push('<rect x="' + x + '" y="' + (y - 7) + '" width="' + Math.max(2, (R - L) * mg.durSec / (MIN * 60)) + '" height="14" rx="2" fill="#4aa3ff" fill-opacity=".8"/>'); if (t !== mg.firstSec) continue; o.push('<path d="M' + (x - 5) + ' ' + (y + 9) + ' v-9 a5 5 0 0 1 10 0 v9" fill="none" stroke="#9fd7ff" stroke-width="2.4"/><rect x="' + (x - 6.5) + '" y="' + (y + 7) + '" width="4" height="4" fill="#ff6b6b"/><rect x="' + (x + 2.5) + '" y="' + (y + 7) + '" width="4" height="4" fill="#fff"/>'); }
    /* lane 2: the coin multiplier */
    y = 222; o.push('<text x="' + L + '" y="' + (y - 44) + '" fill="#ffd45a" font-size="19" font-weight="700" letter-spacing="1.5">COIN MULTIPLIER</text><text x="' + L + '" y="' + (y - 24) + '" fill="#fff" font-size="15" fill-opacity=".9">A CHAIN EVERY ' + mmss(mu.periodSec) + ' FROM ' + mmss(mu.firstSec) + ' &middot; x2 TO x' + mu.max + '</text>');
    o.push('<line x1="' + L + '" y1="' + y + '" x2="' + R + '" y2="' + y + '" stroke="#ffd45a" stroke-opacity=".35"/>');
    var hitSec = (mu.max - 1) * mu.gapSec;
    for (t = mu.firstSec; t < MIN * 60; t += mu.periodSec) {
      var cx = X(t); o.push('<rect x="' + X(t + hitSec) + '" y="' + (y - 5) + '" width="' + (R - L) * mu.cooldownSec / (MIN * 60) + '" height="10" rx="3" fill="#fff" fill-opacity=".18"/>');
      for (i = 0; i < mu.chips; i++) o.push('<circle cx="' + (X(t + i * mu.gapSec)) + '" cy="' + y + '" r="5.2" fill="#ffd45a" stroke="#7a1d1d" stroke-width="1.5"/>');
      o.push('<text x="' + (cx + 2) + '" y="' + (y + 28) + '" fill="#ffd45a" font-size="14" font-weight="700">x' + mu.max + '</text>');
    }
    /* lane 3: the phone battery */
    y = 332; o.push('<text x="' + L + '" y="' + (y - 44) + '" fill="#6af0a0" font-size="19" font-weight="700" letter-spacing="1.5">PHONE BATTERY</text><text x="' + L + '" y="' + (y - 24) + '" fill="#fff" font-size="15" fill-opacity=".9">FIRST AT ' + mmss(ba.firstSec) + ', THEN EVERY ' + mmss(ba.everySec) + ' &middot; +' + ba.gain + '% POWER</text>');
    o.push('<line x1="' + L + '" y1="' + y + '" x2="' + R + '" y2="' + y + '" stroke="#6af0a0" stroke-opacity=".35"/>');
    for (t = ba.firstSec; t <= MIN * 60; t += ba.everySec) { var bx = X(t); o.push('<rect x="' + (bx - 9) + '" y="' + (y - 7) + '" width="18" height="14" rx="2.5" fill="#1fbf6a" stroke="#c8ffe0" stroke-width="1.4"/><rect x="' + (bx + 9) + '" y="' + (y - 3) + '" width="2.5" height="6" fill="#c8ffe0"/><path d="M' + (bx + 1.5) + ' ' + (y - 5) + ' l-5 6 h4 l-1.5 5 l5.5 -7 h-4z" fill="#fff"/>'); }
    /* lane 4: the black pack: a random lane every 5 minutes, slows the run for 60 seconds */
    y = 442; o.push('<text x="' + L + '" y="' + (y - 44) + '" fill="#d7bd86" font-size="19" font-weight="700" letter-spacing="1.5">BLACK PACK</text><text x="' + L + '" y="' + (y - 24) + '" fill="#fff" font-size="15" fill-opacity=".9">FIRST AT ' + mmss(pk.firstSec) + ', THEN EVERY ' + mmss(pk.everySec) + ' &middot; RANDOM LANE &middot; SLOWS YOU ' + pk.slowPct + '% FOR ' + pk.slowSec + ' SECONDS</text>');
    o.push('<line x1="' + L + '" y1="' + y + '" x2="' + R + '" y2="' + y + '" stroke="#d7bd86" stroke-opacity=".35"/>');
    for (t = pk.firstSec; t <= MIN * 60; t += pk.everySec) { var px = X(t); o.push('<rect x="' + px + '" y="' + (y - 6) + '" width="' + Math.max(2, (R - L) * pk.slowSec / (MIN * 60)) + '" height="12" rx="3" fill="#fff" fill-opacity=".16"/>'); o.push('<rect x="' + (px - 8) + '" y="' + (y - 8) + '" width="16" height="16" rx="2.5" fill="#17100c" stroke="#d7bd86" stroke-width="1.6"/><path d="M' + (px - 4) + ' ' + y + ' h8 M' + px + ' ' + (y - 4) + ' v8" stroke="#d7bd86" stroke-width="1.4"/>'); }
    /* the phone power: with every battery caught, and with none */
    var C = { top: 520, bot: 594 }, PY = function (v) { return C.bot - (C.bot - C.top) * v / 100; };
    o.push('<text x="' + L + '" y="484" fill="#fff" font-size="19" font-weight="700" letter-spacing="1.5">PHONE POWER</text><text x="' + L + '" y="504" fill="#fff" font-size="15" fill-opacity=".9">STARTS AT ' + ba.start + '%, LOSES ' + ba.drainPerMin + '% A MINUTE</text>');
    o.push('<line x1="' + L + '" y1="' + PY(0) + '" x2="' + R + '" y2="' + PY(0) + '" stroke="#ff6b6b" stroke-opacity=".6"/><line x1="' + L + '" y1="' + PY(20) + '" x2="' + R + '" y2="' + PY(20) + '" stroke="#ff6b6b" stroke-opacity=".25" stroke-dasharray="4 5"/><text x="' + (L + 4) + '" y="' + (PY(20) - 5) + '" fill="#ff9a8f" font-size="13">UNDER 20% IT TURNS RED</text>');
    var pw = ba.start, pts = [], none = [], s, drain = ba.drainPerMin / 60, CATCH = [1, 1, 0, 1, 0, 1, 1, 0, 1, 0];   /* a normal player: catches 6 of every 10 batteries */
    for (s = 0; s <= MIN * 60; s += 5) { if (s > 0) pw = Math.max(0, pw - drain * 5); if (s >= ba.firstSec && (s - ba.firstSec) % ba.everySec === 0 && CATCH[((s - ba.firstSec) / ba.everySec) % CATCH.length]) pw = Math.min(100, pw + ba.gain); pts.push(X(s) + ',' + PY(pw)); var nn = Math.max(0, ba.start - drain * s); none.push(X(s) + ',' + PY(nn)); }
    o.push('<polyline points="' + none.join(' ') + '" fill="none" stroke="#ff6b6b" stroke-width="2.4" stroke-dasharray="7 6"/>');
    o.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="#6af0a0" stroke-width="3.2"/>');
    o.push('<text x="' + (X(8.5 * 60)) + '" y="' + (PY(26)) + '" fill="#ff9a8f" font-size="14">NO BATTERIES: DEAD AT ' + mmss(ba.start / drain) + '</text><text x="' + (X(12.5 * 60)) + '" y="' + (PY(100) - 8) + '" fill="#6af0a0" font-size="14">CATCH 6 OF 10 BATTERIES: YOU STAY ALIVE</text>');
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
    o.push('<text x="' + (X0 + 21) + '" y="100" fill="#fff" fill-opacity=".92" font-size="19">Every ' + (pk.everySec / 60) + ' min, random lane. Jump it: ' + pk.slowPct + '% slower for ' + pk.slowSec + ' seconds. No points, no cards.</text>');
    o.push('</svg>');
    return o.join('');
  }
  function fill(root) { Array.prototype.forEach.call((root || document).querySelectorAll('[data-pstrip]'), function (el) { var h = packStrip(); if (h) el.innerHTML = h; }); Array.prototype.forEach.call((root || document).querySelectorAll('[data-pchart]'), function (el) { var h = svg(); if (h) el.innerHTML = h; }); }
  window.HallPower = { svg: svg, packStrip: packStrip, fill: fill };
})();
