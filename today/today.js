/* Экран «Сегодня»: вопрос дня, три ответа, «Чей ответ?», карточка «На просвет сегодня».
   Без библиотек, в стиле app.js (var, function). Данные: ../voices/data.json, cards.json, links.json. */
(function () {
  /* ---- настройки ---- */
  // дата старта: день 0. Пользователь может поменять (формат ГГГГ-ММ-ДД)
  var START = '2026-10-13';
  var BACK_DAYS = 30;
  var YM_ID = 113309794;

  var ORDER = ['brodsky', 'chekhov', 'gary'];
  var SHORT = { brodsky: 'Бродский', chekhov: 'Чехов', gary: 'Гари' };
  var WHERE = { brodsky: 'Венеция, ноябрь 1993', chekhov: 'Ялта, январь 1900', gary: 'Париж, 1978–1980' };
  var CARD_ORDER = ['chekhov', 'brodsky', 'gary'];
  // разделы исследований, куда ведут карточки «На просвет сегодня»
  var CARD_SECTION = {
    mify: { brodsky: 'I.2 Мифы и факты', chekhov: 'I.2 Мифы и факты', gary: 'I.2 Мифы и факты' },
    rekordy: { brodsky: 'VII.3 Рекорды', chekhov: 'VIII.1 Рекорды', gary: 'VII.1 Рекорды' }
  };
  var VERDICT = {
    yes: ['yes', '✓ подтверждается'], no: ['no', '✕ не подтверждается'], part: ['part', '≈ отчасти'], none: ['none', 'цифрами не решается']
  };
  var WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var SHELF_KEY = 'naprosvet-shelf', GUESS_KEY = 'naprosvet-guess';
  var DAY = 864e5;

  var doc = document;
  var app = doc.getElementById('app');
  var script = doc.currentScript;
  var BASE = new URL('.', script ? script.src : location.href);

  /* ---- мелочи ---- */
  function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function goal(name) { try { if (window.ym) window.ym(YM_ID, 'reachGoal', name); } catch (e) {} }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function mod(a, n) { return ((a % n) + n) % n; }
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

  /* ---- даты: календарная дата хранится как UTC-полночь, так сутки всегда ровно 864e5 ---- */
  function parseYmd(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3], t = Date.UTC(y, mo - 1, d), c = new Date(t);
    if (c.getUTCFullYear() !== y || c.getUTCMonth() !== mo - 1 || c.getUTCDate() !== d) return null;
    return t;
  }
  function fmtYmd(ts) { var d = new Date(ts); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function localToday() { var n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); }
  function dayNumber(ts) { return Math.round((ts - parseYmd(START)) / DAY); }
  function longDate(ts) {
    var d = new Date(ts);
    return WEEKDAYS[d.getUTCDay()] + ' · ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }
  function dateFromUrl(today) {
    var m = /[?&]d=([^&#]*)/.exec(location.search), ts = m ? parseYmd(decodeURIComponent(m[1])) : null;
    if (ts == null || ts > today || ts < today - BACK_DAYS * DAY) return today;
    return ts;
  }

  /* ---- текст ответа: абзацы и *ремарки* курсивом (как в «Голосах_») ---- */
  function parse(t) {
    var segs = [], re = /\*([^*]+)\*/g, m, last = 0;
    while ((m = re.exec(t))) { if (m.index > last) segs.push({ t: t.slice(last, m.index) }); segs.push({ t: m[1], em: true }); last = re.lastIndex; }
    if (last < t.length) segs.push({ t: t.slice(last) });
    return { segs: segs };
  }
  function answer(t) {
    return t.split(/\n\s*\n/).map(function (x) { return x.replace(/\s*\n\s*/g, ' ').trim(); }).filter(Boolean).map(parse);
  }
  function fillSegs(p, segs) {
    for (var i = 0; i < segs.length; i++) p.appendChild(el(segs[i].em ? 'em' : 'span', null, segs[i].t));
    return p;
  }

  /* первая фраза: ремарки в начале (даже если это отдельный абзац) + текст до . ! ? …
     Точка после одной заглавной буквы («А. Чехов») концом не считается; закрывающие »"') остаются во фразе. */
  var CAP = /[А-ЯЁA-Z]/;
  function sentenceEnd(t) {
    for (var i = 0; i < t.length; i++) {
      var c = t.charAt(i);
      if (c !== '.' && c !== '!' && c !== '?' && c !== '…') continue;
      if (c === '.' && i > 0 && CAP.test(t.charAt(i - 1)) && (i === 1 || /[\s«"„(\[]/.test(t.charAt(i - 2)))) continue;
      var j = i + 1;
      while (j < t.length && /[.!?…]/.test(t.charAt(j))) j++;
      while (j < t.length && /[»"”')\]]/.test(t.charAt(j))) j++;
      if (j >= t.length || /\s/.test(t.charAt(j))) return j;
      i = j - 1;
    }
    return -1;
  }
  // если фраза оборвалась внутри «цитаты», дотягиваем до закрывающей » (в пределах 120 знаков)
  function balanceQuote(t, cut) {
    var head = t.slice(0, cut);
    if (head.split('«').length <= head.split('»').length) return cut;
    var k = t.indexOf('»', cut);
    if (k < 0 || k - cut > 120) return cut;
    k++;
    while (k < t.length && /[.!?…»"”')\]]/.test(t.charAt(k))) k++;
    return k >= t.length || /\s/.test(t.charAt(k)) ? k : cut;
  }
  function firstPhrase(paras) {
    var lead = [], pi, si = 0, found = false;
    for (pi = 0; pi < paras.length && !found; pi++) {
      var segs = paras[pi].segs;
      si = 0;
      while (si < segs.length) {
        if (segs[si].em) { lead.push(segs[si]); si++; }
        else if (/^\s*$/.test(segs[si].t)) si++;
        else break;
      }
      if (si < segs.length) { found = true; pi--; }
    }
    var body = [];
    if (found) {
      var ss = paras[pi].segs;
      for (var i = si; i < ss.length; i++) {
        if (ss[i].em) { body.push(ss[i]); continue; }
        var cut = sentenceEnd(ss[i].t);
        if (cut < 0) { body.push(ss[i]); continue; }
        body.push({ t: ss[i].t.slice(0, balanceQuote(ss[i].t, cut)) });
        break;
      }
      if (body.length && !body[0].em) body[0] = { t: body[0].t.replace(/^\s+/, '') };
      var lb = body.length - 1;
      if (lb >= 0 && !body[lb].em) body[lb] = { t: body[lb].t.replace(/\s+$/, '') };
    }
    return lead.length && body.length ? lead.concat([{ t: ' ' }], body) : lead.concat(body);
  }

  /* ---- данные ---- */
  var D = null, C = null, LK = null, loaded = false;
  var S = { ts: 0, n: 0, q: null, open: '', picking: '' };   // состояние экрана

  function getJson(url, optional) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(null, function (e) { if (optional) return {}; throw e; });
  }
  function load() {
    app.innerHTML = '';
    app.appendChild(el('p', 'soon', 'Загрузка…'));
    Promise.all([
      getJson(BASE.href + '../voices/data.json'),
      getJson(BASE.href + 'cards.json'),
      getJson(BASE.href + 'links.json', true)
    ]).then(function (r) {
      D = r[0]; C = r[1]; LK = r[2];
      if (!D || !D.questions || !D.order || !C || !C.cards) throw new Error('data');
      D.byId = {};
      for (var i = 0; i < D.questions.length; i++) D.byId[D.questions[i].id] = D.questions[i];
      loaded = true;
      show(dateFromUrl(localToday()), true);
      goal('today_open');
    }).then(null, function () {
      app.innerHTML = '';
      var box = el('div', 'err');
      box.appendChild(el('p', null, 'Не удалось загрузить вопросы'));
      var b = el('button', 'btn', 'Повторить');
      b.type = 'button';
      b.addEventListener('click', load);
      box.appendChild(b);
      app.appendChild(box);
    });
  }

  /* ---- ссылка в исследование по теме вопроса ---- */
  function researchLink(q, a) {
    if (!LK || !LK.labels) return null;
    for (var i = 0; i < q.t.length; i++) {
      var row = LK[q.t[i]], sec = row && row[a];
      if (sec && LK.labels[a] && LK.labels[a][sec]) return { href: '../' + a + '/#' + sec, text: SHORT[a] + ' на просвет · ' + LK.labels[a][sec] + ' →' };
    }
    return null;
  }

  /* ---- полка ---- */
  function shelf() { var s = jsonGet(SHELF_KEY, []); return s instanceof Array ? s : []; }
  function isSaved(id, a) {
    var s = shelf();
    for (var i = 0; i < s.length; i++) if (s[i] && s[i].id === id && s[i].author === a) return true;
    return false;
  }
  function save(id, a, date) {
    if (isSaved(id, a)) return false;
    var s = shelf();
    s.push({ id: id, author: a, date: date });
    lsSet(SHELF_KEY, JSON.stringify(s));
    return true;
  }

  /* ---- «Чей ответ?» ---- */
  function guessAuthor(q, n) {
    var g = C.guess && C.guess[q.id];
    return g && g.length ? g[mod(n, g.length)] : '';
  }
  function guessStore() { var g = jsonGet(GUESS_KEY, {}); return g && typeof g === 'object' && !(g instanceof Array) ? g : {}; }
  function weekScore(today) {
    var g = guessStore(), ok = 0, all = 0;
    for (var i = 0; i < 7; i++) {
      var r = g[fmtYmd(today - i * DAY)];
      if (r && typeof r === 'object') { all++; if (r.ok) ok++; }
    }
    return { ok: ok, all: all };
  }

  /* ---- «На просвет сегодня» ---- */
  function cardOfDay(n) {
    var a = CARD_ORDER[mod(n, 3)], list = [];
    for (var i = 0; i < C.cards.length; i++) if (C.cards[i].author === a) list.push(C.cards[i]);
    if (!list.length) return null;
    return list[mod(Math.floor(n / 3), list.length)];
  }
  function dec(s) { return String(s == null ? '' : s).replace(/(\d)\.(\d)/g, '$1,$2'); }

  /* ---- отрисовка ---- */
  function btn(text, cls) { var b = el('button', 'btn' + (cls ? ' ' + cls : ''), text); b.type = 'button'; return b; }
  function link(href, text, cls) { var a = el('a', cls || 'lnk', text); a.href = href; return a; }

  function show(ts, first) {
    var today = localToday();
    S.ts = ts; S.n = dayNumber(ts); S.open = ''; S.picking = '';
    S.q = D.byId[D.order[mod(S.n, D.order.length)]];
    try { history.replaceState(null, '', location.pathname + (ts === today ? '' : '?d=' + fmtYmd(ts)) + location.hash); } catch (e) {}
    S.rendered = today;
    render();
    if (!first) { try { window.scrollTo(0, 0); } catch (e) {} }
  }

  function render() {
    var q = S.q, today = localToday(), frag = doc.createDocumentFragment();

    /* дата и переход по дням */
    var row = el('div', 'dayrow');
    row.appendChild(el('span', 'date', longDate(S.ts)));
    var nav = el('span', 'daynav');
    var prev = btn(S.ts === today ? '← вчера' : '← раньше', 'dnav');
    prev.disabled = S.ts <= today - BACK_DAYS * DAY;
    prev.addEventListener('click', function () { show(S.ts - DAY); });
    nav.appendChild(prev);
    if (S.ts < today) {
      var next = btn('позже →', 'dnav');
      next.addEventListener('click', function () { show(S.ts + DAY); });
      nav.appendChild(next);
    }
    row.appendChild(nav);
    frag.appendChild(row);

    /* вопрос */
    var card = el('section', 'q'), meta = el('div', 'meta', 'спрашивает ');
    meta.appendChild(el('b', null, SHORT[q.by]));
    meta.appendChild(doc.createTextNode(' · ' + D.sections[q.by][q.s]));
    card.appendChild(meta);
    card.appendChild(el('h2', null, q.q));
    frag.appendChild(card);

    /* ответы или мини-игра */
    var stage = el('div', 'stage');
    frag.appendChild(stage);

    /* действия */
    var acts = el('div', 'acts');
    var btnGuess = btn('Чей ответ?', 'primary'), btnSave = btn('Сохранить'), btnShare = btn('Поделиться');
    btnShare.hidden = true;
    if (!guessAuthor(q, S.n)) btnGuess.hidden = true;
    acts.appendChild(btnGuess); acts.appendChild(btnSave); acts.appendChild(btnShare);
    frag.appendChild(acts);
    var pick = el('div', 'pickrow');
    pick.hidden = true;
    frag.appendChild(pick);

    frag.appendChild(el('p', 'disc', 'Три ответа написаны языковой моделью по текстам авторов. Это реконструкция, не цитаты.'));

    var tc = todayCard();
    if (tc) frag.appendChild(tc);

    app.innerHTML = '';
    app.appendChild(frag);

    var heads = {}, bodies = {}, cols = {};

    function setOpen(a) {
      S.open = a;
      for (var i = 0; i < ORDER.length; i++) {
        var k = ORDER[i], on = k === a;
        cols[k].className = 'ans' + (on ? ' open' : '');
        heads[k].setAttribute('aria-expanded', on ? 'true' : 'false');
        bodies[k].hidden = !on;
      }
      paintSave();
    }

    function answers() {
      stage.innerHTML = '';
      acts.hidden = false;
      for (var i = 0; i < ORDER.length; i++) (function (a) {
        var paras = answer(q.a[a]);
        var col = el('article', 'ans');
        var head = el('button', 'ans-toggle');
        head.type = 'button';
        head.setAttribute('aria-expanded', 'false');
        head.appendChild(el('span', 'name', SHORT[a]));
        head.appendChild(el('span', 'who', WHERE[a]));
        head.appendChild(fillSegs(el('span', 'lead'), firstPhrase(paras)));
        var chev = el('span', 'chev', '∨');
        chev.setAttribute('aria-hidden', 'true');
        head.appendChild(chev);
        var body = el('div', 'ans-body');
        body.hidden = true;
        for (var j = 0; j < paras.length; j++) body.appendChild(fillSegs(el('p'), paras[j].segs));
        var links = el('div', 'ans-links');
        links.appendChild(link('../voices/#' + q.id, 'Открыть в Голосах_ →'));
        var rl = researchLink(q, a);
        if (rl) links.appendChild(link(rl.href, rl.text));
        body.appendChild(links);
        col.appendChild(head); col.appendChild(body);
        stage.appendChild(col);
        heads[a] = head; bodies[a] = body; cols[a] = col;
        head.addEventListener('click', function () {
          var opening = S.open !== a;
          setOpen(opening ? a : '');
          if (opening) {
            goal('answer_open');
            var r = col.getBoundingClientRect();
            if (r.top < 0) { try { window.scrollTo(0, window.pageYOffset + r.top - 12); } catch (e) {} }
          }
        });
      })(ORDER[i]);
      S.open = '';
      paintSave();
    }

    /* мини «Чей ответ?» */
    function guess() {
      var a = guessAuthor(q, S.n), key = fmtYmd(S.ts), rec = guessStore()[key];
      if (rec && rec.id !== q.id) rec = null;
      stage.innerHTML = '';
      acts.hidden = true;
      pick.hidden = true;
      S.open = '';
      var g = el('section', 'gcard');
      var gh = el('div', 'ghead');
      gh.appendChild(el('b', null, 'Ответ без имени'));
      gh.appendChild(el('span', null, ' · один из трёх, имя скрыто'));
      g.appendChild(gh);
      var paras = answer(q.a[a]), shown = Math.min(2, paras.length), body = el('div', 'gbody');
      for (var i = 0; i < shown; i++) body.appendChild(fillSegs(el('p'), paras[i].segs));
      g.appendChild(body);
      if (paras.length > shown) {
        var k = paras.length - shown;
        g.appendChild(el('p', 'gmore', '… дальше ещё ' + k + ' ' + plural(k, 'абзац', 'абзаца', 'абзацев')));
      }
      stage.appendChild(g);

      var ask = el('div', 'gask');
      ask.appendChild(el('div', 'glabel', 'Чей это ответ?'));
      var opts = el('div', 'gopts'), bs = {};
      for (var j = 0; j < ORDER.length; j++) (function (name) {
        var b = btn(SHORT[name], 'gopt');
        bs[name] = b;
        opts.appendChild(b);
        b.addEventListener('click', function () { choose(name); });
      })(ORDER[j]);
      ask.appendChild(opts);
      stage.appendChild(ask);
      var res = el('div', 'gres');
      stage.appendChild(res);

      function result(pickName, ok) {
        for (var n = 0; n < ORDER.length; n++) {
          var b = bs[ORDER[n]];
          b.disabled = true;
          if (ORDER[n] === a) b.className += ' right';
          else if (ORDER[n] === pickName) b.className += ' wrong';
        }
        res.innerHTML = '';
        res.appendChild(el('p', 'gverdict ' + (ok ? 'ok' : 'bad'), ok ? 'Верно: ' + SHORT[a] : 'Нет: это был ' + SHORT[a]));
        var sc = weekScore(localToday());
        if (sc.all) res.appendChild(el('p', 'gscore', sc.ok + ' из ' + sc.all + ' за эту неделю'));
        var back = btn('Все три ответа');
        back.addEventListener('click', answers);
        res.appendChild(back);
      }
      function choose(name) {
        var all = guessStore();
        if (all[key] && all[key].id === q.id) return;   // один раз в день
        var ok = name === a;
        all[key] = { id: q.id, pick: name, ok: ok };
        lsSet(GUESS_KEY, JSON.stringify(all));
        goal(ok ? 'guess_ok' : 'guess_fail');
        result(name, ok);
      }
      if (rec) result(rec.pick, !!rec.ok);
    }

    /* выбор автора, когда ни один ответ не раскрыт */
    function choosing(kind) {
      if (S.picking === kind) { closePick(); return; }
      S.picking = kind;
      pick.innerHTML = '';
      pick.appendChild(el('span', 'plabel', kind === 'save' ? 'Сохранить ответ:' : 'Поделиться ответом:'));
      for (var i = 0; i < ORDER.length; i++) (function (a) {
        var b = btn(SHORT[a], 'popt');
        b.addEventListener('click', function () { closePick(); if (kind === 'save') doSave(a); else doShare(a); });
        pick.appendChild(b);
      })(ORDER[i]);
      pick.hidden = false;
    }
    function closePick() { S.picking = ''; pick.hidden = true; }

    function paintSave() {
      var all = true, saved;
      if (S.open) saved = isSaved(q.id, S.open);
      else {
        for (var i = 0; i < ORDER.length; i++) if (!isSaved(q.id, ORDER[i])) all = false;
        saved = all;
      }
      btnSave.textContent = saved ? 'Сохранено ✓' : 'Сохранить';
      btnSave.className = 'btn' + (saved ? ' done' : '');
    }
    function doSave(a) {
      if (save(q.id, a, fmtYmd(S.ts))) goal('save');
      paintSave();
    }
    function doShare(a) {
      try {
        if (window.NaprosvetShare && window.NaprosvetShare.card) {
          window.NaprosvetShare.card({ question: q.q, author: a, answer: q.a[a], id: q.id });
        }
      } catch (e) {}
    }

    btnGuess.addEventListener('click', function () { closePick(); guess(); });
    btnSave.addEventListener('click', function () {
      if (S.open) doSave(S.open); else choosing('save');
    });
    btnShare.addEventListener('click', function () {
      if (S.open) doShare(S.open); else choosing('share');
    });
    // «Поделиться» появляется, когда подключён общий слой карточек (задача 5)
    btnShare.hidden = !(window.NaprosvetShare && window.NaprosvetShare.card);

    answers();
  }

  function todayCard() {
    var c = cardOfDay(S.n);
    if (!c) return null;
    var box = el('section', 'tcard');
    var head = el('div', 'thead');
    head.appendChild(el('b', null, 'На просвет сегодня'));
    head.appendChild(doc.createTextNode(' · ' + SHORT[c.author] + ' · ' + (c.kind === 'myth' ? 'миф или факт' : 'рекорд')));
    box.appendChild(head);

    if (c.kind === 'myth') {
      var b = el('button', 'myth');
      b.type = 'button';
      b.setAttribute('aria-expanded', 'false');
      b.appendChild(el('span', 'mtext', c.text));
      var go = el('span', 'mgo', 'вердикт →');
      b.appendChild(go);
      var rev = el('div', 'mrev');
      rev.hidden = true;
      var v = VERDICT[c.verdict || 'none'] || VERDICT.none;
      rev.appendChild(el('span', 'verdict v-' + v[0], v[1]));
      if (c.num) rev.appendChild(el('p', 'mnum', dec(c.num)));
      b.addEventListener('click', function () {
        var open = rev.hidden;
        rev.hidden = !open;
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
        go.hidden = open;
      });
      box.appendChild(b);
      box.appendChild(rev);
    } else {
      box.appendChild(el('h3', 'rtitle', c.text));
      var num = String(c.num == null ? '' : c.num), i = num.indexOf(' — ');
      var val = i >= 0 ? num.slice(0, i) : num, why = i >= 0 ? num.slice(i + 3) : '';
      box.appendChild(el('div', 'rval', dec(val)));
      if (why) box.appendChild(el('p', 'rwhy', dec(why)));
    }
    var sec = CARD_SECTION[c.section] && CARD_SECTION[c.section][c.author];
    if (sec) box.appendChild(link('../' + c.author + '/#' + c.section, SHORT[c.author] + ' на просвет · ' + sec + ' →', 'lnk tlink'));
    return box;
  }

  /* переход через полночь без перезагрузки: если открыт «сегодня», обновляем день */
  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden || !loaded) return;
    var today = localToday();
    if (S.rendered && S.rendered !== today && !/[?&]d=/.test(location.search)) show(today, true);
  });

  /* для проверки в браузере */
  window.NaprosvetToday = { firstPhrase: firstPhrase, answer: answer, dayNumber: dayNumber, mod: mod };

  load();
})();
