/* ADMIN: a quiet link in the bottom-left corner opens a password box, then the control room for THE HALL.
   The password is checked by the server (Cloudflare); the page only holds a short-lived token. The live numbers arrive through HallAdmin.setFeed(...). */
(function () {
  'use strict';
  var P = window.HallProfile; if (!P) return;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return (n == null || isNaN(n)) ? '—' : Math.floor(n).toLocaleString('en-US'); }
  function dur(sec) { if (sec == null || isNaN(sec)) return '—'; sec = Math.floor(sec); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + 'h ' : '') + (h || m ? m + 'm ' : '') + (h ? '' : s + 's'); }
  function hms(sec) { var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60); return (h ? h + ' h ' : '') + (m ? m + ' min' : (h ? '' : sec + ' s')); }

  var feed = null, handlers = {}, tick = 0;
  function stamp(ts) { try { return new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase(); } catch (e) { return ''; } }

  /* ---------- the link and the login box ---------- */
  var link = document.createElement('button'); link.className = 'adminlink'; link.type = 'button'; link.textContent = 'ADMIN'; link.setAttribute('aria-label', 'Administration'); document.body.appendChild(link);
  var shade = document.createElement('div'); shade.className = 'adm-shade'; shade.id = 'admShade'; document.body.appendChild(shade);

  function openLogin() {
    shade.innerHTML = '<div class="adm-login" role="dialog" aria-label="Administration login"><button class="x" type="button" aria-label="Close">&times;</button><h3 class="gold">ADMIN</h3><p>PASSWORD REQUIRED</p><input id="admPw" type="password" autocomplete="off" aria-label="Password" placeholder="&middot; &middot; &middot; &middot; &middot; &middot;"><button class="go" type="button">ENTER</button><div class="err" id="admErr"></div></div>';
    shade.classList.add('open'); var inp = $('admPw'); setTimeout(function () { inp.focus(); }, 30);
    shade.querySelector('.x').addEventListener('click', close);
    var busy = false;
    function submit() {
      if (busy || !inp.value) return; if (!window.HallNet) { $('admErr').textContent = 'THE SERVER IS NOT REACHABLE'; return; }
      busy = true; $('admErr').textContent = 'CHECKING…';
      HallNet.admin.login(inp.value).then(function () { busy = false; HallNet.admin.start(); openPanel(); }, function (e) { busy = false; inp.value = ''; $('admErr').textContent = String((e && e.message) || 'COULD NOT SIGN IN').toUpperCase(); });
    }
    shade.querySelector('.go').addEventListener('click', submit); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }
  function close() { shade.classList.remove('open'); shade.innerHTML = ''; clearInterval(tick); if (window.HallNet) HallNet.admin.stop(); }
  shade.addEventListener('click', function (e) { if (e.target === shade) close(); });
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && shade.classList.contains('open')) close(); });
  link.addEventListener('click', function () { var ok = !!(window.HallNet && HallNet.admin.token()); if (ok) { HallNet.admin.start(); openPanel(); } else openLogin(); });

  /* ---------- the control room ---------- */
  function worksCards() {
    var c = P.config, s = c.sight, pk = c.pack, hp = c.hp, ht = c.heart;
    var items = [
      ['SPEED CLIMB', '+' + c.climb.pct + '% every ' + hms(c.climb.everySec) + ' alive, compounding, no cap'],
      ['CARD SIGHTING', 'one every ' + hms(s.everySec) + ' alive; jump to collect'],
      ['TIME UNLOCKS (TIME ALIVE IN ONE RUN)', P.tiers.map(function (t, i) { return t.name + ' ' + (s.locksSec[i] ? hms(s.locksSec[i]) : 'from the start'); }).join(' · ')],
      ['SIGHTING LOTTERY', P.tiers.map(function (t, i) { return t.name + ' ' + s.odds[i] + '%'; }).join(' · ') + ' (a sighting is always a new card; duplicates come from stagger cards)'],
      ['STAGGER CARDS', 'a duplicate of a card you own (same lottery, only rarities you own): first at ' + hms(c.stagger.firstSec) + ', then every ' + hms(c.stagger.everySec)],
      ['FOIL PIECES', 'a glowing half of a card after ' + hms(c.foil.firstSec) + ' of total play, then every ' + hms(c.foil.everySec) + ' of total play; 240 pieces; about 1 drop in 30 is both halves; rare cards come less often'],
      ['PLAYING FOR REAL (NFT RULE)', '5+ Mimu On Ape NFTs (in the Glyph wallet or delegated to it on delegate.xyz v2) to have runs saved and ranked; under 5 sees the demo run only (no Marketplace, texts, mail, Giving or X bonus), is never ranked and cannot be given to. 10+ NFTs: 1 random foil card, then 1 more per 10, up to 20 at 200. Foil cards are kept for good. One holding wallet counts for one game account at a time; NFTs that already earned foil never earn it again'],
      ['COIN MAGNET', 'at ' + hms(c.items.magnet.firstSec) + ' alive, then every ' + hms(c.items.magnet.everySec) + '; coins fly in for ' + c.items.magnet.durSec + ' s (your lane and the lanes beside you)'],
      ['COIN MULTIPLIER', 'a chain of ' + c.items.multi.chips + ' chips every ' + hms(c.items.multi.periodSec) + ' from ' + hms(c.items.multi.firstSec) + '; each adds a level up to x' + c.items.multi.max + ', a level lasts ' + c.items.multi.levelSec + ' s, a ' + hms(c.items.multi.cooldownSec) + ' cooldown after x' + c.items.multi.max],
      ['PHONE BATTERY', 'starts at ' + c.items.battery.start + '%, loses ' + c.items.battery.drainPerMin + '% a minute; a green battery gives +' + c.items.battery.gain + '% at ' + hms(c.items.battery.firstSec) + ', then every ' + hms(c.items.battery.everySec) + '; at 0% the run ends'],
      ['THE PACK', 'first at ' + hms(pk.firstSec) + ', then every ' + hms(pk.everySec) + '; run into it: ' + pk.slowPct + '% slower for ' + pk.slowSec + ' s, no other bonus'],
      ['RED HEART', 'first at ' + hms(ht.firstSec) + ', then every ' + hms(ht.everySec) + ' alive, in a random lane; run into it (no jump) to get ' + ht.restoreSeg + ' of the ' + hp.segments + ' health segments back, never above full. Not a card, no points. The server allows about 2 extra box hits per heart before TOO_MANY_HITS'],
      ['HEALTH', hp.segments + ' segments. Plain box ' + hp.dmg.plain + ' (3 hits), blue ' + hp.dmg.blue + ' (2 hits), red ' + hp.dmg.red + ' (1 hit). It only comes back from the red heart'],
      ['DISTANCE POINTS', '20 points per game unit (one unit is about 2.9 meters), about 11,000 a mile; a 20 minute run is about 205,000'],
      ['DECK COMPLETE BONUS', 'a one-time 100,000 when the whole Regular deck (120) is collected and 250,000 when the whole Foil deck (120) is made; part of the lifetime total, not spendable points'],
      ['SCORING', 'a run scores distance points + ' + c.coinPoints + ' points per coin (a multiplier does not change that); every run adds to the lifetime total'],
      ['LIFETIME TOTAL', 'distance points + coin points (' + c.coinPoints + ' per coin) + the coins the player holds + 1,000 per 1% of the Regular deck + 1,000 per 1% of the Foil deck + 100,000 for a complete Regular deck + 250,000 for a complete Foil deck + X bonus points. The Leaderboard ranks by it and the Top 5 shows the five highest'],
      ['COINS', 'every coin adds to the coin count (a multiplier counts each coin x2 to x5) and the coin count is added to the lifetime total, on top of the ' + c.coinPoints + ' points each coin already gave; coins can only be given to other players in the Giving, after the Hall run'],
      ['MARKETPLACE', 'players sell their duplicate cards face up to each other for points at a price the seller sets (never coins, up to 50 listings each)'],
      ['X BONUS', 'a player posts the picture on X (tagging @mimuonape), pastes the link, and earns 50,000 points every 12 hours; the first claim opens after their first run; the server checks each post'],
      ['THE CAMPAIGN', '14-day Hall run from Monday Oct 26, then a 48-hour Giving, then the Top 5: the five highest lifetime totals of all time'],
      ['EXTRA LIFE', 'after a crash, one extra life per run for ' + Math.round(c.life.share * 100) + '% of the player\'s points (not coins); free when the player has no points yet (a first run); crash again and the run ends'],
      ['NO PAUSE', 'leaving the game in any way ends the run'],
      ['SAVING', P.isSignedIn() ? 'signed in: runs, cards, coins and messages are saved' : 'nobody signed in: demo runs, nothing saved, nothing ranked']
    ];
    return items.map(function (x) { return '<div class="wk"><small>' + x[0] + '</small><b>' + esc(x[1]) + '</b></div>'; }).join('');
  }
  function cardBars() {
    var cs = P.cards(), total = cs.length || 120, f = feed || {}, bt = f.cardsByTier || [];
    var tiers = P.tiers.map(function (t, i) { var n = t.count || 0, found = bt[i]; return '<div class="cb2"><span>' + t.name.toUpperCase() + '</span><div class="tr"><i style="width:' + (n / total * 100) + '%;background:' + (t.grad || t.color) + '"></i></div><span class="ct">' + n + ' · ' + Math.round(n / total * 100) + '%' + (found != null ? ' · ' + fmt(found) + ' found' : '') + '</span></div>'; }).join('');
    var fams = P.families.map(function (fm) { var n = fm.count || 0; return '<div class="cb2"><span>' + fm.name.toUpperCase() + '</span><div class="tr"><i style="width:' + (n / total * 100) + '%;background:#d9ac5c"></i></div><span class="ct">' + n + ' · ' + Math.round(n / total * 100) + '%</span></div>'; }).join('');
    return '<div class="cardbars">' + tiers + '</div><div style="height:16px"></div><div class="cardbars">' + fams + '</div>';
  }
  function liveRows() {
    var rows = [], live = (window.HallRunner && HallRunner.live) ? HallRunner.live() : null, i;
    if (feed && feed.live) feed.live.slice(0, 9).forEach(function (r) { rows.push({ name: r.name, score: r.score, alive: r.alive, cards: r.cards }); });
    else if (live && live.mode === 'run') rows.push({ name: 'THIS DEVICE (DEMO)', score: live.score, alive: live.alive, cards: live.cards, you: true });
    var out = '<div class="l9 head"><span>#</span><span>RUNNER</span><span class="r">SCORE</span><span class="r">ALIVE</span><span class="r hide-m">CARDS</span></div>';
    for (i = 0; i < 9; i++) { var r = rows[i]; out += r ? '<div class="l9' + (r.you ? ' you' : '') + '"><span class="n">' + (i + 1) + '</span><span>' + esc(r.name) + '</span><span class="r">' + fmt(r.score) + '</span><span class="r">' + dur(r.alive) + '</span><span class="r hide-m">' + fmt(r.cards) + '</span></div>' : '<div class="l9 empty"><span class="n">' + (i + 1) + '</span><span>· · ·</span><span class="r">—</span><span class="r">—</span><span class="r hide-m">—</span></div>'; }
    return out;
  }
  function spark(a) {
    if (!a || a.length < 2) return '<svg class="sp" viewBox="0 0 100 24" preserveAspectRatio="none"><line x1="0" y1="12" x2="100" y2="12" stroke-dasharray="3 4"/></svg>';
    var mx = Math.max.apply(null, a), mn = Math.min.apply(null, a), rg = (mx - mn) || 1;
    var pts = a.map(function (v, i) { return (i / (a.length - 1) * 100).toFixed(1) + ',' + (22 - (v - mn) / rg * 20).toFixed(1); }).join(' ');
    return '<svg class="sp" viewBox="0 0 100 24" preserveAspectRatio="none"><polyline points="' + pts + '"/></svg>';
  }
  /* ---------- the live runs frame: red when nobody is playing, green when somebody is ---------- */
  function liveRuns() {
    var rows = [], dev = (window.HallRunner && HallRunner.live) ? HallRunner.live() : null;
    if (feed && feed.live) feed.live.forEach(function (r) { rows.push(r); });
    else if (dev && dev.mode === 'run') rows.push({ name: 'THIS DEVICE (DEMO)', score: dev.score, alive: dev.alive, cards: dev.cards, coins: dev.coins, hp: dev.hp, slow: dev.slow, you: true });
    rows.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
    return rows;
  }
  function mmss(sec) { sec = Math.max(0, Math.floor(sec)); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + (m < 10 ? '0' : '') + m : m) + ':' + (s < 10 ? '0' : '') + s; }
  function runFacts(r) {
    var c = P.config, s = c.sight, pk = c.pack, al = r.alive || 0, i, tier = 0;
    for (i = 0; i < s.locksSec.length; i++) if (al >= s.locksSec[i]) tier = i;
    var climb = Math.pow(1 + c.climb.pct / 100, al / c.climb.everySec);
    var nextCard = s.everySec - (al % s.everySec);
    var nextPack = al < pk.firstSec ? pk.firstSec - al : pk.everySec - ((al - pk.firstSec) % pk.everySec);
    var hp = r.hp == null ? null : Math.max(0, Math.min(hp0(c), r.hp));
    return { tier: P.tiers[tier] ? P.tiers[tier].name : '—', climb: Math.round((climb - 1) * 1000) / 10, nextCard: nextCard, nextPack: nextPack, hp: hp, segs: hp0(c) };
  }
  function hp0(c) { return c.hp.segments || 6; }
  function hpBar(v, n) { var o = '<span class="hpb">', i; for (i = 0; i < n; i++) o += '<i class="' + (v != null && i < v ? 'on' : '') + '"></i>'; return o + '</span>'; }
  function runRow(r, i) {
    var f = runFacts(r), speedTxt = r.speed != null ? 'x' + (Math.round(r.speed * 100) / 100) : '+' + f.climb + '%';
    return '<div class="lr' + (r.you ? ' you' : '') + '"><div class="lrt"><span class="n">' + (i + 1) + '</span><b>' + esc(r.name || 'RUNNER') + '</b><span class="lsc">' + fmt(r.score) + '</span></div>' +
      '<div class="lrc"><span><small>ALIVE</small>' + mmss(r.alive) + '</span><span><small>SPEED CLIMB</small>' + speedTxt + '</span><span><small>HEALTH</small>' + hpBar(f.hp, f.segs) + '</span><span><small>COINS</small>' + fmt(r.coins) + '</span><span><small>CARDS</small>' + fmt(r.cards) + '</span>' +
      '<span><small>TIER OPEN</small>' + esc(f.tier) + '</span><span><small>NEXT CARD IN</small>' + mmss(f.nextCard) + '</span><span><small>NEXT PACK IN</small>' + mmss(f.nextPack) + '</span><span><small>STATE</small>' + (r.slow ? '<em class="slw">SLOWED BY PACK</em>' : 'FULL SPEED') + '</span>' +
      (r.best != null ? '<span><small>BEST RUN</small>' + fmt(r.best) + '</span>' : '') + (r.lifetime != null ? '<span><small>LIFETIME</small>' + fmt(r.lifetime) + '</span>' : '') + '</div></div>';
  }
  function paintLive(id) {
    var el = $(id); if (!el) return;
    var all = liveRuns(), rows = all.slice(0, 9), on = all.length > 0, i;
    var sum = function (k) { return all.reduce(function (a, r) { return a + (r[k] || 0); }, 0); };
    var top = all.length ? Math.max.apply(null, all.map(function (r) { return r.score || 0; })) : null, longest = all.length ? Math.max.apply(null, all.map(function (r) { return r.alive || 0; })) : null;
    var stats = [['RUNNING NOW', fmt(all.length)], ['TOP LIVE SCORE', top == null ? '—' : fmt(top)], ['LONGEST ALIVE', longest == null ? '—' : mmss(longest)], ['AVERAGE ALIVE', all.length ? mmss(sum('alive') / all.length) : '—'], ['COINS IN PLAY', fmt(sum('coins'))], ['CARDS FOUND NOW', fmt(sum('cards'))], ['SLOWED BY PACK', fmt(all.filter(function (r) { return r.slow; }).length)]];
    var html = '<div class="lbh"><span class="lbd"></span><div><h3>' + (on ? fmt(all.length) + (all.length === 1 ? ' RUNNER' : ' RUNNERS') + ' PLAYING NOW' : 'NO ONE IS PLAYING') + '</h3><div class="lbs">TOP 9 LIVE RUNS &middot; ' + (feed && feed.live ? 'LIVE FEED' : 'THIS DEVICE ONLY UNTIL CLOUDFLARE IS CONNECTED') + '</div></div></div>' +
      '<div class="lbst">' + stats.map(function (x) { return '<div><small>' + x[0] + '</small><b>' + x[1] + '</b></div>'; }).join('') + '</div><div class="lrs">';
    for (i = 0; i < 9; i++) html += rows[i] ? runRow(rows[i], i) : '<div class="lr empty"><div class="lrt"><span class="n">' + (i + 1) + '</span><b>&middot; &middot; &middot; WAITING FOR A RUNNER</b><span class="lsc">—</span></div></div>';
    html += '</div>';
    var rec = (feed && feed.recent) || [];
    html += '<div class="lbr"><h4>JUST FINISHED</h4>' + (rec.length ? rec.slice(0, 5).map(function (x) { return '<div class="lbf"><b>' + esc(x.name) + '</b><span>' + fmt(x.score) + ' PTS</span><span>' + mmss(x.alive) + ' ALIVE</span><span>' + fmt(x.cards) + ' CARDS</span><span>' + fmt(x.coins) + ' COINS</span><em>' + stamp(x.ts) + '</em></div>'; }).join('') : '<div class="lbf none">NO FINISHED RUNS TO SHOW YET</div>') + '</div>';
    el.className = 'livebox ' + (on ? 'on' : 'off'); el.innerHTML = html;
  }
  /* ---------- the CARDS page: real card pictures stand for every section ---------- */
  var EXAMPLES = { 1: '001', 2: '005', 3: '009', 4: '008', 5: '049' };
  function tierCards() {
    var total = (P.cards && P.cards().length) || 120;
    return '<div class="ctiers">' + P.tiers.map(function (t, i) {
      var bg = t.grad || t.color;
      return '<div class="ctier" style="--c:' + t.color + ';--g:rgba(' + (t.glow || '255,255,255') + ',.5)"><div class="cimg"><img src="assets/game/cards/ex/' + EXAMPLES[t.n] + '.webp" alt="' + esc(t.name) + ' example card" loading="lazy"><span class="cct">' + t.count + '</span></div>' +
        '<b>' + esc(t.name.toUpperCase()) + '</b><em>' + Math.round(t.count / total * 100) + '% OF THE DECK</em><div class="cbar"><i style="width:' + (t.count / total * 100) + '%;background:' + bg + '"></i></div><small data-tf="' + i + '">FOUND —</small></div>';
    }).join('') + '</div>';
  }
  function famCards() {
    var cs = P.cards ? P.cards() : [], total = cs.length || 120;
    return '<div class="cfams">' + P.families.map(function (fm) {
      var mine = cs.filter(function (c) { return c.family === fm.key; }), pick = [mine[0], mine[Math.floor(mine.length / 2)], mine[mine.length - 1]].filter(Boolean);
      return '<div class="cfam"><div class="cfan">' + pick.map(function (c, k) { return '<img class="f' + k + '" src="' + esc(c.file) + '" alt="' + esc(c.name) + '" loading="lazy">'; }).join('') + '</div><b>' + esc(fm.name.toUpperCase()) + '</b><em>' + fm.count + ' CARDS &middot; ' + Math.round(fm.count / total * 100) + '%</em><div class="cbar"><i style="width:' + (fm.count / total * 100) + '%;background:#d9ac5c"></i></div></div>';
    }).join('') + '</div>';
  }
  function deckGrid() {
    var cs = P.cards ? P.cards() : [];
    var filt = '<div class="cfilt" role="group" aria-label="Show one rarity"><button type="button" class="on" data-tf2="0">ALL <b>' + cs.length + '</b></button>' + P.tiers.map(function (t, i) { return '<button type="button" data-tf2="' + (i + 1) + '" style="--c:' + t.color + '"><i></i>' + esc(t.name.toUpperCase()) + ' <b>' + cs.filter(function (c) { return c.tier === i + 1; }).length + '</b></button>'; }).join('') + '</div>';
    return filt + '<div class="cgrid" data-f="0">' + cs.map(function (c) {
      var t = P.tiers[c.tier - 1] || P.tiers[0];
      return '<div class="cth" data-t="' + c.tier + '" data-cn="' + c.n + '" style="--c:' + t.color + '" title="#' + c.n + ' ' + esc(c.name) + ' · ' + esc(t.name) + '"><img src="' + esc(c.file) + '" alt="" loading="lazy"><span>' + c.n + '</span></div>';
    }).join('') + '</div><div class="clg">' + P.tiers.map(function (t) { return '<span><i style="background:' + (t.grad || t.color) + '"></i>' + esc(t.name.toUpperCase()) + '</span>'; }).join('') + '</div>';
  }
  function paintCardsPage() {
    var f = feed || {}, bt = f.cardsByTier || [], cc = f.cardCounts || {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-tf]'), function (el) { var v = bt[+el.getAttribute('data-tf')]; el.textContent = 'FOUND ' + (v == null ? '—' : fmt(v)); });
    Array.prototype.forEach.call(document.querySelectorAll('.cth[data-cn]'), function (el) { var v = cc[el.getAttribute('data-cn')]; el.classList.toggle('hot', v != null && v > 0); var b = el.querySelector('span'); b.textContent = v ? v : el.getAttribute('data-cn'); });
  }
  /* ---------- the OVERVIEW page: a mind map to learn the control room, then everything about the visitors ---------- */
  var MAP = [
    ['WATCH', 'g1', [['ov', 'OVERVIEW', 'visitors, funnel and site health'], ['live', 'LIVE RUNS', 'who is playing right now'], ['flag', 'FLAGGED RUNS', 'runs held for review: approve, deny or ban'], ['board', 'PLAYER BOARD', 'every player, points and deck completion'], ['cards', 'CARDS', 'the 120 cards, pictured'], ['wanted', 'LAUNCH A WANTED CARD', 'pick a card, set the hours and launch it']]],
    ['TALK', 'g2', [['msg', 'HYPE TEXTS', 'text players as HYPE and read their replies'], ['utx', 'USER TEXTS', 'every text players send each other, to moderate'], ['mail', 'MIMU MAIL', 'send announcements as MIMU (outgoing only)']]],
    ['MONEY', 'g3', [['eco', 'ECONOMY', 'coins, points, the Marketplace and the Giving'], ['xbonus', 'X BONUS', 'who posted on X, every post link and its check']]],
    ['SECRET', 'g5', [['egg', 'EASTER EGG', 'the hidden phone number puzzle: the order, the number and who found it'], ['sec', 'SECURITY', 'admin login attacks: wrong guesses, many visitors at once, who is locked out']]],
    ['LEARN', 'g4', [['rules', 'GAME RULES', 'the live game numbers'], ['site', 'SITE GUIDE', 'every page and icon'], ['sys', 'SYSTEMS', 'how each part works']]]
  ];
  function mindMap() {
    return '<div class="box mmbox"><h4>HOW TO USE THE CONTROL ROOM</h4>' +
      '<div class="mm"><div class="mmc"><i></i><b>CONTROL ROOM</b><small>PRESS ANY BOX TO JUMP THERE</small></div><div class="mmrail"></div><div class="mmgs">' +
      MAP.map(function (g) { return '<div class="mmg ' + g[1] + '"><div class="mmh">' + g[0] + '</div>' + g[2].map(function (l) { return '<button type="button" class="mml" data-go="' + l[0] + '"><b>' + l[1] + '</b><span>' + l[2] + '</span></button>'; }).join('') + '</div>'; }).join('') + '</div></div>' +
      '<ol class="mmsteps"><li><b>SIGN IN</b> with the ADMIN link at the bottom left of the site. Three wrong tries lock it for 30 seconds.</li>' +
      '<li><b>MOVE AROUND</b> with the menu (left side, or the strip at the top on a phone), or press the keys 1 to 9. Esc closes the control room.</li>' +
      '<li><b>READ THE LIGHTS</b> at the top: green means connected, gray means waiting. The Live Runs frame is red when nobody plays and green when somebody does.</li>' +
      '<li><b>NO NUMBERS YET?</b> Dashes mean the live feed is not connected. The system check and the guide pages are always real.</li>' +
      '<li><b>SEND</b> texts as HYPE (you can read and answer replies there) and announcement emails as MIMU (outgoing only). They say NOT CONNECTED until the server is live.</li>' +
      '<li><b>STALE PAGE?</b> Press Ctrl+Shift+R once to load the newest files. LOG OUT under the menu signs you out.</li></ol></div>';
  }
  function bars24(a) {
    var mx = Math.max.apply(null, (a || []).concat([1])), out = '', i, v;
    for (i = 0; i < 24; i++) { v = a && a[i] != null ? a[i] : null; out += '<span title="' + (i % 12 || 12) + (i < 12 ? ' AM' : ' PM') + (v != null ? ' · ' + fmt(v) : '') + '"><i style="height:' + (v == null ? 4 : Math.max(4, v / mx * 100)) + '%"></i><em>' + (i % 6 === 0 ? (i % 12 || 12) + (i < 12 ? 'A' : 'P') : '') + '</em></span>'; }
    return '<div class="hbars">' + out + '</div>';
  }
  function rankList(rows, ph) {
    rows = (rows || []).slice(0, 8); var mx = Math.max.apply(null, rows.map(function (r) { return r.n || 0; }).concat([1]));
    if (!rows.length) return '<div class="rk none">' + ph + '</div>';
    return rows.map(function (r) { return '<div class="rk"><span>' + esc(r.name) + '</span><div class="tr"><i style="width:' + ((r.n || 0) / mx * 100) + '%"></i></div><b>' + fmt(r.n) + '</b></div>'; }).join('');
  }
  var FUN = [['loaded', 'CLICKED TO LOAD'], ['finished', 'FINISHED LOADING'], ['entered', 'ENTERED THE HALL'], ['unlocked', 'UNLOCKED THE PHONE'], ['played', 'STARTED A RUN'], ['finishedRun', 'FINISHED A RUN'], ['signedIn', 'SIGNED IN']];
  function funnel(f) {
    var base = f && f.loaded ? f.loaded : 0;
    return FUN.map(function (s, i) { var v = f ? f[s[0]] : null, pct = v != null && base ? Math.round(v / base * 100) : null, prev = i && f && f[FUN[i - 1][0]] ? Math.round((v || 0) / f[FUN[i - 1][0]] * 100) : null;
      return '<div class="fn"><span>' + s[1] + '</span><div class="tr"><i style="width:' + (pct == null ? 0 : pct) + '%"></i></div><b>' + (v == null ? '—' : fmt(v)) + '</b><em>' + (pct == null ? '' : pct + '%' + (prev != null && i ? ' · ' + prev + '% OF PREVIOUS' : '')) + '</em></div>'; }).join('');
  }
  function visTiles() {
    var v = (feed && feed.visitors) || {}, none = feed ? '' : 'WAITING FOR LIVE FEED', sr = (feed && feed.series) || {}, signed = v.signedInShare != null ? v.signedInShare : (v.funnel && v.funnel.loaded ? Math.round((v.funnel.signedIn || 0) / v.funnel.loaded * 100) : null);
    var t = [
      ['VISITORS TODAY', fmt(v.today), v.newToday != null ? fmt(v.newToday) + ' new · ' + fmt(v.returningToday) + ' returning' : none, sr.visitors],
      ['ON THE SITE NOW', fmt(v.now), v.now != null ? 'right now' : none],
      ['THIS WEEK', fmt(v.week), v.week != null ? 'last 7 days' : none],
      ['THIS MONTH', fmt(v.month), v.month != null ? 'last 30 days' : none],
      ['ALL TIME', fmt(v.total), v.total != null ? 'every visitor' : none],
      ['AVERAGE VISIT', v.avgSession != null ? dur(v.avgSession) : '—', v.avgSession != null ? 'time on the site' : none],
      ['LEFT QUICKLY', v.bounce != null ? v.bounce + '%' : '—', v.bounce != null ? 'left without entering' : none],
      ['SIGNED IN', signed == null ? '—' : signed + '%', signed != null ? 'of visitors' : none],
      ['PLAYED A RUN', v.funnel && v.funnel.loaded ? Math.round((v.funnel.played || 0) / v.funnel.loaded * 100) + '%' : '—', v.funnel ? 'of visitors' : none],
      ['RETURN RATE', v.today ? Math.round((v.returningToday || 0) / v.today * 100) + '%' : '—', v.today ? 'came back today' : none]
    ];
    return t.map(function (x) { return '<div class="tile"><small>' + x[0] + '</small><b>' + x[1] + '</b><em>' + esc(x[2]) + '</em>' + (x[3] ? spark(x[3]) : '') + '</div>'; }).join('');
  }
  function thisBrowser() {
    var n = navigator, ua = n.userAgent || '', tz = '', dark = false, touch = (n.maxTouchPoints || 0) > 0;
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
    try { dark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
    var br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Other', os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
    var rows = [['BROWSER', br + ' on ' + os], ['SCREEN', window.screen.width + ' x ' + window.screen.height + ' · window ' + window.innerWidth + ' x ' + window.innerHeight], ['DEVICE TYPE', touch && window.innerWidth < 820 ? 'PHONE OR TABLET' : 'COMPUTER'], ['PIXEL RATIO', String(window.devicePixelRatio || 1)], ['LANGUAGE', n.language || '—'], ['TIME ZONE', tz || '—'], ['COLOR MODE', dark ? 'DARK' : 'LIGHT'], ['ONLINE', n.onLine ? 'YES' : 'NO'], ['PAGE LOADED', stamp(Date.now() - Math.round((window.performance && performance.now()) || 0))]];
    return '<div class="works">' + rows.map(function (r) { return '<div class="wk"><small>' + r[0] + '</small><b>' + esc(r[1]) + '</b></div>'; }).join('') + '</div>';
  }
  function visPanels() {
    var v = (feed && feed.visitors) || {}, hint = feed ? 'NO DATA YET' : 'WAITING FOR THE LIVE FEED';
    var days = v.byDay || [];
    return '<div class="cols2"><div class="box"><h4>VISITORS BY HOUR (LOS ANGELES)</h4>' + bars24(v.byHour) + '</div><div class="box"><h4>LAST 14 DAYS</h4>' + (days.length ? '<div class="dbars">' + days.slice(-14).map(function (d) { var mx = Math.max.apply(null, days.map(function (x) { return x.n || 0; }).concat([1])); return '<span title="' + esc(d.d) + ' · ' + fmt(d.n) + '"><i style="height:' + Math.max(4, (d.n || 0) / mx * 100) + '%"></i><em>' + esc(String(d.d).slice(-2)) + '</em></span>'; }).join('') + '</div>' : '<div class="rk none">' + hint + '</div>') + '</div></div>' +
      '<div class="box" style="margin-bottom:16px"><h4>THE VISITOR FUNNEL</h4><div class="fns">' + funnel(v.funnel) + '</div></div>' +
      '<div class="cols3"><div class="box"><h4>WHERE FROM</h4>' + rankList(v.countries, hint) + '</div><div class="box"><h4>HOW THEY ARRIVED</h4>' + rankList(v.referrers, hint) + '</div><div class="box"><h4>DEVICES</h4>' + rankList(v.devices, hint) + '</div></div>' +
      '<div class="cols3"><div class="box"><h4>BROWSERS</h4>' + rankList(v.browsers, hint) + '</div><div class="box"><h4>TOP BAR TABS OPENED</h4>' + rankList(v.tabs, hint) + '</div><div class="box"><h4>PHONE APPS OPENED</h4>' + rankList(v.apps, hint) + '</div></div>';
  }
  /* ---------- the top of the overview: the wanted card shortcut ---------- */
  function paintWNow() {
    var el = $('admWNow'); if (!el) return; var w = feed && feed.wanted && feed.wanted.active, sig = w ? 'live' + w.id : 'none'; if (el.getAttribute('data-s') === sig) return; el.setAttribute('data-s', sig);
    el.innerHTML = '<div class="wnt"><small>' + (w ? 'A WANTED CARD IS LIVE' : 'WANTED CARD') + '</small><b>' + (w ? esc(w.name.toUpperCase()) + ' #' + String(w.card).padStart(3, '0') : 'LAUNCH A WANTED CARD NOW') + '</b><span>' + (w ? 'See the timer, or end it, on the Cards page.' : 'Pick a card, choose how many hours, and every player gets the email.') + '</span></div><button type="button" class="wgo" data-go="cards">' + (w ? 'OPEN THE CARDS PAGE' : 'GO TO LAUNCH') + ' &rarr;</button>';
  }
  function ovHtml() {
    return '<section data-p="ov"><div class="wnow" id="admWNow"></div><div class="tiles vis" id="admVT"></div>' + mindMap() + (feed ? '' : '<div class="crnote">THE LIVE NUMBERS FILL IN WHEN CLOUDFLARE IS CONNECTED &middot; UNTIL THEN THE SYSTEM CHECK AND THIS BROWSER BOX ARE REAL</div>') +
      '<div id="admVis"></div>' +
      '<div class="box dbox"><h4>THE GAME AT A GLANCE</h4><div class="tiles" id="admTiles"></div></div>' +
      '<div class="cols2"><div class="box"><h4>SYSTEM CHECK</h4><div class="sys one" id="admSys"></div></div><div class="box"><h4>THIS BROWSER</h4>' + thisBrowser() + '</div></div>' +
      '<div class="box"><h4>ACTIVITY</h4><div class="acts" id="admAct"></div></div></section>';
  }
  /* ---------- PLAYER BOARD: an admin leaderboard of every player, with regular and foil deck completion ---------- */
  var bsort = 'total', bq = '', boardSig = '';
  function paintBoard() {
    var el = $('admBoardList'); if (!el) return; var all = ((feed && feed.board) || []).slice(), total = (P.cards && P.cards().length) || 120, q = bq.trim().toLowerCase(), now = Date.now();
    var sig = JSON.stringify([bsort, q, !!feed, all.length, all.map(function (r) { return [r.total, r.points, r.owned, r.foilCards, r.foilPieces, r.runs, r.lastSeen]; })]); if (sig === boardSig) return; boardSig = sig;
    var rows = all.filter(function (r) { return !q || String(r.name).toLowerCase().indexOf(q) >= 0; });
    var key = { total: 'total', points: 'points', regular: 'owned', foil: 'foilCards', runs: 'runs', best: 'best', coins: 'coins', seen: 'lastSeen' }[bsort] || 'total';
    rows.sort(function (a, b2) { return (b2[key] - a[key]) || ((b2.total || 0) - (a.total || 0)); });
    $('admBoardH').textContent = 'PLAYER BOARD \u00b7 ' + all.length + (all.length === 1 ? ' PLAYER' : ' PLAYERS');
    function th(k, t) { return '<button type="button" class="bsort' + (bsort === k ? ' on' : '') + '" data-bs="' + k + '">' + t + (bsort === k ? ' &#9660;' : '') + '</button>'; }
    var h = '<div class="dtab btab"><div class="dh"><span>#</span><span>PLAYER</span>' + th('total', 'LIFETIME TOTAL') + th('best', 'BEST RUN') + th('coins', 'COINS') + th('regular', 'REGULAR DECK') + th('foil', 'FOIL DECK') + th('runs', 'RUNS') + th('seen', 'LAST SEEN') + '</div>';
    if (!rows.length) h += '<div class="rk none">' + (feed ? (all.length ? 'NO PLAYER MATCHES THAT SEARCH' : 'NO PLAYERS HAVE SIGNED IN YET') : 'WAITING FOR THE LIVE FEED') + '</div>';
    rows.forEach(function (r, i) {
      var rp = Math.round(r.owned / total * 1000) / 10, fpc = Math.round(r.foilCards / total * 1000) / 10;
      h += '<div class="dr' + (r.banned ? ' banned' : '') + '"><span>' + (i + 1) + '</span><span>' + esc(r.name) + (r.banned ? ' <em>BANNED</em>' : '') + '</span><span>' + fmt(r.total != null ? r.total : r.points) + '<small>POINTS ' + fmt(r.points) + '</small></span><span>' + fmt(r.best) + '</span><span>' + fmt(r.coins) + '</span>' +
        '<span class="bdeck">' + r.owned + '/' + total + ' &middot; ' + rp + '%<i class="bb"><i style="width:' + Math.min(100, rp) + '%"></i></i></span>' +
        '<span class="bdeck foil">' + r.foilCards + '/' + total + ' &middot; ' + fpc + '%<i class="bb"><i style="width:' + Math.min(100, fpc) + '%"></i></i><small>' + r.foilPieces + ' of ' + (total * 2) + ' pieces</small></span>' +
        '<span>' + fmt(r.runs) + '</span><span>' + (r.lastSeen ? stamp(r.lastSeen) : '\u2014') + '</span></div>';
    });
    el.innerHTML = h + '</div>';
  }
  /* ---------- FLAGGED RUNS: runs the server held back because something did not add up ---------- */
  var FLAG_TEXT = {
    TIME_MISMATCH: 'The time the run claims does not match the clock on the server.', DISTANCE_TOO_FAR: 'More distance than the speed limit allows for that time.', SCORE_TOO_HIGH: 'The score is higher than distance and coins can explain.',
    COINS_TOO_HIGH: 'More coins than a run could have picked up.', INPUT_TOO_FAST: 'Jumps, slides or lane changes faster than a hand can do.', TOO_MANY_HITS: 'More box hits than a run can survive.', BOXES_TOO_MANY: 'More boxes cleared than the road holds.',
    PACK_TOO_EARLY: 'A black pack was collected before the first one could appear.', TOO_MANY_CARDS: 'More cards than the sighting timetable allows.', TIER_NOT_OPEN: 'A card of a rarity that was not open yet at that time.', UNKNOWN_CARD: 'A card number that does not exist.',
    BOT_RHYTHM: 'The lane changes came at an almost perfectly even beat, like a metronome (a script, people are never this steady). Jumping and sliding are never counted, so holding a key or spamming taps cannot cause this.', BOT_REPEAT: 'The move rhythm is the same as an earlier run by this player, to the decimal (a replayed script).', LOOKS_LIKE_BANNED: 'A very steady move rhythm with the same average beat as a run by a banned player: the same script on a new account. Held for you to check.', BOT_ONE_LANE: 'WATCH ONLY: a run of a minute or more that jumps a lot but never changes lane (a script jumping in place). Not held, just noted.', BOT_NO_TIMING: 'A long run with lots of moves but no move timing sent (a result sent without playing).', BOT_PERFECT: 'WATCH ONLY: a long run with no hits at all. Not held, just noted.', NO_INPUT: 'A long run with no moves at all (a bot or an idle script).', FEW_HEARTBEATS: 'The game did not report in while it ran (a result sent without playing).', BATTERY_IMPOSSIBLE: 'A run longer than the phone battery allows (too few batteries collected).', LIFE_NOT_PURCHASED: 'An extra life was used without being bought.'
  };
  var flagSig = '', flagTab = 'f';
  function flagCard(r, held) {
    var e = r.extra || {}, miles = ((r.distance || 0) / 1609.34).toFixed(2), reasons = (r.flags || []).map(function (f) { return '<li><b>' + esc(f.code) + '</b><span>' + esc(f.note || FLAG_TEXT[f.code] || '') + '</span></li>'; }).join('');
    return '<div class="fgc' + (held ? '' : ' done') + '"><div class="fgh"><b>' + esc(r.name) + '</b><span>' + esc(String(r.address || '').slice(0, 6) + '…' + String(r.address || '').slice(-4)) + '</span><em>' + stamp(r.ts) + (r.banned ? ' · BANNED' : '') + (held ? '' : ' · ' + String(r.status).toUpperCase()) + '</em></div>' +
      '<div class="fgs"><span><small>SCORE</small>' + fmt(r.score) + '</span><span><small>TIME ALIVE</small>' + dur(r.alive) + '</span><span><small>COINS</small>' + fmt(r.coins) + '</span><span><small>DISTANCE</small>' + miles + ' MI</span><span><small>CARDS CLAIMED</small>' + (r.cards || []).length + '</span><span><small>JUMPS</small>' + fmt(e.jumps) + '</span><span><small>SLIDES</small>' + fmt(e.slides) + '</span><span><small>LANES</small>' + fmt(e.lanes) + '</span><span><small>BOXES CLEARED</small>' + fmt(e.boxesJumped) + '</span><span><small>HITS</small>' + fmt(e.hits) + '</span><span><small>PACKS</small>' + fmt(e.packs) + '</span><span><small>EXTRA LIFE</small>' + (e.extraLife ? 'YES' : 'NO') + '</span></div>' +
      '<ul class="fgr">' + (reasons || '<li><b>REVIEWED</b><span>This run was held and then reviewed.</span></li>') + '</ul>' +
      (held ? '<div class="fga"><button type="button" class="ok" data-fa="approve" data-r="' + esc(r.id) + '">APPROVE</button><button type="button" data-fa="remove" data-r="' + esc(r.id) + '">DENY</button><button type="button" class="bad" data-fa="ban" data-r="' + esc(r.id) + '">BAN</button><span class="fgn">APPROVE: the run counts &middot; DENY: the run is thrown away &middot; BAN: the player is removed</span></div>' : '') + '</div>';
  }
  /* the people who were banned: everything the server knows about them, why they were banned, and the wallets blocked with them */
  function banCard(b) {
    var r = b.runs || {}, so = b.social || {}, mi = b.mimus || {}, xa = b.x, co = b.cards || {};
    var kv = function (k, v) { return '<li><b>' + k + '</b><span>' + v + '</span></li>'; }, mono = function (a) { return '<span class="mono">' + esc(a) + '</span>'; };
    var why = (b.reasons || []).map(function (x) { return kv(esc(x.code) + ' &times; ' + fmt(x.runs) + (x.runs === 1 ? ' RUN' : ' RUNS'), esc(FLAG_TEXT[x.code] || '') + (x.example ? ' <em class="bex">Example: ' + esc(x.example) + '</em>' : '')); }).join('') +
      (b.secondRuns ? kv('SECOND RUN WHILE ONE WAS LIVE &times; ' + fmt(b.secondRuns), 'Started a new run while another was still running: several copies of the game going at the same time.') : '');
    var ident = kv('USERNAME', esc(b.name) + ' <em class="bex">The name the player signed in with through Glyph.</em>') + kv('WALLET', mono(b.address) + ' <em class="bex">The Glyph wallet that signs this account in. It is the account&rsquo;s one id.</em>') +
      kv('PROFILE PICTURE', b.picture ? '<img class="bpic" src="' + esc(b.picture) + '" alt="" referrerpolicy="no-referrer"> ' + mono(b.picture) : 'None') +
      kv('FIRST SIGN-IN', b.joined ? stamp(b.joined) : '') + kv('LAST SEEN', b.lastSeen ? stamp(b.lastSeen) : '') + kv('LAST DAY PLAYED', esc(b.lastDay || 'NO RUN YET') + ' &middot; DAY STREAK ' + fmt(b.streak)) +
      kv('X ACCOUNT', xa ? '@' + esc(xa.handle) + ' <em class="bex">Linked ' + stamp(xa.linkedAt) + ' &middot; ' + fmt(xa.posts) + ' posts counted &middot; ' + fmt(xa.points) + ' X points</em>' : 'Not linked');
    var src = (b.sources || []).length ? b.sources.map(function (s) { return kv(s.own ? 'OWN WALLET' : s.linked ? 'LINKED WALLET (SIGNED)' : 'DELEGATED FROM', mono(s.address) + ' <em class="bex">' + (s.peak ? fmt(s.peak) + ' Mimu On Ape counted' : 'no Mimus counted') + ' &middot; tied to this account ' + stamp(s.boundAt) + (s.blocked ? ' &middot; <b class="bblk">BLOCKED ' + stamp(s.blockedAt) + '</b>' : ' &middot; not blocked') + '</em>'); }).join('') : kv('NO WALLET', 'No Mimu On Ape wallet was tied to this account, so nothing was blocked.');
    var fr = (b.flaggedRuns || []).map(function (x) { return kv(stamp(x.ts) + ' &middot; ' + esc(String(x.status).toUpperCase()), esc((x.codes || []).join(', ')) + ' &middot; score ' + fmt(x.score) + ' &middot; ' + dur(x.alive) + (x.note ? ' <em class="bex">' + esc(x.note) + '</em>' : '')); }).join('');
    var lg = (b.log || []).map(function (x) { return kv(stamp(x.ts), esc(x.text)); }).join(''), cn = (b.counters || []).map(function (x) { return esc(x.k) + ' ' + fmt(x.v); }).join(' &middot; ');
    return '<div class="fgc ban"><div class="fgh"><b>' + esc(b.name) + '</b><span title="' + esc(b.address) + '">' + esc(String(b.address || '').slice(0, 6) + '\u2026' + String(b.address || '').slice(-4)) + '</span><em>BANNED ' + (b.bannedAt ? stamp(b.bannedAt) : '') + '</em></div>' +
      '<div class="bhd">WHO THEY ARE</div><ul class="fgr">' + ident + '</ul>' +
      '<div class="bhd">MIMU ON APE: HOLDINGS AND DELEGATED WALLETS</div><ul class="fgr">' + kv('MIMUS COUNTED', fmt(mi.count) + ' <em class="bex">At the last check' + (mi.checkedAt ? ' ' + stamp(mi.checkedAt) : '') + ' &middot; ' + fmt(mi.sources) + ' wallet' + (mi.sources === 1 ? '' : 's') + ' &middot; ' + fmt(mi.foilGranted) + ' free foil cards</em>') + src + '</ul>' +
      '<div class="bhd">THE NUMBERS</div><div class="fgs"><span><small>RUNS THAT COUNTED</small>' + fmt(r.counted) + '</span><span><small>RUNS HELD</small>' + fmt(r.held) + '</span><span><small>RUNS REMOVED</small>' + fmt(r.removed) + '</span><span><small>CANCELLED BY 2ND RUN</small>' + fmt(r.abandoned) + '</span><span><small>POINTS BEFORE BAN</small>' + fmt(b.points) + '</span><span><small>BEST RUN</small>' + fmt(r.best) + '</span><span><small>LONGEST RUN</small>' + dur(r.longest) + '</span><span><small>COINS EARNED</small>' + fmt(b.coins) + '</span><span><small>COIN BALANCE</small>' + fmt(b.balance) + '</span><span><small>CARDS COLLECTED</small>' + fmt(co.total) + ' (' + fmt(co.kinds) + ' DIFFERENT)</span><span><small>FOIL PIECES</small>' + fmt(co.foil) + '</span><span><small>TEXTS SENT / GOT</small>' + fmt(so.sent) + ' / ' + fmt(so.got) + '</span><span><small>MARKET LISTED / SOLD / BOUGHT</small>' + fmt(so.listed) + ' / ' + fmt(so.sold) + ' / ' + fmt(so.bought) + '</span><span><small>POINTS GIVEN / GOT</small>' + fmt(so.giftsOut) + ' / ' + fmt(so.giftsIn) + '</span></div>' +
      '<div class="bhd">WHY THEY WERE BANNED</div><ul class="fgr">' + (why || kv('BANNED BY THE TEAM', 'No automatic flags are recorded on this account.')) + '</ul>' +
      (fr ? '<div class="bhd">THEIR FLAGGED RUNS (NEWEST FIRST)</div><ul class="fgr">' + fr + '</ul>' : '') +
      (lg ? '<div class="bhd">ACTIVITY LOG LINES ABOUT THEM</div><ul class="fgr">' + lg + '</ul>' : '') +
      (cn ? '<div class="bhd">ALL COUNTERS</div><div class="bcn">' + cn + '</div>' : '') + '</div>';
  }  function paintFlag() {
    var el = $('admFlag'); if (!el) return; var f = (feed && feed.flagged) || { held: [], resolved: [], banned: [] }, n = $('admFlagN'); if (n) n.textContent = f.held.length ? '(' + f.held.length + ')' : '';
    var bans = f.banned || [];
    var sig = JSON.stringify([flagTab, f.held.map(function (r) { return r.id; }), f.resolved.map(function (r) { return r.id + r.status; }), !!feed, bans.map(function (b) { return [b.address, b.runs && b.runs.counted, b.runs && b.runs.held, b.secondRuns, (b.sources || []).map(function (s) { return s.address + (s.blocked ? 1 : 0); }), b.bannedAt, b.points, (b.log || []).length, b.mimus && b.mimus.count]; })]); if (sig === flagSig) return; flagSig = sig;
    var tabs = '<div class="cfilt ftabs">' + [['f', 'FLAGGED RUNS (' + f.held.length + ')'], ['b', 'BANNED (' + bans.length + ')'], ['w', 'WHAT GETS FLAGGED']].map(function (x) { return '<button type="button" data-ft="' + x[0] + '"' + (flagTab === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>'; }).join('') + '</div>', body;
    if (flagTab === 'b') {
      body = '<div class="box dbox"><h4>BANNED FOR CHEATING (' + bans.length + ')</h4><div class="hint" style="margin-bottom:12px">Everyone who was banned, and why. The reasons come from the checks the server ran on their runs. A banned player cannot play, text or trade, is hidden from every leaderboard and the Top 5, and the Mimu On Ape wallets behind the account are blocked, so the same Mimus cannot be moved to a new account.</div>' +
        (bans.length ? bans.map(banCard).join('') : '<div class="rk none">' + (feed ? 'NOBODY HAS BEEN BANNED.' : 'WAITING FOR THE LIVE FEED') + '</div>') + '</div>';
    } else if (flagTab === 'w') {
      body = '<div class="box dbox"><h4>WHAT GETS A RUN FLAGGED</h4><ul class="fgl">' + Object.keys(FLAG_TEXT).map(function (k) { return '<li><b>' + k + '</b><span>' + esc(FLAG_TEXT[k]) + '</span></li>'; }).join('') + '</ul></div>';
    } else {
      body = '<div class="box dbox"><h4>WAITING FOR YOUR REVIEW (' + f.held.length + ')</h4><div class="hint" style="margin-bottom:12px">A run is held, and does not count toward points, cards or badges, when the server finds a reason below. Decide from the run details on each card: APPROVE to count it, DENY to throw it away, or BAN the player.</div>' +
        (f.held.length ? f.held.map(function (r) { return flagCard(r, true); }).join('') : '<div class="rk none">' + (feed ? 'NO FLAGGED RUNS. EVERYTHING LOOKS CLEAN.' : 'WAITING FOR THE LIVE FEED') + '</div>') + '</div>' +
        '<div class="box dbox"><h4>RECENTLY REVIEWED</h4>' + (f.resolved.length ? f.resolved.map(function (r) { return flagCard(r, false); }).join('') : '<div class="rk none">NOTHING REVIEWED YET</div>') + '</div>';
    }
    var keep = el.scrollTop; el.innerHTML = tabs + body; el.scrollTop = keep;
  }
  /* ---------- WANTED CARD: pick a card in the deck, choose how long, launch ---------- */
  var wsel = null, wSig = '', wHours = 6, wMsg = '';
  function wantedStatus(w) { return w.status === 'collected' ? 'FOUND BY ' + esc(String(w.winner || 'A PLAYER').toUpperCase()) : w.status === 'ended' ? 'ENDED BY THE TEAM' : w.status === 'expired' ? 'EXPIRED, NOBODY FOUND IT' : 'LIVE'; }
  function wantedHtml() {
    var f = feed || {}, w = f.wanted || { active: null, history: [] }, act = w.active, sel = wsel ? P.card(wsel) : null, t = sel ? P.tiers[sel.tier - 1] : null, fam = sel ? P.families.filter(function (x) { return x.key === sel.family; })[0] : null, i, opts = '';
    for (i = 1; i <= 24; i++) opts += '<option value="' + i + '"' + (i === wHours ? ' selected' : '') + '>' + i + (i === 1 ? ' HOUR' : ' HOURS') + '</option>';
    var h = '<div class="wbox"><div class="wsel">' + (sel ? '<img src="' + esc(sel.file) + '" alt="' + esc(sel.name) + '"><div><b>' + esc(sel.name) + '</b><em>#' + String(sel.n).padStart(3, '0') + ' &middot; ' + esc(t.name.toUpperCase()) + ' &middot; ' + esc((fam ? fam.name : sel.family).toUpperCase()) + '</em></div>' : '<div class="wnone">CLICK ANY CARD IN THE DECK ABOVE TO SELECT IT</div>') + '</div>';
    h += '<div class="wred"><h5>LAUNCH A WANTED CARD</h5>';
    if (act) {
      var ac = P.card(act.card);
      h += '<div class="wlive"><img src="' + esc(ac ? ac.file : '') + '" alt=""><div><small>LIVE NOW</small><b>' + esc(act.name) + ' #' + String(act.card).padStart(3, '0') + '</b><em>' + esc(act.tier.toUpperCase()) + ' &middot; RUNS FOR ' + act.hours + (act.hours === 1 ? ' HOUR' : ' HOURS') + '</em><strong id="admWTimer">--:--:--</strong><span class="ph">' + (act.phase === 'dropped' ? 'DROPPED ON ' + esc(String(act.target).toUpperCase()) + ', WAITING FOR THEM TO RUN INTO IT' : 'WAITING: THE CARD DROPS AT A RANDOM MOMENT ON A LIVE RUNNER') + '</span><small>DROPS SO FAR: ' + fmt(act.attempts) + '</small></div></div><button type="button" class="end" id="admWEnd">END WANTED CARD</button><div class="wmsg" id="admWMsg">' + esc(wMsg) + '</div>';
    } else {
      h += '<div class="wform"><label for="admWH">HOW LONG IT RUNS</label><select id="admWH">' + opts + '</select><button type="button" class="launch" id="admWLaunch"' + (sel ? '' : ' disabled') + '>LAUNCH</button></div><div class="hint">ONE WANTED CARD AT A TIME. LAUNCHING SENDS A MIMU EMAIL TO EVERYONE WHO HAS SIGNED IN, SHOWING THE CARD WITH A LIVE COUNTDOWN. AT A RANDOM MOMENT THE CARD DROPS INTO THE RUN OF ONE PLAYER WHO IS RUNNING, AND IF THEY RUN INTO IT, IT GOES INTO THEIR DECK.</div><div class="wmsg" id="admWMsg">' + esc(wMsg) + '</div>';
    }
    h += '</div><div class="whist"><h5>WANTED CARD HISTORY</h5>' + ((w.history || []).length ? w.history.map(function (x) { return '<div class="whr"><b>' + esc(x.name) + ' #' + String(x.card).padStart(3, '0') + '</b><span>' + x.hours + 'H &middot; ' + stamp(x.launchedAt) + '</span><em class="' + x.status + '">' + wantedStatus(x) + '</em></div>'; }).join('') : '<div class="rk none">NO WANTED CARDS LAUNCHED YET</div>') + '</div></div>';
    return h;
  }
  function paintWanted() {
    var el = $('admWanted'); if (!el) return; var w = (feed && feed.wanted) || {}, sig = JSON.stringify([wsel, w.active && [w.active.id, w.active.phase, w.active.target, w.active.attempts], (w.history || []).map(function (x) { return x.id + x.status; }), wMsg]);
    if (sig !== wSig) { wSig = sig; el.innerHTML = wantedHtml(); var sh = $('admWH'); if (sh) sh.addEventListener('change', function () { wHours = +sh.value; }); }
    var tm = $('admWTimer'); if (tm && w.active) { var s = Math.max(0, Math.floor((w.active.endsAt - Date.now()) / 1000)); tm.textContent = Math.floor(s / 3600) + ':' + ('0' + Math.floor(s % 3600 / 60)).slice(-2) + ':' + ('0' + s % 60).slice(-2); }
    Array.prototype.forEach.call(document.querySelectorAll('.cth[data-cn]'), function (c) { c.classList.toggle('sel', +c.getAttribute('data-cn') === wsel); });
  }
  function wantedAct(p, ok) { wMsg = 'SENDING…'; wSig = ''; paintWanted(); p.then(function () { wMsg = ok; wSig = ''; paintWanted(); }, function (e) { wMsg = String((e && e.message) || 'COULD NOT DO THAT').toUpperCase(); wSig = ''; paintWanted(); }); }
  function tiles() {
    var f = feed || {}, v = f.visitors || {}, r = f.runs || {}, e = f.economy || {}, none = feed ? '' : 'WAITING FOR LIVE FEED', sr = f.series || {};
    var traded = (e.cardsBought != null || e.cardsSold != null) ? (e.cardsBought || 0) + (e.cardsSold || 0) : null;
    var t = [
      ['VISITORS TODAY', fmt(v.today), v.total != null ? fmt(v.total) + ' all time' : none, sr.visitors],
      ['RUNS TODAY', fmt(r.today), r.total != null ? fmt(r.total) + ' all time' : none, sr.runs],
      ['RUNNING NOW', f.live ? fmt(f.live.length) : (window.HallRunner && HallRunner.live && HallRunner.live().mode === 'run' ? '1' : '—'), f.live ? 'live runners' : 'this device only'],
      ['SIGNED IN', fmt(f.signedIn), f.signedIn != null ? 'players with Glyph' : none, sr.signedIn],
      ['CARDS FOUND', fmt(f.cardsFound), f.cardsFound != null ? 'of all runs' : none, sr.cards],
      ['TOP SCORE', fmt(f.topScore), f.topScore != null ? 'best single run' : none],
      ['LONGEST RUN', f.longest != null ? dur(f.longest) : '—', f.longest != null ? 'alive' : none],
      ['COINS EARNED', fmt(e.coinsEarned), e.coinsSpent != null ? fmt(e.coinsSpent) + ' spent' : none, sr.coins],
      ['CARDS TRADED', fmt(traded), traded != null ? fmt(e.cardsBought) + ' bought · ' + fmt(e.cardsSold) + ' sold' : none],
      ['TEXTS TODAY', fmt(f.messagesToday), f.messagesToday != null ? 'player to player' : none, sr.messages]
    ];
    return t.map(function (x) { return '<div class="tile"><small>' + x[0] + '</small><b>' + x[1] + '</b><em>' + esc(x[2]) + '</em>' + spark(x[3]) + '</div>'; }).join('');
  }
  function pills() {
    var f = feed || {}, st = f.status || {}, on = function (k, d) { return st[k] != null ? !!st[k] : d; };
    var p = [['CLOUDFLARE', on('cloudflare', !!feed)], ['GLYPH', on('glyph', P.isSignedIn())], ['MARKETPLACE', on('market', !!(P.market && P.market()))], ['TEXTS', on('texts', !!handlers.hype)], ['MAIL', on('mail', !!handlers.mail)]];
    return p.map(function (x) { return '<span class="pill' + (x[1] ? ' on' : '') + '"><i></i>' + x[0] + '</span>'; }).join('');
  }
  function activity() {
    var a = (feed && feed.activity) || [];
    return a.length ? a.slice(0, 14).map(function (x) { return '<div class="act"><em>' + stamp(x.ts) + '</em><span>' + esc(x.text) + '</span></div>'; }).join('') : '<div class="act none">WAITING FOR THE LIVE FEED &middot; SIGN-INS, RUNS, CARDS, SALES AND TEXTS APPEAR HERE</div>';
  }
  function flowBar(title, parts, none) {
    var tot = parts.reduce(function (a, p) { return a + (p.v || 0); }, 0);
    return '<div class="ef"><div class="eft"><b>' + title + '</b><span>' + (tot ? fmt(tot) + ' TOTAL' : none) + '</span></div><div class="efb">' + (tot ? parts.map(function (p) { return '<i class="' + p.c + '" style="width:' + (p.v / tot * 100) + '%" title="' + p.l + ' ' + fmt(p.v) + '"></i>'; }).join('') : '') + '</div><div class="efl">' + parts.map(function (p) { return '<span><i class="' + p.c + '"></i>' + p.l + ' <b>' + (p.v == null ? '—' : fmt(p.v)) + '</b>' + (tot && p.v ? ' &middot; ' + Math.round(p.v / tot * 100) + '%' : '') + '</span>'; }).join('') + '</div></div>';
  }
  function health(label, value, text, cls) { return '<div class="eh ' + (cls || 'off') + '"><i></i><b>' + label + '</b><em>' + value + '</em><span>' + text + '</span></div>'; }
  function ecoHtml() {
    var f = feed || {}, e = f.economy || {}, sr = f.series || {}, none = feed ? '' : 'WAITING FOR LIVE FEED', c = P.config;
    var held = e.coinsEarned != null ? e.coinsEarned - (e.coinsSpent || 0) : null;
    var tl = [
      ['COINS EARNED', fmt(e.coinsEarned), 'every coin collected', sr.coins], ['COINS GIVEN', fmt(e.coinsGiven), (e.gifts != null ? fmt(e.gifts) + ' gifts' : none)], ['COINS PER RUN', e.coinsPerRun != null ? fmt(e.coinsPerRun) : '—', 'average finished run'],
      ['AVERAGE WALLET', e.avgBalance != null ? fmt(e.avgBalance) : '—', 'per signed-in player'], ['CARDS SOLD', fmt(e.cardsBoughtUp), 'player to player, for points'], ['LISTINGS OPEN', fmt(e.listingsActive), e.cardsListed != null ? fmt(e.cardsListed) + ' ever listed' : none],
      ['POINTS BETWEEN PLAYERS', fmt(e.pointsMoved), 'Marketplace trades'], ['X POSTS', fmt(e.xPosts), fmt(e.xPoints) + ' bonus points paid'], ['X ACCOUNTS LINKED', fmt(e.xLinked), 'players who claimed once'], ['EXTRA LIVES', fmt(e.livesBought), e.pointsSpentLives != null ? fmt(e.pointsSpentLives) + ' points spent' : none]
    ];
    var h = '<div class="tiles eco2">' + tl.map(function (x) { return '<div class="tile"><small>' + x[0] + '</small><b>' + x[1] + '</b><em>' + esc(x[2]) + '</em>' + (x[3] ? spark(x[3]) : '') + '</div>'; }).join('') + '</div>';
    h += '<div class="box dbox"><h4>WHERE COINS AND POINTS GO</h4>' + flowBar('COINS', [{ l: 'KEPT IN WALLETS', v: held != null ? Math.max(0, held - (e.coinsGiven || 0)) : null, c: 'k2' }, { l: 'GIVEN IN THE GIVING', v: e.coinsGiven, c: 'k3' }], none) + flowBar('POINTS MOVING AROUND', [{ l: 'EARNED IN RUNS', v: e.pointsRuns, c: 'k2' }, { l: 'X BONUS', v: e.xPoints, c: 'k1' }, { l: 'MOVED BETWEEN PLAYERS', v: e.pointsMoved, c: 'k3' }, { l: 'SPENT ON EXTRA LIVES', v: e.pointsSpentLives, c: 'k4' }], none) + '</div>';
    var hs = '', sink = e.coinsEarned ? (e.coinsSpent || 0) / e.coinsEarned : null, infl = e.pointsRuns ? (e.xPoints || 0) / e.pointsRuns : null, ask = null, i;
    hs += health('COINS GIVEN', e.coinsEarned ? Math.round((e.coinsGiven || 0) / e.coinsEarned * 100) + '%' : '—', e.coinsEarned ? 'SHARE OF ALL COINS GIVEN TO OTHER PLAYERS IN THE GIVING' : none || 'NO DATA YET', e.coinsEarned ? 'ok' : 'off');
    hs += health('X BONUS VS RUN POINTS', infl == null ? '—' : Math.round(infl * 100) + '%', infl == null ? none || 'NO DATA YET' : infl > 0.5 ? 'X BONUS POINTS ARE MORE THAN HALF OF ALL RUN POINTS: POSTING IS DRIVING THE SCORES' : 'RUNNING STILL DRIVES MOST POINTS', infl == null ? 'off' : infl > 0.5 ? 'warn' : 'ok');
    hs += health('LISTING ACTIVITY', e.listingsActive == null ? '—' : fmt(e.listingsActive), e.listingsActive == null ? none || 'NO DATA YET' : e.listingsActive === 0 ? 'NO PLAYER HAS A DUPLICATE FOR SALE: THE MARKETPLACE IS EMPTY' : 'PLAYERS ARE OFFERING CARDS FOR SALE', e.listingsActive == null ? 'off' : e.listingsActive === 0 ? 'warn' : 'ok');
    h += '<div class="box dbox"><h4>ECONOMY HEALTH</h4><div class="ehs">' + hs + '</div></div>';
    var rows = P.tiers.map(function (t, k) { var x = (e.tiers || [])[k] || {}, d = function (v) { return v == null ? '—' : fmt(v); }; return ['<b style="color:' + t.color + '">' + esc(t.name.toUpperCase()) + '</b>', d(x.avgListing), d(x.listed), d(x.sold)]; });
    h += '<div class="box dbox"><h4>PRICES BY RARITY</h4><div class="hint" style="margin-bottom:12px">Players price their own duplicate cards in points, and only duplicates can be sold. The prices come from what players ask.</div>' + '<div class="dtab" style="--c:4"><div class="dh"><span>RARITY</span><span>AVERAGE ASK (POINTS)</span><span>LISTED</span><span>SOLD</span></div>' + rows.map(function (r) { return '<div class="dr">' + r.map(function (c2) { return '<span>' + c2 + '</span>'; }).join('') + '</div>'; }).join('') + '</div></div>';
    var days = (e.byDay || []), mx = Math.max.apply(null, days.map(function (d) { return d.trades || 0; }).concat([1]));
    h += '<div class="cols2"><div class="box"><h4>TRADES, LAST 14 DAYS</h4>' + (days.length ? '<div class="dbars">' + days.slice(-14).map(function (d) { return '<span title="' + esc(d.d) + ' · ' + fmt(d.trades) + ' trades"><i style="height:' + Math.max(4, (d.trades || 0) / mx * 100) + '%"></i><em>' + esc(String(d.d).slice(-2)) + '</em></span>'; }).join('') + '</div>' : '<div class="rk none">' + (feed ? 'NO DATA YET' : 'WAITING FOR THE LIVE FEED') + '</div>') + '</div>' +
      '<div class="box"><h4>MOST TRADED CARDS</h4>' + ((e.topCards || []).length ? '<div class="etop">' + e.topCards.slice(0, 8).map(function (x) { var cd = P.card ? P.card(x.n) : null; return '<div><img src="' + esc(cd ? cd.file : 'assets/game/card-back.webp') + '" alt="" loading="lazy"><b>#' + x.n + '</b><span>' + fmt(x.count) + ' TRADES</span></div>'; }).join('') + '</div>' : '<div class="rk none">' + (feed ? 'NO DATA YET' : 'WAITING FOR THE LIVE FEED') + '</div>') + '</div></div>';
    h += '<div class="cols2"><div class="box"><h4>TOP SELLERS</h4>' + rankList(e.topSellers, feed ? 'NO DATA YET' : 'WAITING FOR THE LIVE FEED') + '</div><div class="box"><h4>TOP BUYERS</h4>' + rankList(e.topBuyers, feed ? 'NO DATA YET' : 'WAITING FOR THE LIVE FEED') + '</div></div>';
    h += '<div class="box dbox"><h4>RECENT TRADES</h4><div class="acts">' + ((e.recent || []).length ? e.recent.slice(0, 14).map(function (x) { return '<div class="act"><em>' + stamp(x.ts) + '</em><span>' + esc(x.text) + '</span></div>'; }).join('') : '<div class="act none">' + (feed ? 'NO TRADES YET' : 'WAITING FOR THE LIVE FEED') + '</div>') + '</div></div>';
    h += '<div class="box dbox"><h4>THE RULES OF THE ECONOMY</h4>' + '<ul class="dl"><li><b>Coins</b> come only from runs: each coin collected is also worth ' + c.coinPoints + ' points to that run. Coins are only given between players in The Giving.</li><li><b>Lifetime total</b> is the leaderboard and Top 5 score. Every finished run adds its <b>run score</b> (distance points, 20 per game unit, plus coin points, 25 per coin) to the previous total, so it only grows. On top of that: the coins, 1,000 per 1% of the Regular and Foil decks, the complete-deck bonuses (100,000 Regular, 250,000 Foil), the X bonus points and Marketplace sales (purchases come off). Only <b>distance points</b> (the distance part of each run, 20 per game unit) can buy cards in the Marketplace. Coins, deck percentages, X points and points earned by selling cannot. The price comes off the buyer&rsquo;s score and is added to the seller&rsquo;s score as <b>marketplace points</b>, which count for the leaderboard but cannot be spent. A seller may set any price from 1 point up, with no limit. Only duplicates can be sold.</li><li><b>Holders:</b> with the NFT rule on, 5 or more Mimu On Ape NFTs (in the Glyph wallet or delegated to it on delegate.xyz) play saved, ranked runs; under 5 sees the demo run only. 10 NFTs give 1 random foil card, then 1 more per 10, up to 20 at 200. See the NFT box on the GAME RULES page.</li><li><b>Extra life:</b> after a crash a player may buy one extra life per run for ' + Math.round(c.life.share * 100) + '% of their points. It cannot be bought twice in a run.</li><li><b>X bonus:</b> a verified post on X earns 50,000 points every 12 hours. They are added to the player&rsquo;s points.</li><li><b>Never money:</b> only coins and points change hands. Sales are final. The cards are in-game pictures, not real-world assets.</li><li><b>Where the numbers live:</b> the Hall run, Giving and Top 5 times, the X bonus amount and the Marketplace limits all live in the server, so they can change without touching the site.</li></ul></div>';
    return h;
  }
  /* ---------- the X BONUS page: who posted, with every post link and whether it checks out ---------- */
  var xSig = '', xMsg = '';
  function paintX() {
    var el = $('admX'); if (!el) return; var f = feed || {}, e = f.economy || {}, x = f.xbonus || { players: [] }, none = feed ? '' : 'WAITING FOR LIVE FEED';
    var all = (x.players || []).reduce(function (a, p) { return a.concat(p.claims || []); }, []), okN = all.filter(function (c) { return c.verified; }).length;
    var sig = JSON.stringify([x, e.xPosts, e.xPoints, e.xLinked, xMsg, !!feed]); if (sig === xSig) return; xSig = sig;
    var tl = [['POSTS CLAIMED', fmt(e.xPosts), 'all players'], ['BONUS POINTS PAID', fmt(e.xPoints), '50,000 a post'], ['X ACCOUNTS LINKED', fmt(e.xLinked), 'one per player'], ['POSTS VERIFIED', all.length ? okN + ' OF ' + all.length : '—', 'still public with the tag and picture']];
    var h = '<div class="tiles eco2">' + tl.map(function (t) { return '<div class="tile"><small>' + t[0] + '</small><b>' + t[1] + '</b><em>' + esc(t[2]) + '</em></div>'; }).join('') + '</div>';
    h += '<div class="box dbox"><h4>PLAYERS WHO POSTED ON X</h4><div class="xrt"><button type="button" class="xrb" data-xr="all">RECHECK ALL POSTS</button><span>' + (xMsg || 'A check confirms the post is still public, from the linked account, with @mimuonape and a picture. New claims start verified.') + '</span></div>';
    if (!(x.players || []).length) h += '<div class="rk none">' + (feed ? 'NOBODY HAS CLAIMED THE X BONUS YET' : none) + '</div>';
    else h += (x.players || []).map(function (p) {
      return '<div class="xpl"><div class="xph"><b>' + esc(String(p.name).toUpperCase()) + '</b><a href="https://x.com/' + esc(p.handle) + '" target="_blank" rel="noopener noreferrer">@' + esc(String(p.handle).toUpperCase()) + '</a><span>' + fmt(p.points) + ' PTS &middot; ' + p.posts + ' POST' + (p.posts === 1 ? '' : 'S') + '</span></div>' +
        '<div class="xpc">' + (p.claims || []).map(function (c, i) { return '<div class="xpr ' + (c.verified ? 'ok' : 'bad') + '"><span class="xck" title="' + (c.verified ? 'Verified' : 'Unverified') + '">' + (c.verified ? '&#10003;' : '&#10007;') + '</span><a href="' + esc(c.url) + '" target="_blank" rel="noopener noreferrer">POST ' + (p.claims.length - i) + ' &middot; ' + stamp(c.ts) + '</a><em>' + (c.verified ? 'VERIFIED' : 'UNVERIFIED') + (c.checkedAt ? ' &middot; CHECKED ' + stamp(c.checkedAt) : '') + '</em><button type="button" class="xrb sm" data-xr="' + c.id + '">RECHECK</button></div>'; }).join('') + '</div></div>';
    }).join('');
    el.innerHTML = h + '</div>';
  }
  /* ---------- the EASTER EGG page: the secret order, the number, who found it, and the click tickers ---------- */
  /* ---------- the SECURITY page: attacks on the admin login ---------- */
  var secSig = '';
  function paintSec() {
    var el = $('admSec'); if (!el) return; var g = feed && feed.security; var sig = JSON.stringify([g, !!feed]); if (sig === secSig) return; secSig = sig;
    if (!g) { el.innerHTML = '<div class="box dbox"><h4>WAITING FOR THE LIVE FEED</h4></div>'; return; }
    var L = { CALM: ['#3ddc84', 'CALM', 'Nothing unusual on the admin login.'], WATCH: ['#ffcf4a', 'WATCH', 'More wrong guesses than normal. Keep an eye on it.'], ATTACK: ['#ff5a52', 'POSSIBLE ATTACK', 'Many wrong guesses from several visitors at once, which looks like a bot spread over many addresses. The lock-outs are working, but change the admin password in Cloudflare if this keeps going.'] }[g.level] || ['#3ddc84', 'CALM', ''];
    var h = '<div class="box dbox" style="border-color:' + L[0] + ';box-shadow:0 0 14px ' + L[0] + '55"><h4 style="color:' + L[0] + '">LOGIN SECURITY: ' + L[1] + '</h4><p class="dp">' + esc(L[2]) + '</p></div>';
    h += '<div class="box dbox"><h4>WRONG GUESSES</h4><div class="dtab" style="--c:4"><div class="dh"><span>WINDOW</span><span>WRONG GUESSES</span><span>DIFFERENT VISITORS</span><span>NOTE</span></div>' +
      '<div class="dr"><span>LAST 10 MINUTES</span><span>' + fmt(g.fails10) + '</span><span>' + fmt(g.who10) + '</span><span>' + (g.who10 >= 5 ? 'MANY AT ONCE' : '') + '</span></div>' +
      '<div class="dr"><span>LAST HOUR</span><span>' + fmt(g.failsH) + '</span><span>' + fmt(g.whoH) + '</span><span></span></div>' +
      '<div class="dr"><span>LAST 24 HOURS</span><span>' + fmt(g.failsD) + '</span><span>' + fmt(g.whoD) + '</span><span>' + fmt(g.locksD) + ' LOCK-OUTS</span></div></div></div>';
    h += '<div class="box dbox"><h4>RIGHT NOW</h4><div class="dtab" style="--c:3"><div class="dh"><span>LOCKED OUT NOW</span><span>ADMIN SIGN-INS (24H)</span><span>LAST SIGN-IN</span></div><div class="dr"><span>' + fmt(g.lockedNow) + ' VISITOR' + (g.lockedNow === 1 ? '' : 'S') + '</span><span>' + fmt(g.okD) + '</span><span>' + (g.lastOk ? stamp(g.lastOk) : '\u2014') + '</span></div></div></div>';
    var top = g.top || [];
    h += '<div class="box dbox"><h4>VISITORS WITH THE MOST WRONG GUESSES (24 HOURS)</h4>' + (top.length ? '<div class="dtab" style="--c:4"><div class="dh"><span>VISITOR CODE</span><span>WRONG GUESSES</span><span>LOCK-OUTS</span><span>LAST TRY</span></div>' + top.map(function (t) { return '<div class="dr"><span>' + esc(t.tag) + '</span><span>' + fmt(t.fails) + '</span><span>' + fmt(t.locks) + '</span><span>' + stamp(t.last) + '</span></div>'; }).join('') + '</div>' : '<p class="dp">No wrong guesses in the last 24 hours.</p>') + '</div>';
    var rc = g.recent || [];
    h += '<div class="box dbox"><h4>THE LAST 40 LOGIN TRIES</h4>' + (rc.length ? '<div class="dtab" style="--c:3"><div class="dh"><span>WHEN</span><span>VISITOR CODE</span><span>RESULT</span></div>' + rc.map(function (t) { return '<div class="dr"><span>' + stamp(t.ts) + '</span><span>' + esc(t.tag) + '</span><span>' + (t.outcome === 'ok' ? 'SIGNED IN' : t.outcome === 'lock' ? 'WRONG, LOCKED OUT' : 'WRONG PASSWORD') + '</span></div>'; }).join('') + '</div>' : '<p class="dp">No login tries yet.</p>') + '</div>';
    h += '<div class="box dbox"><h4>HOW IT WORKS</h4><ul class="dl"><li>Every wrong password is counted for one hour for each visitor. Every 3rd wrong guess locks that visitor out, and each lock is twice as long as the last: 30 seconds, 1 minute, 2 minutes and so on, up to 1 hour. During a lock even the right password is refused.</li><li>A visitor code is a short scramble made from the visitor&rsquo;s address. It lets you tell visitors apart without ever storing or showing the address.</li><li><b>POSSIBLE ATTACK</b> shows when 5 or more different visitors guess wrong within 10 minutes, or there are 30 wrong guesses in 10 minutes. That looks like a bot using many addresses to get around the lock-outs. <b>WATCH</b> shows for a smaller version of the same thing.</li><li>The server does not lock everyone out at once, because an attacker could use that to lock you out of your own admin. The real protection against many addresses is a long random password: change it in Cloudflare (the ADMIN_PASSWORD secret) if you ever see POSSIBLE ATTACK.</li><li>Every try is also written to the activity feed on the Overview page. Records are kept for 30 days.</li></ul></div>';
    el.innerHTML = h;
  }
  /* the NFT rule, live: how many players qualify and how many foil cards were given */
  function paintNft() {
    var el = $('admNft'); if (!el) return; var n = feed && feed.nft; if (!n) { el.innerHTML = ''; return; }
    if (!n.enabled) { el.innerHTML = '<div class="box dbox"><h4>THE NFT RULE IS OFF</h4><p class="dp">Everyone can play saved runs. Fill in the NFT_CONTRACT setting on the Worker to turn it on.</p></div>'; return; }
    var rows = (n.top || []).map(function (t) { return '<div class="dr"><span>' + esc(t.name) + '</span><span>' + fmt(t.count) + ' NFTS</span><span>' + fmt(t.granted) + ' FOIL CARDS GIVEN</span></div>'; }).join('');
    el.innerHTML = '<div class="box dbox"><h4>THE NFT RULE IS ON (MIMU ON APE)</h4><p class="dp">Contract <b>' + esc(n.contract) + '</b> on ApeChain. 5 NFTs to play for real; one random foil card per 10 NFTs, up to 20.</p><div class="dtab" style="--c:4"><div class="dh"><span>PLAYERS WITH 5+</span><span>PLAYERS CHECKED</span><span>FOIL CARDS GIVEN</span><span>WALLETS TIED (DELEGATED &middot; LINKED)</span></div><div class="dr"><span>' + fmt(n.qualified) + '</span><span>' + fmt(n.checked) + '</span><span>' + fmt(n.foilGiven) + '</span><span>' + fmt(n.sources) + ' (' + fmt(n.delegated) + ' &middot; ' + fmt(n.linked || 0) + ')</span></div></div>' + (rows ? '<h4 style="margin-top:14px">TOP HOLDERS</h4><div class="dtab" style="--c:3">' + rows + '</div>' : '') + '<ul class="dl"><li>Players under 5 see the demo run only: they are signed out on the page, the server closes the Marketplace, texts, mail, Giving and X bonus to them, nothing is saved and they are never on the leaderboard, the Top 5 or the Giving, and nobody can give to them.</li><li>Each holding wallet counts for one game account at a time, so delegating the same NFTs to many wallets does not multiply anything.</li></ul></div>';
  }
  var eggSig = '', eggMsg = '';
  function paintEgg() {
    var el = $('admEgg'); if (!el) return; var g = (feed && feed.egg) || null, none = feed ? '' : 'WAITING FOR LIVE FEED'; var sig = JSON.stringify([g, eggMsg, !!feed]); if (sig === eggSig) return; eggSig = sig;
    var SP = (window.HallHunt && HallHunt.SPOTS) || [], found = !!(g && g.found), st = (g && g.stats) || {};
    var h = '<div class="eggst ' + (found ? 'found' : 'lost') + '"><b>' + (!g ? 'WAITING FOR THE LIVE FEED' : found ? 'FOUND' : 'NOT FOUND YET') + '</b><span>' + (found ? 'FIRST FOUND BY <u>' + esc(String(g.first.name).toUpperCase()) + '</u> ON ' + stamp(g.foundAt) + ' &middot; AFTER ' + fmt(st.clicksBeforeFound) + ' CLICKS ON THE HIDDEN ITEMS' : g ? 'NOBODY HAS COMPLETED THE PATTERN. THE COUNTERS BELOW KEEP RUNNING UNTIL SOMEONE DOES. ONLY THE FIRST FINISHER WINS: AFTER THAT IT CAN NEVER BE WON AGAIN.' : none) + '</span></div>';
    var tl = [[found ? 'CLICKS BEFORE IT WAS FOUND' : 'CLICKS SO FAR (NOT FOUND)', g ? fmt(st.clicksBeforeFound) : '\u2014', found ? 'frozen when it was first found' : 'running until it is found'], ['ALL CLICKS EVER', g ? fmt(st.clicks) : '\u2014', 'keeps counting after it is found'], ['WRONG CLICKS', g ? fmt(st.wrong) : '\u2014', 'clicks that broke the pattern'], ['VISITORS WHO CLICKED', g ? fmt(st.visitors) : '\u2014', 'different browsers'], ['WINNER', g ? (found ? 'ONE' : 'NONE YET') : '\u2014', 'only one player can ever win']];
    h += '<div class="tiles eco2">' + tl.map(function (t) { return '<div class="tile"><small>' + t[0] + '</small><b>' + t[1] + '</b><em>' + esc(t[2]) + '</em></div>'; }).join('') + '</div>';
    h += '<div class="box dbox"><h4>THE PHONE NUMBER</h4><div class="eggnum">' + (g ? esc(g.number) : '\u2014') + '</div><div class="hint">' + (g && g.dialed ? '<b>DIALED</b> by the winner on ' + stamp(g.dialed) + '. It can never be dialed again.' : found ? '<b>NOT DIALED YET.</b> The winner can dial it once.' : 'Nobody has found it yet.') + ' The number is kept in the server (the EGG_NUMBER setting in the Worker), so it can change without touching the site. The page never has it: the winner taps once, confirms, and the server hands it over a single time. The call itself (what answers) is set up with your phone provider.</div></div>';
    var order = (g && g.order) || [];
    h += '<div class="box dbox"><h4>THE SECRET ORDER: CLICK THE 11 ITEMS 1 TO 11</h4><div class="hint" style="margin-bottom:10px">Three boxes of cards and eight candles in the hall background, left and right of the phone. Click them in this order (the circled numbers). A wrong click starts the pattern over. This picture and list come straight from the server, so they are always the real order.</div>';
    h += '<div class="eggpic"><img src="assets/poster.webp" alt="The hall background with the 11 hidden items circled and numbered in the order to click them" loading="lazy">' + order.map(function (k, i) { var s = SP[k]; if (!s) return ''; var w = Math.max(s.w * 100 * 1.5, 3.2), hh = Math.max(s.h * 100 * 1.5, 5.4); return '<i class="eggc ' + s.t + '" style="left:' + (s.x * 100) + '%;top:' + (s.y * 100) + '%;width:' + w + '%;height:' + hh + '%"><b>' + (i + 1) + '</b></i>'; }).join('') + '</div>';
    h += '<ol class="eggord">' + order.map(function (k) { var s = SP[k]; return '<li><b>' + (order.indexOf(k) + 1) + '</b><span>' + esc(s ? s.n : 'item ' + k) + '</span></li>'; }).join('') + '</ol>' + (order.length ? '' : '<div class="rk none">' + (feed ? 'NO ORDER YET' : none) + '</div>') + '</div>';
    h += '<div class="box dbox"><h4>WHAT THE PLAYER SEES WHEN THEY FIND IT</h4><div class="hint" style="margin-bottom:10px">When the pattern is finished the phone opens (if it was closed) and this notification appears on it, in a red frame that says EASTER EGG. The phone number is a tap-to-call link on a phone.</div><div class="eggprev"><div class="phonemini"><div class="huntnote static">' + ((window.HallHunt && HallHunt.noteHtml) ? HallHunt.noteHtml(null, true, false) : '') + '<span class="hnx">&times;</span></div></div></div></div>';
    var fl = (g && g.finds) || [];
    h += '<div class="box dbox"><h4>THE WINNER (ONLY ONE, EVER)</h4>' + (fl.length ? '<div class="dtab" style="--c:4"><div class="dh"><span>WHEN</span><span>WHO</span><span>CLICKS</span><span>RESULT</span></div>' + fl.map(function (f) { return '<div class="dr"><span>' + stamp(f.ts) + '</span><span>' + esc(f.name) + '</span><span>' + fmt(f.clicks) + '</span><span>WINNER</span></div>'; }).join('') + '</div>' : '<div class="rk none">' + (feed ? 'NOT FOUND YET' : none) + '</div>') + '</div>';
    h += '<div class="box dbox"><h4>HOW IT WORKS</h4><ul class="dl"><li>The 11 items are invisible buttons laid over the hall picture. They only show a tiny flicker when clicked.</li><li>Every click is sent to the server, which keeps each visitor&rsquo;s progress. Only the server knows the order, so it cannot be read from the page.</li><li>When someone clicks all 11 in the right order, the server sends back the phone number and the phone shows the red EASTER EGG notification with a congratulations. <b>Only the first person to finish ever wins:</b> after that the server gives nothing to anyone else and the items stop reacting. If the winner is signed in, their player name is saved and they get an Easter Egg badge; otherwise they are saved as a visitor.</li><li>The Badges page shows everyone a banner that says only EASTER EGG FOUND or EASTER EGG NOT FOUND. The winner also sees a congratulations message there, with their number.</li><li>The click counters stop counting <i>before found</i> at the win, and keep counting <i>all clicks</i>.</li></ul></div>';
    el.innerHTML = h;
  }
  function sysRows() {
    var A = window.MIMUAudio, f = feed || {}, ok = function (b) { return b ? 'ok' : 'off'; }, cards = (P.cards && P.cards().length) || 0, vw = window.innerWidth + ' x ' + window.innerHeight;
    var rows = [
      ['GAME FILES', !!(window.HallRunner && window.HallApps && window.HallComms && A) ? 'ok' : 'bad', window.HallRunner && window.HallApps && window.HallComms && A ? 'ALL LOADED' : 'SOMETHING DID NOT LOAD'],
      ['CARD LIST', cards === 120 ? 'ok' : 'bad', cards + ' OF 120 CARDS LOADED'],
      ['LIVE FEED', ok(!!feed), feed ? 'CONNECTED' : 'NOT CONNECTED YET (CLOUDFLARE)'],
      ['GLYPH SIGN-IN', ok(P.isSignedIn()), P.isSignedIn() ? 'SIGNED IN AS ' + esc(P.username()) : 'NOT CONNECTED YET'],
      ['MESSAGES', ok(!!(P.messages && P.messages())), P.messages && P.messages() ? 'CONNECTED' : 'WAITS FOR SIGN-IN'],
      ['MAIL', ok(!!(P.mail && P.mail())), P.mail && P.mail() ? 'CONNECTED' : 'WAITS FOR SIGN-IN'],
      ['MARKETPLACE', ok(!!(P.market && P.market())), P.market && P.market() ? 'CONNECTED' : 'WAITS FOR SIGN-IN'],
      ['THE CAMPAIGN', window.HallCampaign ? 'ok' : 'bad', window.HallCampaign ? 'PHASE: ' + String(HallCampaign.phase()).toUpperCase() : 'NOT LOADED'],
      ['EASTER EGG', window.HallHunt ? (feed && feed.egg ? (feed.egg.found ? 'ok' : 'warn') : 'off') : 'bad', window.HallHunt ? (feed && feed.egg ? (feed.egg.found ? 'FOUND' : 'NOT FOUND YET') : 'WAITING FOR THE LIVE FEED') : 'NOT LOADED'],
      ['X BONUS', window.HallXBonus ? 'ok' : 'bad', window.HallXBonus ? 'LOADED' + (P.xbonus && P.xbonus() ? ' · CONNECTED' : ' · WAITS FOR SIGN-IN') : 'NOT LOADED'],
      ['HYPE AND MAIL SENDING', ok(!!(handlers.hype && handlers.mail)), handlers.hype && handlers.mail ? 'READY' : 'NOT CONNECTED YET'],
      ['SOUND', 'ok', A && A.isMuted() ? 'MUTED' : 'ON · VOLUME ' + Math.round((A ? A.getVolume() : 0) * 8) + ' OF 8'],
      ['BUILD', DOCS.commit ? 'ok' : 'warn', DOCS.commit ? 'COMMIT ' + esc(DOCS.commit) + ' · ' + esc(DOCS.commits) + ' CHANGES · GUIDE ' + esc(DOCS.built) : 'GUIDE NOT LOADED'],
      ['TEST MODE', P.isTest() ? 'warn' : 'ok', P.isTest() ? 'ON (THIS BROWSER ONLY)' : 'OFF'],
      ['THIS BROWSER', 'ok', 'WINDOW ' + vw]
    ];
    return rows.map(function (r) { return '<div class="sysr ' + r[1] + '"><i></i><b>' + r[0] + '</b><span>' + r[2] + '</span></div>'; }).join('');
  }
  var NAV = [['ov', 'OVERVIEW'], ['live', 'LIVE RUNS'], ['flag', 'FLAGGED RUNS'], ['board', 'PLAYER BOARD'], ['msg', 'HYPE TEXTS'], ['utx', 'USER TEXTS'], ['mail', 'MIMU MAIL'], ['eco', 'ECONOMY'], ['xbonus', 'X BONUS'], ['egg', 'EASTER EGG'], ['sec', 'SECURITY'], ['cards', 'CARDS'], ['wanted', 'LAUNCH A WANTED CARD'], ['rules', 'GAME RULES'], ['site', 'SITE GUIDE'], ['sys', 'SYSTEMS']];
  var DOCS = window.HallAdminDocs || { pages: {} };
  var curTab = 'ov';
  function openPanel() {
    try { buildPanel(); }
    catch (e) {
      clearInterval(tick); shade.classList.add('open');
      shade.innerHTML = '<div class="adm-login" role="dialog"><button class="x" type="button" aria-label="Close">&times;</button><h3 class="gold">ADMIN</h3><p>THE CONTROL ROOM HIT A PROBLEM</p><div class="err">' + esc(e && e.message) + '</div></div>';
      shade.querySelector('.x').addEventListener('click', close);
    }
  }
  function buildPanel() {
    /* the panel is drawn fresh every time it opens, so every page must forget what it last drew; otherwise a page that did not change would stay empty */
    flagSig = ''; wSig = ''; boardSig = ''; xSig = ''; eggSig = ''; secSig = ''; hxSig = ''; hxListSig = ''; bq = ''; shade.classList.add('open');
    shade.innerHTML = '<div class="adm v2" role="dialog" aria-label="Administration"><button class="adm-x" type="button" aria-label="Close">&times;</button>' +
      '<div class="cr-head"><div><h2 class="gold">ADMINISTRATION</h2><div class="sub">THE HALL &middot; CONTROL ROOM</div></div><div class="cr-right"><div class="cr-clock" id="admClock"></div><div class="cr-pills" id="admPills"></div></div></div>' +
      '<div class="cr-body"><nav class="cr-nav" id="admNav">' + NAV.map(function (n, i) { return '<button type="button" data-t="' + n[0] + '"' + (n[0] === curTab ? ' class="on"' : '') + '><i>' + (i + 1) + '</i>' + n[1] + (n[0] === 'flag' ? ' <em id=\"admFlagN\"></em>' : '') + '</button>'; }).join('') + '<button type="button" class="cr-out" id="admOut">LOG OUT</button></nav>' +
      '<main class="cr-main">' +
      ovHtml() +
      '<section data-p="live"><div class="livebox off" id="admLB2"></div></section><section data-p="flag"><div id="admFlag"></div></section>' +
      '<section data-p="board"><div class="box dbox"><h4 id="admBoardH">PLAYER BOARD</h4><div class="hint" style="margin-bottom:10px">Every signed-in player with their <b>lifetime total</b> (distance points + coin points + coins + Regular deck % + Foil deck % + X bonus; the points part is shown underneath), their coins and how complete their Regular and Foil decks are. Press a column title to sort.</div><div class="bsearch"><input id="admBq" maxlength="40" placeholder="SEARCH A PLAYER" autocomplete="off"></div><div id="admBoardList"></div></div></section>' +
      '<section data-p="msg"><div class="hx"><div class="box hxl"><h4>CONVERSATIONS</h4><div class="hxnew"><input id="admHTo" list="admPl" maxlength="40" placeholder="START A NEW TEXT: PLAYER USERNAME" autocomplete="off"><datalist id="admPl"></datalist><button type="button" class="go" id="admHNew">NEW</button></div><div class="hxlist" id="admHT"></div></div><div class="box hxr"><h4 id="admHTitle">PICK A CONVERSATION</h4><div class="hint">HYPE is the account you text players from. Players can and will text HYPE back, so their replies land here. Players can also text HYPE first.</div><div class="hxlog" id="admHLog"></div><div class="cmp"><textarea id="admHBody" maxlength="280" rows="3" placeholder="MESSAGE FROM HYPE"></textarea><button class="go" type="button" id="admHSend">SEND AS HYPE</button><div class="cmsg" id="admHMsg"></div></div></div></div></section>' +
      '<section data-p="utx"><div class="box dbox"><h4>USER TEXTS &middot; WHAT THIS PAGE IS</h4><div class="utxinfo">' +
        '<p><b>EVERY TEXT ON THE WHOLE SERVICE, IN ONE PLACE.</b> This page lets the administration read the texts players send each other, and the notices and HYPE texts, so the Hall can be moderated. It is <b>read-only</b>: nothing here edits, deletes or sends a text.</p>' +
        '<ul><li><b>WHAT YOU SEE:</b> both usernames of every text (who sent it and who got it), the exact time in Los Angeles time, whether the receiver has opened it (<b>READ</b> or <b>UNREAD</b>), banned players, and who has blocked whom. Hover a username to see the full wallet address.</li>' +
        '<li><b>THE FOUR VIEWS:</b> <b>ALL TEXTS</b> (the default) is every text on the service, newest first. <b>PLAYER TO PLAYER</b> is only what players write to each other. <b>MIMU NOTICES</b> are the automatic texts MIMU sends players (card bought, card sold, X bonus, wanted card found). <b>HYPE</b> is every text with the HYPE account (you can also answer those on the <b>HYPE TEXTS</b> page). MIMU <b>mail</b> (announcements) is on the MIMU MAIL page.</li>' +
        '<li><b>HOW TEXTS WORK FOR PLAYERS:</b> only players with 5 or more Mimu On Ape can text; a text is up to 280 characters; a player can send up to 20 a minute; players can block each other; banned players cannot send or receive; players cannot edit or delete a text. The Hall Rules tell players the team can read texts.</li>' +
        '<li><b>HOW TO USE IT:</b> the left list shows the conversations, newest first. Click one to read the whole conversation on the right. The search box finds a word in any text or any username. <b>SHOW ALL OF NAME&rsquo;S TEXTS</b> filters the page to one player. <b>TEXT NAME AS HYPE</b> opens the HYPE TEXTS page with that player ready, so you can warn them. To ban a player use the ban action on a flagged run.</li>' +
        '<li><b>LIVE:</b> this page refreshes every 3 seconds while it is open. It lists the 200 newest conversations and the 80 newest texts, and a conversation shows up to its latest 500 texts. Keep what you read here private.</li></ul></div></div>' +
        '<div class="utxstats" id="admUtxS"></div>' +
        '<div class="box dbox"><h4>READ AND SEARCH</h4><div class="cfilt utxscope" id="admUtxScope"></div><div class="hxnew"><input id="admUtxQ" maxlength="60" placeholder="SEARCH EVERY TEXT OR ANY USERNAME" autocomplete="off"><button class="go" type="button" id="admUtxClr">CLEAR</button></div><div class="cmsg" id="admUtxMsg"></div><div class="utxchip" id="admUtxChip"></div>' +
        '<div class="hx"><div><div class="hint" style="margin-bottom:8px" id="admUtxListH">CONVERSATIONS</div><div class="hxlist" id="admUtxList"></div></div><div><div id="admUtxHead"></div><div class="hxlog" id="admUtxLog"></div><div class="utxacts" id="admUtxActs"></div></div></div></div>' +
        '<div class="box dbox"><h4 id="admUtxAllH">THE NEWEST TEXTS</h4><div class="utxall" id="admUtxAll"></div></div>' +
        '<div class="box dbox"><h4>WHO HAS BLOCKED WHOM</h4><div class="utxall" id="admUtxBlk"></div></div></section>' +
            '<section data-p="mail"><div class="box"><h4>MIMU MAIL</h4><div class="mtabs" id="admMT"><button type="button" class="on" data-k="c">COMPOSE</button><button type="button" data-k="s">SENT</button></div><div class="hint" style="margin-bottom:12px">Announcements from MIMU to everyone signed in. Mail is outgoing only: players cannot send or reply to email, they text instead.</div>' +
      '<div class="cmp" id="admMC"><input id="admMS" maxlength="90" placeholder="SUBJECT" autocomplete="off"><textarea id="admMB" maxlength="4000" rows="7" placeholder="EMAIL FROM MIMU"></textarea><button class="go" type="button" id="admMSend">SEND TO EVERYONE SIGNED IN</button><div class="cmsg" id="admMMsg"></div></div><div class="sent" id="admML" style="display:none"></div></div></section>' +
      '<section data-p="eco"><div id="admEco"></div></section>' +
      '<section data-p="xbonus"><div id="admX"></div></section>' +
      '<section data-p="egg"><div id="admEgg"></div></section>' +
      '<section data-p="sec"><div id="admSec"></div></section>' +
      '<section data-p="cards"><div class="box dbox"><h4>BY RARITY</h4>' + tierCards() + '</div><div class="box dbox"><h4>BY FAMILY</h4>' + famCards() + '</div><div class="box dbox"><h4>THE WHOLE DECK &middot; ALL 120 CARDS</h4><div class="whow"><b>HOW TO LAUNCH A WANTED CARD</b><span><i>1</i>CLICK A CARD in the deck below</span><span><i>2</i>PICK HOURS in the red box at the bottom</span><span><i>3</i>PRESS LAUNCH</span></div><div class="hint" style="margin-bottom:12px">Every card in the game, with its border colored by rarity. Each card shows how many times it has been found.</div>' + deckGrid() + '<div id="admWanted"></div></div><div class="box dbox"><h4>THE NUMBERS</h4><div id="admCards"></div></div></section>' +
      '<section data-p="rules"><div id="admNft"></div><div class="box"><h4>WHEN CARDS DROP IN ONE RUN</h4><div class="pchart" data-cchart="admin"></div><div class="hint" style="margin-top:10px">Time is time alive in one run; dying starts it over. Drawn from the game&rsquo;s real numbers, so it is always current. The new card comes every 4:20, the black slowdown pack every 2:00, the red heart every 5:00.</div></div><div class="box"><h4>POWER-UPS AND THE PHONE BATTERY</h4><div class="pchart" data-pchart="admin"></div><div class="hint" style="margin-top:10px">The first 30 minutes of one run, drawn from the game&rsquo;s real numbers (so it is always current).</div></div><div class="box gbox"><h4>THE CAMPAIGN: HALL RUN, THE GIVING, THE TOP 5</h4><p><b>Monday, Oct 26, 12:00 PM (noon) Pacific:</b> the Hall run starts and lasts <b>14 days</b>. <b>Monday, Nov 9, noon Pacific:</b> the Hall closes (its app goes gray and new runs are refused). The <b>Giving</b> opens in green for <b>48 hours</b>: players outside the top 5 can give their coins to other players. <b>Wednesday, Nov 11, noon Pacific:</b> the Giving closes and the <b>Top 5</b> opens in gold with the final results: the five highest <b>lifetime totals</b> (distance points + coin points + coins + 1,000 per 1% of the Regular deck + 1,000 per 1% of the Foil deck + X bonus). The Alarm app counts it all down.</p><div class="hint">The times live on the server (CAMPAIGN in the Worker) and the page reads them from there.</div></div><div class="box"><h4>HOW THE GAME WORKS RIGHT NOW</h4><div class="works">' + worksCards() + '</div></div></section>' +
      '<section data-p="site">' + (DOCS.pages.site || '<div class="box">GUIDE NOT LOADED</div>') + '</section>' +
      '<section data-p="sys">' + (DOCS.pages.sys || '') + '</section>' +
      '</main></div><div class="cr-foot">KEYS &nbsp; 1&ndash;9 SWITCH PAGE &nbsp;&middot;&nbsp; ESC CLOSES &nbsp;&middot;&nbsp; GUIDE BUILT ' + esc(DOCS.built || '') + ' &middot; COMMIT ' + esc(DOCS.commit || '') + '</div></div>';
    var root = shade.querySelector('.adm'); if (window.HallPower) HallPower.fill(shade);
    function show(t) {
      var navKey = t; if (t === 'wanted') t = 'cards'; curTab = t;
      Array.prototype.forEach.call(root.querySelectorAll('.cr-nav button'), function (b) { b.classList.toggle('on', b.getAttribute('data-t') === navKey); });
      Array.prototype.forEach.call(root.querySelectorAll('section[data-p]'), function (s) { s.style.display = s.getAttribute('data-p') === t ? '' : 'none'; s.classList.toggle('in', s.getAttribute('data-p') === t); });
      root.querySelector('.cr-main').scrollTop = 0;
      if (navKey === 'wanted') { var wz = $('admWanted'); if (wz) wz.scrollIntoView({ block: 'start' }); }
    }
    show(curTab);
    shade.querySelector('.adm-x').addEventListener('click', close);
    root.addEventListener('input', function (ev) { if (ev.target && ev.target.id === 'admBq') { bq = ev.target.value; paintBoard(); } });
    root.addEventListener('click', function (ev) {
      var bsb = ev.target.closest('[data-bs]'); if (bsb) { bsort = bsb.getAttribute('data-bs'); boardSig = ''; paintBoard(); return; }
      
      var xr = ev.target.closest('[data-xr]'); if (xr) { if (!handlers.xrecheck) { xMsg = 'NOT CONNECTED YET'; paintX(); return; } var xid = xr.getAttribute('data-xr'); xMsg = 'CHECKING THE POSTS ON X…'; xSig = ''; paintX(); handlers.xrecheck(xid === 'all' ? 0 : Number(xid)).then(function (r) { xMsg = r && r.checked != null ? 'CHECKED ' + r.checked + ': ' + r.verified + ' VERIFIED, ' + r.unverified + ' UNVERIFIED' + (r.unknown ? ', ' + r.unknown + ' COULD NOT BE REACHED' : '') : 'DONE'; xSig = ''; paintX(); }, function (e) { xMsg = String((e && e.message) || 'COULD NOT CHECK').toUpperCase(); xSig = ''; paintX(); }); return; }
      var tf = ev.target.closest('[data-tf2]'); if (tf) { var gr = root.querySelector('.cgrid'), v = tf.getAttribute('data-tf2'); gr.setAttribute('data-f', v); Array.prototype.forEach.call(root.querySelectorAll('[data-tf2]'), function (x) { x.classList.toggle('on', x === tf); }); return; }
      var c = ev.target.closest('.cth[data-cn]'); if (c) { wsel = +c.getAttribute('data-cn'); wMsg = ''; wSig = ''; paintWanted(); return; }
      if (ev.target.closest('#admWLaunch')) { if (!wsel) return; wantedAct(handlers.wantedLaunch ? handlers.wantedLaunch(wsel, wHours) : Promise.reject(new Error('Not connected yet')), 'LAUNCHED. THE EMAIL IS ON ITS WAY TO EVERY PLAYER'); return; }
      if (ev.target.closest('#admWEnd')) { wantedAct(handlers.wantedEnd ? handlers.wantedEnd() : Promise.reject(new Error('Not connected yet')), 'THE WANTED CARD WAS ENDED'); return; }
      var ft = ev.target.closest('[data-ft]'); if (ft) { flagTab = ft.getAttribute('data-ft'); flagSig = ''; paintFlag(); return; }
      var fb = ev.target.closest('[data-fa]'); if (fb && handlers.flag) { fb.disabled = true; flagSig = ''; handlers.flag(fb.getAttribute('data-r'), fb.getAttribute('data-fa')).then(function () { flagSig = ''; paintFlag(); }, function () { fb.disabled = false; }); return; }
    });
    root.addEventListener('click', function (ev) { var g = ev.target.closest('[data-go]'); if (g) show(g.getAttribute('data-go')); });
    $('admNav').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (b && b.getAttribute('data-t')) show(b.getAttribute('data-t')); });
    shade.onkeydown = function (ev) { if (/^[1-9]$/.test(ev.key) && !/INPUT|TEXTAREA/.test((ev.target || {}).tagName || '')) show(NAV[+ev.key - 1][0]); };
    shade.tabIndex = -1; shade.focus();
    $('admOut').addEventListener('click', function () { try { sessionStorage.removeItem('hall-admin'); } catch (e) {} if (window.HallNet) HallNet.admin.logout(); close(); });
    var mtab = 'c';
    function lists() {
      var m = (feed && feed.mails) || [];
      var box = $('admML'), tabS = document.querySelector('#admMT button[data-k="s"]'); if (tabS) tabS.textContent = 'SENT' + (m.length ? ' (' + m.length + ')' : '');
      if (mtab === 's') box.innerHTML = m.length ? '<div class="hint" style="margin-bottom:10px">Every email that went out, newest first: your own mail and the wanted card emails sent when you launch a card. Each one is in every signed-in player&rsquo;s Mail app. OPENED shows how many players have opened it so far (out of ' + fmt((feed && feed.signedIn) || 0) + ' signed in).</div>' + m.map(function (x) { var wanted = x.kind === 'wanted'; return '<div class="srow2 sent"><div class="sh"><i class="' + (wanted ? 'wk' : 'mk') + '">' + (wanted ? 'WANTED CARD' : 'MIMU MAIL') + '</i><em>' + stamp(x.ts) + '</em><em>OPENED BY ' + fmt(x.opened || 0) + '</em></div><b>' + esc(x.subject) + '</b><span class="sb">' + esc(x.body) + '</span></div>'; }).join('') : '<div class="srow2 none">NO MAIL SENT YET</div>';
    }
    function done(el, p, okText) {
      el.className = 'cmsg'; if (!p) { el.textContent = 'NOT CONNECTED YET · NOTHING WAS SENT'; el.classList.add('bad'); return; }
      el.textContent = 'SENDING…'; p.then(function () { el.textContent = okText; el.classList.add('ok'); lists(); }, function (e) { el.textContent = String((e && e.message) || 'COULD NOT SEND').toUpperCase(); el.classList.add('bad'); });
    }
    /* HYPE inbox: threads on the left, the open conversation on the right */
    var hxSel = null, hxSig = '', hxListSig = '';
    function threads() {
      var f = feed || {}, t = (f.hypeThreads || []).slice();
      if (!t.length && f.hypes && f.hypes.length) { var by = {}; f.hypes.forEach(function (x) { var n = x.to || x.rn || ''; (by[n] = by[n] || { name: n, ts: 0, unread: 0, messages: [] }).messages.push({ me: true, body: x.body, ts: x.ts }); by[n].ts = Math.max(by[n].ts, x.ts || 0); }); t = Object.keys(by).map(function (k) { return by[k]; }); }
      if (hxSel && !t.some(function (x) { return x.name === hxSel; })) t.unshift({ name: hxSel, ts: 0, unread: 0, messages: [] });
      return t.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    }
    function paintHype() {
      var t = threads(), sig = JSON.stringify(t.map(function (x) { return [x.name, x.ts, x.unread, (x.messages || []).length]; })) + '|' + hxSel;
      if (sig !== hxListSig) { hxListSig = sig; $('admHT').innerHTML = t.length ? t.map(function (x) { var last = x.last || ((x.messages || []).slice(-1)[0] || {}).body || 'NO MESSAGES YET'; return '<button type="button" class="hxt' + (x.name === hxSel ? ' on' : '') + '" data-n="' + esc(x.name) + '"><span class="av">' + esc((x.name || '?').charAt(0).toUpperCase()) + '</span><span class="mid"><b>' + esc(x.name) + '</b><em>' + esc(last) + '</em></span><span class="tm">' + (x.ts ? stamp(x.ts) : '') + (x.unread ? '<i>' + x.unread + '</i>' : '') + '</span></button>'; }).join('') : '<div class="srow2 none">NO CONVERSATIONS YET &middot; PLAYER REPLIES AND NEW TEXTS APPEAR HERE</div>'; }
      var cur = t.filter(function (x) { return x.name === hxSel; })[0], msgs = cur ? (cur.messages || []) : [], s2 = hxSel + '|' + msgs.length + '|' + (msgs.length ? msgs[msgs.length - 1].ts : 0);
      if (s2 !== hxSig) { hxSig = s2; $('admHTitle').textContent = hxSel ? 'TEXTS WITH ' + String(hxSel).toUpperCase() : 'PICK A CONVERSATION'; var lg = $('admHLog'); lg.innerHTML = hxSel ? (msgs.length ? msgs.map(function (m) { return '<div class="hxb' + (m.me ? ' me' : '') + '"><span>' + esc(m.body).replace(/\n/g, '<br>') + '</span><small>' + (m.me ? 'HYPE' : esc(hxSel)) + ' &middot; ' + stamp(m.ts) + '</small></div>'; }).join('') : '<div class="srow2 none">NO MESSAGES YET &middot; WRITE THE FIRST ONE BELOW</div>') : '<div class="srow2 none">SELECT A CONVERSATION ON THE LEFT, OR START A NEW TEXT</div>'; lg.scrollTop = lg.scrollHeight; }
    }
    $('admHT').addEventListener('click', function (ev) { var b = ev.target.closest('.hxt'); if (!b) return; hxSel = b.getAttribute('data-n'); hxSig = ''; hxListSig = ''; if (handlers.markRead) handlers.markRead(hxSel); paintHype(); $('admHBody').focus(); });
    $('admHNew').addEventListener('click', function () { var n = $('admHTo').value.trim(); if (!n) { var el = $('admHMsg'); el.className = 'cmsg bad'; el.textContent = 'TYPE A PLAYER USERNAME FIRST'; return; } hxSel = n; $('admHTo').value = ''; hxSig = ''; hxListSig = ''; $('admHMsg').textContent = ''; paintHype(); $('admHBody').focus(); });
    $('admHSend').addEventListener('click', function () {
      var body = $('admHBody').value.trim(), el = $('admHMsg');
      if (!hxSel || !body) { el.className = 'cmsg bad'; el.textContent = hxSel ? 'WRITE A MESSAGE FIRST' : 'PICK A CONVERSATION OR START A NEW TEXT'; return; }
      done(el, handlers.hype ? handlers.hype(hxSel, body) : null, 'SENT AS HYPE'); if (handlers.hype) $('admHBody').value = '';
    });
    $('admMSend').addEventListener('click', function () {
      var s = $('admMS').value.trim(), b = $('admMB').value.trim(), el = $('admMMsg');
      if (!s || !b) { el.className = 'cmsg bad'; el.textContent = 'WRITE A SUBJECT AND A MESSAGE'; return; }
      done(el, handlers.mail ? handlers.mail(s, b) : null, 'SENT TO EVERYONE SIGNED IN'); if (handlers.mail) { $('admMS').value = ''; $('admMB').value = ''; }
    });
    $('admMT').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return; mtab = b.getAttribute('data-k');
      Array.prototype.forEach.call(b.parentNode.children, function (x) { x.classList.toggle('on', x === b); });
      $('admMC').style.display = mtab === 'c' ? '' : 'none'; $('admML').style.display = mtab === 'c' ? 'none' : ''; lists();
    });
    /* USER TEXTS: every text between players, read-only (the server sends it from /admin/texts while this page is open) */
    var utx = { data: null, s: 'all', a: '', b: '', p: '', q: '', busy: false, at: 0, sig: '', msg: '', qt: 0, openKey: '' };
    function nameTag(w) { return '<span class="utn' + (w.banned ? ' ban' : '') + '" title="' + esc(w.address) + '">' + esc(w.name) + '</span>' + (w.banned ? ' <i class="utb">BANNED</i>' : ''); }
    function utxQs() { var q = ['s=' + utx.s]; if (utx.a && utx.b) q.push('a=' + utx.a, 'b=' + utx.b); if (utx.p) q.push('p=' + utx.p); if (utx.q) q.push('q=' + encodeURIComponent(utx.q)); return '?' + q.join('&'); }
    function utxTick(force) {
      if (curTab !== 'utx' || !handlers.texts || utx.busy) return;
      if (!force && Date.now() - utx.at < 3000) return;
      utx.busy = true; utx.at = Date.now();
      handlers.texts(utxQs()).then(function (d) { utx.data = d; utx.busy = false; utx.msg = ''; paintUtx(); }, function (e) { utx.busy = false; utx.msg = 'COULD NOT LOAD THE TEXTS: ' + String((e && e.message) || 'TRY AGAIN').toUpperCase(); paintUtx(true); });
    }
    function paintUtx(force) {
      var d = utx.data; if (!d || !$('admUtxS')) return;
      var c0 = {}; for (var k0 in d) if (k0 !== 'at') c0[k0] = d[k0];
      var sig = JSON.stringify(c0) + '|' + utx.s + '|' + utx.a + '|' + utx.b + '|' + utx.p + '|' + utx.q + '|' + utx.msg;
      if (sig === utx.sig && !force) return; utx.sig = sig;
      var st = d.stats || {}, convs = d.conversations || [], th = d.thread, res = d.results;
      var tile = function (n, l) { return '<div class="utxs"><b>' + n + '</b><span>' + l + '</span></div>'; }, f = function (n) { return Number(n || 0).toLocaleString('en-US'); };
      $('admUtxS').innerHTML = tile(f(st.texts), utx.s === 'all' ? 'TEXTS IN ALL' : utx.s === 'players' ? 'TEXTS BETWEEN PLAYERS' : utx.s === 'mimu' ? 'MIMU NOTICES' : 'TEXTS WITH HYPE') + tile(f(st.conversations), 'CONVERSATIONS') + tile(f(st.senders), 'DIFFERENT SENDERS') + tile(f(st.last24h), 'LAST 24 HOURS') + tile(f(st.lastHour), 'LAST HOUR') + tile(f(st.unread), 'NOT OPENED YET') + tile(f(st.blocks), 'BLOCKS') +
        '<div class="utxs wide"><span>BUSIEST SENDERS</span><em>' + ((st.top || []).length ? st.top.map(function (t) { return '<a data-pf="' + esc(t.address) + '">' + esc(t.name) + ' (' + f(t.texts) + ')</a>'; }).join(' &middot; ') : 'NO TEXTS YET') + '</em></div>' + (st.firstAt ? '<div class="utxs wide"><span>FIRST TEXT EVER</span><em>' + stamp(st.firstAt) + '</em></div>' : '');
      var kd = d.kinds || {}, SC = [['all', 'ALL TEXTS'], ['players', 'PLAYER TO PLAYER'], ['mimu', 'MIMU NOTICES'], ['hype', 'HYPE']];
      $('admUtxScope').innerHTML = SC.map(function (x) { return '<button type="button" data-s="' + x[0] + '"' + (utx.s === x[0] ? ' class="on"' : '') + '>' + x[1] + ' (' + f(kd[x[0]]) + ')</button>'; }).join('');
      var msg = $('admUtxMsg'); msg.className = 'cmsg' + (utx.msg ? ' bad' : ''); msg.textContent = utx.msg;
      var chip = '', pw = utx.p && (convs.length ? (convs[0].a.address === utx.p ? convs[0].a : convs[0].b) : null);
      if (utx.p) chip += '<span class="utxc">SHOWING ONLY ' + (pw ? esc(pw.name) : esc(utx.p.slice(0, 8))) + '&rsquo;S TEXTS</span>'; if (utx.q) chip += '<span class="utxc">SEARCH: ' + esc(utx.q) + '</span>';
      $('admUtxChip').innerHTML = chip;
      var lst = $('admUtxList'), lt = lst.scrollTop;
      $('admUtxListH').textContent = (utx.p ? 'THIS PLAYER\u2019S CONVERSATIONS' : 'CONVERSATIONS') + ' \u00b7 ' + convs.length + (convs.length >= 200 ? '+ (NEWEST 200)' : '');
      lst.innerHTML = convs.length ? convs.map(function (c) {
        var on = utx.a === c.a.address && utx.b === c.b.address, lf = c.lastFrom === 'a' ? c.a.name : c.b.name;
        return '<button type="button" class="hxt utc' + (on ? ' on' : '') + '" data-a="' + esc(c.a.address) + '" data-b="' + esc(c.b.address) + '"><span class="av">' + esc((c.a.name || '?').charAt(0).toUpperCase() + (c.b.name || '?').charAt(0).toUpperCase()) + '</span><span class="mid"><b>' + esc(c.a.name) + ' \u2194 ' + esc(c.b.name) + '</b><em>' + esc(lf) + ': ' + esc(c.last) + '</em></span><span class="tm">' + stamp(c.lastAt) + '<i>' + c.texts + '</i></span></button>';
      }).join('') : '<div class="hint">NO CONVERSATIONS ' + (utx.p ? 'FOR THIS PLAYER' : 'YET') + '.</div>';
      lst.scrollTop = lt;
      var head = $('admUtxHead'), log = $('admUtxLog'), acts = $('admUtxActs');
      if (th && th.messages) {
        var ms = th.messages, a = th.a, b = th.b, nA = ms.filter(function (m) { return m.from === a.address; }).length, nB = ms.length - nA;
        head.innerHTML = '<div class="utxh"><b>' + nameTag(a) + ' \u2194 ' + nameTag(b) + '</b><span>' + ms.length + ' TEXT' + (ms.length === 1 ? '' : 'S') + (ms.length ? ' &middot; ' + stamp(ms[0].ts) + ' TO ' + stamp(ms[ms.length - 1].ts) : '') + '</span></div>' +
          '<div class="utxd"><span><b>' + esc(a.name) + '</b> ' + esc(a.address) + ' &middot; SENT ' + nA + (a.lastSeen ? ' &middot; LAST SEEN ' + stamp(a.lastSeen) : '') + (th.aBlockedB ? ' &middot; <u>HAS BLOCKED ' + esc(b.name) + '</u>' : '') + '</span><span><b>' + esc(b.name) + '</b> ' + esc(b.address) + ' &middot; SENT ' + nB + (b.lastSeen ? ' &middot; LAST SEEN ' + stamp(b.lastSeen) : '') + (th.bBlockedA ? ' &middot; <u>HAS BLOCKED ' + esc(a.name) + '</u>' : '') + '</span></div>';
        var atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40, fresh = utx.openKey !== a.address + b.address; utx.openKey = a.address + b.address;
        log.innerHTML = ms.length ? ms.map(function (m) { var fromA = m.from === a.address; return '<div class="hxb' + (fromA ? '' : ' me') + '"><span>' + esc(m.body).replace(/\n/g, '<br>') + '</span><small>' + esc(m.fromName) + ' \u2192 ' + esc(m.toName) + ' &middot; ' + stamp(m.ts) + ' &middot; ' + (m.read ? 'READ' : 'UNREAD') + '</small></div>'; }).join('') : '<div class="hint">NO TEXTS BETWEEN THESE TWO PLAYERS.</div>';
        if (fresh || atBottom) log.scrollTop = log.scrollHeight;
        acts.innerHTML = '<button type="button" data-hx="' + esc(a.name) + '">TEXT ' + esc(a.name) + ' AS HYPE</button><button type="button" data-hx="' + esc(b.name) + '">TEXT ' + esc(b.name) + ' AS HYPE</button><button type="button" data-pf="' + esc(a.address) + '">SHOW ALL OF ' + esc(a.name) + '&rsquo;S TEXTS</button><button type="button" data-pf="' + esc(b.address) + '">SHOW ALL OF ' + esc(b.name) + '&rsquo;S TEXTS</button>';
      } else { head.innerHTML = '<div class="utxh"><b>PICK A CONVERSATION</b><span>CLICK ONE ON THE LEFT TO READ ALL OF IT</span></div>'; log.innerHTML = ''; acts.innerHTML = ''; utx.openKey = ''; }
      var row = function (m) { return '<div class="utxr" data-a="' + esc(m.from < m.to ? m.from : m.to) + '" data-b="' + esc(m.from < m.to ? m.to : m.from) + '"><div class="utxrh"><span>' + nameTag({ name: m.fromName, address: m.from, banned: m.fromBanned }) + ' <i>\u2192</i> ' + nameTag({ name: m.toName, address: m.to, banned: m.toBanned }) + '</span><em>' + stamp(m.ts) + ' &middot; ' + (m.read ? 'READ' : 'UNREAD') + '</em></div><p>' + esc(m.body).replace(/\n/g, '<br>') + '</p></div>'; };
      var list = res ? res : (d.recent || []);
      $('admUtxAllH').textContent = res ? 'SEARCH RESULTS FOR \u201c' + utx.q.toUpperCase() + '\u201d \u00b7 ' + res.length + (res.length >= 150 ? '+' : '') : (utx.p ? 'THIS PLAYER\u2019S NEWEST TEXTS' : utx.s === 'players' ? 'THE NEWEST TEXTS BETWEEN PLAYERS' : utx.s === 'mimu' ? 'THE NEWEST MIMU NOTICES' : utx.s === 'hype' ? 'THE NEWEST TEXTS WITH HYPE' : 'THE NEWEST TEXTS ON THE WHOLE SERVICE');
      $('admUtxAll').innerHTML = list.length ? list.map(row).join('') : '<div class="hint">' + (res ? 'NOTHING MATCHES THAT SEARCH.' : 'NO TEXTS YET.') + '</div>';
      var bl = d.blocks || [];
      $('admUtxBlk').innerHTML = bl.length ? bl.map(function (x) { return '<div class="utxr"><div class="utxrh"><span>' + nameTag(x.by) + ' <i>HAS BLOCKED</i> ' + nameTag(x.blocked) + '</span></div></div>'; }).join('') : '<div class="hint">NOBODY HAS BLOCKED ANYONE.</div>';
    }
    (function () {
      var box = shade.querySelector('section[data-p="utx"]'); if (!box) return;
      box.addEventListener('click', function (ev) {
        var c = ev.target.closest('.utc, .utxr[data-a]'); if (c && c.getAttribute('data-a')) { utx.a = c.getAttribute('data-a'); utx.b = c.getAttribute('data-b'); utx.openKey = ''; utx.at = 0; utxTick(true); return; }
        var hx = ev.target.closest('[data-hx]'); if (hx) { hxSel = hx.getAttribute('data-hx'); hxSig = ''; hxListSig = ''; show('msg'); paintHype(); var hb = $('admHBody'); if (hb) hb.focus(); return; }
        var sb = ev.target.closest('[data-s]'); if (sb) { utx.s = sb.getAttribute('data-s'); utx.a = ''; utx.b = ''; utx.p = ''; utx.openKey = ''; utx.at = 0; utx.sig = ''; utxTick(true); return; }
        var pf = ev.target.closest('[data-pf]'); if (pf) { utx.p = pf.getAttribute('data-pf'); utx.a = ''; utx.b = ''; utx.q = ''; $('admUtxQ').value = ''; utx.at = 0; utxTick(true); return; }
      });
      $('admUtxQ').addEventListener('input', function () { var v = this.value.trim(); clearTimeout(utx.qt); utx.qt = setTimeout(function () { utx.q = v; utx.at = 0; utxTick(true); }, 400); });
      $('admUtxClr').addEventListener('click', function () { utx.q = ''; utx.p = ''; utx.a = ''; utx.b = ''; utx.s = 'all'; utx.openKey = ''; $('admUtxQ').value = ''; utx.at = 0; utxTick(true); });
    })();
    function clock() { try { $('admClock').textContent = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase() + ' · LOS ANGELES'; } catch (e) {} }
    var plFed = false, ecoSig = '';
    function refresh() {
      clock(); $('admPills').innerHTML = pills(); $('admSys').innerHTML = sysRows(); $('admVT').innerHTML = visTiles(); paintWNow(); $('admVis').innerHTML = visPanels(); $('admTiles').innerHTML = tiles(); paintLive('admLB2'); paintFlag(); paintBoard(); paintX(); paintEgg(); paintSec(); paintNft(); paintWanted(); $('admAct').innerHTML = activity(); var eh = ecoHtml(); if (eh !== ecoSig) { ecoSig = eh; $('admEco').innerHTML = eh; } $('admCards').innerHTML = cardBars(); paintCardsPage();
      if (feed && feed.players && !plFed) { plFed = true; $('admPl').innerHTML = feed.players.slice(0, 500).map(function (p) { return '<option value="' + esc(p.name) + '">'; }).join(''); }
      lists(); paintHype(); utxTick();
    }
    refresh(); clearInterval(tick); tick = setInterval(refresh, 1000);
  }
  /* later: HallAdmin.setFeed({ visitors:{today,total}, runs:{today,total}, live:[{name,score,alive,cards}], cardsFound, topScore, longest, signedIn, messagesToday,
       economy:{coinsEarned,coinsSpent,cardsBought,cardsSold,pointsPaid,coinsPerRun}, cardsByTier:[...], series:{visitors,runs,signedIn,cards,coins,messages}, activity:[{ts,text}],
       players:[{name}], hypeThreads:[{name,last,ts,unread,messages:[{me,body,ts}]}], mails:[{subject,body,ts}], status:{cloudflare,glyph,market,texts,mail} })
     and HallAdmin.setHandlers({ hype(to, body) -> Promise, mail(subject, body) -> Promise, markRead(name) }) */
  window.HallAdmin = { setFeed: function (f) { feed = f; }, setHandlers: function (h) { handlers = h || {}; }, open: openPanel };
})();
