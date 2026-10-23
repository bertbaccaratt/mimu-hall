/* ADMIN: a quiet link in the bottom-left corner opens a password box, then the control room for THE HALL.
   Temporary foundation: the password is only checked here in the page (against a hash). It will be protected properly on Cloudflare later,
   and the live numbers (visitors, runs, live runs) arrive through HallAdmin.setFeed(...) once that exists. */
(function () {
  'use strict';
  var P = window.HallProfile; if (!P) return;
  var HASH = '8af2f20569b2860098db9e8251390d8d1f6bd797cd227ef6c1c6aa4d7e0276f5', SALT = 'mimu-hall-admin|v1|';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return (n == null || isNaN(n)) ? '—' : Math.floor(n).toLocaleString('en-US'); }
  function dur(sec) { if (sec == null || isNaN(sec)) return '—'; sec = Math.floor(sec); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + 'h ' : '') + (h || m ? m + 'm ' : '') + (h ? '' : s + 's'); }
  function hms(sec) { var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60); return (h ? h + ' h ' : '') + (m ? m + ' min' : (h ? '' : sec + ' s')); }

  var feed = null, handlers = {}, tick = 0, fails = 0, lockUntil = 0;
  function stamp(ts) { try { return new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase(); } catch (e) { return ''; } }
  function sha(s) { var b = new TextEncoder().encode(SALT + s); return crypto.subtle.digest('SHA-256', b).then(function (d) { return Array.prototype.map.call(new Uint8Array(d), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }); }

  /* ---------- the link and the login box ---------- */
  var link = document.createElement('button'); link.className = 'adminlink'; link.type = 'button'; link.textContent = 'ADMIN'; link.setAttribute('aria-label', 'Administration'); document.body.appendChild(link);
  var shade = document.createElement('div'); shade.className = 'adm-shade'; shade.id = 'admShade'; document.body.appendChild(shade);

  function openLogin() {
    shade.innerHTML = '<div class="adm-login" role="dialog" aria-label="Administration login"><button class="x" type="button" aria-label="Close">&times;</button><h3 class="gold">ADMIN</h3><p>PASSWORD REQUIRED</p><input id="admPw" type="password" autocomplete="off" aria-label="Password" placeholder="&middot; &middot; &middot; &middot; &middot; &middot;"><button class="go" type="button">ENTER</button><div class="err" id="admErr"></div></div>';
    shade.classList.add('open'); var inp = $('admPw'); setTimeout(function () { inp.focus(); }, 30);
    shade.querySelector('.x').addEventListener('click', close);
    function submit() {
      var now = Date.now(); if (now < lockUntil) { $('admErr').textContent = 'TOO MANY TRIES · WAIT ' + Math.ceil((lockUntil - now) / 1000) + 's'; return; }
      sha(inp.value).then(function (h) {
        if (h === HASH) { fails = 0; try { sessionStorage.setItem('hall-admin', '1'); } catch (e) {} openPanel(); }
        else { fails++; inp.value = ''; if (fails >= 3) { lockUntil = Date.now() + 30000; fails = 0; $('admErr').textContent = 'TOO MANY TRIES · WAIT 30s'; } else $('admErr').textContent = 'WRONG PASSWORD'; }
      });
    }
    shade.querySelector('.go').addEventListener('click', submit); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }
  function close() { shade.classList.remove('open'); shade.innerHTML = ''; clearInterval(tick); }
  shade.addEventListener('click', function (e) { if (e.target === shade) close(); });
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && shade.classList.contains('open')) close(); });
  link.addEventListener('click', function () { var ok = false; try { ok = sessionStorage.getItem('hall-admin') === '1'; } catch (e) {} if (ok) openPanel(); else openLogin(); });

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
    return '<div class="cgrid">' + cs.map(function (c) {
      var t = P.tiers[c.tier - 1] || P.tiers[0];
      return '<div class="cth" data-cn="' + c.n + '" style="--c:' + t.color + '" title="#' + c.n + ' ' + esc(c.name) + ' · ' + esc(t.name) + '"><img src="' + esc(c.file) + '" alt="" loading="lazy"><span>' + c.n + '</span></div>';
    }).join('') + '</div><div class="clg">' + P.tiers.map(function (t) { return '<span><i style="background:' + (t.grad || t.color) + '"></i>' + esc(t.name.toUpperCase()) + '</span>'; }).join('') + '</div>';
  }
  function paintCardsPage() {
    var f = feed || {}, bt = f.cardsByTier || [], cc = f.cardCounts || {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-tf]'), function (el) { var v = bt[+el.getAttribute('data-tf')]; el.textContent = 'FOUND ' + (v == null ? '—' : fmt(v)); });
    Array.prototype.forEach.call(document.querySelectorAll('.cth[data-cn]'), function (el) { var v = cc[el.getAttribute('data-cn')]; el.classList.toggle('hot', v != null && v > 0); var b = el.querySelector('span'); b.textContent = v ? v : el.getAttribute('data-cn'); });
  }
  /* ---------- the OVERVIEW page: a mind map to learn the control room, then everything about the visitors ---------- */
  var MAP = [
    ['WATCH', 'g1', [['ov', 'OVERVIEW', 'visitors, funnel and site health'], ['live', 'LIVE RUNS', 'who is playing right now'], ['cards', 'CARDS', 'the 120 cards, pictured']]],
    ['TALK', 'g2', [['msg', 'HYPE TEXTS', 'text a player as HYPE'], ['mail', 'MIMU MAIL', 'email everyone as MIMU']]],
    ['MONEY', 'g3', [['eco', 'ECONOMY', 'coins, points and trades']]],
    ['LEARN', 'g4', [['rules', 'GAME RULES', 'the live game numbers'], ['site', 'SITE GUIDE', 'every page and icon'], ['sys', 'SYSTEMS', 'how each part works'], ['data', 'DATA CONTRACT', 'what the server sends'], ['road', 'CHECKLIST', 'what is done and next'], ['log', 'CHANGELOG', 'every change made'], ['files', 'FILES', 'what is in the site']]],
    ['DO', 'g5', [['tools', 'TOOLS', 'test mode and snapshot']]]
  ];
  function mindMap() {
    return '<div class="box mmbox"><h4>HOW TO USE THE CONTROL ROOM</h4>' +
      '<div class="mm"><div class="mmc"><i></i><b>CONTROL ROOM</b><small>PRESS ANY BOX TO JUMP THERE</small></div><div class="mmrail"></div><div class="mmgs">' +
      MAP.map(function (g) { return '<div class="mmg ' + g[1] + '"><div class="mmh">' + g[0] + '</div>' + g[2].map(function (l) { return '<button type="button" class="mml" data-go="' + l[0] + '"><b>' + l[1] + '</b><span>' + l[2] + '</span></button>'; }).join('') + '</div>'; }).join('') + '</div></div>' +
      '<ol class="mmsteps"><li><b>SIGN IN</b> with the ADMIN link at the bottom left of the site. Three wrong tries lock it for 30 seconds.</li>' +
      '<li><b>MOVE AROUND</b> with the menu (left side, or the strip at the top on a phone), or press the keys 1 to 9. Esc closes the control room.</li>' +
      '<li><b>READ THE LIGHTS</b> at the top: green means connected, gray means waiting. The Live Runs frame is red when nobody plays and green when somebody does.</li>' +
      '<li><b>NO NUMBERS YET?</b> Dashes mean the live feed is not connected. The system check and the guide pages are always real.</li>' +
      '<li><b>SEND</b> texts as HYPE and emails as MIMU from their own pages. They say NOT CONNECTED until the server is live.</li>' +
      '<li><b>STALE PAGE?</b> Press Ctrl+Shift+R once to load the newest files. Tools has a snapshot download. LOG OUT under the menu signs you out.</li></ol></div>';
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
  function ovHtml() {
    return '<section data-p="ov">' + mindMap() + (feed ? '' : '<div class="crnote">THE LIVE NUMBERS FILL IN WHEN CLOUDFLARE IS CONNECTED &middot; UNTIL THEN THE SYSTEM CHECK AND THIS BROWSER BOX ARE REAL</div>') +
      '<div class="tiles" id="admVT"></div><div id="admVis"></div>' +
      '<div class="box dbox"><h4>THE GAME AT A GLANCE</h4><div class="tiles" id="admTiles"></div></div>' +
      '<div class="cols2"><div class="box"><h4>SYSTEM CHECK</h4><div class="sys one" id="admSys"></div></div><div class="box"><h4>THIS BROWSER</h4>' + thisBrowser() + '</div></div>' +
      '<div class="box"><h4>ACTIVITY</h4><div class="acts" id="admAct"></div></div></section>';
  }
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
  function economy() {
    var e = (feed && feed.economy) || {}, t = [
      ['COINS EARNED', fmt(e.coinsEarned)], ['COINS SPENT', fmt(e.coinsSpent)], ['CARDS BOUGHT', fmt(e.cardsBought)], ['CARDS SOLD', fmt(e.cardsSold)], ['POINTS PAID FOR SALES', fmt(e.pointsPaid)], ['AVERAGE COINS PER RUN', e.coinsPerRun != null ? fmt(e.coinsPerRun) : '—']
    ];
    return '<div class="eco">' + t.map(function (x) { return '<div><small>' + x[0] + '</small><b>' + (feed ? x[1] : '—') + '</b></div>'; }).join('') + '</div>';
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
  var NAV = [['ov', 'OVERVIEW'], ['live', 'LIVE RUNS'], ['msg', 'HYPE TEXTS'], ['mail', 'MIMU MAIL'], ['eco', 'ECONOMY'], ['cards', 'CARDS'], ['rules', 'GAME RULES'], ['site', 'SITE GUIDE'], ['sys', 'SYSTEMS'], ['data', 'DATA CONTRACT'], ['road', 'CHECKLIST'], ['log', 'CHANGELOG'], ['files', 'FILES'], ['tools', 'TOOLS']];
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
    shade.classList.add('open');
    shade.innerHTML = '<div class="adm v2" role="dialog" aria-label="Administration"><button class="adm-x" type="button" aria-label="Close">&times;</button>' +
      '<div class="cr-head"><div><h2 class="gold">ADMINISTRATION</h2><div class="sub">THE HALL &middot; CONTROL ROOM</div></div><div class="cr-right"><div class="cr-clock" id="admClock"></div><div class="cr-pills" id="admPills"></div></div></div>' +
      '<div class="cr-body"><nav class="cr-nav" id="admNav">' + NAV.map(function (n, i) { return '<button type="button" data-t="' + n[0] + '"' + (n[0] === curTab ? ' class="on"' : '') + '><i>' + (i + 1) + '</i>' + n[1] + '</button>'; }).join('') + '<button type="button" class="cr-out" id="admOut">LOG OUT</button></nav>' +
      '<main class="cr-main">' +
      ovHtml() +
      '<section data-p="live"><div class="livebox off" id="admLB2"></div></section>' +
      '<section data-p="msg"><div class="box"><h4>TEXT AS HYPE</h4><div class="hint" style="margin-bottom:12px">A one-on-one text from the HYPE account to a signed-in player. Players cannot reply to HYPE.</div><div class="cmp"><input id="admHTo" list="admPl" maxlength="40" placeholder="PLAYER USERNAME" autocomplete="off"><datalist id="admPl"></datalist><textarea id="admHBody" maxlength="280" rows="4" placeholder="MESSAGE FROM HYPE"></textarea><button class="go" type="button" id="admHSend">SEND AS HYPE</button><div class="cmsg" id="admHMsg"></div></div></div><div class="box" style="margin-top:16px"><h4>RECENTLY SENT</h4><div class="sent" id="admHList"></div></div></section>' +
      '<section data-p="mail"><div class="box"><h4>MIMU MAIL</h4><div class="mtabs" id="admMT"><button type="button" class="on" data-k="c">COMPOSE</button><button type="button" data-k="s">SENT</button><button type="button" data-k="r">RECEIVED</button></div>' +
      '<div class="cmp" id="admMC"><input id="admMS" maxlength="90" placeholder="SUBJECT" autocomplete="off"><textarea id="admMB" maxlength="4000" rows="7" placeholder="EMAIL FROM MIMU"></textarea><button class="go" type="button" id="admMSend">SEND TO EVERYONE SIGNED IN</button><div class="cmsg" id="admMMsg"></div></div><div class="sent" id="admML" style="display:none"></div></div></section>' +
      '<section data-p="eco"><div class="box"><h4>COINS AND THE MARKETPLACE</h4><div id="admEco"></div><div class="hint" style="margin-top:14px">Coins collected in runs are spent on cards in the Marketplace. Any collected card can be sold for leaderboard points. Prices and sale values are served by the Marketplace service once it is connected.</div></div></section>' +
      '<section data-p="cards"><div class="box dbox"><h4>BY RARITY</h4>' + tierCards() + '</div><div class="box dbox"><h4>BY FAMILY</h4>' + famCards() + '</div><div class="box dbox"><h4>THE WHOLE DECK &middot; ALL 120 CARDS</h4><div class="hint" style="margin-bottom:12px">Every card in the game, with its border colored by rarity. Once the live feed is connected, each card shows how many times it has been found and lights up when it has been found at least once.</div>' + deckGrid() + '</div><div class="box dbox"><h4>THE NUMBERS</h4><div id="admCards"></div></div></section>' +
      '<section data-p="rules"><div class="box"><h4>HOW THE GAME WORKS RIGHT NOW</h4><div class="works">' + worksCards() + '</div></div></section>' +
      '<section data-p="site">' + (DOCS.pages.site || '<div class="box">GUIDE NOT LOADED</div>') + '</section>' +
      '<section data-p="sys">' + (DOCS.pages.sys || '') + '</section>' +
      '<section data-p="data">' + (DOCS.pages.data || '') + '</section>' +
      '<section data-p="road">' + (DOCS.pages.road || '') + '</section>' +
      '<section data-p="log">' + (DOCS.pages.log || '') + '</section>' +
      '<section data-p="files">' + (DOCS.pages.files || '') + '</section>' +
      '<section data-p="tools"><div class="box"><h4>TOOLS</h4><div class="tools"><button type="button" class="sw' + (P.isTest() ? ' on' : '') + '" id="admTest"><i></i>TEST MODE</button><div class="hint">Test mode makes card sightings come every few seconds, opens every tier, and brings the pack after 40 seconds, so you can see every rarity and the slowdown without playing for hours. Nothing is saved while it is on. It only changes this browser.</div></div>' +
      '<div class="tools" style="margin-top:18px"><button type="button" class="sw" id="admSnap">DOWNLOAD SNAPSHOT</button><div class="hint">Saves the numbers on this page (and the current game settings) as a file on this computer.</div></div>' +
      '</div></section>' +
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
    root.addEventListener('click', function (ev) { var g = ev.target.closest('[data-go]'); if (g) show(g.getAttribute('data-go')); });
    $('admNav').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (b && b.getAttribute('data-t')) show(b.getAttribute('data-t')); });
    shade.onkeydown = function (ev) { if (/^[1-9]$/.test(ev.key) && !/INPUT|TEXTAREA/.test((ev.target || {}).tagName || '')) show(NAV[+ev.key - 1][0]); };
    shade.tabIndex = -1; shade.focus();
    $('admTest').addEventListener('click', function () { var on = !P.isTest(); P.setTest(on); this.classList.toggle('on', on); });
    $('admSnap').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify({ taken: new Date().toISOString(), feed: feed, config: P.config, testMode: P.isTest() }, null, 2)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'hall-snapshot.json'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
    $('admOut').addEventListener('click', function () { try { sessionStorage.removeItem('hall-admin'); } catch (e) {} close(); });
    var mtab = 'c';
    function lists() {
      var h = (feed && feed.hypes) || [], m = (feed && feed.mails) || [], r = (feed && feed.replies) || [];
      $('admHList').innerHTML = h.length ? h.slice(0, 10).map(function (x) { return '<div class="srow2"><b>' + esc(x.to || x.rn || '') + '</b><span>' + esc(x.body) + '</span><em>' + stamp(x.ts) + '</em></div>'; }).join('') : '<div class="srow2 none">NOTHING SENT YET</div>';
      var box = $('admML'); if (mtab === 's') box.innerHTML = m.length ? m.slice(0, 12).map(function (x) { return '<div class="srow2"><b>' + esc(x.subject) + '</b><span>' + esc(x.body) + '</span><em>' + stamp(x.ts) + '</em></div>'; }).join('') : '<div class="srow2 none">NO MAIL SENT YET</div>';
      if (mtab === 'r') box.innerHTML = r.length ? r.slice(0, 12).map(function (x) { return '<div class="srow2"><b>' + esc(x.from || '') + '</b><span>' + esc(x.body) + '</span><em>' + stamp(x.ts) + '</em></div>'; }).join('') : '<div class="srow2 none">NOTHING RECEIVED &middot; MAIL IS ONE-WAY FROM MIMU</div>';
    }
    function done(el, p, okText) {
      el.className = 'cmsg'; if (!p) { el.textContent = 'NOT CONNECTED YET · NOTHING WAS SENT'; el.classList.add('bad'); return; }
      el.textContent = 'SENDING…'; p.then(function () { el.textContent = okText; el.classList.add('ok'); lists(); }, function (e) { el.textContent = String((e && e.message) || 'COULD NOT SEND').toUpperCase(); el.classList.add('bad'); });
    }
    $('admHSend').addEventListener('click', function () {
      var to = $('admHTo').value.trim(), body = $('admHBody').value.trim(), el = $('admHMsg');
      if (!to || !body) { el.className = 'cmsg bad'; el.textContent = 'PICK A PLAYER AND WRITE A MESSAGE'; return; }
      done(el, handlers.hype ? handlers.hype(to, body) : null, 'SENT AS HYPE'); if (handlers.hype) $('admHBody').value = '';
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
    var plFed = false;
    function refresh() {
      clock(); $('admPills').innerHTML = pills(); $('admSys').innerHTML = sysRows(); $('admVT').innerHTML = visTiles(); $('admVis').innerHTML = visPanels(); $('admTiles').innerHTML = tiles(); paintLive('admLB2'); $('admAct').innerHTML = activity(); $('admEco').innerHTML = economy(); $('admCards').innerHTML = cardBars(); paintCardsPage();
      if (feed && feed.players && !plFed) { plFed = true; $('admPl').innerHTML = feed.players.slice(0, 500).map(function (p) { return '<option value="' + esc(p.name) + '">'; }).join(''); }
      lists();
    }
    refresh(); clearInterval(tick); tick = setInterval(refresh, 1000);
  }
  /* later: HallAdmin.setFeed({ visitors:{today,total}, runs:{today,total}, live:[{name,score,alive,cards}], cardsFound, topScore, longest, signedIn, messagesToday,
       economy:{coinsEarned,coinsSpent,cardsBought,cardsSold,pointsPaid,coinsPerRun}, cardsByTier:[...], series:{visitors,runs,signedIn,cards,coins,messages}, activity:[{ts,text}],
       players:[{name}], hypes:[{to,body,ts}], mails:[{subject,body,ts}], replies:[{from,body,ts}], status:{cloudflare,glyph,market,texts,mail} })
     and HallAdmin.setHandlers({ hype(to, body) -> Promise, mail(subject, body) -> Promise }) */
  window.HallAdmin = { setFeed: function (f) { feed = f; }, setHandlers: function (h) { handlers = h || {}; }, open: openPanel };
})();
