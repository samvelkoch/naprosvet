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
    '.bug-btn{cursor:pointer}.bug-link{all:unset;cursor:pointer;color:inherit;text-decoration:underline;text-underline-offset:3px}.bug-link:focus-visible{outline:2px solid #f0765a;outline-offset:2px}' +
    '.bug-menu{position:fixed;z-index:60;width:min(300px,calc(100vw - 16px));background:#221a14;color:#f7f0e2;border:1px solid rgba(247,240,226,.35);border-radius:3px;padding:6px;box-shadow:0 18px 40px -12px rgba(0,0,0,.55);font:13px/1.35 "IBM Plex Mono",ui-monospace,Menlo,monospace}' +
    '.bug-menu a{display:block;padding:10px 12px;border-radius:2px;color:#f7f0e2;text-decoration:none}.bug-menu a+a{margin-top:2px}' +
    '.bug-menu a b{display:block;font-weight:600}.bug-menu a span{display:block;color:#b9ab96;font-size:11.5px;margin-top:3px}' +
    '.bug-menu a:hover,.bug-menu a:focus-visible{background:#f0765a;color:#1b1010;outline:none}.bug-menu a:hover span,.bug-menu a:focus-visible span{color:#3a1d14}' +
    '.bug-menu .bm-note{color:#f0765a;font-size:11.5px;padding:0 12px}.bug-menu .bm-note:empty{display:none}.bug-menu .bm-note:not(:empty){padding:6px 12px 4px}' +
    '.theme-float{position:absolute;top:18px;right:clamp(16px,4vw,36px);z-index:5}' +
    '@media (hover:none) and (pointer:coarse){input[type=search],input[type=text],select,textarea{font-size:16px!important}}';
  document.head.appendChild(css);

  function paint(btn) {
    var dark = current() === 'dark';
    var label = dark ? 'Светлая тема' : 'Тёмная тема';
    btn.innerHTML = '<span class="ic" aria-hidden="true">' + (dark ? '☀' : '☾') + '</span><span class="lb">' + label + '</span>';
    btn.title = label; btn.setAttribute('aria-label', label);
  }
  /* «Нашли ошибку?»: меню из двух путей — форма issue на GitHub (поля заполняются сами)
     и Telegram (описание места кладётся в буфер обмена, чтобы вставить в сообщение) */
  var ISSUES = 'https://github.com/samvelkoch/naprosvet/issues/new';
  var TG = 'https://t.me/samvelkoch';
  var SITE = 'https://samvelkoch.github.io/naprosvet/';
  var NAMES = { brodsky: 'Бродский', chekhov: 'Чехов', gary: 'Ромен Гари' };
  function pageKey() { var m = location.pathname.match(/\/(brodsky|chekhov|gary)\//); return m ? m[1] : ''; }
  function currentSection() {
    var list = document.querySelectorAll('section[id]'), line = window.innerHeight * 0.35, hit = null;
    for (var i = 0; i < list.length; i++) { if (list[i].getBoundingClientRect().top <= line) hit = list[i]; else break; }
    return hit;
  }
  function context() {
    var key = pageKey(), sec = currentSection(), name = '';
    var h2 = sec && sec.querySelector('h2');
    if (h2) { var t = h2.cloneNode(true), tags = t.querySelectorAll('.tag'); for (var i = 0; i < tags.length; i++) tags[i].remove(); name = t.textContent.replace(/\s+/g, ' ').trim(); }
    var sel = ''; try { sel = String(window.getSelection() || '').replace(/\s+/g, ' ').trim().slice(0, 600); } catch (e) {}
    return { where: (NAMES[key] || 'Главная') + (name ? ' · ' + name : ''), url: SITE + (key ? key + '/' : '') + (sec ? '#' + sec.id : ''), sel: sel,
      dev: (navigator.userAgent + ' · экран ' + window.innerWidth + '×' + window.innerHeight + ' · тема ' + current()).slice(0, 250) };
  }
  function ghHref(c) {
    return ISSUES + '?template=bug.yml&title=' + encodeURIComponent('[Ошибка] ' + c.where + ': ') + '&page=' + encodeURIComponent(c.url) +
      '&device=' + encodeURIComponent(c.dev) + (c.sel ? '&quote=' + encodeURIComponent(c.sel) : '');
  }
  function tgText(c) {
    return 'Ошибка на «На просвет»\nГде: ' + c.where + '\n' + c.url + (c.sel ? '\nФрагмент: «' + c.sel + '»' : '') + '\nУстройство: ' + c.dev + '\nЧто случилось: ';
  }
  var menu = null, ctx = null;
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  function openMenu(trigger) {
    closeMenu(); var c = ctx || context(); ctx = null;
    menu = document.createElement('div'); menu.className = 'bug-menu'; menu.setAttribute('role', 'menu');
    menu.innerHTML = '<a role="menuitem" target="_blank" rel="noopener" class="bm-gh"><b>Форма на GitHub</b><span>поля заполнятся сами</span></a>' +
      '<a role="menuitem" target="_blank" rel="noopener" class="bm-tg"><b>Telegram @samvelkoch</b><span>описание места скопируется — вставьте его в чат</span></a>' +
      '<div class="bm-note" aria-live="polite"></div>';
    var gh = menu.querySelector('.bm-gh'), tg = menu.querySelector('.bm-tg'), note = menu.querySelector('.bm-note');
    gh.href = ghHref(c); tg.href = TG;
    gh.addEventListener('click', function () { setTimeout(closeMenu, 0); });
    tg.addEventListener('click', function () {
      var txt = tgText(c);
      try { navigator.clipboard.writeText(txt).then(function () { note.textContent = 'Скопировано. Вставьте в сообщение.'; }, function () { note.textContent = ''; }); } catch (e) {}
      setTimeout(closeMenu, 1600);
    });
    document.body.appendChild(menu);
    var r = trigger.getBoundingClientRect(), w = menu.offsetWidth;
    var left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
    var top = r.bottom + 8; if (top + menu.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - menu.offsetHeight - 8);
    menu.style.left = left + 'px'; menu.style.top = top + 'px';
    gh.focus({ preventScroll: true });
  }
  document.addEventListener('pointerdown', function (e) { if (menu && !menu.contains(e.target) && !e.target.closest('.bug-btn,.bug-link')) closeMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('scroll', closeMenu, { passive: true });
  function bugLink(cls, inner) {
    var a = document.createElement('button'); a.type = 'button'; a.className = cls; a.innerHTML = inner;
    a.title = 'Сообщить об ошибке'; a.setAttribute('aria-label', 'Сообщить об ошибке'); a.setAttribute('aria-haspopup', 'menu');
    // выделение текста ещё живо на pointerdown, к клику браузер его снимает
    a.addEventListener('pointerdown', function () { ctx = context(); });
    a.addEventListener('click', function () { if (menu) { closeMenu(); return; } openMenu(a); });
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
