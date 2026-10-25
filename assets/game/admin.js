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
    var c = P.config, s = c.sight, pk = c.pack, hp = c.hp;
    var items = [
      ['SPEED CLIMB', '+' + c.climb.pct + '% every ' + hms(c.climb.everySec) + ' alive, compounding, no cap'],
      ['CARD SIGHTING', 'one every ' + hms(s.everySec) + ' alive; jump to collect'],
      ['TIER LOCKS (TIME ALIVE)', P.tiers.map(function (t, i) { return t.name + ' ' + (s.locksSec[i] ? hms(s.locksSec[i]) : 'start'); }).join(' · ')],
      ['ODDS WHEN OPEN', P.tiers.map(function (t, i) { return t.name + ' ' + s.odds[i] + '%'; }).join(' · ')],
      ['UNLOCK RULE', 'a tier opens when you have collected ' + Math.round(s.unlockShare * 100) + '% of the tier below'],
      ['LUCKY CHANCE', 'after ' + hms(s.lucky.afterSec) + ': Prestige ' + (s.lucky.prestige * 100) + '%, Legendary ' + (s.lucky.legendary * 100) + '% per sighting'],
      ['DUPLICATES', Math.round(s.dupChance * 100) + '% of sightings may repeat a card already collected'],
      ['THE PACK', 'first at ' + hms(pk.firstSec) + ', then every ' + hms(pk.everySec) + '; jump it: ' + pk.slowPct + '% slower for ' + pk.slowSec + ' s, no other bonus'],
      ['HEALTH', hp.segments + ' segments. Plain box ' + hp.dmg.plain + ' (3 hits), blue ' + hp.dmg.blue + ' (2 hits), red ' + hp.dmg.red + ' (1 hit)'],
      ['SCORING', 'distance + ' + c.coinPoints + ' per coin; every run adds to the lifetime total'],
      ['COINS', 'every coin adds to lifetime coins earned; the balance is earned minus spent'],
      ['MARKETPLACE', 'buy cards with coins; sell any collected card for leaderboard points'],
      ['EXTRA LIFE', 'after a crash, one extra life per run for ' + Math.round(c.life.share * 100) + '% of the player\'s points (not coins); crash again and the run ends'],
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
    ['WATCH', 'g1', [['ov', 'OVERVIEW', 'visitors, funnel and site health'], ['live', 'LIVE RUNS', 'who is playing right now'], ['flag', 'FLAGGED RUNS', 'runs held for review: approve, deny or ban'], ['cards', 'CARDS', 'the 120 cards, pictured']]],
    ['TALK', 'g2', [['msg', 'HYPE TEXTS', 'text players as HYPE and read their replies'], ['mail', 'MIMU MAIL', 'send announcements as MIMU (outgoing only)']]],
    ['MONEY', 'g3', [['eco', 'ECONOMY', 'coins, points, prices and trades']]],
    ['LEARN', 'g4', [['rules', 'GAME RULES', 'the live game numbers'], ['site', 'SITE GUIDE', 'every page and icon'], ['sys', 'SYSTEMS', 'how each part works'], ['data', 'DATA CONTRACT', 'what the server sends'], ['road', 'CHECKLIST', 'what is done and next']]]
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
  /* ---------- the top of the overview: the wanted card shortcut, and the list HYPE has to approve (shared by everyone who is signed in to the control room) ---------- */
  var APPR = [['length', 'HOW LONG THE GAME WILL LAST'], ['start', 'WHEN THE GAME STARTS'], ['end', 'WHEN THE GAME ENDS'], ['haul', 'WHEN THE HAUL RUN ENDS AND THE GIVING BEGINS'], ['demo', 'HYPE HAS PLAYED THE DEMO, SO WE CAN FINISH CONNECTING GLYPH'], ['live', 'WE ARE READY TO GO LIVE']], apprSig = '', apprMsg = '';
  function paintWNow() {
    var el = $('admWNow'); if (!el) return; var w = feed && feed.wanted && feed.wanted.active, sig = w ? 'live' + w.id : 'none'; if (el.getAttribute('data-s') === sig) return; el.setAttribute('data-s', sig);
    el.innerHTML = '<div class="wnt"><small>' + (w ? 'A WANTED CARD IS LIVE' : 'WANTED CARD') + '</small><b>' + (w ? esc(w.name.toUpperCase()) + ' #' + String(w.card).padStart(3, '0') : 'LAUNCH A WANTED CARD NOW') + '</b><span>' + (w ? 'See the timer, or end it, on the Cards page.' : 'Pick a card, choose how many hours, and every player gets the email.') + '</span></div><button type="button" class="wgo" data-go="cards">' + (w ? 'OPEN THE CARDS PAGE' : 'GO TO LAUNCH') + ' &rarr;</button>';
  }
  function paintAppr() {
    var el = $('admAppr'); if (!el) return; var ap = (feed && feed.approvals) || {}, sig = JSON.stringify([ap, !!feed, apprMsg]); if (sig === apprSig) return; apprSig = sig;
    var n = APPR.filter(function (a) { return ap[a[0]]; }).length;
    el.innerHTML = '<h4>FOR HYPE TO APPROVE <em>' + n + ' OF ' + APPR.length + '</em></h4><div class="apl">' + APPR.map(function (a) { var at = ap[a[0]]; return '<button type="button" class="api' + (at ? ' on' : '') + '" data-ap="' + a[0] + '" aria-pressed="' + !!at + '"><i>' + (at ? '&#10003;' : '') + '</i><span>' + a[1] + '</span><em>' + (at ? 'APPROVED &middot; ' + stamp(at) : 'WAITING') + '</em></button>'; }).join('') + '</div><div class="apn">' + (apprMsg || (feed ? 'Tap a box to approve it. It turns green for every admin, on any device, within a few seconds. Tap again to take the approval back.' : 'NOT CONNECTED YET: THE LIST FILLS IN WHEN THE LIVE FEED IS CONNECTED.')) + '</div>';
  }
  function apprToggle(k) {
    if (!handlers.approve || !feed) { apprMsg = 'NOT CONNECTED YET'; apprSig = ''; paintAppr(); return; }
    feed.approvals = feed.approvals || {}; var on = !feed.approvals[k]; if (on) feed.approvals[k] = Date.now(); else delete feed.approvals[k]; apprMsg = ''; apprSig = ''; paintAppr();
    handlers.approve(k, on).then(function () { apprSig = ''; paintAppr(); }, function (e) { if (on) delete feed.approvals[k]; else feed.approvals[k] = Date.now(); apprMsg = String((e && e.message) || 'COULD NOT SAVE').toUpperCase(); apprSig = ''; paintAppr(); });
  }
  function ovHtml() {
    return '<section data-p="ov"><div class="wnow" id="admWNow"></div><div class="tiles vis" id="admVT"></div><div class="appr" id="admAppr"></div>' + mindMap() + (feed ? '' : '<div class="crnote">THE LIVE NUMBERS FILL IN WHEN CLOUDFLARE IS CONNECTED &middot; UNTIL THEN THE SYSTEM CHECK AND THIS BROWSER BOX ARE REAL</div>') +
      '<div id="admVis"></div>' +
      '<div class="box dbox"><h4>THE GAME AT A GLANCE</h4><div class="tiles" id="admTiles"></div></div>' +
      '<div class="cols2"><div class="box"><h4>SYSTEM CHECK</h4><div class="sys one" id="admSys"></div></div><div class="box"><h4>THIS BROWSER</h4>' + thisBrowser() + '</div></div>' +
      '<div class="box"><h4>ACTIVITY</h4><div class="acts" id="admAct"></div></div></section>';
  }
  /* ---------- FLAGGED RUNS: runs the server held back because something did not add up ---------- */
  var FLAG_TEXT = {
    TIME_MISMATCH: 'The time the run claims does not match the clock on the server.', DISTANCE_TOO_FAR: 'More distance than the speed limit allows for that time.', SCORE_TOO_HIGH: 'The score is higher than distance and coins can explain.',
    COINS_TOO_HIGH: 'More coins than a run could have picked up.', INPUT_TOO_FAST: 'Jumps, slides or lane changes faster than a hand can do.', TOO_MANY_HITS: 'More box hits than a run can survive.', BOXES_TOO_MANY: 'More boxes cleared than the road holds.',
    PACK_TOO_EARLY: 'A black pack was collected before the first one could appear.', TOO_MANY_CARDS: 'More cards than the sighting timetable allows.', TIER_NOT_OPEN: 'A card of a rarity that was not open yet at that time.', UNKNOWN_CARD: 'A card number that does not exist.',
    NO_INPUT: 'A long run with no moves at all (a bot or an idle script).', FEW_HEARTBEATS: 'The game did not report in while it ran (a result sent without playing).', LIFE_NOT_PURCHASED: 'An extra life was used without being bought.'
  };
  var flagSig = '', flagTab = 'l';
  function flagCard(r, held) {
    var e = r.extra || {}, miles = ((r.distance || 0) / 1609.34).toFixed(2), reasons = (r.flags || []).map(function (f) { return '<li><b>' + esc(f.code) + '</b><span>' + esc(f.note || FLAG_TEXT[f.code] || '') + '</span></li>'; }).join('');
    return '<div class="fgc' + (held ? '' : ' done') + '"><div class="fgh"><b>' + esc(r.name) + '</b><span>' + esc(String(r.address || '').slice(0, 6) + '…' + String(r.address || '').slice(-4)) + '</span><em>' + stamp(r.ts) + (r.banned ? ' · BANNED' : '') + (held ? '' : ' · ' + String(r.status).toUpperCase()) + '</em></div>' +
      '<div class="fgs"><span><small>SCORE</small>' + fmt(r.score) + '</span><span><small>TIME ALIVE</small>' + dur(r.alive) + '</span><span><small>COINS</small>' + fmt(r.coins) + '</span><span><small>DISTANCE</small>' + miles + ' MI</span><span><small>CARDS CLAIMED</small>' + (r.cards || []).length + '</span><span><small>JUMPS</small>' + fmt(e.jumps) + '</span><span><small>SLIDES</small>' + fmt(e.slides) + '</span><span><small>LANES</small>' + fmt(e.lanes) + '</span><span><small>BOXES CLEARED</small>' + fmt(e.boxesJumped) + '</span><span><small>HITS</small>' + fmt(e.hits) + '</span><span><small>PACKS</small>' + fmt(e.packs) + '</span><span><small>EXTRA LIFE</small>' + (e.extraLife ? 'YES' : 'NO') + '</span></div>' +
      '<ul class="fgr">' + (reasons || '<li><b>REVIEWED</b><span>This run was held and then reviewed.</span></li>') + '</ul>' +
      (held ? '<div class="fga"><button type="button" class="ok" data-fa="approve" data-r="' + esc(r.id) + '">APPROVE</button><button type="button" data-fa="remove" data-r="' + esc(r.id) + '">DENY</button><button type="button" class="bad" data-fa="ban" data-r="' + esc(r.id) + '">BAN</button><span class="fgn">APPROVE: the run counts &middot; DENY: the run is thrown away &middot; BAN: the player is removed</span></div>' : '') + '</div>';
  }
  function paintFlag() {
    var el = $('admFlag'); if (!el) return; var f = (feed && feed.flagged) || { held: [], resolved: [] }, n = $('admFlagN'); if (n) n.textContent = f.held.length ? '(' + f.held.length + ')' : '';
    var sig = JSON.stringify([f.held.map(function (r) { return r.id; }), f.resolved.map(function (r) { return r.id + r.status; }), !!feed]); if (sig === flagSig) return; flagSig = sig;
    el.innerHTML = '<div class="box dbox"><h4>WAITING FOR YOUR REVIEW (' + f.held.length + ')</h4><div class="hint" style="margin-bottom:12px">A run is held, and does not count toward points, cards or badges, when the server finds a reason below. Decide from the run details on each card: APPROVE to count it, DENY to throw it away, or BAN the player.</div>' +
      (f.held.length ? f.held.map(function (r) { return flagCard(r, true); }).join('') : '<div class="rk none">' + (feed ? 'NO FLAGGED RUNS. EVERYTHING LOOKS CLEAN.' : 'WAITING FOR THE LIVE FEED') + '</div>') + '</div>' +
      '<div class="box dbox"><h4>RECENTLY REVIEWED</h4>' + (f.resolved.length ? f.resolved.map(function (r) { return flagCard(r, false); }).join('') : '<div class="rk none">NOTHING REVIEWED YET</div>') + '</div>' +
      '<div class="box dbox"><h4>WHAT GETS A RUN FLAGGED</h4><ul class="fgl">' + Object.keys(FLAG_TEXT).map(function (k) { return '<li><b>' + k + '</b><span>' + esc(FLAG_TEXT[k]) + '</span></li>'; }).join('') + '</ul></div>';
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
      h += '<div class="wlive"><img src="' + esc(ac ? ac.file : '') + '" alt=""><div><small>LIVE NOW</small><b>' + esc(act.name) + ' #' + String(act.card).padStart(3, '0') + '</b><em>' + esc(act.tier.toUpperCase()) + ' &middot; RUNS FOR ' + act.hours + (act.hours === 1 ? ' HOUR' : ' HOURS') + '</em><strong id="admWTimer">--:--:--</strong><span class="ph">' + (act.phase === 'dropped' ? 'DROPPED ON ' + esc(String(act.target).toUpperCase()) + ', WAITING FOR THEM TO JUMP IT' : 'WAITING: THE CARD DROPS AT A RANDOM MOMENT ON A LIVE RUNNER') + '</span><small>DROPS SO FAR: ' + fmt(act.attempts) + '</small></div></div><button type="button" class="end" id="admWEnd">END WANTED CARD</button><div class="wmsg" id="admWMsg">' + esc(wMsg) + '</div>';
    } else {
      h += '<div class="wform"><label for="admWH">HOW LONG IT RUNS</label><select id="admWH">' + opts + '</select><button type="button" class="launch" id="admWLaunch"' + (sel ? '' : ' disabled') + '>LAUNCH</button></div><div class="hint">ONE WANTED CARD AT A TIME. LAUNCHING SENDS A MIMU EMAIL TO EVERYONE WHO HAS SIGNED IN, SHOWING THE CARD WITH A LIVE COUNTDOWN. AT A RANDOM MOMENT THE CARD DROPS INTO THE RUN OF ONE PLAYER WHO IS RUNNING, AND IF THEY JUMP IT, IT GOES INTO THEIR DECK.</div><div class="wmsg" id="admWMsg">' + esc(wMsg) + '</div>';
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
    var held = e.coinsHeld != null ? e.coinsHeld : (e.coinsEarned != null && e.coinsSpent != null ? e.coinsEarned - e.coinsSpent : null);
    var tl = [
      ['COINS EARNED', fmt(e.coinsEarned), 'every coin collected', sr.coins], ['COINS SPENT', fmt(e.coinsSpent), e.coinsEarned ? Math.round((e.coinsSpent || 0) / e.coinsEarned * 100) + '% of earned' : none], ['COINS IN WALLETS', fmt(held), 'earned minus spent'],
      ['COINS PER RUN', e.coinsPerRun != null ? fmt(e.coinsPerRun) : '—', 'average finished run'], ['AVERAGE WALLET', e.avgBalance != null ? fmt(e.avgBalance) : '—', 'per signed-in player'], ['FACE DOWN SOLD', fmt(e.cardsBought), 'bought with coins'],
      ['FACE UP SOLD', fmt(e.cardsBoughtUp), 'bought with points'], ['SOLD TO THE HALL', fmt(e.cardsSold), 'for set points'], ['LISTINGS OPEN', fmt(e.listingsActive), e.cardsListed != null ? fmt(e.cardsListed) + ' ever listed' : none],
      ['POINTS FROM SALES', fmt(e.pointsPaid), 'paid out by the Hall'], ['POINTS BETWEEN PLAYERS', fmt(e.pointsMoved), 'face up trades'], ['EXTRA LIVES', fmt(e.livesBought), e.pointsSpentLives != null ? fmt(e.pointsSpentLives) + ' points spent' : none]
    ];
    var h = '<div class="tiles eco2">' + tl.map(function (x) { return '<div class="tile"><small>' + x[0] + '</small><b>' + x[1] + '</b><em>' + esc(x[2]) + '</em>' + (x[3] ? spark(x[3]) : '') + '</div>'; }).join('') + '</div>';
    h += '<div class="box dbox"><h4>WHERE COINS AND POINTS GO</h4>' + flowBar('COINS', [{ l: 'SPENT ON FACE DOWN', v: e.coinsSpent, c: 'k1' }, { l: 'SITTING IN WALLETS', v: held, c: 'k2' }], none) + flowBar('POINTS MOVING AROUND', [{ l: 'EARNED IN RUNS', v: e.pointsRuns, c: 'k2' }, { l: 'PAID BY HALL SALES', v: e.pointsPaid, c: 'k1' }, { l: 'MOVED BETWEEN PLAYERS', v: e.pointsMoved, c: 'k3' }, { l: 'SPENT ON EXTRA LIVES', v: e.pointsSpentLives, c: 'k4' }], none) + '</div>';
    var hs = '', sink = e.coinsEarned ? (e.coinsSpent || 0) / e.coinsEarned : null, infl = e.pointsRuns ? (e.pointsPaid || 0) / e.pointsRuns : null, ask = null, i;
    if (e.tiers && e.tiers[0] && e.tiers[0].coins && e.tiers[0].avgListing) ask = e.tiers[0].avgListing;
    hs += health('COIN SPENDING', sink == null ? '—' : Math.round(sink * 100) + '%', sink == null ? none || 'NO DATA YET' : sink < 0.2 ? 'COINS ARE PILING UP: THE FACE DOWN SHELF MAY BE TOO EXPENSIVE' : sink > 0.8 ? 'COINS DRAIN FAST: THE SHELF MAY BE TOO CHEAP' : 'A HEALTHY SHARE OF COINS IS BEING SPENT', sink == null ? 'off' : sink < 0.2 || sink > 0.8 ? 'warn' : 'ok');
    hs += health('HALL SALES VS RUN POINTS', infl == null ? '—' : Math.round(infl * 100) + '%', infl == null ? none || 'NO DATA YET' : infl > 0.25 ? 'SELLING TO THE HALL IS A BIG SHARE OF ALL POINTS: CHECK THE SALE VALUES' : 'RUNNING STILL DRIVES MOST POINTS', infl == null ? 'off' : infl > 0.25 ? 'warn' : 'ok');
    hs += health('LISTING ACTIVITY', e.listingsActive == null ? '—' : fmt(e.listingsActive), e.listingsActive == null ? none || 'NO DATA YET' : e.listingsActive === 0 ? 'NO PLAYER HAS A CARD FOR SALE: THE FACE UP SHELF IS EMPTY' : 'PLAYERS ARE OFFERING CARDS FOR SALE', e.listingsActive == null ? 'off' : e.listingsActive === 0 ? 'warn' : 'ok');
    h += '<div class="box dbox"><h4>ECONOMY HEALTH</h4><div class="ehs">' + hs + '</div></div>';
    var rows = P.tiers.map(function (t, k) { var x = (e.tiers || [])[k] || {}, d = function (v) { return v == null ? '—' : fmt(v); }; return ['<b style="color:' + t.color + '">' + esc(t.name.toUpperCase()) + '</b>', d(x.coins), d(x.saleValue), d(x.avgListing), d(x.listed), d(x.sold)]; });
    h += '<div class="box dbox"><h4>PRICES BY RARITY</h4><div class="hint" style="margin-bottom:12px">Face down cards cost coins and are priced by us. The Hall pays a set number of points when a player sells a card to it. Face up cards are priced in points by the players. These come from the Marketplace server.</div>' + '<div class="dtab" style="--c:6"><div class="dh"><span>RARITY</span><span>FACE DOWN (COINS)</span><span>HALL SALE (POINTS)</span><span>AVERAGE FACE UP ASK</span><span>LISTED</span><span>SOLD</span></div>' + rows.map(function (r) { return '<div class="dr">' + r.map(function (c2) { return '<span>' + c2 + '</span>'; }).join('') + '</div>'; }).join('') + '</div></div>';
    var days = (e.byDay || []), mx = Math.max.apply(null, days.map(function (d) { return d.trades || 0; }).concat([1]));
    h += '<div class="cols2"><div class="box"><h4>TRADES, LAST 14 DAYS</h4>' + (days.length ? '<div class="dbars">' + days.slice(-14).map(function (d) { return '<span title="' + esc(d.d) + ' · ' + fmt(d.trades) + ' trades"><i style="height:' + Math.max(4, (d.trades || 0) / mx * 100) + '%"></i><em>' + esc(String(d.d).slice(-2)) + '</em></span>'; }).join('') + '</div>' : '<div class="rk none">' + (feed ? 'NO DATA YET' : 'WAITING FOR THE LIVE FEED') + '</div>') + '</div>' +
      '<div class="box"><h4>MOST TRADED CARDS</h4>' + ((e.topCards || []).length ? '<div class="etop">' + e.topCards.slice(0, 8).map(function (x) { var cd = P.card ? P.card(x.n) : null; return '<div><img src="' + esc(cd ? cd.file : 'assets/game/card-back.webp') + '" alt="" loading="lazy"><b>#' + x.n + '</b><span>' + fmt(x.count) + ' TRADES</span></div>'; }).join('') + '</div>' : '<div class="rk none">' + (feed ? 'NO DATA YET' : 'WAITING FOR THE LIVE FEED') + '</div>') + '</div></div>';
    h += '<div class="cols2"><div class="box"><h4>TOP SELLERS</h4>' + rankList(e.topSellers, feed ? 'NO DATA YET' : 'WAITING FOR THE LIVE FEED') + '</div><div class="box"><h4>TOP BUYERS</h4>' + rankList(e.topBuyers, feed ? 'NO DATA YET' : 'WAITING FOR THE LIVE FEED') + '</div></div>';
    h += '<div class="box dbox"><h4>RECENT TRADES</h4><div class="acts">' + ((e.recent || []).length ? e.recent.slice(0, 14).map(function (x) { return '<div class="act"><em>' + stamp(x.ts) + '</em><span>' + esc(x.text) + '</span></div>'; }).join('') : '<div class="act none">' + (feed ? 'NO TRADES YET' : 'WAITING FOR THE LIVE FEED') + '</div>') + '</div></div>';
    h += '<div class="box dbox"><h4>THE RULES OF THE ECONOMY</h4>' + '<ul class="dl"><li><b>Coins</b> come only from runs: each coin collected is also worth ' + c.coinPoints + ' points to that run. Coins are spent only on face down cards from the Hall, which are priced high on purpose.</li><li><b>Points</b> are the leaderboard score. Face up cards from players cost points, and the points go from the buyer to the seller. Any collected card can also be sold to the Hall for a set number of points.</li><li><b>Extra life:</b> after a crash a player may buy one extra life per run for ' + Math.round(c.life.share * 100) + '% of their points. It cannot be bought twice in a run.</li><li><b>Never money:</b> only coins and points change hands. Sales are final. The cards are in-game pictures, not real-world assets.</li><li><b>Where the numbers live:</b> all prices, sale values and limits are served by the Marketplace server, so you can change them without touching the site.</li></ul></div>';
    return h;
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
      ['HYPE AND MAIL SENDING', ok(!!(handlers.hype && handlers.mail)), handlers.hype && handlers.mail ? 'READY' : 'NOT CONNECTED YET'],
      ['SOUND', 'ok', A && A.isMuted() ? 'MUTED' : 'ON · VOLUME ' + Math.round((A ? A.getVolume() : 0) * 8) + ' OF 8'],
      ['BUILD', DOCS.commit ? 'ok' : 'warn', DOCS.commit ? 'COMMIT ' + esc(DOCS.commit) + ' · ' + esc(DOCS.commits) + ' CHANGES · GUIDE ' + esc(DOCS.built) : 'GUIDE NOT LOADED'],
      ['TEST MODE', P.isTest() ? 'warn' : 'ok', P.isTest() ? 'ON (THIS BROWSER ONLY)' : 'OFF'],
      ['THIS BROWSER', 'ok', 'WINDOW ' + vw]
    ];
    return rows.map(function (r) { return '<div class="sysr ' + r[1] + '"><i></i><b>' + r[0] + '</b><span>' + r[2] + '</span></div>'; }).join('');
  }
  var NAV = [['ov', 'OVERVIEW'], ['live', 'LIVE RUNS'], ['flag', 'FLAGGED RUNS'], ['msg', 'HYPE TEXTS'], ['mail', 'MIMU MAIL'], ['eco', 'ECONOMY'], ['cards', 'CARDS'], ['rules', 'GAME RULES'], ['site', 'SITE GUIDE'], ['sys', 'SYSTEMS'], ['data', 'DATA CONTRACT'], ['road', 'CHECKLIST']];
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
    apprSig = ''; flagSig = ''; wSig = ''; shade.classList.add('open');
    shade.innerHTML = '<div class="adm v2" role="dialog" aria-label="Administration"><button class="adm-x" type="button" aria-label="Close">&times;</button>' +
      '<div class="cr-head"><div><h2 class="gold">ADMINISTRATION</h2><div class="sub">THE HALL &middot; CONTROL ROOM</div></div><div class="cr-right"><div class="cr-clock" id="admClock"></div><div class="cr-pills" id="admPills"></div></div></div>' +
      '<div class="cr-body"><nav class="cr-nav" id="admNav">' + NAV.map(function (n, i) { return '<button type="button" data-t="' + n[0] + '"' + (n[0] === curTab ? ' class="on"' : '') + '><i>' + (i + 1) + '</i>' + n[1] + (n[0] === 'flag' ? ' <em id=\"admFlagN\"></em>' : '') + '</button>'; }).join('') + '<button type="button" class="cr-out" id="admOut">LOG OUT</button></nav>' +
      '<main class="cr-main">' +
      ovHtml() +
      '<section data-p="live"><div class="livebox off" id="admLB2"></div></section><section data-p="flag"><div id="admFlag"></div></section>' +
      '<section data-p="msg"><div class="hx"><div class="box hxl"><h4>CONVERSATIONS</h4><div class="hxnew"><input id="admHTo" list="admPl" maxlength="40" placeholder="START A NEW TEXT: PLAYER USERNAME" autocomplete="off"><datalist id="admPl"></datalist><button type="button" class="go" id="admHNew">NEW</button></div><div class="hxlist" id="admHT"></div></div><div class="box hxr"><h4 id="admHTitle">PICK A CONVERSATION</h4><div class="hint">HYPE is the account you text players from. Players can and will text HYPE back, so their replies land here. Players can also text HYPE first.</div><div class="hxlog" id="admHLog"></div><div class="cmp"><textarea id="admHBody" maxlength="280" rows="3" placeholder="MESSAGE FROM HYPE"></textarea><button class="go" type="button" id="admHSend">SEND AS HYPE</button><div class="cmsg" id="admHMsg"></div></div></div></div></section>' +
      '<section data-p="mail"><div class="box"><h4>MIMU MAIL</h4><div class="mtabs" id="admMT"><button type="button" class="on" data-k="c">COMPOSE</button><button type="button" data-k="s">SENT</button></div><div class="hint" style="margin-bottom:12px">Announcements from MIMU to everyone signed in. Mail is outgoing only: players cannot send or reply to email, they text instead.</div>' +
      '<div class="cmp" id="admMC"><input id="admMS" maxlength="90" placeholder="SUBJECT" autocomplete="off"><textarea id="admMB" maxlength="4000" rows="7" placeholder="EMAIL FROM MIMU"></textarea><button class="go" type="button" id="admMSend">SEND TO EVERYONE SIGNED IN</button><div class="cmsg" id="admMMsg"></div></div><div class="sent" id="admML" style="display:none"></div></div></section>' +
      '<section data-p="eco"><div id="admEco"></div></section>' +
      '<section data-p="cards"><div class="box dbox"><h4>BY RARITY</h4>' + tierCards() + '</div><div class="box dbox"><h4>BY FAMILY</h4>' + famCards() + '</div><div class="box dbox"><h4>THE WHOLE DECK &middot; ALL 120 CARDS</h4><div class="whow"><b>HOW TO LAUNCH A WANTED CARD</b><span><i>1</i>CLICK A CARD in the deck below</span><span><i>2</i>PICK HOURS in the red box at the bottom</span><span><i>3</i>PRESS LAUNCH</span></div><div class="hint" style="margin-bottom:12px">Every card in the game, with its border colored by rarity. Each card shows how many times it has been found.</div>' + deckGrid() + '<div id="admWanted"></div></div><div class="box dbox"><h4>THE NUMBERS</h4><div id="admCards"></div></div></section>' +
      '<section data-p="rules"><div class="box"><h4>WHEN CARDS DROP IN ONE RUN</h4><a href="assets/game/card-timeline.png" target="_blank" rel="noopener"><img class="tlimg" src="assets/game/card-timeline.png" alt="Timeline of the first card, sightings, stagger cards, echo cards, and when Prestige and Legendary open during one run" loading="lazy"></a><div class="hint" style="margin-top:10px">Time is time alive in one run; dying starts it over. Press the picture to open it full size.</div></div><div class="box gbox"><h4>COMING: THE GRAND TOTAL TOP 10</h4><p>When the game ends and the giving is over, every player&rsquo;s <b>points</b>, <b>coins</b> and <b>card deck completion percentage</b> will be totaled up together into one grand total. The ten highest grand totals become the <b>Top 10 list</b>, and the list will be revealed in the <b>TOP 10 app</b> on the phone.</p><div class="hint">Not built yet. The TOP 10 icon on the phone is blacked out until then. We will set this up later, and this note is the announcement for the team.</div></div><div class="box"><h4>HOW THE GAME WORKS RIGHT NOW</h4><div class="works">' + worksCards() + '</div></div></section>' +
      '<section data-p="site">' + (DOCS.pages.site || '<div class="box">GUIDE NOT LOADED</div>') + '</section>' +
      '<section data-p="sys">' + (DOCS.pages.sys || '') + '</section>' +
      '<section data-p="data">' + (DOCS.pages.data || '') + '</section>' +
      '<section data-p="road">' + (DOCS.pages.road || '') + '</section>' +
      '</main></div><div class="cr-foot">KEYS &nbsp; 1&ndash;9 SWITCH PAGE &nbsp;&middot;&nbsp; ESC CLOSES &nbsp;&middot;&nbsp; GUIDE BUILT ' + esc(DOCS.built || '') + ' &middot; COMMIT ' + esc(DOCS.commit || '') + '</div></div>';
    var root = shade.querySelector('.adm');
    function show(t) {
      curTab = t;
      Array.prototype.forEach.call(root.querySelectorAll('.cr-nav button'), function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
      Array.prototype.forEach.call(root.querySelectorAll('section[data-p]'), function (s) { s.style.display = s.getAttribute('data-p') === t ? '' : 'none'; s.classList.toggle('in', s.getAttribute('data-p') === t); });
      root.querySelector('.cr-main').scrollTop = 0;
    }
    show(curTab);
    shade.querySelector('.adm-x').addEventListener('click', close);
    root.addEventListener('click', function (ev) {
      var ap = ev.target.closest('[data-ap]'); if (ap) { apprToggle(ap.getAttribute('data-ap')); return; }
      var tf = ev.target.closest('[data-tf2]'); if (tf) { var gr = root.querySelector('.cgrid'), v = tf.getAttribute('data-tf2'); gr.setAttribute('data-f', v); Array.prototype.forEach.call(root.querySelectorAll('[data-tf2]'), function (x) { x.classList.toggle('on', x === tf); }); return; }
      var c = ev.target.closest('.cth[data-cn]'); if (c) { wsel = +c.getAttribute('data-cn'); wMsg = ''; wSig = ''; paintWanted(); return; }
      if (ev.target.closest('#admWLaunch')) { if (!wsel) return; wantedAct(handlers.wantedLaunch ? handlers.wantedLaunch(wsel, wHours) : Promise.reject(new Error('Not connected yet')), 'LAUNCHED. THE EMAIL IS ON ITS WAY TO EVERY PLAYER'); return; }
      if (ev.target.closest('#admWEnd')) { wantedAct(handlers.wantedEnd ? handlers.wantedEnd() : Promise.reject(new Error('Not connected yet')), 'THE WANTED CARD WAS ENDED'); return; }
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
      var box = $('admML'); if (mtab === 's') box.innerHTML = m.length ? m.slice(0, 12).map(function (x) { return '<div class="srow2"><b>' + esc(x.subject) + '</b><span>' + esc(x.body) + '</span><em>' + stamp(x.ts) + '</em></div>'; }).join('') : '<div class="srow2 none">NO MAIL SENT YET</div>';
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
    function clock() { try { $('admClock').textContent = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase() + ' · LOS ANGELES'; } catch (e) {} }
    var plFed = false, ecoSig = '';
    function refresh() {
      clock(); $('admPills').innerHTML = pills(); $('admSys').innerHTML = sysRows(); $('admVT').innerHTML = visTiles(); paintWNow(); paintAppr(); $('admVis').innerHTML = visPanels(); $('admTiles').innerHTML = tiles(); paintLive('admLB2'); paintFlag(); paintWanted(); $('admAct').innerHTML = activity(); var eh = ecoHtml(); if (eh !== ecoSig) { ecoSig = eh; $('admEco').innerHTML = eh; } $('admCards').innerHTML = cardBars(); paintCardsPage();
      if (feed && feed.players && !plFed) { plFed = true; $('admPl').innerHTML = feed.players.slice(0, 500).map(function (p) { return '<option value="' + esc(p.name) + '">'; }).join(''); }
      lists(); paintHype();
    }
    refresh(); clearInterval(tick); tick = setInterval(refresh, 1000);
  }
  /* later: HallAdmin.setFeed({ visitors:{today,total}, runs:{today,total}, live:[{name,score,alive,cards}], cardsFound, topScore, longest, signedIn, messagesToday,
       economy:{coinsEarned,coinsSpent,cardsBought,cardsSold,pointsPaid,coinsPerRun}, cardsByTier:[...], series:{visitors,runs,signedIn,cards,coins,messages}, activity:[{ts,text}],
       players:[{name}], hypeThreads:[{name,last,ts,unread,messages:[{me,body,ts}]}], mails:[{subject,body,ts}], status:{cloudflare,glyph,market,texts,mail} })
     and HallAdmin.setHandlers({ hype(to, body) -> Promise, mail(subject, body) -> Promise, markRead(name) }) */
  window.HallAdmin = { setFeed: function (f) { feed = f; }, setHandlers: function (h) { handlers = h || {}; }, open: openPanel };
})();
