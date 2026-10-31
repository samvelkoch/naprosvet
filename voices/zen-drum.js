/* «Голоса_», Zen: режим «Барабан». Вертикальный барабан с вопросами и рычаг однорукого бандита.
   Дёрнул, барабан крутится и замедляется, встал на вопросе, касание открывает ответы. Регистрируется в хосте (zen.js). ES5, без библиотек. */
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
    var TH = 0.6;                  // доля хода рычага, после которой отпускание запускает барабан
    var FMAX = 2.18;               // наибольший угол рычага, рад (125°)
    var LL = 110;                  // длина рычага, px

    // ---- сцена
    var drum = el('div', 'zd'), meas = el('div', 'zd-m'), lever = el('div', 'zd-l'), hit = el('div', 'zd-h');
    var mkL = el('i', 'zd-t l'), mkR = el('i', 'zd-t r');
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'zd-s'); svg.setAttribute('aria-hidden', 'true');
    var rod = document.createElementNS(NS, 'line'), ball = document.createElementNS(NS, 'circle'), pivot = document.createElementNS(NS, 'circle');
    rod.setAttribute('class', 'rod'); ball.setAttribute('class', 'ball'); pivot.setAttribute('class', 'piv'); pivot.setAttribute('r', '3.2');
    svg.appendChild(rod); svg.appendChild(pivot); svg.appendChild(ball);
    hit.setAttribute('role', 'button'); hit.setAttribute('aria-label', 'Дёрнуть рычаг');
    lever.appendChild(svg); lever.appendChild(hit);
    scene.appendChild(drum); scene.appendChild(mkL); scene.appendChild(mkR); scene.appendChild(lever); scene.appendChild(meas);

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
    var vw = 0, vh = 0, dw = 300, hc = {}, lx = 0, lyp = 0;
    function qtext(q) { return api.data().questions[q].q; }
    function fullH(q) {
      var v = hc[q];
      if (v == null) { meas.textContent = qtext(q); v = hc[q] = Math.max(P, Math.ceil(meas.offsetHeight) + 26); }
      return v;
    }
    function layout() {
      vw = scene.clientWidth || window.innerWidth; vh = scene.clientHeight || window.innerHeight;
      dw = Math.max(200, Math.min(DWMAX, vw - 2 * PADX));
      meas.style.width = dw + 'px'; hc = {};
      for (var k = 0; k < NR; k++) { rows[k].n.style.width = dw + 'px'; rows[k].n.style.marginLeft = (-dw / 2) + 'px'; rows[k].t = NaN; }
      var mx = Math.max(6, (vw - dw) / 2 - 14);
      mkL.style.left = mx + 'px'; mkR.style.right = mx + 'px';
      var cy = vh / 2;
      lx = Math.min(vw - 30, (vw + dw) / 2 + 40);
      lyp = Math.max(cy + 150, Math.min(vh - 96, cy + 270));
      hit.style.left = (lx - 34) + 'px'; hit.style.top = (lyp - LL - 32) + 'px'; hit.style.height = (LL * 1.75 + 64) + 'px';
      svg.setAttribute('viewBox', '0 0 ' + vw + ' ' + vh); svg.setAttribute('width', vw); svg.setAttribute('height', vh);
      pivot.setAttribute('cx', lx); pivot.setAttribute('cy', lyp);
    }

    // ---- состояние движения
    var pos = 0, v = 0, st = 'idle';           // idle | drag | fling | ease
    var ez = null;                              // плавное движение: { p0, D, T, t0, lever }
    var ex = 0, er = NaN, armed = false;        // раскрытие центральной строки
    var hideQ = -1, active = false, paused = false, raf = 0, last = 0, lastRound = 0, wheelUntil = 0, wheelT = 0, ready = false;
    var lp = 0, lv = 0, lAuto = null, lHeld = false, lastTickAt = 0;   // рычаг: ход 0..1, скорость пружины, автотяга, пальцем

    // щелчок: только если браузер разрешает (после первого касания страницы)
    function vib(ms) {
      if (calm || !navigator.vibrate) return;
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
      try { navigator.vibrate(ms); } catch (e) {}
    }
    function nearest() { return Math.round(pos); }
    function settled(now) { return st === 'idle' && Math.abs(pos - Math.round(pos)) < 0.002 && now > wheelUntil; }

    function easeTo(D, T, lever) {
      if (Math.abs(D) < 0.002) { st = 'idle'; ez = null; pos = pos + D; ended(); kick(); return; }
      if (calm) { pos += D; st = 'idle'; ez = null; ended(); kick(); return; }
      ez = { p0: pos, D: D, T: T, t0: performance.now(), lever: !!lever }; st = 'ease'; v = 0; lastRound = Math.round(pos); kick();
    }
    function ended() { armed = true; }
    // свободное вращение пальцем закончилось: ленту надо довести до строки, продолжая движение в ту же сторону
    function settleFrom(vel) {
      if (Math.abs(vel) < 1) { var D0 = Math.round(pos) - pos; easeTo(D0, 0.26 + 0.1 * Math.abs(D0)); return; }
      var dir = vel > 0 ? 1 : -1, tg = Math.round(pos + vel * TAU);
      if ((tg - pos) * dir < 0.2) tg = dir > 0 ? Math.ceil(pos + 0.2) : Math.floor(pos - 0.2);
      var D = tg - pos;
      easeTo(D, Math.max(0.3, Math.min(1.3, 3 * Math.abs(D) / Math.abs(vel))));
    }
    // запуск вращения рычагом: сила 0..1 даёт число строк и время (2.6–3.9 с, быстрый старт и долгое замедление)
    function spin(power) {
      var rows0 = 12 + Math.round(power * 20 + Math.random() * 3), T = 2.6 + power + Math.random() * 0.3;
      var tg = Math.round(pos) - rows0;
      easeTo(tg - pos, T, true);
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
      // рычаг
      var phi = Math.max(-0.05, lp) * FMAX, bx = lx + LL * Math.sin(phi) * 0.16, by = lyp - LL * Math.cos(phi), rr = 10 * (1 + 0.38 * Math.sin(Math.max(0, phi)));
      rod.setAttribute('x1', lx); rod.setAttribute('y1', lyp); rod.setAttribute('x2', bx.toFixed(1)); rod.setAttribute('y2', by.toFixed(1));
      ball.setAttribute('cx', bx.toFixed(1)); ball.setAttribute('cy', by.toFixed(1)); ball.setAttribute('r', rr.toFixed(1));
    }

    // возвращает true, пока что-то движется
    function step(now, dt) {
      var busy = false;
      if (st === 'fling') {
        pos += v * dt; v *= Math.exp(-dt / TAU);
        if (Math.abs(v) < 3.5) { settleFrom(v); } else busy = true;
      }
      if (st === 'ease') {
        var s = (now - ez.t0) / (ez.T * 1000);
        if (s >= 1) { pos = ez.p0 + ez.D; st = 'idle'; ez = null; ended(); }
        else {
          var e = 1 - Math.pow(1 - s, 3); pos = ez.p0 + ez.D * e; busy = true;
          var rr = Math.round(pos);
          if (rr !== lastRound) { lastRound = rr; if (ez.lever && Math.abs(ez.p0 + ez.D - pos) <= 6.5) vib(4); }   // щелчки на последних строках
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
      // рычаг: пружина возврата и автотяга
      if (lAuto) {
        var u = Math.min(1, (now - lAuto.t0) / 150); lp = 0.9 * (1 - Math.pow(1 - u, 2)); busy = true;
        if (u >= 1) { lAuto = null; spin(lAuto0); lv = 0; vib(8); }
      } else if (!lHeld && (lp > 0.0005 || Math.abs(lv) > 0.001)) {
        lv += (-180 * lp - 17 * lv) * dt; lp += lv * dt;
        if (lp < -0.05) { lp = -0.05; lv = Math.max(lv, 0); }
        if (Math.abs(lp) < 0.0008 && Math.abs(lv) < 0.01) { lp = 0; lv = 0; }
        busy = true;
      } else if (lHeld) busy = true;
      return busy;
    }
    var lAuto0 = 0.5;

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
    function dy2pull(dy) { return dy <= 0 ? 0 : 1 - Math.exp(-dy / 115); }
    function onDown(e) {
      if (!active || paused || g) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var dead = api.popDown();
      try { scene.setPointerCapture(e.pointerId); } catch (x) {}
      var onLever = e.target === hit;
      var now = performance.now();
      if (onLever) {
        if (st === 'ease' || st === 'fling') { /* рычаг можно тянуть и на ходу: вращение не прерываем */ }
        g = { id: e.pointerId, kind: 'lever', y0: e.clientY, x0: e.clientX, moved: false, dead: dead, dy: 0 };
        lAuto = null; lHeld = true; samples.length = 0; samples.push({ t: now, y: e.clientY });
        kick();
      } else {
        var moving = st !== 'idle' || now <= wheelUntil || Math.abs(pos - Math.round(pos)) > 0.002;
        g = { id: e.pointerId, kind: 'drum', y0: e.clientY, x0: e.clientX, ly: e.clientY, moved: false, moving: moving, dead: dead, t0: now };
        if (moving) { st = 'idle'; ez = null; v = 0; }
        samples.length = 0; samples.push({ t: now, y: e.clientY });
        kick();
      }
    }
    function onMove(e) {
      if (!g || e.pointerId !== g.id) return;
      var now = performance.now(), y = e.clientY;
      samples.push({ t: now, y: y }); while (samples.length > 2 && now - samples[0].t > 100) samples.shift();
      if (g.kind === 'lever') {
        var dy = y - g.y0;
        if (!g.moved && Math.abs(dy) + Math.abs(e.clientX - g.x0) > 8) g.moved = true;
        g.dy = dy;
        var was = lp; lp = g.moved ? dy2pull(dy) : 0;
        if (was < TH && lp >= TH) vib(6);
        kick();
      } else {
        if (!g.moved && Math.abs(y - g.y0) > 8) { g.moved = true; st = 'drag'; ez = null; v = 0; }
        if (g.moved) { pos -= (y - g.ly) / P; }
        g.ly = y; kick();
      }
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
      var cancel = e.type === 'pointercancel';
      if (gg.kind === 'lever') {
        lHeld = false;
        var vy = velocity();
        if (!gg.moved) { if (!cancel && !gg.dead && st !== 'ease' && st !== 'fling') pullAuto(0.45 + Math.random() * 0.3); }
        else if (!cancel && lp >= TH && st !== 'ease' && st !== 'fling') {
          var power = Math.max(0, Math.min(1, 0.2 + 0.6 * Math.max(0, vy) / 1600 + (lp - TH) * 1.2));
          lv = Math.max(0, vy) / 4000;
          spin(power); if (calm) lp = 0;
        }
        kick(); return;
      }
      var now = performance.now();
      if (!gg.moved) {
        st = 'idle'; ez = null;
        if (cancel || gg.dead) { settleFrom(0); return; }
        if (gg.moving) { settleFrom(0); return; }   // касание на ходу только останавливает барабан
        tapRow(e.clientY); kick(); return;
      }
      if (calm) { st = 'idle'; ez = null; pos = Math.round(pos); ended(); kick(); return; }
      var vel = -velocity() / P;
      if (vel > 40) vel = 40; else if (vel < -40) vel = -40;
      if (Math.abs(vel) >= 3.5) { st = 'fling'; v = vel; kick(); }
      else { st = 'idle'; settleFrom(Math.abs(vel) < 1 ? 0 : vel); }
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
    // рычаг тянется сам (касание без протяжки, пробел): короткая анимация и запуск
    function pullAuto(power) {
      if (st === 'ease' || st === 'fling') return;
      if (calm) { spin(power); return; }
      lAuto = { t0: performance.now() }; lAuto0 = power; kick();
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
      lp = lv = 0; lAuto = null; lHeld = false; hideQ = -1; lastRound = 0;
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
      leave: function () { active = false; halt(); g = null; lHeld = false; clearTimeout(wheelT); },
      pause: function () { paused = true; halt(); },
      resume: function () { paused = false; kick(); },
      resize: function () { if (!active) return; var cp = pos; layout(); pos = cp; render(performance.now()); kick(); },
      refresh: function () { fresh(); render(performance.now()); kick(); },
      onOpened: function (q) {
        hideQ = q; g = null; lHeld = false; st = 'idle'; ez = null; lAuto = null; lp = lv = 0;
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
          if (armed && settled(now)) openCenter(); else if (st === 'idle') pullAuto(0.5 + Math.random() * 0.4);
        } else if (k === 'ArrowUp' || k === 'ArrowDown') {
          e.preventDefault();
          var d = k === 'ArrowUp' ? -1 : 1, tg = Math.round(pos) + d;
          if (st === 'ease' && ez && !ez.lever) tg = Math.round(ez.p0 + ez.D) + d;
          easeTo(tg - pos, 0.32);
        }
      }
    };
  });
})();
