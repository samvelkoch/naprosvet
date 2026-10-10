/* «Поделиться» для артефактов исследований на страницах авторов: график (панель .panel) или текстовый вывод
   (p.finding и карточки #findings) -> PNG-карточка на canvas, отправка через Web Share API или скачивание.
   Карточка всегда светлая, даже когда страница в тёмной теме. Без библиотек, в стиле app.js (var, function).
   Лежит в today/, потому что сервис-воркер уже предкэширует today/* (sw/build.py), отдельная правка списка не нужна.

   window.NaprosvetRShare.render(el)  -> Promise<{blob, canvas, name, w, h}>  (только рисует, ничего не отправляет)
   window.NaprosvetRShare.share(el)   -> Promise<{blob, name, via}>           (рисует и отправляет / скачивает)
   el: .panel с .chart svg, p.finding или div внутри #findings. */
(function () {
  var YM_ID = 113309794;
  var doc = document, root = doc.documentElement;
  var SITE = 'https://samvelkoch.github.io/naprosvet/';
  var NAMES = { brodsky: 'БРОДСКИЙ', chekhov: 'ЧЕХОВ', gary: 'ГАРИ' };
  var FONTS_URL = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=PT+Serif:ital,wght@0,400;0,700;1,400&display=swap';

  var W = 1080, PAD = 72, CW = W - PAD * 2;
  var MAXH = 3600;                         // выше не растим: у iOS canvas ограничен по площади
  var SERIF = '"PT Serif",Georgia,"Times New Roman",serif';
  var MONO = '"IBM Plex Mono","PT Mono",ui-monospace,Menlo,Consolas,monospace';
  var C = { paper: '#fcfaf5', ink: '#211b16', ink2: '#4b4238', muted: '#675d51', accent: '#9a2f22', ring: 'rgba(33,27,22,.18)' };

  function goal(name) { try { if (window.ym) window.ym(YM_ID, 'reachGoal', name); } catch (e) {} }
  function clean(t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, ''); }

  /* ================= тема: светлый и тёмный наборы токенов страницы ================= */
  /* Светлые значения берём из правила :root, тёмные — из :root[data-theme="dark"] / @media (prefers-color-scheme: dark).
     Если страница сейчас тёмная, график уже нарисован тёмными цветами (JS страницы подставляет их литералами),
     поэтому каждый цвет переводим «тёмный токен -> светлый токен», а смеси (тепловые карты) — по паре токенов и доле. */
  var tokCache = null;
  function readTokens() {
    if (tokCache) return tokCache;
    var light = {}, dark = {};
    function grab(css, into) {
      var re = /(--[\w-]+)\s*:\s*([^;}]+)/g, m;
      while ((m = re.exec(css))) into[m[1]] = clean(m[2]);
    }
    function walk(rules, inDark) {
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        if (r.type === 1 && r.selectorText) {
          var sel = r.selectorText.replace(/\s+/g, '');
          if (sel === ':root') grab(r.cssText, inDark ? dark : light);
          else if (sel === ':root[data-theme="dark"]' || sel === ':root:not([data-theme="light"])') grab(r.cssText, dark);
        } else if (r.type === 4 && r.cssRules) {          // @media
          walk(r.cssRules, /prefers-color-scheme\s*:\s*dark/.test((r.media && r.media.mediaText) || r.conditionText || ''));
        }
      }
    }
    for (var s = 0; s < doc.styleSheets.length; s++) {
      var rules = null;
      try { rules = doc.styleSheets[s].cssRules; } catch (e) { rules = null; }   // чужой стиль (шрифты Google) недоступен
      if (rules) walk(rules, false);
    }
    tokCache = { light: light, dark: dark };
    return tokCache;
  }

  var normEl = null, normMemo = {};
  /* любой CSS-цвет -> 'rgb(r, g, b)' / 'rgba(r, g, b, a)', как отдаёт getComputedStyle */
  function norm(c) {
    if (normMemo[c]) return normMemo[c];
    if (!normEl) { normEl = doc.createElement('i'); normEl.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;visibility:hidden'; }
    doc.body.appendChild(normEl);
    normEl.style.color = '';
    normEl.style.color = c;
    var v = normEl.style.color ? getComputedStyle(normEl).color : c;
    doc.body.removeChild(normEl);
    normMemo[c] = v;
    return v;
  }
  function rgbOf(s) {
    var m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?\s*\)$/.exec(s);
    return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
  }
  var PAIRS = ['--heat-lo', '--heat-hi', '--div-mid', '--div-pos', '--div-neg', '--surface', '--accent', '--s1', '--s2', '--c3', '--c4', '--neutral-bar', '--ink', '--page'];

  function theme() {
    var t = readTokens(), th = { dark: false, map: {}, pairs: [], memo: {}, light: t.light, darkTok: t.dark };
    var lightSurf = t.light['--surface'];
    if (lightSurf) {
      var cur = clean(getComputedStyle(root).getPropertyValue('--surface'));
      th.dark = !!cur && norm(cur) !== norm(lightSurf);
    }
    if (!th.dark) return th;
    var n;
    for (n in t.dark) {
      if (!t.light[n] || !/^(#|rgb|hsl)/i.test(t.dark[n]) || !/^(#|rgb|hsl)/i.test(t.light[n])) continue;
      var d = norm(t.dark[n]), l = norm(t.light[n]);
      if (!th.map[d]) th.map[d] = l;
    }
    var names = [];
    for (var i = 0; i < PAIRS.length; i++) if (t.dark[PAIRS[i]] && t.light[PAIRS[i]]) names.push(PAIRS[i]);
    for (i = 0; i < names.length; i++) for (var j = 0; j < names.length; j++) {
      if (i === j) continue;
      var A = rgbOf(norm(t.dark[names[i]])), B = rgbOf(norm(t.dark[names[j]]));
      if (A && B) th.pairs.push({ A: A, B: B, LA: rgbOf(norm(t.light[names[i]])), LB: rgbOf(norm(t.light[names[j]])) });
    }
    return th;
  }
  /* цвет, нарисованный страницей в тёмной теме -> тот же цвет светлой темы */
  function lighten(th, v) {
    if (!th.dark || !v || v === 'none') return v;
    if (th.map[v]) return th.map[v];
    if (th.memo[v] !== undefined) return th.memo[v];
    var c = rgbOf(v), out = v;
    if (c) {
      var base = 'rgb(' + c[0] + ', ' + c[1] + ', ' + c[2] + ')';
      if (c[3] < 1 && th.map[base]) {
        var q = rgbOf(th.map[base]);
        out = 'rgba(' + q[0] + ', ' + q[1] + ', ' + q[2] + ', ' + c[3] + ')';
      } else if (c[3] >= 1) {
        var best = null, bestErr = 2.6;
        for (var k = 0; k < th.pairs.length; k++) {                // смесь двух токенов: v = A + (B - A) * t
          var p = th.pairs[k], num = 0, den = 0, ch;
          for (ch = 0; ch < 3; ch++) { var dd = p.B[ch] - p.A[ch]; num += dd * (c[ch] - p.A[ch]); den += dd * dd; }
          if (!den) continue;
          var t = num / den;
          if (t < -0.01 || t > 1.01) continue;
          var err = 0;
          for (ch = 0; ch < 3; ch++) err = Math.max(err, Math.abs(p.A[ch] + (p.B[ch] - p.A[ch]) * t - c[ch]));
          if (err < bestErr) { bestErr = err; best = { p: p, t: t }; }
        }
        if (best) {
          var o = [];
          for (var h = 0; h < 3; h++) o.push(Math.round(best.p.LA[h] + (best.p.LB[h] - best.p.LA[h]) * best.t));
          out = 'rgb(' + o.join(', ') + ')';
        }
      }
    }
    th.memo[v] = out;
    return out;
  }

  /* ================= шрифты внутри SVG ================= */
  /* <img> с SVG не видит веб-шрифтов страницы, поэтому вшиваем @font-face (base64, только cyrillic + latin
     и только те начертания, что есть в графике). CSS берём с той же ссылки Google Fonts, что у страницы:
     сервис-воркер уже кладёт и CSS, и woff2 в кэш naprosvet-rt, офлайн это работает. */
  var facesWait = null, b64Wait = {};
  function faces() {
    if (facesWait) return facesWait;
    var link = doc.querySelector('link[href*="fonts.googleapis.com/css"]');
    facesWait = fetch(link && link.href ? link.href : FONTS_URL).then(function (r) {
      if (!r.ok) throw new Error('fonts css');
      return r.text();
    }).then(function (css) {
      var out = [], re = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g, m;
      while ((m = re.exec(css))) {
        if (m[1] !== 'cyrillic' && m[1] !== 'latin') continue;
        var b = m[2];
        var fam = /font-family:\s*['"]?([^;'"]+)['"]?/.exec(b), st = /font-style:\s*(\w+)/.exec(b), wt = /font-weight:\s*(\d+)/.exec(b);
        var url = /url\(([^)]+)\)/.exec(b), ur = /unicode-range:\s*([^;]+)/.exec(b);
        if (fam && url) out.push({ family: clean(fam[1]), style: st ? st[1] : 'normal', weight: wt ? +wt[1] : 400, subset: m[1], url: url[1].replace(/['"]/g, ''), range: ur ? clean(ur[1]) : '' });
      }
      return out;
    });
    facesWait.then(null, function () { facesWait = null; });   // не вышло (сеть) — в следующий раз попробуем снова
    return facesWait;
  }
  function bytesToB64(buf) {
    var u = new Uint8Array(buf), s = '', step = 0x8000;
    for (var i = 0; i < u.length; i += step) s += String.fromCharCode.apply(null, u.subarray(i, i + step));
    return btoa(s);
  }
  function faceB64(url) {
    if (!b64Wait[url]) {
      b64Wait[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error('woff2'); return r.arrayBuffer(); }).then(bytesToB64);
      b64Wait[url].then(null, function () { delete b64Wait[url]; });
    }
    return b64Wait[url];
  }
  /* need: { 'IBM Plex Mono|400|normal': true, ... } -> текст <style> с @font-face */
  function fontCss(need) {
    var timeout = new Promise(function (res) { setTimeout(function () { res(''); }, 7000); });
    var job = faces().then(function (list) {
      var pick = {}, key;
      for (key in need) {
        var p = key.split('|'), fam = p[0], w = +p[1], st = p[2], best = {}, i;
        for (i = 0; i < list.length; i++) {
          var f = list[i];
          if (f.family !== fam || f.style !== st) continue;
          var d = Math.abs(f.weight - w);
          if (best[f.subset] === undefined || d < best[f.subset].d) best[f.subset] = { d: d, f: f };
        }
        for (var s in best) pick[best[s].f.url] = best[s].f;
      }
      var urls = [], k;
      for (k in pick) urls.push(k);
      return Promise.all(urls.map(function (u) {
        return faceB64(u).then(function (b64) {
          var f = pick[u];
          return '@font-face{font-family:"' + f.family + '";font-style:' + f.style + ';font-weight:' + f.weight +
            ';src:url(data:font/woff2;base64,' + b64 + ') format("woff2");' + (f.range ? 'unicode-range:' + f.range + ';' : '') + '}';
        });
      })).then(function (parts) { return parts.join(''); });
    }).then(null, function () { return ''; });      // без шрифтов: нарисуется запасными, лучше, чем ничего
    return Promise.race([job, timeout]);
  }

  /* ================= SVG графика: клон со вшитыми вычисленными стилями ================= */
  var INH = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin',
    'fill-opacity', 'stroke-opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'visibility'];
  var NONINH = ['opacity', 'display', 'dominant-baseline'];
  var DROP_ATTR = INH.concat(NONINH, ['class', 'style', 'tabindex', 'role', 'focusable']);

  /* цвет, заданный самим элементом (атрибутом или style): литерал страницы, а не var() и не правило CSS */
  function ownColor(el, prop) {
    var st = el.getAttribute('style'), m = st ? new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)').exec(st) : null;
    var v = clean(m ? m[1] : el.getAttribute(prop));
    return v;
  }
  function isLiteral(v) { return !!v && !/var\(|currentcolor|inherit|color-mix|url\(/i.test(v); }

  function styleTree(svg, th, faceNeed) {
    var all = [svg], q = svg.querySelectorAll('*'), i, j;
    for (i = 0; i < q.length; i++) all.push(q[i]);
    var vals = [], raws = [];
    var index = typeof Map === 'function' ? new Map() : null;
    for (i = 0; i < all.length; i++) {
      var el = all[i], cs = getComputedStyle(el), v = {}, raw = {};
      for (j = 0; j < INH.length; j++) v[INH[j]] = cs.getPropertyValue(INH[j]);
      for (j = 0; j < NONINH.length; j++) v[NONINH[j]] = cs.getPropertyValue(NONINH[j]);
      raw.fill = v.fill; raw.stroke = v.stroke;
      /* тёмная тема: литералы (#hex, rgb()) страница уже сложила в тёмных цветах — переводим в светлые;
         всё, что пришло через var() и правила CSS, клон уже посчитал светлым (токены подменены на контейнере) */
      var par = i > 0 && index && el.parentNode ? index.get(el.parentNode) : undefined, pr = par !== undefined ? raws[par] : null;
      var cols = ['fill', 'stroke'];
      for (j = 0; j < 2; j++) {
        var cn = cols[j], own = ownColor(el, cn);
        if (own) { if (isLiteral(own)) v[cn] = lighten(th, v[cn]); }
        else if (pr && pr[cn] === raw[cn]) v[cn] = vals[par][cn];
      }
      vals.push(v); raws.push(raw);
      if (index) index.set(el, i);
      var tn = el.localName;
      if (tn === 'text' || tn === 'tspan' || tn === 'textPath') {
        var fam = clean((v['font-family'].split(',')[0] || '').replace(/["']/g, ''));
        faceNeed[fam + '|' + (parseInt(v['font-weight'], 10) || 400) + '|' + (/italic|oblique/.test(v['font-style']) ? 'italic' : 'normal')] = true;
      }
    }
    for (i = 0; i < all.length; i++) {
      var e = all[i], vv = vals[i], pv = null;
      if (i > 0) {
        var par = e.parentNode;
        pv = par && index && index.has(par) ? vals[index.get(par)] : null;
      }
      var css = '';
      for (j = 0; j < INH.length; j++) {
        var n = INH[j];
        if (n === 'visibility' && vv[n] === 'visible' && (!pv || pv[n] === 'visible')) continue;
        if (!pv || pv[n] !== vv[n]) css += n + ':' + vv[n] + ';';
      }
      if (i > 0) {
        if (vv.opacity !== '1') css += 'opacity:' + vv.opacity + ';';
        if (vv.display === 'none') css += 'display:none;';
        if (vv['dominant-baseline'] && vv['dominant-baseline'] !== 'auto') css += 'dominant-baseline:' + vv['dominant-baseline'] + ';';
      }
      for (j = 0; j < DROP_ATTR.length; j++) if (e.hasAttribute(DROP_ATTR[j])) e.removeAttribute(DROP_ATTR[j]);
      var at = e.attributes;
      for (j = at.length - 1; j >= 0; j--) if (at[j].name.indexOf('data-') === 0 || at[j].name.indexOf('aria-') === 0) e.removeAttribute(at[j].name);
      if (css) e.setAttribute('style', css);
    }
    // заголовки <title> внутри фигур к картинке не относятся
    var titles = svg.querySelectorAll('title');
    for (i = 0; i < titles.length; i++) titles[i].parentNode.removeChild(titles[i]);
  }

  /* клон .chart кладём рядом с оригиналом (чтобы работали селекторы страницы) и мерим всё синхронно */
  function snapChart(chart, th) {
    var rect = chart.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 20) throw new Error('hidden');
    var host = chart.cloneNode(true);
    host.style.cssText += ';position:absolute;left:-10000px;top:0;width:' + rect.width + 'px;margin:0;pointer-events:none;';
    if (th.dark) for (var n in th.darkTok) if (th.light[n]) host.style.setProperty(n, th.light[n]);   // var() внутри клона -> светлые
    var parent = chart.parentNode;
    parent.insertBefore(host, chart.nextSibling);
    var items = [], faceNeed = {};
    try {
      var hr = host.getBoundingClientRect();
      var list = host.querySelectorAll('svg');
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        if (s.parentNode && s.parentNode.closest && s.parentNode.closest('svg')) continue;     // вложенные не трогаем
        var r = s.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        var vb = s.getAttribute('viewBox');
        if (!vb) s.setAttribute('viewBox', '0 0 ' + r.width + ' ' + r.height);
        styleTree(s, th, faceNeed);
        items.push({ svg: s, x: r.left - hr.left, y: r.top - hr.top, w: r.width, h: r.height });
      }
    } finally {
      parent.removeChild(host);
    }
    if (!items.length) throw new Error('no svg');
    // граница по содержимому: у .chart бывает пустое поле снизу
    var bottom = 0;
    for (var k = 0; k < items.length; k++) bottom = Math.max(bottom, items[k].y + items[k].h);
    return { items: items, w: rect.width, h: bottom, faceNeed: faceNeed };
  }

  var NS = 'http://www.w3.org/2000/svg', MARGIN = 10;   // запас вокруг: у .chart svg стоит overflow:visible
  function serialize(item, css) {
    var outer = doc.createElementNS(NS, 'svg'), s = item.svg;
    var ow = item.w + MARGIN * 2, oh = item.h + MARGIN * 2;
    outer.setAttribute('xmlns', NS);
    outer.setAttribute('width', ow);
    outer.setAttribute('height', oh);
    outer.setAttribute('viewBox', '0 0 ' + ow + ' ' + oh);
    if (css) {
      var defs = doc.createElementNS(NS, 'defs'), st = doc.createElementNS(NS, 'style');
      st.appendChild(doc.createTextNode(css));
      defs.appendChild(st);
      outer.appendChild(defs);
    }
    s.setAttribute('x', MARGIN); s.setAttribute('y', MARGIN);
    s.setAttribute('width', item.w); s.setAttribute('height', item.h);
    s.setAttribute('style', 'overflow:visible;' + (s.getAttribute('style') || ''));
    outer.appendChild(s);
    var out = new XMLSerializer().serializeToString(outer);
    return out.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  }
  function utf8b64(str) {
    if (window.TextEncoder) return bytesToB64(new TextEncoder().encode(str).buffer);
    return btoa(unescape(encodeURIComponent(str)));
  }
  function loadSvg(str) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error('svg image')); };
      img.src = 'data:image/svg+xml;base64,' + utf8b64(str);
    });
  }
  /* вшитые шрифты в Safari и Chrome иногда догружаются уже после onload: рисуем впустую и ждём кадр,
     тогда на настоящий холст ложится картинка с применёнными шрифтами */
  function settle(img) {
    return new Promise(function (res) {
      try { var t = doc.createElement('canvas'); t.width = t.height = 2; t.getContext('2d').drawImage(img, 0, 0, 2, 2); } catch (e) {}
      setTimeout(res, 90);
    });
  }

  /* ================= холст: общие куски ================= */
  var fontsWait = null;
  function canvasFonts() {
    if (!doc.fonts || !doc.fonts.load) return Promise.resolve();
    var list = ['700 46px "PT Serif"', 'italic 400 52px "PT Serif"', '400 46px "PT Serif"', '500 24px "IBM Plex Mono"', '600 40px "IBM Plex Mono"', '400 22px "IBM Plex Mono"'];
    var all = Promise.all(list.map(function (f) { return doc.fonts.load(f, 'Абвгд Abcde 0123').then(null, function () {}); }));
    var timeout = new Promise(function (res) { setTimeout(res, 1500); });
    return Promise.race([all, timeout]).then(function () {});
  }
  function wrapText(ctx, text, font, width, maxLines) {
    ctx.font = font;
    var ws = clean(text).split(' '), lines = [], cur = '', i;
    for (i = 0; i < ws.length; i++) {
      var t = cur ? cur + ' ' + ws[i] : ws[i];
      if (cur && ctx.measureText(t).width > width) { lines.push(cur); cur = ws[i]; } else cur = t;
    }
    if (cur) lines.push(cur);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines[maxLines - 1];
      while (last.length && ctx.measureText(last + '…').width > width) last = last.slice(0, -1).replace(/\s+$/, '');
      lines[maxLines - 1] = last + '…';
    }
    return lines;
  }
  function fitLine(ctx, text, font, width) {
    ctx.font = font;
    var t = text;
    if (ctx.measureText(t).width <= width) return t;
    while (t.length > 1 && ctx.measureText(t + '…').width > width) t = t.slice(0, -1);
    return t + '…';
  }

  /* подпись под карточкой: «на_просвет» и ссылка на раздел; y — линия над подписью; возвращает нижнюю границу */
  function footer(ctx, draw, y, link) {
    if (draw) {
      ctx.fillStyle = C.ring;
      ctx.fillRect(PAD, y, CW, 2);
      ctx.textAlign = 'left';
      ctx.font = '600 40px ' + MONO;
      var wA = ctx.measureText('на').width, wB = ctx.measureText('_').width;
      ctx.fillStyle = C.ink; ctx.fillText('на', PAD, y + 70);
      ctx.fillStyle = C.accent; ctx.fillText('_', PAD + wA, y + 70);
      ctx.fillStyle = C.ink; ctx.fillText('просвет', PAD + wA + wB, y + 70);
      ctx.fillStyle = C.muted;
      ctx.font = '400 22px ' + MONO;
      ctx.fillText(fitLine(ctx, link, '400 22px ' + MONO, CW), PAD, y + 116);
    }
    return y + 116 + 72;
  }

  function newCanvas(h) {
    var cv = doc.createElement('canvas');
    cv.width = W; cv.height = h;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, h);
    ctx.fillStyle = C.accent;
    ctx.fillRect(0, 0, W, 16);
    ctx.textBaseline = 'alphabetic';
    return { cv: cv, ctx: ctx };
  }
  function scratch() {
    var cv = doc.createElement('canvas');
    cv.width = 8; cv.height = 8;
    return cv.getContext('2d');
  }
  function toBlob(cv) {
    return new Promise(function (res, rej) {
      if (cv.toBlob) { cv.toBlob(function (b) { if (b) res(b); else rej(new Error('blob')); }, 'image/png'); return; }
      try {
        var d = cv.toDataURL('image/png'), bin = atob(d.split(',')[1]), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        res(new Blob([arr], { type: 'image/png' }));
      } catch (e) { rej(e); }
    });
  }

  /* ================= что за артефакт: автор, раздел, заголовки ================= */
  function sectionOf(el) {
    var sec = el.closest ? el.closest('section[id]') : null, author = root.getAttribute('data-author') || '';
    var kb = sec && sec.querySelector('.kick b'), h2 = sec && sec.querySelector('h2');
    if (h2) { h2 = h2.cloneNode(true); var tg = h2.querySelectorAll('.tag'); for (var i = 0; i < tg.length; i++) tg[i].parentNode.removeChild(tg[i]); }   // плашка «интерактив» не часть названия
    return {
      author: author,
      id: sec ? sec.id : '',
      num: kb ? clean(kb.textContent) : '',
      title: h2 ? clean(h2.textContent) : '',
      sec: sec
    };
  }
  function kicker(si) {
    var tail = clean((si.num ? si.num + ' ' : '') + si.title);
    return (NAMES[si.author] || '') + ' НА ПРОСВЕТ' + (tail ? ' · ' + tail : '');
  }
  function linkOf(si) {
    return SITE.replace(/^https?:\/\//, '') + si.author + '/' + (si.id ? '#' + si.id : '');
  }
  /* порядковый номер артефакта в разделе — для имени файла */
  function ordinal(el, si, sel) {
    if (!si.sec) return 1;
    var list = si.sec.querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) if (list[i] === el) return i + 1;
    return 1;
  }
  function fileName(si, tag) {
    return 'na-prosvet-' + (si.author || 'x') + '-' + (si.id || 'page').replace(/[^a-z0-9]+/gi, '-') + '-' + tag + '.png';
  }

  /* ================= карточка графика ================= */
  function readLegend(panel, th) {
    var lg = panel.querySelector('.legend');
    if (!lg) return null;
    var items = [], kids = lg.children, i;
    for (i = 0; i < kids.length; i++) {
      var t = clean(kids[i].textContent);
      if (!t) continue;
      var sw = kids[i].querySelector('i, .sw, .dot') || (kids[i].tagName === 'I' ? kids[i] : null), col = null;
      if (sw) {
        var cs = getComputedStyle(sw), bg = cs.backgroundColor;
        if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') bg = cs.borderTopColor && cs.borderTopWidth !== '0px' ? cs.borderTopColor : '';
        col = bg ? lighten(th, norm(bg)) : null;
      }
      items.push({ t: t, c: col });
    }
    if (!items.length) { var all = clean(lg.textContent); if (all) items.push({ t: all, c: null }); }
    return items;
  }

  function composeChart(ctx, draw, d) {
    var y = 90, i, lines;
    ctx.textAlign = 'left';
    lines = wrapText(ctx, d.kicker, '500 24px ' + MONO, CW, 2);
    if (draw) { ctx.fillStyle = C.muted; ctx.font = '500 24px ' + MONO; for (i = 0; i < lines.length; i++) ctx.fillText(lines[i], PAD, y + i * 34); }
    y += (lines.length - 1) * 34 + 30;
    if (draw) { ctx.fillStyle = C.accent; ctx.fillRect(PAD, y, 96, 4); }
    y += 28;
    lines = wrapText(ctx, d.title, '700 46px ' + SERIF, CW, 4);
    if (draw) { ctx.fillStyle = C.ink; ctx.font = '700 46px ' + SERIF; }
    y += 46;
    for (i = 0; i < lines.length; i++) { if (draw) ctx.fillText(lines[i], PAD, y); y += 58; }
    y -= 58 - 12;
    if (d.sub) {
      lines = wrapText(ctx, d.sub, '400 24px ' + MONO, CW, 3);
      y += 22;
      if (draw) { ctx.fillStyle = C.muted; ctx.font = '400 24px ' + MONO; }
      for (i = 0; i < lines.length; i++) { y += 34; if (draw) ctx.fillText(lines[i], PAD, y); }
      y += 6;
    }
    y += 30;

    /* график: по ширине карточки, но не выше MAXH */
    var fixedBelow = 116 + 72 + 34 + 14 + (d.legend && d.legend.length ? 130 : 0);
    var S = CW / d.snap.w, maxChartH = MAXH - y - fixedBelow;
    if (d.snap.h * S > maxChartH) S = maxChartH / d.snap.h;
    var offX = PAD + (CW - d.snap.w * S) / 2;
    if (draw) {
      for (i = 0; i < d.imgs.length; i++) {
        var im = d.snap.items[i];
        ctx.drawImage(d.imgs[i], offX + (im.x - MARGIN) * S, y + (im.y - MARGIN) * S, (im.w + MARGIN * 2) * S, (im.h + MARGIN * 2) * S);
      }
    }
    y += d.snap.h * S + 34;
    /* легенда: текстом строкой под графиком, цветные квадратики берём у её значков */
    if (d.legend && d.legend.length) {
      var x = PAD, ly = y + 6, rowH = 38, any = false;
      ctx.font = '400 22px ' + MONO;
      for (i = 0; i < d.legend.length; i++) {
        var it = d.legend[i], sw = it.c ? 22 : 0, txt = fitLine(ctx, it.t, '400 22px ' + MONO, CW - sw - 12);
        var iw = (sw ? 30 : 0) + ctx.measureText(txt).width;
        if (x > PAD && x + iw > PAD + CW) { x = PAD; ly += rowH; }
        if (draw) {
          if (sw) { ctx.fillStyle = it.c; ctx.fillRect(x, ly - 18, 18, 18); }
          ctx.fillStyle = C.ink2; ctx.font = '400 22px ' + MONO;
          ctx.fillText(txt, x + (sw ? 30 : 0), ly);
        }
        x += iw + 34; any = true;
      }
      if (any) y = ly + 26;
    }

    y += 14;
    return footer(ctx, draw, y, d.link);
  }

  function renderPanel(panel) {
    var si = sectionOf(panel), th = theme();
    var charts = panel.querySelectorAll('.chart'), chart = charts[0];
    if (!chart || !panel.querySelector('.chart svg')) return Promise.reject(new Error('no chart'));
    for (var ci = 1; ci < charts.length; ci++) {          // два графика рядом (сравнение периодов): берём общий контейнер
      while (chart !== panel && !chart.contains(charts[ci])) chart = chart.parentNode;
    }
    var tEl = panel.querySelector('.cap .t'), uEl = panel.querySelector('.cap .u');
    var title = tEl ? clean(tEl.textContent) : '', sub = uEl ? clean(uEl.textContent) : '';
    if (!title) {                                           // панель без подписи (словоискатель): заголовок — найденное слово
      var big = panel.querySelector('.big'), eb = panel.querySelector('.eyebrow');
      if (big && clean(big.textContent)) { title = clean(big.textContent); sub = eb ? clean(eb.textContent) : ''; }
    }
    if (!title) title = si.title || '';
    var d = {
      kicker: kicker(si), title: title, sub: sub, legend: readLegend(panel, th), link: linkOf(si)
    };
    d.snap = snapChart(chart, th);                       // синхронно: пока страница не перерисовалась
    var name = fileName(si, ordinal(panel, si, '.panel'));
    return Promise.all([fontCss(d.snap.faceNeed), canvasFonts()]).then(function (r) {
      var css = r[0], strs = [], i;
      for (i = 0; i < d.snap.items.length; i++) strs.push(serialize(d.snap.items[i], css));
      return Promise.all(strs.map(loadSvg));
    }).then(function (imgs) {
      d.imgs = imgs;
      return Promise.all(imgs.map(settle)).then(function () {
        var sc = scratch(), H = Math.ceil(composeChart(sc, false, d));
        var c = newCanvas(H);
        composeChart(c.ctx, true, d);
        return c.cv;
      });
    }).then(function (cv) {
      return toBlob(cv).then(function (blob) { return { blob: blob, canvas: cv, name: name, w: cv.width, h: cv.height }; });
    });
  }

  /* ================= карточка вывода 1080×1350 ================= */
  var FH = 1350, FOOT_Y = 1190;
  function composeFinding(ctx, draw, d) {
    var y = 96, i, lines;
    ctx.textAlign = 'left';
    lines = wrapText(ctx, d.kicker, '500 26px ' + MONO, CW, 2);
    if (draw) { ctx.fillStyle = C.muted; ctx.font = '500 26px ' + MONO; for (i = 0; i < lines.length; i++) ctx.fillText(lines[i], PAD, y + i * 36); }
    y += (lines.length - 1) * 36 + 30;
    if (draw) { ctx.fillStyle = C.ring; ctx.fillRect(PAD, y, 120, 3); }
    var top = y + 40, room = FOOT_Y - 56 - top;

    /* 1) мерим блок: метка, крупное значение, текст (курсивный serif, кегль ужимаем, пока не влезет) */
    var labelH = d.label ? 64 : 0, bs = 0, bf = '', bl = [], bigH = 0;
    if (d.big) {
      bs = 108;
      for (;;) { bf = '500 ' + bs + 'px ' + MONO; ctx.font = bf; if (ctx.measureText(d.big).width <= CW || bs <= 40) break; bs -= 4; }
      bl = wrapText(ctx, d.big, bf, CW, 2);
      bigH = bl.length * Math.round(bs * 1.08) + 34;
    }
    var maxH = room - labelH - bigH, size = d.big ? 50 : 64, tl, lead;
    for (;;) {
      lead = Math.round(size * 1.38);
      tl = wrapText(ctx, d.text, 'italic 400 ' + size + 'px ' + SERIF, CW, 0);
      if (tl.length * lead <= maxH || size <= 26) break;
      size -= 2;
    }
    var maxLines = Math.max(1, Math.floor(maxH / lead));
    if (tl.length > maxLines) tl = wrapText(ctx, d.text, 'italic 400 ' + size + 'px ' + SERIF, CW, maxLines);
    var block = labelH + bigH + tl.length * lead;

    /* 2) рисуем: блок чуть выше середины свободного места */
    y = top + Math.max(0, Math.round((room - block) * 0.38));
    if (d.label) {
      y += 24;
      if (draw) { ctx.fillStyle = C.accent; ctx.font = '500 24px ' + MONO; ctx.fillText(d.label, PAD, y); }
      y += 40;
    }
    if (d.big) {
      y += bs * 0.82;
      for (i = 0; i < bl.length; i++) { if (draw) { ctx.fillStyle = C.accent; ctx.font = bf; ctx.fillText(bl[i], PAD, y); } y += Math.round(bs * 1.08); }
      y += 34 - bs * 0.82;
    }
    y += size * 0.82;
    for (i = 0; i < tl.length; i++) {
      if (draw) { ctx.fillStyle = C.ink; ctx.font = 'italic 400 ' + size + 'px ' + SERIF; ctx.fillText(tl[i], PAD, y); }
      y += lead;
    }
    return footer(ctx, draw, FOOT_Y, d.link);
  }
  function renderFinding(el) {
    var si = sectionOf(el), d = { kicker: kicker(si), link: linkOf(si), label: '', big: '', text: '' }, tag;
    if (el.classList && el.classList.contains('finding')) {
      d.label = 'ГЛАВНОЕ';
      d.text = clean(el.textContent);
      tag = 'f' + ordinal(el, si, 'p.finding');
    } else {
      var b = el.querySelector('b'), sp = el.querySelector('span');
      d.big = b ? clean(b.textContent) : '';
      d.text = sp ? clean(sp.textContent) : clean(el.textContent);
      var cards = el.parentNode ? el.parentNode.children : [], n = 1;
      for (var i = 0; i < cards.length; i++) if (cards[i] === el) n = i + 1;
      tag = 'v' + n;
    }
    if (!d.text && !d.big) return Promise.reject(new Error('empty'));
    var name = fileName(si, tag);
    return canvasFonts().then(function () {
      var sc = scratch();
      composeFinding(sc, false, d);
      var c = newCanvas(FH);
      composeFinding(c.ctx, true, d);
      return toBlob(c.cv).then(function (blob) { return { blob: blob, canvas: c.cv, name: name, w: c.cv.width, h: c.cv.height }; });
    });
  }

  function render(el) {
    try {
      if (el.classList && el.classList.contains('panel')) return renderPanel(el);
      return renderFinding(el);
    } catch (e) { return Promise.reject(e); }
  }

  /* ================= отправка ================= */
  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = doc.createElement('a');
    a.href = url; a.download = name;
    a.style.display = 'none';
    doc.body.appendChild(a);
    a.click();
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  }
  function share(el) {
    return render(el).then(function (r) {
      goal('share_research');
      var file = null, can = false;
      try { file = new File([r.blob], r.name, { type: 'image/png' }); } catch (e) { file = null; }
      try { can = !!(file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) { can = false; }
      if (!can) { download(r.blob, r.name); r.via = 'download'; return r; }
      return navigator.share({ files: [file] }).then(function () { r.via = 'share'; return r; }, function (e) {
        if (e && e.name === 'AbortError') { r.via = 'cancel'; return r; }     // закрыл окно отправки
        download(r.blob, r.name);                                              // NotAllowedError (жест истёк) и прочее: хотя бы скачать
        r.via = 'download';
        return r;
      });
    });
  }

  window.NaprosvetRShare = { render: render, share: share };
})();
