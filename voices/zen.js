/* «Голоса_»: режим Zen. Бесконечное поле вопросов (тор), инерция, магнит, экран ответов с полётом вопроса.
   Движок печати берём у страницы: window.VoicesType (index.html). Без библиотек, ES5. */
(function () {
  'use strict';
  window.zenReady = true;

  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function goal(name) { try { if (window.ym) window.ym(113309794, 'reachGoal', name); } catch (e) {} }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function load(key, def) { try { var v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  var K_READ = 'voices-zen-read', K_AUTH = 'voices-zen-authors', K_THEME = 'voices-zen-theme';
  var BG = '#120d0a';
  var AMP = 14;                         // наибольший размах собственного плавания вопроса, px мира
  var GAP = 2 * AMP + 14, PAD = GAP / 2; // зазор больше двух размахов: соседи плавают, но не сталкиваются
  var TAU = 0.45;                       // трение инерции, с
  var REST_V = 40;                      // ниже этой скорости (px/с) поле считается остановившимся
  var Z_MIN = 0.55, Z_MAX = 2.2;
  var IDLE = 6000, DRIFT = 8;           // через 6 с без касаний поле дрейфует до 8 px/с
    var ORDER = ['brodsky', 'chekhov', 'gary'];
  var SHORT = { brodsky: 'Бродский', chekhov: 'Чехов', gary: 'Гари' };
  var WHERE = { brodsky: 'Венеция, ноябрь 1993', chekhov: 'Ялта, январь 1900', gary: 'Париж, 1978–1980' };

  var T = null, D = null, prep = null, built = false;
  var root, field, tools, za, zwrap, popA, popT, btnA, btnT, btnX, metaTheme, oldTheme = '';
  var active = false, enteredPush = false, pushedAns = false, ansOpen = false, closing = false;

  // ---- мир ----
  var n = 0, X, Y, WD, HD, SZ, BASE, PH1, PH2, SP1, SP2, AM, PH3, SP3, OPS, LO, VIS, ACT, RD, LINES = [], NODES = [], IDX = {};
  var WW = 0, WH = 0, maxBW = 0, maxBH = 0;
  var camX = 0, camY = 0, zoom = 1, vw = 0, vh = 0, minZ = Z_MIN;
  var vx = 0, vy = 0;                   // скорость камеры, мир/с
  var FOC = -1, openIdx = -1, curQ = -1;
  var authors = { brodsky: true, chekhov: true, gary: true }, theme = '';
  var readIds = {};

  // ---- кадр ----
  var raf = 0, last = 0, lastInput = 0, driftAmt = 0, dAng = 0, pending = false, snap = null, wheelUntil = 0, touching = false;
  var dX = NaN, dY = NaN, dZ = NaN, forceDraw = true, introUntil = 0;

  // ---------------------------------------------------------------- раскладка на торе
  function ovl1(a, aw, b, bw, L) { var d = ((b - a) % L + L) % L; return d < aw || (L - d) < bw; }

  function buildWorld() {
    var cv = document.createElement('canvas').getContext('2d');
    var FF = (getComputedStyle(document.documentElement).getPropertyValue('--f-serif') || '').trim() || 'Georgia, serif';
    cv.font = '400 100px ' + FF;
    var wc = {}, sp = cv.measureText(' ').width;
    function ww(w) { var k = '$' + w, v = wc[k]; if (v === undefined) v = wc[k] = cv.measureText(w).width; return v; }
    function wrap(text, size, maxW) {
      var k = size / 100, words = text.replace(/\s+/g, ' ').trim().split(' '), lines = [], cur = '', curW = 0, best = 0;
      for (var i = 0; i < words.length; i++) {
        var w = ww(words[i]) * k;
        if (!cur) { cur = words[i]; curW = w; }
        else if (curW + sp * k + w <= maxW) { cur += ' ' + words[i]; curW += sp * k + w; }
        else { lines.push(cur); if (curW > best) best = curW; cur = words[i]; curW = w; }
      }
      lines.push(cur); if (curW > best) best = curW;
      return { lines: lines, w: best };
    }

    var qs = D.questions; n = qs.length;
    X = new Float64Array(n); Y = new Float64Array(n); WD = new Float64Array(n); HD = new Float64Array(n);
    SZ = new Float32Array(n); BASE = new Float32Array(n); PH1 = new Float32Array(n); PH2 = new Float32Array(n);
    SP1 = new Float32Array(n); SP2 = new Float32Array(n); AM = new Float32Array(n); PH3 = new Float32Array(n); SP3 = new Float32Array(n);
    OPS = new Float32Array(n); LO = new Float32Array(n); VIS = new Uint8Array(n); ACT = new Uint8Array(n); RD = new Uint8Array(n);
    LINES = []; IDX = {}; maxBW = 0; maxBH = 0;
    var AW = new Float64Array(n), AH = new Float64Array(n), sumA = 0, i, r, tier, size, em;
    for (i = 0; i < n; i++) {
      var q = qs[i]; IDX[q.id] = i;
      r = Math.random(); tier = r < 0.70 ? 0 : r < 0.92 ? 1 : 2;
      if (tier === 2 && q.q.length > 120) tier = 1;      // длинные вопросы крупными не бывают
      size = tier === 0 ? 14 + Math.random() * 3 : tier === 1 ? 20 + Math.random() * 5 : 30 + Math.random() * 12;
      em = tier === 0 ? 14 + Math.random() * 8 : tier === 1 ? 12 + Math.random() * 6 : 9 + Math.random() * 5;
      var m = wrap(q.q, size, em * size);
      SZ[i] = size; BASE[i] = 0.45 + Math.random() * 0.5; LINES.push(m.lines);
      WD[i] = Math.ceil(m.w) + 2; HD[i] = Math.ceil(m.lines.length * size * 1.25);
      AW[i] = WD[i] + GAP; AH[i] = HD[i] + GAP; sumA += AW[i] * AH[i];
      if (WD[i] > maxBW) maxBW = WD[i];
      if (HD[i] > maxBH) maxBH = HD[i];
      PH1[i] = Math.random() * 6.283; PH2[i] = Math.random() * 6.283;
      // плавание: своя фигура Лиссажу у каждого, период 9–25 с; дыхание яркости: период 5–13 с
      SP1[i] = 0.00025 + Math.random() * 0.00045; SP2[i] = 0.00025 + Math.random() * 0.00045; AM[i] = AMP * (0.55 + Math.random() * 0.45);
      PH3[i] = Math.random() * 6.283; SP3[i] = 0.00048 + Math.random() * 0.0008;
    }
    var order = []; for (i = 0; i < n; i++) order.push(i);
    order.sort(function (a, b) { return AW[b] * AH[b] - AW[a] * AH[a]; });   // крупные первыми

    var RX = new Float64Array(n), RY = new Float64Array(n), stamp = new Int32Array(n), st = 0;
    function tryPlace(W, H) {
      var gx = Math.max(3, Math.floor(W / 90)), gy = Math.max(3, Math.floor(H / 90)), cw = W / gx, ch = H / gy;
      var cells = new Array(gx * gy), k, j, c, rr, cc, list;
      for (k = 0; k < order.length; k++) {
        var a = order[k], aw = AW[a], ah = AH[a], ok = false;
        for (var att = 0; att < 300 && !ok; att++) {
          var x = Math.random() * W, y = Math.random() * H;
          var c0 = Math.floor(x / cw), c1 = Math.floor((x + aw) / cw), r0 = Math.floor(y / ch), r1 = Math.floor((y + ah) / ch);
          st++; ok = true;
          for (rr = r0; rr <= r1 && ok; rr++) for (cc = c0; cc <= c1 && ok; cc++) {
            list = cells[(rr % gy) * gx + (cc % gx)];
            if (!list) continue;
            for (j = 0; j < list.length; j++) {
              var b = list[j];
              if (stamp[b] === st) continue;
              stamp[b] = st;
              if (ovl1(x, aw, RX[b], AW[b], W) && ovl1(y, ah, RY[b], AH[b], H)) { ok = false; break; }
            }
          }
          if (ok) {
            RX[a] = x; RY[a] = y;
            for (rr = r0; rr <= r1; rr++) for (cc = c0; cc <= c1; cc++) {
              c = (rr % gy) * gx + (cc % gx);
              (cells[c] || (cells[c] = [])).push(a);
            }
          }
        }
        if (!ok) return false;
      }
      return true;
    }
    var W = Math.sqrt(1.6 * sumA), H = W, tries = 0;
    while (!tryPlace(W, H) && tries < 60) { W *= 1.06; H *= 1.06; tries++; }
    WW = W; WH = H;
    for (i = 0; i < n; i++) { X[i] = RX[i] + PAD; Y[i] = RY[i] + PAD; }
    var rep = check();
    try { console.info('[zen] раскладка: вопросов ' + n + ', мир ' + Math.round(WW) + '×' + Math.round(WH) + ', пересечений ' + rep.overlaps + ', зазор < ' + GAP + 'px: ' + rep.tight + ', попыток роста ' + tries); } catch (e) {}
  }

  // попарная проверка на торе: overlaps = боксы пересекаются, tight = зазор меньше GAP
  function check() {
    var o = 0, t = 0, i, j, e = PAD;
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      if (ovl1(X[i], WD[i], X[j], WD[j], WW) && ovl1(Y[i], HD[i], Y[j], HD[j], WH)) o++;
      if (ovl1(X[i] - e, WD[i] + 2 * e, X[j] - e, WD[j] + 2 * e, WW) && ovl1(Y[i] - e, HD[i] + 2 * e, Y[j] - e, HD[j] + 2 * e, WH)) t++;
    }
    return { n: n, overlaps: o, tight: t, W: WW, H: WH };
  }

  // ---------------------------------------------------------------- состояние вопросов
  function opacityOf(i) {
    if (i === openIdx) return 0;
    if (!ACT[i]) return 0.06;
    if (i === FOC) return 1;
    return BASE[i] * (RD[i] ? 0.5 : 1);
  }
  // дыхание: вопрос медленно разгорается и почти гаснет, у каждого свой ритм
  function breath(i, t) {
    if (calm) return 1;
    var b = 0.5 + 0.5 * Math.sin(t * SP3[i] + PH3[i]); b = b * b * (3 - 2 * b);
    return 0.1 + 0.9 * b;
  }
  function setOp(i) { OPS[i] = opacityOf(i); LO[i] = OPS[i] * breath(i, performance.now()); NODES[i].style.opacity = LO[i].toFixed(3); forceDraw = true; }
  function setFocus(i) { var o = FOC; if (o === i) return; FOC = i; if (o >= 0) setOp(o); if (i >= 0) setOp(i); }
  function applyTheme() {
    for (var i = 0; i < n; i++) { ACT[i] = !theme || D.questions[i].t.indexOf(theme) >= 0 ? 1 : 0; setOp(i); }
    if (FOC >= 0 && !ACT[FOC]) FOC = -1;
  }

  function buildNodes() {
    var i, nd;
    for (i = 0; i < NODES.length; i++) if (NODES[i].parentNode) NODES[i].parentNode.removeChild(NODES[i]);
    NODES = [];
    var frag = document.createDocumentFragment();
    for (i = 0; i < n; i++) {
      nd = el('div', 'zq', LINES[i].join('\n'));
      nd.style.fontSize = SZ[i].toFixed(2) + 'px';
      NODES.push(nd); frag.appendChild(nd);
    }
    field.appendChild(frag);
    for (i = 0; i < n; i++) RD[i] = readIds[D.questions[i].id] ? 1 : 0;
    applyTheme();
  }

  function measure() {
    if (!root) return;
    vw = root.clientWidth || window.innerWidth; vh = root.clientHeight || window.innerHeight;
    if (WW) minZ = Math.min(Z_MAX, Math.max(Z_MIN, vw / (WW - maxBW), vh / (WH - maxBH)));
    zoom = Math.max(minZ, Math.min(Z_MAX, zoom));
    forceDraw = true;
  }

  // экранная позиция бокса i (левый верхний угол) для текущей камеры; результат в px, py
  var px = 0, py = 0;
  function place(i, cx0, cy0, z) {
    var cx = X[i] + WD[i] * 0.5 - cx0; cx -= WW * Math.round(cx / WW);
    var cy = Y[i] + HD[i] * 0.5 - cy0; cy -= WH * Math.round(cy / WH);
    px = vw * 0.5 + (cx - WD[i] * 0.5) * z; py = vh * 0.5 + (cy - HD[i] * 0.5) * z;
  }
  function sway(i, tm) { if (calm) return; px += Math.sin(tm * SP1[i] + PH1[i]) * AM[i] * zoom; py += Math.sin(tm * SP2[i] + PH2[i]) * AM[i] * zoom; }

  // ---------------------------------------------------------------- кадр
  function draw(now) {
    var z = zoom, i, w, h, sx, sy, v, margin = 24 + AMP * z, nd, tr, o, live = now > introUntil;
    camX = ((camX % WW) + WW) % WW; camY = ((camY % WH) + WH) % WH;
    if (calm && !forceDraw && camX === dX && camY === dY && z === dZ) return;
    dX = camX; dY = camY; dZ = z; forceDraw = false;
    var zs = z.toFixed(4);
    for (i = 0; i < n; i++) {
      place(i, camX, camY, z);
      w = WD[i] * z; h = HD[i] * z; sx = px; sy = py;
      v = sx < vw + margin && sx + w > -margin && sy < vh + margin && sy + h > -margin;
      if (v) {
        sway(i, now);
        nd = NODES[i];
        if (VIS[i] !== 1) { nd.style.visibility = 'visible'; VIS[i] = 1; }
        nd.style.transform = 'translate3d(' + px.toFixed(2) + 'px,' + py.toFixed(2) + 'px,0) scale(' + zs + ')';
        if (live) { o = OPS[i] * breath(i, now); if (Math.abs(o - LO[i]) > 0.004) { LO[i] = o; nd.style.opacity = o.toFixed(3); } }
      } else if (VIS[i] !== 0) { NODES[i].style.visibility = 'hidden'; VIS[i] = 0; }
    }
  }

  function physics(now, dt) {
    if (snap) {
      var k = (now - snap.t0) / snap.dur;
      if (k >= 1) { k = 1; camX = snap.x0 + snap.dx; camY = snap.y0 + snap.dy; snap = null; }
      else { var e = 1 - Math.pow(1 - k, 3); camX = snap.x0 + snap.dx * e; camY = snap.y0 + snap.dy * e; }
      return;
    }
    if (touching) return;
    if (vx || vy) {
      camX += vx * dt; camY += vy * dt;
      var f = Math.exp(-dt / TAU); vx *= f; vy *= f;
      if (Math.abs(vx) + Math.abs(vy) < 0.5 / zoom) vx = vy = 0;
    }
    if (pending && now > wheelUntil && Math.sqrt(vx * vx + vy * vy) * zoom < REST_V) pending = false;
    if (calm) return;
    var idle = !snap && !vx && !vy && !pending && now - lastInput > IDLE;
    if (idle) {
      if (driftAmt === 0) { dAng = Math.random() * 6.283; setFocus(-1); }
      driftAmt = Math.min(1, driftAmt + dt / 3);
      var s = DRIFT * driftAmt * driftAmt * (3 - 2 * driftAmt);   // плавный разгон
      camX += Math.cos(dAng) * s * dt / zoom; camY += Math.sin(dAng) * s * dt / zoom;
    } else driftAmt = 0;
  }

  function frame(now) {
    raf = 0;
    if (!active || ansOpen || document.hidden || !built) return;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    physics(now, dt);
    draw(now);
    raf = requestAnimationFrame(frame);
  }
  function startLoop() { if (raf || !active || ansOpen || document.hidden || !built) return; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  function poke() { lastInput = performance.now(); driftAmt = 0; }
  function zoomAbout(sx, sy, f) {
    var z2 = Math.max(minZ, Math.min(Z_MAX, zoom * f));
    camX += (sx - vw * 0.5) * (1 / zoom - 1 / z2); camY += (sy - vh * 0.5) * (1 / zoom - 1 / z2);
    zoom = z2;
  }

  // ---------------------------------------------------------------- жесты
  var ptrs = {}, np = 0, tap = null, samples = [], pinch = null, movingT = 0;
  function setMoving(on) { clearTimeout(movingT); if (on) root.classList.add('moving'); else movingT = setTimeout(function () { root.classList.remove('moving'); }, 260); }

  function hitTest(x, y, cx0, cy0) {
    var best = -1, bd = 1e9, pad = 10, i, w, h, dx, dy, d;
    for (i = 0; i < n; i++) {
      if (!ACT[i]) continue;
      place(i, cx0, cy0, zoom); sway(i, performance.now());
      w = WD[i] * zoom; h = HD[i] * zoom;
      if (x < px - pad || x > px + w + pad || y < py - pad || y > py + h + pad) continue;
      dx = x - (px + w * 0.5); dy = y - (py + h * 0.5); d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function onDown(e) {
    if (ansOpen || !built) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var dead = false;
    if (popOpen()) { closePop(); dead = true; }
    try { field.setPointerCapture(e.pointerId); } catch (x) {}
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; np++;
    poke();
    var inertial = !!snap || Math.sqrt(vx * vx + vy * vy) * zoom > 25;
    snap = null; vx = vy = 0; touching = true;
    if (np === 1) {
      tap = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, stopped: inertial, dead: dead, cx: camX, cy: camY };
      samples.length = 0;
    } else if (np === 2) {
      var ids = Object.keys(ptrs), a = ptrs[ids[0]], b = ptrs[ids[1]];
      pinch = { d: Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      if (tap) tap.moved = true;
      setFocus(-1); setMoving(true);
    }
  }
  function onMove(e) {
    var p = ptrs[e.pointerId]; if (!p) return;
    var nx = e.clientX, ny = e.clientY;
    if (np === 1) {
      camX -= (nx - p.x) / zoom; camY -= (ny - p.y) / zoom;
      var now = performance.now();
      samples.push({ t: now, x: nx, y: ny });
      while (samples.length > 2 && now - samples[0].t > 100) samples.shift();
      if (tap && !tap.moved && Math.sqrt(Math.pow(nx - tap.x, 2) + Math.pow(ny - tap.y, 2)) > 8) { tap.moved = true; setFocus(-1); setMoving(true); field.classList.add('drag'); }
      p.x = nx; p.y = ny;
    } else if (np >= 2 && pinch) {
      p.x = nx; p.y = ny;
      var ids = Object.keys(ptrs), a = ptrs[ids[0]], b = ptrs[ids[1]];
      var d = Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      zoomAbout(pinch.mx, pinch.my, d / pinch.d);
      camX -= (mx - pinch.mx) / zoom; camY -= (my - pinch.my) / zoom;
      pinch.d = d; pinch.mx = mx; pinch.my = my;
    }
    poke(); forceDraw = true;
  }
  function onUp(e) {
    if (!ptrs[e.pointerId]) return;
    delete ptrs[e.pointerId]; np--;
    try { field.releasePointerCapture(e.pointerId); } catch (x) {}
    if (np > 0) { pinch = null; samples.length = 0; return; }
    np = 0; touching = false; pinch = null; field.classList.remove('drag'); setMoving(false); poke();
    var t = tap; tap = null;
    if (!t) return;
    var now = performance.now();
    if (!t.moved) {
      if (t.dead || e.type === 'pointercancel') return;
      if (t.stopped) { pending = true; return; }                // первое касание на ходу только останавливает поле
      if (now - t.t < 300) { var i = hitTest(t.x, t.y, t.cx, t.cy); if (i >= 0) openQ(i, true); }
      return;
    }
    var v = { x: 0, y: 0 };
    if (!calm && samples.length >= 2 && now - samples[samples.length - 1].t < 80) {
      var f = samples[0], l = samples[samples.length - 1], dt = (l.t - f.t) / 1000;
      if (dt > 0.008) { v.x = (l.x - f.x) / dt; v.y = (l.y - f.y) / dt; }
    }
    var sp = Math.sqrt(v.x * v.x + v.y * v.y), cap = 9000;
    if (sp > cap) { v.x *= cap / sp; v.y *= cap / sp; }
    vx = -v.x / zoom; vy = -v.y / zoom;
    pending = true;
  }
  function onWheel(e) {
    e.preventDefault();
    if (ansOpen || !built) return;
    var dx = e.deltaX, dy = e.deltaY;
    if (e.deltaMode === 1) { dx *= 16; dy *= 16; } else if (e.deltaMode === 2) { dx *= vw; dy *= vh; }
    poke(); snap = null; vx = vy = 0; setFocus(-1);
    if (e.ctrlKey) zoomAbout(e.clientX, e.clientY, Math.exp(-dy * 0.01));
    else { camX += dx / zoom; camY += dy / zoom; }
    pending = true; wheelUntil = performance.now() + 180; forceDraw = true;
  }

  function nearestCenter() {
    var best = -1, bd = 1e9, i, cx, cy, d;
    for (i = 0; i < n; i++) {
      if (!ACT[i]) continue;
      place(i, camX, camY, zoom);
      cx = px + WD[i] * zoom * 0.5 - vw * 0.5; cy = py + HD[i] * zoom * 0.5 - vh * 0.5; d = cx * cx + cy * cy;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function onKey(e) {
    if (!active) return;
    var k = e.key;
    // страница под слоем не должна реагировать (стрелки и пробел крутят барабан)
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown' || k === ' ' || k === 'Escape' || k === 'Enter') e.stopPropagation();
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (k === 'Escape') { e.preventDefault(); if (built && popOpen()) closePop(); else if (ansOpen) requestCloseAnswer(); else requestExit(); return; }
    if (ansOpen || !built) return;
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    var s = 650 / zoom, dx = 0, dy = 0;
    if (k === 'ArrowLeft') dx = -1; else if (k === 'ArrowRight') dx = 1; else if (k === 'ArrowUp') dy = -1; else if (k === 'ArrowDown') dy = 1;
    if (dx || dy) { e.preventDefault(); poke(); snap = null; setFocus(-1); vx = dx * s; vy = dy * s; pending = true; if (calm) { camX += dx * 80 / zoom; camY += dy * 80 / zoom; vx = vy = 0; forceDraw = true; } }
    else if (k === 'Enter' && e.target.tagName !== 'BUTTON') { var i = FOC >= 0 ? FOC : nearestCenter(); if (i >= 0) { e.preventDefault(); openQ(i, true); } }
  }

  // ---------------------------------------------------------------- иконки и поповеры
  function popOpen() { return popA.classList.contains('on') || popT.classList.contains('on'); }
  function closePop() { popA.classList.remove('on'); popT.classList.remove('on'); btnA.setAttribute('aria-expanded', 'false'); btnT.setAttribute('aria-expanded', 'false'); }
  function togglePop(p, b) {
    var was = p.classList.contains('on'); closePop();
    if (!was) { p.classList.add('on'); b.setAttribute('aria-expanded', 'true'); }
    poke();
  }
  function shake(node) { if (calm) return; node.classList.remove('shake'); void node.offsetWidth; node.classList.add('shake'); }
  function authCount() { var c = 0; ORDER.forEach(function (a) { if (authors[a]) c++; }); return c; }
  function paintAuthors() {
    var cs = btnA.querySelectorAll('circle');
    ORDER.forEach(function (a, k) { cs[k].setAttribute('fill', authors[a] ? 'currentColor' : 'none'); });
    [].forEach.call(popA.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(!!authors[b.dataset.a])); });
  }
  function paintThemes() {
    [].forEach.call(popT.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.t === theme)); });
    if (theme) btnT.setAttribute('data-on', ''); else btnT.removeAttribute('data-on');
  }
  function iconBtn(label, svg) {
    var b = el('button'); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.setAttribute('aria-haspopup', 'true');
    b.innerHTML = svg; return b;
  }

  function buildUI() {
    if (!root) { root = el('div'); root.id = 'zen'; document.body.appendChild(root); }
    root.setAttribute('aria-label', 'Zen');
    field = el('div', 'zf');
    tools = el('div', 'zt');
    btnA = iconBtn('Авторы', '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g stroke="currentColor" stroke-width="1.5"><circle cx="5" cy="12" r="2.7"/><circle cx="12" cy="12" r="2.7"/><circle cx="19" cy="12" r="2.7"/></g></svg>');
    btnT = iconBtn('Темы', '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g fill="currentColor"><circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/><circle cx="12" cy="19" r="2.2"/></g></svg><span class="dot"></span>');
    btnX = el('button'); btnX.type = 'button'; btnX.setAttribute('aria-label', 'Выйти из Zen'); btnX.title = 'Выйти из Zen';
    btnX.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M17.46 5.49A8.5 8.5 0 1 0 20.37 13.48" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    btnA.setAttribute('aria-expanded', 'false'); btnT.setAttribute('aria-expanded', 'false'); btnX.removeAttribute('aria-haspopup');
    tools.appendChild(btnA); tools.appendChild(btnT); tools.appendChild(btnX);

    popA = el('div', 'zp'); popA.setAttribute('role', 'group'); popA.setAttribute('aria-label', 'Авторы');
    ORDER.forEach(function (a) {
      var b = el('button'); b.type = 'button'; b.dataset.a = a; b.appendChild(el('i')); b.appendChild(document.createTextNode(SHORT[a]));
      b.addEventListener('click', function () {
        if (authors[a] && authCount() === 1) { shake(b); return; }      // хотя бы один автор включён всегда
        authors[a] = !authors[a]; save(K_AUTH, ORDER.filter(function (x) { return authors[x]; })); paintAuthors();
      });
      popA.appendChild(b);
    });
    popT = el('div', 'zp'); popT.setAttribute('role', 'group'); popT.setAttribute('aria-label', 'Темы');
    [{ id: '', title: 'Все' }].concat(D.themes).forEach(function (t) {
      var b = el('button'); b.type = 'button'; b.dataset.t = t.id; b.appendChild(el('i')); b.appendChild(document.createTextNode(t.title));
      b.addEventListener('click', function () { theme = t.id; save(K_THEME, theme); paintThemes(); if (built) applyTheme(); closePop(); });
      popT.appendChild(b);
    });

    za = el('div', 'za'); za.tabIndex = -1; zwrap = el('div', 'zw'); za.appendChild(zwrap);
    root.appendChild(field); root.appendChild(tools); root.appendChild(popA); root.appendChild(popT); root.appendChild(za);

    btnA.addEventListener('click', function () { togglePop(popA, btnA); });
    btnT.addEventListener('click', function () { togglePop(popT, btnT); });
    btnX.addEventListener('click', function () { requestExit(); });
    field.addEventListener('pointerdown', onDown);
    field.addEventListener('pointermove', onMove);
    field.addEventListener('pointerup', onUp);
    field.addEventListener('pointercancel', onUp);
    field.addEventListener('wheel', onWheel, { passive: false });
    field.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', function () { if (active) measure(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stopLoop(); else if (active) { poke(); startLoop(); } });
    initAnswerEvents();
    paintAuthors(); paintThemes();
  }

  // ---------------------------------------------------------------- экран ответов
  var openedAt = 0;   // касание, открывшее вопрос, не должно «прокликнуть» в карточку ответа
  var EXP = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true">' +
    '<g class="o"><path d="M12 3h5v5M17 3l-5.5 5.5M8 17H3v-5M3 17l5.5-5.5"/></g><g class="i"><path d="M17 8h-5V3M12 8l5.5-5.5M3 12h5v5M8 12l-5.5 5.5"/></g></svg>';
  var cols = [], typeRaf = 0, flyEl = null, flyAnim = null, closeAnims = [], titleCard = null, titleH2 = null;

  function buildAnswer(i) {
    var q = D.questions[i];
    zwrap.innerHTML = ''; cols = [];
    titleCard = el('section', 'zk'); titleH2 = el('h2', null, q.q); titleCard.appendChild(titleH2); zwrap.appendChild(titleCard);
    zwrap.classList.remove('exp');
    var single = authCount() < 2;
    ORDER.forEach(function (a) {
      if (!authors[a]) return;
      // блок автора не растёт: высота делится поровну, текст прокручивается внутри
      var card = el('article', 'zc'), hd = el('div', 'hd'), body = el('div', 'body');
      hd.appendChild(el('h3', null, SHORT[a]));
      hd.appendChild(el('span', 'who', D.authors[a].years + ' · ' + WHERE[a]));
      var bx = el('button', 'zx'); bx.type = 'button'; bx.innerHTML = EXP; bx.setAttribute('aria-label', 'Развернуть ответ'); bx.setAttribute('aria-expanded', 'false');
      bx.hidden = single; hd.appendChild(bx);
      card.appendChild(hd);
      var paras = T.answer(q.a[a]);
      var ps = paras.map(function (pa) { var p = el('p', 'later'); T.fillP(p, pa); body.appendChild(p); return p; });
      card.appendChild(body); zwrap.appendChild(card);
      var c = { a: a, card: card, body: body, bx: bx, ps: ps, paras: paras, pi: 0, ci: 0, acc: 0, wait: 650 + Math.random() * 450, done: false, follow: true };
      // пока читатель не тронул блок, он следит за печатью; тронул — прокрутка его
      function mine() { c.follow = false; }
      body.addEventListener('touchstart', mine, { passive: true });
      body.addEventListener('wheel', mine, { passive: true });
      body.addEventListener('scroll', function () { fade(c); }, { passive: true });
      bx.addEventListener('click', function (e) { e.stopPropagation(); expand(c); });
      cols.push(c);
    });
  }
  function fade(c) { var b = c.body; c.card.classList.toggle('more', b.scrollHeight - b.scrollTop - b.clientHeight > 4); }
  // один блок на весь экран, остальные сворачиваются до строки с именем; повторное касание возвращает поровну
  function expand(c) {
    var on = !c.card.classList.contains('big');
    cols.forEach(function (x) { x.card.classList.remove('big'); x.bx.setAttribute('aria-expanded', 'false'); x.bx.setAttribute('aria-label', 'Развернуть ответ'); });
    zwrap.classList.toggle('exp', on);
    if (on) { c.card.classList.add('big'); c.bx.setAttribute('aria-expanded', 'true'); c.bx.setAttribute('aria-label', 'Свернуть ответ'); }
    cols.forEach(function (x) { if (x.follow) x.body.scrollTop = x.body.scrollHeight; fade(x); });
  }
  function finishTyping() {
    if (typeRaf) cancelAnimationFrame(typeRaf); typeRaf = 0;
    cols.forEach(function (c) { c.done = true; c.follow = false; c.ps.forEach(function (p, k) { T.show(c.paras[k], Infinity); p.className = ''; }); c.body.scrollTop = 0; fade(c); });
  }
  function startTyping() {
    if (calm) return finishTyping();
    var lt = performance.now();
    typeRaf = requestAnimationFrame(function tick(now) {
      var dt = Math.min(now - lt, 64), busy = false; lt = now;
      for (var c = 0; c < cols.length; c++) {
        var x = cols[c]; if (x.done) continue;
        T.step(x, dt); if (!x.done) busy = true;
        if (x.follow) x.body.scrollTop = x.body.scrollHeight;
        fade(x);
      }
      typeRaf = busy ? requestAnimationFrame(tick) : 0;
    });
  }

  function makeFly(i) {
    var f = el('div', 'zfly', LINES[i].join('\n')); f.style.fontSize = SZ[i] + 'px'; root.appendChild(f); return f;
  }
  function dropFly() {
    if (flyAnim) { try { flyAnim.cancel(); } catch (e) {} flyAnim = null; }
    if (flyEl && flyEl.parentNode) flyEl.parentNode.removeChild(flyEl); flyEl = null;
  }
  function tf(x, y, k) { return 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) scale(' + k.toFixed(4) + ')'; }

  function openQ(i, fly) {
    if (ansOpen && !closing) return;
    if (closing) finishClose();
    history.pushState({ zen: 2 }, '', zenUrl(D.questions[i].id)); pushedAns = true;
    showAnswer(i, fly);
  }

  function showAnswer(i, fly) {
    if (closing) finishClose();
    var now = performance.now(), p0 = null, op0 = 0, col0 = '';
    if (fly && !calm && built) {   // состояние узла на момент касания, до всех сбросов
      place(i, camX, camY, zoom); sway(i, now); p0 = { x: px, y: py };
      var cs = getComputedStyle(NODES[i]); col0 = cs.color; op0 = parseFloat(cs.opacity);
    }
    ansOpen = true; closing = false; curQ = i; openedAt = now;
    stopLoop(); closePop(); setFocus(-1); setMoving(false); touching = false; np = 0; ptrs = {}; tap = null; vx = vy = 0; snap = null;
    goal('zen_q');
    readIds[D.questions[i].id] = 1; RD[i] = 1;
    save(K_READ, Object.keys(readIds));
    openIdx = i; setOp(i);
    buildAnswer(i);
    root.classList.add('ans'); za.classList.add('on'); za.scrollTop = 0; zwrap.style.transition = ''; zwrap.style.transform = '';
    try { za.focus({ preventScroll: true }); } catch (e) {}
    if (!p0) { titleCard.classList.add('show'); startTyping(); return; }
    // FLIP: копия вопроса с места в поле летит в заголовок
    var r = titleH2.getBoundingClientRect(), F = parseFloat(getComputedStyle(titleH2).fontSize), k = F / SZ[i];
    var col1 = getComputedStyle(titleH2).color;
    dropFly(); flyEl = makeFly(i);
    flyAnim = flyEl.animate([
      { transform: tf(p0.x, p0.y, zoom), color: col0, opacity: op0, fontStyle: 'normal' },
      { transform: tf(r.left, r.top, k), color: col1, opacity: 1, fontStyle: 'italic' }
    ], { duration: 480, easing: 'cubic-bezier(.16,.8,.3,1)', fill: 'forwards' });
    var fa = flyAnim;
    fa.onfinish = function () {
      if (flyAnim !== fa) return;
      titleCard.classList.add('show');
      var f = flyEl; flyAnim = null;
      var out = f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
      out.onfinish = function () { if (f.parentNode) f.parentNode.removeChild(f); if (flyEl === f) flyEl = null; };
    };
    titleCard.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, delay: 120, easing: 'ease-out', fill: 'backwards' });
    cols.forEach(function (c, j) {
      c.card.animate([{ transform: 'translateY(46px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 520, delay: 240 + j * 110, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
    });
    startTyping();
  }

  function requestCloseAnswer() { if (!ansOpen || closing) return; if (pushedAns) history.back(); else doClose(); }

  function doClose() {
    if (!ansOpen || closing) return;
    closing = true; pushedAns = false;
    if (typeRaf) cancelAnimationFrame(typeRaf); typeRaf = 0;
    var i = curQ, now = performance.now();
    if (calm) { finishClose(); return; }
    // копия заголовка с его нынешнего места летит назад в поле
    var r = titleH2.getBoundingClientRect(), F = parseFloat(getComputedStyle(titleH2).fontSize), k = F / SZ[i];
    var sx = r.left, sy = r.top;
    if (r.bottom < 0 || r.top > vh) { sx = Math.max(16, vw / 2 - 150); sy = 60; }
    var col1 = getComputedStyle(NODES[i]).color, col0 = getComputedStyle(titleH2).color;
    dropFly(); flyEl = makeFly(i);
    var f = flyEl;
    titleCard.classList.remove('show');                      // настоящий заголовок гаснет, летит копия
    place(i, camX, camY, zoom); sway(i, now);
    var op1 = BASE[i] * 0.5;                                 // прочитанный вопрос тусклее
    flyAnim = f.animate([
      { transform: tf(sx, sy, k), color: col0, opacity: 1, fontStyle: 'italic' },
      { transform: tf(px, py, zoom), color: col1, opacity: ACT[i] ? op1 : 0.06, fontStyle: 'normal' }
    ], { duration: 460, easing: 'cubic-bezier(.3,.1,.2,1)', fill: 'forwards' });
    var fa = flyAnim;
    closeAnims = [za.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-in', fill: 'forwards' })];
    root.classList.remove('ans');                            // поле проявляется, иконки возвращаются
    ansOpen = false; startLoopForClose();
    fa.onfinish = function () {
      if (flyAnim !== fa) return;
      flyAnim = null;
      openIdx = -1; setOp(i);
      var out = f.animate([{ opacity: ACT[i] ? op1 : 0.06 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
      out.onfinish = function () { if (f.parentNode) f.parentNode.removeChild(f); if (flyEl === f) flyEl = null; };
      cleanupAnswer();
    };
  }
  // поле рисуется ещё во время обратного полёта: ansOpen уже false, closing остаётся true до конца
  function startLoopForClose() { poke(); startLoop(); }
  function cleanupAnswer() {
    closeAnims.forEach(function (a) { try { a.cancel(); } catch (e) {} }); closeAnims = [];
    za.classList.remove('on'); zwrap.innerHTML = ''; zwrap.style.transition = ''; zwrap.style.transform = '';
    closing = false; cols = [];
  }
  function finishClose() {
    if (typeRaf) cancelAnimationFrame(typeRaf); typeRaf = 0;
    dropFly(); ansOpen = false; pushedAns = false;
    root.classList.remove('ans');
    if (openIdx >= 0) { var i = openIdx; openIdx = -1; setOp(i); }
    cleanupAnswer();
    if (active) { poke(); startLoop(); }
  }

  // свайп вниз с самого верха колонки и касание карточки вопроса: назад в поле
  function initAnswerEvents() {
    var pull = null;
    za.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1 || !ansOpen) { pull = null; return; }
      var b = e.target.closest ? e.target.closest('.body') : null;
      pull = { y: e.touches[0].clientY, b: b, top: !b || b.scrollTop <= 0, on: false, dy: 0 };
    }, { passive: true });
    za.addEventListener('touchmove', function (e) {
      if (!pull || !pull.top) return;
      if (pull.b && pull.b.scrollTop > 0) { pull.top = false; return; }
      var dy = e.touches[0].clientY - pull.y;
      if (dy <= 0) { if (!pull.on) return; dy = 0; }
      pull.on = true; pull.dy = dy;
      if (e.cancelable) e.preventDefault();
      zwrap.style.transition = 'none'; zwrap.style.transform = 'translateY(' + (dy * 0.55).toFixed(1) + 'px)';
    }, { passive: false });
    function release() {
      var p = pull; pull = null;
      if (!p || !p.on) return;
      if (p.dy >= 90) { requestCloseAnswer(); return; }
      zwrap.style.transition = 'transform .28s cubic-bezier(.2,.7,.2,1)'; zwrap.style.transform = '';
      setTimeout(function () { if (ansOpen) zwrap.style.transition = ''; }, 300);
    }
    za.addEventListener('touchend', release);
    za.addEventListener('touchcancel', function () { if (pull) pull.dy = 0; release(); });
    za.addEventListener('click', function (e) {
      if (!ansOpen || performance.now() - openedAt < 600) return;
      if (e.target.closest && e.target.closest('.zk')) { requestCloseAnswer(); return; }
      if (typeRaf && e.target.closest && e.target.closest('.zc')) finishTyping();   // касание по тексту: допечатать всё сразу
    });
  }

  // ---------------------------------------------------------------- вход и выход
  function inUrl() { return /[?&]zen\b/.test(location.search); }
  function zenUrl(id) { return location.pathname + '?zen' + (id ? '#' + id : ''); }
  function idFromHash() { var h = ''; try { h = decodeURIComponent(location.hash.slice(1)); } catch (e) {} return h && IDX[h] != null ? IDX[h] : -1; }

  function fontsReady() {
    var p = Promise.resolve();
    try {
      if (document.fonts && document.fonts.load) p = Promise.all([document.fonts.load('400 16px "PT Serif"', 'Вопрос'), document.fonts.load('italic 400 16px "PT Serif"', 'Вопрос')]);
    } catch (e) {}
    return Promise.race([p.then(function () {}, function () {}), new Promise(function (res) { setTimeout(res, 2500); })]);
  }
  function prepare() {
    if (prep) return prep;
    T = window.VoicesType; ORDER = T.ORDER; SHORT = T.SHORT; WHERE = T.WHERE;   // подписи авторов общие со страницей
    prep = Promise.all([
      fetch('data.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fontsReady()
    ]).then(function (res) {
      D = res[0];
      var a = load(K_AUTH, null);
      if (a && a.length) { authors = {}; ORDER.forEach(function (x) { authors[x] = a.indexOf(x) >= 0; }); if (!authCount()) authors = { brodsky: true, chekhov: true, gary: true }; }
      var th = load(K_THEME, ''); theme = '';
      D.themes.forEach(function (t) { if (t.id === th) theme = th; });
      (load(K_READ, []) || []).forEach(function (id) { readIds[id] = 1; });
      buildWorld();
      if (!field) buildUI();
      buildNodes(); paintAuthors(); paintThemes();
      built = true;
    });
    prep.catch(function () { prep = null; });
    return prep;
  }

  function enter(how) {
    if (active) return;
    active = true; window.zenActive = true;
    if (!root) { root = el('div'); root.id = 'zen'; document.body.appendChild(root); }   // слой нужен сразу, пока грузятся данные
    if (how === 'push') { history.pushState({ zen: 1 }, '', zenUrl()); enteredPush = true; }
    else if (how === 'pop') enteredPush = true;
    else enteredPush = false;
    goal('zen_open');
    document.documentElement.classList.add('zen-on');
    metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) { oldTheme = metaTheme.getAttribute('content'); metaTheme.setAttribute('content', BG); }
    root.classList.add('on');
    prepare().then(function () {
      if (!active) return;
      document.documentElement.classList.remove('zen-boot');
      measure();
      var id = how === 'push' ? -1 : idFromHash();
      zoom = Math.max(minZ, Math.min(Z_MAX, 1));
      if (!camX && !camY) { camX = Math.random() * WW; camY = Math.random() * WH; }
      for (var i = 0; i < n; i++) VIS[i] = 2;
      forceDraw = true;
      if (how === 'boot') {
        if (id >= 0) { history.replaceState({ zen: 1 }, '', zenUrl()); history.pushState({ zen: 2 }, '', zenUrl(D.questions[id].id)); pushedAns = true; }
        else history.replaceState({ zen: 1 }, '', zenUrl());
        enteredPush = false;
      } else if (how === 'pop' && id >= 0) pushedAns = true;
      if (id >= 0) {
        camX = X[id] + WD[id] / 2; camY = Y[id] + HD[id] / 2;
        draw(performance.now()); intro(false);
        showAnswer(id, false);
      } else { draw(performance.now()); intro(true); poke(); startLoop(); }
    }, function () {      // данные не загрузились: возвращаем обычную страницу
      var back = enteredPush;
      leave(); document.documentElement.classList.remove('zen-boot');
      if (back) history.back(); else history.replaceState(null, '', location.pathname);
    });
  }

  // вопросы проявляются из темноты с лёгким разбросом по времени
  function intro(anim) {
    var i, nd;
    if (anim && !calm) {
      for (i = 0; i < n; i++) { nd = NODES[i]; nd.style.transition = 'none'; nd.style.opacity = 0; }
      void field.offsetWidth;
      for (i = 0; i < n; i++) { nd = NODES[i]; nd.style.transition = ''; nd.style.transitionDelay = (Math.random() * 0.6).toFixed(2) + 's'; nd.classList.add('intro'); setOp(i); }
      introUntil = performance.now() + 1700;
      setTimeout(function () { for (var j = 0; j < n; j++) { NODES[j].style.transitionDelay = ''; NODES[j].classList.remove('intro'); } }, 1700);
    } else for (i = 0; i < n; i++) setOp(i);
  }

  function leave() {
    if (!active) return;
    active = false; window.zenActive = false;
    stopLoop(); if (built) { finishClose(); closePop(); }
    if (typeRaf) cancelAnimationFrame(typeRaf); typeRaf = 0;
    ptrs = {}; np = 0; touching = false; tap = null; pinch = null; vx = vy = 0; snap = null; pending = false;
    root.classList.remove('on', 'ans', 'moving');
    document.documentElement.classList.remove('zen-on', 'zen-boot');
    if (metaTheme && oldTheme != null) metaTheme.setAttribute('content', oldTheme);
  }
  function requestExit() {
    if (!active) return;
    if (enteredPush) history.back();
    else { history.replaceState(null, '', location.pathname); leave(); }
  }

  // «назад»/«вперёд»: состояние Zen полностью читается из адреса
  window.addEventListener('popstate', function () {
    var z = inUrl();
    if (!z) { if (active) leave(); return; }
    if (!active) { enter('pop'); return; }
    if (!built) return;
    var id = idFromHash();
    if (id >= 0 && !ansOpen) { pushedAns = true; showAnswer(id, false); }
    else if (id < 0 && ansOpen) doClose();
  });

  window.VoicesZen = { check: function () { return built ? check() : null; }, dim: function () { return { WD: WD, HD: HD, nodes: NODES }; }, enter: function () { enter('push'); } };

  var openBtn = document.getElementById('zenopen');
  if (openBtn) openBtn.addEventListener('click', function () { enter('push'); });
  if (window.zenActive && inUrl()) enter('boot');
})();
