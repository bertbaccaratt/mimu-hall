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
    var mg = it.magnet, mu = it.multi, ba = it.battery, o = [], i, t, y;
    o.push('<svg viewBox="0 0 720 560" xmlns="' + NS + '" role="img" aria-label="Timeline of the coin magnet, the coin multiplier and the phone battery over the first 30 minutes of one run" font-family="Cinzel, Georgia, serif">');
    o.push('<rect width="720" height="560" fill="#12050a"/><rect x="1" y="1" width="718" height="558" fill="none" stroke="#d9ac5c" stroke-opacity=".6"/>');
    o.push('<text x="360" y="34" text-anchor="middle" fill="#f6dc95" font-size="22" font-weight="700" letter-spacing="3">THE FIRST 30 MINUTES OF ONE RUN</text>');
    /* the time grid */
    for (t = 0; t <= MIN; t += 5) { o.push('<line x1="' + X(t * 60) + '" y1="54" x2="' + X(t * 60) + '" y2="480" stroke="#fff" stroke-opacity="' + (t % 10 === 0 ? '.16' : '.08') + '"/>'); o.push('<text x="' + X(t * 60) + '" y="506" text-anchor="middle" fill="#fff" font-size="16" fill-opacity=".85">' + t + ':00</text>'); }
    o.push('<text x="360" y="534" text-anchor="middle" fill="#fff" font-size="15" fill-opacity=".7" letter-spacing="2">TIME ALIVE IN ONE RUN</text>');
    /* lane 1: the coin magnet */
    y = 112; o.push('<text x="' + L + '" y="' + (y - 44) + '" fill="#9fd7ff" font-size="19" font-weight="700" letter-spacing="1.5">COIN MAGNET</text><text x="' + L + '" y="' + (y - 24) + '" fill="#fff" font-size="15" fill-opacity=".9">FIRST AT ' + mmss(mg.firstSec) + ', THEN EVERY ' + mmss(mg.everySec) + ' &middot; LASTS ' + mg.durSec + ' SECONDS</text>');
    o.push('<line x1="' + L + '" y1="' + y + '" x2="' + R + '" y2="' + y + '" stroke="#9fd7ff" stroke-opacity=".35"/>');
    for (t = mg.firstSec; t < MIN * 60; t += mg.everySec) { var x = X(t); o.push('<rect x="' + x + '" y="' + (y - 6) + '" width="' + Math.max(2, (R - L) * mg.durSec / (MIN * 60)) + '" height="12" rx="3" fill="#4aa3ff" fill-opacity=".55"/>'); o.push('<path d="M' + (x - 5) + ' ' + (y + 9) + ' v-9 a5 5 0 0 1 10 0 v9" fill="none" stroke="#9fd7ff" stroke-width="2.4"/><rect x="' + (x - 6.5) + '" y="' + (y + 7) + '" width="4" height="4" fill="#ff6b6b"/><rect x="' + (x + 2.5) + '" y="' + (y + 7) + '" width="4" height="4" fill="#fff"/>'); }
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
    /* the phone power: with every battery caught, and with none */
    var C = { top: 410, bot: 484 }, PY = function (v) { return C.bot - (C.bot - C.top) * v / 100; };
    o.push('<text x="' + L + '" y="374" fill="#fff" font-size="19" font-weight="700" letter-spacing="1.5">PHONE POWER</text><text x="' + L + '" y="394" fill="#fff" font-size="15" fill-opacity=".9">STARTS AT ' + ba.start + '%, LOSES ' + ba.drainPerMin + '% A MINUTE</text>');
    o.push('<line x1="' + L + '" y1="' + PY(0) + '" x2="' + R + '" y2="' + PY(0) + '" stroke="#ff6b6b" stroke-opacity=".6"/><line x1="' + L + '" y1="' + PY(20) + '" x2="' + R + '" y2="' + PY(20) + '" stroke="#ff6b6b" stroke-opacity=".25" stroke-dasharray="4 5"/><text x="' + (L + 4) + '" y="' + (PY(20) - 5) + '" fill="#ff9a8f" font-size="13">UNDER 20% IT TURNS RED</text>');
    var pw = ba.start, pts = [], none = [], s, drain = ba.drainPerMin / 60, CATCH = [1, 1, 0, 1, 0, 1, 1, 0, 1, 0];   /* a normal player: catches 6 of every 10 batteries */
    for (s = 0; s <= MIN * 60; s += 5) { if (s > 0) pw = Math.max(0, pw - drain * 5); if (s >= ba.firstSec && (s - ba.firstSec) % ba.everySec === 0 && CATCH[((s - ba.firstSec) / ba.everySec) % CATCH.length]) pw = Math.min(100, pw + ba.gain); pts.push(X(s) + ',' + PY(pw)); var nn = Math.max(0, ba.start - drain * s); none.push(X(s) + ',' + PY(nn)); }
    o.push('<polyline points="' + none.join(' ') + '" fill="none" stroke="#ff6b6b" stroke-width="2.4" stroke-dasharray="7 6"/>');
    o.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="#6af0a0" stroke-width="3.2"/>');
    o.push('<text x="' + (X(8.5 * 60)) + '" y="' + (PY(26)) + '" fill="#ff9a8f" font-size="14">NO BATTERIES: DEAD AT ' + mmss(ba.start / drain) + '</text><text x="' + (X(12.5 * 60)) + '" y="' + (PY(100) - 8) + '" fill="#6af0a0" font-size="14">CATCH 6 OF 10 BATTERIES: YOU STAY ALIVE</text>');
    o.push('</svg>');
    return o.join('');
  }
  function fill(root) { Array.prototype.forEach.call((root || document).querySelectorAll('[data-pchart]'), function (el) { var h = svg(); if (h) el.innerHTML = h; }); }
  window.HallPower = { svg: svg, fill: fill };
})();
