/* Общий слой приложения «На_просвет»: нижняя панель, установка, дисклеймер первого запуска,
   отметка дня открытия, метка standalone для Метрики. Без библиотек, в стиле theme.js (var, function). */
(function () {
  var doc = document, root = doc.documentElement;
  var YM_ID = 113309794;

  /* корень сайта считаем от самого скрипта: на проде это /naprosvet/, локально — / */
  var script = doc.currentScript;
  if (!script) {
    var all = doc.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) { if (/(^|\/)app\.js(\?|#|$)/.test(all[i].src)) { script = all[i]; break; } }
  }
  var BASE = new URL('.', script ? script.src : location.href);

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function mq(q) { try { return window.matchMedia(q); } catch (e) { return { matches: false }; } }
  function goal(name) { try { if (window.ym) window.ym(YM_ID, 'reachGoal', name); } catch (e) {} }
  function on(m, fn) { if (!m.addEventListener) { if (m.addListener) m.addListener(fn); return; } m.addEventListener('change', fn); }

  var standaloneMq = mq('(display-mode: standalone)');
  function isStandalone() { return !!standaloneMq.matches || window.navigator.standalone === true; }

  /* какая вкладка активна: путь относительно корня сайта */
  var rel = location.pathname;
  if (rel.indexOf(BASE.pathname) === 0) rel = rel.slice(BASE.pathname.length);
  rel = rel.replace(/^\/+/, '').replace(/index\.html$/, '');
  var section = rel.split('/')[0];            // '', today, voices, shelf, brodsky, chekhov, gary
  var isVoices = section === 'voices';
  if (isVoices) root.className += ' app-voices';
  if (isStandalone()) root.className += ' app-standalone';

  /* ---- день открытия: пригодится «Полке» ---- */
  (function markDay() {
    try {
      var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
      var today = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      var list = [];
      try { list = JSON.parse(lsGet('naprosvet-days') || '[]'); } catch (e) { list = []; }
      if (!(list instanceof Array)) list = [];
      if (list.indexOf(today) === -1) {
        list.push(today);
        if (list.length > 400) list = list.slice(list.length - 400);
        lsSet('naprosvet-days', JSON.stringify(list));
      }
    } catch (e) {}
  })();

  /* ---- метка для Метрики: визит из установленного приложения ---- */
  if (isStandalone() && window.ym) { try { window.ym(YM_ID, 'params', { app: 1 }); } catch (e) {} }

  /* ---- нижняя панель ---- */
  var ICONS = {
    today: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4" width="14" height="13"/><path d="M3 8h14M7 2v4M13 2v4"/></svg>',
    voices: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8v4M7 4v12M11 7v6M15 3v14M19 9v2"/></svg>',
    home: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="14" height="14"/><path d="M8 3v14M12 3v14"/></svg>',
    shelf: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 17h16M4 17V8h4v9M10 17V4h4v13"/></svg>'
  };
  var TABS = [
    { key: 'today', label: 'Сегодня', href: BASE.href + 'today/' },
    { key: 'voices', label: 'Голоса_', href: BASE.href + 'voices/' },
    { key: 'home', label: 'На_просвет', href: BASE.href },
    { key: 'shelf', label: 'Полка', href: BASE.href + 'shelf/' }
  ];
  function activeKey() {
    if (section === 'today' || section === 'voices' || section === 'shelf') return section;
    return 'home'; // главная и три исследования
  }
  function buildNav() {
    var nav = doc.createElement('nav'), act = activeKey(), html = '';
    nav.className = 'app-nav';
    nav.setAttribute('aria-label', 'Разделы приложения');
    for (var i = 0; i < TABS.length; i++) {
      var t = TABS[i];
      html += '<a href="' + t.href + '"' + (t.key === act ? ' aria-current="page"' : '') + '>' + ICONS[t.key] + '<span>' + t.label + '</span></a>';
    }
    nav.innerHTML = html;
    doc.body.appendChild(nav);
    return nav;
  }

  var navMq = mq('(max-width:768px)');
  var nav = null;
  function syncNav() {
    var show = !!navMq.matches || isStandalone();
    var has = / app-nav-on(\s|$)/.test(' ' + root.className);
    if (show && !has) root.className += ' app-nav-on';
    if (!show && has) root.className = (' ' + root.className + ' ').replace(' app-nav-on ', ' ').replace(/^\s+|\s+$/g, '');
    if (!nav) nav = buildNav();
    if (!show) setOff(0);
  }
  function setOff(v) { root.style.setProperty('--app-nav-off', v ? '1' : '0'); }

  /* на «Голосах_» панель уезжает вниз при прокрутке вниз и возвращается при прокрутке вверх */
  function autoHide() {
    var last = window.pageYOffset || 0, down = 0, hidden = false, tick = false;
    function step() {
      tick = false;
      if (!/ app-nav-on(\s|$)/.test(' ' + root.className)) return;
      var y = window.pageYOffset || 0, dy = y - last;
      last = y;
      if (y <= 24) { down = 0; if (hidden) { hidden = false; setOff(0); } return; }
      if (dy > 0) { down += dy; if (!hidden && down > 24) { hidden = true; setOff(1); } }
      else if (dy < 0) { down = 0; if (hidden) { hidden = false; setOff(0); } }
    }
    window.addEventListener('scroll', function () {
      if (!tick) { tick = true; (window.requestAnimationFrame || window.setTimeout)(step, 16); }
    }, { passive: true });
  }

  /* ---- установка ---- */
  var deferred = null, installBtn = null;
  function installApp() {
    if (!deferred) return;
    var ev = deferred;
    try {
      ev.prompt();
      if (ev.userChoice && ev.userChoice.then) ev.userChoice.then(function () { deferred = null; paintInstall(); });
    } catch (e) {}
  }
  function paintInstall() { if (installBtn) installBtn.hidden = !deferred; }
  function addInstallButton() {
    if (installBtn || section !== '') return; // только на главной
    var inner = doc.querySelector('header .inner');
    if (!inner) return;
    installBtn = doc.createElement('button');
    installBtn.type = 'button';
    installBtn.className = 'app-install';
    installBtn.textContent = 'Установить приложение';
    installBtn.hidden = true;
    installBtn.addEventListener('click', installApp);
    var lede = inner.querySelector('.lede');
    if (lede && lede.parentNode === inner) inner.insertBefore(installBtn, lede.nextSibling);
    else inner.appendChild(installBtn);
    paintInstall();
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    paintInstall();
  });
  window.addEventListener('appinstalled', function () { deferred = null; paintInstall(); goal('app_install'); });
  /* на будущее («Полка» тоже умеет ставить) */
  window.NaprosvetApp = { canInstall: function () { return !!deferred; }, install: installApp };

  /* подсказка для iPhone/iPad: Safari не умеет beforeinstallprompt */
  function iosHint() {
    var ua = navigator.userAgent || '';
    var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|Instagram|FBAN|FBAV|Telegram/.test(ua);
    if (!ios || !safari || isStandalone() || lsGet('naprosvet-ios-hint') === '1') return;
    var box = doc.createElement('div');
    box.className = 'app-ios-hint';
    box.setAttribute('role', 'note');
    box.innerHTML = '<p>Чтобы поставить на экран: <b>Поделиться</b> → <b>На экран «Домой»</b></p>' +
      '<button type="button" aria-label="Закрыть подсказку">×</button>';
    box.querySelector('button').addEventListener('click', function () {
      lsSet('naprosvet-ios-hint', '1');
      if (box.parentNode) box.parentNode.removeChild(box);
    });
    doc.body.appendChild(box);
  }

  /* ---- дисклеймер первого запуска в приложении ---- */
  function welcome() {
    if (!isStandalone() || lsGet('naprosvet-welcome') === '1') return;
    var box = doc.createElement('div');
    box.className = 'app-welcome';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'app-welcome-h');
    box.innerHTML = '<div class="in"><h2 id="app-welcome-h">Голоса_ — это реконструкция</h2>' +
      '<p><b>Это не цитаты.</b> Ответы написаны языковой моделью, которой мы дали «голос» автора: его письма, интервью, книги, биографию. ' +
      'Это реконструкция, исследовательская работа, а не спиритический сеанс.</p>' +
      '<button type="button">Понятно</button></div>';
    var btn = box.querySelector('button');
    btn.addEventListener('click', function () {
      lsSet('naprosvet-welcome', '1');
      if (box.parentNode) box.parentNode.removeChild(box);
    });
    doc.body.appendChild(box);
    try { btn.focus(); } catch (e) {}
  }

  function init() {
    syncNav();
    on(navMq, syncNav);
    on(standaloneMq, syncNav);
    if (isVoices) autoHide();
    addInstallButton();
    iosHint();
    welcome();
  }
  if (doc.body) init(); else doc.addEventListener('DOMContentLoaded', init);
})();
