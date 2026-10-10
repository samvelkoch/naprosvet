/* «Поделиться»: лист снизу с двумя способами — «Картинкой» (PNG 1080 px по ширине, высота растёт
   под весь ответ; если выше 4320 — несколько карточек «1/2», «2/2») и «Текстом» (Web Share / буфер).
   Без библиотек, в стиле app.js (var, function). Стили листа вставляются отсюда же: файл грузится на
   «Сегодня», «Полке» и «Голосах_», а today.css/shelf.css есть не везде.
   window.NaprosvetShare.card({question, author, answer, id}) -> Promise<{via, blobs?}>
        via: 'share' | 'download' | 'copy' | 'cancel' | 'fail'
   window.NaprosvetShare.render(payload) -> Promise<{blobs:[...], canvases:[...]}> (только рисует, цели не шлёт)
   window.NaprosvetShare.text(payload) -> строка для «Текстом» */
(function () {
  var YM_ID = 113309794;
  var NAMES = { brodsky: 'Бродский', chekhov: 'Чехов', gary: 'Гари' };
  var WHERE = { brodsky: 'Венеция, ноябрь 1993', chekhov: 'Ялта, январь 1900', gary: 'Париж, 1978–1980' };
  var SITE = 'https://samvelkoch.github.io/naprosvet/voices/#';

  var W = 1080, H_MIN = 1350, H_MAX = 4320, PAD = 90, TEXT_W = W - PAD * 2;
  var C = { paper: '#fcfaf5', ink: '#211b16', muted: '#675d51', accent: '#9a2f22', ring: 'rgba(33,27,22,.18)' };
  var SERIF = '"PT Serif",Georgia,"Times New Roman",serif';
  var MONO = '"IBM Plex Mono","PT Mono",ui-monospace,Menlo,Consolas,monospace';
  var Q_SIZE = 34, Q_LEAD = 48, A_SIZE = 44, A_LEAD = 64, A_GAP = 26;
  var FOOT_H = 160;                        // подпись: от линии до низа карточки
  var FOOT_GAP = 56;                       // воздух между текстом и линией подписи

  function goal(name) { try { if (window.ym) window.ym(YM_ID, 'reachGoal', name); } catch (e) {} }

  /* шрифты: ждём не дольше 1.5 с, иначе рисуем запасными (офлайн, нет сети) */
  function fonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var list = ['44px "PT Serif"', 'italic 44px "PT Serif"', '34px "IBM Plex Mono"', '600 36px "IBM Plex Mono"'];
    var all = Promise.all(list.map(function (f) { return document.fonts.load(f).then(null, function () {}); }));
    var timeout = new Promise(function (res) { setTimeout(res, 1500); });
    return Promise.race([all, timeout]).then(function () {});
  }

  /* ---- текст ответа ----
     абзацы -> массивы знаков {c, em}; *…* = ремарка (курсив). Делим всегда по знакам, а не по строке,
     чтобы курсив не рвался на стыке частей. */
  function parseParas(text) {
    var out = [], paras = String(text || '').split(/\n\s*\n/);
    for (var p = 0; p < paras.length; p++) {
      var t = paras[p].replace(/\s*\n\s*/g, ' ').replace(/^\s+|\s+$/g, '');
      if (!t) continue;
      var cs = [], re = /\*([^*]+)\*/g, m, last = 0;
      var push = function (s, em) { s = s.replace(/\*/g, ''); for (var i = 0; i < s.length; i++) cs.push({ c: s.charAt(i), em: em }); };
      while ((m = re.exec(t))) { if (m.index > last) push(t.slice(last, m.index), false); push(m[1], true); last = re.lastIndex; }
      if (last < t.length) push(t.slice(last), false);
      if (cs.length) out.push(cs);
    }
    return out;
  }
  function isEnd(c) { return c === '.' || c === '!' || c === '?' || c === '…'; }
  function isClose(c) { return c === '»' || c === '"' || c === ')' || c === '”'; }
  /* абзац -> предложения (знаки сохраняют курсив); пробел-разделитель уходит из текста */
  function sentences(cs) {
    var out = [], cur = [], i, j;
    for (i = 0; i < cs.length; i++) {
      cur.push(cs[i]);
      if (isEnd(cs[i].c)) {
        j = i + 1;
        while (j < cs.length && isClose(cs[j].c)) { cur.push(cs[j]); j++; }
        if (j >= cs.length || cs[j].c === ' ') {
          out.push(cur); cur = [];
          while (j < cs.length && cs[j].c === ' ') j++;
          i = j - 1;
        } else i = j - 1;
      }
    }
    if (cur.length) out.push(cur);
    return out;
  }
  /* слова с курсивными кусками: слово = массив {t, em}; null = конец абзаца.
     Абзацы разделены знаком '\n' */
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
  /* часть = список абзацев; абзац = {cs, cont}: cont — продолжение предыдущего абзаца (разрезанного по предложениям) */
  function flat(part) {
    var out = [], i, k, a;
    for (i = 0; i < part.length; i++) {
      a = part[i];
      if (out.length) out.push(a.cont ? { c: ' ', em: false } : { c: '\n', em: false });
      for (k = 0; k < a.cs.length; k++) out.push(a.cs[k]);
    }
    return out;
  }

  function fontA(em) { return (em ? 'italic ' : '') + '400 ' + A_SIZE + 'px ' + SERIF; }
  function Measurer(ctx) {
    var cache = {}, self = this;
    ctx.font = fontA(false);
    this.space = ctx.measureText(' ').width;
    this.w = function (w) {
      var s = 0;
      for (var i = 0; i < w.length; i++) {
        var key = (w[i].em ? 'i' : 'n') + w[i].t, v = cache[key];
        if (v === undefined) { ctx.font = fontA(w[i].em); v = cache[key] = ctx.measureText(w[i].t).width; }
        s += v;
      }
      return s;
    };
    /* раскладка: строки [{words:[{w,x,width}], gap}] с переносом по словам */
    this.layout = function (ws) {
      var lines = [], line = null, x = 0, newPara = false;
      for (var i = 0; i < ws.length; i++) {
        if (ws[i] === null) { line = null; newPara = true; continue; }
        var w = self.w(ws[i]);
        if (line && x + self.space + w > TEXT_W) line = null;
        if (!line) { line = { words: [], gap: newPara && lines.length ? A_GAP : 0 }; lines.push(line); x = 0; newPara = false; }
        line.words.push({ w: ws[i], x: x ? x + self.space : 0, width: w });
        x = (x ? x + self.space : 0) + w;
      }
      return lines;
    };
  }
  function textHeight(lines) {
    var h = 0;
    for (var i = 0; i < lines.length; i++) h += A_LEAD + lines[i].gap;
    return h;
  }
  function partLines(m, part) { return m.layout(words(flat(part))); }

  /* вопрос: перенос по словам моно-шрифтом, без обрезки */
  function wrapPlain(ctx, text, font, width) {
    ctx.font = font;
    var ws = String(text || '').replace(/\s+/g, ' ').replace(/^\s|\s$/g, '').split(' '), lines = [], cur = '', i;
    for (i = 0; i < ws.length; i++) {
      var t = cur ? cur + ' ' + ws[i] : ws[i];
      if (cur && ctx.measureText(t).width > width) { lines.push(cur); cur = ws[i]; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /* ---- шапка и разбиение на части ---- */
  function headOf(ctx, question) {
    var ql = wrapPlain(ctx, question, '400 ' + Q_SIZE + 'px ' + MONO, TEXT_W);
    var y = 96 + Q_SIZE + Math.max(0, ql.length - 1) * Q_LEAD + Q_LEAD;   // низ последней строки вопроса
    var ruleY = y + 6;                                                    // короткая линия под вопросом
    return { lines: ql, ruleY: ruleY, textTop: ruleY + 3 + 24 };          // верх блока ответа
  }
  /* самое большое число строк, помещающееся в одну карточку */
  function capacity(head) { return H_MAX - FOOT_GAP - FOOT_H - head.textTop; }

  /* делим ответ: сначала по абзацам, абзац, не влезающий в пустую карточку, — по предложениям,
     предложение-гигант — по словам (страховка). Части выравниваем по высоте: перебираем лимит L от
     «поровну» до максимума, пока число частей не станет минимальным. */
  function split(m, paras, cap) {
    var whole = partLines(m, paras.map(function (cs) { return { cs: cs, cont: false }; }));
    var total = textHeight(whole);
    if (total <= cap) return [paras.map(function (cs) { return { cs: cs, cont: false }; })];

    var atoms = [], i, k, a, s;
    for (i = 0; i < paras.length; i++) {
      var single = [{ cs: paras[i], cont: false }];
      if (textHeight(partLines(m, single)) <= cap) { atoms.push(single[0]); continue; }
      s = sentences(paras[i]);
      for (k = 0; k < s.length; k++) {
        a = { cs: s[k], cont: k > 0 };
        if (textHeight(partLines(m, [a])) > cap) {                 // предложение больше целой карточки
          var wsplit = splitWords(m, s[k], cap);
          for (var q = 0; q < wsplit.length; q++) atoms.push({ cs: wsplit[q], cont: k > 0 || q > 0 });
        } else atoms.push(a);
      }
    }
    function pack(limit) {
      var parts = [], cur = [], j, x;
      for (j = 0; j < atoms.length; j++) {
        x = atoms[j];
        if (!cur.length) { cur.push(x); continue; }
        var probe = cur.concat([x]);
        if (textHeight(partLines(m, probe)) <= limit) cur = probe;
        else { parts.push(cur); cur = [{ cs: x.cs, cont: false }]; }   // новая часть начинается без «продолжения»
      }
      if (cur.length) parts.push(cur);
      return parts;
    }
    var best = pack(cap), n = best.length, L;
    for (L = Math.ceil(total / n); L < cap; L += A_LEAD) {
      var p = pack(L);
      if (p.length <= n) { best = p; break; }
    }
    return best;
  }
  function splitWords(m, cs, cap) {
    var out = [], cur = [], i, probe;
    for (i = 0; i < cs.length; i++) {
      cur.push(cs[i]);
      if (cs[i].c === ' ') {
        probe = cur.slice();
        if (textHeight(partLines(m, [{ cs: probe, cont: false }])) > cap - A_LEAD * 2) {
          out.push(cur.slice(0, -1)); cur = [];
        }
      }
    }
    if (cur.length) out.push(cur);
    return out;
  }

  /* ---- рисование одной карточки ---- */
  function draw(p, head, lines, textH, idx, total) {
    var H = Math.max(H_MIN, Math.ceil(head.textTop + textH + FOOT_GAP + FOOT_H)), FOOT_Y = H - FOOT_H;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.accent;                 // линия-рамка сверху
    ctx.fillRect(0, 0, W, 16);
    ctx.textBaseline = 'alphabetic';

    /* вопрос */
    var y = 96 + Q_SIZE, i, k;
    ctx.fillStyle = C.muted;
    ctx.font = '400 ' + Q_SIZE + 'px ' + MONO;
    for (i = 0; i < head.lines.length; i++) { ctx.fillText(head.lines[i], PAD, y); y += Q_LEAD; }
    ctx.fillStyle = C.ring;
    ctx.fillRect(PAD, head.ruleY, 120, 3);
    if (total > 1) {                          // «1/2» в правом верхнем углу, между полосой и вопросом
      ctx.textAlign = 'right';
      ctx.fillStyle = C.muted;
      ctx.font = '400 24px ' + MONO;
      ctx.fillText((idx + 1) + '/' + total, W - PAD, 66);
      ctx.textAlign = 'left';
    }

    /* ответ */
    y = head.textTop + A_LEAD * 0.78;
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

    /* подпись (на каждой карточке) */
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
    p = p || {};
    return fonts().then(function () {
      var probe = document.createElement('canvas').getContext('2d');
      var m = new Measurer(probe), head = headOf(probe, p.question);
      var paras = parseParas(p.answer), parts = paras.length ? split(m, paras, capacity(head)) : [[]];
      var canvases = parts.map(function (part, i) {
        var lines = partLines(m, part);
        return draw(p, head, lines, textHeight(lines), i, parts.length);
      });
      return Promise.all(canvases.map(toBlob)).then(function (blobs) {
        return { blobs: blobs, canvases: canvases, blob: blobs[0], canvas: canvases[0] };
      });
    });
  }

  /* ---- «Текстом» ---- */
  function textOf(p) {
    p = p || {};
    var ans = parseParas(p.answer).map(function (cs) { return cs.map(function (x) { return x.c; }).join(''); }).join('\n\n');
    var q = String(p.question || '').replace(/\s+/g, ' ').replace(/^\s|\s$/g, '');
    return q + '\n\n' + ans + '\n\n— ' + (NAMES[p.author] || '') + ' · реконструкция голоса, не цитата\n' + SITE + (p.id || '');
  }
  function copyText(text) {                     // синхронно из обработчика нажатия: Safari требует свежий жест
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
      }
    } catch (e) {}
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, text.length);
      var ok = document.execCommand && document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) { return false; }
  }

  /* ---- «Картинкой» ---- */
  function fileName(p, i, n) {
    var base = 'na-prosvet-' + String((p && p.id) || 'card').replace(/[^a-z0-9]+/gi, '-');
    return base + (n > 1 ? '-' + (i + 1) + 'iz' + n : '') + '.png';
  }
  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  }
  /* несколько файлов подряд с паузой: Chrome иначе спросит разрешение на «много загрузок», iOS — по одному */
  function downloadAll(blobs, names) {
    blobs.forEach(function (b, i) { setTimeout(function () { download(b, names[i]); }, i * 350); });
  }
  function canShareFiles(files) {
    try { return !!(files && files.length && navigator.share && navigator.canShare && navigator.canShare({ files: files })); }
    catch (e) { return false; }
  }

  /* ---- лист ---- */
  var CSS = '' +
    '.nps{position:fixed;inset:0;z-index:2000;-webkit-tap-highlight-color:transparent}' +
    '.nps .scrim{position:absolute;inset:0;background:rgba(14,10,8,.58);opacity:0;transition:opacity .2s ease}' +
    '.nps .sheet{position:absolute;left:0;right:0;bottom:0;max-width:560px;margin:0 auto;padding:14px 16px calc(16px + env(safe-area-inset-bottom,0px));' +
    'background:var(--surface,#fcfaf5);color:var(--ink,#211b16);border:1px solid var(--ring,rgba(33,27,22,.15));border-bottom:0;border-radius:6px 6px 0 0;' +
    'box-shadow:0 -18px 40px -16px rgba(0,0,0,.5);font:13px/1.35 var(--f-mono,"IBM Plex Mono",ui-monospace,monospace);transform:translateY(100%);transition:transform .22s ease}' +
    '.nps.on .scrim{opacity:1}.nps.on .sheet{transform:none}' +
    '.nps h2{margin:0 0 10px;font:600 12px/1 var(--f-mono,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--muted,#675d51)}' +
    '.nps .row{display:block;width:100%;margin:0 0 8px;padding:12px 14px;min-height:56px;text-align:left;cursor:pointer;color:var(--ink,#211b16);background:var(--surface,#fcfaf5);' +
    'border:1px solid var(--ring,rgba(33,27,22,.15));border-radius:4px;font:inherit}' +
    '.nps .row:active{border-color:var(--accent,#9a2f22)}' +
    '.nps .row b{display:block;font:600 14px/1.2 var(--f-mono,monospace)}' +
    '.nps .row small{display:block;margin-top:5px;font-size:11.5px;color:var(--muted,#675d51)}' +
    '.nps .row.done small{color:var(--accent,#9a2f22)}' +
    '.nps .row:focus-visible,.nps .cancel:focus-visible{outline:2px solid var(--accent,#9a2f22);outline-offset:2px}' +
    '.nps .cancel{display:block;width:100%;margin-top:2px;padding:12px;cursor:pointer;background:none;border:0;border-radius:4px;color:var(--muted,#675d51);font:500 12.5px var(--f-mono,monospace)}' +
    '@media (prefers-reduced-motion:reduce){.nps .scrim,.nps .sheet{transition:none}}';
  function css() {
    if (document.getElementById('np-share-css')) return;
    var s = document.createElement('style');
    s.id = 'np-share-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function plural(n) { return n === 1 ? 'картинка' : (n < 5 ? 'картинки' : 'картинок'); }

  var open = null;     // единственный открытый лист

  function card(p) {
    p = p || {};
    if (open) open.close('cancel');
    css();
    return new Promise(function (resolve) {
      var root = el('div', 'nps'), sheet = el('div', 'sheet'), prevFocus = document.activeElement, done = false;
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Поделиться');
      var scrim = el('div', 'scrim');
      var rowImg = el('button', 'row'), rowTxt = el('button', 'row'), cancel = el('button', 'cancel', 'Отмена');
      rowImg.type = rowTxt.type = cancel.type = 'button';
      var imgSub = el('small', null, 'готовлю…'), txtSub = el('small', null, 'вопрос и ответ целиком');
      rowImg.appendChild(el('b', null, 'Картинкой')); rowImg.appendChild(imgSub);
      rowTxt.appendChild(el('b', null, 'Текстом')); rowTxt.appendChild(txtSub);
      sheet.appendChild(el('h2', null, 'Поделиться'));
      sheet.appendChild(rowImg); sheet.appendChild(rowTxt); sheet.appendChild(cancel);
      root.appendChild(scrim); root.appendChild(sheet);
      document.body.appendChild(root);
      requestAnimationFrame(function () { root.className = 'nps on'; });
      try { rowImg.focus(); } catch (e) {}

      function onKey(ev) { if (ev.key === 'Escape') finish({ via: 'cancel' }); }
      function finish(res, delay) {
        if (done) return; done = true;
        document.removeEventListener('keydown', onKey, true);
        open = null;
        setTimeout(function () {
          if (root.parentNode) root.parentNode.removeChild(root);
          try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) {}
        }, delay || 0);
        resolve(res);
      }
      open = { close: function (via) { finish({ via: via }); } };
      document.addEventListener('keydown', onKey, true);
      scrim.addEventListener('click', function () { finish({ via: 'cancel' }); });
      cancel.addEventListener('click', function () { finish({ via: 'cancel' }); });

      /* ---- «Картинкой»: рендер стартует при открытии листа ----
         Safari разрешает navigator.share только в обработчике нажатия, а не после долгого await.
         Нажатие №1 открыло лист; PNG рисуются, пока человек читает строки. Когда файлы готовы, в обработчике
         нажатия №2 вызываем navigator.share СИНХРОННО (ready !== null). Если нажали раньше, чем отрисовалось,
         ждём promise; тогда жест мог протухнуть: NotAllowedError ловим и падаем на скачивание. */
      var ready = null, failed = false, names = [];
      var rendering = render(p).then(function (r) {
        names = r.blobs.map(function (b, i) { return fileName(p, i, r.blobs.length); });
        var files = [];
        try { files = r.blobs.map(function (b, i) { return new File([b], names[i], { type: 'image/png' }); }); } catch (e) { files = []; }
        ready = { r: r, files: files, can: canShareFiles(files) };
        imgSub.textContent = r.blobs.length + ' ' + plural(r.blobs.length) + (r.blobs.length > 1 ? ' · ответ длинный, делим' : '');
        return ready;
      }).then(null, function () { failed = true; imgSub.textContent = 'не получилось нарисовать'; return null; });

      function afterImage(rd, outcome) {
        if (outcome === 'cancel') finish({ via: 'cancel', blobs: rd.r.blobs });
        else finish({ via: outcome, blobs: rd.r.blobs });
      }
      function sendImage(rd) {            // вызывается синхронно, если rd уже готов
        if (rd.can) {
          var pr;
          try { pr = navigator.share({ files: rd.files }); } catch (e) { pr = Promise.reject(e); }
          pr.then(function () { afterImage(rd, 'share'); }, function (e) {
            if (e && e.name === 'AbortError') { afterImage(rd, 'cancel'); return; }   // человек закрыл окно отправки
            downloadAll(rd.r.blobs, names); afterImage(rd, 'download');              // NotAllowedError и прочее: хотя бы скачать
          });
        } else { downloadAll(rd.r.blobs, names); afterImage(rd, 'download'); }
      }
      rowImg.addEventListener('click', function () {
        goal('share');
        if (failed) return;
        if (ready) sendImage(ready);
        else { imgSub.textContent = 'готовлю…'; rendering.then(function (rd) { if (rd) sendImage(rd); }); }
      });

      /* ---- «Текстом» ---- */
      rowTxt.addEventListener('click', function () {
        goal('share'); goal('share_text');
        var text = textOf(p), title = 'На_просвет · ' + (NAMES[p.author] || '');
        function copied() {
          copyText(text).then(function (ok) {
            if (!ok) { txtSub.textContent = 'не удалось скопировать'; return; }
            rowTxt.className = 'row done'; txtSub.textContent = 'Скопировано';
            finish({ via: 'copy' }, 900);
          });
        }
        var has = false;
        try { has = typeof navigator.share === 'function'; } catch (e) { has = false; }
        if (!has) { copied(); return; }
        var pr;
        try { pr = navigator.share({ title: title, text: text }); } catch (e) { pr = Promise.reject(e); }
        pr.then(function () { finish({ via: 'share' }); }, function (e) {
          if (e && e.name === 'AbortError') { finish({ via: 'cancel' }); return; }
          copied();
        });
      });
    });
  }

  window.NaprosvetShare = { card: card, render: render, text: textOf };
})();
