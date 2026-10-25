/* BADGES: milestones for every player. They are only a way to keep track of what you have done in the Hall: they never touch the leaderboard and they are worth nothing.
   Everything is read from HallProfile.stats() (what the server has counted for the signed-in player) and from the cards the player has collected. Until somebody is signed in, every badge is simply locked. */
(function () {
  'use strict';
  var P = window.HallProfile; if (!P) return;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Math.floor(n || 0).toLocaleString('en-US'); }
  function hms(s) { s = Math.floor(s || 0); var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m + 'm'; }
  var nf = function (u) { return function (v) { return fmt(v) + (u ? ' ' + u : ''); }; };

  /* ---------- the catalogue: groups, then categories, each with its own milestones ---------- */
  var GROUPS = [['run', 'RUNNING'], ['coin', 'COINS'], ['card', 'CARDS'], ['skill', 'SKILLS'], ['trade', 'TRADING'], ['soc', 'SOCIAL'], ['loy', 'LOYALTY']];
  var CATS = [
    { g: 'run', k: 'runs', n: 'FINISHED RUNS', t: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500], names: ['First Footsteps', 'Warming Up', 'Regular Visitor', 'Hallway Local', 'Candle Keeper', 'Century Runner', 'Marble Veteran', 'Banner Bearer', 'Hall Legend', 'Endless Corridor'], d: function (n) { return 'Finish ' + fmt(n) + (n === 1 ? ' run' : ' runs'); } },
    { g: 'run', k: 'distance', n: 'DISTANCE RUN', t: [500, 2000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000], names: ['First Stretch', 'Down the Aisle', 'Long Gallery', 'Past the Pillars', 'Marathon Floor', 'Ten Thousand Steps', 'Across the Hall', 'The Great Walk', 'Beyond the Doors', 'A Million Strides'], f: nf('m'), d: function (n) { return 'Run ' + fmt(n) + ' metres in total'; } },
    { g: 'run', k: 'aliveSec', n: 'TIME IN THE HALL', t: [600, 1800, 3600, 10800, 21600, 43200, 86400, 172800, 360000], names: ['Ten Minutes In', 'Half an Hour', 'A Full Hour', 'Three Hours Deep', 'Six Hours Strong', 'Half a Day', 'A Whole Day', 'Two Days Running', 'Hundred Hour Club'], f: hms, d: function (n) { return 'Stay alive for ' + hms(n) + ' in total'; } },
    { g: 'run', k: 'longestSec', n: 'LONGEST RUN', t: [60, 300, 600, 1800, 3600, 7200, 10800, 21600], names: ['A Minute Steady', 'Five Calm Minutes', 'Ten Without a Scratch', 'Half Hour Hero', 'The Hour Mark', 'Two Hour Stretch', 'Three Hour Marathon', 'Six Hours Unbroken'], f: hms, d: function (n) { return 'Survive ' + hms(n) + ' in one run'; } },
    { g: 'run', k: 'bestScore', n: 'BEST SINGLE RUN', t: [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000], names: ['First Thousand', 'Five Thousand Strong', 'Ten Thousand Club', 'Twenty-Five Thousand', 'Fifty Thousand', 'Six Figures', 'Quarter Million', 'Half a Million', 'The Million Run'], d: function (n) { return 'Score ' + fmt(n) + ' in a single run'; } },
    { g: 'coin', k: 'coins', n: 'COINS COLLECTED', t: [10, 100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000], names: ['Pocket Change', 'Handful of Gold', 'Coin Collector', 'A Thousand Shines', 'Heavy Pockets', 'Treasure Chest', 'Gold Hoarder', 'Vault Keeper', 'Dragon Hoard', 'Endless Fortune'], d: function (n) { return 'Collect ' + fmt(n) + ' coins in total'; } },
    { g: 'coin', k: 'bestCoinsRun', n: 'COINS IN ONE RUN', t: [25, 50, 100, 250, 500, 1000], names: ['Coin Streak', 'Fifty Shines', 'One Hundred', 'Quarter Thousand', 'Golden Run', 'The Thousand Run'], d: function (n) { return 'Collect ' + fmt(n) + ' coins in a single run'; } },
    { g: 'card', k: 'cards', n: 'CARDS COLLECTED', t: [1, 5, 10, 20, 30, 45, 60, 75, 90, 105, 120], names: ['First Card', 'Starter Hand', 'Ten Strong', 'Twenty Deep', 'Thirty Found', 'Forty-Five', 'Halfway There', 'Seventy-Five', 'Ninety Found', 'Almost Complete', 'The Full Deck'], d: function (n) { return n === 120 ? 'Collect all 120 cards' : 'Collect ' + n + (n === 1 ? ' card' : ' different cards'); } },
    { g: 'card', k: 'tier1', n: 'COMMON CARDS', t: [1, 55], names: ['First Common', 'Every Common'], d: function (n) { return n === 55 ? 'Collect all 55 Common cards' : 'Collect your first Common card'; } },
    { g: 'card', k: 'tier2', n: 'UNCOMMON CARDS', t: [1, 30], names: ['First Uncommon', 'Every Uncommon'], d: function (n) { return n === 30 ? 'Collect all 30 Uncommon cards' : 'Collect your first Uncommon card'; } },
    { g: 'card', k: 'tier3', n: 'RARE CARDS', t: [1, 13], names: ['First Rare', 'Every Rare'], d: function (n) { return n === 13 ? 'Collect all 13 Rare cards' : 'Collect your first Rare card'; } },
    { g: 'card', k: 'tier4', n: 'PRESTIGE CARDS', t: [1, 14], names: ['First Prestige', 'Every Prestige'], d: function (n) { return n === 14 ? 'Collect all 14 Prestige cards' : 'Collect your first Prestige card'; } },
    { g: 'card', k: 'tier5', n: 'LEGENDARY CARDS', t: [1, 8], names: ['First Legendary', 'Every Legendary'], d: function (n) { return n === 8 ? 'Collect all 8 Legendary cards' : 'Collect your first Legendary card'; } },
    { g: 'card', k: 'famclub', n: 'CLUB FAMILY', t: [1, 62], names: ['Club Member', 'Whole Club'], d: function (n) { return n === 62 ? 'Collect all 62 Club cards' : 'Collect your first Club card'; } },
    { g: 'card', k: 'fammutant', n: 'MUTANT FAMILY', t: [1, 22], names: ['Mutant Spotted', 'Whole Mutant Line'], d: function (n) { return n === 22 ? 'Collect all 22 Mutant cards' : 'Collect your first Mutant card'; } },
    { g: 'card', k: 'famcosmic', n: 'COSMIC FAMILY', t: [1, 16], names: ['Cosmic Glimpse', 'Whole Cosmos'], d: function (n) { return n === 16 ? 'Collect all 16 Cosmic cards' : 'Collect your first Cosmic card'; } },
    { g: 'card', k: 'famarcana', n: 'ARCANA FAMILY', t: [1, 20], names: ['Arcana Touched', 'Whole Arcana'], d: function (n) { return n === 20 ? 'Collect all 20 Arcana cards' : 'Collect your first Arcana card'; } },
    { g: 'skill', k: 'packs', n: 'BLACK PACKS', t: [1, 3, 5, 10, 25, 50], names: ['Black Pack', 'Pack Habit', 'Pack Handful', 'Pack Regular', 'Pack Hoarder', 'Pack Master'], d: function (n) { return 'Jump into ' + n + (n === 1 ? ' black pack' : ' black packs'); } },
    { g: 'skill', k: 'boxesJumped', n: 'BOXES CLEARED', t: [25, 100, 500, 1000, 5000, 10000], names: ['Hop Over', 'Hurdler', 'Box Hopper', 'Thousand Hops', 'Steeplechaser', 'Ten Thousand Leaps'], d: function (n) { return 'Jump over ' + fmt(n) + ' boxes'; } },
    { g: 'skill', k: 'jumps', n: 'JUMPS', t: [50, 250, 1000, 5000, 25000], names: ['Light Feet', 'Spring in Step', 'Kangaroo Cape', 'Sky Walker', 'Never Grounded'], d: function (n) { return 'Jump ' + fmt(n) + ' times'; } },
    { g: 'skill', k: 'slides', n: 'SLIDES', t: [10, 50, 250, 1000, 5000], names: ['First Slide', 'Skimmer', 'Smooth Operator', 'Dust Trail', 'Floor Surfer'], d: function (n) { return 'Slide ' + fmt(n) + ' times'; } },
    { g: 'skill', k: 'lanes', n: 'LANE CHANGES', t: [100, 500, 2500, 10000, 50000], names: ['Lane Swap', 'Weaver', 'Zigzag', 'Needle Thread', 'Master of Three Lanes'], d: function (n) { return 'Change lane ' + fmt(n) + ' times'; } },
    { g: 'skill', k: 'hits', n: 'BOXES TAKEN', t: [1, 10, 50, 200, 1000], names: ['First Bump', 'Bruised', 'Tough Cape', 'Box Magnet', 'Unbreakable'], d: function (n) { return 'Take ' + fmt(n) + (n === 1 ? ' hit from a box' : ' hits from boxes'); } },
    { g: 'skill', k: 'extraLives', n: 'EXTRA LIVES', t: [1, 3, 5, 10, 25], names: ['Second Chance', 'Comeback', 'Persistent', 'Nine Lives, Almost', 'Cat Cape'], d: function (n) { return 'Buy ' + n + (n === 1 ? ' extra life' : ' extra lives'); } },
    { g: 'trade', k: 'boughtUp', n: 'FACE UP PURCHASES', t: [1, 3, 10, 25], names: ['Dealmaker', 'Bargain Hunter', 'Trusted Buyer', 'Trade Partner'], d: function (n) { return 'Buy ' + n + ' face up ' + (n === 1 ? 'card' : 'cards') + ' from players'; } },
    { g: 'trade', k: 'sold', n: 'CARDS SOLD', t: [1, 5, 10, 25, 50], names: ['First Sale', 'Seller', 'Merchant', 'Trader', 'Market Veteran'], d: function (n) { return 'Sell ' + n + (n === 1 ? ' card' : ' cards'); } },
    { g: 'trade', k: 'listed', n: 'CARDS LISTED', t: [1, 5, 10, 25], names: ['On the Shelf', 'Showcase', 'Shopkeeper', 'Gallery Curator'], d: function (n) { return 'List ' + n + (n === 1 ? ' card' : ' cards') + ' face up for sale'; } },
    { g: 'soc', k: 'textsSent', n: 'TEXTS SENT', t: [1, 10, 50, 250, 1000], names: ['Hello', 'Chatty', 'Conversationalist', 'Regular Texter', 'Hall Talker'], d: function (n) { return 'Send ' + fmt(n) + (n === 1 ? ' text' : ' texts'); } },
    { g: 'soc', k: 'textPartners', n: 'PLAYERS TEXTED', t: [1, 3, 5, 10, 25], names: ['First Contact', 'Small Circle', 'Social Spark', 'Wide Circle', 'Hall Socialite'], d: function (n) { return 'Text ' + n + ' different ' + (n === 1 ? 'player' : 'players'); } },
    { g: 'soc', k: 'mailRead', n: 'MAIL READ', t: [1, 5, 10, 25], names: ['First Letter', 'Mail Reader', 'Loyal Subscriber', 'Archivist'], d: function (n) { return 'Read ' + n + ' emails from MIMU'; } },
    { g: 'loy', k: 'daysPlayed', n: 'DAYS PLAYED', t: [1, 3, 7, 14, 30, 60, 100], names: ['Day One', 'Three Days', 'A Full Week', 'Two Weeks', 'A Month', 'Sixty Days', 'Hundred Days'], d: function (n) { return 'Play on ' + n + (n === 1 ? ' day' : ' different days'); } },
    { g: 'loy', k: 'bestStreak', n: 'DAY STREAK', t: [2, 3, 7, 14, 30, 60], names: ['Two in a Row', 'Three-Day Run', 'Weekly Habit', 'Fortnight Flame', 'Monthly Flame', 'Sixty Straight'], d: function (n) { return 'Play ' + n + ' days in a row'; } },
    { g: 'loy', k: 'signedIn', n: 'WELCOME', t: [1], names: ['Welcome to the Hall'], d: function () { return 'Sign in with Glyph'; } },
    { g: 'loy', k: 'eggFound', n: 'EASTER EGG', t: [1], names: ['Egg Hunter'], d: function () { return 'Be the one player who finds the hidden Easter egg'; } }
  ];
  var METAL = ['bronze', 'silver', 'gold', 'ruby', 'diamond'], METAL_NAME = { bronze: 'BRONZE', silver: 'SILVER', gold: 'GOLD', ruby: 'RUBY', diamond: 'DIAMOND' };
  var ALL = [];
  CATS.forEach(function (c) { c.t.forEach(function (n, i) { var r = c.t.length > 1 ? i / (c.t.length - 1) : 0; ALL.push({ id: c.k + ':' + n, cat: c, n: n, name: c.names[i], desc: c.d(n), metal: METAL[r < 0.2 ? 0 : r < 0.45 ? 1 : r < 0.7 ? 2 : r < 0.9 ? 3 : 4], rank: i + 1 }); }); });

  /* ---------- what the player has done ---------- */
  function values() {
    var s = (P.stats ? P.stats() : {}) || {}, v = {}, own = P.owned ? P.owned() : new Set(), cards = P.cards ? P.cards() : [], c;
    Object.keys(s).forEach(function (k) { v[k] = +s[k] || 0; });
    v.cards = 0; for (c = 1; c <= 5; c++) v['tier' + c] = 0; ['club', 'mutant', 'cosmic', 'arcana'].forEach(function (f) { v['fam' + f] = 0; });
    cards.forEach(function (cd) { if (own.has && own.has(cd.n)) { v.cards++; v['tier' + cd.tier]++; v['fam' + cd.family] = (v['fam' + cd.family] || 0) + 1; } });
    v.signedIn = P.isSignedIn() ? 1 : 0;
    return v;
  }

  /* ---------- the app: a dial for every category, tap a dial to open its badges ---------- */
  var built = false, st = { group: 'all', show: 'all', open: null };
  function icon(b, got) {
    var roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][b.rank] || b.rank;
    return '<span class="bdi ' + (got ? b.metal : 'locked') + '"><svg viewBox="0 0 40 46" aria-hidden="true"><path d="M20 2 37 11v18L20 44 3 29V11z"/></svg><b>' + (got ? roman : '&#128274;') + '</b></span>';
  }
  function row(b, v) {
    var val = v[b.cat.k] || 0, got = val >= b.n, f = b.cat.f || nf(''), pct = Math.min(100, Math.floor(val / b.n * 100));
    return '<div class="bdr ' + (got ? 'got ' + b.metal : '') + '">' + icon(b, got) + '<div class="bdt"><b>' + esc(b.name.toUpperCase()) + '</b><span>' + esc(b.desc) + '</span><div class="bdb"><i style="width:' + pct + '%"></i></div></div><div class="bdv">' + (got ? '<em>EARNED</em>' : f(Math.min(val, b.n)) + '<small>OF ' + (b.cat.f ? b.cat.f(b.n) : fmt(b.n)) + '</small>') + '</div></div>';
  }
  /* a tachometer: the gold arc is how many steps are earned, the ticks are the steps, the thin red arc is the way to the next one, the needle points at where you are */
  function gauge(frac, ticks, nextFrac, big) {
    var cx = 60, cy = 58, r = 46, i, a, p, q, s = '';
    function pt(an, rr) { return [cx + rr * Math.cos(an), cy - rr * Math.sin(an)]; }
    function arc(f, rr) { var sp = pt(Math.PI, rr), ep = pt(Math.PI * (1 - f), rr); return 'M' + sp[0].toFixed(2) + ' ' + sp[1].toFixed(2) + ' A' + rr + ' ' + rr + ' 0 0 1 ' + ep[0].toFixed(2) + ' ' + ep[1].toFixed(2); }
    s += '<path class="gtr" d="' + arc(0.9999, r) + '"/>';
    if (frac > 0) s += '<path class="gfl" d="' + arc(Math.min(frac, 0.9999), r) + '"/>';
    if (nextFrac != null) { s += '<path class="gnt" d="' + arc(0.9999, r - 11) + '"/>'; if (nextFrac > 0) s += '<path class="gnf" d="' + arc(Math.min(nextFrac, 0.9999), r - 11) + '"/>'; }
    for (i = 0; i <= ticks; i++) { a = Math.PI * (1 - i / ticks); p = pt(a, r - 5); q = pt(a, r + 3); s += '<line class="gtk' + (i / ticks <= frac + 0.0001 ? ' on' : '') + '" x1="' + p[0].toFixed(1) + '" y1="' + p[1].toFixed(1) + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '"/>'; }
    a = Math.PI * (1 - Math.min(frac, 1)); p = pt(a, r - 14);
    s += '<line class="gnd" x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '"/><circle class="ghub" cx="' + cx + '" cy="' + cy + '" r="4.2"/>';
    return '<svg class="gsvg' + (big ? ' big' : '') + '" viewBox="0 0 120 66" aria-hidden="true">' + s + '</svg>';
  }
  var uid = 0;
  function compact(n) { return n >= 1000000 ? +(n / 1000000).toFixed(1) + 'M' : n >= 1000 ? +(n / 1000).toFixed(1) + 'k' : String(n); }
  /* COINS: a green stock-market chart that climbs as the total grows */
  function chart(p, seed) {
    var n = 18, i, pts = [], pv = 0.1 + 0.9 * p, id = 'cg' + (uid++), x, y, v, line = '', area;
    for (i = 0; i < n; i++) { x = 4 + i * (112 / (n - 1)); v = pv * Math.pow(i / (n - 1), 0.85) + Math.sin(seed * 5.1 + i * 2.1) * 0.06 * (i / (n - 1)) * (i < n - 1 ? 1 : 0); v = Math.max(0.02, Math.min(1, v)); y = 50 - v * 42; pts.push([x, y]); line += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }
    area = line + ' L116 54 L4 54Z';
    return '<svg class="cst" viewBox="0 0 120 58" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3ddc84" stop-opacity=".45"/><stop offset="1" stop-color="#3ddc84" stop-opacity="0"/></linearGradient></defs>' +
      '<line class="cgl" x1="4" y1="14" x2="116" y2="14"/><line class="cgl" x1="4" y1="30" x2="116" y2="30"/><line class="cgl" x1="4" y1="46" x2="116" y2="46"/><path d="' + area + '" fill="url(#' + id + ')"/><path class="cln" d="' + line + '"/>' +
      '<circle class="cdt" cx="' + pts[n - 1][0].toFixed(1) + '" cy="' + pts[n - 1][1].toFixed(1) + '" r="2.6"/><circle class="cpl" cx="' + pts[n - 1][0].toFixed(1) + '" cy="' + pts[n - 1][1].toFixed(1) + '" r="2.6"/></svg>';
  }
  /* CARDS: a digital dial, a ring of lit segments around an LCD readout */
  function digital(done, len) {
    var segs = 28, i, a, s = '', lit = Math.round(done / len * segs), x1, y1, x2, y2;
    for (i = 0; i < segs; i++) { a = -Math.PI / 2 + i / segs * 2 * Math.PI; x1 = 40 + 21 * Math.cos(a); y1 = 30 + 21 * Math.sin(a); x2 = 40 + 27 * Math.cos(a); y2 = 30 + 27 * Math.sin(a); s += '<line class="dsg' + (i < lit ? ' on' : '') + '" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>'; }
    return '<svg class="dgs" viewBox="0 0 80 60" aria-hidden="true">' + s + '<text class="lcd" x="40" y="34" text-anchor="middle">' + done + '</text><text class="lcs" x="40" y="43" text-anchor="middle">OF ' + len + '</text></svg>';
  }
  /* SOCIAL: a three-quarter dial with coloured zones and a needle */
  function dial270(frac, steps) {
    var cx = 60, cy = 56, r = 40, i, s = '', a0 = 135, span = 270;
    function pt(d, rr) { var t = d * Math.PI / 180; return [cx + rr * Math.cos(t), cy + rr * Math.sin(t)]; }
    function arc(f, rr) { var sp = pt(a0, rr), ep = pt(a0 + span * f, rr); return 'M' + sp[0].toFixed(2) + ' ' + sp[1].toFixed(2) + ' A' + rr + ' ' + rr + ' 0 ' + (span * f > 180 ? 1 : 0) + ' 1 ' + ep[0].toFixed(2) + ' ' + ep[1].toFixed(2); }
    s += '<path class="dtr" d="' + arc(0.9999, r) + '"/><path class="dz1" d="' + arc(0.33, r - 7) + '"/>';
    if (frac > 0) s += '<path class="dfl" d="' + arc(Math.min(frac, 0.9999), r) + '"/>';
    for (i = 0; i <= steps; i++) { var p = pt(a0 + span * i / steps, r - 4), q = pt(a0 + span * i / steps, r + 5); s += '<line class="dtk' + (i / steps <= frac + 0.0001 ? ' on' : '') + '" x1="' + p[0].toFixed(1) + '" y1="' + p[1].toFixed(1) + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '"/>'; }
    var nd = pt(a0 + span * Math.min(frac, 1), r - 10);
    s += '<line class="dnd" x1="' + cx + '" y1="' + cy + '" x2="' + nd[0].toFixed(1) + '" y2="' + nd[1].toFixed(1) + '"/><circle class="dhb" cx="' + cx + '" cy="' + cy + '" r="4"/>';
    return '<svg class="gsvg dsc" viewBox="0 0 120 84" aria-hidden="true">' + s + '</svg>';
  }
  /* LOYALTY: a ring that fills around a flame, with a dot for every step */
  function flame(frac, steps) {
    var r = 36, c = 2 * Math.PI * r, i, a, s = '', id = 'fg' + (uid++);
    for (i = 0; i < steps; i++) { a = -Math.PI / 2 + (i + 1) / steps * 2 * Math.PI; s += '<circle class="fdt' + ((i + 1) / steps <= frac + 0.0001 ? ' on' : '') + '" cx="' + (50 + 43 * Math.cos(a)).toFixed(1) + '" cy="' + (50 + 43 * Math.sin(a)).toFixed(1) + '" r="1.9"/>'; }
    return '<svg class="fls" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd45a"/><stop offset="1" stop-color="#ff6a3a"/></linearGradient></defs><circle class="ftr" cx="50" cy="50" r="' + r + '"/><circle class="ffl" cx="50" cy="50" r="' + r + '" stroke="url(#' + id + ')" stroke-dasharray="' + (c * Math.min(frac, 0.9999)).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 50 50)"/>' + s +
      '<path class="fpa' + (frac > 0 ? ' on' : '') + '" transform="translate(50 52) scale(1.25)" d="M0-14C6-6 10-2 8 6C7 11 3 14 0 14C-4 14-8 11-8 6C-8 0-3-2 0-14Z"/><path class="fpb" transform="translate(50 56) scale(.8)" d="M0-10C4-4 6 0 5 5C4 8 2 10 0 10C-3 10-5 8-5 5C-5 1-2-1 0-10Z"/></svg>';
  }
  /* SKILLS: a detailed loading bar, one segment for every step, with the number each step needs */
  function skillBar(c, val) {
    var segs = '', labs = '';
    c.t.forEach(function (t, i) { var prev = i ? c.t[i - 1] : 0, f = Math.max(0, Math.min(1, (val - prev) / (t - prev))); segs += '<span class="' + (val >= t ? 'done' : f > 0 ? 'part' : '') + '"><i style="width:' + Math.round(f * 100) + '%"></i></span>'; labs += '<span class="' + (val >= t ? 'done' : '') + '">' + compact(t) + '</span>'; });
    return '<div class="skbar">' + segs + '</div><div class="sklab">' + labs + '</div>';
  }
  function draw() {
    var el = $('badgeApp'); if (!el) return; el.classList.add('page'); var oldPg = el.querySelector('.pg'), keep = oldPg ? oldPg.scrollTop : 0, v = values(), signed = P.isSignedIn();
    var got = ALL.filter(function (b) { return (v[b.cat.k] || 0) >= b.n; }), metals = {}; METAL.forEach(function (m) { metals[m] = 0; }); got.forEach(function (b) { metals[b.metal]++; });
    var pct = Math.round(got.length / ALL.length * 1000) / 10;
    var next = ALL.filter(function (b) { return (v[b.cat.k] || 0) < b.n; }).map(function (b) { return { b: b, p: (v[b.cat.k] || 0) / b.n }; }).sort(function (x, y) { return y.p - x.p; });
    var seenCat = {}, upnext = []; next.forEach(function (x) { if (upnext.length < 3 && !seenCat[x.b.cat.k] && x.p > 0) { seenCat[x.b.cat.k] = 1; upnext.push(x.b); } });
    var groups = '<button class="chip' + (st.group === 'all' ? ' on' : '') + '" data-g="all">ALL</button>' + GROUPS.map(function (g) { return '<button class="chip' + (st.group === g[0] ? ' on' : '') + '" data-g="' + g[0] + '">' + g[1] + '</button>'; }).join('');
    var shows = [['all', 'ALL'], ['got', 'EARNED'], ['todo', 'LOCKED']].map(function (s) { return '<button class="chip' + (st.show === s[0] ? ' on' : '') + '" data-s="' + s[0] + '">' + s[1] + '</button>'; }).join('');
    function cardFor(c) {
      var ts = ALL.filter(function (b) { return b.cat === c; }), val = v[c.k] || 0, done = ts.filter(function (b) { return val >= b.n; }).length, nb = ts.filter(function (b) { return val < b.n; })[0];
      var nfrac = nb ? Math.min(1, val / nb.n) : null, f = c.f || nf('');
      var open = st.open === c.k, cls = 'bdg ' + c.g + (open ? ' open' : '') + (done === ts.length ? ' full' : ''), head = '<button type="button" class="' + cls + '" data-c="' + c.k + '" aria-expanded="' + open + '">', gex = '<span class="gex">' + (open ? 'CLICK TO CLOSE' : 'CLICK TO EXPAND') + '</span></button>', nxt = '<em>' + (nb ? 'NEXT &middot; ' + Math.round(nfrac * 100) + '%' : 'COMPLETE') + '</em>', ov = (done + (nfrac || 0)) / ts.length, num = '<span class="gnum">' + done + '<small>/' + ts.length + '</small></span>';
      if (c.g === 'coin') return head + chart(c.k === 'coins' ? ov : ov * 0.9, c.k.length) + '<span class="gnum up">&#9650; ' + fmt(val) + '</span><b>' + esc(c.n) + '</b><em>' + (nb ? 'NEXT TARGET &middot; ' + fmt(nb.n) : 'ALL TARGETS REACHED') + '</em>' + gex;
      if (c.g === 'card') return head + digital(done, ts.length) + '<b>' + esc(c.n) + '</b><em>' + (nb ? 'NEXT &middot; ' + Math.round(nfrac * 100) + '%' : 'COMPLETE') + '</em>' + gex;
      if (c.g === 'skill') return head + '<span class="skh"><b>' + esc(c.n) + '</b><span class="skv">' + f(val) + '</span></span>' + skillBar(c, val) + '<span class="skf"><span>' + done + ' OF ' + ts.length + ' STEPS &middot; ' + Math.round(ov * 100) + '% OVERALL</span><em>' + (nb ? 'NEXT AT ' + f(nb.n) + ' &middot; ' + fmt(nb.n - val) + ' TO GO' : 'COMPLETE') + '</em></span>' + gex;
      if (c.g === 'soc') return head + dial270(done / ts.length, ts.length) + num + '<b>' + esc(c.n) + '</b>' + nxt + gex;
      if (c.g === 'loy') return head + flame(done / ts.length, ts.length) + num + '<b>' + esc(c.n) + '</b>' + nxt + gex;
      return head + gauge(done / ts.length, ts.length, nfrac) + num + '<b>' + esc(c.n) + '</b>' + nxt + gex;
    }
    function panelFor(c) {
      var bs = ALL.filter(function (b) { return b.cat === c && (st.show === 'all' || (st.show === 'got') === ((v[c.k] || 0) >= b.n)); });
      return '<div class="bdp">' + (bs.length ? bs.map(function (b) { return row(b, v); }).join('') : '<div class="empty">NOTHING IN THIS FILTER</div>') + '</div>';
    }
    var body = '';
    GROUPS.forEach(function (g) {
      if (st.group !== 'all' && st.group !== g[0]) return;
      var cs = CATS.filter(function (c) { return c.g === g[0]; }), earned = ALL.filter(function (b) { return b.cat.g === g[0] && (v[b.cat.k] || 0) >= b.n; }).length, tot = ALL.filter(function (b) { return b.cat.g === g[0]; }).length, i;
      body += '<div class="bdgrp"><div class="bdch"><b>' + g[1] + '</b><span>' + earned + ' / ' + tot + '</span></div><div class="bdgrid">';
      var step = g[0] === 'skill' ? 1 : 2;
      for (i = 0; i < cs.length; i += step) {
        body += cs.slice(i, i + step).map(cardFor).join('');
        var openC = cs.slice(i, i + step).filter(function (c) { return c.k === st.open; })[0]; if (openC) body += panelFor(openC);
      }
      body += '</div></div>';
    });
    el.innerHTML = '<div class="pg bd"><div class="pgh"><h2 class="gold">BADGES</h2><div class="pgsub">MILESTONES &middot; NOT RANKED &middot; NO VALUE</div></div><div id="huntBadge" class="huntbadge lost"></div>' +
      '<div class="bdsum"><i class="c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i>' + gauge(got.length / ALL.length, 10, null, true) + '<div class="bdbig"><b>' + got.length + '</b><span>OF ' + ALL.length + ' EARNED &middot; ' + pct + '%</span></div><div class="bdm">' + METAL.map(function (m) { return '<span class="' + m + '"><i></i>' + metals[m] + '<small>' + METAL_NAME[m] + '</small></span>'; }).join('') + '</div></div>' +
      '<div class="bdnote">' + (signed ? 'Badges are only milestones to keep track of what you have done in the Hall. They do not change the leaderboard and they are worth nothing.' : 'THE GAME IS A DEMO FOR NOW, SO EVERY BADGE STAYS LOCKED UNTIL GLYPH SIGN-IN OPENS. BADGES ARE ONLY MILESTONES: THEY NEVER CHANGE THE LEADERBOARD AND ARE WORTH NOTHING.') + '</div>' +
      (upnext.length ? '<div class="sec"><div class="sech">UP NEXT</div>' + upnext.map(function (b) { return row(b, v); }).join('') + '</div>' : '') +
      '<div class="sec"><div class="chips" id="bdG">' + groups + '</div><div class="chips" id="bdS" style="margin-top:6px">' + shows + '</div></div>' +
      '<div class="sec" id="bdL">' + (body || '<div class="empty">NOTHING TO SHOW HERE YET</div>') + '</div></div>';
    var pg = el.querySelector('.pg'); pg.scrollTop = keep; if (window.HallHunt) HallHunt.banner();
    $('bdG').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; st.group = b.getAttribute('data-g'); st.open = null; draw(); });
    $('bdS').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; st.show = b.getAttribute('data-s'); draw(); });
    $('bdL').addEventListener('click', function (e) { var b = e.target.closest('.bdg'); if (!b) return; var k = b.getAttribute('data-c'); st.open = st.open === k ? null : k; draw(); });
  }
  window.HallBadges = {
    open: function (name) { if (name !== 'badges') return; built = true; draw(); var pg = document.querySelector('#badgeApp .pg'); if (pg) pg.scrollTop = 0; },
    total: ALL.length
  };
  P.onChange(function (what) { if (built && ($('pScreen') && $('pScreen').dataset.app === 'badges') && (what === 'connect' || what === 'scores' || what === 'cards' || what === 'stats')) draw(); });
})();
