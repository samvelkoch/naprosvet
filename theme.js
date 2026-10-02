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
    '.bug-btn{font:500 12.5px/1 "IBM Plex Mono",ui-monospace,Menlo,monospace;height:34px;min-width:34px;flex:none;align-self:center;gap:8px;display:inline-flex;align-items:center;justify-content:center;' +
    'padding:0 10px;color:#f7f0e2;text-decoration:none;background:rgba(255,255,255,.06);border:1px solid rgba(247,240,226,.55);border-radius:2px}' +
    '.bug-btn .ic{font-size:17px;font-weight:600;line-height:1;color:#f0765a}.bug-btn:hover{background:#f0765a;border-color:#f0765a;color:#1b1010}.bug-btn:hover .ic{color:#1b1010}' +
    '.bug-btn:focus-visible{outline:2px solid #f0765a;outline-offset:2px}@media (max-width:760px){.bug-btn .lb{display:none}.bug-btn{padding:0}}' +
    '.bar .bug-btn{margin-left:auto}.bar .bug-btn~.theme-btn,.bar .bug-btn~.home-btn{margin-left:0}' +
    '.theme-float{position:absolute;top:18px;right:clamp(16px,4vw,36px);z-index:5}' +
    '@media (hover:none) and (pointer:coarse){input[type=search],input[type=text],select,textarea{font-size:16px!important}}';
  document.head.appendChild(css);

  function paint(btn) {
    var dark = current() === 'dark';
    var label = dark ? 'Светлая тема' : 'Тёмная тема';
    btn.innerHTML = '<span class="ic" aria-hidden="true">' + (dark ? '☀' : '☾') + '</span><span class="lb">' + label + '</span>';
    btn.title = label; btn.setAttribute('aria-label', label);
  }
  /* «Нашли ошибку?»: открывает форму issue на GitHub, сама подставляет страницу, раздел,
     выделенный текст и устройство */
  var ISSUES = 'https://github.com/samvelkoch/naprosvet/issues/new';
  var SITE = 'https://samvelkoch.github.io/naprosvet/';
  var NAMES = { brodsky: 'Бродский', chekhov: 'Чехов', gary: 'Ромен Гари' };
  function pageKey() { var m = location.pathname.match(/\/(brodsky|chekhov|gary)\//); return m ? m[1] : ''; }
  function currentSection() {
    var list = document.querySelectorAll('section[id]'), line = window.innerHeight * 0.35, hit = null;
    for (var i = 0; i < list.length; i++) { if (list[i].getBoundingClientRect().top <= line) hit = list[i]; else break; }
    return hit;
  }
  function reportHref() {
    var key = pageKey(), sec = currentSection(), name = '';
    var h2 = sec && sec.querySelector('h2');
    if (h2) { var t = h2.cloneNode(true), tags = t.querySelectorAll('.tag'); for (var i = 0; i < tags.length; i++) tags[i].remove(); name = t.textContent.replace(/\s+/g, ' ').trim(); }
    var sel = ''; try { sel = String(window.getSelection() || '').replace(/\s+/g, ' ').trim().slice(0, 600); } catch (e) {}
    var dev = navigator.userAgent + ' · экран ' + window.innerWidth + '×' + window.innerHeight + ' · тема ' + current();
    var q = 'template=bug.yml' +
      '&title=' + encodeURIComponent('[Ошибка] ' + (NAMES[key] || 'Главная') + (name ? ' · ' + name : '') + ': ') +
      '&page=' + encodeURIComponent(SITE + (key ? key + '/' : '') + (sec ? '#' + sec.id : '')) +
      '&device=' + encodeURIComponent(dev.slice(0, 250)) + (sel ? '&quote=' + encodeURIComponent(sel) : '');
    return ISSUES + '?' + q;
  }
  function bugLink(cls, inner) {
    var a = document.createElement('a'), fresh = false;
    a.className = cls; a.target = '_blank'; a.rel = 'noopener'; a.href = ISSUES + '/choose'; a.innerHTML = inner;
    a.title = 'Сообщить об ошибке'; a.setAttribute('aria-label', 'Сообщить об ошибке');
    // выделение текста ещё живо на pointerdown, к клику браузер его снимает
    a.addEventListener('pointerdown', function () { a.href = reportHref(); fresh = true; });
    a.addEventListener('focus', function () { if (!fresh) a.href = reportHref(); });
    a.addEventListener('click', function () { if (!fresh) a.href = reportHref(); fresh = false; });
    return a;
  }
  function mount() {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'theme-btn';
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next); save(next); paint(btn);
    });
    var bar = document.querySelector('.bar .inner');
    if (bar) bar.appendChild(bugLink('bug-btn', '<span class="ic" aria-hidden="true">!</span><span class="lb">Нашли ошибку?</span>'));
    else { var row = document.querySelector('footer .row'); if (row) row.appendChild(bugLink('bug-link', 'Нашли ошибку или неточность? Напишите нам →')); }
    if (bar) bar.appendChild(btn);
    else { var h = document.querySelector('header .inner'); btn.classList.add('theme-float'); h.style.position = 'relative'; h.appendChild(btn); }
    mq.addEventListener && mq.addEventListener('change', function () { paint(btn); });
    paint(btn);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
