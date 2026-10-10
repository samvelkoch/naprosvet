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
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
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
  var isAuthor = section === 'brodsky' || section === 'chekhov' || section === 'gary';
  if (isAuthor) { root.className += ' app-author'; root.setAttribute('data-author', section); }
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
    toc: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h2M8 5h9M3 10h2M8 10h9M3 15h2M8 15h9"/></svg>',
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
    if (isAuthor && readRail().parts.length) {
      tocBtn = doc.createElement('button');
      tocBtn.type = 'button';
      tocBtn.setAttribute('aria-haspopup', 'dialog');
      tocBtn.setAttribute('aria-expanded', 'false');
      tocBtn.innerHTML = ICONS.toc + '<span>Оглавление</span>';
      tocBtn.addEventListener('click', function () { openToc(); });
      nav.appendChild(tocBtn);
    }
    doc.body.appendChild(nav);
    return nav;
  }

  var navMq = mq('(max-width:768px)');
  var nav = null, tocBtn = null;
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

  /* ---- страницы авторов: оглавление, запоминание места, «продолжить» ---- */
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function hasCls(c) { return (' ' + root.className + ' ').indexOf(' ' + c + ' ') !== -1; }
  function addCls(c) { if (!hasCls(c)) root.className += ' ' + c; }
  function delCls(c) { root.className = (' ' + root.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, ''); }

  /* единственный источник: nav.rail страницы (части — .g, разделы — a[href^="#"]) */
  var railData = null;
  function readRail() {
    if (railData) return railData;
    var d = { parts: [], byId: {}, order: [] };
    railData = d;
    var rail = doc.querySelector('nav.rail');
    if (!rail) return d;
    var part = null;
    for (var n = rail.firstChild; n; n = n.nextSibling) {
      if (n.nodeType !== 1) continue;
      if (n.tagName === 'DIV' && /(^|\s)g(\s|$)/.test(n.className)) {
        var t = n.textContent.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, ''), m = t.match(/^(\S+)\s*·\s*(.*)$/);
        part = { n: m ? m[1] : '', name: m ? m[2] : t, items: [] };
        d.parts.push(part);
      } else if (n.tagName === 'A' && part) {
        var href = n.getAttribute('href') || '';
        if (href.charAt(0) !== '#') continue;
        var sp = n.querySelector('span'), num = sp ? sp.textContent.replace(/\s+/g, '') : '';
        var all = n.textContent.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
        var item = { id: href.slice(1), num: num, title: (sp ? all.slice(all.indexOf(num) + num.length) : all).replace(/^\s+/, ''), part: d.parts.length - 1 };
        part.items.push(item);
        d.byId[item.id] = item;
        d.order.push(item.id);
      }
    }
    return d;
  }
  function itemLabel(it) { return (it.num ? it.num + ' ' : '') + it.title; }

  /* тот же критерий, что в theme.js: последний section[id], чей верх не ниже 35 % высоты окна */
  function currentSection() {
    var list = doc.querySelectorAll('section[id]'), line = window.innerHeight * 0.35, hit = null;
    for (var i = 0; i < list.length; i++) { if (list[i].getBoundingClientRect().top <= line) hit = list[i]; else break; }
    return hit;
  }
  function authorName() {
    var t = doc.querySelector('h1 .typed');
    if (t && t.textContent) return t.textContent.replace(/^\s+|\s+$/g, '');
    var og = doc.querySelector('meta[property="og:title"]'), c = og ? (og.getAttribute('content') || '') : '';
    return c.replace(/\s+на просвет\s*$/i, '');
  }

  /* лист «Оглавление» */
  var toc = null, tocOpen = false, tocTimer = 0;
  function tocBuild() {
    var rd = readRail(), cur = currentSection(), curId = cur && rd.byId[cur.id] ? cur.id : '';
    var openIdx = curId ? rd.byId[curId].part : 0, html = '';
    for (var i = 0; i < rd.parts.length; i++) {
      var p = rd.parts[i], open = i === openIdx;
      html += '<div class="grp' + (open ? ' open' : '') + '">' +
        '<button type="button" class="p" aria-expanded="' + (open ? 'true' : 'false') + '"><b>' + esc(p.n) + '</b><span>' + esc(p.name) + '</span>' +
        '<em>' + p.items.length + '</em><i aria-hidden="true">›</i></button><div class="ss">';
      for (var j = 0; j < p.items.length; j++) {
        var it = p.items[j], is = it.id === curId;
        html += '<a class="s' + (is ? ' cur' : '') + '" href="#' + esc(it.id) + '"' + (is ? ' aria-current="location"' : '') + '><span class="n">' + esc(it.num) + '</span>' +
          '<span class="t">' + esc(it.title) + '</span>' + (is ? '<span class="now">сейчас</span>' : '') + '</a>';
      }
      html += '</div></div>';
    }
    return html;
  }
  function tocEnsure() {
    if (toc) return;
    toc = doc.createElement('div');
    toc.className = 'app-toc';
    toc.hidden = true;
    toc.setAttribute('role', 'dialog');
    toc.setAttribute('aria-modal', 'true');
    toc.setAttribute('aria-label', 'Оглавление');
    toc.innerHTML = '<div class="scrim"></div><div class="sheet"><div class="hd"><h2>Оглавление</h2><small></small>' +
      '<button type="button" class="x" aria-label="Закрыть оглавление">×</button></div><div class="list"></div></div>';
    toc.querySelector('.scrim').addEventListener('click', closeToc);
    toc.querySelector('.x').addEventListener('click', closeToc);
    toc.querySelector('.list').addEventListener('click', function (e) {
      var el = e.target;
      while (el && el !== this && !(el.tagName === 'A' || (el.tagName === 'BUTTON' && el.className === 'p'))) el = el.parentNode;
      if (!el || el === this) return;
      if (el.tagName === 'A') { closeToc(true); return; }   // переход по #id делает сама ссылка
      var grp = el.parentNode, gs = this.querySelectorAll('.grp');
      var wasOpen = / open(\s|$)/.test(' ' + grp.className);
      for (var i = 0; i < gs.length; i++) {
        var on = gs[i] === grp && !wasOpen;
        gs[i].className = 'grp' + (on ? ' open' : '');
        gs[i].querySelector('.p').setAttribute('aria-expanded', on ? 'true' : 'false');
      }
      if (!wasOpen) { var list = this, top = grp.offsetTop; if (list.scrollTop > top) list.scrollTop = top; }
    });
    doc.body.appendChild(toc);
  }
  function openToc() {
    if (tocOpen) return;
    tocEnsure();
    dismissResume();
    var list = toc.querySelector('.list');
    toc.querySelector('small').textContent = authorName() + ' на просвет';
    list.innerHTML = tocBuild();
    clearTimeout(tocTimer);
    toc.hidden = false;
    tocOpen = true;
    addCls('app-toc-open');
    if (tocBtn) tocBtn.setAttribute('aria-expanded', 'true');
    var cur = list.querySelector('.cur');
    if (cur) {     // голова раскрытой части — к верхнему краю; если текущий раздел так не виден, ставим его на треть высоты
      var gtop = cur.parentNode.parentNode.offsetTop;
      list.scrollTop = Math.max(0, cur.offsetTop + cur.offsetHeight - gtop > list.clientHeight ? cur.offsetTop - list.clientHeight / 3 : gtop);
    }
    (window.requestAnimationFrame || window.setTimeout)(function () { toc.className = 'app-toc on'; }, 16);
    goal('toc_open');
    try { toc.querySelector('.x').focus({ preventScroll: true }); } catch (e) {}
  }
  function closeToc(viaLink) {
    if (!tocOpen) return;
    tocOpen = false;
    delCls('app-toc-open');
    toc.className = 'app-toc';
    if (tocBtn) { tocBtn.setAttribute('aria-expanded', 'false'); if (viaLink !== true) { try { tocBtn.focus({ preventScroll: true }); } catch (e) {} } }
    clearTimeout(tocTimer);
    tocTimer = setTimeout(function () { if (!tocOpen) toc.hidden = true; }, 240);
  }
  doc.addEventListener('keydown', function (e) { if (tocOpen && (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27)) closeToc(); });

  /* запоминание места: id раздела и подпись, чтобы главная и «Полка» не читали страницы авторов */
  var KEY_POS = 'naprosvet-pos:', KEY_LABEL = 'naprosvet-pos-label:';
  var resumeBox = null, resumeIdx = -1;      // resumeIdx >= 0: запись не трогаем, пока пользователь не определился
  function savePos() {
    if (resumeIdx >= 0) return;
    var rd = readRail(), cur = currentSection();
    if (!cur || !rd.byId[cur.id]) return;
    if (rd.order[0] === cur.id) { lsDel(KEY_POS + section); lsDel(KEY_LABEL + section); return; } // начало: прогресса нет
    lsSet(KEY_POS + section, cur.id);
    lsSet(KEY_LABEL + section, itemLabel(rd.byId[cur.id]));
  }
  var posTimer = 0;
  function onScrollPos() {
    if (resumeIdx >= 0) checkResume();
    if (posTimer) return;
    posTimer = setTimeout(function () { posTimer = 0; savePos(); }, 500);
  }
  function dismissResume() {
    resumeIdx = -1;
    if (resumeBox && resumeBox.parentNode) resumeBox.parentNode.removeChild(resumeBox);
    resumeBox = null;
    delCls('app-resume-on');
  }
  function checkResume() {   // дошли до сохранённого места (или проскочили) — плашка не нужна
    var cur = currentSection(), idx = cur ? readRail().order.indexOf(cur.id) : -1;
    if (idx >= resumeIdx) dismissResume();
  }
  function showResume(it) {
    resumeBox = doc.createElement('div');
    resumeBox.className = 'app-resume';
    resumeBox.innerHTML = '<a class="go" href="#' + esc(it.id) + '"><span class="t">Продолжить с <b>' + esc(itemLabel(it)) + '</b></span><span class="ar" aria-hidden="true">→</span></a>' +
      '<button type="button" aria-label="Скрыть">×</button>';
    resumeBox.querySelector('.go').addEventListener('click', dismissResume);
    resumeBox.querySelector('button').addEventListener('click', dismissResume);
    doc.body.appendChild(resumeBox);
    addCls('app-resume-on');
  }
  function initAuthor() {
    var rd = readRail();
    if (!rd.order.length) return;
    var id = lsGet(KEY_POS + section), it = id && rd.byId[id];
    if (it && !location.hash && rd.order[0] !== id) {
      resumeIdx = rd.order.indexOf(id);
      var arm = function () {
        setTimeout(function () {     // браузер мог вернуть прежнюю прокрутку при перезагрузке: тогда мы уже на месте
          if (resumeIdx < 0) return;
          checkResume();
          if (resumeIdx >= 0 && !resumeBox) showResume(it);
        }, 400);
      };
      if (doc.readyState === 'complete') arm(); else window.addEventListener('load', arm);
    }
    window.addEventListener('scroll', onScrollPos, { passive: true });
    window.addEventListener('hashchange', dismissResume);
    window.addEventListener('pagehide', function () { savePos(); });
    doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') savePos(); });
  }

  /* главная: под карточкой автора строка «Продолжить с …» */
  function resume(author) {
    if (!/^(brodsky|chekhov|gary)$/.test(author || '')) return null;
    var id = lsGet(KEY_POS + author), label = lsGet(KEY_LABEL + author);
    return id && label ? { id: id, label: label } : null;
  }
  function paintHomeResume() {
    var cards = doc.querySelectorAll('a.card[href]');
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i], m = (c.getAttribute('href') || '').match(/^(brodsky|chekhov|gary)\/$/);
      if (!m) continue;
      var old = c.querySelector('.app-resume-row');
      if (old) old.parentNode.removeChild(old);
      var r = resume(m[1]);
      if (!r) continue;
      var row = doc.createElement('span');
      row.className = 'app-resume-row';
      row.setAttribute('role', 'link');
      row.tabIndex = 0;
      row.textContent = 'Продолжить с ' + r.label + ' →';
      row.setAttribute('data-href', m[1] + '/#' + r.id);
      c.appendChild(row);
    }
  }
  function homeResumeGo(e) {
    var el = e.target;
    while (el && el.nodeType === 1 && !el.getAttribute('data-href')) el = el.parentNode;
    if (!el || el.nodeType !== 1) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.keyCode !== 13) return;
    e.preventDefault();
    e.stopPropagation();
    location.href = BASE.href + el.getAttribute('data-href');
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
  window.NaprosvetApp = { canInstall: function () { return !!deferred; }, install: installApp, resume: resume };

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
      delCls('app-hint-on');
    });
    doc.body.appendChild(box);
    addCls('app-hint-on');
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
    if (isAuthor) initAuthor();
    if (section === '') {
      paintHomeResume();
      doc.addEventListener('click', homeResumeGo, true);
      doc.addEventListener('keydown', homeResumeGo, true);
      window.addEventListener('pageshow', function (e) { if (e.persisted) paintHomeResume(); });
    }
    iosHint();
    welcome();
  }
  if (doc.body) init(); else doc.addEventListener('DOMContentLoaded', init);
})();

/* ---- офлайн: регистрация сервис-воркера и плашка «Есть новая версия» (самодостаточный блок, sw.js собирает sw/build.py) ---- */
(function () {
  var doc = document;
  if (!('serviceWorker' in navigator)) return;
  var host = location.hostname;
  if (!(location.protocol === 'https:' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]')) return;

  var script = doc.currentScript;
  if (!script) {
    var all = doc.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) { if (/(^|\/)app\.js(\?|#|$)/.test(all[i].src)) { script = all[i]; break; } }
  }
  var BASE = new URL('.', script ? script.src : location.href);

  var box = null, reloading = false;

  function showUpdate(worker) {
    if (box) return;
    box = doc.createElement('div');
    box.className = 'app-update';
    box.setAttribute('role', 'status');
    box.innerHTML = '<span class="t">Есть новая версия</span><button type="button" class="do">Обновить</button>' +
      '<button type="button" class="x" aria-label="Закрыть">×</button>';
    box.querySelector('.do').addEventListener('click', function () {
      reloading = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
    box.querySelector('.x').addEventListener('click', function () {
      if (box.parentNode) box.parentNode.removeChild(box);
    });
    doc.body.appendChild(box);
  }

  function watch(reg) {
    var hasController = !!navigator.serviceWorker.controller;
    /* новая версия могла доехать и дождаться раньше этого открытия страницы */
    if (reg.waiting && hasController) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', function () {
      var w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', function () {
        if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w);
      });
    });
  }

  /* перезагружаем только после нажатия «Обновить»: первая установка (clients.claim) страницу не трогает */
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (reloading) location.reload();
  });

  function register() {
    navigator.serviceWorker.register(new URL('sw.js', BASE), { scope: BASE.pathname }).then(watch, function () {});
  }
  if (doc.readyState === 'complete') register(); else window.addEventListener('load', register);
})();
