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

  var K_READ = 'voices-zen-read', K_AUTH = 'voices-zen-authors', K_THEME = 'voices-zen-theme', K_MODE = 'voices-zen-mode';
  // режимы: Вселенная живёт в этом файле, Барабан и Чернила регистрируются из zen-drum.js и zen-ink.js
  var MODE_IDS = ['universe', 'drum', 'ink'];
  var MODE_NAMES = { universe: 'Вселенная', drum: 'Барабан', ink: 'Чернила' };
  var MODE_ICONS = {
    universe: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g fill="currentColor"><circle cx="6" cy="7" r="2.4"/><circle cx="16.5" cy="5.5" r="1.3"/><circle cx="19" cy="12.5" r="2.7"/><circle cx="10" cy="14" r="1.1"/><circle cx="5" cy="18.5" r="1.4"/><circle cx="14.5" cy="19" r="2"/></g></svg>',
    drum: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 21 14.6 9.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="16.2" cy="6.7" r="3.6" fill="currentColor"/></svg>',
    ink: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2.8C9.4 7 5.6 10.8 5.6 15.2a6.4 6.4 0 0 0 12.8 0C18.4 10.8 14.6 7 12 2.8Z" fill="currentColor"/></svg>'
  };
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
  var root, field, tools, za, zwrap, popA, popT, btnA, btnT, btnX, btnM, metaTheme, oldTheme = '';
  var regs = {}, insts = {}, scenes = {}, mode = '', curMode = null, wantMode = '', leaving = null, leaveTimer = 0, ansMode = null, ansQ = -1, uniOn = false;
  var active = false, enteredPush = false, pushedAns = false, ansOpen = false, closing = false;

  // ---- мир ----
  var n = 0, X, Y, WD, HD, SX, SY, SW, SH, QI, SL, CYC, SZ, BASE, PH1, PH2, SP1, SP2, AM, PH3, SP3, OPS, LO, VIS, ACT, RD, LINES = [], NODES = [], IDX = {};
  var WW = 0, WH = 0, maxBW = 0, maxBH = 0;
  var camX = 0, camY = 0, zoom = 1, vw = 0, vh = 0, minZ = Z_MIN;
  var vx = 0, vy = 0;                   // скорость камеры, мир/с
  var FOC = -1, openIdx = -1, curQ = -1;   // curQ — НОМЕР вопроса на открытом экране ответов
  var authors = { brodsky: true, chekhov: true, gary: true }, theme = '';
  var readIds = {};

  // ---- кадр ----
  var raf = 0, last = 0, lastInput = 0, driftAmt = 0, dAng = 0, pending = false, snap = null, wheelUntil = 0, touching = false;
  var dX = NaN, dY = NaN, dZ = NaN, forceDraw = true, introUntil = 0;

  // ---------------------------------------------------------------- раскладка на торе
  function ovl1(a, aw, b, bw, L) { var d = ((b - a) % L + L) % L; return d < aw || (L - d) < bw; }

  var cv = null, wc = {}, sp = 0;
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
  // ярус размера: 70% мелкие, 22% средние, 8% крупные; ширина строки в em у каждого яруса своя
  function pickSize(len) {
    var r = Math.random(), tier = r < 0.70 ? 0 : r < 0.92 ? 1 : 2;
    if (tier === 2 && len > 120) tier = 1;      // длинные вопросы крупными не бывают
    return { size: tier === 0 ? 14 + Math.random() * 3 : tier === 1 ? 20 + Math.random() * 5 : 30 + Math.random() * 12,
             em: tier === 0 ? 14 + Math.random() * 8 : tier === 1 ? 12 + Math.random() * 6 : 9 + Math.random() * 5 };
  }

  function buildWorld() {
    cv = document.createElement('canvas').getContext('2d');
    var FF = (getComputedStyle(document.documentElement).getPropertyValue('--f-serif') || '').trim() || 'Georgia, serif';
    cv.font = '400 100px ' + FF; wc = {}; sp = cv.measureText(' ').width;

    var qs = D.questions; n = qs.length;
    X = new Float64Array(n); Y = new Float64Array(n); WD = new Float64Array(n); HD = new Float64Array(n);
    SX = new Float64Array(n); SY = new Float64Array(n); SW = new Float64Array(n); SH = new Float64Array(n);
    QI = new Int32Array(n); SL = new Int32Array(n); CYC = new Float64Array(n);
    SZ = new Float32Array(n); BASE = new Float32Array(n); PH1 = new Float32Array(n); PH2 = new Float32Array(n);
    SP1 = new Float32Array(n); SP2 = new Float32Array(n); AM = new Float32Array(n); PH3 = new Float32Array(n); SP3 = new Float32Array(n);
    OPS = new Float32Array(n); LO = new Float32Array(n); VIS = new Uint8Array(n); ACT = new Uint8Array(n); RD = new Uint8Array(n);
    LINES = []; IDX = {}; maxBW = 0; maxBH = 0;
    var AW = new Float64Array(n), AH = new Float64Array(n), sumA = 0, i, size;
    for (i = 0; i < n; i++) {
      var q = qs[i]; IDX[q.id] = i; QI[i] = i; SL[i] = i;
      var pk = pickSize(q.q.length); size = pk.size;
      var m = wrap(q.q, size, pk.em * size);
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
    for (i = 0; i < n; i++) { X[i] = SX[i] = RX[i] + PAD; Y[i] = SY[i] = RY[i] + PAD; SW[i] = WD[i]; SH[i] = HD[i]; }
    var rep = check();
    try { console.info('[zen] раскладка: вопросов ' + n + ', мир ' + Math.round(WW) + '×' + Math.round(WH) + ', пересечений ' + rep.overlaps + ', зазор < ' + GAP + 'px: ' + rep.tight + ', попыток роста ' + tries); } catch (e) {}
  }

  // вопрос q на месте s: размер берём случайный и уменьшаем, пока текст не войдёт в бокс места
  function fitIn(q, s) {
    var t = D.questions[q].q, pk = pickSize(t.length), size = Math.floor(pk.size), m, h;
    for (; size >= 12; size--) {
      m = wrap(t, size, Math.min(SW[s], pk.em * size));
      h = Math.ceil(m.lines.length * size * 1.25);
      if (m.w + 2 <= SW[s] && h <= SH[s]) return { size: size, lines: m.lines, w: Math.ceil(m.w) + 2, h: h };
    }
    return null;
  }
  function putIn(s, q, f) {
    QI[s] = q; SL[q] = s; SZ[s] = f.size; LINES[s] = f.lines; WD[s] = f.w; HD[s] = f.h;
    X[s] = SX[s] + (SW[s] - f.w) / 2; Y[s] = SY[s] + (SH[s] - f.h) / 2;
    BASE[s] = 0.45 + Math.random() * 0.5;
    ACT[s] = matches(q); RD[s] = readIds[D.questions[q].id] ? 1 : 0; OPS[s] = opacityOf(s);
    var nd = NODES[s]; nd.textContent = f.lines.join('\n'); nd.style.fontSize = f.size + 'px';
  }
  // растворившийся вопрос меняется местами с вопросом с невидимого места: всплывает другой, своим размером
  function swapSlot(i) {
    for (var k = 0; k < 16; k++) {
      var j = Math.floor(Math.random() * n);
      if (j === i || VIS[j] || j === openIdx) continue;
      var qa = QI[i], qb = QI[j];
      if (theme && !matches(qb) && k < 12) continue;
      var fa = fitIn(qb, i), fb = fitIn(qa, j);
      if (!fa || !fb) continue;
      putIn(i, qb, fa); putIn(j, qa, fb);
      return;
    }
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
    var b = 0.5 + 0.5 * Math.sin(t * SP3[i] + PH3[i]); b = Math.sqrt(b);   // долго горит, коротко гаснет до нуля
    return b;
  }
  // номер вдоха: меняется ровно в момент, когда вопрос погас полностью
  function cycleOf(i, t) { return Math.floor((t * SP3[i] + PH3[i] + 1.5708) / 6.2832); }
  function setOp(i) { OPS[i] = opacityOf(i); LO[i] = OPS[i] * breath(i, performance.now()); NODES[i].style.opacity = LO[i].toFixed(3); forceDraw = true; }
  function setFocus(i) { var o = FOC; if (o === i) return; FOC = i; if (o >= 0) setOp(o); if (i >= 0) setOp(i); }
  function matches(q) { return !theme || D.questions[q].t.indexOf(theme) >= 0 ? 1 : 0; }
  function applyTheme() {
    for (var i = 0; i < n; i++) { ACT[i] = matches(QI[i]); setOp(i); }
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
    for (i = 0; i < n; i++) RD[i] = readIds[D.questions[QI[i]].id] ? 1 : 0;
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
        if (VIS[i] !== 1) { nd.style.visibility = 'visible'; VIS[i] = 1; CYC[i] = cycleOf(i, now); }
        else if (!calm && live && i !== openIdx) { var cy = cycleOf(i, now); if (cy !== CYC[i]) { CYC[i] = cy; swapSlot(i); } }
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
    if (!active || !uniOn || ansOpen || document.hidden || !built) return;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    physics(now, dt);
    draw(now);
    raf = requestAnimationFrame(frame);
  }
  function startLoop() { if (raf || !active || !uniOn || ansOpen || document.hidden || !built) return; last = performance.now(); raf = requestAnimationFrame(frame); }
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
      if (!ACT[i] || LO[i] < 0.08) continue;     // почти растворившийся вопрос не ловится
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
      if (now - t.t < 300) { var i = hitTest(t.x, t.y, t.cx, t.cy); if (i >= 0) uniOpen(i); }
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
    if (ansOpen || !built || !curMode) return;
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (curMode.key) curMode.key(e);
  }
  // клавиши Вселенной: стрелки двигают поле, Enter открывает вопрос в фокусе или ближайший к центру
  function uniKey(e) {
    var k = e.key, s = 650 / zoom, dx = 0, dy = 0;
    if (k === 'ArrowLeft') dx = -1; else if (k === 'ArrowRight') dx = 1; else if (k === 'ArrowUp') dy = -1; else if (k === 'ArrowDown') dy = 1;
    if (dx || dy) { e.preventDefault(); poke(); snap = null; setFocus(-1); vx = dx * s; vy = dy * s; pending = true; if (calm) { camX += dx * 80 / zoom; camY += dy * 80 / zoom; vx = vy = 0; forceDraw = true; } }
    else if (k === 'Enter' && e.target.tagName !== 'BUTTON') { var i = FOC >= 0 ? FOC : nearestCenter(); if (i >= 0) { e.preventDefault(); uniOpen(i); } }
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
    field = el('div', 'zf zs'); scenes.universe = field;
    MODE_IDS.forEach(function (id) { if (id !== 'universe' && regs[id]) { scenes[id] = el('div', 'zs zs-' + id); } });
    tools = el('div', 'zt');
    btnM = el('button'); btnM.type = 'button';
    btnA = iconBtn('Авторы', '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g stroke="currentColor" stroke-width="1.5"><circle cx="5" cy="12" r="2.7"/><circle cx="12" cy="12" r="2.7"/><circle cx="19" cy="12" r="2.7"/></g></svg>');
    btnT = iconBtn('Темы', '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g fill="currentColor"><circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/><circle cx="12" cy="19" r="2.2"/></g></svg><span class="dot"></span>');
    btnX = el('button'); btnX.type = 'button'; btnX.setAttribute('aria-label', 'Выйти из Zen'); btnX.title = 'Выйти из Zen';
    btnX.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M17.46 5.49A8.5 8.5 0 1 0 20.37 13.48" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    btnA.setAttribute('aria-expanded', 'false'); btnT.setAttribute('aria-expanded', 'false'); btnX.removeAttribute('aria-haspopup');
    tools.appendChild(btnM); tools.appendChild(btnA); tools.appendChild(btnT); tools.appendChild(btnX);

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
      b.addEventListener('click', function () { theme = t.id; save(K_THEME, theme); paintThemes(); if (built) { applyTheme(); if (curMode && curMode.refresh) curMode.refresh(); } closePop(); });
      popT.appendChild(b);
    });

    za = el('div', 'za'); za.tabIndex = -1; zwrap = el('div', 'zw'); za.appendChild(zwrap);
    root.appendChild(field);
    MODE_IDS.forEach(function (id) { if (scenes[id] && id !== 'universe') root.appendChild(scenes[id]); });
    root.appendChild(tools); root.appendChild(popA); root.appendChild(popT); root.appendChild(za);

    btnM.addEventListener('click', function () { nextMode(); });
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
    window.addEventListener('resize', function () { if (active) { measure(); if (curMode && curMode.resize) curMode.resize(); } });
    document.addEventListener('visibilitychange', function () {
      if (!curMode) return;
      if (document.hidden) curMode.pause();
      else if (active && !ansOpen && !leaving) curMode.resume();
    });
    initAnswerEvents();
    paintAuthors(); paintThemes();
  }

  // ---------------------------------------------------------------- экран ответов
  var openedAt = 0;   // касание, открывшее вопрос, не должно «прокликнуть» в карточку ответа
  var EXP = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true">' +
    '<g class="o"><path d="M12 3h5v5M17 3l-5.5 5.5M8 17H3v-5M3 17l5.5-5.5"/></g><g class="i"><path d="M17 8h-5V3M12 8l5.5-5.5M3 12h5v5M8 12l-5.5 5.5"/></g></svg>';
  var cols = [], typeRaf = 0, flyEl = null, flyAnim = null, closeAnims = [], titleCard = null, titleH2 = null;

  function buildAnswer(qn) {
    var q = D.questions[qn];
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

  // ---- полёт заголовка (FLIP): состояние элемента-источника снимается до любых сбросов
  function flyState(src, o) {
    o = o || {};
    var r = src.getBoundingClientRect(), cs = getComputedStyle(src), w = src.offsetWidth;
    return {
      x: o.x != null ? o.x : r.left, y: o.y != null ? o.y : r.top,
      sc: o.scale || (w ? r.width / w : 1),
      op: o.opacity != null ? o.opacity : parseFloat(cs.opacity),
      col: cs.color, fs: parseFloat(cs.fontSize), st: cs.fontStyle, ws: cs.whiteSpace, ta: cs.textAlign, lh: cs.lineHeight, bw: w,
      text: src.textContent
    };
  }
  function makeFly(st) {
    var f = el('div', 'zfly', st.text);
    f.style.fontSize = st.fs + 'px'; f.style.lineHeight = st.lh; f.style.whiteSpace = st.ws; f.style.textAlign = st.ta;
    if (st.ws !== 'pre' && st.bw) f.style.width = st.bw + 'px';
    root.appendChild(f); return f;
  }
  // левый край копии, когда её надо поставить в блок заголовка: центрованный текст центруем
  function flyLeft(st, k, r) { return st.ta === 'center' && st.ws !== 'pre' ? r.left + (r.width - st.bw * k) / 2 : r.left; }
  function dropFly() {
    if (flyAnim) { try { flyAnim.cancel(); } catch (e) {} flyAnim = null; }
    if (flyEl && flyEl.parentNode) flyEl.parentNode.removeChild(flyEl); flyEl = null;
  }
  function tf(x, y, k) { return 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) scale(' + k.toFixed(4) + ')'; }

  // режим открывает ответы так: openAnswer(номер вопроса, элемент-источник, { scale, opacity })
  function openAnswer(q, src, o) {
    if (ansOpen && !closing) return;
    if (closing) finishClose();
    history.pushState({ zen: 2 }, '', zenUrl(D.questions[q].id)); pushedAns = true;
    showAnswer(q, src, o);
  }
  function uniOpen(i) { openAnswer(QI[i], NODES[i], { scale: zoom }); }

  function showAnswer(q, src, o) {
    if (closing) finishClose();
    var now = performance.now(), s0 = null;
    if (src && !calm && built) s0 = flyState(src, o);   // состояние узла на момент касания, до всех сбросов
    ansOpen = true; closing = false; curQ = q; openedAt = now; ansMode = curMode; ansQ = q;
    if (curMode) curMode.pause();
    closePop(); setMoving(false);
    goal('zen_q');
    readIds[D.questions[q].id] = 1;
    save(K_READ, Object.keys(readIds));
    if (curMode && curMode.onOpened) curMode.onOpened(q);
    buildAnswer(q);
    root.classList.add('ans'); za.classList.add('on'); za.scrollTop = 0; zwrap.style.transition = ''; zwrap.style.transform = '';
    try { za.focus({ preventScroll: true }); } catch (e) {}
    if (!s0) { titleCard.classList.add('show'); startTyping(); return; }
    // FLIP: копия вопроса с места в режиме летит в заголовок
    var r = titleH2.getBoundingClientRect(), F = parseFloat(getComputedStyle(titleH2).fontSize), k = F / s0.fs;
    var col1 = getComputedStyle(titleH2).color;
    dropFly(); flyEl = makeFly(s0);
    flyAnim = flyEl.animate([
      { transform: tf(s0.x, s0.y, s0.sc), color: s0.col, opacity: s0.op, fontStyle: s0.st },
      { transform: tf(flyLeft(s0, k, r), r.top, k), color: col1, opacity: 1, fontStyle: 'italic' }
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

  // режим сообщает, что вопрос снова на своём месте
  function noteClosed() {
    if (ansQ < 0) return;
    var q = ansQ, m = ansMode; ansQ = -1;
    if (m && m.onClosed) m.onClosed(q);
  }

  function doClose() {
    if (!ansOpen || closing) return;
    closing = true; pushedAns = false;
    if (typeRaf) cancelAnimationFrame(typeRaf); typeRaf = 0;
    var q = curQ, m = ansMode || curMode;
    if (calm) { finishClose(); return; }
    var tg = m && m.returnTarget ? m.returnTarget(q) : null;
    if (!tg || !tg.el) {
      // режим не знает, куда лететь: заголовок растворяется вместе с экраном ответов
      var da = za.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-in', fill: 'forwards' });
      closeAnims = [da];
      root.classList.remove('ans'); ansOpen = false; if (m) m.resume();
      da.onfinish = function () { if (closeAnims[0] !== da) return; noteClosed(); cleanupAnswer(); };
      return;
    }
    // копия заголовка с его нынешнего места летит назад в режим
    var st = flyState(tg.el, tg), r = titleH2.getBoundingClientRect(), F = parseFloat(getComputedStyle(titleH2).fontSize), k = F / st.fs;
    var sx = flyLeft(st, k, r), sy = r.top;
    if (r.bottom < 0 || r.top > vh) { sx = Math.max(16, vw / 2 - 150); sy = 60; }
    var col0 = getComputedStyle(titleH2).color;
    dropFly(); flyEl = makeFly(st);
    var f = flyEl;
    titleCard.classList.remove('show');                      // настоящий заголовок гаснет, летит копия
    var op1 = st.op;
    flyAnim = f.animate([
      { transform: tf(sx, sy, k), color: col0, opacity: 1, fontStyle: 'italic' },
      { transform: tf(st.x, st.y, st.sc), color: st.col, opacity: op1, fontStyle: st.st }
    ], { duration: 460, easing: 'cubic-bezier(.3,.1,.2,1)', fill: 'forwards' });
    var fa = flyAnim;
    closeAnims = [za.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-in', fill: 'forwards' })];
    root.classList.remove('ans');                            // режим проявляется, иконки возвращаются
    ansOpen = false; if (m) m.resume();
    fa.onfinish = function () {
      if (flyAnim !== fa) return;
      flyAnim = null;
      noteClosed();
      var out = f.animate([{ opacity: op1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
      out.onfinish = function () { if (f.parentNode) f.parentNode.removeChild(f); if (flyEl === f) flyEl = null; };
      cleanupAnswer();
    };
  }
  function cleanupAnswer() {
    closeAnims.forEach(function (a) { try { a.cancel(); } catch (e) {} }); closeAnims = [];
    za.classList.remove('on'); zwrap.innerHTML = ''; zwrap.style.transition = ''; zwrap.style.transform = '';
    closing = false; cols = [];
  }
  function finishClose() {
    if (typeRaf) cancelAnimationFrame(typeRaf); typeRaf = 0;
    dropFly(); ansOpen = false; pushedAns = false;
    root.classList.remove('ans');
    noteClosed();
    cleanupAnswer();
    if (active && curMode) curMode.resume();
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

  // ---------------------------------------------------------------- режимы
  var uni = {
    enter: function (o) {
      measure();
      if (o.first) zoom = Math.max(minZ, Math.min(Z_MAX, 1));
      if (!camX && !camY) { camX = Math.random() * WW; camY = Math.random() * WH; }
      for (var i = 0; i < n; i++) VIS[i] = 2;
      forceDraw = true; uniOn = true;
      if (o.q >= 0) {
        var s = SL[o.q];
        camX = X[s] + WD[s] / 2; camY = Y[s] + HD[s] / 2;
        draw(performance.now()); intro(false);
      } else { draw(performance.now()); intro(o.first); poke(); startLoop(); }
    },
    leave: function () {
      uniOn = false; stopLoop();
      ptrs = {}; np = 0; touching = false; tap = null; pinch = null; vx = vy = 0; snap = null; pending = false;
      field.classList.remove('drag'); if (root) root.classList.remove('moving');
    },
    pause: function () { stopLoop(); },
    resume: function () { poke(); startLoop(); },
    // вопрос открывается: поле замирает, место вопроса гаснет (его заменяет летящая копия)
    onOpened: function (q) {
      var i = SL[q];
      setFocus(-1); touching = false; np = 0; ptrs = {}; tap = null; vx = vy = 0; snap = null;
      RD[i] = 1; openIdx = i; setOp(i);
    },
    onClosed: function () { if (openIdx >= 0) { var i = openIdx; openIdx = -1; setOp(i); } },
    returnTarget: function (q) {
      var i = SL[q];
      place(i, camX, camY, zoom); sway(i, performance.now());
      return { el: NODES[i], x: px, y: py, scale: zoom, opacity: ACT[i] ? BASE[i] * 0.5 : 0.06 };   // прочитанный тусклее
    },
    key: uniKey
  };
  insts.universe = uni;

  var api = {
    calm: calm, goal: goal, el: el, load: load, save: save,
    data: function () { return D; },
    theme: function () { return theme; },
    matches: function (q) { return matches(q); },
    isRead: function (q) { return !!readIds[D.questions[q].id]; },
    open: openAnswer,
    popDown: function () { if (popOpen()) { closePop(); return true; } return false; }   // касание закрыло поповер: вопрос не открываем
  };

  function registered(id) { return id === 'universe' || !!(regs[id] && scenes[id]); }
  function modeObj(id) {
    if (!registered(id)) return null;
    if (!insts[id]) insts[id] = regs[id](api, scenes[id]);
    return insts[id];
  }
  function lastMode() { var m = load(K_MODE, 'universe'); return MODE_IDS.indexOf(m) >= 0 ? m : 'universe'; }
  function paintMode() {
    btnM.innerHTML = MODE_ICONS[mode] || MODE_ICONS.universe;
    btnM.setAttribute('aria-label', MODE_NAMES[mode] || ''); btnM.title = MODE_NAMES[mode] || '';
  }
  // o: instant — старый режим выключается сразу; first — вход в Zen; q — вопрос, который режим должен показать; keepUrl — адрес уже верный
  function setMode(id, o) {
    o = o || {};
    var nu = modeObj(id);
    if (!nu || nu === curMode) return false;
    if (leaving) { clearTimeout(leaveTimer); leaving.leave(); leaving = null; }
    if (closing) finishClose();
    var old = curMode;
    mode = id; curMode = nu;
    MODE_IDS.forEach(function (k) { if (scenes[k]) scenes[k].classList.toggle('cur', k === id); });
    paintMode(); closePop();
    nu.enter({ first: !!o.first, q: o.q != null ? o.q : -1 });
    if (old) {
      if (o.instant) old.leave();
      else { leaving = old; leaveTimer = setTimeout(function () { var m = leaving; leaving = null; if (m) m.leave(); }, 380); }
    }
    save(K_MODE, id);
    if (!o.keepUrl) history.replaceState(history.state, '', zenUrl());
    if (id !== 'universe') goal('zen_mode_' + id);
    return true;
  }
  function nextMode() {
    if (!built || ansOpen || !active) return;
    var ids = MODE_IDS.filter(registered), k = ids.indexOf(mode);
    if (ids.length > 1) setMode(ids[(k + 1) % ids.length], {});
  }

  // ---------------------------------------------------------------- вход и выход
  function inUrl() { return /[?&]zen\b/.test(location.search); }
  function modeFromUrl() { var m = /[?&]zen=([a-z]+)/.exec(location.search); return m && MODE_IDS.indexOf(m[1]) >= 0 ? m[1] : ''; }
  function zenUrl(id) { return location.pathname + '?zen=' + (mode || wantMode || 'universe') + (id ? '#' + id : ''); }
  function idFromHash() { var h = ''; try { h = decodeURIComponent(location.hash.slice(1)); } catch (e) {} return h && IDX[h] != null ? IDX[h] : -1; }

  function fontsReady() {
    var p = Promise.resolve();
    try {
      if (document.fonts && document.fonts.load) p = Promise.all([document.fonts.load('400 16px "PT Serif"', 'Вопрос'), document.fonts.load('italic 400 16px "PT Serif"', 'Вопрос')]);
    } catch (e) {}
    return Promise.race([p.then(function () {}, function () {}), new Promise(function (res) { setTimeout(res, 2500); })]);
  }
  // отложенные скрипты режимов выполняются до DOMContentLoaded: ждём его, чтобы все режимы успели зарегистрироваться
  var modesReady = new Promise(function (res) { document.addEventListener('DOMContentLoaded', function () { res(); }); if (document.readyState === 'complete') res(); });
  function prepare() {
    if (prep) return prep;
    T = window.VoicesType; ORDER = T.ORDER; SHORT = T.SHORT; WHERE = T.WHERE;   // подписи авторов общие со страницей
    prep = Promise.all([
      fetch('data.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fontsReady(), modesReady
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
    wantMode = how === 'push' ? lastMode() : (modeFromUrl() || lastMode());
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
      if (!registered(wantMode)) wantMode = 'universe';
      forceDraw = true;
      if (how === 'boot') {
        if (id >= 0) { history.replaceState({ zen: 1 }, '', zenUrl()); history.pushState({ zen: 2 }, '', zenUrl(D.questions[id].id)); pushedAns = true; }
        else history.replaceState({ zen: 1 }, '', zenUrl());
        enteredPush = false;
      } else if (how === 'pop' && id >= 0) pushedAns = true;
      setMode(wantMode, { instant: true, first: true, q: id, keepUrl: true });
      if (id >= 0) showAnswer(id, null);
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
    if (leaving) { clearTimeout(leaveTimer); leaving.leave(); leaving = null; }
    if (curMode) { curMode.leave(); curMode = null; mode = ''; }
    root.classList.remove('on', 'ans', 'moving');
    document.documentElement.classList.remove('zen-on', 'zen-boot');
    if (metaTheme && oldTheme != null) metaTheme.setAttribute('content', oldTheme);
  }
  function requestExit() {
    if (!active) return;
    if (enteredPush) history.back();
    else { history.replaceState(null, '', location.pathname); leave(); }
  }

  // «назад»/«вперёд»: состояние Zen (режим и открытый вопрос) полностью читается из адреса
  window.addEventListener('popstate', function () {
    var z = inUrl();
    if (!z) { if (active) leave(); return; }
    if (!active) { enter('pop'); return; }
    if (!built) return;
    var id = idFromHash(), um = modeFromUrl();
    if (um && um !== mode && registered(um)) {
      if (ansOpen) finishClose();
      setMode(um, { instant: true, keepUrl: true, q: id });
    }
    if (id >= 0 && !ansOpen) { pushedAns = true; if (curMode && curMode.focus) curMode.focus(id); showAnswer(id, null); }
    else if (id < 0 && ansOpen) doClose();
  });

  window.VoicesZen = {
    check: function () { return built ? check() : null; }, dim: function () { return { WD: WD, HD: HD, nodes: NODES }; }, enter: function () { enter('push'); },
    register: function (id, make) { regs[id] = make; },
    mode: function () { return mode; }, setMode: function (id) { return built ? setMode(id, {}) : false; }
  };

  var openBtn = document.getElementById('zenopen');
  if (openBtn) openBtn.addEventListener('click', function () { enter('push'); });
  if (window.zenActive && inUrl()) enter('boot');
})();
