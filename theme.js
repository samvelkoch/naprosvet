/* Переключатель светлой/тёмной темы. Подключается в <head> до отрисовки:
   выбор хранится в localStorage, без выбора работает системная тема. */
(function () {
  var KEY = 'naprosvet-theme', root = document.documentElement;
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  function stored() { try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function current() { return root.getAttribute('data-theme') || (mq.matches ? 'dark' : 'light'); }
  var s = stored(); if (s) root.setAttribute('data-theme', s);

  var css = document.createElement('style');
  css.textContent =
    '.theme-btn{font:500 12.5px/1 "IBM Plex Mono",ui-monospace,Menlo,monospace;height:34px;min-width:34px;flex:none;align-self:center;cursor:pointer;gap:8px;' +
    'color:#f7f0e2;background:rgba(255,255,255,.06);border:1px solid rgba(247,240,226,.55);border-radius:2px;padding:0 10px;display:inline-flex;align-items:center;justify-content:center}' +
    '.theme-btn .ic{font-size:19px;line-height:1}' +
    '@media (max-width:760px){.theme-btn .lb{display:none}.theme-btn{padding:0}}' +
    '.theme-btn:hover{background:#f0765a;border-color:#f0765a;color:#1b1010}' +
    '.theme-btn:focus-visible{outline:2px solid #f0765a;outline-offset:2px}' +
    '.bar .theme-btn{margin-left:auto}' +
    '.theme-float{position:absolute;top:18px;right:clamp(16px,4vw,36px);z-index:5}' +
    '@media (hover:none) and (pointer:coarse){input[type=search],input[type=text],select,textarea{font-size:16px!important}}';
  document.head.appendChild(css);

  function paint(btn) {
    var dark = current() === 'dark';
    var label = dark ? 'Светлая тема' : 'Тёмная тема';
    btn.innerHTML = '<span class="ic" aria-hidden="true">' + (dark ? '☀' : '☾') + '</span><span class="lb">' + label + '</span>';
    btn.title = label; btn.setAttribute('aria-label', label);
  }
  function mount() {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'theme-btn';
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next); save(next); paint(btn);
    });
    var bar = document.querySelector('.bar .inner');
    if (bar) bar.appendChild(btn);
    else { var h = document.querySelector('header .inner'); btn.classList.add('theme-float'); h.style.position = 'relative'; h.appendChild(btn); }
    mq.addEventListener && mq.addEventListener('change', function () { paint(btn); });
    paint(btn);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
