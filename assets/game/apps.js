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
  var cBuilt = false, cEl, f = { tier: 0, family: '', view: 'all' }, seen = new Set();
  function tierDot(t) { return t.grad ? '<i class="dm" style="background:' + t.grad + '"></i>' : '<i class="dm" style="background:' + t.color + '"></i>'; }
  function buildCollected() {
    cEl = $('collApp'); if (!cEl || cBuilt || !P.cards().length) return; cBuilt = true;
    var tierBars = P.tiers.map(function (t) { return '<div class="pb" data-t="' + t.n + '"><span>' + t.name.toUpperCase() + '</span><div class="tr"><i></i></div><span class="ct">0/' + t.count + '</span></div>'; }).join('');
    var famBars = P.families.map(function (fa) { return '<div class="pb" data-f="' + fa.key + '"><span>' + fa.name.toUpperCase() + '</span><div class="tr"><i></i></div><span class="ct">0/' + fa.count + '</span></div>'; }).join('');
    var tierChips = '<button class="chip on" data-k="tier" data-v="0">ALL</button>' + P.tiers.map(function (t) { return '<button class="chip" data-k="tier" data-v="' + t.n + '">' + tierDot(t) + ROMAN[t.n] + '</button>'; }).join('');
    var famChips = '<button class="chip on" data-k="family" data-v="">ALL</button>' + P.families.map(function (fa) { return '<button class="chip" data-k="family" data-v="' + fa.key + '">' + fa.name.toUpperCase() + '</button>'; }).join('');
    var viewChips = ['all', 'owned', 'missing'].map(function (v, i) { return '<button class="chip' + (i ? '' : ' on') + '" data-k="view" data-v="' + v + '">' + v.toUpperCase() + '</button>'; }).join('');
    var cards = P.cards().map(function (c) { return '<div class="cc" data-n="' + c.n + '" data-t="' + c.tier + '" data-f="' + c.family + '"><div class="cf"><div class="cb"><img src="assets/game/card-back.webp" alt="" loading="lazy" decoding="async"></div><div class="cfr"><img data-src="' + c.file + '" alt="' + esc(c.name) + '" decoding="async"></div></div><span class="cn">' + pad3(c.n) + '</span></div>'; }).join('');
    cEl.classList.add('page');
    cEl.innerHTML = '<div class="pg" id="cScroll"><div class="pgh"><h2 class="gold">COLLECTED</h2><div class="pgsub" id="cSub">0 / 120</div></div>' +
      '<div class="pgnote" id="cNote"></div>' +
      '<div class="sec"><div class="pb total"><span>ALL</span><div class="tr"><i id="cTotalBar"></i></div><span class="ct" id="cTotalCt">0/120</span></div></div>' +
      '<div class="sec"><div class="sech">BY TIER</div><div class="bars2" id="cTiers">' + tierBars + '</div></div>' +
      '<div class="sec"><div class="sech">BY FAMILY</div><div class="bars2" id="cFams">' + famBars + '</div></div>' +
      '<div class="sec"><div class="sech">FILTERS</div><div class="fl"><div class="chips">' + tierChips + '</div><div class="chips">' + famChips + '</div><div class="chips">' + viewChips + '</div></div></div>' +
      '<div class="sec"><div class="sech"><span id="cShow">SHOWING 120</span></div></div>' +
      '<div class="cgrid" id="cGrid">' + cards + '</div></div>';
    cEl.addEventListener('click', function (ev) { var b = ev.target.closest('.chip'); if (!b) return; var k = b.getAttribute('data-k'), v = b.getAttribute('data-v'); f[k] = k === 'tier' ? parseInt(v, 10) : v; Array.prototype.forEach.call(b.parentNode.children, function (x) { x.classList.toggle('on', x === b); }); applyFilters(); });
  }
  function refreshCollected(animate) {
    if (!cBuilt) return;
    var own = P.owned(), cards = P.cards(), total = 0, byT = {}, byF = {};
    cards.forEach(function (c) { if (own.has(c.n)) { total++; byT[c.tier] = (byT[c.tier] || 0) + 1; byF[c.family] = (byF[c.family] || 0) + 1; } });
    $('cSub').textContent = total + ' / ' + cards.length; $('cTotalCt').textContent = total + '/' + cards.length; $('cTotalBar').style.width = (total / cards.length * 100) + '%';
    P.tiers.forEach(function (t) { var row = cEl.querySelector('.pb[data-t="' + t.n + '"]'); var n = byT[t.n] || 0; row.querySelector('i').style.width = (n / t.count * 100) + '%'; row.querySelector('.ct').textContent = n + '/' + t.count; });
    P.families.forEach(function (fa) { var row = cEl.querySelector('.pb[data-f="' + fa.key + '"]'); var n = byF[fa.key] || 0; row.querySelector('i').style.width = (n / fa.count * 100) + '%'; row.querySelector('.ct').textContent = n + '/' + fa.count; });
    $('cNote').textContent = P.isSignedIn() ? 'SIGNED IN AS ' + String(P.username() || '').toUpperCase() : 'DEMO MODE · SIGN IN TO KEEP YOUR CARDS';
    Array.prototype.forEach.call(cEl.querySelectorAll('.cc'), function (el) {
      var n = parseInt(el.getAttribute('data-n'), 10), has = own.has(n), was = el.classList.contains('owned');
      if (has && !was) { var img = el.querySelector('.cfr img'); if (!img.getAttribute('src')) img.setAttribute('src', img.getAttribute('data-src')); if (animate) { el.classList.add('fresh'); setTimeout(function () { el.classList.remove('fresh'); }, 1300); } el.classList.add('owned'); }
      else if (!has && was) el.classList.remove('owned');
    });
    applyFilters();
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
    lEl.innerHTML = '<div class="pg"><div class="pgh"><h2 class="gold">LEADERBOARD</h2><div class="pgsub" id="lSub">LIFETIME TOTALS</div></div>' +
      '<div class="tabs3" id="lTabs"><button class="on" data-k="lifetime">LIFETIME</button><button data-k="best">BEST RUN</button><button data-k="last">LAST RUN</button></div>' +
      '<div class="sec" id="lList"></div></div>';
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
        row('doc', 'Terms of Service', '<span class="v">&rsaquo;</span>', 'sTos', 'button') +
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
    if (cBuilt && (what === 'cards' || what === 'connect')) refreshCollected(what === 'cards');
    if (lBuilt && (what === 'scores' || what === 'connect')) refreshLeaderboard();
    if (sBuilt && what === 'connect') drawSettings();
  });
  P.whenReady(function () { /* the card list is here: the Collected grid is built the first time the app opens */ });
})();
