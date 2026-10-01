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
    '.theme-btn{font:500 15px/1 "IBM Plex Mono",ui-monospace,Menlo,monospace;width:34px;height:34px;flex:none;align-self:center;cursor:pointer;' +
    'color:#d6c9b4;background:transparent;border:1px solid rgba(255,255,255,.22);border-radius:2px;padding:0;display:inline-flex;align-items:center;justify-content:center}' +
    '.theme-btn:hover{background:#f0765a;border-color:#f0765a;color:#1b1010}' +
    '.theme-btn:focus-visible{outline:2px solid #f0765a;outline-offset:2px}' +
    '.bar .theme-btn{margin-left:auto}' +
    '.theme-float{position:absolute;top:18px;right:clamp(16px,4vw,36px);z-index:5}';
  document.head.appendChild(css);

  function paint(btn) {
    var dark = current() === 'dark';
    btn.textContent = dark ? '☀' : '☾';
    btn.title = btn.ariaLabel = dark ? 'Светлая тема' : 'Тёмная тема';
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
