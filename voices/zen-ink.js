/* «Голоса_», Zen: режим «Чернила» («на просвет»). Касание растекается пятном, из него проступает вопрос;
   вести пальцем: расходится рябь и всплывают полускрытые вопросы. Пятна и рябь рисует Canvas 2D, текст — DOM поверх.
   Регистрируется в хосте (zen.js). ES5, без библиотек. */
(function () {
  'use strict';
  if (!window.VoicesZen) return;

  window.VoicesZen.register('ink', function (api, scene) {
    var el = api.el, calm = api.calm;
    var GROW = 1300;                   // растекание пятна, мс
    var DIE = 1200;                    // растворение прежнего пятна, мс
    var STEP_RING = 40;                // рябь не чаще, чем раз в столько px пути
    var STEP_GHOST = 110;              // полускрытый вопрос раз в столько px пути
    var MAXG = 6;

    var cv = el('canvas', 'zi-c'), ctx = cv.getContext('2d'), layer = el('div', 'zi-l'), meas = el('div', 'zi-m');
    scene.appendChild(cv); scene.appendChild(layer); scene.appendChild(meas);

    var vw = 0, vh = 0, dpr = 1, safeTop = 56;
    var active = false, paused = false, raf = 0, last = 0;
    var blobs = [], main = null, rings = [], ghosts = [], recent = [];
    var lastAct = 0, lastDrop = 0, idleT = 0, timers = [];
    var C = { paper: [243, 235, 217], mark: [240, 118, 90] }, LAYERS = [];

    function later(fn, ms) { var t = setTimeout(function () { var k = timers.indexOf(t); if (k >= 0) timers.splice(k, 1); fn(); }, ms); timers.push(t); return t; }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
    function rgbOf(v, def) {
      var t = el('i'); t.style.color = 'var(' + v + ')'; scene.appendChild(t);
      var m = /(\d+)[^\d]+(\d+)[^\d]+(\d+)/.exec(getComputedStyle(t).color); scene.removeChild(t);
      return m ? [+m[1], +m[2], +m[3]] : def;
    }
    function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
    function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')'; }

    function size() {
      vw = scene.clientWidth || window.innerWidth; vh = scene.clientHeight || window.innerHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
      cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // слои от тёплого края к бумажной сердцевине: мягкий край без blur
    function layers() {
      var N = 20, k, m;
      LAYERS = [];
      for (k = 0; k < N; k++) {   // у каждого слоя свой неровный край: ступени сливаются в облако
        m = Math.pow(1 - k / (N - 1), 1.7) * 0.75;
        LAYERS.push([1.18 - k * 0.0285, k < 13 ? 0.085 : 0.3, mix(C.paper, C.mark, m), k]);
      }
    }

    // ---- выбор вопроса: из выбранной темы, не из показанных и не из недавних; непрочитанные предпочтительнее
    function shown(q) {
      var i;
      for (i = 0; i < ghosts.length; i++) if (ghosts[i].q === q) return true;
      for (i = 0; i < blobs.length; i++) if (blobs[i].q === q) return true;
      return false;
    }
    function pickQ() {
      var n = api.data().questions.length, pick = -1, tries = 0, cand, k;
      while (tries++ < 60) {
        cand = Math.floor(Math.random() * n);
        if (!api.matches(cand) || shown(cand) || recent.indexOf(cand) >= 0) continue;
        if (!api.isRead(cand)) { pick = cand; break; }
        if (pick < 0) pick = cand;
        if (tries > 20) break;
      }
      if (pick < 0) { for (k = 0; k < n; k++) if (api.matches(k) && !shown(k)) { pick = k; break; } }
      if (pick < 0) pick = 0;
      recent.push(pick); if (recent.length > 14) recent.shift();
      return pick;
    }

    // ---- пятно
    function fontFor(len) { return len <= 50 ? 26 : len <= 90 ? 24 : len <= 140 ? 22 : 20; }
    // размер пятна подгоняем под вопрос; центр сдвигаем, чтобы пятно с текстом не уходило за край экрана
    function geom(q, ox, oy) {
      var text = api.data().questions[q].q, fs = fontFor(text.length), wmax = Math.max(170, Math.min(320, vw - 120));
      meas.style.fontSize = fs + 'px'; meas.style.maxWidth = wmax + 'px'; meas.textContent = text;
      var W = Math.ceil(meas.offsetWidth) + 2, H = Math.ceil(meas.offsetHeight);
      var rx = 1.32 * W / 2 + 30, ry = 1.5 * H / 2 + 32, bx, by, top = safeTop + 4, ex = rx * 1.12, ey = ry * 1.12;   // с запасом на мягкий край
      if (2 * ex > vw) bx = vw / 2; else bx = clamp(ox, ex, vw - ex);
      if (2 * ey + top + 8 > vh) by = (vh + top) / 2; else by = clamp(oy, ey + top, vh - ey - 8);
      return { text: text, fs: fs, W: W, H: H, rx: rx, ry: ry, bx: bx, by: by };
    }
    function newBlob(q, ox, oy, o) {
      o = o || {};
      var g0 = geom(q, ox, oy), now = performance.now();
      if (main) dieBlob(main);
      var b = {
        q: q, ox: ox, oy: oy, cx: g0.bx, cy: g0.by, rx: g0.rx, ry: g0.ry, t0: calm ? now - GROW : now, state: 'grow', dieT0: 0,
        lvl: o.faint ? 0.34 : 1, lvlT: o.faint ? 0.34 : 1, faint: !!o.faint,
        ph: [rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)], sp: [rnd(0.6, 1.3), rnd(0.5, 1.2), rnd(0.8, 1.6), rnd(0.7, 1.4)],
        w: [rnd(0.05, 0.085), rnd(0.04, 0.075), rnd(0.02, 0.045), rnd(0.012, 0.028)],
        lobes: [{ a: rnd(0, 6.28), h: rnd(0.16, 0.28) }, { a: rnd(0, 6.28), h: rnd(0.12, 0.24) }, { a: rnd(0, 6.28), h: rnd(0.1, 0.2) }]
      };
      var t = el('div', 'zi-q', g0.text); t.style.fontSize = g0.fs + 'px'; t.style.width = g0.W + 'px';
      t.style.left = (g0.bx - g0.W / 2).toFixed(1) + 'px'; t.style.top = (g0.by - g0.H / 2).toFixed(1) + 'px';
      if (calm) t.classList.add('calm');
      if (api.isRead(q)) t.classList.add('read');
      layer.appendChild(t); b.t = t;
      var reveal = function () { if (b.state === 'die' || b.state === 'gone') return; t.classList.add('on'); if (b.faint) { t.classList.add('faint'); t.style.opacity = '0.6'; } };
      if (calm) reveal(); else { void t.offsetWidth; later(reveal, 460); }
      blobs.push(b); main = b; lastDrop = now;
      kick();
      return b;
    }
    function dieBlob(b) {
      if (b.state === 'die' || b.state === 'gone') return;
      b.state = 'die'; b.dieT0 = performance.now();
      b.t.classList.remove('on'); b.t.classList.add('off'); b.t.style.opacity = '';
      if (b === main) main = null;
      if (calm) b.dieT0 -= DIE;
      later(function () { if (b.t.parentNode) b.t.parentNode.removeChild(b.t); }, calm ? 20 : DIE + 100);
      kick();
    }
    function ready(b) { return !!b && !b.faint && b.t.classList.contains('on') && performance.now() - b.t0 > 700; }

    // ---- рисование
    function shape(b, sx, sy, cx, cy, rough, lobeK, tm, po) {
      var N = 56, pts = [], j, ph, r, i, d;
      for (j = 0; j < N; j++) {
        ph = j / N * 6.2832;
        r = 1 + rough * (b.w[0] * Math.sin(2 * ph + b.ph[0] + po + tm * b.sp[0]) + b.w[1] * Math.sin(3 * ph + b.ph[1] - po * 1.3 - tm * b.sp[1]) +
          b.w[2] * Math.sin(5 * ph + b.ph[2] + po * 1.7 + tm * b.sp[2]) + b.w[3] * Math.sin(7 * ph + b.ph[3] - po * 2.1 - tm * b.sp[3]));
        for (i = 0; i < 3; i++) { d = Math.atan2(Math.sin(ph - b.lobes[i].a), Math.cos(ph - b.lobes[i].a)); r += lobeK * b.lobes[i].h * Math.exp(-d * d / 0.34); }
        pts.push(cx + Math.cos(ph) * sx * r, cy + Math.sin(ph) * sy * r);
      }
      ctx.beginPath();
      ctx.moveTo((pts[2 * N - 2] + pts[0]) / 2, (pts[2 * N - 1] + pts[1]) / 2);
      for (j = 0; j < N; j++) {
        var nx = pts[((j + 1) % N) * 2], ny = pts[((j + 1) % N) * 2 + 1];
        ctx.quadraticCurveTo(pts[j * 2], pts[j * 2 + 1], (pts[j * 2] + nx) / 2, (pts[j * 2 + 1] + ny) / 2);
      }
      ctx.closePath();
    }
    function drawBlob(b, now) {
      var g = Math.min(1, (now - b.t0) / GROW), e = 1 - Math.pow(1 - g, 3), a = b.lvl, dp = 0;
      if (b.state === 'die') { dp = Math.min(1, (now - b.dieT0) / DIE); a = b.lvl * (1 - dp * dp * (3 - 2 * dp)); }
      if (a <= 0.003) return;
      var m = 1 - Math.pow(1 - g, 2), cx = b.ox + (b.cx - b.ox) * m, cy = b.oy + (b.cy - b.oy) * m;
      var s = (0.04 + 0.96 * e) * (1 + 0.07 * dp), tm = calm ? 0 : now * 0.00028;
      var lobeK = Math.pow(1 - e, 1.2) * 1.15 + (calm ? 0 : 0.06 * Math.sin(tm * 3 + b.ph[0]));
      var rough = 1 + 1.3 * Math.pow(1 - e, 1.5);
      for (var i = 0; i < LAYERS.length; i++) {
        var L = LAYERS[i];
        shape(b, b.rx * s * L[0], b.ry * s * L[0], cx, cy, rough * (L[0] > 0.9 ? 1 : 0.6), lobeK, tm, L[3] * 0.32);
        ctx.fillStyle = rgba(L[2], L[1] * a); ctx.fill();
      }
    }
    function drawRings(now) {
      ctx.lineWidth = 1.2;
      for (var i = 0; i < rings.length; i++) {
        var r = rings[i], k = (now - r.t0) / 1000;
        if (k < 0) continue;
        var e = 1 - Math.pow(1 - k, 2.2), al = 0.42 * Math.pow(1 - k, 1.4);
        ctx.strokeStyle = rgba(C.paper, al); ctx.beginPath(); ctx.arc(r.x, r.y, 6 + r.r * e, 0, 6.2832); ctx.stroke();
      }
    }
    function paint(now) {
      ctx.clearRect(0, 0, vw, vh);
      for (var i = 0; i < blobs.length; i++) drawBlob(blobs[i], now);
      drawRings(now);
    }

    function frame(now) {
      raf = 0;
      if (!active || paused || document.hidden) return;
      var dt = now - last, i, b, alive = false; last = now;
      for (i = blobs.length - 1; i >= 0; i--) {
        b = blobs[i];
        b.lvl += (b.lvlT - b.lvl) * Math.min(1, dt / 260);
        if (b.state === 'die' && now - b.dieT0 >= DIE) { b.state = 'gone'; blobs.splice(i, 1); continue; }
        if (b.state === 'grow' && now - b.t0 >= GROW) b.state = 'hold';
        // при уменьшенном движении неподвижное пятно перерисовывать не нужно
        if (!calm || b.state !== 'hold' || Math.abs(b.lvlT - b.lvl) > 0.01) alive = true;
      }
      for (i = rings.length - 1; i >= 0; i--) if (now - rings[i].t0 > 1000) rings.splice(i, 1);
      paint(now);
      if (alive || rings.length) raf = requestAnimationFrame(frame);
    }
    function kick() {
      if (!active || paused || document.hidden) return;
      if (calm) { paint(performance.now()); }
      if (raf) return;
      last = performance.now(); raf = requestAnimationFrame(frame);
    }
    function halt() { if (raf) cancelAnimationFrame(raf); raf = 0; }

    // ---- полускрытые вопросы вдоль пути
    function overlap(a, b, pad) { return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y; }
    function mainRect() { return main ? { x: main.cx - main.rx * 1.1, y: main.cy - main.ry * 1.1, w: main.rx * 2.2, h: main.ry * 2.2 } : null; }
    function spawnGhost(x, y, dx, dy) {
      if (calm) return;
      var q = pickQ(), text = api.data().questions[q].q, fs = Math.round(rnd(15, 23)), w = Math.round(rnd(150, 230));
      var gn = el('div', 'zi-g', text); gn.style.fontSize = fs + 'px'; gn.style.width = w + 'px';
      layer.appendChild(gn);
      var gw = gn.offsetWidth, gh = gn.offsetHeight, len = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / len, uy = dy / len, px = -uy, py = ux;
      var mr = mainRect(), rect = null, tries, side = Math.random() < 0.5 ? 1 : -1, k;
      for (tries = 0; tries < 14 && !rect; tries++) {
        var off = rnd(46, 120) + gh / 2 * Math.abs(px) * 0.5 + gw / 2 * Math.abs(py) * 0.4, al = rnd(-30, 50);
        var cx = x + px * side * off + ux * al, cy = y + py * side * off + uy * al;
        var r = { x: cx - gw / 2, y: cy - gh / 2, w: gw, h: gh }, nx = clamp(r.x, 10, vw - gw - 10), ny = clamp(r.y, safeTop, vh - gh - 10);
        if (Math.abs(nx - r.x) > 50 || Math.abs(ny - r.y) > 50) { side = -side; continue; }
        r.x = nx; r.y = ny;
        if (x > r.x - 26 && x < r.x + r.w + 26 && y > r.y - 26 && y < r.y + r.h + 26) { side = -side; continue; }   // не под самым пальцем
        if (mr && overlap(r, mr, 6)) { side = -side; continue; }
        var bad = false;
        for (k = 0; k < ghosts.length; k++) if (overlap(r, ghosts[k].r, 12)) { bad = true; break; }
        if (bad) { side = -side; continue; }
        rect = r;
      }
      if (!rect) { layer.removeChild(gn); return; }
      var op = rnd(0.15, 0.35) * (api.isRead(q) ? 0.7 : 1);
      var mx = rnd(15, 85), my = rnd(20, 80), rx = rnd(55, 85);
      var mask = 'radial-gradient(ellipse ' + rx.toFixed(0) + '% 85% at ' + mx.toFixed(0) + '% ' + my.toFixed(0) + '%,#000 22%,rgba(0,0,0,0) 88%)';
      gn.style.webkitMaskImage = mask; gn.style.maskImage = mask;
      gn.style.left = rect.x.toFixed(1) + 'px'; gn.style.top = rect.y.toFixed(1) + 'px';
      var gh0 = { n: gn, q: q, r: rect, off: false };
      ghosts.push(gh0);
      if (ghosts.length > MAXG) dropGhost(ghosts[0], true);
      void gn.offsetWidth; gn.style.opacity = op.toFixed(2); gn.classList.add('on');
      later(function () { dropGhost(gh0, false); }, rnd(1500, 2200));
    }
    function dropGhost(gh, quick) {
      if (gh.off) return; gh.off = true;
      var k = ghosts.indexOf(gh); if (k >= 0) ghosts.splice(k, 1);
      gh.n.classList.remove('on'); gh.n.classList.add('sink'); gh.n.style.opacity = '0';
      later(function () { if (gh.n.parentNode) gh.n.parentNode.removeChild(gh.n); }, quick ? 300 : 1000);
    }
    function nearGhost(x, y) {
      var best = null, bd = 60;
      for (var i = 0; i < ghosts.length; i++) {
        var r = ghosts[i].r, dx = Math.max(r.x - x, 0, x - (r.x + r.w)), dy = Math.max(r.y - y, 0, y - (r.y + r.h)), d = Math.sqrt(dx * dx + dy * dy);
        if (d < bd) { bd = d; best = ghosts[i]; }
      }
      return best;
    }
    function clearGhosts() { while (ghosts.length) dropGhost(ghosts[0], true); }

    // ---- жесты
    var g = null;
    function pt(e) { var r = scene.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function hitMain(x, y) {
      if (!main) return false;
      var dx = (x - main.cx) / (main.rx * 0.95), dy = (y - main.cy) / (main.ry * 0.95);
      return dx * dx + dy * dy <= 1;
    }
    function onDown(e) {
      if (!active || paused || g) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var dead = api.popDown(), p = pt(e);
      try { scene.setPointerCapture(e.pointerId); } catch (x) {}
      lastAct = performance.now();
      g = { id: e.pointerId, x0: p.x, y0: p.y, lx: p.x, ly: p.y, moved: false, dead: dead, accR: 0, accG: STEP_GHOST * 0.6, lastGhost: 0, dx: 0, dy: 0 };
    }
    function ring(x, y) { var now = performance.now(); rings.push({ x: x, y: y, t0: now, r: 86 }); rings.push({ x: x, y: y, t0: now + 130, r: 62 }); }
    function onMove(e) {
      if (!g || e.pointerId !== g.id) return;
      var p = pt(e), now = performance.now(), ddx = p.x - g.lx, ddy = p.y - g.ly, d = Math.sqrt(ddx * ddx + ddy * ddy);
      lastAct = now;
      if (!g.moved && Math.sqrt(Math.pow(p.x - g.x0, 2) + Math.pow(p.y - g.y0, 2)) > 10) g.moved = true;
      if (!g.moved) return;
      g.dx = g.dx * 0.6 + ddx * 0.4; g.dy = g.dy * 0.6 + ddy * 0.4;
      g.accR += d; g.accG += d; g.lx = p.x; g.ly = p.y;
      if (!calm) {
        if (g.accR >= STEP_RING) { g.accR = 0; ring(p.x, p.y); kick(); }
        if (g.accG >= STEP_GHOST && now - g.lastGhost > 160) { g.accG = 0; g.lastGhost = now; spawnGhost(p.x, p.y, g.dx, g.dy); }
      }
    }
    function onUp(e) {
      if (!g || e.pointerId !== g.id) return;
      var gg = g, p = pt(e); g = null;
      try { scene.releasePointerCapture(e.pointerId); } catch (x) {}
      lastAct = performance.now();
      if (e.type === 'pointercancel' || gg.dead) return;
      if (!gg.moved) { tap(gg.x0, gg.y0); return; }
      var near = nearGhost(p.x, p.y);
      if (near) {   // отпустили рядом с полускрытым вопросом: он проступает основным
        var r = near.r;
        dropGhost(near, true);
        newBlob(near.q, r.x + r.w / 2, r.y + r.h / 2);
      }
    }
    function brighten() { main.faint = false; main.lvlT = 1; main.t.style.opacity = ''; main.t.classList.remove('faint'); kick(); }
    function tap(x, y) {
      if (hitMain(x, y)) {
        if (main.faint) brighten();            // слабая капля проступает полностью
        else if (ready(main)) openMain();
        return;
      }
      clearGhosts();
      newBlob(pickQ(), x, y);
    }
    function openMain() { if (main) api.open(main.q, main.t, { opacity: 1, scale: 1 }); }

    // ---- капля в простое: через ~8 с тишины сама падает слабое пятно, приглашение коснуться
    function idleTick() {
      idleT = setTimeout(idleTick, 1000);
      if (!active || paused || calm || document.hidden || g) return;
      var now = performance.now();
      if (main && main.faint && now - main.t0 > 7000) { dieBlob(main); lastDrop = now; }
      else if (main && !main.faint && now - lastAct > 20000) { dieBlob(main); lastDrop = now; }   // забытое пятно тоже растворяется
      if (main || now - Math.max(lastAct, lastDrop) < 8000) return;
      newBlob(pickQ(), rnd(110, Math.max(111, vw - 110)), rnd(safeTop + 120, Math.max(safeTop + 121, vh - 120)), { faint: true });
    }

    scene.addEventListener('pointerdown', onDown);
    scene.addEventListener('pointermove', onMove);
    scene.addEventListener('pointerup', onUp);
    scene.addEventListener('pointercancel', onUp);
    scene.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    function clearAll() {
      timers.forEach(clearTimeout); timers = [];
      while (layer.firstChild) layer.removeChild(layer.firstChild);
      blobs = []; main = null; rings = []; ghosts = []; g = null;
      ctx.clearRect(0, 0, vw, vh);
    }
    return {
      enter: function (o) {
        active = true; paused = false;
        size(); C.paper = rgbOf('--hsheet', C.paper); C.mark = rgbOf('--hmark', C.mark); layers();
        clearAll();
        lastAct = lastDrop = performance.now();
        clearTimeout(idleT); idleT = setTimeout(idleTick, 1000);
        if (o.q >= 0) { var b = newBlob(o.q, vw / 2, vh / 2); b.t0 -= GROW; b.state = 'hold'; }
        kick();
      },
      leave: function () { active = false; halt(); clearTimeout(idleT); clearAll(); },
      pause: function () { paused = true; halt(); },
      resume: function () { paused = false; lastAct = performance.now(); kick(); },
      resize: function () { if (!active) return; size(); clearGhosts(); kick(); },
      refresh: function () { clearGhosts(); },
      onOpened: function (q) {
        if (main && main.q === q) { main.t.style.transition = 'none'; main.t.style.visibility = 'hidden'; }
      },
      onClosed: function (q) {
        if (main && main.q === q) { main.t.style.visibility = ''; void main.t.offsetWidth; main.t.style.transition = ''; }
        lastAct = performance.now();
      },
      returnTarget: function (q) { return main && main.q === q && main.t.parentNode ? { el: main.t, opacity: 1, scale: 1 } : null; },
      key: function (e) {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        if (e.target.tagName === 'BUTTON') return;
        e.preventDefault(); if (e.repeat) return;
        if (ready(main)) openMain();
        else if (main && main.faint) brighten();
        else if (!main || main.state !== 'grow') { clearGhosts(); newBlob(pickQ(), rnd(vw * 0.3, vw * 0.7), rnd(vh * 0.35, vh * 0.65)); }
      }
    };
  });
})();
