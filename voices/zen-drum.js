/* «Голоса_», Zen: режим «Барабан». Вертикальный барабан с вопросами и колёсико с насечками у правого края.
   Колёсико — привод барабана: прокатил пальцем, барабан крутится синхронно и по инерции встаёт на вопросе, касание открывает ответы.
   Регистрируется в хосте (zen.js). ES5, без библиотек. */
(function () {
  'use strict';
  if (!window.VoicesZen) return;

  window.VoicesZen.register('drum', function (api, scene) {
    var el = api.el, calm = api.calm;
    var P = 40;                    // высота строки в сжатом виде, px
    var R = 230;                   // радиус цилиндра, px
    var NB = 8, NR = 2 * NB + 2;   // строк по каждую сторону центра и размер пула узлов
    var PADX = 20, DWMAX = 720;
    var TAU = 0.5;                 // трение свободного вращения пальцем, с
    var G = 16;                    // ход колёсика по дуге на одну строку барабана, px
    var PITCH = 4;                 // шаг насечек по дуге, px (G кратен PITCH: на строке барабана колёсико стоит на насечке)
    var WW = 24, HITW = 48, WEDGE = 4;   // видимая ширина колёсика, зона касания, отступ от края экрана, px
    var THM = 1.25;                // угол цилиндра, видимый по каждую сторону центра, рад
    var TAUW = 1.0;                // трение «тяжёлого» колёсика, с
    var WK = 0.55;                 // скорость броска колёсика → строк в секунду на px/с по дуге
    var VMAX = 32;                 // наибольшая скорость броска, строк/с

    // ---- сцена
    var drum = el('div', 'zd'), meas = el('div', 'zd-m'), hit = el('div', 'zd-h'), mkL = el('i', 'zd-t l'), mkW = el('i', 'zd-wm'), sa = el('i', 'zd-sa');
    var cv = document.createElement('canvas'), cx = cv.getContext('2d');
    hit.setAttribute('role', 'button'); hit.setAttribute('aria-label', 'Колёсико: прокатить барабан');
    hit.appendChild(cv);
    scene.appendChild(drum); scene.appendChild(mkL); scene.appendChild(hit); scene.appendChild(mkW); scene.appendChild(sa); scene.appendChild(meas);

    var rows = [], i;
    for (i = 0; i < NR; i++) {
      var rw = el('div', 'zd-r'), c = el('span', 'c'), f = el('span', 'f');
      rw.appendChild(c); rw.appendChild(f); drum.appendChild(rw);
      rows.push({ n: rw, c: c, f: f, t: NaN, q: -1, h: 0, vis: false, ys: 0, hs: 0 });
    }

    // ---- лента: бесконечная, из перетасованной колоды вопросов выбранной темы
    var tape = {}, lo = 0, hi = 0, deck = [], themeSeen = null, tmp = null;
    function shuffle(a) { for (var k = a.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)), x = a[k]; a[k] = a[j]; a[j] = x; } return a; }
    function pool() {
      var D = api.data(), p = [];
      for (var k = 0; k < D.questions.length; k++) if (api.matches(k)) p.push(k);
      return p.length ? p : D.questions.map(function (_, k) { return k; });
    }
    // следующий вопрос колоды; не повторяется, пока колода не кончилась, и не равен соседу, к которому приставляется
    function draw(avoid) {
      if (!deck.length) {
        deck = shuffle(pool());
        if (deck.length > 1 && deck[deck.length - 1] === avoid) { var s = deck.pop(); deck.unshift(s); }
      }
      return deck.pop();
    }
    function at(t) {
      while (t > hi) { tape[hi + 1] = draw(tape[hi]); hi++; }
      while (t < lo) { tape[lo - 1] = draw(tape[lo]); lo--; }
      return tape[t];
    }
    function resetTape(q) {
      tape = {}; lo = hi = 0; deck = [];
      tape[0] = q != null && q >= 0 ? q : draw(-1);
      if (q != null && q >= 0) { var k = deck.indexOf(q); if (k >= 0) deck.splice(k, 1); }
      pos = 0; themeSeen = api.theme();
    }

    // ---- размеры
    var vw = 0, vh = 0, dw = 300, hc = {}, wl = 0, Hw = 280, Rw = 140, wTop = 0, sTop = 0, dpr = 1, wRGB = '232,222,208', wDirty = true, wPos = NaN;
    function qtext(q) { return api.data().questions[q].q; }
    function fullH(q) {
      var v = hc[q];
      if (v == null) { meas.textContent = qtext(q); v = hc[q] = Math.max(P, Math.ceil(meas.offsetHeight) + 26); }
      return v;
    }
    function layout() {
      vw = scene.clientWidth || window.innerWidth; vh = scene.clientHeight || window.innerHeight;
      // колёсико у правого края с учётом выреза; колонка текста сужается симметрично, чтобы не налезать на него
      var saw = sa.offsetWidth || 0, wlMax = vw - saw - WEDGE - WW, pad = Math.max(PADX, vw - wlMax + 12);
      dw = Math.max(200, Math.min(DWMAX, vw - 2 * pad));
      wl = Math.round(Math.min(wlMax, (vw + dw) / 2 + 30));
      meas.style.width = dw + 'px'; hc = {};
      for (var k = 0; k < NR; k++) { rows[k].n.style.width = dw + 'px'; rows[k].n.style.marginLeft = (-dw / 2) + 'px'; rows[k].t = NaN; }
      mkL.style.left = Math.max(6, (vw - dw) / 2 - 14) + 'px';
      var cy = Math.round(vh / 2);
      Hw = 2 * Math.round(Math.max(150, Math.min(300, vh * 0.37)) / 2); Rw = (Hw / 2) / Math.sin(THM);
      wTop = cy - Hw / 2;
      var hl = wl - (HITW - WW) / 2;
      hit.style.left = hl + 'px'; hit.style.width = Math.min(HITW, vw - hl) + 'px'; hit.style.top = (wTop - 18) + 'px'; hit.style.height = (Hw + 36) + 'px';
      cv.style.left = (wl - hl) + 'px'; cv.style.top = '18px';
      dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.width = Math.round(WW * dpr); cv.height = Math.round(Hw * dpr); cv.style.width = WW + 'px'; cv.style.height = Hw + 'px';
      mkW.style.left = (wl - 9) + 'px'; mkW.style.width = (WW + 9) + 'px'; mkW.style.top = cy + 'px';
      sTop = scene.getBoundingClientRect().top;
      var m = /rgba?\((\d+)\D+(\d+)\D+(\d+)/.exec(getComputedStyle(cv).color || '');
      wRGB = m ? m[1] + ',' + m[2] + ',' + m[3] : '232,222,208';
      wDirty = true;
    }

    // ---- колёсико: торец цилиндра с насечками; фаза целиком берётся из pos, поэтому оно всегда синхронно с барабаном
    function drawWheel() {
      wDirty = false; wPos = pos;
      var S = pos * G, base = Math.floor(S / PITCH), off = S - base * PITCH, c = Hw / 2, j, n = Math.ceil(THM * Rw / PITCH) + 2, k, gr, t;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.globalCompositeOperation = 'source-over'; cx.clearRect(0, 0, WW, Hw);
      // объём: едва заметное тело, светлее к центру, и узкий блик чуть выше центра
      gr = cx.createLinearGradient(0, 0, 0, Hw);
      for (k = 0; k <= 20; k++) { t = k / 10 - 1; var cs0 = Math.sqrt(1 - Math.pow(t * Math.sin(THM), 2)); gr.addColorStop(k / 20, 'rgba(' + wRGB + ',' + (0.07 * cs0 * cs0).toFixed(3) + ')'); }
      cx.fillStyle = gr; cx.fillRect(0, 0, WW, Hw);
      gr = cx.createLinearGradient(0, c - 0.2 * Rw - 16, 0, c - 0.2 * Rw + 16);
      gr.addColorStop(0, 'rgba(' + wRGB + ',0)'); gr.addColorStop(0.5, 'rgba(' + wRGB + ',0.07)'); gr.addColorStop(1, 'rgba(' + wRGB + ',0)');
      cx.fillStyle = gr; cx.fillRect(0, 0, WW, Hw);
      // насечки: шаг ~ cos угла, непрозрачность падает к краям
      cx.fillStyle = 'rgb(' + wRGB + ')';
      for (j = -n; j <= n; j++) {
        var ph = (j * PITCH - off) / Rw, aph = Math.abs(ph);
        if (aph >= THM) continue;
        var cs = Math.cos(ph), a = 0.64 * Math.pow(cs, 1.5) * Math.min(1, (THM - aph) / 0.3);
        cx.globalAlpha = a; cx.fillRect(0, c + Rw * Math.sin(ph), WW, 1);
      }
      cx.globalAlpha = 1;
      // растворение: по вертикали в фон, по горизонтали концы насечек мягко сходят на нет
      cx.globalCompositeOperation = 'destination-in';
      gr = cx.createLinearGradient(0, 0, 0, Hw);
      var vs = [0, 0.06, 0.14, 0.24, 0.36, 0.5], vk;
      for (vk = 0; vk < vs.length; vk++) { var va = Math.pow(Math.min(1, vk / (vs.length - 1) * 1.15), 1.6); gr.addColorStop(vs[vk], 'rgba(0,0,0,' + va.toFixed(3) + ')'); gr.addColorStop(1 - vs[vk], 'rgba(0,0,0,' + va.toFixed(3) + ')'); }
      cx.fillStyle = gr; cx.fillRect(0, 0, WW, Hw);
      gr = cx.createLinearGradient(0, 0, WW, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0.15)'); gr.addColorStop(0.2, '#000'); gr.addColorStop(0.8, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0.15)');
      cx.fillStyle = gr; cx.fillRect(0, 0, WW, Hw);
      cx.globalCompositeOperation = 'source-over';
    }

    // ---- состояние движения
    var pos = 0, v = 0, st = 'idle';           // idle | drag | fling | ease
    var ez = null;                              // плавное движение: { p0, D, T, t0, click }
    var ex = 0, er = NaN, armed = false;        // раскрытие центральной строки
    var hideQ = -1, active = false, paused = false, raf = 0, last = 0, lastRound = 0, wheelUntil = 0, wheelT = 0, ready = false;
    var ftau = TAU, fclick = false;             // свободное вращение: трение и щелчки (колёсико — тяжелее и с щелчками)

    // щелчок: только если браузер разрешает (после первого касания страницы)
    function vib(ms) {
      if (calm || !navigator.vibrate) return;
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
      try { navigator.vibrate(ms); } catch (e) {}
    }
    function nearest() { return Math.round(pos); }
    function settled(now) { return st === 'idle' && Math.abs(pos - Math.round(pos)) < 0.002 && now > wheelUntil; }

    function easeTo(D, T, click) {
      if (Math.abs(D) < 0.002) { st = 'idle'; ez = null; pos = pos + D; ended(); kick(); return; }
      if (calm) { pos += D; st = 'idle'; ez = null; ended(); kick(); return; }
      ez = { p0: pos, D: D, T: T, t0: performance.now(), click: !!click }; st = 'ease'; v = 0; lastRound = Math.round(pos); kick();
    }
    function ended() { armed = true; }
    // свободное вращение пальцем закончилось: ленту надо довести до строки, продолжая движение в ту же сторону
    function settleFrom(vel, tau, click) {
      if (Math.abs(vel) < 1) { var D0 = Math.round(pos) - pos; easeTo(D0, 0.26 + 0.1 * Math.abs(D0), click); return; }
      var dir = vel > 0 ? 1 : -1, tg = Math.round(pos + vel * (tau || TAU));
      if ((tg - pos) * dir < 0.2) tg = dir > 0 ? Math.ceil(pos + 0.2) : Math.floor(pos - 0.2);
      var D = tg - pos;
      easeTo(D, Math.max(0.3, Math.min(1.3, 3 * Math.abs(D) / Math.abs(vel))), click);
    }
    // лёгкий запуск колёсика касанием: 12–30 строк в сторону dir (+1 — насечки вверх), долгое замедление 2.4–4 с
    function spin(dir) {
      var n = 12 + Math.floor(Math.random() * 19), T = 2.4 + (n - 12) / 18 * 1.2 + Math.random() * 0.3;
      easeTo(Math.round(pos) + dir * n - pos, T, true);
    }

    // ---- кадр
    var hold = { on: false };
    function rowFor(t) { return rows[((t % NR) + NR) % NR]; }

    function render(now) {
      var a = Math.floor(pos), f = pos - a, lo2 = a - NB, hi2 = a + NB + 1, k, t, H = [], Y = [], r, exE = ex * ex * (3 - 2 * ex);
      for (t = lo2; t <= hi2; t++) {
        var q = at(t);
        H.push(t === er && exE > 0.001 ? P + (fullH(q) - P) * exE : P);
      }
      var ia = a - lo2;
      Y[ia] = 0;
      for (k = ia + 1; k < H.length; k++) Y[k] = Y[k - 1] + (H[k - 1] + H[k]) / 2;
      for (k = ia - 1; k >= 0; k--) Y[k] = Y[k + 1] - (H[k + 1] + H[k]) / 2;
      var shift = f * (H[ia] + H[ia + 1]) / 2;
      for (t = lo2; t <= hi2; t++) {
        k = t - lo2; r = rowFor(t);
        var y = Y[k] - shift, th = y / R, h = H[k], aq = at(t);
        if (r.t !== t) {
          r.t = t; r.q = aq; r.c.textContent = qtext(aq); r.f.textContent = ''; r.fq = -1;
        }
        if (Math.abs(th) > 1.3) { if (r.vis) { r.n.style.visibility = 'hidden'; r.vis = false; } continue; }
        if (!r.vis) { r.n.style.visibility = 'visible'; r.vis = true; }
        var cs = Math.cos(th), w = Math.max(0, 1 - Math.abs(t - pos) * 1.3), op = Math.pow(cs, 4) * (0.5 + 0.5 * w);
        if (api.isRead(aq)) op *= 0.62;
        var isEr = t === er && exE > 0.001;
        if (isEr && r.fq !== aq) { r.f.textContent = qtext(aq); r.fq = aq; }
        else if (!isEr && r.fq !== -1) { r.f.textContent = ''; r.fq = -1; }
        if (hideQ === aq && isEr) { r.f.style.opacity = 0; r.c.style.opacity = 0; }
        else if (isEr) {
          r.f.style.opacity = Math.min(1, Math.max(0, (exE - 0.1) / 0.8)).toFixed(3);
          r.c.style.opacity = Math.max(0, 1 - exE * 2).toFixed(3);
          op = Math.max(op, exE);
        } else { r.f.style.opacity = 0; r.c.style.opacity = 1; }
        if (r.h !== h) { r.h = h; r.n.style.height = h.toFixed(1) + 'px'; }
        r.ys = vh / 2 + R * Math.sin(th); r.hs = h * cs;
        r.n.style.opacity = op.toFixed(3);
        r.n.style.transform = 'translate3d(0,' + (R * Math.sin(th) - h / 2).toFixed(2) + 'px,0) rotateX(' + (-th * 57.2958).toFixed(2) + 'deg)';
      }
      if (wDirty || pos !== wPos) drawWheel();
    }

    // возвращает true, пока что-то движется
    function step(now, dt) {
      var busy = false;
      if (st === 'fling') {
        pos += v * dt; v *= Math.exp(-dt / ftau);
        var fr = Math.round(pos);
        if (fr !== lastRound) { lastRound = fr; if (fclick && Math.abs(v) * ftau <= 6.5) vib(3); }   // щелчки на последних строках
        if (Math.abs(v) < 3.5) { settleFrom(v, ftau, fclick); } else busy = true;
      }
      if (st === 'ease') {
        var s = (now - ez.t0) / (ez.T * 1000);
        if (s >= 1) { pos = ez.p0 + ez.D; st = 'idle'; ez = null; ended(); }
        else {
          var e = 1 - Math.pow(1 - s, 3); pos = ez.p0 + ez.D * e; busy = true;
          var rr = Math.round(pos);
          if (rr !== lastRound) { lastRound = rr; if (ez.click && Math.abs(ez.p0 + ez.D - pos) <= 6.5) vib(3); }   // щелчки на последних строках
        }
      }
      if (st === 'drag') busy = true;
      // раскрытие центральной строки, когда барабан встал
      var want = settled(now) ? 1 : 0;
      if (want) { if (isNaN(er) || er !== Math.round(pos)) { if (ex > 0.001) { ex = Math.max(0, ex - dt / 0.14); busy = true; } else er = Math.round(pos); } }
      if (want && er === Math.round(pos)) { if (ex < 1) { ex = calm ? 1 : Math.min(1, ex + dt / 0.42); busy = true; } }
      else if (!want && ex > 0) { ex = calm ? 0 : Math.max(0, ex - dt / 0.15); busy = true; }
      if (ex <= 0 && !want) er = NaN;
      if (!want && st === 'idle' && now <= wheelUntil) busy = true;
      return busy;
    }

    function frame(now) {
      raf = 0;
      if (!active || paused || document.hidden) return;
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      var busy = step(now, dt);
      render(now);
      if (busy || (ex > 0 && ex < 1)) raf = requestAnimationFrame(frame);
    }
    function kick() { if (raf || !active || paused || document.hidden || !ready) return; last = performance.now(); raf = requestAnimationFrame(frame); }
    function halt() { if (raf) cancelAnimationFrame(raf); raf = 0; }

    // ---- открытие ответов
    function centerRow() { var t = nearest(); var r = rowFor(t); return r.t === t ? r : null; }
    function openCenter() {
      var now = performance.now();
      if (!settled(now)) return;
      var t = nearest();
      if (isNaN(er) || er !== t) { er = t; }
      ex = 1; render(now);                 // касание до конца раскрытия: раскрываем сразу, чтобы полёт начался от готового текста
      var r = centerRow(); if (!r) return;
      api.open(r.q, r.f, { opacity: 1, scale: 1 });
    }

    // ---- жесты
    var g = null, samples = [];
    function onDown(e) {
      if (!active || paused || g) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var dead = api.popDown();
      try { scene.setPointerCapture(e.pointerId); } catch (x) {}
      var now = performance.now(), moving = st !== 'idle' || now <= wheelUntil || Math.abs(pos - Math.round(pos)) > 0.002;
      var onW = e.target === hit;
      // касание на ходу останавливает барабан, дальше можно тянуть и колёсико, и ленту
      g = { id: e.pointerId, kind: onW ? 'wheel' : 'drum', y0: e.clientY, x0: e.clientX, ly: e.clientY, moved: false, moving: moving, dead: dead, t0: now, arc: 0 };
      if (moving) { st = 'idle'; ez = null; v = 0; }
      samples.length = 0; samples.push({ t: now, y: onW ? 0 : e.clientY });
      if (onW) hit.classList.add('on');
      kick();
    }
    function onMove(e) {
      if (!g || e.pointerId !== g.id) return;
      var now = performance.now(), y = e.clientY;
      if (g.kind === 'wheel') {
        // ход по дуге под пальцем: вне центра цилиндра экранное смещение меньше дуги в 1/cos раз
        var u = Math.max(-1, Math.min(1, (y - sTop - wTop - Hw / 2) / Rw)), cs = Math.max(Math.cos(THM), Math.sqrt(1 - u * u));
        if (g.moved) { g.arc += (y - g.ly) / cs; pos -= (y - g.ly) / cs / G; }
        else if (Math.abs(y - g.y0) > 6) { g.moved = true; st = 'drag'; ez = null; v = 0; g.arc += (y - g.ly) / cs; pos -= (y - g.ly) / cs / G; }
        samples.push({ t: now, y: g.arc });
      } else {
        samples.push({ t: now, y: y });
        if (!g.moved && Math.abs(y - g.y0) > 8) { g.moved = true; st = 'drag'; ez = null; v = 0; }
        if (g.moved) { pos -= (y - g.ly) / P; }
      }
      while (samples.length > 2 && now - samples[0].t > 100) samples.shift();
      g.ly = y; kick();
    }
    function velocity() {
      var l = samples[samples.length - 1], f = samples[0], now = performance.now();
      if (samples.length < 2 || now - l.t > 90) return 0;
      var dt = (l.t - f.t) / 1000; return dt > 0.008 ? (l.y - f.y) / dt : 0;
    }
    function onUp(e) {
      if (!g || e.pointerId !== g.id) return;
      var gg = g; g = null;
      try { scene.releasePointerCapture(e.pointerId); } catch (x) {}
      hit.classList.remove('on');
      var cancel = e.type === 'pointercancel', w = gg.kind === 'wheel';
      if (!gg.moved) {
        st = 'idle'; ez = null;
        if (cancel || gg.dead) { settleFrom(0); return; }
        if (gg.moving) { settleFrom(0); return; }   // касание на ходу только останавливает барабан
        if (w) tapWheel(e.clientY); else tapRow(e.clientY);
        kick(); return;
      }
      if (calm) { st = 'idle'; ez = null; pos = Math.round(pos); ended(); kick(); return; }
      var vel = -velocity() / (w ? G : P), lim = w ? VMAX : 40;
      if (w) vel *= WK;
      if (vel > lim) vel = lim; else if (vel < -lim) vel = -lim;
      ftau = w ? TAUW : TAU; fclick = w;
      if (Math.abs(vel) >= 3.5) { st = 'fling'; v = vel; lastRound = Math.round(pos); kick(); }
      else { st = 'idle'; settleFrom(Math.abs(vel) < 1 ? 0 : vel, ftau, fclick); }
    }
    function tapRow(y) {
      var best = null, bd = 1e9, k;
      for (k = 0; k < NR; k++) {
        var r = rows[k]; if (!r.vis || isNaN(r.t)) continue;
        var d = Math.abs(y - r.ys);
        if (d <= Math.max(14, r.hs / 2) && d < bd) { bd = d; best = r; }
      }
      if (!best) return;
      if (best.t === nearest()) { if (settled(performance.now())) openCenter(); return; }
      var D = best.t - pos;
      easeTo(D, Math.max(0.35, Math.min(0.9, 0.3 + 0.09 * Math.abs(D))));
    }
    // касание колёсика без протяжки: лёгкий запуск; верхняя половина гонит насечки вверх, нижняя вниз
    function tapWheel(y) {
      if (st === 'ease' || st === 'fling') return;
      var d = y - sTop - wTop - Hw / 2;
      spin(Math.abs(d) < 10 ? (Math.random() < 0.5 ? 1 : -1) : d < 0 ? 1 : -1);
    }
    function onWheel(e) {
      e.preventDefault();
      if (!active || paused) return;
      var dy = e.deltaY; if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= vh;
      if (st === 'ease' || st === 'fling') { st = 'idle'; ez = null; v = 0; }
      pos += Math.max(-3, Math.min(3, dy / 100)); wheelUntil = performance.now() + 170;
      clearTimeout(wheelT);
      wheelT = setTimeout(function () { if (active && !paused && !g) settleFrom(0); }, 180);
      kick();
    }

    scene.addEventListener('pointerdown', onDown);
    scene.addEventListener('pointermove', onMove);
    scene.addEventListener('pointerup', onUp);
    scene.addEventListener('pointercancel', onUp);
    scene.addEventListener('wheel', onWheel, { passive: false });
    scene.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // ---- интерфейс режима
    function fresh(q) {
      layout(); resetTape(q);
      st = 'idle'; ez = null; v = 0; ex = q != null && q >= 0 ? 1 : 0; er = q != null && q >= 0 ? 0 : NaN; armed = false;
      hideQ = -1; lastRound = 0; ftau = TAU; fclick = false; hit.classList.remove('on'); wDirty = true;
      for (var k = 0; k < NR; k++) rows[k].t = NaN;
    }
    return {
      enter: function (o) {
        active = true; paused = false; ready = true;
        if (o.q >= 0) fresh(o.q);
        else if (themeSeen === null || themeSeen !== api.theme()) fresh();
        else layout();
        g = null; render(performance.now()); kick();
      },
      leave: function () { active = false; halt(); g = null; hit.classList.remove('on'); clearTimeout(wheelT); },
      pause: function () { paused = true; halt(); },
      resume: function () { paused = false; kick(); },
      resize: function () { if (!active) return; var cp = pos; layout(); pos = cp; render(performance.now()); kick(); },
      refresh: function () { fresh(); render(performance.now()); kick(); },
      onOpened: function (q) {
        hideQ = q; g = null; hit.classList.remove('on'); st = 'idle'; ez = null;
        var now = performance.now(); render(now);
      },
      onClosed: function () { hideQ = -1; armed = false; if (active) { render(performance.now()); kick(); } },
      returnTarget: function (q) {
        var r = centerRow();
        return r && r.q === q ? { el: r.f, opacity: 1, scale: 1 } : null;
      },
      // «назад»/«вперёд» к ответу: барабан должен стоять на этом вопросе
      focus: function (q) { if (at(nearest()) !== q) { fresh(q); render(performance.now()); } },
      key: function (e) {
        var k = e.key, now = performance.now();
        if (k === ' ' || k === 'Enter') {
          if (e.target.tagName === 'BUTTON') return;
          e.preventDefault(); if (e.repeat) return;
          if (armed && settled(now)) openCenter(); else if (st === 'idle') spin(-1);
        } else if (k === 'ArrowUp' || k === 'ArrowDown') {
          e.preventDefault();
          var d = k === 'ArrowUp' ? -1 : 1, tg = Math.round(pos) + d;
          if (st === 'ease' && ez && !ez.click) tg = Math.round(ez.p0 + ez.D) + d;
          easeTo(tg - pos, 0.32);
        }
      }
    };
  });
})();
