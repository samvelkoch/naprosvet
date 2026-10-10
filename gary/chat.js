/* «Поговорить с Роменом Гари»: кнопка в углу и окно разговора.
   Отвечает Claude в образе Гари через Worker (worker/gary-chat). Пока ENDPOINT пуст, на странице ничего не появляется.
   Подключается в <head> страницы gary/index.html: обёртка до «</head><body>» переживает пересборку из samvelkoch/gary. */
(function () {
  var ENDPOINT = ''; // https://gary-chat.<ваш-поддомен>.workers.dev
  var MAX_Q = 5, MAX_CHARS = 600, KEY = 'naprosvet-gary-chat';
  if (!ENDPOINT || !window.fetch || !window.ReadableStream) return;

  var css =
    '.gc-open{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:55;cursor:pointer;display:inline-flex;align-items:center;gap:10px;' +
    'font:500 13px/1 "IBM Plex Mono",ui-monospace,Menlo,monospace;height:44px;padding:0 16px;color:#f7f0e2;background:#221a14;border:1px solid rgba(247,240,226,.45);border-radius:2px;box-shadow:0 12px 30px -10px rgba(0,0,0,.5)}' +
    '.gc-open .ic{font:italic 600 19px/1 "PT Serif",Georgia,serif;color:#f0765a}' +
    '.gc-open:hover{background:#f0765a;border-color:#f0765a;color:#1b1010}.gc-open:hover .ic{color:#1b1010}' +
    '.gc-open:focus-visible,.gc button:focus-visible,.gc textarea:focus-visible{outline:2px solid #f0765a;outline-offset:2px}' +
    '.gc{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:56;width:min(440px,calc(100vw - 32px));height:min(640px,calc(100dvh - 32px));' +
    'display:flex;flex-direction:column;background:#221a14;color:#f7f0e2;border:1px solid rgba(247,240,226,.3);border-radius:3px;box-shadow:0 24px 60px -16px rgba(0,0,0,.6)}' +
    '.gc[hidden]{display:none!important}' +
    '.gc-h{display:flex;align-items:flex-start;gap:12px;padding:14px 16px 12px;border-bottom:1px solid rgba(247,240,226,.15)}' +
    '.gc-h b{display:block;font:600 17px/1.2 "PT Serif",Georgia,serif}' +
    '.gc-h span{display:block;margin-top:4px;font:11.5px/1.4 "IBM Plex Mono",ui-monospace,Menlo,monospace;color:#b9ab96}' +
    '.gc-x{margin-left:auto;flex:none;cursor:pointer;width:32px;height:32px;font-size:16px;color:#f7f0e2;background:none;border:1px solid rgba(247,240,226,.3);border-radius:2px}' +
    '.gc-x:hover{background:#f0765a;color:#1b1010;border-color:#f0765a}' +
    '.gc-log{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px;overscroll-behavior:contain}' +
    '.gc-m{max-width:92%;white-space:pre-wrap;word-wrap:break-word}' +
    '.gc-u{align-self:flex-end;font:13px/1.45 "IBM Plex Mono",ui-monospace,Menlo,monospace;background:rgba(247,240,226,.08);padding:8px 10px;border-radius:2px}' +
    '.gc-a{align-self:flex-start;font:16px/1.55 "PT Serif",Georgia,serif;color:#f3ebd9}' +
    '.gc-a.wait::after{content:"…";color:#f0765a;animation:gcb 1s steps(2) infinite}@keyframes gcb{50%{opacity:0}}' +
    '.gc-sys{align-self:center;font:12px/1.4 "IBM Plex Mono",ui-monospace,Menlo,monospace;color:#b9ab96;text-align:center}' +
    '.gc-f{display:flex;gap:8px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid rgba(247,240,226,.15)}' +
    '.gc-f textarea{flex:1;resize:none;height:44px;max-height:120px;padding:10px;font:16px/1.4 "PT Serif",Georgia,serif;color:#f7f0e2;background:rgba(247,240,226,.06);border:1px solid rgba(247,240,226,.3);border-radius:2px}' +
    '.gc-f button{flex:none;cursor:pointer;padding:0 14px;font:500 13px/1 "IBM Plex Mono",ui-monospace,Menlo,monospace;color:#1b1010;background:#f0765a;border:0;border-radius:2px}' +
    '.gc-f button:disabled,.gc-f textarea:disabled{opacity:.45;cursor:default}' +
    '.gc-left{padding:0 16px 10px;font:11.5px/1 "IBM Plex Mono",ui-monospace,Menlo,monospace;color:#b9ab96}' +
    '@media print{.gc,.gc-open{display:none!important}}';

  var hist = load(), busy = false, panel, log, ta, send, left, opener;

  function load() {
    try { var h = JSON.parse(sessionStorage.getItem(KEY) || '[]'); return Array.isArray(h) ? h : []; } catch (e) { return []; }
  }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(hist)); } catch (e) {} }
  function asked() { return hist.filter(function (m) { return m.role === 'user'; }).length; }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function add(cls, text) { var n = el('div', 'gc-m ' + cls, text); log.appendChild(n); log.scrollTop = log.scrollHeight; return n; }

  function sync() {
    var rest = MAX_Q - asked();
    left.textContent = rest > 0 ? 'Осталось вопросов: ' + rest : 'Вопросы закончились. Ночь будет спокойной.';
    ta.disabled = busy || rest <= 0; send.disabled = ta.disabled;
  }

  function build() {
    var st = el('style'); st.textContent = css; document.head.appendChild(st);
    opener = el('button', 'gc-open'); opener.type = 'button';
    opener.append(el('span', 'ic', 'R'), el('span', null, 'Поговорить с Гари'));
    panel = el('div', 'gc'); panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Разговор с Роменом Гари');
    var h = el('div', 'gc-h'), t = el('div');
    t.append(el('b', null, 'Ромен Гари'), el('span', null, 'Отвечает ИИ (Claude) в образе писателя. Это реконструкция, а не его слова.'));
    var x = el('button', 'gc-x', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Закрыть');
    h.append(t, x);
    log = el('div', 'gc-log'); log.setAttribute('aria-live', 'polite');
    left = el('div', 'gc-left');
    var f = el('form', 'gc-f');
    ta = el('textarea'); ta.maxLength = MAX_CHARS; ta.placeholder = 'Ваш вопрос…'; ta.setAttribute('aria-label', 'Вопрос');
    send = el('button', null, 'Спросить'); send.type = 'submit';
    f.append(ta, send);
    panel.append(h, log, left, f);
    document.body.append(opener, panel);

    if (!hist.length) add('gc-sys', 'Задайте до ' + MAX_Q + ' вопросов. О матери, о войне, об Ажаре — о чём угодно.');
    hist.forEach(function (m) { add(m.role === 'user' ? 'gc-u' : 'gc-a', m.content); });
    sync();

    opener.addEventListener('click', function () { panel.hidden = false; opener.hidden = true; ta.focus(); log.scrollTop = log.scrollHeight; });
    x.addEventListener('click', close);
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); f.requestSubmit(); } });
    f.addEventListener('submit', function (e) { e.preventDefault(); ask(); });
  }
  function close() { panel.hidden = true; opener.hidden = false; opener.focus(); }

  async function ask() {
    var q = ta.value.trim();
    if (!q || busy || asked() >= MAX_Q) return;
    busy = true; ta.value = ''; add('gc-u', q); sync();
    var a = add('gc-a wait', ''), text = '', end = null;
    var msgs = hist.concat([{ role: 'user', content: q }]);
    try {
      var r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: msgs }) });
      if (!r.ok) {
        var err = null; try { err = (await r.json()).error; } catch (e) {}
        end = r.status === 429 && err ? err : 'Гари сейчас не может ответить. Попробуйте позже.';
      } else {
        var rd = r.body.getReader(), dec = new TextDecoder(), buf = '';
        for (;;) {
          var c = await rd.read(); if (c.done) break;
          buf += dec.decode(c.value, { stream: true });
          var lines = buf.split('\n'); buf = lines.pop();
          lines.forEach(function (ln) {
            if (!ln) return;
            var ev; try { ev = JSON.parse(ln); } catch (e) { return; }
            if (ev.t === 'text') { text += ev.v; a.textContent = text; log.scrollTop = log.scrollHeight; }
            else if (ev.t === 'reset') { text = ''; a.textContent = ''; }
            else if (ev.t === 'refusal') end = 'На это Гари отвечать не станет. Спросите о другом.';
            else if (ev.t === 'error') end = ev.v;
          });
        }
      }
    } catch (e) {
      end = 'Связь прервалась. Попробуйте ещё раз.';
    }
    a.classList.remove('wait');
    if (text && !end) {
      hist = msgs.concat([{ role: 'assistant', content: text }]); save();
    } else {
      // Неудачный вопрос не засчитывается: убираем его из окна, текст возвращаем в поле ввода.
      a.remove(); log.lastChild && log.lastChild.remove();
      add('gc-sys', end || 'Гари промолчал. Попробуйте спросить иначе.');
      ta.value = q;
    }
    busy = false; sync(); ta.focus();
  }

  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
