/* Language buttons (EN, ES, 中文) beside the sound button. English players load nothing more than this small file.
   The Spanish and Chinese word lists (i18n-es.js, i18n-zh.js) are fetched only when somebody picks that language, and the choice is remembered.
   Text is translated where it is shown: a list of exact phrases plus a few patterns for lines with numbers. Anything not in the list stays English.
   Never translated: the Hall Rules and legal text, the administration page, names, and the numbers themselves. */
(function () {
  'use strict';
  var KEY = 'mimu-lang', LANGS = { es: 'i18n-es.js', zh: 'i18n-zh.js' }, TAG = (document.currentScript && document.currentScript.src.match(/[?&]v=([^&]+)/) || [])[1] || '1';
  var lang = 'en', pack = null, packs = {}, obs = null, queued = false, pending = [], orig = new WeakMap(), origAttr = new WeakMap(), lastOut = new WeakMap(), SKIP = 'SCRIPT,STYLE,NOSCRIPT,TEXTAREA,INPUT,SELECT,OPTION,CANVAS,SVG,CODE';
  var ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];

  function skipEl(el) { return !el || (el.closest && el.closest('#infoBody, #admin, .adm, .adm-shade, #langBar, [data-i18n="off"], [id^="adm"]')); }
  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
  function hasLower(s) { return /[a-z]/.test(s); }
  function months(s, p) {   // Oct 26, Mon, ... inside any line
    var M = p.months, W = p.weekdays; if (!M) return s;
    s = s.replace(/\b(MON|TUE|WED|THU|FRI|SAT|SUN),? ?/gi, function (m, d) { return W[d.toUpperCase()] + (p.wsep || ', '); });
    s = s.replace(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b ?(\d{1,2})?/gi, function (m, mo, d) { var t = M[mo.toUpperCase()]; return p.md ? p.md(t, d) : t + (d ? ' ' + d : ''); });
    return s;
  }
  function translate(src) {   // exact phrase first, then patterns; null when there is nothing to translate
    if (!pack || !/[A-Za-z]/.test(src)) return null;
    var lead = src.match(/^\s*/)[0], trail = src.match(/\s*$/)[0], core = norm(src); if (!core) return null;
    var up = core.toUpperCase(), out = pack.dict[up], i;
    if (out === undefined) {
      for (i = 0; i < pack.rx.length; i++) { var m = up.match(pack.rx[i][0]); if (m) { out = pack.rx[i][1].replace(/\$(\d)/g, function (x, n) { return m[+n] !== undefined ? (pack.dict[m[+n]] !== undefined ? pack.dict[m[+n]] : m[+n]) : ''; }); break; } }
    }
    if (out === undefined) return null;
    if (/\b(MON|TUE|WED|THU|FRI|SAT|SUN|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/.test(up)) out = months(out, pack);   // dates in the text
    if (!hasLower(core) && pack.upper) out = out.toLocaleUpperCase(pack.upper);   // all-capital text stays all-capital
    return lead + out + trail;
  }
  function doText(n) {
    var cur = n.nodeValue, was = lastOut.get(n);
    if (was !== undefined && cur === was) return;   // our own output
    if (cur === undefined || !/[A-Za-z]/.test(cur)) { return; }
    orig.set(n, cur); var t = translate(cur); if (t !== null && t !== cur) { lastOut.set(n, t); n.nodeValue = t; } else lastOut.delete(n);
  }
  function doAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute && el.getAttribute(a); if (v == null) continue;
      var m = origAttr.get(el) || {}, was = m['o:' + a];
      if (m['t:' + a] !== undefined && v === m['t:' + a]) continue;   // our own output
      m['o:' + a] = v; var t = translate(v); if (t !== null && t !== v) { m['t:' + a] = t; el.setAttribute(a, t); } else delete m['t:' + a];
      origAttr.set(el, m);
    }
  }
  var SKIPSET = {}; SKIP.split(',').forEach(function (t) { SKIPSET[t] = 1; });
  function skipTag(el) { return !!SKIPSET[String(el.tagName).toUpperCase()]; }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { var p = root.parentElement; if (p && !skipTag(p) && !skipEl(p)) doText(root); return; }
    if (root.nodeType !== 1 || skipTag(root) || skipEl(root)) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: function (x) { return x.nodeType === 1 && (skipTag(x) || skipEl(x)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } }), n;
    doAttrs(root);
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  function flush() { queued = false; var p = pending; pending = []; for (var i = 0; i < p.length; i++) { try { walk(p[i]); } catch (e) { /* never break the page */ } } }
  function queue(n) { pending.push(n); if (!queued) { queued = true; (window.requestAnimationFrame || setTimeout)(flush); } }
  function watch() {
    if (obs || !window.MutationObserver) return;
    obs = new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (r.type === 'childList') { for (var j = 0; j < r.addedNodes.length; j++) queue(r.addedNodes[j]); }
        else if (r.type === 'characterData') queue(r.target);
        else if (r.type === 'attributes') queue(r.target);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function unwatch() { if (obs) { obs.disconnect(); obs = null; } pending = []; }
  function restore() {   // back to English: put every changed text and attribute back exactly as it was
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null), n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { var t = lastOut.get(n); if (t !== undefined && n.nodeValue === t && orig.has(n)) n.nodeValue = orig.get(n); lastOut.delete(n); }
      else { var m = origAttr.get(n); if (m) { for (var i = 0; i < ATTRS.length; i++) { var a = ATTRS[i]; if (m['t:' + a] !== undefined && n.getAttribute(a) === m['t:' + a]) n.setAttribute(a, m['o:' + a]); } origAttr.delete(n); } }
    }
  }
  function paintBar() {
    var b = document.getElementById('langBar'); if (!b) return;
    Array.prototype.forEach.call(b.querySelectorAll('button'), function (x) { x.classList.toggle('on', x.getAttribute('data-l') === lang); x.setAttribute('aria-pressed', x.getAttribute('data-l') === lang ? 'true' : 'false'); });
  }
  function apply() { document.documentElement.setAttribute('lang', lang); document.documentElement.classList.toggle('l-zh', lang === 'zh'); document.documentElement.classList.toggle('l-es', lang === 'es'); paintBar(); }
  function set(l, quiet) {
    if (l !== 'en' && !LANGS[l]) l = 'en';
    if (!quiet) { try { localStorage.setItem(KEY, l); } catch (e) { /* private window */ } }
    if (l === 'en') { unwatch(); restore(); lang = 'en'; pack = null; apply(); return; }
    var go = function () { restore(); lang = l; pack = packs[l]; apply(); walk(document.body); watch(); };
    if (packs[l]) { go(); return; }
    lang = l; apply();   // the button lights up at once; the words follow when the list has loaded
    var s = document.createElement('script'); s.src = 'assets/game/' + LANGS[l] + '?v=' + TAG; s.onload = function () { if (lang === l && packs[l]) go(); }; s.onerror = function () { if (lang === l) { lang = 'en'; apply(); } }; document.head.appendChild(s);
  }
  function build() {
    if (document.getElementById('langBar')) return;
    var st = document.createElement('style'); st.textContent =
      '.lang{position:fixed;right:66px;bottom:18px;z-index:5;display:flex;height:40px;opacity:0;animation:fade 1s 1.6s forwards;font-family:"Cinzel",Georgia,serif}' +
      '.lang button{min-width:40px;padding:0 9px;color:#c9a15a;background:rgba(0,0,0,.4);border:1px solid rgba(217,172,92,.55);border-left-width:0;font:600 11px/1 "Cinzel",Georgia,"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif;letter-spacing:.06em;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
      '.lang button:first-child{border-left-width:1px}.lang button:hover,.lang button:focus-visible{color:#fff0c4;outline:none;box-shadow:0 0 14px rgba(232,198,115,.35)}' +
      '.lang button.on{color:#2b0407;background:linear-gradient(180deg,#f6dc95,#c8963f);border-color:#f6dc95}' +
      '@media (max-width:520px),(max-height:600px){body.phone-open .lang{opacity:0!important;visibility:hidden;pointer-events:none}}' +
      'html.l-zh body *:not(.lang):not(.lang *){letter-spacing:.02em!important;word-spacing:0!important}';
    document.head.appendChild(st);
    var b = document.createElement('div'); b.className = 'lang'; b.id = 'langBar'; b.setAttribute('role', 'group'); b.setAttribute('aria-label', 'Language'); b.setAttribute('data-i18n', 'off');
    b.innerHTML = '<button type="button" data-l="en" lang="en" title="English">EN</button><button type="button" data-l="es" lang="es" title="Español">ES</button><button type="button" data-l="zh" lang="zh" title="中文">中文</button>';
    b.addEventListener('click', function (ev) { var x = ev.target.closest('button'); if (x) set(x.getAttribute('data-l')); });
    document.body.appendChild(b); paintBar();
  }
  window.HallI18n = { set: set, lang: function () { return lang; }, t: function (s) { var t = translate(String(s)); return t === null ? s : t; },
    add: function (l, p) { packs[l] = p; } };
  function init() {
    build(); var saved = 'en'; try { saved = localStorage.getItem(KEY) || 'en'; } catch (e) { /* ignore */ }   // English unless the player chose another language
    if (saved !== 'en') set(saved, true);
  }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
