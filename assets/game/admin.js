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
      ['UNLOCK RULE', 'a tier opens when you own ' + Math.round(s.unlockShare * 100) + '% of the tier below'],
      ['LUCKY CHANCE', 'after ' + hms(s.lucky.afterSec) + ': Prestige ' + (s.lucky.prestige * 100) + '%, Legendary ' + (s.lucky.legendary * 100) + '% per sighting'],
      ['DUPLICATES', Math.round(s.dupChance * 100) + '% of sightings may repeat an owned card'],
      ['THE PACK', 'first at ' + hms(pk.firstSec) + ', then every ' + hms(pk.everySec) + '; jump it: ' + pk.slowPct + '% slower for ' + pk.slowSec + ' s, no other bonus'],
      ['HEALTH', hp.segments + ' segments. Plain box ' + hp.dmg.plain + ' (3 hits), blue ' + hp.dmg.blue + ' (2 hits), red ' + hp.dmg.red + ' (1 hit)'],
      ['SCORING', 'distance + ' + c.coinPoints + ' per coin; every run adds to the lifetime total'],
      ['NO PAUSE', 'leaving the game in any way ends the run'],
      ['SAVING', P.isSignedIn() ? 'signed in: runs and cards are saved' : 'nobody signed in: demo runs, nothing saved, nothing ranked']
    ];
    return items.map(function (x) { return '<div class="wk"><small>' + x[0] + '</small><b>' + esc(x[1]) + '</b></div>'; }).join('');
  }
  function cardBars() {
    var cs = P.cards(), total = cs.length || 120;
    var tiers = P.tiers.map(function (t) { var n = t.count || 0; return '<div class="cb2"><span>' + t.name.toUpperCase() + '</span><div class="tr"><i style="width:' + (n / total * 100) + '%;background:' + (t.grad || t.color) + '"></i></div><span class="ct">' + n + ' · ' + Math.round(n / total * 100) + '%</span></div>'; }).join('');
    var fams = P.families.map(function (f) { var n = f.count || 0; return '<div class="cb2"><span>' + f.name.toUpperCase() + '</span><div class="tr"><i style="width:' + (n / total * 100) + '%;background:#d9ac5c"></i></div><span class="ct">' + n + ' · ' + Math.round(n / total * 100) + '%</span></div>'; }).join('');
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
  function tiles() {
    var f = feed || {}, v = f.visitors || {}, r = f.runs || {}, none = feed ? '' : 'WAITING FOR LIVE FEED';
    var t = [
      ['VISITORS TODAY', fmt(v.today), v.total != null ? fmt(v.total) + ' all time' : none],
      ['RUNS TODAY', fmt(r.today), r.total != null ? fmt(r.total) + ' all time' : none],
      ['RUNNING NOW', f.live ? fmt(f.live.length) : (window.HallRunner && HallRunner.live && HallRunner.live().mode === 'run' ? '1' : '—'), f.live ? 'live runners' : 'this device only'],
      ['CARDS FOUND', fmt(f.cardsFound), f.cardsFound != null ? 'of all runs' : none],
      ['TOP SCORE', fmt(f.topScore), f.topScore != null ? 'best single run' : none],
      ['LONGEST RUN', f.longest != null ? dur(f.longest) : '—', f.longest != null ? 'alive' : none]
    ];
    return t.map(function (x) { return '<div class="tile"><small>' + x[0] + '</small><b>' + x[1] + '</b><em>' + esc(x[2]) + '</em></div>'; }).join('');
  }
  function openPanel() {
    shade.classList.add('open');
    shade.innerHTML = '<div class="adm" role="dialog" aria-label="Administration"><button class="adm-x" type="button" aria-label="Close">&times;</button>' +
      '<div class="adm-top"><div><h2 class="gold">ADMINISTRATION</h2><div class="sub">THE HALL &middot; CONTROL ROOM</div></div><div class="live" id="admLive"><i></i><span id="admLiveTxt">FEED NOT CONNECTED</span></div></div>' +
      '<div class="tiles" id="admTiles"></div>' +
      '<div class="cols2"><div class="box"><h4>TOP 9 LIVE RUNS</h4><div class="live9" id="admLive9"></div></div><div class="box"><h4>THE 120 CARDS</h4>' + cardBars() + '</div></div>' +
      '<div class="cols2"><div class="box"><h4>TEXT AS HYPE</h4><div class="cmp"><input id="admHTo" list="admPl" maxlength="40" placeholder="PLAYER USERNAME" autocomplete="off"><datalist id="admPl">' + ((feed && feed.players) || []).slice(0, 500).map(function (p) { return '<option value="' + esc(p.name) + '">'; }).join('') + '</datalist><textarea id="admHBody" maxlength="280" rows="3" placeholder="MESSAGE FROM HYPE"></textarea><button class="go" type="button" id="admHSend">SEND AS HYPE</button><div class="cmsg" id="admHMsg"></div><div class="sent" id="admHList"></div></div></div>' +
      '<div class="box"><h4>MIMU MAIL</h4><div class="mtabs" id="admMT"><button type="button" class="on" data-k="c">COMPOSE</button><button type="button" data-k="s">SENT</button><button type="button" data-k="r">RECEIVED</button></div>' +
      '<div class="cmp" id="admMC"><input id="admMS" maxlength="90" placeholder="SUBJECT" autocomplete="off"><textarea id="admMB" maxlength="4000" rows="4" placeholder="EMAIL FROM MIMU"></textarea><button class="go" type="button" id="admMSend">SEND TO EVERYONE SIGNED IN</button><div class="cmsg" id="admMMsg"></div></div><div class="sent" id="admML" style="display:none"></div></div></div>' +
      '<div class="box" style="margin-bottom:16px"><h4>HOW THE GAME WORKS RIGHT NOW</h4><div class="works">' + worksCards() + '</div></div>' +
      '<div class="box"><h4>TOOLS</h4><div class="tools"><button type="button" class="sw' + (P.isTest() ? ' on' : '') + '" id="admTest"><i></i>TEST MODE</button><div class="hint">Test mode makes card sightings come every few seconds, opens every tier, and brings the pack after 40 seconds, so you can see every rarity and the slowdown without playing for hours. Nothing is saved while it is on. It only changes this browser.</div></div></div></div>';
    shade.querySelector('.adm-x').addEventListener('click', close);
    $('admTest').addEventListener('click', function () { var on = !P.isTest(); P.setTest(on); this.classList.toggle('on', on); });
    function refresh() { $('admTiles').innerHTML = tiles(); $('admLive9').innerHTML = liveRows(); var live = $('admLive'); live.classList.toggle('on', !!feed); $('admLiveTxt').textContent = feed ? 'LIVE FEED CONNECTED' : 'FEED NOT CONNECTED'; }
    var mtab = 'c';
    function lists() {
      var h = (feed && feed.hypes) || [], m = (feed && feed.mails) || [], r = (feed && feed.replies) || [];
      $('admHList').innerHTML = h.length ? h.slice(0, 8).map(function (x) { return '<div class="srow2"><b>' + esc(x.to || x.rn || '') + '</b><span>' + esc(x.body) + '</span><em>' + stamp(x.ts) + '</em></div>'; }).join('') : '<div class="srow2 none">NOTHING SENT YET</div>';
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
    lists();
    refresh(); clearInterval(tick); tick = setInterval(function () { refresh(); lists(); }, 1000);
  }
  /* later: HallAdmin.setFeed({ visitors:{today,total}, runs:{today,total}, live:[{name,score,alive,cards}], cardsFound, topScore, longest }) */
  /* later: HallAdmin.setHandlers({ hype(to, body) -> Promise, mail(subject, body) -> Promise }) and the feed also carries players:[{name}], hypes:[{to,body,ts}], mails:[{subject,body,ts}], replies:[{from,body,ts}] */
  window.HallAdmin = { setFeed: function (f) { feed = f; }, setHandlers: function (h) { handlers = h || {}; }, open: openPanel };
})();
