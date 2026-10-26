/* THE POWER-UP ART: the coin magnet, the coin multiplier and the phone battery, drawn in code.
   Coins are gold, so none of these uses gold: the magnet is a red and black ACME horseshoe with white tips, the multiplier is a violet chip with a white rim,
   and the battery is neon green in a white outline. Each sits on a dark backing disc and a glow in its own colour, so it stands out inside a group of coins. */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  var GLOW = { magnet: '255,70,60', multi: '190,95,255', battery: '60,255,140', heart: '255,40,90' };
  /* ctx is already translated to the middle of the item; iw is the item width; t is the game clock; ph a random phase; label the multiplier text (like x3) */
  function draw(ctx, kind, iw, t, ph, label) {
    var pulse = 0.8 + 0.2 * Math.sin(t * 4 + ph), glow = GLOW[kind] || GLOW.battery, g, i;
    /* 1. a dark disc behind it, so the item never blends into gold coins or the floor */
    ctx.save(); g = ctx.createRadialGradient(0, 0, iw * 0.2, 0, 0, iw * 0.62); g.addColorStop(0, 'rgba(8,4,10,0.82)'); g.addColorStop(0.75, 'rgba(8,4,10,0.55)'); g.addColorStop(1, 'rgba(8,4,10,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, iw * 0.62, 0, TAU); ctx.fill(); ctx.restore();
    /* 2. a glow in the item's own colour */
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    g = ctx.createRadialGradient(0, 0, iw * 0.1, 0, 0, iw * 0.95); g.addColorStop(0, 'rgba(' + glow + ',' + (0.6 * pulse) + ')'); g.addColorStop(0.6, 'rgba(' + glow + ',' + (0.22 * pulse) + ')'); g.addColorStop(1, 'rgba(' + glow + ',0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, iw * 0.95, 0, TAU); ctx.fill(); ctx.restore();
    ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
    if (kind === 'magnet') magnet(ctx, iw, t, ph);
    else if (kind === 'multi') chip(ctx, iw, t, label);
    else if (kind === 'heart') heart(ctx, iw);
    else battery(ctx, iw);
  }

  /* the ACME magnet: a red horseshoe, a black band, white pole tips, ACME on the curve */
  function magnet(ctx, iw, t, ph) {
    var r = iw * 0.27, th = iw * 0.2, leg = iw * 0.36, ol = iw * 0.035, i, a;
    function body(width, col, from, to) {   /* the horseshoe as one path: the curve and the two legs */
      ctx.lineWidth = width; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI, false); ctx.moveTo(-r, 0); ctx.lineTo(-r, -leg * to); ctx.moveTo(r, 0); ctx.lineTo(r, -leg * to); ctx.stroke();
    }
    ctx.translate(0, iw * 0.06);
    body(th + ol * 2, '#0d0709', 0, 1);                       /* black outline */
    body(th, '#d71a1a', 0, 0.62);                              /* red body */
    ctx.lineWidth = th * 0.32; ctx.strokeStyle = '#ff6a5c'; ctx.beginPath(); ctx.arc(0, 0, r + th * 0.28, 0.2, Math.PI - 0.2, false); ctx.stroke();      /* highlight on the outside of the curve */
    ctx.lineWidth = th * 0.26; ctx.strokeStyle = '#8f0d10'; ctx.beginPath(); ctx.arc(0, 0, r - th * 0.3, 0.2, Math.PI - 0.2, false); ctx.stroke();        /* shade on the inside */
    /* the black band, then the white tips */
    for (i = -1; i <= 1; i += 2) {
      ctx.fillStyle = '#16090b'; ctx.fillRect(i * r - th / 2, -leg * 0.74, th, leg * 0.13);
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(i * r - th / 2, -leg - ol * 0.2, th, leg * 0.26); ctx.strokeStyle = '#0d0709'; ctx.lineWidth = ol; ctx.strokeRect(i * r - th / 2, -leg - ol * 0.2, th, leg * 0.26);
      ctx.fillStyle = '#c9c4b8'; ctx.fillRect(i * r - th / 2, -leg + leg * 0.1, th, leg * 0.05);
    }
    /* ACME along the curve */
    ctx.font = '900 ' + Math.max(7, th * 0.62) + 'px Impact, "Arial Black", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var word = 'ACME', step = 0.5;
    for (i = 0; i < 4; i++) { a = Math.PI / 2 + (1.5 - i) * step; ctx.save(); ctx.translate(Math.cos(a) * r, Math.sin(a) * r); ctx.rotate(a - Math.PI / 2); ctx.lineWidth = Math.max(1.5, th * 0.1); ctx.strokeStyle = '#0d0709'; ctx.strokeText(word[i], 0, th * 0.03); ctx.fillStyle = '#ffffff'; ctx.fillText(word[i], 0, th * 0.03); ctx.restore(); }
    /* a few white sparks circling the legs: the pull */
    ctx.fillStyle = '#ffffff'; for (i = 0; i < 4; i++) { a = t * 3.2 + i * 1.6 + ph; var rr = iw * (0.36 + 0.07 * Math.sin(t * 5 + i)); ctx.beginPath(); ctx.arc(Math.cos(a) * rr, -leg * 0.55 + Math.sin(a) * rr * 0.5, iw * 0.032, 0, TAU); ctx.fill(); }
  }

  /* the multiplier chip: violet, white rim and white edge inserts, a big white x2 .. x5 */
  function chip(ctx, iw, t, label) {
    var R = iw * 0.4, g, i;
    ctx.fillStyle = '#0d0709'; ctx.beginPath(); ctx.arc(0, 0, R * 1.08, 0, TAU); ctx.fill();
    g = ctx.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R); g.addColorStop(0, '#c660ff'); g.addColorStop(0.6, '#8a22e8'); g.addColorStop(1, '#5a0fb0');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.lineWidth = R * 0.13; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.fillStyle = '#ffffff'; for (i = 0; i < 8; i++) { ctx.save(); ctx.rotate(i * Math.PI / 4 + t * 0.6); ctx.fillRect(-R * 0.1, -R * 1.0, R * 0.2, R * 0.2); ctx.restore(); }
    ctx.lineWidth = R * 0.05; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(0, 0, R * 0.7, 0, TAU); ctx.stroke();
    ctx.font = '900 ' + Math.max(8, R * 0.86) + 'px Impact, "Arial Black", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, R * 0.12); ctx.strokeStyle = '#2a0560'; ctx.strokeText(label || 'x2', 0, R * 0.05); ctx.fillStyle = '#ffffff'; ctx.fillText(label || 'x2', 0, R * 0.05);
  }

  /* the phone battery: neon green charge in a white outline, a white bolt */
  function battery(ctx, iw) {
    var bw = iw * 0.46, bh = iw * 0.76, g, ol = iw * 0.055;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-bw * 0.24, -bh / 2 - iw * 0.085, bw * 0.48, iw * 0.09);
    ctx.fillStyle = '#04120a'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = ol; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-bw / 2, -bh / 2, bw, bh, iw * 0.08); else ctx.rect(-bw / 2, -bh / 2, bw, bh); ctx.fill(); ctx.stroke();
    g = ctx.createLinearGradient(0, bh / 2, 0, -bh / 2); g.addColorStop(0, '#10c24f'); g.addColorStop(1, '#7dffb0'); ctx.fillStyle = g; ctx.shadowColor = 'rgba(60,255,140,0.95)'; ctx.shadowBlur = iw * 0.2;
    ctx.fillRect(-bw / 2 + ol * 1.2, -bh / 2 + ol * 1.2, bw - ol * 2.4, bh - ol * 2.4); ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#04120a'; ctx.lineWidth = iw * 0.02; ctx.beginPath(); ctx.moveTo(iw * 0.03, -bh * 0.36); ctx.lineTo(-bw * 0.28, iw * 0.03); ctx.lineTo(-iw * 0.01, iw * 0.03); ctx.lineTo(-iw * 0.05, bh * 0.36); ctx.lineTo(bw * 0.28, -iw * 0.04); ctx.lineTo(iw * 0.01, -iw * 0.04); ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  /* the red 8-bit heart: a pixel heart with a black outline, a white shine and a darker shade, so it reads at once as a life and not as a coin */
  var HEART = ['011000110', '111101111', '111111111', '111111111', '011111110', '001111100', '000111000', '000010000'];
  function heart(ctx, iw) {
    var u = iw * 0.072, w = 9, h = 8, ox = -w * u / 2, oy = -h * u / 2, r, c, x, y;
    ctx.fillStyle = '#16000a';
    for (r = 0; r < h; r++) for (c = 0; c < w; c++) if (HEART[r].charAt(c) === '1') { x = ox + c * u; y = oy + r * u; ctx.fillRect(x - u * 0.55, y - u * 0.55, u * 2.1, u * 2.1); }
    for (r = 0; r < h; r++) for (c = 0; c < w; c++) if (HEART[r].charAt(c) === '1') { x = ox + c * u; y = oy + r * u; ctx.fillStyle = (r >= 4 || c >= 6) ? '#c3112b' : '#ff2f4a'; ctx.fillRect(x, y, u + 0.6, u + 0.6); }
    ctx.fillStyle = '#ffd3da'; ctx.fillRect(ox + 1 * u, oy + 1 * u, u + 0.6, u + 0.6); ctx.fillRect(ox + 2 * u, oy + 1 * u, u + 0.6, u + 0.6); ctx.fillRect(ox + 1 * u, oy + 2 * u, u + 0.6, u + 0.6);
  }

  /* PHONES AND TABLETS: each item is drawn once into a small picture and then just placed (and pulsed a little) every frame */
  var SPR = {};
  function drawCached(ctx, kind, iw, t, ph, label) {
    var key = kind + '|' + (kind === 'multi' ? label : ''), c = SPR[key];
    if (!c) { c = SPR[key] = document.createElement('canvas'); c.width = c.height = 300; var g = c.getContext('2d'); g.translate(150, 150); draw(g, kind, 150, 0, 0, label); }
    var k = 1 + 0.035 * Math.sin(t * 4 + ph), s = iw / 150 * k;
    ctx.drawImage(c, -150 * s, -150 * s, 300 * s, 300 * s);
  }
  window.HallItemArt = { draw: draw, drawCached: drawCached, glow: GLOW };
})();
