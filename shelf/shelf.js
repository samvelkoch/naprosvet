/* Экран «Полка»: календарь открытых дней, результаты «Чей ответ?», «Продолжить чтение», сохранённые ответы, настройки.
   Без библиотек, в стиле app.js (var, function). Данные: localStorage (naprosvet-*) и ../voices/data.json. */
(function () {
  var ORDER = ['brodsky', 'chekhov', 'gary'];
  var SHORT = { brodsky: 'Бродский', chekhov: 'Чехов', gary: 'Гари' };
  var MONTH_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  var MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  var WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  var SHELF_KEY = 'naprosvet-shelf', DAYS_KEY = 'naprosvet-days', GUESS_KEY = 'naprosvet-guess';
  var DAY = 864e5;

  var doc = document;
  var app = doc.getElementById('app');
  var script = doc.currentScript;
  var BASE = new URL('.', script ? script.src : location.href);

  /* ---- мелочи ---- */
  function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function plural(n, one, few, many) {
    var a = n % 100, b = n % 10;
    if (a >= 11 && a <= 14) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }
  function jsonGet(k, fallback) {
    var v = null;
    try { v = JSON.parse(lsGet(k) || 'null'); } catch (e) { v = null; }
    return v == null ? fallback : v;
  }
  function btn(text, cls) { var b = el('button', cls, text); b.type = 'button'; return b; }

  /* даты: календарная дата как UTC-полночь, сутки ровно 864e5 */
  function fmtYmd(ts) { var d = new Date(ts); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function localToday() { var n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); }

  /* ---- данные ---- */
  var D = null, dataState = 'loading';     // loading | ok | error
  function daysSet() {
    var list = jsonGet(DAYS_KEY, []), set = {};
    if (!(list instanceof Array)) return set;
    for (var i = 0; i < list.length; i++) if (typeof list[i] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(list[i])) set[list[i]] = true;
    return set;
  }
  function shelf() { var s = jsonGet(SHELF_KEY, []); return s instanceof Array ? s : []; }
  function guessStore() { var g = jsonGet(GUESS_KEY, {}); return g && typeof g === 'object' && !(g instanceof Array) ? g : {}; }

  /* ---- календарь ---- */
  var cal = { y: 0, m: 0 };
  var calBox = null;
  function earliestMonth(today) {
    var td = new Date(today), best = td.getUTCFullYear() * 12 + td.getUTCMonth(), set = daysSet();
    for (var k in set) {
      if (!set.hasOwnProperty(k)) continue;
      var y = +k.slice(0, 4), m = +k.slice(5, 7) - 1, v = y * 12 + m;
      if (v < best) best = v;
    }
    return best;
  }
  function paintCal() {
    var today = localToday(), td = new Date(today), nowIdx = td.getUTCFullYear() * 12 + td.getUTCMonth();
    var idx = cal.y * 12 + cal.m, first = earliestMonth(today);
    var set = daysSet(), dim = new Date(Date.UTC(cal.y, cal.m + 1, 0)).getUTCDate();
    var upto = idx === nowIdx ? td.getUTCDate() : dim, opened = 0, d;
    for (d = 1; d <= upto; d++) if (set[cal.y + '-' + pad(cal.m + 1) + '-' + pad(d)]) opened++;

    calBox.innerHTML = '';
    var head = el('div', 'cal-head');
    var prev = btn('‹', 'cal-nav');
    prev.setAttribute('aria-label', 'Предыдущий месяц');
    prev.disabled = idx <= first;
    prev.addEventListener('click', function () { step(-1); });
    var next = btn('›', 'cal-nav');
    next.setAttribute('aria-label', 'Следующий месяц');
    next.disabled = idx >= nowIdx;
    next.addEventListener('click', function () { step(1); });
    head.appendChild(prev);
    head.appendChild(el('div', 'cal-title', MONTH_NOM[cal.m] + ' ' + cal.y));
    head.appendChild(next);
    calBox.appendChild(head);
    calBox.appendChild(el('div', 'cal-count', 'открыто ' + opened + ' из ' + upto + ' ' + plural(upto, 'дня', 'дней', 'дней')));

    var grid = el('div', 'cal-grid'), i;
    for (i = 0; i < 7; i++) grid.appendChild(el('div', 'cal-wd', WD[i]));
    var lead = (new Date(Date.UTC(cal.y, cal.m, 1)).getUTCDay() + 6) % 7;     // понедельник первым
    for (i = 0; i < lead; i++) grid.appendChild(el('div'));
    for (d = 1; d <= dim; d++) {
      var ts = Date.UTC(cal.y, cal.m, d), key = fmtYmd(ts);
      var cell = el('div', 'cal-day' + (set[key] ? ' open' : '') + (ts === today ? ' today' : '') + (ts > today ? ' future' : ''));
      cell.appendChild(el('span', 'n', String(d)));
      cell.appendChild(el('span', 'd'));
      cell.setAttribute('role', 'img');
      cell.setAttribute('aria-label', d + ' ' + MONTH_SHORT[cal.m] + (ts === today ? ', сегодня' : '') + (set[key] ? ', день открыт' : ''));
      grid.appendChild(cell);
    }
    calBox.appendChild(grid);

    var lg = el('div', 'cal-legend');
    var items = [['open', 'день открыт'], ['', 'не открыт'], ['today', 'сегодня']];
    for (i = 0; i < items.length; i++) {
      var s = el('span');
      s.appendChild(el('i', 'd' + (items[i][0] ? ' ' + items[i][0] : '')));
      s.appendChild(doc.createTextNode(items[i][1]));
      lg.appendChild(s);
    }
    calBox.appendChild(lg);
  }
  function step(dir) {
    var idx = cal.y * 12 + cal.m + dir, today = new Date(localToday()), nowIdx = today.getUTCFullYear() * 12 + today.getUTCMonth();
    if (idx > nowIdx || idx < earliestMonth(localToday())) return;
    cal.y = Math.floor(idx / 12); cal.m = idx % 12;
    paintCal();
  }

  /* ---- «Чей ответ?» за неделю ---- */
  function weekScore(today) {
    var g = guessStore(), ok = 0, all = 0;
    for (var i = 0; i < 7; i++) {
      var r = g[fmtYmd(today - i * DAY)];
      if (r && typeof r === 'object') { all++; if (r.ok) ok++; }
    }
    return { ok: ok, all: all };
  }

  /* ---- «Продолжить чтение» ---- */
  function resumeRows() {
    var rows = [];
    for (var i = 0; i < ORDER.length; i++) {
      var a = ORDER[i], r = null;
      try { r = window.NaprosvetApp && window.NaprosvetApp.resume ? window.NaprosvetApp.resume(a) : null; } catch (e) { r = null; }
      if (!r) continue;
      var link = el('a', 'row');
      link.href = '../' + a + '/#' + r.id;
      var t = el('span', 't', SHORT[a] + ' на просвет · Продолжить с ');
      t.appendChild(el('b', null, r.label));
      link.appendChild(t);
      var ar = el('span', 'ar', '→');
      ar.setAttribute('aria-hidden', 'true');
      link.appendChild(ar);
      rows.push(link);
    }
    return rows;
  }

  /* ---- первая фраза: первое предложение, а если оно короче 40 знаков — два; *ремарки* курсивом ---- */
  function flat(text) {
    var out = [], re = /\*([^*]+)\*/g, m, last = 0, t = String(text || '').replace(/\s*\n\s*/g, ' ');
    function push(s, em) { for (var i = 0; i < s.length; i++) out.push({ c: s.charAt(i), em: em }); }
    while ((m = re.exec(t))) { if (m.index > last) push(t.slice(last, m.index), false); push(m[1], true); last = re.lastIndex; }
    if (last < t.length) push(t.slice(last), false);
    return out;
  }
  function endAfter(cs, from) {        // индекс сразу за концом предложения, начиная с from; -1 если конца нет
    for (var i = from; i < cs.length; i++) {
      var c = cs[i].c;
      if (c !== '.' && c !== '!' && c !== '?' && c !== '…') continue;
      if (c === '.' && i > 0 && /[А-ЯЁA-Z]/.test(cs[i - 1].c) && (i === 1 || /[\s«"„(\[]/.test(cs[i - 2].c))) continue;   // «А. Чехов»
      var j = i + 1;
      while (j < cs.length && /[.!?…]/.test(cs[j].c)) j++;
      while (j < cs.length && /[»"”')\]]/.test(cs[j].c)) j++;
      if (j >= cs.length || /\s/.test(cs[j].c)) return j;
      i = j - 1;
    }
    return -1;
  }
  function firstPhrase(text) {
    var cs = flat(text), i = 0, n = cs.length;
    while (i < n && (cs[i].em || /\s/.test(cs[i].c))) i++;       // ремарки в начале остаются во фразе
    var lead = i, e = endAfter(cs, lead);
    if (e < 0) e = n;
    if (e - 0 < 40 && e < n) { var e2 = endAfter(cs, e); e = e2 < 0 ? n : e2; }
    var cut = false;
    if (e - lead > 300) {              // совсем длинное предложение: режем по слову
      e = lead + 300;
      while (e > lead && !/\s/.test(cs[e].c)) e--;
      if (e <= lead) e = lead + 300;
      cut = true;
    }
    var segs = [], k;
    for (k = 0; k < e; k++) {
      var last = segs[segs.length - 1];
      if (last && last.em === cs[k].em) last.t += cs[k].c; else segs.push({ t: cs[k].c, em: cs[k].em });
    }
    while (segs.length && /^\s*$/.test(segs[0].t)) segs.shift();
    if (segs.length) segs[0].t = segs[0].t.replace(/^\s+/, '');
    while (segs.length && /^\s*$/.test(segs[segs.length - 1].t)) segs.pop();
    if (segs.length) {
      var ls = segs[segs.length - 1];
      ls.t = ls.t.replace(/\s+$/, '');
      if (cut) { ls.t = ls.t.replace(/[,;:\-–—]+$/, ''); segs.push({ t: '…', em: false }); }
    }
    return segs;
  }

  /* ---- сохранённое ---- */
  var S = { filter: '' };
  var listBox = null, countEl = null, segBtns = {};

  function entries() {
    var s = shelf(), out = [];
    for (var i = 0; i < s.length; i++) {
      var e = s[i];
      if (!e || typeof e.id !== 'string' || !SHORT[e.author]) continue;
      out.push({ id: e.id, author: e.author, date: typeof e.date === 'string' ? e.date : '', i: i });
    }
    out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b.i - a.i; });
    return out;
  }
  function shortDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? (+m[3]) + ' ' + MONTH_SHORT[+m[2] - 1] : '';
  }
  function removeEntry(id, a) {
    var s = shelf(), out = [];
    for (var i = 0; i < s.length; i++) if (!(s[i] && s[i].id === id && s[i].author === a)) out.push(s[i]);
    lsSet(SHELF_KEY, JSON.stringify(out));
    paintShelf();
  }
  function canShare() { return !!(window.NaprosvetShare && window.NaprosvetShare.card); }

  function itemNode(e, q) {
    var item = el('article', 'item');
    item.appendChild(el('p', 'meta', (shortDate(e.date) ? shortDate(e.date) + ' · ' : '') + 'спрашивает ' + SHORT[q.by] + ' · ' + q.q));
    var lead = el('p', 'lead'), segs = firstPhrase(q.a[e.author]);
    for (var i = 0; i < segs.length; i++) lead.appendChild(el(segs[i].em ? 'em' : 'span', null, segs[i].t));
    item.appendChild(lead);
    var who = el('div', 'who');
    who.appendChild(el('span', 'name', SHORT[e.author]));
    var open = el('a', 'open', 'Открыть →');
    open.href = '../voices/#' + e.id;
    who.appendChild(open);
    item.appendChild(who);
    var acts = el('div', 'acts');
    if (canShare()) {
      var sh = btn('Поделиться', 'tx share');
      sh.addEventListener('click', function () {
        try { window.NaprosvetShare.card({ question: q.q, author: e.author, answer: q.a[e.author], id: e.id }); } catch (x) {}
      });
      acts.appendChild(sh);
    }
    var rm = btn('Убрать', 'tx');
    rm.addEventListener('click', function () { removeEntry(e.id, e.author); });
    acts.appendChild(rm);
    item.appendChild(acts);
    return item;
  }

  function paintShelf() {
    if (!listBox) return;
    listBox.innerHTML = '';
    if (dataState === 'loading') { listBox.appendChild(el('p', 'soon', 'Загрузка…')); return; }
    if (dataState === 'error') {
      var box = el('div', 'err');
      box.appendChild(el('p', null, 'Не удалось загрузить вопросы'));
      var b = btn('Повторить', 'btn');
      b.addEventListener('click', loadData);
      box.appendChild(b);
      listBox.appendChild(box);
      return;
    }
    var all = [], list = entries(), i;
    for (i = 0; i < list.length; i++) if (D.byId[list[i].id]) all.push(list[i]);
    countEl.textContent = 'Сохранённое · ' + all.length;
    for (i = 0; i < ORDER.length; i++) if (segBtns[ORDER[i]]) segBtns[ORDER[i]].setAttribute('aria-pressed', String(S.filter === ORDER[i]));
    segBtns[''].setAttribute('aria-pressed', String(S.filter === ''));
    if (!all.length) {
      listBox.appendChild(el('p', 'empty', 'Пока ничего. Сохраняйте ответы на «Сегодня» и в «Голосах_»'));
      return;
    }
    var shown = 0, items = el('div', 'items');
    for (i = 0; i < all.length; i++) {
      if (S.filter && all[i].author !== S.filter) continue;
      items.appendChild(itemNode(all[i], D.byId[all[i].id]));
      shown++;
    }
    if (!shown) listBox.appendChild(el('p', 'empty', 'У ' + ({ brodsky: 'Бродского', chekhov: 'Чехова', gary: 'Гари' })[S.filter] + ' пока ничего не сохранено'));
    else listBox.appendChild(items);
  }

  function loadData() {
    dataState = 'loading';
    paintShelf();
    fetch(BASE.href + '../voices/data.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
      if (!d || !d.questions) throw new Error('data');
      d.byId = {};
      for (var i = 0; i < d.questions.length; i++) d.byId[d.questions[i].id] = d.questions[i];
      D = d; dataState = 'ok';
      paintShelf();
    }).then(null, function () { dataState = 'error'; paintShelf(); });
  }

  /* ---- настройки ---- */
  var installRow = null;
  function paintInstall() {
    if (!installRow) return;
    var can = false;
    try { can = !!(window.NaprosvetApp && window.NaprosvetApp.canInstall()); } catch (e) { can = false; }
    installRow.hidden = !can;
  }

  /* ---- сборка экрана ---- */
  function section(label) {
    var s = el('section', 'sec');
    if (label) s.appendChild(el('h2', 'lbl', label));
    return s;
  }
  function build() {
    var today = localToday(), td = new Date(today), frag = doc.createDocumentFragment(), i;
    if (!cal.y) { cal.y = td.getUTCFullYear(); cal.m = td.getUTCMonth(); }

    /* календарь и неделя */
    var s1 = section();
    calBox = el('div', 'cal');
    s1.appendChild(calBox);
    var sc = weekScore(today);
    if (sc.all) {
      var line = el('p', 'score', 'За неделю: ');
      line.appendChild(el('b', null, sc.ok + ' из ' + sc.all));
      line.appendChild(doc.createTextNode(' · «Чей ответ?»'));
      s1.appendChild(line);
    }
    frag.appendChild(s1);

    /* продолжить чтение */
    var rows = resumeRows();
    if (rows.length) {
      var s2 = section('Продолжить чтение'), wrap = el('div', 'rows');
      for (i = 0; i < rows.length; i++) wrap.appendChild(rows[i]);
      s2.appendChild(wrap);
      frag.appendChild(s2);
    }

    /* сохранённое */
    var s3 = section(), head = el('div', 'sh-head');
    countEl = el('h2', 'lbl', 'Сохранённое · 0');
    head.appendChild(countEl);
    var seg = el('div', 'seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', 'Чей ответ');
    segBtns = {};
    var opts = [['', 'Все']].concat(ORDER.map(function (a) { return [a, SHORT[a]]; }));
    opts.forEach(function (o) {
      var b = btn(o[1]);
      b.setAttribute('aria-pressed', String(S.filter === o[0]));
      b.addEventListener('click', function () { S.filter = o[0]; paintShelf(); });
      segBtns[o[0]] = b;
      seg.appendChild(b);
    });
    head.appendChild(seg);
    s3.appendChild(head);
    listBox = el('div');
    s3.appendChild(listBox);
    frag.appendChild(s3);

    /* настройки */
    var s4 = section('Настройки'), set = el('div', 'set');
    installRow = btn('Установить приложение');
    installRow.appendChild(el('span', 'ar', '→'));
    installRow.addEventListener('click', function () { try { window.NaprosvetApp.install(); } catch (e) {} });
    set.appendChild(installRow);
    var how = el('a');
    how.href = '../voices/#method';
    how.appendChild(el('span', null, 'Как сделаны «голоса»'));
    how.appendChild(el('span', 'ar', '→'));
    set.appendChild(how);
    var clr = btn('Очистить сохранённое', 'danger');
    clr.addEventListener('click', function () {
      var n = shelf().length;
      if (!n) return;
      if (!confirm('Очистить полку? Сохранённых ответов: ' + n + '. Это нельзя отменить.')) return;
      lsSet(SHELF_KEY, '[]');
      paintShelf();
    });
    set.appendChild(clr);
    s4.appendChild(set);
    frag.appendChild(s4);

    app.innerHTML = '';
    app.appendChild(frag);
    paintCal();
    paintInstall();
    paintShelf();
  }

  window.addEventListener('beforeinstallprompt', function () { setTimeout(paintInstall, 0); });   // app.js уже запомнил событие
  window.addEventListener('appinstalled', function () { setTimeout(paintInstall, 0); });
  window.addEventListener('pageshow', function (e) { if (e.persisted && app.firstChild) { build(); } });

  /* для проверки в браузере */
  window.NaprosvetShelf = { firstPhrase: firstPhrase };

  build();
  loadData();
})();
