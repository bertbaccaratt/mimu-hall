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
      ['TEST MODE', P.isTest() ? 'warn' : 'ok', P.isTest() ? 'ON (THIS BROWSER ONLY)' : 'OFF'],
      ['THIS BROWSER', 'ok', 'WINDOW ' + vw]
    ];
    return rows.map(function (r) { return '<div class="sysr ' + r[1] + '"><i></i><b>' + r[0] + '</b><span>' + r[2] + '</span></div>'; }).join('');
  }
  var NAV = [['ov', 'OVERVIEW'], ['live', 'LIVE RUNS'], ['msg', 'HYPE TEXTS'], ['mail', 'MIMU MAIL'], ['eco', 'ECONOMY'], ['cards', 'CARDS'], ['rules', 'GAME RULES'], ['tools', 'TOOLS']];
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
      '<div class="cr-body"><nav class="cr-nav" id="admNav">' + NAV.map(function (n, i) { return '<button type="button" data-t="' + n[0] + '"' + (n[0] === curTab ? ' class="on"' : '') + '><i>' + (i + 1) + '</i>' + n[1] + '</button>'; }).join('') + '</nav>' +
      '<main class="cr-main">' +
      '<section data-p="ov">' + (feed ? '' : '<div class="crnote">THE LIVE NUMBERS FILL IN WHEN CLOUDFLARE IS CONNECTED &middot; UNTIL THEN THE SYSTEM CHECK BELOW IS REAL</div>') + '<div class="box" style="margin-bottom:16px"><h4>SYSTEM CHECK</h4><div class="sys" id="admSys"></div></div><div class="tiles" id="admTiles"></div><div class="cols2"><div class="box"><h4>TOP 9 LIVE RUNS</h4><div class="live9" id="admLive9"></div></div><div class="box"><h4>ACTIVITY</h4><div class="acts" id="admAct"></div></div></div></section>' +
      '<section data-p="live"><div class="box"><h4>TOP 9 LIVE RUNS</h4><div class="live9" id="admLive9b"></div></div></section>' +
      '<section data-p="msg"><div class="box"><h4>TEXT AS HYPE</h4><div class="hint" style="margin-bottom:12px">A one-on-one text from the HYPE account to a signed-in player. Players cannot reply to HYPE.</div><div class="cmp"><input id="admHTo" list="admPl" maxlength="40" placeholder="PLAYER USERNAME" autocomplete="off"><datalist id="admPl"></datalist><textarea id="admHBody" maxlength="280" rows="4" placeholder="MESSAGE FROM HYPE"></textarea><button class="go" type="button" id="admHSend">SEND AS HYPE</button><div class="cmsg" id="admHMsg"></div></div></div><div class="box" style="margin-top:16px"><h4>RECENTLY SENT</h4><div class="sent" id="admHList"></div></div></section>' +
      '<section data-p="mail"><div class="box"><h4>MIMU MAIL</h4><div class="mtabs" id="admMT"><button type="button" class="on" data-k="c">COMPOSE</button><button type="button" data-k="s">SENT</button><button type="button" data-k="r">RECEIVED</button></div>' +
      '<div class="cmp" id="admMC"><input id="admMS" maxlength="90" placeholder="SUBJECT" autocomplete="off"><textarea id="admMB" maxlength="4000" rows="7" placeholder="EMAIL FROM MIMU"></textarea><button class="go" type="button" id="admMSend">SEND TO EVERYONE SIGNED IN</button><div class="cmsg" id="admMMsg"></div></div><div class="sent" id="admML" style="display:none"></div></div></section>' +
      '<section data-p="eco"><div class="box"><h4>COINS AND THE MARKETPLACE</h4><div id="admEco"></div><div class="hint" style="margin-top:14px">Coins collected in runs are spent on cards in the Marketplace. Any collected card can be sold for leaderboard points. Prices and sale values are served by the Marketplace service once it is connected.</div></div></section>' +
      '<section data-p="cards"><div class="box"><h4>THE 120 CARDS</h4><div id="admCards"></div></div></section>' +
      '<section data-p="rules"><div class="box"><h4>HOW THE GAME WORKS RIGHT NOW</h4><div class="works">' + worksCards() + '</div></div></section>' +
      '<section data-p="tools"><div class="box"><h4>TOOLS</h4><div class="tools"><button type="button" class="sw' + (P.isTest() ? ' on' : '') + '" id="admTest"><i></i>TEST MODE</button><div class="hint">Test mode makes card sightings come every few seconds, opens every tier, and brings the pack after 40 seconds, so you can see every rarity and the slowdown without playing for hours. Nothing is saved while it is on. It only changes this browser.</div></div>' +
      '<div class="tools" style="margin-top:18px"><button type="button" class="sw" id="admSnap">DOWNLOAD SNAPSHOT</button><div class="hint">Saves the numbers on this page (and the current game settings) as a file on this computer.</div></div>' +
      '<div class="tools" style="margin-top:18px"><button type="button" class="sw" id="admOut">LOCK THE CONTROL ROOM</button><div class="hint">Forgets this login on this browser, so the password is asked again.</div></div></div></section>' +
      '</main></div><div class="cr-foot">KEYS &nbsp; 1&ndash;8 SWITCH PAGE &nbsp;&middot;&nbsp; ESC CLOSES</div></div>';
    var root = shade.querySelector('.adm');
    function show(t) {
      curTab = t;
      Array.prototype.forEach.call(root.querySelectorAll('.cr-nav button'), function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
      Array.prototype.forEach.call(root.querySelectorAll('section[data-p]'), function (s) { s.style.display = s.getAttribute('data-p') === t ? '' : 'none'; s.classList.toggle('in', s.getAttribute('data-p') === t); });
      root.querySelector('.cr-main').scrollTop = 0;
    }
    show(curTab);
    shade.querySelector('.adm-x').addEventListener('click', close);
    $('admNav').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (b) show(b.getAttribute('data-t')); });
    shade.onkeydown = function (ev) { if (/^[1-8]$/.test(ev.key) && !/INPUT|TEXTAREA/.test((ev.target || {}).tagName || '')) show(NAV[+ev.key - 1][0]); };
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
      clock(); $('admPills').innerHTML = pills(); $('admSys').innerHTML = sysRows(); $('admTiles').innerHTML = tiles(); var l = liveRows(); $('admLive9').innerHTML = l; $('admLive9b').innerHTML = l; $('admAct').innerHTML = activity(); $('admEco').innerHTML = economy(); $('admCards').innerHTML = cardBars();
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
