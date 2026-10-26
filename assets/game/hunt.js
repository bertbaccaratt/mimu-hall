/* All 11 items sit inside the middle part of the picture (about 13% to 87% across), so they stay on screen on wide, normal and square-ish windows. */
/* THE PHONE NUMBER EASTER EGG: 11 hidden clickable items in the hall background (3 boxes of cards and 8 candles, left and right of the phone).
   Clicked in the secret order they reveal a phone number on the phone. The order and the number are kept on the server: this page only reports which item was
   clicked, and is told the number only when the whole pattern is right. The positions below are fractions of the 1920 x 1080 hall picture. */
(function () {
  'use strict';
  var SPOTS = [
    { n: 'Left box of cards (front table)', t: 'box', x: 256 / 1920, y: 855 / 1080, w: 235 / 1920, h: 135 / 1080 },
    { n: 'Left box of cards (far table)', t: 'box', x: 583 / 1920, y: 748 / 1080, w: 92 / 1920, h: 56 / 1080 },
    { n: 'Right box of cards (front table)', t: 'box', x: 1580 / 1920, y: 810 / 1080, w: 190 / 1920, h: 120 / 1080 },
    { n: 'Left candle (middle table)', t: 'candle', x: 406 / 1920, y: 718 / 1080 },
    { n: 'Left candle (beside the far box)', t: 'candle', x: 507 / 1920, y: 761 / 1080 },
    { n: 'Left candle (back row, near)', t: 'candle', x: 560 / 1920, y: 700 / 1080 },
    { n: 'Left candle (back row, far)', t: 'candle', x: 642 / 1920, y: 733 / 1080 },
    { n: 'Right candle (back row, near)', t: 'candle', x: 1276 / 1920, y: 733 / 1080 },
    { n: 'Right candle (back row, far)', t: 'candle', x: 1355 / 1920, y: 700 / 1080 },
    { n: 'Right candle (middle table)', t: 'candle', x: 1408 / 1920, y: 762 / 1080 },
    { n: 'Right candle (middle row)', t: 'candle', x: 1508 / 1920, y: 718 / 1080 }
  ];
  SPOTS.forEach(function (s) { if (s.t === 'candle') { s.w = 40 / 1920; s.h = 70 / 1080; } });
  var layer = null, btns = [], busy = false, lastAt = 0, over = false, cache = null, cacheAt = 0;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* the notification on the phone: a red frame that says EASTER EGG */
  /* the number is never printed on the page: the winner taps once, confirms, and the server hands it over a single time */
  function noteHtml(number, winner, dialed) {
    return '<div class="hntag">EASTER EGG</div>' + (winner ? '<div class="hncong">CONGRATULATIONS! YOU FOUND IT FIRST</div>' : '') + (dialed ? '<div class="hntxt">THE NUMBER HAS ALREADY BEEN DIALED</div>' : '<div class="hntxt">CALL THE NUMBER NOW. IT CAN ONLY BE DIALED ONCE.</div><button type="button" class="hnnum hndial">TAP TO DIAL</button>');
  }
  /* the one-time confirm, then the server marks the number used and returns it for a single call */
  function confirmDial() {
    var scr = $('pScreen') || document.body; if ($('hnConfirm')) return;
    var c = document.createElement('div'); c.id = 'hnConfirm'; c.className = 'hnconfirm'; c.setAttribute('role', 'alertdialog');
    c.innerHTML = '<div class="hnbox"><div class="hntag">ONLY ONCE</div><p>THIS NUMBER CAN BE DIALED ONE TIME ONLY. IF THE CALL DOES NOT GO THROUGH, IT CANNOT BE DIALED AGAIN. DIAL IT NOW?</p><button type="button" class="hngo">DIAL NOW</button><button type="button" class="hnno">NOT YET</button></div>';
    scr.appendChild(c);
  }
  function doDial() {
    var net = window.HallNet; if (!net || !net.api) return; var c = $('hnConfirm'); if (c) c.querySelector('.hngo').disabled = true;
    net.api('/egg/dial', { body: { vid: net.vid ? net.vid() : '' } }).then(function (r) {
      if (c) c.remove(); cache = cache || { found: true, mine: true }; cache.dialed = true; cacheAt = Date.now();
      var n = $('huntNote'); if (n) { var t = n.querySelector('.hntxt'); if (t) t.textContent = 'THE NUMBER HAS ALREADY BEEN DIALED'; var b = n.querySelector('.hndial'); if (b) b.remove(); }
      paintBanner();
      if (r && r.number) { var tel = String(r.number).replace(/[^0-9]/g, ''); try { location.href = 'tel:+' + tel; } catch (e) {} }
    }, function () { if (c) c.remove(); });
  }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    if (t.closest('.huntnote:not(.static) .hndial, #huntBadge .hndial')) { confirmDial(); return; }
    if (t.closest('#hnConfirm .hngo')) { doDial(); return; }
    if (t.closest('#hnConfirm .hnno')) { var c = $('hnConfirm'); if (c) c.remove(); }
  });
  function showNote(winner, dialed) {
    var scr = $('pScreen'); if (!scr) return; var old = $('huntNote'); if (old) old.remove();
    var n = document.createElement('div'); n.id = 'huntNote'; n.className = 'huntnote'; n.setAttribute('role', 'alertdialog'); n.setAttribute('aria-label', 'Easter egg: call this number now');
    n.innerHTML = noteHtml(null, winner, dialed) + '<button type="button" class="hnx" aria-label="Close">&times;</button>';
    scr.appendChild(n); n.querySelector('.hnx').addEventListener('click', function () { n.classList.add('gone'); setTimeout(function () { n.remove(); }, 350); });
    var ph = $('phone'); if (ph && !ph.classList.contains('open')) { var gt = document.querySelector('a[href="#games"]'); if (gt) gt.click(); }
    try { if (window.MIMUAudio && MIMUAudio.card) MIMUAudio.card(); } catch (e) {}
  }

  /* the hidden hotspots, laid over the background picture exactly where the items are (the picture is scaled to cover the page) */
  function place() {
    if (!layer) return; var W = innerWidth, H = innerHeight, sc = W >= H ? Math.min(W / 1920, H / 1080) : Math.max(W / 1920, H / 1080), ox = (W - 1920 * sc) / 2, oy = (H - 1080 * sc) / 2;
    btns.forEach(function (b, i) { var s = SPOTS[i], w = s.w * 1920 * sc * 1.15, h = s.h * 1080 * sc * 1.15; var l = ox + s.x * 1920 * sc - w / 2, t = oy + s.y * 1080 * sc - h / 2; if (l < 0) { w += l; l = 0; } if (l + w > W) w = W - l; b.style.display = w > 6 ? '' : 'none'; b.style.width = Math.max(w, 0) + 'px'; b.style.height = h + 'px'; b.style.left = l + 'px'; b.style.top = t + 'px'; });
  }
  function report(k) {
    var net = window.HallNet; if (!net || !net.api || busy || over) return; busy = true;
    net.api('/egg/click', { body: { vid: net.vid ? net.vid() : 'v' + Math.random().toString(36).slice(2, 12), k: k } }).then(function (r) { busy = false; if (r && r.over) { setOver(); } else if (r && r.done) { try { localStorage.setItem('mimu-egg', JSON.stringify({ t: Date.now() })); } catch (e) {} cache = { found: true, mine: true, dialed: false }; cacheAt = Date.now(); setOver(); showNote(true, false); paintBanner(); } }, function () { busy = false; });
  }
  /* once it is won, nobody can win it again: the items stop reacting */
  function setOver() { over = true; if (layer) layer.classList.add('over'); }
  function status(force) {
    var net = window.HallNet; if (!net || !net.api) return Promise.resolve(cache || { found: false, mine: false });
    if (!force && cache && Date.now() - cacheAt < 45000) return Promise.resolve(cache);
    var vid = net.vid ? net.vid() : ''; return net.api('/egg/status?vid=' + encodeURIComponent(vid)).then(function (r) { cache = r || { found: false, mine: false }; cacheAt = Date.now(); if (cache.found) setOver(); return cache; }, function () { return cache || { found: false, mine: false }; });
  }
  /* the banner at the top of the Badges page: only "found" or "not found" for everyone, and a congratulations for the one who found it */
  function paintBanner() {
    var el = $('huntBadge'); if (!el) return; var c = cache || { found: false, mine: false };
    el.className = 'huntbadge ' + (c.mine ? 'mine' : c.found ? 'found' : 'lost');
    el.innerHTML = '<span class="hbico" aria-hidden="true">&#129370;</span><b>' + (c.found ? 'EASTER EGG FOUND' : 'EASTER EGG NOT FOUND') + '</b>' + (c.mine ? '<em>CONGRATULATIONS! YOU ARE THE ONE WHO FOUND IT. ' + (c.dialed ? 'THE NUMBER HAS ALREADY BEEN DIALED.' : 'THE NUMBER CAN BE DIALED ONLY ONCE. <button type="button" class="hndial hnlink">TAP TO DIAL</button>') + '</em>' : '');
  }
  function banner() { paintBanner(); status(false).then(paintBanner); 
  }
  function build() {
    if (layer || !document.body) return;
    if (window.matchMedia && (matchMedia('(max-width: 900px)').matches || matchMedia('(pointer: coarse)').matches)) return;   /* a phone shows the phone, not the hall around it: the hidden items are for computers */
    layer = document.createElement('div'); layer.className = 'huntlayer'; layer.setAttribute('aria-hidden', 'true');
    SPOTS.forEach(function (s, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'hunthot ' + s.t; b.tabIndex = -1; b.setAttribute('data-k', i);
      b.addEventListener('click', function () { var now = Date.now(); if (now - lastAt < 140) return; lastAt = now; b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); report(i); });
      layer.appendChild(b); btns.push(b);
    });
    var veil = document.querySelector('.veil'); if (veil && veil.parentNode) veil.parentNode.insertBefore(layer, veil.nextSibling); else document.body.appendChild(layer);
    place(); window.addEventListener('resize', place);
  }
  window.HallHunt = { SPOTS: SPOTS, noteHtml: noteHtml, show: showNote, status: status, banner: banner };
  setTimeout(function () { status(true); }, 2500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
