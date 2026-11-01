/* «Голоса_», Zen: режим «Свой». Лёгкая игра без правил: внизу панель из пяти бегунков, трёх тумблеров и пяти точек-пресетов, все значки без подписей.
   Что именно меняет каждый бегунок, игрок разгадывает руками: вопросы на фоне откликаются сразу и крупно.
   Бегунки (0..1): плотность, движение, порядок, видимость, палец. Тумблеры: шрифт, направление, след. Всё рисует один canvas.
   Модель: у каждого вопроса три целевые позы — лента (строки едут справа налево), облако (дом + малая орбита), вихрь (спираль вокруг центра, наклоны);
   «порядок» смешивает их весами, «движение» задаёт скорость всех трёх, «направление» меняет знак скорости через ноль. Палец — пружинное смещение поверх позы.
   Регистрируется в хосте (zen.js). ES5, без библиотек. */
(function () {
  'use strict';
  if (!window.VoicesZen) return;

  window.VoicesZen.register('custom', function (api, scene) {
    var el = api.el, calm = api.calm;
    var K_VALS = 'voices-zen-custom', K_SEEN = 'voices-zen-custom-seen';

    // ---- константы
    var LV = 22;                      // уровней плотности: на каждом своя раскладка (кегль и число вопросов)
    var FS_HI = 34, FS_LO = 12;       // кегль при плотности 0 / 1, px (мобильный экран)
    var N_LO = 5, N_HI = 60;          // число вопросов при плотности 0 / 1 (мобильный экран)
    var NCAP = 160, XCAP = 60;                   // потолок числа вопросов на любом экране
    var MONO_K = 0.85;                // моно прописные мельче на 15%
    var MAXEM = 17;                   // ширина строки не больше стольких кеглей (и не шире экрана)
    var SMOOTH = 0.09;                // постоянная сглаживания бегунков, с (95% за ~0.27 с)
    var POS_TAU = 0.14;               // постоянная скольжения вопроса к целевой позе, с
    var PADW = 24;                    // запас за краем экрана, где лента переносит вопрос
    var DIM = [232, 214, 184];        // тусклые буквы (как в «На просвет»)
    var DIM_A = 0.15;                 // непрозрачность текста в спрайте до размытия
    var READ_K = 0.55;                // прочитанный вопрос тусклее
    var LR = 56;                      // радиус света у пальца, px
    var TAIL = 1500, PSTEP = 7, PCAP = 320;   // след света: время затухания, шаг точек, ёмкость кольца
    var OPEN_AT = 0.35;               // слово считается засвеченным при такой яркости
    var IDLE = 6000;                  // через 6 с тишины при высокой видимости свет блуждает
    var TRN = 3, TRDT = 110;           // след движения: прошлых поз и шаг их записи, мс
    var SEC_PERIOD = 12000;           // секрет: смена вопроса, мс
    var ZERO = 0.02;                  // «все бегунки в нуле»

    // пять пресетов: [плотность, движение, порядок, видимость, палец], [шрифт, направление, след]. Названия только здесь.
    var PRESETS = [
      { name: 'тишина-порядок', v: [0.22, 0, 0, 0, 0.5],        s: [0, 0, 0] },
      { name: 'звёздное облако', v: [0.78, 0.5, 0.5, 0.35, 0.62], s: [1, 0, 0] },
      { name: 'поток строк',     v: [0.62, 0.8, 0, 0, 0.5],      s: [0, 0, 1] },
      { name: 'на просвет',      v: [0.5, 0.32, 0, 1, 0.5],      s: [0, 0, 0] },
      { name: 'вихрь',           v: [0.5, 0.85, 1, 0.1, 0.22],   s: [0, 1, 1] }
    ];
    var SLIDERS = [
      { k: 'den', label: 'Плотность: от нескольких крупных вопросов к множеству мелких',
        ico: '<g fill="currentColor"><circle cx="5" cy="5" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="19" cy="5" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="19" r="1.5"/><circle cx="12" cy="19" r="1.5"/><circle cx="19" cy="19" r="1.5"/></g>' },
      { k: 'mov', label: 'Движение: от неподвижных вопросов к потоку',
        ico: '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 9c3-3.4 6 3.4 9 0s6 3.4 9 0"/><path d="M3 15c3-3.4 6 3.4 9 0s6 3.4 9 0"/></g>' },
      { k: 'ord', label: 'Порядок: от ровных строк через облако к хаосу и вихрю',
        ico: '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 6h11"/><path d="M4 12h16"/><path d="M5 20l13-5"/></g>' },
      { k: 'vis', label: 'Видимость: от видимых всегда к проступающим только под пальцем',
        ico: '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8" fill="currentColor" stroke="none"/></g>' },
      { k: 'fing', label: 'Палец: от разбегания вопросов через ничего к притяжению',
        ico: '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M12 2.8v4M12 17.2v4M2.8 12h4M17.2 12h4"/></g>' }
    ];
    var SWITCHES = [
      { label: 'Шрифт: курсив с засечками или прописные моно',
        ico: '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 19L12 5l6.5 14M8.2 14h7.6"/></g>' },
      { label: 'Направление: поток и вихрь в обратную сторону',
        ico: '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/></g>' },
      { label: 'След: вопросы оставляют затухающий след движения',
        ico: '<g fill="currentColor"><circle cx="19" cy="12" r="2.6"/><circle cx="12.5" cy="12" r="2" opacity=".6"/><circle cx="7.5" cy="12" r="1.4" opacity=".4"/><circle cx="4" cy="12" r=".9" opacity=".25"/></g>' }
    ];
    var ICO_PANEL = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="9" width="16" height="11" rx="2"/><path d="M10 12.5h4"/></g></svg>';
    function svg(inner) { return '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' + inner + '</svg>'; }

    // ---- слои сцены: один canvas, панель настроек, невидимый узел-источник для полёта заголовка (FLIP)
    var cv = el('canvas', 'zu-cv'), ctx = cv.getContext('2d'), proxy = el('div', 'zu-k');
    scene.appendChild(cv); scene.appendChild(proxy);

    var vw = 0, vh = 0, dpr = 1, safe = { t: 0, r: 0, b: 0, l: 0 }, topY = 70, MX = 14, AW = 340, AH = 600, MB = 14, areaK = 1, fsK = 1, nMax = 60;
    var FF = 'Georgia, serif', FM = 'monospace', BO = [1, 1], LITC = '#f7f0e2', mc = null;
    var active = false, paused = false, raf = 0, last = 0, clk = 0, timers = [], frozen = false, holdT = 0, quiet = 0, busy = true;

    // ---- значения
    var V = [0.5, 0.5, 0.5, 0, 0.5], S = V.slice(), SW = [0, 0, 0], tw = null;
    var fc = 1, oldLay = null, dirS = 1, trK = 0, vortT = 0, cph = 0;
    var secS = 0, sec = { q: -1, lines: null, W: 0, H: 0, fs: 0, t: 0, env: 0, hid: false, rd: false, font: '', lastQ: -1 };
    var items = [], LC = {}, lay = null, curLv = -1, D = new Float64Array(256), openQ = -1, relitQ = -1, hoverOn = false, g = null, ptr = { x: 0, y: 0, has: false }, lastAct = 0;
    var NOK = -99999, WC0 = {}, WC1 = {};
    var panel, btnP = null, rngs = [], sws = [], dots = [], panelOn = false, dotOn = -1, saveT = 0;

    function later(fn, ms) { var t = setTimeout(function () { var k = timers.indexOf(t); if (k >= 0) timers.splice(k, 1); fn(); }, ms); timers.push(t); return t; }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function sm(x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); }
    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
    function qtext(q) { return api.data().questions[q].q; }
    function wake() { quiet = 0; if (!raf && active && !paused && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    // ---------------------------------------------------------------- сохранение
    function loadVals() {
      var o = api.load(K_VALS, null), k;
      if (!o || typeof o !== 'object') return;
      if (o.v && o.v.length === 5) for (k = 0; k < 5; k++) if (typeof o.v[k] === 'number' && isFinite(o.v[k])) V[k] = clamp(o.v[k], 0, 1);
      if (o.s && o.s.length === 3) for (k = 0; k < 3; k++) SW[k] = o.s[k] ? 1 : 0;
    }
    function saveNow() { if (saveT) { clearTimeout(saveT); saveT = 0; } api.save(K_VALS, { v: V.map(function (x) { return Math.round(x * 1000) / 1000; }), s: SW.slice() }); }
    function saveSoon() { if (saveT) clearTimeout(saveT); saveT = setTimeout(function () { saveT = 0; saveNow(); }, 400); }

    // ---------------------------------------------------------------- размеры
    function probeSafe() {
      var p = el('i'); p.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      scene.appendChild(p); var cs = getComputedStyle(p);
      safe = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
      scene.removeChild(p);
    }
    // смещение базовой линии от верха строки при line-height 1.25 (доли кегля) для каждого из двух шрифтов: по нему узел-источник совпадает с буквами на canvas
    function measureBO() {
      var fam = [FF, FM], st = ['italic', 'normal'], k;
      for (k = 0; k < 2; k++) {
        var d = el('div'), m = el('span');
        d.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:pre;pointer-events:none;line-height:1.25;font-size:100px;font-style:' + st[k] + ';font-family:' + fam[k];
        m.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
        d.textContent = 'Ag'; d.appendChild(m); scene.appendChild(d);
        var b = m.getBoundingClientRect().top - d.getBoundingClientRect().top; scene.removeChild(d);
        BO[k] = b > 0 ? b / 100 : 1.0;
      }
    }
    function size() {
      vw = scene.clientWidth || window.innerWidth; vh = scene.clientHeight || window.innerHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
      cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      probeSafe(); measureBO();
      var tl = scene.parentNode && scene.parentNode.querySelector ? scene.parentNode.querySelector('.zt') : null, sr = scene.getBoundingClientRect(), zb = 0;
      if (tl) { var r = tl.getBoundingClientRect(); zb = r.bottom - sr.top; }
      if (!(zb > 20)) zb = safe.t + 50;
      topY = Math.round(zb + 4);
      MX = 14 + Math.max(safe.l, safe.r); MB = 14 + safe.b;
      AW = vw - 2 * MX; AH = vh - topY - MB;
      var ar = Math.max(0.3, vw * vh / 304500);
      areaK = Math.pow(ar, 0.85); fsK = clamp(Math.pow(ar, 0.25), 0.9, 1.35);
      nMax = Math.min(NCAP, Math.round(N_HI * areaK));
    }

    // ---------------------------------------------------------------- метрики слов, перенос строк
    function fontOf(fk, px) { return fk ? '400 ' + px + 'px ' + FM : 'italic 400 ' + px + 'px ' + FF; }
    function wordW(fk, w) {
      var m = fk ? WC1 : WC0, v = m[w];
      if (v === undefined) { mc.font = fontOf(fk, 100); v = m[w] = mc.measureText(w).width; }
      return v;
    }
    // text уже в нужном регистре; возвращает строки, слова с позициями (x в строке, номер строки, ширина), размеры блока при кегле fs
    function wrapText(text, fs, fk, maxW) {
      var k = fs / 100, sp = wordW(fk, ' ') * k, parts = text.split(' '), lines = [], words = [], cur = '', curW = 0, line = 0, i, w, p, best = 0;
      for (i = 0; i < parts.length; i++) {
        p = parts[i]; if (!p) continue;
        w = wordW(fk, p) * k;
        if (cur && curW + sp + w > maxW) { lines.push(cur); if (curW > best) best = curW; cur = ''; curW = 0; line++; }
        words.push({ t: p, x: cur ? curW + sp : 0, l: line, w: w });
        cur = cur ? cur + ' ' + p : p; curW = cur === p ? w : curW + sp + w;
      }
      lines.push(cur); if (curW > best) best = curW;
      return { lines: lines, words: words, W: Math.ceil(best) + 1, H: Math.ceil(lines.length * 1.25 * fs) };
    }

    // ---------------------------------------------------------------- вопросы
    function mkItem(q) {
      var text = qtext(q).replace(/\s+/g, ' ').trim();
      return { q: q, text: text, tU: text.toUpperCase(), px: 0, py: 0, pang: 0, ox: 0, oy: 0, vx: 0, vy: 0, al: 0, fade: 1, tx: 0, ty: 0, tang: 0, ta: 0, wk: NOK, snap: true,
        hid: false, rd: api.isRead(q), ba: rnd(0.66, 1), sp: null, spLay: null, wl: null, lit: 0, ti: 0 };
    }
    function pool() {
      var Dd = api.data(), p = [], k;
      for (k = 0; k < Dd.questions.length; k++) if (api.matches(k)) p.push(k);
      return p;
    }
    // порядок показа: короткие чаще впереди (при малой плотности на экране мало крупных, им нужно место), но с разбросом
    function rebuildPool() {
      var p = pool(), a = [], k, Dd = api.data(), seen = {}, t;
      for (k = 0; k < p.length; k++) {
        t = Dd.questions[p[k]].q.replace(/\s+/g, ' ').trim(); if (seen[t]) continue; seen[t] = 1;     // один и тот же вопрос у разных авторов показываем один раз
        a.push({ q: p[k], key: t.length * rnd(0.6, 1.4) });
      }
      a.sort(function (x, y) { return x.key - y.key; });
      items = []; for (k = 0; k < a.length && k < NCAP + XCAP + 8; k++) items.push(mkItem(a[k].q));
      if (openQ >= 0) ensure(openQ, true);
    }
    function nAt(lv) { return Math.max(1, Math.min(items.length, Math.round(N_LO * Math.pow(N_HI / N_LO, lv / (LV - 1)) * areaK), nMax)); }
    function fsAt(lv, fk) { return Math.max(7, Math.round(fsK * FS_HI * Math.pow(FS_LO / FS_HI, lv / (LV - 1)) * (fk ? MONO_K : 1))); }
    function fsCont(fk) { return fsK * FS_HI * Math.pow(FS_LO / FS_HI, S[0]) * (fk ? MONO_K : 1); }

    // ---------------------------------------------------------------- раскладки
    // Лента: блоки укладываются в строки по ширине экрана (полка), остаток высоты делится в зазоры, строки центрируются. Возвращает число уложенных.
    function packRows(L, n, order, jitter, gh, gv) {
      var rows = [], cur = null, i, j, idx, w, h, y, tot = 0, hh;
      for (i = 0; i < n; i++) {
        idx = order ? order[i] : i; w = L.W[idx]; h = L.H[idx];
        if (!cur || (cur.items.length && cur.w + gh + w > AW)) {
          hh = cur ? cur.h : 0;
          if (cur) tot += cur.h;
          if (rows.length && tot + gv * rows.length + h > AH) { cur.last = true; rows.push(null); break; }
          cur = { items: [], w: 0, h: 0 }; rows.push(cur);
        }
        cur.items.push(idx); cur.w += (cur.items.length > 1 ? gh : 0) + w; if (h > cur.h) cur.h = h;
      }
      if (rows.length && rows[rows.length - 1] === null) rows.pop();
      var placed = 0, sumH = 0; for (i = 0; i < rows.length; i++) { sumH += rows[i].h; placed += rows[i].items.length; }
      if (sumH + gv * (rows.length - 1) > AH && rows.length > 1) {          // последняя строка не влезла: снимаем её
        placed -= rows[rows.length - 1].items.length; sumH -= rows[rows.length - 1].h; rows.pop();
      }
      if (!placed) return 0;
      var nr = rows.length, slack = AH - sumH, gvE = nr > 1 ? Math.min(slack / (nr - 1), Math.max(gv, 56)) : 0, tH = sumH + gvE * (nr - 1);
      y = topY + (AH - tH) / 2;
      L.nrows = nr; L.rowL = new Float32Array(nr); L.rowSp = new Float32Array(nr); L.rowY = new Float32Array(nr); L.rowEnd = new Float32Array(nr); L.rowH = new Float32Array(nr);
      for (i = 0; i < nr; i++) {
        var r = rows[i], sw = 0, cnt = r.items.length, maxw = 0, x, sp, shares = null, ssum = 0;
        for (j = 0; j < cnt; j++) { sw += L.W[r.items[j]]; if (L.W[r.items[j]] > maxw) maxw = L.W[r.items[j]]; }
        if (jitter && cnt > 1) { shares = []; for (j = 0; j < cnt - 1; j++) { shares.push(rnd(0.15, 1)); ssum += shares[j]; } }
        sp = cnt > 1 ? (AW - sw) / (cnt - 1) : 0;
        if (!jitter) sp = Math.min(sp, 80);
        x = MX + (jitter ? 0 : (AW - sw - sp * (cnt - 1)) / 2);
        for (j = 0; j < cnt; j++) {
          idx = r.items[j];
          L.rx[idx] = x; L.ry[idx] = y + (jitter ? rnd(0, r.h - L.H[idx]) : 0); L.row[idx] = i;
          x += L.W[idx] + (jitter && shares ? (AW - sw) * (j < cnt - 1 ? shares[j] / ssum : 0) : sp);
        }
        L.rowL[i] = vw + maxw + 2 * PADW; L.rowSp[i] = rnd(0.7, 1.3); L.rowY[i] = y; L.rowH[i] = r.h; L.rowEnd[i] = L.rx[r.items[cnt - 1]] + L.W[r.items[cnt - 1]];
        y += r.h + gvE;
      }
      return placed;
    }
    // Облако: случайная рассадка с отторжением (крупные первыми) на сетке; коробки раздуты на зазор g. Возвращает число вопросов (префикс items) или 0.
    function placeCloud(L, m, g) {
      var ord = [], i, k, cw = 64, gx = Math.ceil(AW / cw) + 1, gy = Math.ceil(AH / cw) + 1, cells = new Array(gx * gy), bx = new Float32Array(m), by = new Float32Array(m), bw = new Float32Array(m), bh = new Float32Array(m);
      for (i = 0; i < m; i++) { ord.push(i); bw[i] = L.W[i] + g; bh[i] = L.H[i] + g; }
      ord.sort(function (a, b) { return bw[b] * bh[b] - bw[a] * bh[a]; });
      for (k = 0; k < m; k++) {
        var a = ord[k], ok = false, att, x, y, c0, c1, r0, r1, rr, cc, list, j, b;
        for (att = 0; att < 110 && !ok; att++) {
          x = MX - g / 2 + rnd(0, Math.max(0, AW + g - bw[a])); y = topY - g / 2 + rnd(0, Math.max(0, AH + g - bh[a]));
          c0 = Math.max(0, Math.floor((x - MX + g / 2) / cw)); c1 = Math.min(gx - 1, Math.floor((x + bw[a] - MX + g / 2) / cw));
          r0 = Math.max(0, Math.floor((y - topY + g / 2) / cw)); r1 = Math.min(gy - 1, Math.floor((y + bh[a] - topY + g / 2) / cw));
          ok = true;
          for (rr = r0; rr <= r1 && ok; rr++) for (cc = c0; cc <= c1 && ok; cc++) {
            list = cells[rr * gx + cc]; if (!list) continue;
            for (j = 0; j < list.length; j++) { b = list[j]; if (x < bx[b] + bw[b] && x + bw[a] > bx[b] && y < by[b] + bh[b] && y + bh[a] > by[b]) { ok = false; break; } }
          }
          if (ok) {
            bx[a] = x; by[a] = y;
            for (rr = r0; rr <= r1; rr++) for (cc = c0; cc <= c1; cc++) (cells[rr * gx + cc] || (cells[rr * gx + cc] = [])).push(a);
          }
        }
        if (!ok) return 0;
      }
      for (i = 0; i < m; i++) { L.cx[i] = bx[i] + g / 2; L.cy[i] = by[i] + g / 2; }
      return m;
    }
    function buildLayout(lv, fk) {
      var fs = fsAt(lv, fk), n0 = nAt(lv), n0x = Math.min(items.length, n0 + XCAP), maxW = Math.min(AW, fs * MAXEM), i, w, L = { lv: lv, fk: fk, fs: fs, font: fontOf(fk, fs), n: 0 };
      L.lines = []; L.words = []; L.W = new Float32Array(n0x); L.H = new Float32Array(n0x);
      for (i = 0; i < n0x; i++) {
        w = wrapText(fk ? items[i].tU : items[i].text, fs, fk, maxW);
        L.lines.push(w.lines); L.words.push(w.words); L.W[i] = w.W; L.H[i] = w.H;
      }
      L.rx = new Float32Array(n0x); L.ry = new Float32Array(n0x); L.row = new Int16Array(n0x); L.cx = new Float32Array(n0x); L.cy = new Float32Array(n0x);
      // облако: зазор, потом при неудаче — меньше вопросов; при нехватке места — «рваная полка» (строки с разбросом), она плотнее
      var g0 = Math.max(6, 0.55 * fs + 3), m = n0, tries = 0, nC = 0, perm, t, j2, tmp, cum = 0, lim = 0.42 * AW * AH;
      // случайная рассадка набивает не больше ~45% площади: сверх этого даже не пробуем (дорого), сразу берём префикс по площади
      for (i = 0; i < n0; i++) { cum += (L.W[i] + g0) * (L.H[i] + g0); if (cum > lim) break; }
      m = Math.max(1, Math.min(n0, i));
      while (tries < 4 && !nC) { nC = placeCloud(L, m, g0); if (!nC) { m = Math.max(1, Math.floor(m * 0.88)); tries++; } }
      if (nC < n0 * 0.92) {
        var best = nC, saveCx = L.cx.slice(), saveCy = L.cy.slice();
        var mf = packRows(L, n0, null, true, g0 * 0.8, g0 * 0.8);      // сколько первых вопросов влезает в полки при таком зазоре
        for (m = mf, t = 0; t < 10 && m > best; t++, m = Math.max(1, Math.floor(m * 0.96))) {
          perm = []; for (i = 0; i < m; i++) perm.push(i);
          for (i = m - 1; i > 0; i--) { j2 = Math.floor(Math.random() * (i + 1)); tmp = perm[i]; perm[i] = perm[j2]; perm[j2] = tmp; }
          if (packRows(L, m, perm, true, g0 * 0.8, g0 * 0.8) === m) {
            best = m; for (i = 0; i < m; i++) { saveCx[i] = L.rx[i]; saveCy[i] = L.ry[i]; }
            break;
          }
        }
        for (i = 0; i < best; i++) { L.cx[i] = saveCx[i]; L.cy[i] = saveCy[i]; }
        nC = best;
      }
      // лента: идентичный порядок, сколько влезло — столько и берём; общее число — меньшее из двух
      var nR = packRows(L, nC, null, false, Math.max(8, 0.9 * fs), Math.max(6, 0.55 * fs));
      L.n = Math.max(1, Math.min(nC, nR));
      if (!L.rowL) { L.nrows = 1; L.rowL = new Float32Array([vw * 2]); L.rowSp = new Float32Array([1]); L.rowY = new Float32Array([topY]); L.rowEnd = new Float32Array([MX]); L.rowH = new Float32Array([AH]); }
      // лента непрерывная: ряд за краем экрана продолжают «запасные» вопросы (после n), как в бегущей строке; в покое они справа за краем и не видны
      // запасной вопрос выше полосы ряда не берём (залез бы в соседний ряд): ищем ближайший подходящий по высоте
      var gh = Math.max(8, 0.9 * fs), cur = new Float64Array(L.nrows), ptr = L.n, prog = true, rr, jj, hi = L.n;
      L.xOn = new Uint8Array(n0x);
      for (rr = 0; rr < L.nrows; rr++) cur[rr] = L.rowEnd[rr] + gh;
      while (prog && ptr < n0x) {
        prog = false;
        for (rr = 0; rr < L.nrows; rr++) {
          if (cur[rr] >= L.rowL[rr]) continue;
          while (ptr < n0x && L.xOn[ptr]) ptr++;
          for (jj = ptr; jj < n0x && jj < ptr + 40; jj++) if (!L.xOn[jj] && L.H[jj] <= L.rowH[rr] + 0.5) break;
          if (jj >= n0x || jj >= ptr + 40) continue;
          L.xOn[jj] = 1; if (jj + 1 > hi) hi = jj + 1;
          L.rx[jj] = Math.max(cur[rr], vw + PADW); L.ry[jj] = L.rowY[rr]; L.row[jj] = rr; cur[rr] = L.rx[jj] + L.W[jj] + gh; prog = true;
        }
      }
      for (rr = 0; rr < L.nrows; rr++) L.rowL[rr] = Math.max(L.rowL[rr], cur[rr] + PADW);
      L.nx = hi;
      // орбита облака: не больше половины зазора до ближайшего соседа по лучшей оси, значит, соседи не сталкиваются при любом «движении» (в порядке ≤ 0.5)
      var n = L.n, amax = clamp(fs * 1.1 + 4, 6, 28), j, sep, gxx, gyy, ms;
      L.amp = new Float32Array(n);
      for (i = 0; i < n; i++) {
        ms = 1e9;
        for (j = 0; j < n; j++) {
          if (j === i) continue;
          gxx = Math.max(L.cx[j] - (L.cx[i] + L.W[i]), L.cx[i] - (L.cx[j] + L.W[j])); gyy = Math.max(L.cy[j] - (L.cy[i] + L.H[i]), L.cy[i] - (L.cy[j] + L.H[j]));
          sep = Math.max(gxx, gyy); if (sep < ms) ms = sep;
        }
        ms -= 0.05 * Math.max(L.W[i], L.H[i]) + 1;     // запас на масштаб рисования между уровнями
        L.amp[i] = ms > 1e8 ? amax : clamp(ms / 2 - 0.6, 0, amax);
      }
      // фазы орбит; вихрь: подсолнух (равномерная спираль), эллипс по экрану, наклоны текста
      L.oa = new Float32Array(n); L.ob = new Float32Array(n); L.ow = new Float32Array(n); L.ov = new Float32Array(n);
      L.chR = new Float32Array(n); L.chP = new Float32Array(n); L.chT = new Float32Array(n); L.chW = new Float32Array(n);
      for (i = 0; i < n; i++) {
        L.oa[i] = rnd(0, 6.283); L.ob[i] = rnd(0, 6.283); L.ow[i] = rnd(0.7, 1.3); L.ov[i] = rnd(0.7, 1.3) * (Math.random() < 0.5 ? -1 : 1);
        L.chR[i] = Math.sqrt((i + 0.5) / n) * rnd(0.9, 1.0); L.chP[i] = i * 2.39996 + rnd(-0.4, 0.4);
        L.chT[i] = (Math.random() < 0.5 ? -1 : 1) * rnd(0.12, 0.7); L.chW[i] = 0.55 + 1.5 * (1 - L.chR[i]);
      }
      return L;
    }
    function getLay(lv, fk) {
      var key = lv * 2 + fk, L = LC[key], cnt = 0, k;
      if (L) return L;
      for (k in LC) if (LC.hasOwnProperty(k)) cnt++;
      if (cnt > 40) LC = {};
      L = LC[key] = buildLayout(lv, fk);
      return L;
    }
    // привязка раскладки к вопросам: у кого изменился перенос строк, тот проявляется заново; спрайты и свет слов сбрасываются
    function bind(L, snap) {
      var i, it, pl = lay, same;
      lay = L;
      for (i = 0; i < items.length; i++) {
        it = items[i];
        if (i < L.nx) {
          same = pl && pl !== L && i < pl.nx && pl.fk === L.fk && pl.lines[i].length === L.lines[i].length && pl.lines[i].join('|') === L.lines[i].join('|');
          if (pl && pl !== L && !same && it.al > 0.05 && pl.fk === L.fk && !snap) it.fade = 0;
          it.wk = NOK; it.sp = null; it.spLay = null; it.wl = new Float32Array(L.words[i].length); it.lit = 0;
          if (snap) { it.snap = true; it.fade = 1; }
        }
      }
      if (snap) { oldLay = null; fc = 1; }
    }
    function relayout(snap) {
      LC = {}; if (!mc) mc = document.createElement('canvas').getContext('2d');
      if (!items.length) return;
      curLv = clamp(Math.round(S[0] * (LV - 1)), 0, LV - 1);
      bind(getLay(curLv, SW[0]), snap);
      for (var r = 0; r < D.length; r++) D[r] = 0;
    }
    function syncLevel() {
      if (!lay) return;
      var f = S[0] * (LV - 1);
      if (Math.abs(f - curLv) > 0.7) {
        curLv = clamp(Math.round(f), 0, LV - 1);
        bind(getLay(curLv, SW[0]), false);
        for (var r = 0; r < D.length; r++) D[r] = 0;
      }
    }

    // ---------------------------------------------------------------- тусклый слой: спрайт блока с запечённым размытием (shadowBlur: ctx.filter в Safari нет)
    var SPC = {}, spN = 0, spBudget = 0, SPAD = 12;
    function getSprite(it, i) {
      if (it.spLay === lay && it.sp) return it.sp;
      var key = it.q + '|' + lay.fs + '|' + lay.fk, s = SPC[key];
      if (!s) {
        if (spBudget <= 0) return null;
        spBudget--;
        if (spN > 360) { SPC = {}; spN = 0; }
        s = SPC[key] = mkSprite(lay, i); spN++;
      }
      it.sp = s; it.spLay = lay; return s;
    }
    function mkSprite(L, i) {
      var W = L.W[i] + 2 * SPAD, H = L.H[i] + 2 * SPAD, c = document.createElement('canvas'), x, off, sig = 1.5 + 0.075 * L.fs, j, ln = L.lines[i], fs = L.fs, by = SPAD + BO[L.fk] * fs;
      c.width = Math.ceil(W * dpr); c.height = Math.ceil(H * dpr);
      x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
      off = c.width + 64;
      x.font = L.font; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
      x.shadowBlur = 2 * sig * dpr; x.shadowOffsetX = off; x.shadowOffsetY = 0; x.fillStyle = '#000';
      x.shadowColor = 'rgba(' + DIM[0] + ',' + DIM[1] + ',' + DIM[2] + ',' + DIM_A + ')';
      for (j = 0; j < ln.length; j++) x.fillText(ln[j], SPAD - off / dpr, by + j * 1.25 * fs);
      c.zw = W; c.zh = H; return c;
    }

    // ---------------------------------------------------------------- свет: точки по пути пальца
    var PX = new Float32Array(PCAP), PY = new Float32Array(PCAP), PT = new Float64Array(PCAP), PS = new Float32Array(PCAP), CAND = new Int16Array(PCAP);
    var pS = 0, pE = 0, headSeq = -1, lp = { ok: false, x: 0, y: 0, t: 0 }, wan = { on: false, t: 0, lx: -99, ly: -99 };
    function addPoint(x, y, t) { if (pE - pS >= PCAP) pS++; var i = pE % PCAP; PX[i] = x; PY[i] = y; PT[i] = t; pE++; return pE - 1; }
    function strokeTo(x, y, T) {
      if (!lp.ok) { headSeq = addPoint(x, y, T); lp.ok = true; lp.x = x; lp.y = y; lp.t = T; return; }
      var dx = x - lp.x, dy = y - lp.y, d = Math.sqrt(dx * dx + dy * dy), n = Math.min(80, Math.floor(d / PSTEP)), t0 = Math.max(lp.t, T - 80), k, f;
      if (n < 1) return;
      for (k = 1; k <= n; k++) { f = k / n; headSeq = addPoint(lp.x + dx * (k * PSTEP / d), lp.y + dy * (k * PSTEP / d), t0 + (T - t0) * f); }
      lp.x += dx * (n * PSTEP / d); lp.y += dy * (n * PSTEP / d); lp.t = T;
    }
    // сила точек с учётом возраста (до размытия каждая гаснет за TAIL)
    function pointsPrep(T) {
      var k, a;
      while (pS < pE && T - PT[pS % PCAP] >= TAIL) pS++;
      for (k = pS; k < pE; k++) { a = (T - PT[k % PCAP]) / TAIL; a = a <= 0 ? 1 : a >= 1 ? 0 : 1 - a * a * (3 - 2 * a); PS[k % PCAP] = a; }
    }
    // яркость слов вопроса от ближайших точек; возвращает наибольшую
    function lightItem(it, i, cx, cy, ang, k) {
      var L = lay, W = L.W[i] * k, H = L.H[i] * k, rb = Math.sqrt(W * W + H * H) / 2 + LR, cnt = 0, p, dx, dy, ws = L.words[i], wl = it.wl, j, w, best, mx = 0, c, d, v, ca = Math.cos(ang), sa = Math.sin(ang), ux, uy, sx, sy, fs = L.fs;
      for (p = pS; p < pE; p++) { dx = PX[p % PCAP] - cx; dy = PY[p % PCAP] - cy; if (dx * dx + dy * dy < rb * rb && PS[p % PCAP] > 0.01) CAND[cnt++] = p; }
      for (j = 0; j < ws.length; j++) {
        w = ws[j]; best = 0;
        if (cnt) {
          ux = (-L.W[i] / 2 + w.x + w.w / 2) * k; uy = (-L.H[i] / 2 + (w.l * 1.25 + BO[L.fk] - 0.3) * fs) * k;
          sx = cx + ux * ca - uy * sa; sy = cy + ux * sa + uy * ca;
          for (c = 0; c < cnt; c++) {
            p = CAND[c] % PCAP; dx = PX[p] - sx; dy = PY[p] - sy; d = Math.sqrt(dx * dx + dy * dy) - 0.3 * w.w * k; if (d < 0) d = 0;
            if (d < LR) { v = PS[p] * (1 - sm(d / LR)); if (v > best) best = v; }
          }
        }
        // подъём быстрый, спад — по расписанию точек
        if (best > wl[j]) wl[j] += (best - wl[j]) * 0.5; else wl[j] = best;
        if (wl[j] > mx) mx = wl[j];
      }
      return mx;
    }

    // ---------------------------------------------------------------- секрет
    function secPick() {
      var p = pool(), k, q, t = 0, text, tries = 0, Dd = api.data();
      if (!p.length) return;
      do { q = p[Math.floor(Math.random() * p.length)]; tries++; } while ((q === sec.lastQ || Dd.questions[q].q.length > 120) && tries < 30 && p.length > 1);
      sec.q = q; sec.lastQ = q; sec.rd = api.isRead(q); text = qtext(q).replace(/\s+/g, ' ').trim();
      sec.fs = Math.round(30 * fsK); var maxW = Math.min(vw - 56, sec.fs * 14);
      var w = wrapText(text, sec.fs, 0, maxW);
      sec.lines = w.lines; sec.W = w.W; sec.H = w.H; sec.font = fontOf(0, sec.fs);
    }

    // ---------------------------------------------------------------- шаг модели
    var sp1 = 0, trLast = 0, trI = 0, TRX = null, TRY = null, TRA = null, TRV = null;
    function initTrail() { var m = (NCAP + XCAP + 8) * TRN; TRX = new Float32Array(m); TRY = new Float32Array(m); TRA = new Float32Array(m); TRV = new Uint8Array(m); }
    var WT = [1, 0, 0];
    function weights() {      // веса поз: лента, облако, вихрь (массив один, без аллокаций в кадре)
      var o = S[2], t;
      if (o <= 0.5) { t = sm(o * 2); WT[0] = 1 - t; WT[1] = t; WT[2] = 0; }
      else { t = sm((o - 0.5) * 2); WT[0] = 0; WT[1] = 1 - t; WT[2] = t; }
      return WT;
    }
    function step(dt, T) {
      var ks = 1 - Math.exp(-dt / SMOOTH), k, i, it, L = lay, n, dd;
      busy = false;
      // бегунки и тумблеры: реакция начинается сразу, значение подтягивается за ~0.25 с
      for (k = 0; k < 5; k++) {
        var tg = (k === 1 && calm) ? 0 : V[k];
        dd = tg - S[k]; if (dd > 0.0005 || dd < -0.0005) { S[k] += dd * ks; busy = true; } else S[k] = tg;
      }
      if (fc < 1) { fc = Math.min(1, fc + dt / 0.4); busy = true; if (fc >= 1) oldLay = null; }
      var dT = SW[1] ? -1 : 1; if (dirS !== dT) { dirS += clamp(dT - dirS, -dt / 0.3, dt / 0.3); busy = true; }   // разворот через ноль ~0.6 с
      var tT = SW[2] ? 1 : 0; if (trK !== tT) { trK += clamp(tT - trK, -dt / 0.3, dt / 0.3); busy = true; }
      var allZ = true; for (k = 0; k < 5; k++) if (V[k] > ZERO) allZ = false;
      var sT = allZ ? 1 : 0; if (secS !== sT) { secS += clamp(sT - secS, -dt / (sT ? 1.4 : 0.9), dt / (sT ? 1.4 : 0.9)); busy = true; }
      if (secS > 0.001) busy = true;
      syncLevel();
      L = lay; if (!L) return;
      n = L.n;
      weights(); var wR = WT[0], wC = WT[1], wH = WT[2];
      var mov = S[1], sd = frozen ? 0 : dt;
      if (mov > 0.003 && !frozen) busy = true;
      // время: лента, орбиты, вихрь
      var vRow = 90 * Math.pow(mov, 2.2), r;
      if (wR > 0.001) {
        for (r = 0; r < L.nrows; r++) {
          if (mov < 0.03) { var Lr = L.rowL[r], hm = Math.round(D[r] / Lr) * Lr; if (Math.abs(hm - D[r]) > 0.05) { D[r] += (hm - D[r]) * (1 - Math.exp(-dt * 2.2)); busy = true; } else D[r] = hm; }
          else D[r] -= dirS * vRow * L.rowSp[r] * sd;
        }
      } else for (r = 0; r < L.nrows; r++) D[r] = 0;
      cph += dirS * (0.12 + 1.15 * mov) * sd * (mov > 0.003 ? 1 : 0);
      vortT += dirS * 0.5 * Math.pow(mov, 3) * sd;
      var aOr = clamp(mov * 2, 0, 1), cX = vw / 2, cY = topY + AH / 2, aX = AW / 2 * 0.9, aY = AH / 2 * 0.92;
      var kp = 1 - Math.exp(-dt / POS_TAU), sc, ca2, tAl;
      var fing = (S[4] - 0.5) * 2, fOn = ptr.has && (fing > 0.03 || fing < -0.03), sp, dx, dy, d, ux, uy, f, des, desY, ax, ay;
      var sCalm = secS > 0.001;
      for (i = 0; i < items.length; i++) {
        it = items[i];
        if (i >= L.nx || (i >= n && !L.xOn[i])) { if (it.al > 0.004) { it.al += (0 - it.al) * kp; busy = true; } else it.al = 0; continue; }
        var W = L.W[i], H = L.H[i], xl = 0, yl = 0, ang = 0, ph, cs, sn, ext = i >= n;
        if (ext) { xl = L.rx[i] + D[L.row[i]]; yl = L.ry[i]; }       // запасной вопрос ленты: живёт только в ленте
        else if (wR > 0.0005) { xl += wR * (L.rx[i] + D[L.row[i]]); yl += wR * L.ry[i]; }
        if (ext) { /* только лента */ }
        else if (wC > 0.0005) {
          var am = L.amp[i] * aOr;
          xl += wC * (L.cx[i] + am * Math.sin(L.oa[i] + cph * L.ow[i])); yl += wC * (L.cy[i] + am * Math.sin(L.ob[i] + cph * L.ov[i]));
        }
        if (!ext && wH > 0.0005) {
          ph = L.chP[i] + vortT * L.chW[i]; cs = Math.cos(ph); sn = Math.sin(ph);
          xl += wH * (cX + aX * L.chR[i] * cs - W / 2); yl += wH * (cY + aY * L.chR[i] * sn - H / 2);
          ang = wH * (L.chT[i] + 0.25 * sn);
        }
        if (wR > 0.001 || ext) {
          var Lw = L.rowL[L.row[i]], lo = -W - PADW, kk = Math.floor((xl - lo) / Lw);
          xl -= kk * Lw;
          if (it.wk !== NOK && it.wk !== kk) it.px += (it.wk - kk) * Lw;
          it.wk = kk;
        } else it.wk = NOK;
        it.tx = xl + W / 2; it.ty = yl + H / 2; it.tang = ang;
        tAl = ext ? (1 - secS) * wR * wR * wR : (1 - secS);
        if (it.al <= 0.004) it.snap = true;       // невидимый вопрос встаёт на место сразу, без полёта через экран
        if (it.snap) { it.px = it.tx; it.py = it.ty; it.pang = ang; it.ox = it.oy = it.vx = it.vy = 0; it.al = 0; it.snap = false; }
        else {
          dx = it.tx - it.px; dy = it.ty - it.py; dd = it.tang - it.pang;
          if (dx > 0.03 || dx < -0.03 || dy > 0.03 || dy < -0.03 || dd > 0.0005 || dd < -0.0005) busy = true;
          it.px += dx * kp; it.py += dy * kp; it.pang += dd * kp;
        }
        if (it.al !== tAl) { it.al += (tAl - it.al) * kp * 1.5; if (Math.abs(it.al - tAl) < 0.004) it.al = tAl; busy = true; }
        if (it.fade < 1) { it.fade = Math.min(1, it.fade + dt / 0.22); busy = true; }
        // палец: желаемое смещение (разбегание или стягивание) и пружина с возвратом на место
        des = 0; desY = 0;
        if (fOn) {
          dx = it.px - ptr.x; dy = it.py - ptr.y; d = Math.sqrt(dx * dx + dy * dy) + 0.001; ux = dx / d; uy = dy / d;
          if (fing < 0) { f = 1 - sm(d / 170); f *= -fing * 105; des = ux * f; desY = uy * f; }
          else { f = 1 - sm(d / 280); f *= fing * 0.93 * d; des = -ux * f; desY = -uy * f; }
        }
        ax = 110 * (des - it.ox) - 12.6 * it.vx; ay = 110 * (desY - it.oy) - 12.6 * it.vy;
        if (fOn || it.ox > 0.05 || it.ox < -0.05 || it.oy > 0.05 || it.oy < -0.05 || it.vx > 0.05 || it.vx < -0.05 || it.vy > 0.05 || it.vy < -0.05) {
          it.vx += ax * dt; it.vy += ay * dt; it.ox += it.vx * dt; it.oy += it.vy * dt; busy = true;
        } else { it.ox = it.oy = it.vx = it.vy = 0; }
      }
      // секрет: вопрос по центру, смена каждые ~12 с
      if (sCalm) {
        if (sec.q < 0 || !sec.lines) { secPick(); sec.t = 0; }
        if (!frozen) sec.t += dt * 1000;
        if (sec.t >= SEC_PERIOD) { sec.t -= SEC_PERIOD; secPick(); }
        var tt = sec.t, a1 = tt < 1400 ? tt / 1400 : tt > SEC_PERIOD - 1400 ? (SEC_PERIOD - tt) / 1400 : 1;
        sec.env = sm(a1);
      }
      // запись прошлых поз для следа
      if (trK > 0.01) {
        if (!TRX) initTrail();
        if (T - trLast >= TRDT) {
          trLast = T; trI = (trI + 1) % TRN;
          for (i = 0; i < L.nx && i < NCAP + XCAP; i++) { it = items[i]; TRX[i * TRN + trI] = it.px + it.ox; TRY[i * TRN + trI] = it.py + it.oy; TRA[i * TRN + trI] = it.pang; TRV[i * TRN + trI] = 1; }
        }
        busy = true;
      }
      // блуждающий свет при высокой видимости и тишине
      if (!calm && S[3] > 0.25 && !g && !(hoverOn && ptr.has) && clk - lastAct > IDLE && secS < 0.5) {
        wan.on = true; wan.t += dt;
        var wx = vw / 2 + vw * 0.34 * Math.sin(wan.t * 0.21) + vw * 0.1 * Math.sin(wan.t * 0.53 + 1), wy = (topY + vh) / 2 + AH * 0.32 * Math.sin(wan.t * 0.17 + 2) + AH * 0.1 * Math.sin(wan.t * 0.41);
        if (Math.abs(wx - wan.lx) + Math.abs(wy - wan.ly) > 6) { addPoint(wx, wy, T); wan.lx = wx; wan.ly = wy; }
        busy = true;
      } else wan.on = false;
      if ((g || (hoverOn && ptr.has)) && headSeq >= pS && headSeq < pE) PT[headSeq % PCAP] = T;
      if (pE > pS) { pointsPrep(T); busy = true; }
      spBudget = 5;
    }

    // ---------------------------------------------------------------- кадр
    var curFont = '';
    function setT(cx, cy, ang, k) {
      var c = Math.cos(ang) * k * dpr, s = Math.sin(ang) * k * dpr;
      ctx.setTransform(c, s, -s, c, cx * dpr, cy * dpr);
    }
    function sharp(L, i, g0) {
      var ln = L.lines[i], j, fs = L.fs, x0 = -L.W[i] / 2, y0 = -L.H[i] / 2 + BO[L.fk] * fs;
      if (curFont !== L.font) { ctx.font = L.font; curFont = L.font; }
      ctx.fillStyle = LITC; ctx.globalAlpha = g0;
      for (j = 0; j < ln.length; j++) ctx.fillText(ln[j], x0, y0 + j * 1.25 * fs);
    }
    function lines(L, i, cx, cy, ang, k, g0, it, vOn, e0, litOn) {
      var j, ws, w, a, fs = L.fs, sp, ln;
      setT(cx, cy, ang, k);
      if (!vOn) { sharp(L, i, g0); return; }
      if (L === lay) {
        sp = getSprite(it, i);
        if (e0 < 0.995) {
          a = g0 * (1 - e0);
          if (sp) { ctx.globalAlpha = a * (1.15 - 0.5 * clamp((fs - 12) / 22, 0, 1)); ctx.drawImage(sp, -L.W[i] / 2 - SPAD, -L.H[i] / 2 - SPAD, sp.zw, sp.zh); }
          else {      // спрайт ещё не готов: три сдвинутых тусклых копии дают мягкий вид
            if (curFont !== L.font) { ctx.font = L.font; curFont = L.font; }
            ctx.fillStyle = 'rgb(' + DIM[0] + ',' + DIM[1] + ',' + DIM[2] + ')'; ctx.globalAlpha = a * 0.05;
            ln = L.lines[i];
            for (j = 0; j < ln.length; j++) { ctx.fillText(ln[j], -L.W[i] / 2 - 1.4, -L.H[i] / 2 + BO[L.fk] * fs + j * 1.25 * fs); ctx.fillText(ln[j], -L.W[i] / 2 + 1.4, -L.H[i] / 2 + BO[L.fk] * fs + j * 1.25 * fs); ctx.fillText(ln[j], -L.W[i] / 2, -L.H[i] / 2 + BO[L.fk] * fs + j * 1.25 * fs + 1.4); }
          }
        }
        if (e0 > 0.015) sharp(L, i, g0 * e0);
        if (litOn) {
          ws = L.words[i]; if (curFont !== L.font) { ctx.font = L.font; curFont = L.font; }
          ctx.fillStyle = LITC;
          for (j = 0; j < ws.length; j++) {
            w = it.wl[j]; if (w < 0.015) continue;
            ctx.globalAlpha = g0 * sm(w > 1 ? 1 : w);
            ctx.fillText(ws[j].t, -L.W[i] / 2 + ws[j].x, -L.H[i] / 2 + (ws[j].l * 1.25 + BO[L.fk]) * fs);
          }
        }
      } else sharp(L, i, g0 * Math.max(e0, 0.12));
    }
    function draw(T) {
      var L = lay, i, it, a, cx, cy, ang, k, kO, vOn = S[3] > 0.02, e0 = vOn ? Math.pow(1 - S[3], 1.2) : 1, g0, rad, lit, litOn, j, ti, dx, dy, vm;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, vw, vh);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; curFont = '';
      if (!L) return;
      k = fsCont(L.fk) / L.fs; kO = oldLay ? fsCont(oldLay.fk) / oldLay.fs : 1;
      for (i = 0; i < L.nx; i++) {
        it = items[i]; a = it.al * it.fade;
        if (a < 0.008 || it.hid) continue;
        cx = it.px + it.ox; cy = it.py + it.oy; ang = it.pang; rad = Math.sqrt(L.W[i] * L.W[i] + L.H[i] * L.H[i]) * 0.5 * k + 6;
        if (cx + rad < 0 || cx - rad > vw || cy + rad < 0 || cy - rad > vh) { it.lit = 0; continue; }
        lit = 0; litOn = false;
        if (vOn) { lit = lightItem(it, i, cx, cy, ang, k); litOn = lit > 0.015; if (lit > 0.015) busy = true; } else if (it.lit) { it.lit = 0; }
        it.lit = lit;
        g0 = a * it.ba * (it.rd ? READ_K : 1);
        if (oldLay && fc < 1 && i < oldLay.n) lines(oldLay, i, cx, cy, ang, kO, g0 * (1 - fc), it, vOn, e0, false);
        // след движения: прошлые позы блока тем же текстом, убывающая прозрачность; при высокой видимости — только у засвеченных
        if (trK > 0.02 && TRX) {
          vm = Math.max(e0, lit > 0.2 ? lit : 0);
          if (vm > 0.03) for (j = 1; j < TRN; j++) {
            ti = i * TRN + ((trI - j + TRN * 2) % TRN);
            if (!TRV[ti]) continue;
            dx = TRX[ti] - cx; dy = TRY[ti] - cy;
            if (dx * dx + dy * dy < 1.4) continue;
            setT(TRX[ti], TRY[ti], TRA[ti], k); sharp(L, i, g0 * trK * vm * 0.27 * (1 - (j - 1) / TRN));
          }
        }
        lines(L, i, cx, cy, ang, k, g0 * (oldLay ? fc : 1), it, vOn, e0, litOn);
      }
      if (secS > 0.003 && sec.lines && !sec.hid) {
        var br = calm ? 1 : 0.72 + 0.28 * Math.sin(clk / 1000 * 1.05);
        setT(vw / 2, topY + AH / 2 - 10, 0, 1);
        if (curFont !== sec.font) { ctx.font = sec.font; curFont = sec.font; }
        ctx.fillStyle = LITC; ctx.globalAlpha = secS * sec.env * br * (sec.rd ? READ_K : 1);
        for (j = 0; j < sec.lines.length; j++) ctx.fillText(sec.lines[j], -sec.W / 2, -sec.H / 2 + BO[0] * sec.fs + j * 1.25 * sec.fs);
      }
      ctx.globalAlpha = 1; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function stepTween(now) {
      var u = clamp((now - tw.t0) / tw.dur, 0, 1), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2, k;
      for (k = 0; k < 5; k++) { V[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e; paintSlider(k); }
      paintDots(); busy = true;
      if (u >= 1) { for (k = 0; k < 5; k++) { V[k] = tw.to[k]; paintSlider(k); } tw = null; saveNow(); paintDots(); }
    }
    function frame(now) {
      raf = 0;
      if (!active || paused || document.hidden) return;
      var dt = Math.min(0.05, (now - last) / 1000), T = performance.now(); last = now; clk += dt * 1000;
      if (tw) stepTween(now);
      step(dt, T); draw(T);
      if (busy || tw) quiet = 0; else quiet++;
      if (quiet < 8) raf = requestAnimationFrame(frame);
    }
    function halt() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function wipe() {
      pS = pE = 0; headSeq = -1; lp.ok = false; wan.on = false;
      for (var k = 0; k < items.length; k++) { items[k].lit = 0; if (items[k].wl) items[k].wl.fill ? items[k].wl.fill(0) : 0; }
    }

    // ---------------------------------------------------------------- панель настроек
    function paintSlider(k) {
      var r = rngs[k]; if (!r) return;
      r.value = V[k]; r.style.setProperty('--p', (V[k] * 100).toFixed(1) + '%');
    }
    function matchPreset(p) {
      var k; for (k = 0; k < 5; k++) if (Math.abs(V[k] - (k === 1 && calm ? 0 : p.v[k])) > 0.025) return false;
      for (k = 0; k < 3; k++) if (SW[k] !== p.s[k]) return false;
      return true;
    }
    function paintDots() {
      var k, on = -1;
      for (k = 0; k < PRESETS.length; k++) if (matchPreset(PRESETS[k])) { on = k; break; }
      if (on === dotOn) return;
      dotOn = on;
      for (k = 0; k < dots.length; k++) { if (k === on) dots[k].setAttribute('data-on', ''); else dots[k].removeAttribute('data-on'); dots[k].setAttribute('aria-pressed', String(k === on)); }
    }
    function paintSw() { for (var k = 0; k < sws.length; k++) sws[k].setAttribute('aria-checked', String(!!SW[k])); }
    function setVal(k, v) { V[k] = clamp(v, 0, 1); tw = null; lastAct = clk; paintSlider(k); paintDots(); saveSoon(); wake(); }
    function setSw(k, on) {
      on = on ? 1 : 0; if (SW[k] === on) return;
      if (k === 0) {         // шрифт: раскладка пересобирается под новый шрифт, старый текст растворяется на том же центре
        if (on) try { if (document.fonts && document.fonts.load) document.fonts.load('400 20px ' + FM, 'Вопрос ПРОВЕРКА').then(function () { if (active && SW[0]) { WC1 = {}; LC = {}; if (lay && lay.fk === 1) { var o2 = oldLay; relayout(false); oldLay = o2; } wake(); } }, function () {}); } catch (e) {}
        oldLay = lay; fc = 0; SW[0] = on;
        if (items.length) { curLv = clamp(Math.round(S[0] * (LV - 1)), 0, LV - 1); var ol = oldLay; bind(getLay(curLv, on), false); oldLay = ol; fc = calm ? 1 : 0; if (calm) oldLay = null; for (var it0 = 0; it0 < items.length; it0++) items[it0].fade = 1; }
      } else SW[k] = on;
      if (calm) { if (k === 1) dirS = on ? -1 : 1; if (k === 2) trK = 0; }
      paintSw(); paintDots(); saveSoon(); wake();
    }
    function applyPreset(i) {
      var p = PRESETS[i], k, from = V.slice(), to = p.v.slice();
      lastAct = clk;
      for (k = 0; k < 3; k++) setSw(k, p.s[k]);
      if (calm) { for (k = 0; k < 5; k++) { V[k] = to[k]; paintSlider(k); } S[1] = 0; tw = null; paintDots(); saveNow(); wake(); return; }
      tw = { t0: performance.now(), dur: 800, from: from, to: to };
      wake();
    }
    function openPanel() {
      if (panelOn) return;
      panelOn = true; panel.classList.add('on'); if (btnP) btnP.setAttribute('aria-expanded', 'true');
      try { localStorage.setItem(K_SEEN, '1'); } catch (e) {}
    }
    function closePanel() {
      if (!panelOn) return;
      panelOn = false; panel.classList.remove('on'); if (btnP) btnP.setAttribute('aria-expanded', 'false');
    }
    function buildPanel() {
      panel = el('div', 'zu-p'); panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'Настройки режима «Свой»');
      panel.appendChild(el('i', 'zu-h'));
      SLIDERS.forEach(function (s, k) {
        var row = el('div', 'zu-r'), ic = el('span', 'zu-i'), r = el('input', 'zu-in');
        ic.innerHTML = svg(s.ico);
        r.type = 'range'; r.min = 0; r.max = 1; r.step = 0.001; r.setAttribute('aria-label', s.label); r.title = s.label;
        r.addEventListener('input', function () { setVal(k, parseFloat(r.value)); });
        r.addEventListener('change', saveNow);
        if (k === 1 && calm) { r.disabled = true; }
        row.appendChild(ic); row.appendChild(r); panel.appendChild(row); rngs.push(r);
      });
      var tr = el('div', 'zu-t');
      SWITCHES.forEach(function (s, k) {
        var b = el('button', 'zu-sw'); b.type = 'button'; b.setAttribute('role', 'switch'); b.setAttribute('aria-label', s.label); b.title = s.label;
        b.innerHTML = '<span class="zu-i">' + svg(s.ico) + '</span><span class="zu-cap"><i></i></span>';
        b.addEventListener('click', function () { setSw(k, !SW[k]); });
        tr.appendChild(b); sws.push(b);
      });
      panel.appendChild(tr);
      var dr = el('div', 'zu-d'); dr.setAttribute('role', 'group'); dr.setAttribute('aria-label', 'Готовые сочетания');
      PRESETS.forEach(function (p, k) {
        var b = el('button', 'zu-pd'); b.type = 'button'; b.setAttribute('aria-label', 'Готовое сочетание ' + (k + 1) + ' из ' + PRESETS.length); b.title = 'Готовое сочетание ' + (k + 1);
        b.appendChild(el('i'));
        b.addEventListener('click', function () { applyPreset(k); });
        dr.appendChild(b); dots.push(b);
      });
      panel.appendChild(dr);
      scene.appendChild(panel);
      // касания панели не доходят до сцены (иначе она захватит указатель и бегунок не потянуть); свайп вниз по панели закрывает её
      var sw0 = null;
      panel.addEventListener('pointerdown', function (e) { e.stopPropagation(); sw0 = e.target && e.target.tagName === 'INPUT' ? null : { id: e.pointerId, y: e.clientY }; });
      panel.addEventListener('pointermove', function (e) { if (sw0 && e.pointerId === sw0.id && e.clientY - sw0.y > 34) { sw0 = null; closePanel(); } });
      panel.addEventListener('pointerup', function () { sw0 = null; });
      panel.addEventListener('pointercancel', function () { sw0 = null; });
      for (var k = 0; k < 5; k++) paintSlider(k);
      paintSw(); paintDots();
    }
    // стрелки на бегунке: хост перехватывает их в фазе захвата, поэтому двигаем значение сами
    document.addEventListener('keydown', function (e) {
      if (!active || !e.target || e.target.tagName !== 'INPUT' || !panel || !panel.contains(e.target)) return;
      var k = rngs.indexOf(e.target), d = 0, kk = e.key;
      if (k < 0 || e.target.disabled) return;
      if (kk === 'ArrowLeft' || kk === 'ArrowDown') d = -0.05; else if (kk === 'ArrowRight' || kk === 'ArrowUp') d = 0.05;
      else if (kk === 'Home') { setVal(k, 0); e.preventDefault(); return; } else if (kk === 'End') { setVal(k, 1); e.preventDefault(); return; }
      if (d) { e.preventDefault(); setVal(k, V[k] + d); saveNow(); }
    }, true);
    function mkBtn() {
      if (btnP) return;
      btnP = el('button'); btnP.type = 'button'; btnP.setAttribute('aria-label', 'Настройки режима «Свой»'); btnP.title = 'Настройки'; btnP.setAttribute('aria-expanded', panelOn ? 'true' : 'false');
      btnP.innerHTML = ICO_PANEL;
      btnP.addEventListener('click', function () { if (panelOn) closePanel(); else openPanel(); });
      var t = scene.parentNode && scene.parentNode.querySelector ? scene.parentNode.querySelector('.zt') : null;
      if (t) t.insertBefore(btnP, t.firstChild);
    }
    function dropBtn() { if (btnP && btnP.parentNode) btnP.parentNode.removeChild(btnP); btnP = null; }

    // ---------------------------------------------------------------- жесты
    function pt(e) { var r = scene.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    // вопрос под точкой; при видимости ≥ 0.5 — только засвеченный
    function candidate(x, y) {
      var L = lay, i, it, k, cx, cy, dx, dy, lx, ly, ca, sa, best = -1, bd = 1e9, d, need = S[3] >= 0.5, pad = 10;
      if (secS > 0.5 && sec.lines) {
        dx = x - vw / 2; dy = y - (topY + AH / 2 - 10);
        if (Math.abs(dx) < sec.W / 2 + 16 && Math.abs(dy) < sec.H / 2 + 12) return { sec: true };
        return null;
      }
      if (!L) return null;
      k = fsCont(L.fk) / L.fs;
      for (i = 0; i < L.nx; i++) {
        it = items[i]; if (it.hid || it.al * it.fade < 0.35) continue;
        if (need && it.lit < OPEN_AT) continue;
        cx = it.px + it.ox; cy = it.py + it.oy; dx = x - cx; dy = y - cy;
        ca = Math.cos(-it.pang); sa = Math.sin(-it.pang); lx = (dx * ca - dy * sa) / k; ly = (dx * sa + dy * ca) / k;
        if (Math.abs(lx) > L.W[i] / 2 + pad || Math.abs(ly) > L.H[i] / 2 + pad) continue;
        d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; }
      }
      return best >= 0 ? { i: best } : null;
    }
    function placeProxy(q) {
      var L = lay, st = proxy.style, i, it, k, cx, cy, W, H, fs, fk, lines0, al;
      if (sec.q === q && secS > 0.05 && sec.lines) {
        proxy.textContent = sec.lines.join('\n'); st.fontFamily = FF; st.fontStyle = 'italic'; st.fontSize = sec.fs + 'px'; st.left = '0px'; st.top = '0px';
        return { x: vw / 2 - sec.W / 2, y: topY + AH / 2 - 10 - sec.H / 2, op: (sec.rd ? READ_K : 1) * sec.env };
      }
      if (!L) return null;
      for (i = 0; i < L.nx; i++) if (items[i].q === q) break;
      if (i >= L.nx) return null;
      it = items[i]; k = fsCont(L.fk) / L.fs; fk = L.fk; fs = L.fs * k; W = L.W[i] * k; H = L.H[i] * k;
      cx = it.px + it.ox; cy = it.py + it.oy;
      proxy.textContent = L.lines[i].join('\n'); st.fontFamily = fk ? FM : FF; st.fontStyle = fk ? 'normal' : 'italic'; st.fontSize = fs + 'px'; st.left = '0px'; st.top = '0px';
      return { x: cx - W / 2, y: cy - H / 2, op: it.al * it.ba * (it.rd ? READ_K : 1), item: it };
    }
    function openCand(c) {
      var q, p, it;
      if (!c) return;
      if (c.sec) q = sec.q; else { it = items[c.i]; if (!it) return; q = it.q; }
      p = placeProxy(q); if (!p) return;
      api.open(q, proxy, { x: p.x, y: p.y, scale: 1, opacity: Math.min(1, Math.max(0.25, p.op)) });
    }
    function onDown(e) {
      if (!active || paused || g) return;
      if (e.target && panel && panel.contains(e.target)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var dead = api.popDown(), p = pt(e), cand = null, T = performance.now();
      if (panelOn) { closePanel(); dead = true; }
      if (!dead) cand = candidate(p.x, p.y);
      try { scene.setPointerCapture(e.pointerId); } catch (x) {}
      lastAct = clk; ptr.x = p.x; ptr.y = p.y; ptr.has = true;
      g = { id: e.pointerId, type: e.pointerType, x0: p.x, y0: p.y, t: T, moved: false, dead: dead, cand: cand };
      if (e.pointerType === 'touch') lp.ok = false;
      if (S[3] > 0.02 || V[3] > 0.02) strokeTo(p.x, p.y, T);
      wake();
    }
    function onMove(e) {
      if (!active || paused) return;
      if (e.target && panel && panel.contains(e.target)) return;
      if (g) { if (e.pointerId !== g.id) return; }
      else if (e.pointerType === 'touch' || e.pointerType === '') return;
      var list = e.getCoalescedEvents ? e.getCoalescedEvents() : null, T = performance.now(), k, p;
      if (!list || !list.length) list = [e];
      for (k = 0; k < list.length; k++) {
        p = pt(list[k]);
        if (g && !g.moved && Math.sqrt(Math.pow(p.x - g.x0, 2) + Math.pow(p.y - g.y0, 2)) > 8) g.moved = true;
        ptr.x = p.x; ptr.y = p.y;
        if (V[3] > 0.02) strokeTo(p.x, p.y, T);
      }
      lastAct = clk; ptr.has = true;
      if (!g) hoverOn = true;
      wake();
    }
    function onUp(e) {
      if (!g || e.pointerId !== g.id) return;
      var gg = g; g = null;
      try { scene.releasePointerCapture(e.pointerId); } catch (x) {}
      lastAct = clk;
      var hover = gg.type === 'mouse' || gg.type === 'pen';
      if (hover && e.type !== 'pointercancel') hoverOn = true; else { hoverOn = false; ptr.has = false; lp.ok = false; }
      wake();
      if (e.type === 'pointercancel' || gg.dead) return;
      if (!gg.moved && performance.now() - gg.t < 300 && gg.cand) openCand(gg.cand);
    }
    scene.addEventListener('pointerdown', onDown);
    scene.addEventListener('pointermove', onMove);
    scene.addEventListener('pointerup', onUp);
    scene.addEventListener('pointercancel', onUp);
    scene.addEventListener('pointerleave', function (e) { if (!g && (e.pointerType === 'mouse' || e.pointerType === 'pen')) { hoverOn = false; ptr.has = false; lp.ok = false; wake(); } });
    scene.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // ---------------------------------------------------------------- поиск вопроса, вход по ссылке
    function indexOf(q) { for (var i = 0; i < items.length; i++) if (items[i].q === q) return i; return -1; }
    function ensure(q, quietly) {
      if (sec.q === q && secS > 0.5) return;
      var k = indexOf(q), it;
      if (k >= 0 && k < (lay ? lay.n : 0) && !quietly) return;       // на экране в покое (не запасной)
      if (k >= 0) { it = items.splice(k, 1)[0]; } else it = mkItem(q);
      items.unshift(it); if (items.length > NCAP + XCAP + 8) items.length = NCAP + XCAP + 8;
      relayout(true);
    }
    function relight() { relitQ = -1; }
    function unfreeze() { frozen = false; if (holdT) { clearTimeout(holdT); holdT = 0; } }
    function itemOf(q) { var i = indexOf(q); return i >= 0 ? items[i] : null; }

    function init() {
      loadVals();
      var cs = getComputedStyle(document.documentElement);
      FF = (cs.getPropertyValue('--f-serif') || '').trim() || 'Georgia, serif';
      FM = (cs.getPropertyValue('--f-mono') || '').trim() || 'monospace';
      var hc = (cs.getPropertyValue('--htext') || '').trim(); if (/^#[0-9a-f]{3,8}$/i.test(hc)) LITC = hc;
    }
    var inited = false;
    function afterFonts() {
      try {
        if (document.fonts && document.fonts.check && !document.fonts.check('italic 400 20px ' + FF)) {
          document.fonts.load('italic 400 20px ' + FF, 'Вопрос').then(function () {
            if (!active || openQ >= 0 || g) return;
            WC0 = {}; measureBO(); var o2 = oldLay; relayout(false); oldLay = o2; wake();
          }, function () {});
        }
      } catch (e) {}
    }

    var M = {
      enter: function (o) {
        active = true; paused = false; frozen = false;
        if (!inited) { inited = true; init(); buildPanel(); }
        clk = 0; lastAct = 0; openQ = -1; relitQ = -1; g = null; hoverOn = false; ptr.has = false; tw = null; secS = 0; sec.q = -1; sec.hid = false;
        if (calm) V[1] = 0;
        var k; for (k = 0; k < 5; k++) { S[k] = V[k]; paintSlider(k); }
        if (calm) S[1] = 0;
        dirS = SW[1] ? -1 : 1; trK = SW[2] ? 1 : 0; fc = 1; oldLay = null; vortT = 0; cph = 0; paintSw(); paintDots();
        var allZ = true; for (k = 0; k < 5; k++) if (V[k] > ZERO) allZ = false; if (allZ) secS = 1;
        size(); mkBtn(); rebuildPool(); relayout(true);
        if (o.q >= 0) ensure(o.q, false);
        wipe(); wake();
        var seen = false; try { seen = !!localStorage.getItem(K_SEEN); } catch (e) {}
        if (SW[0]) try { if (document.fonts && document.fonts.load) document.fonts.load('400 20px ' + FM, 'Вопрос ПРОВЕРКА').then(function () { if (active) { WC1 = {}; relayout(false); wake(); } }, function () {}); } catch (e2) {}
        afterFonts();
        if (!seen) later(openPanel, calm ? 50 : 500);
      },
      leave: function () {
        active = false; halt(); timers.forEach(clearTimeout); timers = []; g = null; hoverOn = false; unfreeze(); closePanel(); dropBtn(); saveNow(); wipe();
      },
      pause: function () { paused = true; halt(); },
      // хост зовёт resume в начале полёта заголовка назад: вопросы стоят, пока заголовок не сел на место (onClosed), страховка — 1.6 с
      resume: function () {
        paused = false; lastAct = clk;
        if (frozen && !holdT) holdT = setTimeout(function () { holdT = 0; frozen = false; var it = openQ >= 0 ? itemOf(openQ) : null; if (it) it.hid = false; if (sec.hid) sec.hid = false; openQ = -1; wake(); }, 1600);
        wake();
      },
      resize: function () { if (!active) return; size(); relayout(true); if (openQ >= 0) ensure(openQ, false); wake(); },
      refresh: function () { rebuildPool(); relayout(true); if (secS > 0) sec.q = -1; wake(); },
      focus: function (q) { ensure(q, false); },
      onOpened: function (q) {
        var it;
        ensure(q, false);
        g = null; hoverOn = false; ptr.has = false; openQ = q; frozen = true; wipe();
        it = itemOf(q); if (it) { it.hid = true; it.rd = true; }
        if (sec.q === q) { sec.hid = true; sec.rd = true; }
      },
      onClosed: function (q) {
        var it = itemOf(q); openQ = -1; unfreeze();
        if (it) it.hid = false; sec.hid = false;
        lastAct = clk; wake();
      },
      returnTarget: function (q) {
        var p = placeProxy(q); if (!p) return null;
        return { el: proxy, x: p.x, y: p.y, scale: 1, opacity: Math.min(1, Math.max(0.25, p.op)) };
      },
      key: function (e) {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        if (e.target.tagName === 'BUTTON') return;
        e.preventDefault(); if (e.repeat) return;
        var L = lay, i, it, d, best = -1, bd = 1e9;
        if (secS > 0.5 && sec.lines) { openCand({ sec: true }); return; }
        if (!L) return;
        for (i = 0; i < L.nx; i++) {
          it = items[i]; if (it.hid || it.al < 0.35) continue;
          if (S[3] >= 0.5 && it.lit < OPEN_AT) continue;
          d = Math.pow(it.px - vw / 2, 2) + Math.pow(it.py - (topY + AH / 2), 2); if (d < bd) { bd = d; best = i; }
        }
        if (best >= 0) openCand({ i: best });
      },
      // самопроверка: значения, число вопросов, пересечения прямоугольников.
      // Валидна только в установившемся состоянии при порядке 0 (ленты) и 0.5 (облако), когда палец не действует (бегунок «палец» = 0.5 или указателя нет).
      // Во время интерполяции порядка, в хаосе/вихре (порядок > 0.5) и при притяжении к пальцу пересечения допустимы: тогда проверка только сообщает число.
      // displayed — пересечения вопросов в нынешних позах (с орбитами, но без поворота); rowsBase и cloudBase — база раскладок: ленты (позы при D = 0) и облака с запасом на орбиту.
      check: function () {
        var L = lay, i, j, n = L ? L.n : 0, r = { values: V.map(function (x) { return Math.round(x * 1000) / 1000; }), smoothed: S.map(function (x) { return Math.round(x * 1000) / 1000; }),
          switches: { font: SW[0] ? 'mono' : 'serif', direction: SW[1] ? 'reverse' : 'forward', trail: !!SW[2] }, secret: secS > 0.5, W: vw, H: vh, level: curLv,
          fs: L ? L.fs : 0, questions: n, planned: L ? nAt(curLv) : 0, visible: 0, displayed: 0, rowsBase: 0, cloudBase: 0, inScreen: 0, valid: false };
        if (!L) return r;
        var k = fsCont(L.fk) / L.fs, a, b, ar = [], am;
        for (i = 0; i < L.nx; i++) {
          var it = items[i], w = L.W[i] * k, h = L.H[i] * k, cx = it.px + it.ox, cy = it.py + it.oy;
          if (it.al > 0.5 && i < n) r.visible++;
          if (i < n && cx + w / 2 > 0 && cx - w / 2 < vw && cy + h / 2 > 0 && cy - h / 2 < vh) r.inScreen++;
          ar.push({ x: cx - w / 2, y: cy - h / 2, w: w, h: h, v: (i < n || L.xOn[i]) && it.al > 0.3 && cx + w / 2 > 0 && cx - w / 2 < vw });
          for (j = 0; j < i; j++) { a = ar[i]; b = ar[j]; if (a.v && b.v && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) r.displayed++; }
          for (j = 0; j < i; j++) {
            if ((i >= n && !L.xOn[i]) || (j >= n && !L.xOn[j])) continue;
            if (L.rx[i] < L.rx[j] + L.W[j] && L.rx[i] + L.W[i] > L.rx[j] && L.ry[i] < L.ry[j] + L.H[j] && L.ry[i] + L.H[i] > L.ry[j] && L.row[i] === L.row[j]) r.rowsBase++;
            else if (L.row[i] !== L.row[j] && L.ry[i] < L.ry[j] + L.H[j] && L.ry[i] + L.H[i] > L.ry[j] && L.rx[i] < L.rx[j] + L.W[j] && L.rx[i] + L.W[i] > L.rx[j]) r.rowsBase++;
            if (i < n && j < n && L.cx[i] - L.amp[i] < L.cx[j] + L.W[j] + L.amp[j] && L.cx[i] + L.W[i] + L.amp[i] > L.cx[j] - L.amp[j] && L.cy[i] - L.amp[i] < L.cy[j] + L.H[j] + L.amp[j] && L.cy[i] + L.H[i] + L.amp[i] > L.cy[j] - L.amp[j]) r.cloudBase++;
          }
        }
        r.valid = (S[2] < 0.01 || Math.abs(S[2] - 0.5) < 0.01) && Math.abs(S[4] - 0.5) < 0.01 && !tw && fc >= 1;
        return r;
      },
      // для проверки из консоли: поставить значения и пресет
      set: function (v, s) { var k; if (v) for (k = 0; k < 5; k++) if (typeof v[k] === 'number') { V[k] = clamp(v[k], 0, 1); paintSlider(k); } if (s) for (k = 0; k < 3; k++) if (s[k] != null) setSw(k, s[k]); tw = null; paintDots(); saveNow(); wake(); },
      preset: function (i) { applyPreset(i); },
      panel: function (on) { if (on) openPanel(); else closePanel(); },
      // замер: средняя стоимость кадра (модель + рисование) на нынешних значениях, мс
      // стоимость сборки раскладки уровня lv, мс (без кеша)
      build: function (lv) { var t0 = performance.now(); var L = buildLayout(lv, SW[0]); return { ms: Math.round((performance.now() - t0) * 10) / 10, n: L.n }; },
      perf: function (n) { var t0 = performance.now(), i, T = t0; for (i = 0; i < n; i++) { T += 16; step(0.016, T); draw(T); } return Math.round((performance.now() - t0) / n * 100) / 100; }
    };
    // VoicesZen.customCheck() — самопроверка; customSet / customPreset — для проверки из консоли
    window.VoicesZen.customCheck = M.check; window.VoicesZen.customSet = M.set; window.VoicesZen.customPreset = M.preset; window.VoicesZen.customPanel = M.panel; window.VoicesZen.customPerf = M.perf; window.VoicesZen.customBuild = M.build;
    return M;
  });
})();
