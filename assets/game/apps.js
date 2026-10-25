/* The phone's two extra apps: COLLECTED (the 120 cards, face down until you earn them) and LEADERBOARD (lifetime totals, best run, last run).
   Both read everything from HallProfile, so they stay empty until somebody is signed in. */
(function () {
  'use strict';
  var P = window.HallProfile; if (!P) return;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad3(n) { n = String(n); while (n.length < 3) n = '0' + n; return n; }
  function fmt(n) { return Math.floor(n || 0).toLocaleString('en-US'); }
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

  /* ---------- COLLECTED ---------- */
  var HOWTO_COLLECTED = '<div class="howto"><div class="hth"><b>HOW TO USE COLLECTED</b></div>' +
    '<div class="hex"><figure><div class="hcard"><img src="assets/game/card-back.webp" alt="A card you do not have yet, face down"></div><figcaption>NOT COLLECTED<br>FACE DOWN</figcaption></figure><span class="har">&rsaquo;</span><figure><div class="hcard own"><img src="assets/game/cards/ex/049.webp" alt="Good Boy Gary, a collected card, flipped face up"></div><figcaption>COLLECTED<br>FLIPPED &middot; #049</figcaption></figure></div>' +
    '<div class="hsub">ALL 120 CARDS START FACE DOWN. WHEN YOU EARN OR BUY ONE, IT FLIPS OVER AND SHOWS ITS PICTURE.</div>' +
    '<ol class="hsteps"><li><b>READ A CARD</b> THE DIAMONDS AT THE TOP SHOW HOW RARE IT IS (ONE TO FIVE), THE BADGE IN THE CORNER IS ITS FAMILY, AND THE NUMBER AT THE BOTTOM IS ITS PLACE FROM 1 TO 120.</li>' +
    '<li><b>WATCH THE BARS</b> THE TOP BAR IS YOUR WHOLE DECK. THE BARS BELOW SHOW HOW CLOSE YOU ARE IN EVERY RARITY TIER AND EVERY FAMILY.</li>' +
    '<li><b>FILTER</b> USE THE BUTTONS TO SHOW ONE TIER, ONE FAMILY, ONLY CARDS YOU HAVE COLLECTED, OR ONLY THE ONES YOU ARE MISSING.</li>' +
    '<li><b>GET CARDS</b> JUMP THE FLOATING CARD IN THE HALL. OR BUY A FACE UP DUPLICATE FROM ANOTHER PLAYER IN THE MARKETPLACE, FOR POINTS.</li>' +
    '<li><b>DUPLICATES</b> A GOLD ×2, ×3 SHOWS WHEN YOU HAVE EXTRA COPIES. TAP SELL 1 TWICE TO SELL ONE COPY TO THE HALL FOR POINTS.</li>' +
    '<li>UNTIL SIGN-IN OPENS THE HALL RUNS AS A DEMO, SO NOTHING IS SAVED HERE YET.</li></ol><div class="hsub" style="margin-top:8px"><b>IN-GAME CARDS ONLY.</b> THEY ARE PICTURES THAT STAND FOR REAL CARDS, NOT THE REAL CARDS, AND ARE NOT REAL-WORLD ASSETS.</div></div>';
  var cBuilt = false, cEl, f = { tier: 0, family: '', view: 'all' }, seen = new Set(), cMode = 'reg', ff = { view: 'all' };
  function tierDot(t) { return t.grad ? '<i class="dm" style="background:' + t.grad + '"></i>' : '<i class="dm" style="background:' + t.color + '"></i>'; }
  /* ---------- the foil page: 120 cards, each in two glowing halves ---------- */
  var HOWTO_FOIL = '<div class="howto foilhow"><div class="hth"><b>HOW FOIL WORKS</b></div><div class="hsub">EVERY CARD CAN BE RIPPED DOWN THE MIDDLE INTO TWO GLOWING FOIL HALVES: 240 PIECES IN ALL. COLLECT BOTH HALVES OF A CARD TO MAKE ITS FOIL CARD.</div>' +
    '<ol class="hsteps"><li><b>FIND THEM IN A RUN</b> THE FIRST FOIL HALF FLOATS IN AFTER 1 MINUTE OF TOTAL PLAY, THEN ONE MORE FOR EVERY 30 MINUTES YOU PLAY. THE PIECES COME IN A MIX: ANY CARD, EITHER HALF, AND SOMETIMES BOTH HALVES OF ONE CARD.</li>' +
    '<li><b>RARE CARDS COME LESS OFTEN</b> A LEGENDARY HALF IS MUCH HARDER TO FIND THAN A COMMON ONE.</li>' +
    '<li><b>YOUR HALVES ARE SAVED</b> A HALF YOU FIND STAYS ON ITS CARD UNTIL YOU FIND THE OTHER ONE. HERE A HALF SHOWS AS HALF A CARD.</li>' +
    '<li>FOIL IS THE ONLY WAY TO GET FOIL CARDS. THEY STAND FOR REAL CARDS AND ARE NOT REAL-WORLD ASSETS.</li></ol></div>';
  function foilPage() {
    var cs = P.cards().map(function (c) { return '<div class="fc" data-n="' + c.n + '" data-t="' + c.tier + '"><div class="fcf"><div class="fcb"><img src="assets/game/card-back.webp" alt="" loading="lazy" decoding="async"></div><div class="fh fl"><img data-src="' + c.file + '" alt="" decoding="async"></div><div class="fh fr"><img data-src="' + c.file + '" alt="" decoding="async"></div><i class="fshine"></i></div><span class="cn">' + pad3(c.n) + '</span></div>'; }).join('');
    var chips = ['all', 'full', 'half', 'missing'].map(function (v, i) { return '<button class="chip' + (i ? '' : ' on') + '" data-fv="' + v + '">' + ({ all: 'ALL', full: 'FOIL CARDS', half: 'HALVES ONLY', missing: 'MISSING' })[v] + '</button>'; }).join('');
    return HOWTO_FOIL + '<div class="sec"><div class="pb total foil"><span>FOIL CARDS</span><div class="tr"><i id="fCardBar"></i></div><span class="ct" id="fCardCt">0/120</span></div><div class="pb total foil"><span>PIECES</span><div class="tr"><i id="fPieceBar"></i></div><span class="ct" id="fPieceCt">0/240</span></div></div>' +
      '<div class="sec"><div class="sech">FILTER</div><div class="fl"><div class="chips" id="fChips">' + chips + '</div></div></div><div class="sec"><div class="sech"><span id="fShow">SHOWING 120</span></div></div><div class="cgrid foilgrid" id="fGrid">' + cs + '</div>';
  }
  function foilStats() { var fm = P.foil ? P.foil() : {}, cards = 0, pieces = 0; Object.keys(fm).forEach(function (k) { var h = String(fm[k] || ''); pieces += h.length; if (h.length >= 2) cards++; }); return { map: fm, cards: cards, pieces: pieces }; }
  function refreshFoil() {
    if (!cBuilt) return; var st = foilStats(), total = (P.cards().length || 120), els = cEl.querySelectorAll('.fc');
    $('fCardCt').textContent = st.cards + '/' + total; $('fCardBar').style.width = (st.cards / total * 100) + '%'; $('fPieceCt').textContent = st.pieces + '/' + (total * 2); $('fPieceBar').style.width = (st.pieces / (total * 2) * 100) + '%';
    Array.prototype.forEach.call(els, function (el) {
      var n = el.getAttribute('data-n'), h = String(st.map[n] || ''), l = h.indexOf('L') >= 0, r = h.indexOf('R') >= 0;
      el.classList.toggle('hl', l); el.classList.toggle('hr', r); el.classList.toggle('full', l && r); el.classList.toggle('some', l || r);
      if (l || r) Array.prototype.forEach.call(el.querySelectorAll('.fh img'), function (im) { if (!im.getAttribute('src')) im.setAttribute('src', im.getAttribute('data-src')); });
    });
    applyFoilFilters(); if (cMode === 'foil') $('cSub').textContent = 'FOIL ' + st.cards + ' / ' + total + ' \u00b7 ' + st.pieces + ' PIECES';
  }
  function applyFoilFilters() {
    var shown = 0; Array.prototype.forEach.call(cEl.querySelectorAll('.fc'), function (el) {
      var full = el.classList.contains('full'), some = el.classList.contains('some'), ok = ff.view === 'all' || (ff.view === 'full' && full) || (ff.view === 'half' && some && !full) || (ff.view === 'missing' && !some);
      el.hidden = !ok; if (ok) shown++;
    }); $('fShow').textContent = 'SHOWING ' + shown;
  }
  function buildCollected() {
    cEl = $('collApp'); if (!cEl || cBuilt || !P.cards().length) return; cBuilt = true;
    var tierBars = P.tiers.map(function (t) { return '<div class="pb" data-t="' + t.n + '"><span>' + t.name.toUpperCase() + '</span><div class="tr"><i></i></div><span class="ct">0/' + t.count + '</span></div>'; }).join('');
    var famBars = P.families.map(function (fa) { return '<div class="pb" data-f="' + fa.key + '"><span>' + fa.name.toUpperCase() + '</span><div class="tr"><i></i></div><span class="ct">0/' + fa.count + '</span></div>'; }).join('');
    var tierChips = '<button class="chip on" data-k="tier" data-v="0">ALL</button>' + P.tiers.map(function (t) { return '<button class="chip" data-k="tier" data-v="' + t.n + '">' + tierDot(t) + ROMAN[t.n] + '</button>'; }).join('');
    var famChips = '<button class="chip on" data-k="family" data-v="">ALL</button>' + P.families.map(function (fa) { return '<button class="chip" data-k="family" data-v="' + fa.key + '">' + fa.name.toUpperCase() + '</button>'; }).join('');
    var viewChips = ['all', 'owned', 'missing'].map(function (v, i) { return '<button class="chip' + (i ? '' : ' on') + '" data-k="view" data-v="' + v + '">' + (v === 'owned' ? 'COLLECTED' : v.toUpperCase()) + '</button>'; }).join('');
    var cards = P.cards().map(function (c) { return '<div class="cc" data-n="' + c.n + '" data-t="' + c.tier + '" data-f="' + c.family + '"><div class="cf"><div class="cb"><img src="assets/game/card-back.webp" alt="" loading="lazy" decoding="async"></div><div class="cfr"><img data-src="' + c.file + '" alt="' + esc(c.name) + '" decoding="async"></div></div><span class="cn">' + pad3(c.n) + '</span></div>'; }).join('');
    cEl.classList.add('page');
    cEl.innerHTML = '<div class="pg" id="cScroll"><div class="pgh"><h2 class="gold">COLLECTED</h2><div class="pgsub" id="cSub">0 / 120</div></div>' +
      '<div class="tabs3 cmode" id="cTabs"><button class="on" data-m="reg">REGULAR DECK</button><button data-m="foil">FOIL DECK</button></div><div class="pgnote" id="cNote"></div><div id="cReg">' +
      HOWTO_COLLECTED +
      '<div class="sec"><div class="pb total"><span>ALL</span><div class="tr"><i id="cTotalBar"></i></div><span class="ct" id="cTotalCt">0/120</span></div></div>' +
      '<div class="sec"><div class="sech">BY TIER</div><div class="bars2" id="cTiers">' + tierBars + '</div></div>' +
      '<div class="sec"><div class="sech">BY FAMILY</div><div class="bars2" id="cFams">' + famBars + '</div></div>' +
      '<div class="sec"><div class="sech">FILTERS</div><div class="fl"><div class="chips">' + tierChips + '</div><div class="chips">' + famChips + '</div><div class="chips">' + viewChips + '</div></div></div>' +
      '<div class="sec"><div class="sech"><span id="cShow">SHOWING 120</span></div></div>' +
      '<div class="cgrid" id="cGrid">' + cards + '</div></div>' +
      '<div id="cFoil" hidden>' + foilPage() + '</div></div>';
    cEl.addEventListener('click', function (ev) {
      var sb = ev.target.closest('.csell');
      if (sb) {   // selling an extra copy to the Hall: two taps, so it is never an accident
        var card = sb.closest('.cc'), n = parseInt(card.getAttribute('data-n'), 10), note = $('cNote');
        if (sellArm !== n) { sellArm = n; Array.prototype.forEach.call(cEl.querySelectorAll('.csell'), function (x) { x.textContent = 'SELL 1'; x.classList.remove('arm'); }); sb.textContent = 'SELL +' + (sellVals[n] != null ? sellVals[n].toLocaleString('en-US') : '?') + ' PTS?'; sb.classList.add('arm'); setTimeout(function () { if (sellArm === n) { sellArm = null; sb.textContent = 'SELL 1'; sb.classList.remove('arm'); } }, 4000); return; }
        sellArm = null; sb.disabled = true; P.market().sell(n).then(function (r) { note.textContent = 'SOLD ONE COPY OF CARD ' + pad3(n) + ' TO THE HALL'; sellFetched = false; refreshCollected(false); }, function (e) { sb.disabled = false; note.textContent = String((e && e.message) || 'COULD NOT SELL').toUpperCase(); });
        return;
      }
      var tb = ev.target.closest('#cTabs button'); if (tb) { cMode = tb.getAttribute('data-m'); Array.prototype.forEach.call(tb.parentNode.children, function (x) { x.classList.toggle('on', x === tb); }); $('cReg').hidden = cMode !== 'reg'; $('cFoil').hidden = cMode !== 'foil'; if (cMode === 'foil') refreshFoil(); else refreshCollected(false); var sc = $('cScroll'); if (sc) sc.scrollTop = 0; return; }
      var fb = ev.target.closest('#fChips .chip'); if (fb) { ff.view = fb.getAttribute('data-fv'); Array.prototype.forEach.call(fb.parentNode.children, function (x) { x.classList.toggle('on', x === fb); }); applyFoilFilters(); return; }
      var b = ev.target.closest('.chip'); if (!b || !b.getAttribute('data-k')) return; var k = b.getAttribute('data-k'), v = b.getAttribute('data-v'); f[k] = k === 'tier' ? parseInt(v, 10) : v; Array.prototype.forEach.call(b.parentNode.children, function (x) { x.classList.toggle('on', x === b); }); applyFilters(); });
  }
  var sellVals = {}, sellFetched = false, sellArm = null;
  function refreshCollected(animate) {
    if (!cBuilt) return;
    var own = P.owned(), counts = P.counts ? P.counts() : {}, mk = P.market ? P.market() : null, canSell = !!(P.isSignedIn() && mk && mk.sell), cards = P.cards(), total = 0, byT = {}, byF = {};
    cards.forEach(function (c) { if (own.has(c.n)) { total++; byT[c.tier] = (byT[c.tier] || 0) + 1; byF[c.family] = (byF[c.family] || 0) + 1; } });
    if (cMode === 'reg') $('cSub').textContent = total + ' / ' + cards.length; $('cTotalCt').textContent = total + '/' + cards.length; $('cTotalBar').style.width = (total / cards.length * 100) + '%';
    P.tiers.forEach(function (t) { var row = cEl.querySelector('.pb[data-t="' + t.n + '"]'); var n = byT[t.n] || 0; row.querySelector('i').style.width = (n / t.count * 100) + '%'; row.querySelector('.ct').textContent = n + '/' + t.count; });
    P.families.forEach(function (fa) { var row = cEl.querySelector('.pb[data-f="' + fa.key + '"]'); var n = byF[fa.key] || 0; row.querySelector('i').style.width = (n / fa.count * 100) + '%'; row.querySelector('.ct').textContent = n + '/' + fa.count; });
    $('cNote').textContent = P.isSignedIn() ? 'SIGNED IN AS ' + String(P.username() || '').toUpperCase() : 'DEMO MODE · SIGN IN TO KEEP YOUR CARDS';
    Array.prototype.forEach.call(cEl.querySelectorAll('.cc'), function (el) {
      var n = parseInt(el.getAttribute('data-n'), 10), has = own.has(n), was = el.classList.contains('owned');
      if (has && !was) { var img = el.querySelector('.cfr img'); if (!img.getAttribute('src')) img.setAttribute('src', img.getAttribute('data-src')); if (animate) { el.classList.add('fresh'); setTimeout(function () { el.classList.remove('fresh'); }, 1300); } el.classList.add('owned'); }
      else if (!has && was) el.classList.remove('owned');
      var cnt = counts[n] || 0, cx = el.querySelector('.cx'), cs = el.querySelector('.csell');
      if (cnt > 1) { if (!cx) { cx = document.createElement('span'); cx.className = 'cx'; el.appendChild(cx); } cx.textContent = '\u00d7' + cnt; } else if (cx) cx.remove();
      if (cnt > 1 && canSell) { if (!cs) { cs = document.createElement('button'); cs.type = 'button'; cs.className = 'csell'; cs.textContent = 'SELL 1'; el.appendChild(cs); } } else if (cs) cs.remove();
    });
    if (canSell && !sellFetched) { sellFetched = true; mk.sellable().then(function (rows) { rows.forEach(function (r) { sellVals[r.n] = r.value; }); }, function () {}); setTimeout(function () { sellFetched = false; }, 30000); }
    applyFilters(); refreshFoil();
  }
  function applyFilters() {
    var shown = 0;
    Array.prototype.forEach.call(cEl.querySelectorAll('.cc'), function (el) {
      var ok = (!f.tier || el.getAttribute('data-t') === String(f.tier)) && (!f.family || el.getAttribute('data-f') === f.family) && (f.view === 'all' || (f.view === 'owned') === el.classList.contains('owned'));
      el.hidden = !ok; if (ok) shown++;
    });
    $('cShow').textContent = 'SHOWING ' + shown;
  }

  /* ---------- LEADERBOARD ---------- */
  var lBuilt = false, lEl, kind = 'lifetime';
  var TROPHY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5a2 2 0 0 0 0 4h3M16 5h3a2 2 0 0 1 0 4h-3"/><path d="M12 13v4M8.5 20h7M10 17h4"/></svg>';
  function buildLeaderboard() {
    lEl = $('lbApp'); if (!lEl || lBuilt) return; lBuilt = true; lEl.classList.add('page');
    lEl.innerHTML = '<div class="pg"><div class="pgh"><img class="lbbox" src="assets/game/box.webp" alt="The black box you jump over in THE HALL" width="360" height="262" decoding="async"><h2 class="gold">LEADERBOARD</h2><div class="pgsub" id="lSub">LIFETIME TOTALS</div></div>' +
      '<div class="tabs3" id="lTabs"><button class="on" data-k="lifetime">LIFETIME</button><button data-k="best">BEST RUN</button><button data-k="last">LAST RUN</button></div>' +
      '<div class="sec" id="lList"></div>' +
      '<div class="pgh dk"><h2 class="gold">TOP 5 &middot; THE FULL DECK</h2><div class="pgsub">REGULAR AND FOIL DECK COMPLETION</div></div>' +
      '<div class="sec" id="myDeck"></div><div class="sec" id="dList"></div></div>';
    $('lTabs').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (!b) return; kind = b.getAttribute('data-k'); Array.prototype.forEach.call(b.parentNode.children, function (x) { x.classList.toggle('on', x === b); }); refreshLeaderboard(); });
  }
  function refreshLeaderboard() {
    if (!lBuilt) return;
    $('lSub').textContent = { lifetime: 'LIFETIME TOTALS', best: 'BEST SINGLE RUN', last: 'MOST RECENT RUN' }[kind];
    P.leaderboard(kind).then(function (rows) {
      var box = $('lList');
      if (!rows || !rows.length) { box.innerHTML = '<div class="empty">' + TROPHY + '<br>NO RANKED RUNS YET<br><span style="opacity:.7">DEMO RUNS ARE NOT RANKED</span></div>'; return; }
      box.innerHTML = rows.slice(0, 100).map(function (r, i) { return '<div class="lbrow"><span class="rk">' + (i + 1) + '</span><span class="nm">' + esc(r.username || r.name || 'RUNNER') + '</span><span class="sc">' + fmt(r.score) + '</span></div>'; }).join('');
    });
    refreshDeck();
  }
  /* top 5 by deck progress; names come from Glyph once it is connected (P.deckBoard), until then the five places are empty */
  function refreshDeck() {
    var total = (P.cards && P.cards().length) || 120, fs0 = foilStats(), mine = P.owned ? P.owned().size : 0;
    $('myDeck').innerHTML = '<div class="mydk"><div class="mdh"><b>YOUR DECK</b><span>' + (P.isSignedIn() ? esc(String(P.username() || '').toUpperCase()) : 'DEMO MODE') + '</span></div>' +
      '<div class="mdr"><span>REGULAR</span><div class="dkb"><i style="width:' + Math.min(100, mine / total * 100) + '%"></i></div><b>' + mine + '/' + total + '</b></div>' +
      '<div class="mdr foil"><span>FOIL</span><div class="dkb foil"><i style="width:' + Math.min(100, fs0.cards / total * 100) + '%"></i></div><b>' + fs0.cards + '/' + total + '</b></div>' +
      '<div class="mdn">' + fs0.pieces + ' OF ' + (total * 2) + ' FOIL PIECES COLLECTED</div></div>';
    P.deckBoard().then(function (rows) {
      rows = (rows || []).slice(0, 5); var out = '', i, r, pct, dash = '&mdash;';
      for (i = 0; i < 5; i++) {
        r = rows[i];
        if (!r) { out += '<div class="dkrow dkx"><div class="dkt"><span class="rk">' + (i + 1) + '</span><span class="nm">&middot; &middot; &middot;</span><span class="sc">0%</span></div><div class="dkb"><i style="width:0"></i></div><div class="dkb foil"><i style="width:0"></i></div><div class="dka"><span>CARDS ' + dash + '/' + total + '</span><span>FOIL ' + dash + '/' + total + '</span><span>RAREST ' + dash + '</span><span>FAMILY ' + dash + '</span><span>RUNS ' + dash + '</span><span>BEST ' + dash + '</span></div></div>'; continue; }
        pct = Math.min(100, Math.round((r.owned || 0) / total * 1000) / 10); var fpct = Math.min(100, Math.round((r.foilCards || 0) / total * 1000) / 10);
        out += '<div class="dkrow"><div class="dkt"><span class="rk">' + (i + 1) + '</span><span class="nm">' + esc(r.username || 'RUNNER') + '</span><span class="sc">' + pct + '%</span></div><div class="dkb"><i style="width:' + pct + '%"></i></div><div class="dkb foil"><i style="width:' + fpct + '%"></i></div><div class="dka"><span>CARDS ' + fmt(r.owned || 0) + '/' + total + '</span><span>FOIL ' + fmt(r.foilCards || 0) + '/' + total + '</span><span>RAREST ' + esc((r.rarest || dash).toString().toUpperCase()) + '</span><span>FAMILY ' + esc((r.family || dash).toString().toUpperCase()) + '</span><span>RUNS ' + (r.runs == null ? dash : fmt(r.runs)) + '</span><span>BEST ' + (r.best == null ? dash : fmt(r.best)) + '</span></div></div>';
      }
      $('dList').innerHTML = out + (rows.length ? '' : '<div class="dknote">USERNAMES APPEAR HERE ONCE GLYPH IS CONNECTED</div>');
    });
  }

  /* ---------- SETTINGS (the dock's gear) ---------- */
  var sBuilt = false, sEl;
  var IC = {
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.8a7.5 7.5 0 0 1 0 10.4"/></svg>',
    vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 8h14M5 16h14"/><circle cx="9" cy="8" r="2.2" fill="currentColor"/><circle cx="15" cy="16" r="2.2" fill="currentColor"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    hall: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l7 9-7 9-7-9z"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z"/></svg>',
    crown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 18h16l1-10-5 4-4-7-4 7-5-4z"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1.2.9-1.2 1.8M12 16.8v.01"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h7l4 4V20.5H7z"/><path d="M14 3.5V8h4M9.5 12.5h5M9.5 16h5"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>'
  };
  function row(icon, label, right, id, tag) { return '<' + (tag || 'div') + ' class="srow"' + (id ? ' id="' + id + '"' : '') + '><span class="si">' + IC[icon] + '</span><span class="sl">' + label + '</span>' + (right || '') + '</' + (tag || 'div') + '>'; }
  function silentSwitch() { var b = $('bMute'), A = window.MIMUAudio; if (b && A) b.classList.toggle('silent', A.isMuted()); }
  function drawSettings() {
    if (!sEl) return;
    var A = window.MIMUAudio, muted = A ? A.isMuted() : false, vol = A ? Math.round(A.getVolume() * 8) : 8, signed = P.isSignedIn(), name = signed ? (P.username() || 'Runner') : 'Guest';
    sEl.innerHTML = '<div class="pg"><div class="pgh"><h2 class="gold">SETTINGS</h2></div>' +
      '<div class="sgrp prof"><img src="assets/game/hall-icon.webp" alt=""><div><b>' + esc(name) + '</b><span>' + (signed ? 'GLYPH CONNECTED' : 'DEMO MODE &middot; NOT SIGNED IN') + '</span></div></div>' +
      '<div class="sgl">GENERAL</div><div class="sgrp">' +
        row('sound', 'Sound', '<i class="sw2' + (muted ? '' : ' on') + '"></i>', 'sSound', 'button') +
        row('vol', 'Volume', '<input id="sVol" type="range" min="0" max="8" step="1" value="' + vol + '"><span class="v" id="sVolV">' + vol + '</span>') +
        row('clock', 'Clock', '<span class="v">12-HOUR &middot; LOS ANGELES</span>') +
      '</div>' +
      '<div class="sgl">ABOUT</div><div class="sgrp">' +
        row('hall', 'THE HALL', '<span class="v">v1.0</span>') +
        '<a class="srow" href="https://x.com/bert_baccaratt" target="_blank" rel="noopener noreferrer"><span class="si">' + IC.pen + '</span><span class="sl">Created by</span><span class="v xlink">@BERT_BACCARATT</span></a>' +
        row('crown', 'Company', '<span class="v">MIMU ON APE</span>') +
        row('help', 'How to play', '<span class="v">&rsaquo;</span>', 'sRules', 'button') +
        row('doc', 'About','<span class="v">&rsaquo;</span>', 'sTos', 'button') +
      '</div>' +
      '<div class="sgl">ACCOUNT</div><div class="sgrp">' + row('link', 'Disconnect Glyph', '<span class="v">' + (signed ? 'SIGN OUT' : 'NOT CONNECTED') + '</span>', 'sDisc', 'button') + '</div>' +
      '<div class="sfoot">THE HALL &middot; MIMU ON APE &middot; CREATED BY @BERT_BACCARATT</div></div>';
    $('sSound').addEventListener('click', function () { if (A) A.toggleMute(); silentSwitch(); drawSettings(); });
    var rng = $('sVol'); rng.addEventListener('input', function () { var v = parseInt(rng.value, 10); $('sVolV').textContent = v; if (A) { A.setVolume(v / 8); } silentSwitch(); var sw = sEl.querySelector('.sw2'); if (sw && A) sw.classList.toggle('on', !A.isMuted()); });
    $('sRules').addEventListener('click', function () { var a = document.querySelector('a[href="#hall"]'); if (a) a.click(); });
    $('sTos').addEventListener('click', function () { var a = document.querySelector('a[href="#about"]'); if (a) a.click(); });
    var d = $('sDisc'); if (!signed) d.classList.add('off'); d.addEventListener('click', function () { if (P.isSignedIn()) { P.disconnect(); drawSettings(); } });
  }
  function buildSettings() { sEl = $('setApp'); if (!sEl) return; sEl.classList.add('page'); sBuilt = true; drawSettings(); }
  /* ---------- the phone asks for an app ---------- */
  window.HallApps = {
    open: function (name) {
      if (name === 'collected') { buildCollected(); refreshCollected(false); var s = $('cScroll'); if (s) s.scrollTop = 0; }
      if (name === 'leaders') { buildLeaderboard(); refreshLeaderboard(); }
      if (name === 'settings') { if (!sBuilt) buildSettings(); else drawSettings(); }
    }
  };
  P.onChange(function (what) {
    if (cBuilt && (what === 'cards' || what === 'connect' || what === 'foil')) refreshCollected(what === 'cards');
    if (lBuilt && (what === 'scores' || what === 'connect' || what === 'foil' || what === 'cards')) refreshLeaderboard();
    if (sBuilt && what === 'connect') drawSettings();
  });
  P.whenReady(function () { /* the card list is here: the Collected grid is built the first time the app opens */ });
})();
