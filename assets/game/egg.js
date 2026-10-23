/* A hidden Easter egg: a black pack lying on the nearest table in the hall. Click it to switch the RGB lights around the phone on, click it again to switch them off. */
(function () {
  'use strict';
  var KEY = 'mimu-rgb', IW = 1920, IH = 1080, CX = 452, CY = 892, W = 118;   // where the pack sits in the 1920 x 1080 picture, and how wide it is there
  var veil = document.querySelector('.veil'), phone = document.getElementById('phone'); if (!veil || !phone) return;
  var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'eggpack'; btn.setAttribute('aria-hidden', 'true'); btn.tabIndex = -1;
  btn.innerHTML = '<img src="assets/game/pack.webp" alt="" draggable="false">';
  veil.parentNode.insertBefore(btn, veil.nextSibling);
  function get() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function set(on) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} }
  function paint() { phone.classList.toggle('rgb', on); btn.classList.toggle('on', on); }
  var on = get(); paint();
  btn.addEventListener('click', function (ev) { ev.stopPropagation(); on = !on; set(on); paint(); btn.classList.remove('tap'); void btn.offsetWidth; btn.classList.add('tap'); });
  /* the picture behind the page is scaled to cover the window, so the pack is placed with the same maths */
  function place() {
    var vw = window.innerWidth, vh = window.innerHeight, s = Math.max(vw / IW, vh / IH), ox = (vw - IW * s) / 2, oy = (vh - IH * s) / 2, x = ox + CX * s, y = oy + CY * s;
    btn.style.setProperty('--w', (W * s).toFixed(1) + 'px'); btn.style.left = x.toFixed(1) + 'px'; btn.style.top = y.toFixed(1) + 'px';
    btn.style.display = x < 0 || x > vw || y < 0 || y > vh ? 'none' : '';
  }
  place(); window.addEventListener('resize', place);
})();
