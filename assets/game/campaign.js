/* THE CAMPAIGN: the Alarm clock, The Giving and the Top 5 (all-time). The times come from the server (/schedule); the page keeps the same dates as a fallback.
   Monday the Hall run starts and lasts 14 days; then the Hall closes and The Giving opens for 48 hours; then the Top 5 opens in gold with the final results. */
(function () {
  'use strict';
  var P = window.HallProfile; if (!P) return;
  var C = { start: Date.UTC(2026, 9, 26, 19, 0, 0), runDays: 14, giveHours: 48, off: 0, deckPct: 1000 };
  C.runEnd = C.start + C.runDays * 86400000 + 3600000;   /* noon again on Nov 9: the clocks go back on Nov 1 */ C.giveEnd = C.runEnd + C.giveHours * 3600000;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function now() { return Date.now() + C.off; }
  function phase() { var t = now(); return t < C.start ? 'before' : t < C.runEnd ? 'run' : t < C.giveEnd ? 'giving' : 'final'; }
  function fmt(n) { return P.big ? P.big(Math.round(n)) : Math.round(n).toLocaleString('en-US'); }
  function when(ts) { try { return new Date(ts).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).toUpperCase() + ' PT'; } catch (e) { return new Date(ts).toUTCString().toUpperCase(); } }
  function left(ms) {
    ms = Math.max(0, ms); var d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000);
    return '<b>' + d + '</b><i>D</i><b>' + (h < 10 ? '0' : '') + h + '</b><i>H</i><b>' + (m < 10 ? '0' : '') + m + '</b><i>M</i><b>' + (s < 10 ? '0' : '') + s + '</b><i>S</i>';
  }
  function api(path) { return window.HallNet ? window.HallNet.api(path, { noAuth: true }) : Promise.reject(new Error('offline')); }
  function setSched(s) { C.start = s.start; C.runEnd = s.runEnd; C.giveEnd = s.giveEnd; C.off = s.now - Date.now(); if (s.deckPct) C.deckPct = s.deckPct; icons(); paint(); }
  function sync() {
    return api('/schedule').then(setSched).catch(function () {});
  }

  /* ---------- the home screen icons follow the phase ---------- */
  function setIcon(id, on, label) { var b = $(id); if (!b) return; b.classList.toggle('off', !on); b.disabled = !on; b.tabIndex = on ? 0 : -1; b.setAttribute('aria-label', label); }
  function icons() {
    var ph = phase(), hall = $('hallIcon'), g = $('giveIcon'), t = $('top10Icon');
    if (hall) { var closed = ph === 'giving' || ph === 'final'; hall.classList.toggle('off', closed); hall.disabled = closed; hall.tabIndex = closed ? -1 : 0; hall.setAttribute('aria-label', closed ? 'The Hall (closed)' : 'Open The Hall'); }
    if (g) { g.classList.toggle('ic-give', ph === 'giving'); setIcon('giveIcon', ph === 'giving', ph === 'giving' ? 'The Giving' : 'The Giving (not open)'); }
    if (t) { t.classList.toggle('blk', ph !== 'final'); t.classList.toggle('ic-top5', ph === 'final'); setIcon('top10Icon', ph === 'final', ph === 'final' ? 'Top 5' : 'Top 5 (not open)'); }
  }

  /* ---------- ALARM ---------- */
  function paintAlarm() {
    var el = $('alarmApp'); if (!el) return; el.classList.add('page');
    var ph = phase(), t = now(), head, target, note;
    if (ph === 'before') { head = 'THE HALL RUN BEGINS IN'; target = C.start; note = when(C.start); }
    else if (ph === 'run') { head = 'THE HALL RUN CLOSES IN'; target = C.runEnd; note = when(C.runEnd); }
    else if (ph === 'giving') { head = 'THE GIVING CLOSES IN'; target = C.giveEnd; note = when(C.giveEnd); }
    else { head = 'THE CAMPAIGN HAS ENDED'; target = 0; note = 'THE TOP 5 RESULTS ARE IN'; }
    var st = function (i) { var cur = { before: 0, run: 1, giving: 2, final: 3 }[ph]; return i < cur ? 'done' : i === cur ? 'live' : 'next'; };
    var tag = { done: 'DONE', live: 'NOW', next: 'LATER' };
    var steps = [
      ['THE HALL RUN', '14 DAYS &middot; ' + when(C.start) + ' TO ' + when(C.runEnd), 'Play THE HALL and collect points, coins and cards. When the 14 days end, the Hall closes. Its app goes gray and cannot be opened.', 1],
      ['THE GIVING', '48 HOURS &middot; UNTIL ' + when(C.giveEnd), 'A green app opens. Anyone who is not in the top 5 can give their coins to other players. After 48 hours it goes gray and closes.', 2],
      ['THE TOP 5', 'OPENS ' + when(C.giveEnd), 'The Top 5 app opens in glowing gold and shows the top 5 lifetime totals of all time: distance and coin points, coins, Regular deck %, Foil deck % and X bonus, all added together. This is the end of the game.', 3]
    ];
    var keep = el.querySelector('.pg'), top = keep ? keep.scrollTop : 0;
    el.innerHTML = '<div class="pg cm"><div class="pgh"><h2 class="gold">ALARM</h2><div class="pgsub">THE CAMPAIGN CLOCK</div></div>' +
      '<div class="alclock ' + ph + '"><div class="alh">' + head + '</div>' + (target ? '<div class="alt" id="alT">' + left(target - t) + '</div>' : '<div class="alt done">00:00:00</div>') + '<div class="aln">' + note + '</div></div>' +
      '<div class="alsteps">' + (ph === 'before' ? '<div class="alstep live"><div class="alsh"><b>STARTS MONDAY</b><span>NEXT</span></div><div class="alsd">' + when(C.start) + '</div></div>' : '') +
      steps.map(function (s) { var k = st(s[3]); return '<div class="alstep ' + k + '"><div class="alsh"><b>' + s[0] + '</b><span>' + tag[k] + '</span></div><div class="alsd">' + s[1] + '</div><p>' + s[2] + '</p></div>'; }).join('') + '</div></div>';
    var pg = el.querySelector('.pg'); if (pg) pg.scrollTop = top;
  }
  function tickAlarm() {
    var e = $('alT'); if (!e) return; var ph = phase(), target = ph === 'before' ? C.start : ph === 'run' ? C.runEnd : ph === 'giving' ? C.giveEnd : 0;
    if (target) e.innerHTML = left(target - now());
  }

  /* ---------- THE GIVING ---------- */
  var gv = { st: null, players: null, to: '', amt: '', busy: false, msg: '', ok: false, confirm: false };
  function paintGive() {
    var el = $('giveApp'); if (!el) return; el.classList.add('page');
    var ph = phase(), signed = P.isSignedIn(), body, A = P.give ? P.give() : null;
    if (ph !== 'giving') {
      body = '<div class="gvbox"><b>' + (ph === 'final' ? 'THE GIVING HAS CLOSED' : 'THE GIVING IS NOT OPEN YET') + '</b><p>' + (ph === 'final' ? 'It was open for 48 hours after the Hall run closed. The Top 5 now has the final results.' : 'It opens when the 14 day Hall run closes, on ' + when(C.runEnd) + ', and stays open for 48 hours.') + '</p></div>';
    } else if (!signed || !A) {
      body = '<div class="gvbox"><b>SIGN IN WITH GLYPH TO GIVE</b><p>The Giving lets you give your coins to other players. It closes in <span class="gvl" id="gvT">' + left(C.giveEnd - now()) + '</span></p></div>';
    } else if (!gv.st) {
      body = '<div class="gvbox"><b>LOADING&hellip;</b></div>';
      A.status().then(function (s) { gv.st = s; return A.players ? A.players() : []; }).then(function (pl) { gv.players = pl; paintGive(); }).catch(function () { gv.st = { error: 1 }; paintGive(); });
    } else if (gv.st.error) {
      body = '<div class="gvbox"><b>COULD NOT LOAD</b><p>Check your connection and open the app again.</p></div>';
    } else if (gv.st.inTop5) {
      body = '<div class="gvbox"><b>YOU ARE IN THE TOP 5</b><p>You are rank ' + gv.st.rank + ' right now, so you keep your coins. Only players outside the top 5 can give. It closes in <span class="gvl" id="gvT">' + left(C.giveEnd - now()) + '</span></p></div>';
    } else {
      var opts = (gv.players || []).filter(function (p) { return p.name !== 'HYPE'; }).map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === gv.to ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('');
      var bal = gv.st.balance, amt = Math.floor(Number(gv.amt) || 0), pn = ''; (gv.players || []).forEach(function (p) { if (p.id === gv.to) pn = p.name; });
      body = '<div class="gvbox"><div class="gvbal"><span>YOUR COINS</span><b>' + fmt(bal) + '</b></div><div class="gvc">CLOSES IN <span class="gvl" id="gvT">' + left(C.giveEnd - now()) + '</span></div></div>' +
        '<div class="gvform"><label>GIVE TO<select id="gvTo"><option value="">CHOOSE A PLAYER</option>' + opts + '</select></label>' +
        '<label>HOW MANY COINS<input id="gvAmt" type="number" inputmode="numeric" min="1" max="' + bal + '" value="' + esc(gv.amt) + '" placeholder="0"></label>' +
        '<div class="gvq"><button type="button" data-q="25">25%</button><button type="button" data-q="50">50%</button><button type="button" data-q="100">ALL</button></div>' +
        (gv.confirm ? '<div class="gvcf">GIVE ' + fmt(amt) + ' COINS TO ' + esc(pn.toUpperCase()) + '? THIS CANNOT BE UNDONE.</div><div class="gvrow"><button type="button" class="gvgo" id="gvYes"' + (gv.busy ? ' disabled' : '') + '>YES, GIVE</button><button type="button" class="gvno" id="gvNo">CANCEL</button></div>' :
          '<button type="button" class="gvgo" id="gvGo"' + (gv.to && amt >= 1 && amt <= bal ? '' : ' disabled') + '>GIVE COINS</button>') +
        (gv.msg ? '<div class="gvm' + (gv.ok ? ' ok' : '') + '">' + esc(gv.msg) + '</div>' : '') + '</div>';
    }
    var keep = el.querySelector('.pg'), top = keep ? keep.scrollTop : 0;
    el.innerHTML = '<div class="pg cm"><div class="pgh"><h2 class="gold">THE GIVING</h2><div class="pgsub">GIVE COINS TO OTHER PLAYERS &middot; 48 HOURS</div></div>' + body + '</div>';
    var pg = el.querySelector('.pg'); if (pg) pg.scrollTop = top;
    wireGive();
  }
  function wireGive() {
    var to = $('gvTo'), amt = $('gvAmt'), go = $('gvGo'), yes = $('gvYes'), no = $('gvNo'), el = $('giveApp');
    if (to) to.onchange = function () { gv.to = to.value; gv.msg = ''; gv.confirm = false; paintGive(); };
    if (amt) { amt.oninput = function () { gv.amt = amt.value; gv.msg = ''; var ok = gv.to && Number(amt.value) >= 1 && Number(amt.value) <= gv.st.balance; if (go) go.disabled = !ok; }; }
    Array.prototype.forEach.call(el.querySelectorAll('.gvq button'), function (b) { b.onclick = function () { gv.amt = String(Math.floor(gv.st.balance * Number(b.getAttribute('data-q')) / 100)); gv.msg = ''; paintGive(); }; });
    if (go) go.onclick = function () { gv.confirm = true; gv.msg = ''; paintGive(); };
    if (no) no.onclick = function () { gv.confirm = false; paintGive(); };
    if (yes) yes.onclick = function () {
      if (gv.busy) return; gv.busy = true; paintGive();
      P.give().send(gv.to, Math.floor(Number(gv.amt))).then(function () { gv.msg = 'GIVEN. THANK YOU.'; gv.ok = true; gv.amt = ''; gv.confirm = false; gv.busy = false; gv.st = null; paintGive(); }, function (e) { gv.msg = String((e && e.message) || 'COULD NOT GIVE').toUpperCase(); gv.ok = false; gv.confirm = false; gv.busy = false; paintGive(); });
    };
  }
  function tickGive() { var e = $('gvT'); if (e) e.innerHTML = left(C.giveEnd - now()); }

  /* ---------- TOP 5 (all-time) ---------- */
  var tp = { rows: null, err: false };
  function paintTop() {
    var el = $('top5App'); if (!el) return; el.classList.add('page'); var ph = phase(), body;
    if (ph !== 'final') {
      body = '<div class="gvbox"><b>THE TOP 5 IS NOT OPEN YET</b><p>It opens in glowing gold when The Giving closes, on ' + when(C.giveEnd) + '. It shows the top 5 players of all time.</p></div>';
    } else if (tp.err) {
      body = '<div class="gvbox"><b>COULD NOT LOAD</b><p>Check your connection and open the app again.</p></div>';
    } else if (!tp.rows) {
      body = '<div class="gvbox"><b>LOADING&hellip;</b></div>';
      api('/final').then(function (r) { tp.rows = r.locked ? [] : r.top; tp.err = false; paintTop(); }).catch(function () { tp.err = true; paintTop(); });
    } else {
      body = '<div class="t5note">LIFETIME TOTAL = DISTANCE POINTS + COIN POINTS (25 EACH) + YOUR COINS + ' + C.deckPct.toLocaleString('en-US') + ' PER 1% OF THE REGULAR DECK + ' + C.deckPct.toLocaleString('en-US') + ' PER 1% OF THE FOIL DECK + A BONUS FOR EACH COMPLETE DECK (100,000 REGULAR, 250,000 FOIL) + X BONUS POINTS</div>' + (tp.rows.length ? tp.rows.map(function (r, i) {
        var runPts = Math.max(0, (r.points || 0) - (r.xPoints || 0));
        return '<div class="t5row r' + (i + 1) + '"><div class="t5h"><span class="t5rk">' + (i + 1) + '</span><span class="t5nm">' + esc(r.name) + '</span><span class="t5tt">' + fmt(r.total) + '</span></div>' +
          '<div class="t5g"><div><small>DISTANCE + COIN POINTS</small><b>' + fmt(runPts) + '</b></div><div><small>COINS</small><b>' + fmt(r.coins) + '</b></div><div><small>X BONUS</small><b>' + fmt(r.xPoints || 0) + '</b></div><div><small>REGULAR DECK ' + r.regPct + '%</small><b>+' + fmt(Math.round(r.regPct * C.deckPct)) + '</b></div><div><small>FOIL DECK ' + r.foilPct + '%</small><b>+' + fmt(Math.round(r.foilPct * C.deckPct)) + '</b></div>' + (r.regBonus ? '<div><small>REGULAR DECK COMPLETE</small><b>+' + fmt(r.regBonus) + '</b></div>' : '') + (r.foilBonus ? '<div><small>FOIL DECK COMPLETE</small><b>+' + fmt(r.foilBonus) + '</b></div>' : '') + '</div></div>';
      }).join('') : '<div class="gvbox"><b>NO PLAYERS YET</b></div>');
    }
    el.innerHTML = '<div class="pg cm"><div class="pgh"><h2 class="gold">TOP 5 &middot; LIFETIME TOTAL</h2><div class="pgsub">THE FINAL RESULTS &middot; ALL TIME</div></div>' + body + '</div>';
  }

  function current() { var s = $('pScreen'); return s && s.classList.contains('inapp') ? s.dataset.app : ''; }
  function paint() { var a = current(); if (a === 'alarm') paintAlarm(); else if (a === 'give') paintGive(); else if (a === 'top5') paintTop(); }
  window.HallCampaign = {
    phase: phase, set: setSched,
    open: function (name) { if (name === 'alarm') paintAlarm(); else if (name === 'give') { gv.st = null; gv.msg = ''; gv.confirm = false; paintGive(); } else if (name === 'top5') { tp.rows = null; tp.err = false; paintTop(); } }
  };
  var last = '';
  setInterval(function () { var p = phase(); if (p !== last) { last = p; icons(); paint(); } if (current() === 'alarm') tickAlarm(); if (current() === 'give') tickGive(); }, 1000);
  icons(); last = phase();
  /* the server clock is read as soon as the connection (net.js) is ready, again whenever the tab comes back, and every 5 minutes: the phases and countdowns follow the server, never the device clock */
  (function first(n) { if (window.HallNet && window.HallNet.api) sync(); else if (n < 40) setTimeout(function () { first(n + 1); }, 500); })(0);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) sync(); });
  setInterval(sync, 5 * 60 * 1000);
  P.onChange(function (what) { if (what === 'connect' || what === 'scores') { if (current() === 'give') { gv.st = null; paintGive(); } } });
})();
