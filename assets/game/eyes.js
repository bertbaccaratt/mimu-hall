/* CLICK TO LOAD: the cover tilts and two eyes peek out from under it (an idea from the "Creepy Button" CodePen by Jon Kantner). The real button never moves, so it clicks exactly as before. */
(function () {
  'use strict';
  var gate = document.getElementById('gate'); if (!gate) return;
  var eyes = gate.querySelector('.geyes'), pupils = gate.querySelectorAll('.gpupil');
  function look(x, y) {   // x and y are -1 to 1: where the pupils point
    for (var i = 0; i < pupils.length; i++) pupils[i].style.transform = 'translate(' + (-50 + x * 50).toFixed(1) + '%, ' + (-50 + y * 50).toFixed(1) + '%)';
  }
  function aim(cx, cy) {
    var r = eyes.getBoundingClientRect(), dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2), a = Math.atan2(-dy, dx) + Math.PI / 2, d = Math.hypot(dx, dy);
    look(Math.max(-1, Math.min(1, Math.sin(a) * d / 180)), Math.max(-1, Math.min(1, Math.cos(a) * d / 75)));
  }
  gate.addEventListener('mousemove', function (e) { aim(e.clientX, e.clientY); });
  gate.addEventListener('touchmove', function (e) { var t = e.touches[0]; if (t) aim(t.clientX, t.clientY); }, { passive: true });
  gate.addEventListener('mouseleave', function () { look(0, 0); });
  /* a phone has no hover, so every 15 seconds the cover lifts on its own for a moment and the eyes look around */
  var coarse = false; try { coarse = window.matchMedia('(hover: none)').matches; } catch (e) {}
  if (coarse) {
    var timers = [];
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function peek() {
      if (!gate.isConnected || gate.style.display === 'none' || !gate.classList.contains('show')) return;
      gate.classList.add('peek'); look(-0.8, 0.2);
      later(function () { look(0.8, -0.2); }, 550); later(function () { look(0, 0.3); }, 1100); later(function () { gate.classList.remove('peek'); look(0, 0); }, 1700);
    }
    setInterval(peek, 15000);
  }
})();
