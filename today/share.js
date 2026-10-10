/* Карточка «Поделиться»: PNG 1080×1350 на canvas, отправка через Web Share API с файлом
   или скачивание. Без библиотек, в стиле app.js (var, function).
   window.NaprosvetShare.card({question, author, answer, id}) -> Promise<{blob, canvas, via}>
   window.NaprosvetShare.render(payload) -> Promise<{blob, canvas}> (только рисует, ничего не отправляет) */
(function () {
  var YM_ID = 113309794;
  var NAMES = { brodsky: 'Бродский', chekhov: 'Чехов', gary: 'Гари' };
  var WHERE = { brodsky: 'Венеция, ноябрь 1993', chekhov: 'Ялта, январь 1900', gary: 'Париж, 1978–1980' };

  var W = 1080, H = 1350, PAD = 90, TEXT_W = W - PAD * 2;
  var C = { paper: '#fcfaf5', ink: '#211b16', muted: '#675d51', accent: '#9a2f22', ring: 'rgba(33,27,22,.18)' };
  var SERIF = '"PT Serif",Georgia,"Times New Roman",serif';
  var MONO = '"IBM Plex Mono","PT Mono",ui-monospace,Menlo,Consolas,monospace';
  var Q_SIZE = 34, Q_LEAD = 48, A_SIZE = 44, A_LEAD = 64, A_GAP = 26;
  var FOOT_Y = 1190;                       // линия над подписью
  var MAX_CHARS = 550;
  var Q_LINES = 5;

  function goal(name) { try { if (window.ym) window.ym(YM_ID, 'reachGoal', name); } catch (e) {} }

  /* шрифты: ждём не дольше 1.5 с, иначе рисуем запасными (офлайн, нет сети) */
  function fonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var list = ['44px "PT Serif"', 'italic 44px "PT Serif"', '34px "IBM Plex Mono"', '600 36px "IBM Plex Mono"'];
    var all = Promise.all(list.map(function (f) { return document.fonts.load(f).then(null, function () {}); }));
    var timeout = new Promise(function (res) { setTimeout(res, 1500); });
    return Promise.race([all, timeout]).then(function () {});
  }

  /* ---- текст ответа: массив знаков {c, em}; абзац = знак '\n' ---- */
  function chars(text) {
    var out = [], paras = String(text || '').split(/\n\s*\n/);
    for (var p = 0; p < paras.length; p++) {
      var t = paras[p].replace(/\s*\n\s*/g, ' ').replace(/^\s+|\s+$/g, '');
      if (!t) continue;
      if (out.length) out.push({ c: '\n', em: false });
      var re = /\*([^*]+)\*/g, m, last = 0, i;
      var push = function (s, em) { for (i = 0; i < s.length; i++) out.push({ c: s.charAt(i), em: em }); };
      while ((m = re.exec(t))) { if (m.index > last) push(t.slice(last, m.index), false); push(m[1], true); last = re.lastIndex; }
      if (last < t.length) push(t.slice(last), false);
    }
    return out;
  }
  function isEnd(c) { return c === '.' || c === '!' || c === '?' || c === '…'; }
  function isSpace(c) { return c === ' ' || c === '\n' || c === undefined; }
  /* обрезка до limit знаков по границе предложения, иначе по слову; в конце «…» */
  function truncate(cs, limit) {
    if (cs.length <= limit) return cs;
    var cut = -1, i;
    for (i = Math.min(limit, cs.length - 1); i >= Math.floor(limit * 0.45); i--) {
      if (isEnd(cs[i].c) && isSpace((cs[i + 1] || {}).c)) { cut = i + 1; break; }
    }
    if (cut < 0) {
      for (i = Math.min(limit, cs.length - 1); i > 0; i--) if (isSpace(cs[i].c)) { cut = i; break; }
      if (cut < 0) cut = limit;
    }
    var out = cs.slice(0, cut);
    while (out.length && (isSpace(out[out.length - 1].c) || /[.,;:\-–—]/.test(out[out.length - 1].c))) out.pop();
    out.push({ c: '…', em: false });
    return out;
  }
  /* слова с курсивными кусками: слово = массив {t, em}; null = конец абзаца */
  function words(cs) {
    var res = [], cur = null, i, ch;
    for (i = 0; i < cs.length; i++) {
      ch = cs[i];
      if (ch.c === '\n') { if (cur) res.push(cur); cur = null; res.push(null); continue; }
      if (ch.c === ' ') { if (cur) res.push(cur); cur = null; continue; }
      if (!cur) cur = [];
      var run = cur[cur.length - 1];
      if (run && run.em === ch.em) run.t += ch.c; else cur.push({ t: ch.c, em: ch.em });
    }
    if (cur) res.push(cur);
    return res;
  }

  function fontA(em) { return (em ? 'italic ' : '') + '400 ' + A_SIZE + 'px ' + SERIF; }
  function wordW(ctx, w) {
    var s = 0;
    for (var i = 0; i < w.length; i++) { ctx.font = fontA(w[i].em); s += ctx.measureText(w[i].t).width; }
    return s;
  }
  /* раскладка: строки [{words:[...], gapBefore}] с переносом по словам */
  function layout(ctx, ws) {
    var lines = [], line = null, x = 0;
    ctx.font = fontA(false);
    var space = ctx.measureText(' ').width, newPara = false;
    for (var i = 0; i < ws.length; i++) {
      if (ws[i] === null) { line = null; newPara = true; continue; }
      var w = wordW(ctx, ws[i]);
      if (line && x + space + w > TEXT_W) line = null;
      if (!line) { line = { words: [], gap: newPara && lines.length ? A_GAP : 0 }; lines.push(line); x = 0; newPara = false; }
      line.words.push({ w: ws[i], x: x ? x + space : 0, width: w });
      x = (x ? x + space : 0) + w;
    }
    return lines;
  }
  function textHeight(lines) {
    var h = 0;
    for (var i = 0; i < lines.length; i++) h += A_LEAD + lines[i].gap;
    return h;
  }

  /* вопрос: перенос по словам моно-шрифтом */
  function wrapPlain(ctx, text, font, width, maxLines) {
    ctx.font = font;
    var ws = String(text || '').replace(/\s+/g, ' ').replace(/^\s|\s$/g, '').split(' '), lines = [], cur = '', i;
    for (i = 0; i < ws.length; i++) {
      var t = cur ? cur + ' ' + ws[i] : ws[i];
      if (cur && ctx.measureText(t).width > width) { lines.push(cur); cur = ws[i]; } else cur = t;
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines[maxLines - 1];
      while (last.length && ctx.measureText(last + '…').width > width) last = last.slice(0, -1).replace(/\s+$/, '');
      lines[maxLines - 1] = last + '…';
    }
    return lines;
  }

  function draw(p) {
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.accent;                 // линия-рамка сверху
    ctx.fillRect(0, 0, W, 16);
    ctx.textBaseline = 'alphabetic';

    /* вопрос */
    var y = 96 + Q_SIZE;
    var ql = wrapPlain(ctx, p.question, '400 ' + Q_SIZE + 'px ' + MONO, TEXT_W, Q_LINES), i, k;
    ctx.fillStyle = C.muted;
    ctx.font = '400 ' + Q_SIZE + 'px ' + MONO;
    for (i = 0; i < ql.length; i++) { ctx.fillText(ql[i], PAD, y); y += Q_LEAD; }
    y += 6;
    ctx.fillStyle = C.ring;
    ctx.fillRect(PAD, y, 120, 3);
    var top = y + 24 + A_LEAD * 0.78;          // базовая линия первой строки ответа
    var maxH = FOOT_Y - 56 - (top - A_LEAD * 0.78);

    /* ответ: ужимаем текст, пока не влезет по высоте */
    var cs = chars(p.answer), limit = MAX_CHARS, lines;
    for (;;) {
      lines = layout(ctx, words(truncate(cs, limit)));
      if (textHeight(lines) <= maxH || limit <= 120) break;
      limit -= 30;
    }
    y = top;
    ctx.fillStyle = C.ink;
    for (i = 0; i < lines.length; i++) {
      y += lines[i].gap;
      for (k = 0; k < lines[i].words.length; k++) {
        var wd = lines[i].words[k], x = PAD + wd.x;
        for (var r = 0; r < wd.w.length; r++) {
          ctx.font = fontA(wd.w[r].em);
          ctx.fillStyle = wd.w[r].em ? C.muted : C.ink;
          ctx.fillText(wd.w[r].t, x, y);
          x += ctx.measureText(wd.w[r].t).width;
        }
      }
      y += A_LEAD;
    }

    /* подпись */
    ctx.fillStyle = C.ring;
    ctx.fillRect(PAD, FOOT_Y, TEXT_W, 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.font = '600 36px ' + MONO;
    ctx.fillText(NAMES[p.author] || '', PAD, FOOT_Y + 70);
    ctx.fillStyle = C.muted;
    ctx.font = '400 26px ' + MONO;
    ctx.fillText(WHERE[p.author] || '', PAD, FOOT_Y + 116);

    // «на_просвет»: терракотовое подчёркивание, остальное чернилами; справа выровнено по краю текста
    ctx.font = '600 40px ' + MONO;
    var wA = ctx.measureText('на').width, wB = ctx.measureText('_').width, wC = ctx.measureText('просвет').width;
    var x0 = W - PAD - (wA + wB + wC), by = FOOT_Y + 70;
    ctx.fillStyle = C.ink; ctx.fillText('на', x0, by);
    ctx.fillStyle = C.accent; ctx.fillText('_', x0 + wA, by);
    ctx.fillStyle = C.ink; ctx.fillText('просвет', x0 + wA + wB, by);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.muted;
    ctx.font = '400 22px ' + MONO;
    ctx.fillText('samvelkoch.github.io/naprosvet', W - PAD, FOOT_Y + 116);
    ctx.textAlign = 'left';
    return cv;
  }

  function toBlob(cv) {
    return new Promise(function (res, rej) {
      if (cv.toBlob) { cv.toBlob(function (b) { if (b) res(b); else rej(new Error('blob')); }, 'image/png'); return; }
      try {                                     // старые браузеры
        var d = cv.toDataURL('image/png'), bin = atob(d.split(',')[1]), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        res(new Blob([arr], { type: 'image/png' }));
      } catch (e) { rej(e); }
    });
  }

  function render(p) {
    return fonts().then(function () {
      var cv = draw(p || {});
      return toBlob(cv).then(function (blob) { return { blob: blob, canvas: cv }; });
    });
  }

  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  }

  function card(p) {
    goal('share');
    return render(p).then(function (r) {
      var name = 'na-prosvet-' + String((p && p.id) || 'card').replace(/[^a-z0-9]+/gi, '-') + '.png', file = null;
      try { file = new File([r.blob], name, { type: 'image/png' }); } catch (e) { file = null; }
      var can = false;
      try { can = !!(file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) { can = false; }
      if (!can) { download(r.blob, name); r.via = 'download'; return r; }
      return navigator.share({ files: [file] }).then(function () { r.via = 'share'; return r; }, function (e) {
        if (e && e.name === 'AbortError') { r.via = 'cancel'; return r; }   // пользователь закрыл окно отправки
        download(r.blob, name);                                              // NotAllowedError и прочее: хотя бы скачать
        r.via = 'download';
        return r;
      });
    }).then(null, function () { return null; });   // рисование не удалось: молча ничего не делаем
  }

  window.NaprosvetShare = { card: card, render: render };
})();
