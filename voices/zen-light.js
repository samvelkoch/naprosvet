/* «Голоса_», Zen: режим «На просвет». Тёмный экран, по нему справа налево едут строки-ленты с вопросами:
   в покое буквы тёмные на тёмном и размыты; касание (или проведение пальцем) зажигает каждый задетый вопрос целиком:
   свет расползается от точки касания вправо и влево до краёв вопроса, буквы становятся светлыми, резкими, чуть крупнее.
   Засвеченный вопрос едет засвеченным и гаснет, только уходя к левому краю. Второе касание засвеченного открывает ответ.
   Мышь без нажатия и блуждающий свет — лишь мягкая временная подсветка букв. Фон не светлеет никогда: светятся только буквы.
   Всё рисует один canvas. Тусклый слой — по спрайту на вопрос (размытие запечено), светящиеся буквы — по одной. Регистрируется в хосте (zen.js). ES5, без библиотек. */
(function () {
  'use strict';
  if (!window.VoicesZen) return;

  window.VoicesZen.register('light', function (api, scene) {
    var el = api.el, calm = api.calm;

    // ---- константы
    var DIM = [232, 214, 184];      // цвет тусклых букв #e8d6b8 (по яркости почти фон: после размытия пик 0.06–0.085 от этого цвета над #120d0a)
    var DIM_A = 0.11;               // непрозрачность текста в спрайте до размытия (тонкий штрих после размытия теряет ~3/4); ряд множит на 0.9–1.1 и на 1…0.58 (толстый штрих крупных букв после размытия ярче, выравниваем)
    var DIM_SEP = 0.6;              // «·» между вопросами: доля яркости тусклого текста
    var LIT = '#f0e2c8';            // цвет засвеченных букв
    var READ_K = 0.72;              // прочитанный вопрос: тусклее
    var FS0 = 13, FS1 = 34;         // кегль строки, px (на мобильном; треугольное распределение со смещением к средним)
    var V0 = 10, V1 = 28;           // скорость строки, px/с: крупные быстрее
    var ASC = 0.96, DESC = 0.26, SCALE = 1.065;   // полоса строки: над базовой линией ASC·кегль, под ней DESC·кегль, с запасом на увеличение букв
    var GAP0 = 2, GAP1 = 18;        // зазор между полосами строк, px (до распределения остатка)
    var PADB = 10, PADX = 10;       // поля спрайта под размытие, px
    var HW = 10;                    // радиус маленького света (блуждающий; hover мыши — HOVR): на этом расстоянии от центра яркость падает от 1 до 0
    var HOVR = 9, HOVA = 0.8, HOVAGE = 900;   // hover мыши: радиус, сила, «возраст» точки при рождении (живёт TAIL − HOVAGE ≈ 1.1 с)
    var REACH = 4.5;                // максимальная поправка на размер буквы для маленького света
    var TAIL = 2000;                // каждая точка маленького света гаснет через это время после появления, мс
    var FRONT0 = 600, FRONT1 = 900; // время, за которое свет доходит до дальнего края вопроса: от коротких к длинным (>= 900 px), мс
    var SOFT_K = 1.1;               // мягкий край фронта: SOFT_K · кегль (около 2–3 букв)
    var FADE_W = 0.30;              // вопрос начинает гаснуть, когда его правый край ближе этой доли ширины экрана к левому краю; на самом краю он тёмный
    var SLOW = 2.2;                 // блуждающий свет зажигает вопрос во столько раз медленнее пальца
    var WIGNITE = 10000;            // блуждающий свет зажигает вопрос не чаще раза в это время, мс
    var TOLY = 9, TOLX = 10;        // допуск касания: сверх полосы строки по вертикали, сверх краёв вопроса по горизонтали, px (соседи отстоят на 34+ px)
    var TAPMS = 350, DRAG = 10;     // касание короче TAPMS и со сдвигом не больше DRAG px — тап
    var STALE = 1500;               // жест без событий дольше этого считается потерянным (iOS иногда не присылает pointerup/cancel)
    var LIT_SC = 0.06;              // увеличение зажжённой буквы (до ×1.06)
    var ATTACK = 70;                // постоянная времени разгорания буквы, мс
    var PSTEP = 4;                  // шаг точек маленького света по пути мыши, px
    var PCAP = 1400;                // ёмкость кольца точек
    var PATHSTEP = 6;               // шаг проверки «задет ли вопрос» вдоль пути пальца, px
    var IDLE = 7000;                // через 7 с тишины свет блуждает
    var OM = 18;                    // жёсткость пружины блуждающего света
    var WR0 = 21, WR1 = 30;         // радиус блуждающего света, px (диаметр около 40–60): вблизи — WR0, вдали — WR1
    var WS_FAR = 0.55, WS_NEAR = 1.0;   // сила блуждающего света: вдали / вблизи
    var WPER = [6.3, 9.7, 13.4, 16.9];   // периоды «дыхания дистанции», с
    var WVAN = [13.7, 23.3];        // периоды огибающей «растворения», с
    var MAGNET = 230;               // притяжение блуждающего света к указателю, px/с² на расстоянии 300 px
    var WORBIT = 50;                // размах кружения у самого указателя, px
    var MAXQW = 3600;               // вопрос шире этого не берём (предел размера спрайта)

    // ---- слои сцены: один canvas, плюс скрытый узел-источник для полёта заголовка (FLIP)
    var cv = el('canvas', 'zl-cv'), ctx = cv.getContext('2d'), proxy = el('div', 'zl-k');
    scene.appendChild(cv); scene.appendChild(proxy);

    var vw = 0, vh = 0, dpr = 1, safe = { t: 0, r: 0, b: 0, l: 0 }, topY = 0, FF = 'Georgia, serif', BO = 1, mc = null;
    var active = false, paused = false, raf = 0, last = 0, clk = 0, lastAct = 0, timers = [], frozen = false, holdT = 0;
    var rows = [], pool0 = [], MC = {}, openQ = -1, relitQ = -1, g = null, hoverOn = false, mkBudget = 0, lastWI = 0, hRow = null, hIt = null;

    function later(fn, ms) { var t = setTimeout(function () { var k = timers.indexOf(t); if (k >= 0) timers.splice(k, 1); fn(); }, ms); timers.push(t); return t; }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function sm(x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); }
    function fade(age) { var a = age / TAIL; return a <= 0 ? 1 : a >= 1 ? 0 : 1 - a * a * (3 - 2 * a); }
    function qtext(q) { return api.data().questions[q].q; }

    // ---------------------------------------------------------------- размеры
    function probeSafe() {
      var p = el('i'); p.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      scene.appendChild(p); var cs = getComputedStyle(p);
      safe = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
      scene.removeChild(p);
    }
    // смещение базовой линии от верха строки при line-height 1.25 (доля кегля): по нему узел-источник совпадает с буквами на canvas
    function measureBO() {
      var d = el('div'), m = el('span');
      d.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:pre;pointer-events:none;font:400 100px/1.25 ' + FF;
      m.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
      d.textContent = 'Ag'; d.appendChild(m); scene.appendChild(d);
      var b = m.getBoundingClientRect().top - d.getBoundingClientRect().top; scene.removeChild(d);
      BO = b > 0 ? b / 100 : 1.0;
    }
    function size() {
      vw = scene.clientWidth || window.innerWidth; vh = scene.clientHeight || window.innerHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
      cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      probeSafe(); measureBO();
      // низ панели иконок справа сверху: строки начинаются под ней
      var tl = scene.parentNode && scene.parentNode.querySelector ? scene.parentNode.querySelector('.zt') : null, sr = scene.getBoundingClientRect(), zb = 0;
      if (tl) { var r = tl.getBoundingClientRect(); zb = r.bottom - sr.top; }
      if (!(zb > 20)) zb = safe.t + 50;
      topY = Math.round(zb + 10);
    }

    // ---------------------------------------------------------------- вопросы, метрики
    function pool() {
      var D = api.data(), p = [], k;
      for (k = 0; k < D.questions.length; k++) if (api.matches(k)) p.push(k);
      return p;
    }
    // позиции и ширины букв: left[i] — начало буквы i в строке (с учётом кернинга), cw[i] — её ширина; считаем один раз на пару (вопрос, кегль)
    function metrics(row, it) {
      if (it.left) return;
      var key = row.fs + '|' + it.q, m = MC[key], n, i, pre, c;
      if (!m) {
        mc.font = row.font; n = it.text.length;
        m = { left: new Float32Array(n), cw: new Float32Array(n) };
        for (i = 0; i < n; i++) {
          pre = mc.measureText(it.text.slice(0, i + 1)).width; c = mc.measureText(it.text.charAt(i)).width;
          m.cw[i] = c; m.left[i] = pre - c;
        }
        MC[key] = m;
      }
      it.left = m.left; it.cw = m.cw;
    }
    function shownSet() {
      var o = {}, k, j;
      for (k = 0; k < rows.length; k++) for (j = 0; j < rows[k].items.length; j++) o[rows[k].items[j].q] = 1;
      return o;
    }
    function mkItem(row, q) {
      var text = qtext(q).replace(/\s+/g, ' ').trim();
      mc.font = row.font;
      var qw = mc.measureText(text).width;
      return { q: q, text: text, x: 0, qw: qw, w: qw + row.gap, sp: null, left: null, cw: null, gI: null, gT: null, gD: null, hot: 0, ls: 0, lox: 0, lfar: 0, ldur: 1, lsoft: 1, hidden: false, rd: api.isRead(q) };
    }
    // случайный подходящий вопрос: из выбранной темы, не показанный сейчас (если вопросов хватает), не шире MAXQW
    function pickItem(row) {
      if (!pool0.length) return null;
      var sh = shownSet(), tries = 0, q, it, free = [], k;
      sh[openQ] = 1;
      for (k = 0; k < pool0.length; k++) if (!sh[pool0[k]]) free.push(pool0[k]);
      while (tries++ < 40) {
        // свободных вопросов хватает — повторов на экране нет; кончились — тогда берём любой
        q = free.length ? free[Math.floor(Math.random() * free.length)] : pool0[Math.floor(Math.random() * pool0.length)];
        it = mkItem(row, q);
        if (it.qw > MAXQW) continue;
        return it;
      }
      return null;
    }
    function lastEdge(row) { var it = row.items[row.items.length - 1]; return it.x + it.w; }
    // лента достраивается справа, пока правый край не уйдёт за экран; слева снимаются ушедшие
    function maintain(row) {
      var it, k, guard = 0;
      while (row.items.length && !row.items[0].hidden && row.items[0].x + row.items[0].w - row.off < -4) row.items.shift();
      while ((!row.items.length || lastEdge(row) - row.off < vw + 80) && guard++ < 40) {
        it = pickItem(row); if (!it) break;
        it.x = row.items.length ? lastEdge(row) : row.off - rnd(0, 0.85) * it.w;
        row.items.push(it);
      }
    }
    function fillLeft(row) {
      var it, guard = 0;
      while (row.items.length && row.items[0].x - row.off > -60 && guard++ < 40) {
        it = pickItem(row); if (!it) break;
        it.x = row.items[0].x - it.w; row.items.unshift(it);
      }
    }

    // ---------------------------------------------------------------- раскладка строк
    function pickFs() { var t = (Math.random() + Math.random()) / 2; return Math.round(FS0 + (FS1 - FS0) * Math.pow(t, 1.25)); }
    function mkRow(y, fs) {
      var top = Math.ceil(ASC * fs * SCALE), h = top + Math.ceil(DESC * fs * SCALE), v = V0 + (V1 - V0) * Math.pow((fs - FS0) / (FS1 - FS0), 0.9);
      v = Math.max(V0, Math.min(V1, v * rnd(0.9, 1.1)));
      return { y: y, fs: fs, h: h, base: y + top, gcy: y + top - 0.28 * fs, font: '400 ' + fs + 'px ' + FF, v: calm ? 0 : v, off: 0, items: [],
        gap: fs * rnd(2.6, 4.4), blur: 2.2 + 1.8 * (fs - FS0) / (FS1 - FS0), a: rnd(0.9, 1.1) * (1 - 0.42 * (fs - FS0) / (FS1 - FS0)), reach: Math.min(REACH, fs * 0.25) };
    }
    function layout() {
      rows = []; MC = {}; pool0 = pool();
      if (!mc) mc = document.createElement('canvas').getContext('2d');
      var y = topY, bottom = vh - 10 - safe.b, gaps = [], fs, row, k, slack, tot = 0, add = 0;
      for (;;) {
        fs = pickFs();
        if (y + Math.ceil(1.25 * fs * SCALE) > bottom) { fs = Math.floor((bottom - y) / (1.25 * SCALE)); if (fs < FS0) break; }
        row = mkRow(y, fs);
        if (y + row.h > bottom) break;
        rows.push(row); gaps.push(GAP0 + (GAP1 - GAP0) * Math.pow(Math.random(), 1.3));
        y += row.h + gaps[gaps.length - 1];
      }
      // остаток по высоте раздаём в зазоры
      if (rows.length > 1) {
        slack = bottom - (rows[rows.length - 1].y + rows[rows.length - 1].h);
        for (k = 0; k < rows.length - 1; k++) { gaps[k] = rnd(0.4, 1.6); tot += gaps[k]; }
        for (k = 1; k < rows.length; k++) { add += slack * gaps[k - 1] / tot; rows[k].y += Math.round(add); rows[k].base += Math.round(add); rows[k].gcy += Math.round(add); }
      }
      for (k = 0; k < rows.length; k++) maintain(rows[k]);
      for (k = 0; k < rows.length; k++) for (var j = 0; j < rows[k].items.length; j++) prep(rows[k], rows[k].items[j], true);
      try { var c = check(); console.info('[zen] На просвет: строк ' + c.rows + ', пересечений ' + c.overlaps + ', кегль ' + c.fsMin + '–' + c.fsMax + ', скорость ' + c.vMin + '–' + c.vMax + ', повторов на экране: ' + c.dupes + ', в зоне иконок: ' + c.inZone + ', за краем: ' + c.outside); } catch (e) {}
    }

    // ---------------------------------------------------------------- тусклый слой: спрайт вопроса с запечённым размытием
    // размытие через shadowBlur: тень текста, вынесенного за край спрайта, — работает везде (ctx.filter в Safari не поддерживается)
    function mkSprite(row, it) {
      var W = Math.ceil(it.w) + 2 * PADX, H = row.h + 2 * PADB, c = document.createElement('canvas'), x, off, sig = row.blur;
      c.width = Math.ceil(W * dpr); c.height = Math.ceil(H * dpr);
      x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
      off = c.width + 64;
      x.font = row.font; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
      x.shadowBlur = 2 * sig * dpr; x.shadowOffsetX = off; x.shadowOffsetY = 0;
      x.fillStyle = '#000';
      x.shadowColor = 'rgba(' + DIM[0] + ',' + DIM[1] + ',' + DIM[2] + ',' + DIM_A + ')';
      x.fillText(it.text, PADX - off / dpr, PADB + (row.base - row.y));
      x.shadowColor = 'rgba(' + DIM[0] + ',' + DIM[1] + ',' + DIM[2] + ',' + (DIM_A * DIM_SEP) + ')';
      x.fillText('·', PADX + it.qw + (it.w - it.qw) / 2 - mc.measureText('·').width / 2 - off / dpr, PADB + (row.base - row.y));
      it.sp = c; it.spW = W; it.spH = H;
    }
    function prep(row, it, force) {
      if (it.sp) return;
      if (!force && mkBudget <= 0) return;
      mkBudget--; mc.font = row.font; mkSprite(row, it);
    }

    // ---------------------------------------------------------------- маленький свет (hover мыши, блуждающий): точки
    // кольцо точек {x, y, r, a, t}: мышь ставит их по пути каждые PSTEP px, блуждающий свет — реже и мягче.
    // Освещённость буквы — по ближайшей точке с учётом возраста; буква запоминает (сила, время точки) и гаснет по расписанию точки.
    // Палец точек не ставит: он зажигает вопросы целиком (ignite).
    var PX = new Float32Array(PCAP), PY = new Float32Array(PCAP), PR = new Float32Array(PCAP), PA = new Float32Array(PCAP), PT = new Float64Array(PCAP);
    var pS = 0, pE = 0, headSeq = -1, lp = { ok: false, x: 0, y: 0, t: 0 }, ptr = { x: 0, y: 0, has: false, gone: false };
    function addPoint(x, y, r, a, t) {
      if (pE - pS >= PCAP) pS++;
      var i = pE % PCAP; PX[i] = x; PY[i] = y; PR[i] = r; PA[i] = a; PT[i] = t; pE++; return pE - 1;
    }
    // отрезок пути мыши от (lp.x, lp.y) до (x, y): точки через PSTEP px, время распределено между прошлым и нынешним событием
    function strokeTo(x, y, T) {
      var Te = T - HOVAGE;
      if (!lp.ok) { headSeq = addPoint(x, y, HOVR, HOVA, Te); lp.ok = true; lp.x = x; lp.y = y; lp.t = Te; return; }
      var dx = x - lp.x, dy = y - lp.y, d = Math.sqrt(dx * dx + dy * dy), n = Math.min(160, Math.floor(d / PSTEP)), t0 = Math.max(lp.t, Te - 80), k, f;
      if (n < 1) return;
      for (k = 1; k <= n; k++) { f = k / n; headSeq = addPoint(lp.x + dx * (k * PSTEP / d), lp.y + dy * (k * PSTEP / d), HOVR, HOVA, t0 + (Te - t0) * f); }
      lp.x += dx * (n * PSTEP / d); lp.y += dy * (n * PSTEP / d); lp.t = Te;
    }
    function allocD(it) { if (!it.gD) it.gD = new Float32Array(it.text.length); }
    function allocT(it) { if (!it.gI) { var n = it.text.length; it.gI = new Float32Array(n); it.gT = new Float64Array(n); } }

    // ---------------------------------------------------------------- свет вопроса целиком
    // вопрос, которого коснулись, зажигается от точки касания: фронт идёт вправо и влево с мягким краем и до границ именно этого вопроса.
    // Время зажжения (ls) и точка (lox, px от левого края вопроса) хранятся в вопросе; свет не тухнет, пока вопрос не подойдёт к левому краю (см. draw).
    // доля света, оставшаяся вопросу по положению: 1, пока правый край правее FADE_W·ширины от левого края; 0 — край ушёл за экран
    function foOf(row, it) { var u = (it.x - row.off + it.qw) / (FADE_W * vw); return u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u); }
    function litVis(row, it) { return it.ls > 0 && foOf(row, it) > 0.2; }
    function ignite(row, it, ox, k, T) {
      if (it.ls || it.hidden) return;
      if (!it.left) metrics(row, it);
      allocD(it);
      it.lox = ox < 0 ? 0 : ox > it.qw ? it.qw : ox;
      it.lfar = Math.max(it.lox, it.qw - it.lox); it.lsoft = SOFT_K * row.fs;
      it.ldur = (FRONT0 + (FRONT1 - FRONT0) * Math.min(1, it.lfar / 900)) * k;
      it.ls = calm ? T - it.ldur - 1 : T;
    }
    function igniteFull(row, it) {
      if (it.ls) return;
      if (!it.left) metrics(row, it);
      allocD(it); it.lox = 0; it.lfar = it.qw; it.lsoft = SOFT_K * row.fs; it.ldur = 1; it.ls = performance.now() - 5;
    }
    // вопрос под точкой (x, y): ближайшая по вертикали строка в пределах допуска, вопрос по горизонтали с допуском TOLX; результат в hRow/hIt
    function hitAt(x, y, toly) {
      var k, j, row, it, sx, d, bd = 1e9; hRow = null; hIt = null;
      for (k = 0; k < rows.length; k++) {
        row = rows[k];
        if (y < row.y - toly || y > row.y + row.h + toly) continue;
        d = Math.abs(y - row.gcy); if (d >= bd) continue;
        for (j = 0; j < row.items.length; j++) {
          it = row.items[j]; if (it.hidden) continue;
          sx = it.x - row.off;
          if (x >= sx - TOLX && x <= sx + it.qw + TOLX) { bd = d; hRow = row; hIt = it; break; }
        }
      }
      return !!hIt;
    }
    // отрезок пути пальца: каждый задетый тёмный вопрос зажигается от точки, где его задели
    function lightPath(x0, y0, x1, y1, T) {
      var dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy), n = Math.min(120, Math.max(1, Math.ceil(d / PATHSTEP))), k, x, y;
      for (k = 1; k <= n; k++) {
        x = x0 + dx * k / n; y = y0 + dy * k / n;
        if (hitAt(x, y, TOLY) && !hIt.ls) ignite(hRow, hIt, x - (hIt.x - hRow.off), 1, T);
      }
    }
    function touch(row, it, px, py, r, a, tp, fv, T) {
      var sx = it.x - row.off, left = it.left, cw = it.cw, n = it.text.length, lo = 0, hi = n - 1, mid, R = r + row.reach, x0 = px - R - sx, x1 = px + R - sx, i, gx, dx, dy, de, v, cur;
      while (lo < hi) { mid = (lo + hi) >> 1; if (left[mid] + cw[mid] < x0) lo = mid + 1; else hi = mid; }
      allocT(it); allocD(it);
      for (i = lo; i < n && left[i] <= x1; i++) {
        gx = sx + left[i] + cw[i] * 0.5; dx = gx - px; dy = row.gcy - py;
        de = Math.sqrt(dx * dx + dy * dy) - row.reach; if (de >= r) continue;
        v = a * (1 - sm(de / r)); cur = it.gI[i] * fade(T - it.gT[i]);
        if (v * fv > cur + 0.002) { it.gI[i] = v; it.gT[i] = tp; }
      }
      it.hot = T + TAIL + 60;
    }
    function sample(T) {
      var k, i, ri, j, row, it, age, fv, a, r, px, py, R, sx;
      while (pS < pE && T - PT[pS % PCAP] >= TAIL) pS++;
      for (k = pS; k < pE; k++) {
        i = k % PCAP; age = T - PT[i]; fv = fade(age); a = PA[i]; if (a * fv < 0.02) continue;
        px = PX[i]; py = PY[i]; r = PR[i];
        for (ri = 0; ri < rows.length; ri++) {
          row = rows[ri]; R = r + row.reach;
          if (py + R < row.y || py - R > row.y + row.h) continue;
          for (j = 0; j < row.items.length; j++) {
            it = row.items[j]; if (it.hidden) continue;
            sx = it.x - row.off;
            if (sx + it.qw < px - R || sx > px + R) continue;
            if (!it.left) metrics(row, it);
            touch(row, it, px, py, r, a, PT[i], fv, T);
          }
        }
      }
    }

    // ---------------------------------------------------------------- блуждающий свет
    // центр C плавно тянется к последней позиции указателя (сила растёт с близостью, есть инерция и трение),
    // вокруг C свет ходит по фигуре Лиссажу; вблизи указателя размах сжимается до ~50 px и огонёк кружит у самого пальца/курсора.
    var wph = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], wan = { on: false, x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, k: 0, s: 0, rr: WR0, lx: 0, ly: 0, lt: 0, has: false };
    var wc = { x: 0, y: 0, vx: 0, vy: 0, w: 0, t: 0 }, wp = { x: 0, y: 0 };
    function wpath(dt, reset) {
      var top = topY + 20, x0 = vw / 2, y0 = (top + vh) / 2, ax = vw * 0.34, ay = (vh - top) * 0.32, dx = 0, dy = 0, dd = 1e9, f, wt, p = 0, sx, sy;
      if (reset) { wc.x = x0; wc.y = y0; wc.vx = wc.vy = 0; wc.w = 0; wc.t = wph[0] * 3; }
      if (ptr.has) { dx = ptr.x - wc.x; dy = ptr.y - wc.y; dd = Math.sqrt(dx * dx + dy * dy); }
      wt = ptr.has && !ptr.gone ? 1 : 0;
      wc.w = wc.w < wt ? Math.min(wt, wc.w + dt / 1.5) : Math.max(wt, wc.w - dt / 2);
      f = ptr.has && dd > 0.5 ? wc.w * MAGNET / (0.3 + dd / 300) * Math.min(1, dd / 24) : 0;
      if (dt > 0) {
        var kb = (1 - wc.w) * 0.35, fx = (dd > 0.5 ? dx / dd * f : 0) + kb * (x0 - wc.x), fy = (dd > 0.5 ? dy / dd * f : 0) + kb * (y0 - wc.y);
        wc.vx += (fx - 1.6 * wc.vx) * dt; wc.vy += (fy - 1.6 * wc.vy) * dt; wc.x += wc.vx * dt; wc.y += wc.vy * dt;
      }
      if (ptr.has) p = sm(Math.max(0, 1 - dd / 230)) * wc.w;
      wc.t += dt * (1 + 1.2 * p);
      sx = ax + (WORBIT - ax) * p; sy = ay + (WORBIT - ay) * p;
      wp.x = wc.x + sx * Math.sin(wc.t * 0.21 + wph[0]) + sx * 0.35 * Math.sin(wc.t * 0.53 + wph[1]);
      wp.y = wc.y + sy * Math.sin(wc.t * 0.17 + wph[2]) + sy * 0.35 * Math.sin(wc.t * 0.41 + wph[3]);
      return wp;
    }
    // «дистанция» света: 0 — вплотную, 1 — далеко; четыре синуса с несоизмеримыми периодами
    function wdist(t) {
      var a = Math.sin(t * 6.2832 / WPER[0] + wph[4]) + 0.85 * Math.sin(t * 6.2832 / WPER[1] + wph[5]) + 0.7 * Math.sin(t * 6.2832 / WPER[2] + wph[6]) + 0.55 * Math.sin(t * 6.2832 / WPER[3] + wph[7]);
      a = 0.5 + a / 4.2; return a < 0 ? 0 : a > 1 ? 1 : a;
    }
    // огибающая «растворения»: когда оба медленных синуса внизу, свет почти гаснет на несколько секунд
    function wvanish(t) {
      var v = 0.5 + 0.25 * Math.sin(t * 6.2832 / WVAN[0] + wph[8]) + 0.25 * Math.sin(t * 6.2832 / WVAN[1] + wph[9]);
      v = (v - 0.12) / 0.25; return v <= 0 ? 0 : v >= 1 ? 1 : sm(v);
    }
    function stepWan(dt, T) {
      var p, j, k, z, near, h, n, ax, ay;
      if (!calm && !wan.on && wan.k <= 0 && !g && clk - lastAct > IDLE) {
        j = 0;
        do { for (k = 0; k < wph.length; k++) wph[k] = rnd(0, 6.283); } while (wvanish(clk / 1000) < 0.7 && ++j < 30);   // не стартуем в фазе «растворения»
        p = wpath(0, true); wan.on = true; lastWI = clk - WIGNITE + 4000; wan.x = wan.tx = p.x; wan.y = wan.ty = p.y; wan.vx = wan.vy = 0; wan.k = 0; wan.has = false;
      }
      if (wan.on) { p = wpath(dt, false); wan.tx = p.x; wan.ty = p.y; wan.k = Math.min(1, wan.k + dt * 1000 / 2600); }
      else if (wan.k > 0) wan.k = Math.max(0, wan.k - dt * 1000 / 700);
      if (!wan.on && wan.k <= 0) { wan.s = 0; return; }
      z = wdist(clk / 1000); near = 1 - z;
      wan.rr = WR0 + (WR1 - WR0) * sm(z);                                             // приближается: меньше; удаляется: больше
      wan.s = (WS_FAR + (WS_NEAR - WS_FAR) * sm(near)) * wvanish(clk / 1000) * sm(wan.k);   // вблизи ярче, вдали тусклее
      n = dt > 0.025 ? 2 : 1; h = dt / n;
      while (n--) {
        ax = OM * OM * (wan.tx - wan.x) - 2 * OM * wan.vx; ay = OM * OM * (wan.ty - wan.y) - 2 * OM * wan.vy;
        wan.vx += ax * h; wan.vy += ay * h; wan.x += wan.vx * h; wan.y += wan.vy * h;
      }
      // редко: блуждающий свет задевает вопрос, и тот медленно зажигается целиком
      if (wan.on && !calm && wan.s > 0.4 && clk - lastWI > WIGNITE && Math.random() < dt * 0.35 && hitAt(wan.x, wan.y, 2) && !hIt.ls && wan.x > vw * 0.08 && litVis0(hRow, hIt)) {
        ignite(hRow, hIt, wan.x - (hIt.x - hRow.off), SLOW, T); lastWI = clk;
      }
      if (wan.s > 0.02 && (!wan.has || Math.abs(wan.x - wan.lx) + Math.abs(wan.y - wan.ly) >= 5 || T - wan.lt > 100)) {
        addPoint(wan.x, wan.y, wan.rr, wan.s, T); wan.lx = wan.x; wan.ly = wan.y; wan.lt = T; wan.has = true;
      }
    }
    function litVis0(row, it) { return foOf(row, it) > 0.6; }   // вопрос, который вот-вот уйдёт, блуждающим светом не зажигаем
    function poke() { lastAct = clk; wan.on = false; }

    // ---------------------------------------------------------------- кадр
    function step(dt, T) {
      var k, row;
      if (!calm && !frozen) for (k = 0; k < rows.length; k++) { row = rows[k]; row.off += row.v * dt; maintain(row); }
      // точка под неподвижным курсором мыши (пока он не простоял IDLE) держится на постоянной силе; палец точек не ставит
      if ((hoverOn || (g && g.type !== 'touch')) && clk - lastAct < IDLE && headSeq >= pS && headSeq < pE) PT[headSeq % PCAP] = T - HOVAGE;
      stepWan(dt, T);
      mkBudget = 3;
      sample(T);
    }
    function draw(dt, T) {
      var ku = calm ? 1 : 1 - Math.exp(-dt * 1000 / ATTACK), k, j, i, row, it, sx, lo, hi, mid, gd, tgt, tl, s, al, anyHot = false, gx, hasHot, n, lit, fo, R, u, v, d, wide, lx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, vw, vh);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      for (k = 0; k < rows.length; k++) {
        row = rows[k];
        for (j = 0; j < row.items.length; j++) {
          it = row.items[j]; sx = it.x - row.off;
          if (sx > vw + PADX + 200 || sx + it.w + PADX < 0) continue;
          if (!it.sp) { prep(row, it, sx < vw + PADX); if (!it.sp) continue; }
          if (it.hidden || sx > vw + PADX) continue;
          ctx.globalAlpha = row.a * (it.rd ? READ_K : 1);
          ctx.drawImage(it.sp, sx - PADX, row.y - PADB, it.spW, it.spH);
        }
        // засвеченные буквы: резкие, светлые, чуть крупнее; прозрачность и размер — от силы света в букве
        hasHot = false;
        for (j = 0; j < row.items.length; j++) { it = row.items[j]; if ((it.hot || it.ls) && !it.hidden) { hasHot = true; break; } }
        if (!hasHot) continue;
        ctx.font = row.font; ctx.fillStyle = LIT;
        for (j = 0; j < row.items.length; j++) {
          it = row.items[j];
          if (!(it.hot || it.ls) || it.hidden) continue;
          if (it.hot && T > it.hot) { it.gI = it.gT = null; it.hot = 0; }
          if (!it.hot && !it.ls) { it.gD = null; continue; }
          if (!it.left) metrics(row, it);
          sx = it.x - row.off; n = it.text.length;
          if (sx > vw + 24 || sx + it.qw < -24) { if (it.hot) anyHot = true; continue; }
          if (!it.gD) allocD(it);
          lit = it.ls > 0; fo = 1; R = 0;
          if (lit) {
            fo = foOf(row, it); u = (T - it.ls) / it.ldur; u = u <= 0 ? 0 : u >= 1 ? 1 : u;
            R = (it.lfar + it.lsoft) * u; if (u < 1 || (fo > 0 && T - it.ls < it.ldur + 400)) anyHot = true;
          }
          if (it.hot) anyHot = true;
          lo = 0; hi = n - 1;
          while (lo < hi) { mid = (lo + hi) >> 1; if (it.left[mid] + it.cw[mid] < -sx - 24) lo = mid + 1; else hi = mid; }
          for (i = lo; i < n && sx + it.left[i] < vw + 24; i++) {
            tgt = it.gI && it.gI[i] > 0 ? it.gI[i] * fade(T - it.gT[i]) : 0;
            if (lit && fo > 0) {
              lx = it.left[i] + it.cw[i] * 0.5; d = lx - it.lox; if (d < 0) d = -d;
              v = (R - d) / it.lsoft;
              if (v > 0) { tl = (v >= 1 ? 1 : sm(v)) * fo; if (tl > tgt) tgt = tl; }
            }
            gd = it.gD[i];
            if (tgt > gd) gd += (tgt - gd) * ku; else gd = tgt;
            it.gD[i] = gd;
            if (gd < 0.012 || it.text.charAt(i) === ' ') continue;
            al = sm(gd > 1 ? 1 : gd) * (it.rd ? READ_K : 1); s = 1 + LIT_SC * gd;
            ctx.globalAlpha = al;
            gx = sx + it.left[i] + it.cw[i] * 0.5;
            ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * gx, dpr * row.gcy);
            ctx.fillText(it.text.charAt(i), -it.cw[i] * 0.5, row.base - row.gcy);
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }
      ctx.globalAlpha = 1;
      return anyHot;
    }
    function needFrame() { return !calm || g || hoverOn || pE > pS || wan.on || wan.k > 0 || anyHotFlag; }
    var anyHotFlag = false;
    function frame(now) {
      raf = 0;
      if (!active || paused || document.hidden) return;
      var dt = Math.min(0.05, (now - last) / 1000), T = performance.now(); last = now; clk += dt * 1000;
      step(dt, T); anyHotFlag = draw(dt, T);
      if (needFrame()) raf = requestAnimationFrame(frame);
    }
    function start() { if (raf || !active || paused || document.hidden) return; last = performance.now(); raf = requestAnimationFrame(frame); }
    function halt() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    // keepLit: засвеченные вопросы остаются (ответ открылся — лента стоит и потом едет дальше); иначе гасим всё
    function wipe(keepLit) {
      pS = pE = 0; headSeq = -1; lp.ok = false; wan.on = false; wan.k = wan.s = 0; anyHotFlag = false;
      for (var k = 0; k < rows.length; k++) for (var j = 0; j < rows[k].items.length; j++) {
        var it = rows[k].items[j]; it.gI = it.gT = null; it.hot = 0;
        if (!keepLit) it.ls = 0;
        if (!it.ls) it.gD = null;
      }
    }

    // ---------------------------------------------------------------- проверка раскладки
    // полосы строк не должны пересекаться; вопросы на экране не повторяются; строки не заходят под иконки и за край
    function check() {
      var o = 0, k, j, a, b, minGap = 1e9, out = 0, inZ = 0, dup = 0, seen = {}, fs = [], vs = [], it, sx, vis = 0;
      for (k = 0; k < rows.length; k++) {
        a = rows[k]; fs.push(a.fs); vs.push(a.v);
        if (a.y < topY - 0.5) inZ++;
        if (a.y < 0 || a.y + a.h > vh) out++;
        for (j = k + 1; j < rows.length; j++) {
          b = rows[j];
          if (a.y < b.y + b.h && a.y + a.h > b.y) o++;
        }
        if (k + 1 < rows.length) minGap = Math.min(minGap, rows[k + 1].y - (a.y + a.h));
        for (j = 0; j < a.items.length; j++) {
          it = a.items[j]; sx = it.x - a.off;
          if (sx + it.qw > 0 && sx < vw) { vis++; if (seen[it.q]) dup++; seen[it.q] = 1; }
        }
      }
      return { rows: rows.length, overlaps: o, minGap: rows.length > 1 ? Math.round(minGap * 10) / 10 : 0, inZone: inZ, outside: out, dupes: dup, visibleQuestions: vis,
        fsMin: Math.min.apply(null, fs), fsMax: Math.max.apply(null, fs), vMin: Math.round(Math.min.apply(null, vs) * 10) / 10, vMax: Math.round(Math.max.apply(null, vs) * 10) / 10,
        top: topY, W: vw, H: vh };
    }
    window.VoicesZen.lightCheck = check;

    // ---------------------------------------------------------------- жесты
    var sr = null;   // прямоугольник сцены на время жеста (одно чтение на событие, а не на каждую коалесцированную точку)
    function pt(e) { var r = sr || scene.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    // узел-источник для полёта: невидимый текст вопроса там же, где он на canvas (левый край вопроса, базовая линия строки)
    function placeProxy(row, it) {
      var st = proxy.style;
      proxy.textContent = it.text;
      st.fontSize = row.fs + 'px'; st.left = '0px'; st.top = '0px';
      return { x: it.x - row.off, y: row.base - BO * row.fs };
    }
    function openItem(c) {
      var row = c.row, it = c.it; if (!it || it.hidden || row.items.indexOf(it) < 0) return;
      var p = placeProxy(row, it);
      api.open(it.q, proxy, { x: p.x, y: p.y, scale: 1 + LIT_SC, opacity: it.rd ? READ_K : 1 });
    }
    function locate(q) {
      for (var k = 0; k < rows.length; k++) for (var j = 0; j < rows[k].items.length; j++) if (rows[k].items[j].q === q) return { row: rows[k], it: rows[k].items[j] };
      return null;
    }
    // конец жеста: up, cancel, потеря захвата, уход со страницы. Тап открывает ответ только на уже засвеченный вопрос
    function endGesture(cancel, e) {
      if (!g) return;
      var gg = g, T = performance.now(); g = null;
      if (e) { try { scene.releasePointerCapture(e.pointerId); } catch (x) {} }
      poke();
      var hover = gg.type === 'mouse' || gg.type === 'pen';
      if (hover && !cancel) hoverOn = true; else { hoverOn = false; lp.ok = false; }   // мышь ведёт мягкий свет и дальше
      if (cancel || gg.dead) return;
      if (!gg.moved && T - gg.t < TAPMS && gg.it && gg.row.items.indexOf(gg.it) >= 0 && litVis(gg.row, gg.it)) openItem({ row: gg.row, it: gg.it });
    }
    function onDown(e) {
      if (!active || paused) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var T = performance.now();
      if (g) { if (T - g.last < STALE) return; endGesture(true, null); }   // прежний жест потерян (pointerup не пришёл): начинаем заново
      var dead = api.popDown(), p;
      sr = scene.getBoundingClientRect(); p = pt(e);
      try { scene.setPointerCapture(e.pointerId); } catch (x) {}
      poke(); ptr.x = p.x; ptr.y = p.y; ptr.has = true; ptr.gone = false;
      g = { id: e.pointerId, type: e.pointerType, x0: p.x, y0: p.y, x: p.x, y: p.y, t: T, last: T, moved: false, dead: dead, row: null, it: null };
      if (!dead && hitAt(p.x, p.y, TOLY)) {
        if (litVis(hRow, hIt)) { g.row = hRow; g.it = hIt; }                      // уже засвечен: тап откроет ответ
        else if (!hIt.ls) ignite(hRow, hIt, p.x - (hIt.x - hRow.off), 1, T);       // тёмный: первое касание только зажигает
      }
      if (e.pointerType !== 'touch') strokeTo(p.x, p.y, T);
      start();
    }
    function onMove(e) {
      if (!active || paused) return;
      var T = performance.now();
      if (g) { if (e.pointerId !== g.id) return; g.last = T; }
      else if (e.pointerType === 'touch' || e.pointerType === '') return;   // палец без касания событий не шлёт; мышь и перо водят мягкий свет и без нажатия
      var list = e.getCoalescedEvents ? e.getCoalescedEvents() : null, k, p, mouse = e.pointerType !== 'touch';
      if (!list || !list.length) list = [e];
      sr = scene.getBoundingClientRect();
      for (k = 0; k < list.length; k++) {
        p = pt(list[k]);
        if (g) {
          if (!g.moved && Math.sqrt(Math.pow(p.x - g.x0, 2) + Math.pow(p.y - g.y0, 2)) > DRAG) g.moved = true;
          if (!g.dead) lightPath(g.x, g.y, p.x, p.y, T);
          g.x = p.x; g.y = p.y;
        }
        ptr.x = p.x; ptr.y = p.y;
        if (mouse) strokeTo(p.x, p.y, T);
      }
      poke(); ptr.has = true; ptr.gone = false;
      if (!g) hoverOn = true;
      start();
    }
    function onUp(e) { if (g && e.pointerId === g.id) endGesture(e.type === 'pointercancel', e); }
    scene.addEventListener('pointerdown', onDown);
    scene.addEventListener('pointermove', onMove);
    scene.addEventListener('pointerup', onUp);
    scene.addEventListener('pointercancel', onUp);
    // iOS: системный жест или потеря захвата иногда обрывают касание без pointerup — не оставляем жест висеть
    scene.addEventListener('lostpointercapture', function (e) { if (g && e.pointerId === g.id) endGesture(true, null); });
    window.addEventListener('blur', function () { if (g) endGesture(true, null); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && g) endGesture(true, null); });
    // на iOS touch-action:none надёжнее подкрепить отменой touchstart/touchmove (иначе Safari может увести палец в прокрутку/жест и прислать pointercancel)
    function stopTouch(e) { if (e.cancelable) e.preventDefault(); }
    scene.addEventListener('touchstart', stopTouch, { passive: false });
    scene.addEventListener('touchmove', stopTouch, { passive: false });
    scene.addEventListener('pointerleave', function (e) { if (!g && (e.pointerType === 'mouse' || e.pointerType === 'pen')) { hoverOn = false; lp.ok = false; ptr.gone = true; } });
    scene.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // вопрос q обязан быть на экране (вход по ссылке, возврат по «назад»): ставим его в строку ближе к середине, остальную ленту достраиваем вокруг
    function ensure(q) {
      var c = locate(q), k, row, best = null, bd = 1e9, it, x0;
      if (c) { var sx = c.it.x - c.row.off; if (sx + c.it.qw > 0 && sx < vw) return c; }
      if (!rows.length) return null;
      for (k = 0; k < rows.length; k++) { var d = Math.abs(rows[k].y + rows[k].h / 2 - vh * 0.45); if (d < bd && rows[k].fs >= 15) { bd = d; best = rows[k]; } }
      row = best || rows[Math.floor(rows.length / 2)];
      if (c) { var ix = c.row.items.indexOf(c.it); if (ix >= 0) c.row.items.splice(ix, 1); }
      it = mkItem(row, q); if (it.qw > MAXQW) return null;
      x0 = Math.max(14, (vw - it.qw) / 2);
      it.x = row.off + x0; row.items = [it];
      maintain(row); fillLeft(row);
      prep(row, it, true);
      return { row: row, it: it };
    }
    function relight() {
      if (relitQ < 0) return;
      var c = locate(relitQ); relitQ = -1;
      if (c) igniteFull(c.row, c.it);
    }
    function unfreeze() { frozen = false; if (holdT) { clearTimeout(holdT); holdT = 0; } }

    return {
      enter: function (o) {
        active = true; paused = false; frozen = false;
        FF = (getComputedStyle(document.documentElement).getPropertyValue('--f-serif') || '').trim() || 'Georgia, serif';
        clk = 0; lastAct = 0; openQ = -1; relitQ = -1; g = null; hoverOn = false; ptr.has = false; ptr.gone = false;
        size(); layout(); wipe();
        if (o.q >= 0) ensure(o.q);
        start();
        // шрифт PT Serif мог не успеть загрузиться: тогда ширины измерены по запасному — пересобираем один раз
        try {
          if (document.fonts && document.fonts.check && !document.fonts.check('400 20px ' + FF)) {
            document.fonts.load('400 20px ' + FF).then(function () {
              if (!active || openQ >= 0 || g) return;
              measureBO(); layout(); wipe(); start();
            }, function () {});
          }
        } catch (e) {}
      },
      leave: function () {
        active = false; halt(); timers.forEach(clearTimeout); timers = []; g = null; hoverOn = false; unfreeze(); wipe();
      },
      pause: function () { paused = true; halt(); },
      // хост зовёт resume в начале полёта заголовка назад; строки стоят, пока заголовок не сел на место (onClosed), страховка — 1.6 с
      resume: function () {
        paused = false; lastAct = clk;
        if (frozen && !holdT) holdT = setTimeout(function () { holdT = 0; frozen = false; var c = openQ >= 0 ? locate(openQ) : null; if (c) c.it.hidden = false; openQ = -1; relight(); }, 1600);
        start();
      },
      resize: function () { if (!active) return; size(); layout(); wipe(); if (openQ >= 0) ensure(openQ); start(); },
      // тема или авторы сменились: ленты собираются заново из подходящих вопросов
      refresh: function () { layout(); wipe(); if (openQ >= 0) { var c = ensure(openQ); if (c) { igniteFull(c.row, c.it); c.it.hidden = true; } } start(); },
      focus: function (q) { ensure(q); },
      // ответы открылись: строки встают, вопрос-источник скрыт (его заменяет летящая копия), лист гаснет; засвеченные вопросы остаются засвеченными
      onOpened: function (q) {
        var c = ensure(q);
        g = null; hoverOn = false; openQ = q; relitQ = q; frozen = true; wipe(true);
        if (c) { igniteFull(c.row, c.it); c.it.hidden = true; c.it.rd = true; }
      },
      // заголовок вернулся на место: вопрос снова виден и остаётся засвеченным
      onClosed: function (q) {
        var c = locate(q); openQ = -1; unfreeze();
        if (c) c.it.hidden = false;
        if (!paused) relight();
        lastAct = clk; start();
      },
      returnTarget: function (q) {
        var c = locate(q); if (!c) return null;
        var p = placeProxy(c.row, c.it);
        return { el: proxy, x: p.x, y: p.y, scale: 1 + LIT_SC, opacity: READ_K };
      },
      key: function (e) {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        if (e.target.tagName === 'BUTTON') return;
        e.preventDefault(); if (e.repeat) return;
        poke();
        var k, j, row, it, sx, best = null, near = null, nd = 1e9, dx, dy;
        for (k = 0; k < rows.length; k++) {
          row = rows[k];
          for (j = 0; j < row.items.length; j++) {
            it = row.items[j]; sx = it.x - row.off;
            if (it.hidden || sx + it.qw < 0 || sx > vw) continue;
            if (litVis(row, it)) { best = { row: row, it: it }; break; }
            dx = Math.max(sx - vw / 2, 0, vw / 2 - (sx + it.qw)); dy = Math.abs(row.y + row.h / 2 - vh / 2);
            if (dx * dx + dy * dy < nd) { nd = dx * dx + dy * dy; near = { row: row, it: it }; }
          }
          if (best) break;
        }
        if (best) openItem(best);
        else if (near) { ignite(near.row, near.it, Math.max(0, Math.min(near.it.qw, vw / 2 - (near.it.x - near.row.off))), 1, performance.now()); start(); }   // Enter зажигает ближайший к центру, второй Enter открывает
      }
    };
  });
})();
