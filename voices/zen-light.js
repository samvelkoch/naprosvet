/* «Голоса_», Zen: режим «На просвет». Тёмный лист бумаги с вопросами-водяными знаками, палец — лампа за листом.
   Под светом знаки проступают тёмной сепией там, где стоят. Свет рисует Canvas 2D (один спрайт), текст — DOM под маской.
   Регистрируется в хосте (zen.js). ES5, без библиотек. */
(function () {
  'use strict';
  if (!window.VoicesZen) return;

  window.VoicesZen.register('light', function (api, scene) {
    var el = api.el, calm = api.calm;
    var R = 180;                    // радиус света, px
    var RISE = 300;                 // разгорание света под пальцем, мс
    var FALL = 2500;                // остывание света после отпускания, мс
    var TRAIL = 1500;               // остывание точки следа, мс
    var STEP = 20;                  // точку следа ставим каждые столько px пути лампы
    var TRAIL_K = 0.13;             // сила точки следа: точек много, они складываются
    var OM = 18;                    // жёсткость пружины лампы: отставание около 100 мс
    var OPEN_AT = 0.45;             // вопрос считается проявленным при такой силе света в центре
    var IDLE = 7000, WAN = 0.3;     // через 7 с тишины лампа блуждает с силой 0.3
    var GAP = 24, ICON_GAP = 56, MAXL = 80;
    var GLOW = [232, 214, 184];     // центр свечения #e8d6b8
    // ярусы размера: A–B — разброс размера, W — ширина строки, px; MIN — ниже не уменьшаем при замене знака
    var TIER = [
      { a: 15, b: 18, w1: 130, w2: 230, min: 14, len: 120, nar: 70 },     // nar — предел длины вопроса на узком экране: меньше строк, плотнее лист
      { a: 20, b: 24, w1: 170, w2: 260, min: 18, len: 110, nar: 58 },
      { a: 28, b: 34, w1: 230, w2: 300, min: 24, len: 70, nar: 40 }
    ];

    // ---- слои сцены
    var wm = el('div', 'zl-wm'), cv = el('canvas', 'zl-glow'), ink = el('div', 'zl-ink'), fib = el('div', 'zl-fib'), grain = el('div', 'zl-grain');
    var ctx = cv.getContext('2d');
    scene.appendChild(wm); scene.appendChild(cv); scene.appendChild(ink); scene.appendChild(fib); scene.appendChild(grain);
    var EMPTY = 'linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0))';

    var vw = 0, vh = 0, dpr = 1, spriteDpr = 0, sprite = null, safe = { t: 0, r: 0, b: 0, l: 0 }, zone = null;
    var active = false, paused = false, raf = 0, last = 0, clk = 0, lastAct = 0, timers = [], hadLight = false;
    var slots = [], FF = 'Georgia, serif', mc = null;
    var lights = [], act = [], g = null, openQ = -1, relitQ = -1;

    function later(fn, ms) { var t = setTimeout(function () { var k = timers.indexOf(t); if (k >= 0) timers.splice(k, 1); fn(); }, ms); timers.push(t); return t; }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function sm(x) { return x * x * (3 - 2 * x); }
    // профиль света: гладкий колокол, на краю радиуса ровно ноль и нулевой наклон (ни колец, ни края)
    function prof(t) { var u = 1 - t * t; return u <= 0 ? 0 : Math.pow(u, 2.4); }
    var STOPS = [], PROF = [], i0;
    for (i0 = 0; i0 <= 12; i0++) { STOPS.push(i0 / 12); PROF.push(prof(i0 / 12)); }

    // ---------------------------------------------------------------- размеры, спрайт света
    function probeSafe() {
      var p = el('i'); p.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      scene.appendChild(p); var cs = getComputedStyle(p);
      safe = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
      scene.removeChild(p);
    }
    function size() {
      vw = scene.clientWidth || window.innerWidth; vh = scene.clientHeight || window.innerHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
      cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      probeSafe();
      // зона иконок справа сверху: берём настоящий прямоугольник панели, иначе оцениваем
      var tl = scene.parentNode && scene.parentNode.querySelector ? scene.parentNode.querySelector('.zt') : null, sr = scene.getBoundingClientRect(), z;
      if (tl) { var r = tl.getBoundingClientRect(); z = { x: r.left - sr.left, y: 0, w: r.right - sr.left - (r.left - sr.left), h: r.bottom - sr.top }; }
      if (!z || z.w < 20) z = { x: vw - 182 - safe.r, y: 0, w: 182 + safe.r, h: 50 + safe.t };
      zone = { x: z.x - ICON_GAP, y: 0, w: vw - (z.x - ICON_GAP), h: z.h + ICON_GAP };
      if (!sprite || spriteDpr !== dpr) makeSprite();
    }
    // один спрайт лампы: центр #e8d6b8, дробный шум в альфе убирает ступени градиента
    function makeSprite() {
      var S = Math.ceil(2 * R * dpr), c = document.createElement('canvas'), x = c.getContext('2d'), im, d, h = S / 2, px, py, t, a, o;
      c.width = c.height = S; im = x.createImageData(S, S); d = im.data;
      for (py = 0; py < S; py++) for (px = 0; px < S; px++) {
        t = Math.sqrt((px + 0.5 - h) * (px + 0.5 - h) + (py + 0.5 - h) * (py + 0.5 - h)) / h;
        a = t >= 1 ? 0 : prof(t) * 0.9 * 255 + Math.random() - 0.5;
        o = (py * S + px) * 4; d[o] = GLOW[0]; d[o + 1] = GLOW[1]; d[o + 2] = GLOW[2]; d[o + 3] = a < 0 ? 0 : a;
      }
      x.putImageData(im, 0, 0); sprite = c; spriteDpr = dpr;
    }

    // ---------------------------------------------------------------- раскладка знаков
    function wrap(text, size, maxW) {
      if (!mc) mc = document.createElement('canvas').getContext('2d');
      mc.font = '400 ' + size + 'px ' + FF;
      var words = text.replace(/\s+/g, ' ').trim().split(' '), sp = mc.measureText(' ').width, lines = [], cur = '', curW = 0, best = 0, k, w;
      for (k = 0; k < words.length; k++) {
        w = mc.measureText(words[k]).width;
        if (!cur) { cur = words[k]; curW = w; }
        else if (curW + sp + w <= maxW) { cur += ' ' + words[k]; curW += sp + w; }
        else { lines.push(cur); if (curW > best) best = curW; cur = words[k]; curW = w; }
      }
      lines.push(cur); if (curW > best) best = curW;
      return { lines: lines, w: Math.ceil(best) + 2, h: Math.ceil(lines.length * size * 1.25) };
    }
    function pool() {
      var D = api.data(), p = [], k;
      for (k = 0; k < D.questions.length; k++) if (api.matches(k)) p.push(k);
      return p;
    }
    function qtext(q) { return api.data().questions[q].q; }
    function clash(r, list) {
      for (var k = 0; k < list.length; k++) {
        var s = list[k];
        if (r.x < s.x + s.w + GAP && r.x + r.w + GAP > s.x && r.y < s.y + s.h + GAP && r.y + r.h + GAP > s.y) return true;
      }
      return false;
    }
    function inZone(r) { return zone && r.x < zone.x + zone.w && r.x + r.w > zone.x && r.y < zone.y + zone.h && r.y + r.h > zone.y; }

    // место для бокса w×h среди ВСЕХ допустимых (перебор по сетке 5 px): случайное в полосе у самого верха свободного места,
    // так лист заполняется плотно и без дыр, но не рядами
    function spot(w, h, x0, y0, x1, y1) {
      var vx = [], vy = [], x, y, k, minY = 1e9, c = 0, pick = null, r = { x: 0, y: 0, w: w, h: h };
      for (y = y0; y + h <= y1; y += 5) for (x = x0; x + w <= x1; x += 5) {
        r.x = x; r.y = y;
        if (inZone(r) || clash(r, slots)) continue;
        vx.push(x); vy.push(y); if (y < minY) minY = y;
      }
      for (k = 0; k < vx.length; k++) if (vy[k] <= minY + 25) { c++; if (Math.random() * c < 1) pick = { x: vx[k], y: vy[k] }; }
      return pick;
    }
    function clearSlots() { wm.innerHTML = ''; ink.innerHTML = ''; slots = []; }
    // раскладка случайна: если вышло меньше 12 знаков, пробуем снова (до 10 раз)
    function layout() {
      for (var t = 0; t < 10; t++) { build(); if (slots.length >= 12) break; }
      try { var c = check(); console.info('[zen] На просвет: знаков ' + c.n + ', пересечений ' + c.overlaps + ', зазор < ' + GAP + 'px: ' + c.tight + ', в зоне иконок: ' + c.inZone + ', за краем: ' + c.outside); } catch (e) {}
    }
    function build() {
      clearSlots();
      var P = pool(), n = Math.max(12, Math.min(20, Math.round(vw * vh / 16000))), tiers = [], k, used = {};
      var nL = vw >= 1100 ? 2 : 1, nM = vw < 500 ? 3 : Math.round(n * 0.22), nS = n - nL - nM;
      for (k = 0; k < nL; k++) tiers.push(2);
      for (k = 0; k < nM; k++) tiers.push(1);
      for (k = 0; k < nS + 12; k++) tiers.push(0);     // запас мелких: лист добивается, пока есть место
      var cands = TIER.map(function (T) { return P.filter(function (q) { return qtext(q).length <= (vw < 500 ? T.nar : T.len); }); });
      function C0(t) { return cands[t].length > 0; }
      var x0 = 14 + Math.max(safe.l, safe.r), y0 = Math.max(12, safe.t + 10), x1 = vw - x0, y1 = vh - 14 - safe.b, miss = 0;
      for (k = 0; k < tiers.length && slots.length < n && miss < 6; k++) {
        var T = TIER[tiers[k]], ok = false, tryQ;
        for (tryQ = 0; tryQ < 12 && !ok && C0(tiers[k]); tryQ++) {
          var C = cands[tiers[k]], q = C[Math.floor(Math.random() * C.length)];
          if (used[q]) continue;
          var size = Math.round(rnd(T.a, T.b) * 2) / 2, ww = vw < 500 ? (tiers[k] === 0 ? rnd(110, 170) : tiers[k] === 1 ? rnd(T.w1, 210) : rnd(T.w1, T.w2)) : rnd(T.w1, T.w2), m = wrap(qtext(q), size, Math.min(ww, x1 - x0));
          if (m.w > x1 - x0 || m.h > y1 - y0) continue;
          var pos = spot(m.w, m.h, x0, y0, x1, y1);
          if (pos) { ok = true; used[q] = 1; addSlot({ x: pos.x, y: pos.y, w: m.w, h: m.h }, tiers[k], q, size, m); }
        }
        if (!ok) miss++; else miss = 0;
      }
    }
    function addSlot(r, tier, q, size, m) {
      var s = { x: r.x, y: r.y, w: r.w, h: r.h, tier: tier, q: -1, tx: 0, ty: 0, tw: 0, th: 0, cx: 0, cy: 0, str: 0, lit: false, litT: -1e9, swap: 0, next: clk + rnd(20000, 40000), op: 0.07, wm: el('div', 'zl-w'), ink: el('div', 'zl-k') };
      wm.appendChild(s.wm); ink.appendChild(s.ink); slots.push(s);
      put(s, q, size, m);
    }
    function put(s, q, size, m) {
      s.q = q; s.size = size;
      s.tw = m.w; s.th = m.h; s.tx = s.x + (s.w - m.w) / 2; s.ty = s.y + (s.h - m.h) / 2; s.cx = s.tx + m.w / 2; s.cy = s.ty + m.h / 2;
      var read = api.isRead(q), txt = m.lines.join('\n'), st;
      s.op = (0.06 + Math.random() * 0.02) * (read ? 0.7 : 1);
      s.wm.textContent = txt; s.ink.textContent = txt;
      [s.wm, s.ink].forEach(function (nd) { st = nd.style; st.left = s.tx.toFixed(1) + 'px'; st.top = s.ty.toFixed(1) + 'px'; st.fontSize = size + 'px'; st.display = ''; });
      s.wm.style.opacity = s.op.toFixed(3); s.ink.style.opacity = read ? '0.72' : '';
    }
    function hide(s) { s.q = -1; s.wm.style.display = 'none'; s.ink.style.display = 'none'; }
    // вопрос q на место s: размер подбираем в своём ярусе и уменьшаем, пока текст не войдёт в бокс места
    function fit(q, s) {
      var T = TIER[s.tier], t = qtext(q), size = Math.round(rnd(T.a, T.b) * 2) / 2, m;
      for (; size >= T.min; size -= 0.5) {
        m = wrap(t, size, s.w);
        if (m.w <= s.w && m.h <= s.h) return { size: size, m: m };
      }
      return null;
    }
    function shownSet() { var o = {}; slots.forEach(function (s) { if (s.q >= 0) o[s.q] = 1; }); return o; }
    // подходящий вопрос для места: из выбранной темы, не показанный сейчас
    function findFor(s, P, shown) {
      for (var k = 0; k < 40; k++) {
        var q = P[Math.floor(Math.random() * P.length)];
        if (shown[q] || q === openQ) continue;
        var f = fit(q, s); if (f) return { q: q, f: f };
      }
      return null;
    }
    // вопрос q обязан быть на листе (вход по ссылке, возврат по «назад»): ставим на самое подходящее место
    function ensure(q) {
      var k, best = null, bd = -1, f;
      for (k = 0; k < slots.length; k++) if (slots[k].q === q) return slots[k];
      for (k = 0; k < slots.length; k++) {
        f = fit(q, slots[k]);
        if (f && (!best || slots[k].w * slots[k].h > bd)) { best = { s: slots[k], f: f }; bd = slots[k].w * slots[k].h; }
      }
      if (!best) return null;
      put(best.s, q, best.f.size, best.f.m);
      return best.s;
    }
    function slotOf(q) { for (var k = 0; k < slots.length; k++) if (slots[k].q === q) return slots[k]; return null; }

    // попарная проверка по настоящим прямоугольникам узлов: пересечения, зазор меньше GAP, зона иконок, выход за край
    function check() {
      var rs = [], k, j, o = 0, t = 0, z = 0, out = 0, a, b, r;
      var sr = scene.getBoundingClientRect();
      for (k = 0; k < slots.length; k++) {
        if (slots[k].q < 0) continue;
        r = slots[k].ink.getBoundingClientRect();
        rs.push({ x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height });
      }
      for (k = 0; k < rs.length; k++) {
        a = rs[k];
        if (inZone(a)) z++;
        if (a.x < 0 || a.y < 0 || a.x + a.w > vw || a.y + a.h > vh) out++;
        for (j = k + 1; j < rs.length; j++) {
          b = rs[j];
          if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) o++;
          if (a.x < b.x + b.w + GAP - 0.6 && a.x + a.w + GAP - 0.6 > b.x && a.y < b.y + b.h + GAP - 0.6 && a.y + a.h + GAP - 0.6 > b.y) t++;
        }
      }
      return { n: rs.length, overlaps: o, tight: t, inZone: z, outside: out, W: vw, H: vh };
    }
    window.VoicesZen.lightCheck = check;

    // ---------------------------------------------------------------- свет: лампа, след, остывающие огни
    // лампа (палец или мышь) и блуждающая лампа в простое; обе следуют за целью с пружиной
    function mkLamp(amp, rise, fall) { return { on: false, x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, lx: 0, ly: 0, k: 0, s: 0, amp: amp, rise: rise, fall: fall }; }
    var lamp = mkLamp(1, RISE, RISE), wan = mkLamp(WAN, 2600, 700), wph = [0, 0, 0, 0];

    function lampOn(a, x, y) {
      a.on = true; a.x = a.tx = a.lx = x; a.y = a.ty = a.ly = y; a.vx = a.vy = 0; a.k = calm ? 1 : 0; a.s = calm ? a.amp : 0;
    }
    function addRest(x, y, k) {
      lights.push({ x: x, y: y, k: calm ? 1 : k, d: 0, amp: 1, dur: FALL, s: 0 });
      if (lights.length > MAXL) lights.shift();
    }
    function releaseLamp() { if (lamp.on) { addRest(lamp.x, lamp.y, lamp.k); } lamp.on = false; lamp.k = 0; lamp.s = 0; }
    function stepLamp(a, dt) {
      if (a.on) a.k = calm ? 1 : Math.min(1, a.k + dt * 1000 / a.rise);
      else if (a.k > 0) a.k = calm ? 0 : Math.max(0, a.k - dt * 1000 / a.fall);
      a.s = calm ? (a.on ? a.amp : 0) : a.amp * sm(a.k);
      if (!a.on && a.k <= 0) return;
      if (calm) { a.x = a.tx; a.y = a.ty; return; }
      var n = dt > 0.025 ? 2 : 1, h = dt / n, ax, ay;
      while (n--) {
        ax = OM * OM * (a.tx - a.x) - 2 * OM * a.vx; ay = OM * OM * (a.ty - a.y) - 2 * OM * a.vy;
        a.vx += ax * h; a.vy += ay * h; a.x += a.vx * h; a.y += a.vy * h;
      }
    }
    // след: точки ставим по пути самой лампы каждые ~20 px, силу точки берём от силы лампы, дальше она гаснет гладко
    function trailOf(a, dt) {
      if (!a.on || calm || a.s < 0.02) { a.lx = a.x; a.ly = a.y; return; }
      var dx = a.x - a.lx, dy = a.y - a.ly, d = Math.sqrt(dx * dx + dy * dy), step = d / dt > 700 ? 30 : STEP;
      if (d < step) return;
      var ux = dx / d, uy = dy / d, c = Math.floor(d / step), k;
      for (k = 1; k <= c; k++) lights.push({ x: a.lx + ux * step * k, y: a.ly + uy * step * k, k: 1, d: 0, amp: TRAIL_K * (step / STEP) * a.s, dur: TRAIL, s: 0 });
      a.lx += ux * step * c; a.ly += uy * step * c;
      while (lights.length > MAXL) lights.shift();
    }
    function wpath(t) {
      var top = safe.t + 60, cx = vw / 2, cy = (top + vh) / 2, ax = vw * 0.34, ay = (vh - top) * 0.32;
      return { x: cx + ax * Math.sin(t * 0.21 + wph[0]) + ax * 0.35 * Math.sin(t * 0.53 + wph[1]), y: cy + ay * Math.sin(t * 0.17 + wph[2]) + ay * 0.35 * Math.sin(t * 0.41 + wph[3]) };
    }
    function poke() { lastAct = clk; wan.on = false; }

    function step(dt) {
      var k, j, L, s, p;
      // простой: через 7 с без касаний лампа блуждает
      if (!calm && !wan.on && wan.k <= 0 && !g && !lamp.on && clk - lastAct > IDLE) {
        for (k = 0; k < 4; k++) wph[k] = rnd(0, 6.283);
        p = wpath(clk / 1000); lampOn(wan, p.x, p.y); wan.k = 0;
      }
      if (wan.on) { p = wpath(clk / 1000); wan.tx = p.x; wan.ty = p.y; }
      stepLamp(lamp, dt); stepLamp(wan, dt);
      trailOf(lamp, dt); trailOf(wan, dt);
      if (!wan.on && wan.k <= 0) wan.s = 0;
      for (k = lights.length - 1; k >= 0; k--) {
        L = lights[k];
        if (L.k < 1) L.k = calm ? 1 : Math.min(1, L.k + dt * 1000 / RISE); else L.d += dt * 1000 / L.dur;
        if (L.d >= 1) { lights.splice(k, 1); continue; }
        L.s = calm ? L.amp : L.amp * sm(L.k) * (1 - sm(L.d));
      }
      act = [];
      if (lamp.s > 0.002) act.push(lamp);
      if (wan.s > 0.002) act.push(wan);
      for (k = 0; k < lights.length; k++) if (lights[k].s > 0.002) act.push(lights[k]);
      // сила света в центре каждого знака; освещён ли знак хоть где-то (для смены знаков)
      for (j = 0; j < slots.length; j++) { slots[j].f = 1; slots[j].lit = false; }
      for (k = 0; k < act.length; k++) {
        L = act[k]; L.rel = false;
        for (j = 0; j < slots.length; j++) {
          s = slots[j]; if (s.q < 0) continue;
          var dx = L.x - s.cx, dy = L.y - s.cy, d = Math.sqrt(dx * dx + dy * dy);
          if (d < R) s.f *= 1 - L.s * prof(d / R);
          dx = Math.max(s.tx - L.x, 0, L.x - (s.tx + s.tw)); dy = Math.max(s.ty - L.y, 0, L.y - (s.ty + s.th)); d = Math.sqrt(dx * dx + dy * dy);
          if (d < R) { L.rel = true; if (L.s * prof(d / R) > 0.01) s.lit = true; }
        }
      }
      for (j = 0; j < slots.length; j++) { s = slots[j]; s.str = 1 - s.f; if (s.lit) s.litT = clk; }
      if (!calm) swaps(); else swapsCalm();
    }

    // ---------------------------------------------------------------- смена знаков в темноте
    function canSwap(s) { return s.q >= 0 && s.q !== openQ && !g && clk - s.litT > 3000; }
    function swaps() {
      var P = null, k, s, c;
      for (k = 0; k < slots.length; k++) {
        s = slots[k];
        if (s.swap) {
          if (clk < s.swap) continue;
          s.swap = 0;
          if (!canSwap(s)) { s.wm.style.opacity = s.op.toFixed(3); s.next = clk + rnd(2000, 6000); continue; }
          P = P || pool(); c = P.length ? findFor(s, P, shownSet()) : null;
          if (c) { put(s, c.q, c.f.size, c.f.m); s.wm.style.opacity = '0'; void s.wm.offsetWidth; s.wm.style.opacity = s.op.toFixed(3); }
          else s.wm.style.opacity = s.op.toFixed(3);
          s.next = clk + rnd(20000, 40000);
        } else if (clk >= s.next) {
          if (!canSwap(s)) { s.next = clk + rnd(2000, 6000); continue; }
          s.swap = clk + 950; s.wm.style.opacity = '0';
        }
      }
    }
    function swapsCalm() {
      var P = null, k, s, c;
      for (k = 0; k < slots.length; k++) {
        s = slots[k];
        if (clk < s.next) continue;
        if (!canSwap(s)) { s.next = clk + rnd(2000, 6000); continue; }
        P = P || pool(); c = P.length ? findFor(s, P, shownSet()) : null;
        if (c) put(s, c.q, c.f.size, c.f.m);
        s.next = clk + rnd(20000, 40000);
      }
    }

    // ---------------------------------------------------------------- кадр
    function maskOf() {
      var parts = [], k, j, L, st;
      for (k = 0; k < act.length; k++) {
        L = act[k]; if (!L.rel) continue;
        st = [];
        for (j = 0; j < STOPS.length; j++) st.push('rgba(0,0,0,' + (L.s * PROF[j]).toFixed(3) + ') ' + (STOPS[j] * R).toFixed(1) + 'px');
        parts.push('radial-gradient(circle ' + R + 'px at ' + L.x.toFixed(1) + 'px ' + L.y.toFixed(1) + 'px,' + st.join(',') + ')');
      }
      return parts.length ? parts.join(',') : EMPTY;
    }
    function paint() {
      if (!act.length && !hadLight) return;
      hadLight = act.length > 0;
      ctx.clearRect(0, 0, vw, vh);
      for (var k = 0; k < act.length; k++) {
        var L = act[k];
        ctx.globalAlpha = L.s > 1 ? 1 : L.s;
        ctx.drawImage(sprite, L.x - R, L.y - R, 2 * R, 2 * R);
      }
      ctx.globalAlpha = 1;
      var m = maskOf(); ink.style.webkitMaskImage = m; ink.style.maskImage = m;
    }
    function frame(now) {
      raf = 0;
      if (!active || paused || document.hidden) return;
      var dt = Math.min(0.05, (now - last) / 1000); last = now; clk += dt * 1000;
      step(dt); paint();
      raf = requestAnimationFrame(frame);
    }
    function start() { if (raf || !active || paused || document.hidden) return; last = performance.now(); raf = requestAnimationFrame(frame); }
    function halt() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function wipe() {
      lights = []; act = []; lamp.on = false; lamp.k = lamp.s = 0; wan.on = false; wan.k = wan.s = 0;
      hadLight = true; paint();
    }

    // ---------------------------------------------------------------- жесты
    function pt(e) { var r = scene.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    // проявленный вопрос под точкой: сила света в центре бокса выше порога
    function candidate(x, y) {
      var best = -1, bd = 1e9, k, s, dx, dy, d, pad = 14;
      for (k = 0; k < slots.length; k++) {
        s = slots[k];
        if (s.q < 0 || s.swap || s.str <= OPEN_AT) continue;
        if (x < s.tx - pad || x > s.tx + s.tw + pad || y < s.ty - pad || y > s.ty + s.th + pad) continue;
        dx = x - s.cx; dy = y - s.cy; d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    }
    function openSlot(k) {
      var s = slots[k]; if (!s || s.q < 0) return;
      api.open(s.q, s.ink, { opacity: api.isRead(s.q) ? 0.72 : 1, scale: 1 });
    }
    function onDown(e) {
      if (!active || paused || g) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var dead = api.popDown(), p = pt(e), cand = dead ? -1 : candidate(p.x, p.y);
      try { scene.setPointerCapture(e.pointerId); } catch (x) {}
      poke();
      g = { id: e.pointerId, type: e.pointerType, x0: p.x, y0: p.y, t: performance.now(), moved: false, dead: dead, cand: cand };
      if (!lamp.on) lampOn(lamp, p.x, p.y); else { lamp.tx = p.x; lamp.ty = p.y; }
      start();
    }
    function onMove(e) {
      if (!active || paused) return;
      var p = pt(e);
      if (g) {
        if (e.pointerId !== g.id) return;
        if (!g.moved && Math.sqrt(Math.pow(p.x - g.x0, 2) + Math.pow(p.y - g.y0, 2)) > 8) g.moved = true;
      } else if (e.pointerType === 'touch' || e.pointerType === '') return;   // палец без касания событий не шлёт; мышь и перо водят лампу и без нажатия
      poke();
      if (!lamp.on) lampOn(lamp, p.x, p.y); else { lamp.tx = p.x; lamp.ty = p.y; }
      start();
    }
    function onUp(e) {
      if (!g || e.pointerId !== g.id) return;
      var gg = g; g = null;
      try { scene.releasePointerCapture(e.pointerId); } catch (x) {}
      poke();
      var hover = gg.type === 'mouse' || gg.type === 'pen';
      if (!hover || e.type === 'pointercancel') releaseLamp();   // мышь ведёт лампу и дальше
      if (e.type === 'pointercancel' || gg.dead) return;
      if (!gg.moved && performance.now() - gg.t < 300 && gg.cand >= 0) openSlot(gg.cand);
    }
    scene.addEventListener('pointerdown', onDown);
    scene.addEventListener('pointermove', onMove);
    scene.addEventListener('pointerup', onUp);
    scene.addEventListener('pointercancel', onUp);
    scene.addEventListener('pointerleave', function (e) { if (!g && (e.pointerType === 'mouse' || e.pointerType === 'pen')) releaseLamp(); });
    scene.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    function relight() {
      if (relitQ < 0) return;
      var s = slotOf(relitQ); relitQ = -1;
      if (s) addRest(s.cx, s.cy, 0);
    }

    return {
      enter: function (o) {
        active = true; paused = false;
        FF = (getComputedStyle(document.documentElement).getPropertyValue('--f-serif') || '').trim() || 'Georgia, serif';
        clk = 0; lastAct = 0; openQ = -1; relitQ = -1; g = null;
        size(); layout(); wipe();
        if (o.q >= 0) ensure(o.q);
        start();
      },
      leave: function () {
        active = false; halt(); timers.forEach(clearTimeout); timers = []; g = null; wipe();
      },
      pause: function () { paused = true; halt(); },
      resume: function () { paused = false; lastAct = clk; relight(); start(); },
      resize: function () { if (!active) return; size(); layout(); wipe(); if (openQ >= 0) ensure(openQ); start(); },
      // тема сменилась: лист раскладывается заново из вопросов темы (свет остаётся)
      refresh: function () { layout(); if (openQ >= 0) ensure(openQ); },
      focus: function (q) { ensure(q); },
      // ответы открылись: лист гаснет, знак-источник скрыт (его заменяет летящая копия)
      onOpened: function (q) {
        var s = ensure(q);
        g = null; openQ = q; relitQ = q; wipe();
        if (s) {
          s.ink.style.visibility = 'hidden';
          s.ink.style.opacity = '0.72'; s.wm.style.opacity = (s.op * 0.7).toFixed(3);   // прочитанный тусклее
        }
      },
      // заголовок вернулся на место: знак снова виден, над ним снова горит свет и потом гаснет
      onClosed: function (q) {
        var s = slotOf(q); openQ = -1;
        if (s) s.ink.style.visibility = '';
        if (!paused) relight();
        lastAct = clk;
      },
      returnTarget: function (q) { var s = slotOf(q); return s && s.q >= 0 ? { el: s.ink, opacity: 0.72, scale: 1 } : null; },
      key: function (e) {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        if (e.target.tagName === 'BUTTON') return;
        e.preventDefault(); if (e.repeat) return;
        poke();
        var k, best = -1, bs = OPEN_AT, near = -1, nd = 1e9, dx, dy;
        for (k = 0; k < slots.length; k++) {
          if (slots[k].q < 0) continue;
          if (slots[k].str > bs) { bs = slots[k].str; best = k; }
          dx = slots[k].cx - vw / 2; dy = slots[k].cy - vh / 2;
          if (dx * dx + dy * dy < nd) { nd = dx * dx + dy * dy; near = k; }
        }
        if (best >= 0) openSlot(best);
        else if (near >= 0) { addRest(slots[near].cx, slots[near].cy, 0); start(); }   // Enter зажигает ближайший к центру, второй Enter открывает
      }
    };
  });
})();
