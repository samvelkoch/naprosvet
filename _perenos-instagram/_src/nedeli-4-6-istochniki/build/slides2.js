'use strict';
/* ===== недели 2 и 3: общие помощники ===== */
const fmtN = v => String(v).replace('.', ',');                 // 27.6 -> «27,6», 17 -> «17» (как в источнике, без «.0»)
const segs = p => p.split(/(\*[^*]+\*)/).filter(Boolean).map(t => t[0] === '*' ? { rem: true, t: t.slice(1, -1) } : { rem: false, t });
function paraEl(p, cls) { const el = $('p', cls || 'part'); segs(p).forEach(s => el.appendChild(s.rem ? $('em', 'rem', s.t) : document.createTextNode(s.t))); return el; }
const paraText = p => segs(p).map(s => s.t).join('');
const fullParas = (qid, a) => D.voices[qid].a[a].split('\n\n');
const leadOf = p => segs(p).filter(s => !s.rem).map(s => s.t).join('').trim();
const isLead = p => { const w = leadOf(p); return w.length > 0 && w.length <= 20 && !/\s/.test(w); };
const sentencesOf = h => h.split(/(?<=[.!?])\s+(?=[А-ЯЁ«])/);
function richInto(parent, text) {   // «→» и «✓» — Plex; диапазоны лет не рвутся по строкам
  text.split(/([→✓]|\d{4}–\d{4})/).forEach(t => { if (!t) return; if (/^[→✓]$/.test(t)) parent.appendChild($('span', 'arrow', t)); else if (/^\d{4}–\d{4}$/.test(t)) parent.appendChild($('span', 'nw', t)); else parent.appendChild(document.createTextNode(t)); });
  return parent;
}
function mkPos(cls, style) { const e = $('div', cls); Object.assign(e.style, style || {}); return e; }
function npBase(cls, w, h) { const s = mkSlide('dark ' + cls, w, h); return s; }
function logoTop(s) { const t = logo('НА_ПРОСВЕТ'); t.classList.add('top'); s.appendChild(t); return t; }
function srcFoot(s, N, cls) { const f = $('div', 'src ' + (cls || '')); add(f, $('div', null, N.section), $('div', 'u', N.url)); s.appendChild(f); return f; }

/* ===== ответы ЦЕЛИКОМ (full: true) ===== */
function fullPortrait(key, a) {
  const F = D.fragments[key]; const P = D.personas[a]; const paras = fullParas(F.qid, a);
  const s = mkSlide('paper po po-p po-f', 1080, 1350);
  const h = a === 'chekhov' ? 560 : 700;
  portraitImg(s, a, 560, 40, 64 + h);
  const side = $('div', 'side'); side.style.top = '80px'; side.style.height = (h - 16) + 'px';
  add(side, $('div', 'rule'), $('div', 'nm', surname(P.name)), $('div', 'yr', P.years), $('div', 'tp', timepoint(a)));
  let rest = paras;
  if (isLead(paras[0])) {
    const lw = $('div', 'leadwrap'); const sg = segs(paras[0]);
    sg.filter(x => x.rem).forEach(x => lw.appendChild($('div', 'lrem', x.t)));
    lw.appendChild($('div', 'lead', leadOf(paras[0]))); side.appendChild(lw); rest = paras.slice(1);
  }
  s.appendChild(side);
  const lo = $('div', 'lower'); lo.style.top = (64 + h + 34) + 'px'; lo.style.height = (1190 - (64 + h + 34)) + 'px';
  rest.forEach(p => lo.appendChild(paraEl(p, 'part')));
  s.appendChild(lo); voicesFoot(s);
  const fs = fit(lo, 44, 34, 'портрет+ответ целиком ' + key + ' ' + a);
  return { kind: 'full_page', key, qid: F.qid, author: a, idx: 0, n: 1, mode: 'portrait', fs, paras: paras.map(paraText) };
}
function buildText(a, idx, n, parasToShow, fs, cont) {
  const P = D.personas[a]; const s = mkSlide('paper po po-t', 1080, 1350);
  const hd = $('div', 'hd');
  const nm = $('div', 'nm'); nm.appendChild(document.createTextNode(surname(P.name)));
  if (idx > 0) nm.appendChild($('span', 'cont', '(продолжение)'));
  add(hd, $('div', 'rule'), nm, $('div', 'ytp', P.years + ' · ' + timepoint(a)));
  s.appendChild(hd);
  const body = $('div', 'tbody serif'); body.style.fontSize = fs + 'px'; s.appendChild(body);
  parasToShow.forEach(p => body.appendChild(paraEl(p, 'part')));
  if (idx < n - 1) { const ar = $('div', 'more'); withArrows('→', ar); s.appendChild(ar); }
  voicesFoot(s);
  return { s, body };
}
function paginate(a, paras, fs) {
  const pages = []; let cur = [];
  const { body } = buildText(a, 0, 2, [], fs);
  paras.forEach(p => {
    const el = paraEl(p, 'part'); body.appendChild(el);
    if (body.scrollHeight > body.clientHeight + 1) {
      if (!cur.length) throw new Error('абзац длиннее страницы: ' + p.slice(0, 40));
      pages.push(cur); cur = [p]; body.innerHTML = ''; body.appendChild(paraEl(p, 'part'));
      if (body.scrollHeight > body.clientHeight + 1) throw new Error('абзац длиннее страницы: ' + p.slice(0, 40));
    } else cur.push(p);
  });
  if (cur.length) pages.push(cur);
  return pages;
}
function planAuthor(key, a) {
  const F = D.fragments[key]; const paras = fullParas(F.qid, a);
  try { const r = fullPortrait(key, a); return { author: a, mode: 'portrait', n: 1, fs: r.fs }; } catch (e) { /* не влезает с крупным портретом — текстовые слайды */ }
  const minPages = paginate(a, paras, 32).length;
  for (let fs = 40; fs >= 32; fs--) { const pg = paginate(a, paras, fs); if (pg.length === minPages) return { author: a, mode: 'text', n: pg.length, fs }; }
  throw new Error('нет раскладки ' + a);
}
function planFull(key) { return D.fragments[key].order.map(a => planAuthor(key, a)); }
function fullPage(key, a, idx) {
  const F = D.fragments[key]; const pl = planAuthor(key, a);
  if (pl.mode === 'portrait') return fullPortrait(key, a);
  const paras = fullParas(F.qid, a); const pages = paginate(a, paras, pl.fs);
  const { s, body } = buildText(a, idx, pages.length, pages[idx], pl.fs);
  if (body.scrollHeight > body.clientHeight + 1) throw new Error('страница не влезает');
  return { kind: 'full_page', key, qid: F.qid, author: a, idx, n: pages.length, mode: 'text', fs: pl.fs, paras: pages[idx].map(paraText) };
}

/* ===== ГОЛОСА_ посты: обложка вопроса, слова, финал ===== */
function fCover(key, title) {
  const F = D.fragments[key]; const s = mkSlide('paper po po-c po-fc' + (F.cover_quote ? ' wq' : ''), 1080, 1350);
  s.appendChild($('div', 'ttl label', title));
  const ask = $('div', 'askrow');
  add(ask, $('div', 'rule'), $('div', 'asker', 'Спрашивает ' + surname(D.personas[F.asker].name)), $('div', 'tp', timepoint(F.asker)));
  s.appendChild(ask);
  const q = $('div', 'qbox serif', D.voices[F.qid].q); s.appendChild(q);
  if (F.cover_quote) {
    const cq = $('div', 'cq'); const au = F.cover_quote.author;
    add(cq, $('div', 'cqn', surname(D.personas[au].name) + ' · ' + timepoint(au)), $('div', 'cqt serif', F.cover_quote.text));
    s.appendChild(cq);
  }
  voicesFoot(s);
  fit(q, F.cover_quote ? 76 : 150, F.cover_quote ? 52 : 100, 'вопрос обложки');
  return { kind: 'f_cover', qid: F.qid, question: q.textContent, quote: F.cover_quote ? F.cover_quote.text : null };
}
function fWords(key) {
  const F = D.fragments[key]; const s = mkSlide('paper po po-w', 1080, 1350);
  const lab = $('div', 'label lab', 'Одно слово'); s.appendChild(lab);
  const rows = $('div', 'rows');
  const words = [];
  F.order.forEach(a => {
    const p0 = fullParas(F.qid, a)[0]; const w = leadOf(p0); words.push(w);
    const r = $('div', 'row'); add(r, $('div', 'rule'), $('div', 'who', surname(D.personas[a].name) + ' · ' + timepoint(a)), $('div', 'word', w)); rows.appendChild(r);
  });
  s.appendChild(rows);
  s.appendChild($('div', 'allv serif', 'Все 900 ответов — в разделе «Голоса_», ссылка в профиле'));
  voicesFoot(s);
  return { kind: 'f_words', words };
}
function fFinal() {
  const s = mkSlide('paper po po-d', 1080, 1350); const m = $('div', 'main');
  m.appendChild($('div', 'label lab', 'Что это такое'));
  m.appendChild($('div', 'disc serif', D.personas._disclaimer_site));
  m.appendChild($('div', 'all', 'Все 900 ответов — в разделе «Голоса_», ссылка в профиле'));
  m.appendChild($('div', 'addr', BASE + '/voices/'));
  s.appendChild(m); voicesFoot(s); return { kind: 'f_final' };
}

/* ===== неделя 2 · Чехов, знаки ===== */
function zCover() {
  const N = D.numbers.chekhov_znaki; const ex = N.signs[0]; const s = npBase('np np-1 np-z1', 1080, 1350); npTop(s);
  const b = $('div', 'body'); b.appendChild($('div', 'label lab', 'Было / стало · Чехов'));
  const row = $('div', 'zrow');
  const nums = $('div', 'znum'); add(nums, document.createTextNode(fmtN(ex.early) + ' '), $('span', 'arrow', '→'), document.createTextNode(' ' + fmtN(ex.late)));
  add(row, $('div', 'zbig', ex.sign), nums); b.appendChild(row);
  b.appendChild($('div', 'zcap serif', ex.name.replace(/ый$/, 'ых') + ' знаков на 1000 слов'));
  const per = $('div', 'zper'); add(per, document.createTextNode(N.early + ' '), $('span', 'arrow', '→'), document.createTextNode(' ' + N.late)); b.appendChild(per);
  s.appendChild(b); npFoot(s, N); return { kind: 'z_cover' };
}
function zTable() {
  const N = D.numbers.chekhov_znaki; const s = npBase('np np-z2', 1080, 1350); npTop(s);
  const b = $('div', 'body'); b.appendChild($('div', 'label lab', 'Знаки на 1000 слов'));
  const g = $('div', 'zgrid');
  add(g, $('div'), $('div', 'zh early', N.early), $('div', 'zh late', N.late));
  N.signs.forEach(sg => {
    const c = $('div', 'zs'); add(c, $('div', 'zsg', sg.sign), $('div', 'zsn serif', sg.name));
    add(g, c, $('div', 'zv early', fmtN(sg.early)), $('div', 'zv late', fmtN(sg.late)));
  });
  b.appendChild(g); s.appendChild(b); npFoot(s, N); return { kind: 'z_table' };
}
function zExtreme() {
  const N = D.numbers.chekhov_znaki; const e = N.extreme; const s = npBase('np np-z3', 1080, 1350); npTop(s);
  const b = $('div', 'body'); b.appendChild($('div', 'label lab', 'Пример ранней манеры'));
  b.appendChild($('div', 'etitle serif', '«' + e.title + '»'));
  b.appendChild($('div', 'eyear', String(e.year)));
  const r = $('div', 'erow'); add(r, $('div', 'ebig', String(e.value)), $('div', 'esign', e.sign)); b.appendChild(r);
  b.appendChild($('div', 'eunit serif', e.unit));
  s.appendChild(b); npFoot(s, N); return { kind: 'z_extreme' };
}
function npTextPost(N, label, headline, note, noteCls) {
  const s = npBase('np np-5', 1080, 1350); npTop(s);
  const b = $('div', 'body'); const ev = $('div', 'ev serif pretty'); headline.split(/([→✓]|\d{4}–\d{4})/).forEach(t => { if (!t) return; if (/^[→✓]$/.test(t)) ev.appendChild($('span', 'arrow', t)); else if (/^\d{4}–\d{4}$/.test(t)) ev.appendChild($('span', 'nw', t)); else ev.appendChild(document.createTextNode(t)); });
  add(b, $('div', 'label lab', label), ev);
  if (note) b.appendChild($('div', 'cav serif', note));
  const w = $('div', 'where'); add(w, $('div', 'sect', 'Раздел ' + N.section), $('div', 'addr', N.url), $('div', 'prof serif', 'Ссылка в профиле'));
  b.appendChild(w); s.appendChild(b); return { kind: 'np_text' };
}
const zEvidence = () => { const N = D.numbers.chekhov_znaki; return npTextPost(N, 'Как считали', N.headline, N.method); };

/* ===== неделя 2 · Гари, диалог (сторис) ===== */
function garyDialog() {
  const N = D.numbers.gary_dialog; const s = npBase('ns ns-g', 1080, 1920); logoTop(s);
  const b = $('div', 'body'); b.appendChild($('div', 'label lab', 'Цифра дня · Гари'));
  b.appendChild($('div', 'head serif', 'Самая разговорная книга Гари — «' + N.top[0][0] + '»'));
  s.appendChild(b);
  const K = 17; const ch = $('div', 'gchart');
  const mlab = $('div', 'gmlab'); mlab.style.left = (N.median * K) + 'px'; mlab.textContent = 'медиана по книгам · ' + fmtN(N.median) + '%'; ch.appendChild(mlab);
  const row = (name, year, v, dim) => {
    const r = $('div', 'grow'); const nm = $('div', 'gnm'); add(nm, $('span', 'serif', name), $('span', 'gy', ' · ' + year));
    const bw = $('div', 'gbw'); const bar = $('div', 'gbar' + (dim ? ' dim' : '')); bar.style.width = (v * K) + 'px';
    add(bw, bar, $('div', 'gv', fmtN(v) + '%')); add(r, nm, bw); return r;
  };
  N.top.forEach(t => ch.appendChild(row(t[0], t[1], t[2], false)));
  const br = $('div', 'gbreak'); add(br, $('span', null, '…')); ch.appendChild(br);
  N.bottom.forEach(t => ch.appendChild(row(t[0], t[1], t[2], true)));
  const ml = $('div', 'gmed'); ml.style.left = (N.median * K) + 'px'; ch.appendChild(ml);
  s.appendChild(ch);
  const f = $('div', 'gfoot'); add(f, $('div', 'gm', N.method), $('div', 'gs', N.section), $('div', 'gs', N.url)); s.appendChild(f);
  return { kind: 'ns_g' };
}

/* ===== рекорды (сторис) ===== */
function recordsStory(top, N, cards, caption) {
  const s = npBase('ns ns-r', 1080, 1920); logoTop(s);
  const b = $('div', 'body'); b.appendChild($('div', 'label lab', top));
  cards.forEach(c => { const cd = $('div', 'rcard'); add(cd, $('div', 'label rlab', c.label), $('div', 'rt serif', c.main), $('div', 'rs', c.sub)); b.appendChild(cd); });
  if (caption) b.appendChild($('div', 'rcap serif', caption));
  s.appendChild(b); srcFoot(s, N, 'rsrc'); return { kind: 'ns_r' };
}
function chekhovRecords() {
  const N = D.numbers.chekhov_rekordy; const c = [N.shortest, N.longest];
  const cards = c.map(r => ({ label: r.label, main: '«' + r.title + '»', sub: fmtInt(r.words) + ' слов, ' + r.year }));
  return recordsStory('Рекорд · Чехов', N, cards, c[0].year === c[1].year ? 'Оба — ' + c[0].year + ' год.' : null);
}
function brodskyRecords() {
  const N = D.numbers.brodsky_rekordy;
  return recordsStory('Рекорды · Бродский', N, [N.rhyme, N.epithet].map(r => ({ label: r.label, main: r.value, sub: r.count })), null);
}

/* ===== рилс ГОЛОСА_ (бумага) ===== */
function rgFoot(s) { const f = $('div', 'foot'); add(f, logo('ГОЛОСА_'), $('span', 'plaque', PLAQUE)); s.appendChild(f); }
function rgQuestion(key) {
  const F = D.fragments[key]; const s = mkSlide('paper rg rg-q', 1080, 1920);
  const m = $('div', 'main'); m.appendChild($('div', 'label lab', 'Трое за столом'));
  const ar = $('div', 'askrow'); add(ar, $('div', 'asker', 'Спрашивает ' + surname(D.personas[F.asker].name)), $('div', 'tp', timepoint(F.asker)), $('div', 'rule')); m.appendChild(ar);
  const qb = $('div', 'qbox serif', D.voices[F.qid].q); m.appendChild(qb);
  const hint = $('div', 'hint'); withArrows('Отвечают все трое →', hint); m.appendChild(hint);
  s.appendChild(m); rgFoot(s); fit(qb, 100, 64, 'вопрос рилса');
  return { kind: 'rg_q', qid: F.qid, question: qb.textContent };
}
function rgAuthor(key, idx) {
  const F = D.fragments[key]; const a = F.order[idx]; const P = D.personas[a]; const s = mkSlide('paper rg rg-a', 1080, 1920);
  const h = a === 'chekhov' ? 640 : 800; portraitImg(s, a, 640, 40, 40 + h + (a === 'chekhov' ? 160 : 0));
  const nb = $('div', 'nb'); add(nb, $('div', 'rule'), $('div', 'nm', surname(P.name)), $('div', 'yr', P.years + ' · ' + timepoint(a))); s.appendChild(nb);
  const ans = $('div', 'answer serif'); fragParts(ans, F.answers[a]); s.appendChild(ans);
  rgFoot(s); const fs = fit(ans, 58, 44, key + ' ' + a);
  return { kind: 'rg_a', qid: F.qid, author: a, parts: [...ans.querySelectorAll('.part')].map(e => e.textContent), fs };
}
function rgFinal() {
  const s = mkSlide('paper rg rg-f', 1080, 1920); const m = $('div', 'main');
  add(m, logo('ГОЛОСА_', 'big'), $('div', 'rule'), $('div', 'l1 serif', 'все 900 ответов'), $('div', 'l2', 'ссылка в профиле'));
  s.appendChild(m); rgFoot(s); return { kind: 'rg_f' };
}
function rgCover() {
  const s = mkSlide('paper rg rg-c', 1080, 1920); const m = $('div', 'main');
  add(m, logo('ГОЛОСА_', 'big'), $('div', 'rule'), $('div', 't serif', 'Трое за столом'),
      $('div', 'names', ['brodsky', 'chekhov', 'gary'].map(a => surname(D.personas[a].name)).join(' · ')));
  s.appendChild(m); rgFoot(s); return { kind: 'rg_cover' };
}

/* ===== неделя 3 · Гари, звери ===== */
function zvCover() {
  const N = D.numbers.gary_zveri; const s = npBase('np np-1 np-v1', 1080, 1350); npTop(s);
  const b = $('div', 'body'); b.appendChild($('div', 'label lab', 'Мир автора · Гари'));
  b.appendChild($('div', 'vtitle serif', N.headline.split(':')[0]));
  b.appendChild($('div', 'vbig', String(N.counts[0][1])));
  b.appendChild($('div', 'vcap serif', 'упоминания, из них ' + N.elephant_by_book[0][2] + ' — в одной книге'));
  s.appendChild(b); npFoot(s, N); return { kind: 'zv_cover' };
}
function zvCounts() {
  const N = D.numbers.gary_zveri; const s = npBase('np np-v2', 1080, 1350); npTop(s);
  const b = $('div', 'body'); b.appendChild($('div', 'label lab', 'Звери Гари · упоминаний'));
  const ch = $('div', 'vchart'); const max = N.counts[0][1]; const BW = 520;
  N.counts.forEach(([name, n, books], i) => {
    const r = $('div', 'vrow' + (i === 0 ? ' hot' : '')); const bar = $('div', 'vbar'); bar.style.width = (n / max * BW) + 'px';
    const v = $('div', 'vval'); add(v, document.createTextNode(String(n) + ' '), $('span', 'vb', '(' + books + ')'));
    add(r, $('div', 'vn serif', name), bar, v); ch.appendChild(r);
  });
  b.appendChild(ch); b.appendChild($('div', 'vnote serif', N.counts_note));
  s.appendChild(b); npFoot(s, N); return { kind: 'zv_counts' };
}
function zvElephant() {
  const N = D.numbers.gary_zveri; const s = npBase('np np-v3', 1080, 1350); npTop(s);
  const b = $('div', 'body'); b.appendChild($('div', 'label lab', 'Слон по книгам'));
  const ch = $('div', 'vchart'); const max = N.elephant_by_book[0][2]; const BW = 470;
  N.elephant_by_book.forEach(([name, year, n], i) => {
    const r = $('div', 'erow2' + (i === 0 ? ' hot' : ''));
    const nm = $('div', 'en'); add(nm, $('span', 'serif', name), $('span', 'gy', ' · ' + year));
    const bw = $('div', 'ebw'); const bar = $('div', 'ebar'); bar.style.width = (n / max * BW) + 'px'; add(bw, bar, $('div', 'ev2', String(n)));
    add(r, nm, bw); ch.appendChild(r);
  });
  b.appendChild(ch); b.appendChild($('div', 'vnote serif', N.elephant_note));
  const q = $('div', 'equote'); add(q, $('div', 'eq serif', '«' + N.elephant_example.text + '»'), $('div', 'eb', '— «' + N.elephant_example.book + '»')); b.appendChild(q);
  s.appendChild(b); npFoot(s, N); return { kind: 'zv_elephant' };
}
function zvTwo() {
  const N = D.numbers.gary_zveri; const s = npBase('np np-v4', 1080, 1350); npTop(s);
  const sen = sentencesOf(N.headline); const b = $('div', 'body'); b.appendChild($('div', 'label lab', 'Собака и удав'));
  const blk = (lab, bigs, text) => { const e = $('div', 'vblk'); const bg = $('div', 'vbigs'); bigs.forEach(x => { const g = $('div', 'vb1'); add(g, $('div', 'vbn', x[0]), $('div', 'vbc', x[1])); bg.appendChild(g); }); add(e, $('div', 'label vl', lab), bg, $('div', 'vt serif', text)); return e; };
  const t1 = sen[1], t2 = sen[2]; const n1 = t1.match(/\d+/g), n2 = t2.match(/\d+%?/g);
  b.appendChild(blk('Собака', [[n1[0] + ' из ' + n1[1], 'книг']], t1));
  b.appendChild(blk('Удав', [[n2[0], 'раз'], [n2[1], 'у Ажара']], t2));
  s.appendChild(b); npFoot(s, N); return { kind: 'zv_two', sentences: [t1, t2] };
}
const zvText = () => { const N = D.numbers.gary_zveri; return npTextPost(N, 'Что нашли', N.headline, null); };

/* ===== неделя 3 · Бродский, палитра (рилс) ===== */
function palBar(list, cls) {
  const bar = $('div', 'pbar ' + (cls || ''));
  list.forEach(([name, v, col]) => { const sg = $('div', 'pseg'); sg.style.flexGrow = v; sg.style.flexBasis = '0'; sg.style.background = col; sg.title = name; bar.appendChild(sg); });
  return bar;
}
function palFrame() { const s = npBase('rl rl-p', 1080, 1920); logoTop(s); return s; }
function palFoot(s, N) { const f = $('div', 'src'); f.style.textAlign = 'left'; f.style.width = '858px'; add(f, $('div', null, N.section), $('div', 'u', N.url)); s.appendChild(f); }
function palTitle() {
  const N = D.numbers.brodsky_cveta; const s = mkSlide('dark rl glow rl-p', 1080, 1920); logoTop(s); const tc = $('div', 'tc'); tc.style.top = '520px';
  const first = N.periods[Object.keys(N.periods)[0]];
  add(tc, $('div', 'ptitle serif', 'Палитра Бродского'), palBar(first, 'cov'), $('div', 'psub serif', 'Какого цвета его стихи'));
  s.appendChild(tc); return { kind: 'pal_title' };
}
function palBig() {
  const N = D.numbers.brodsky_cveta; const s = palFrame(); const m = $('div', 'pmain'); m.style.top = '420px';
  const pct = N.headline.match(/(\d+)%/)[1] + '%';
  add(m, $('div', 'pbig', pct), $('div', 'pcap serif', '«чёрный» и «белый» — из всех цветовых прилагательных'));
  s.appendChild(m); palFoot(s, N); return { kind: 'pal_big' };
}
function palPeriod(i) {
  const N = D.numbers.brodsky_cveta; const keys = Object.keys(N.periods); const s = palFrame();
  let y = 170;
  keys.slice(0, i).forEach(k => {
    const r = $('div', 'prow'); r.style.top = y + 'px'; add(r, $('div', 'pyl', k), palBar(N.periods[k], 'thin')); s.appendChild(r); y += 92;
  });
  const cur = $('div', 'pcur'); cur.style.top = (y + 20) + 'px';
  const list = N.periods[keys[i]]; const top4 = [...list].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const lab = $('div', 'plab');
  top4.forEach(([name, v, col]) => { const l = $('div', 'pl1'); const sw = $('i'); sw.style.background = col; add(l, sw, $('span', 'pn', name), $('span', 'pp', fmtN(v) + '%')); lab.appendChild(l); });
  add(cur, $('div', 'pyear', keys[i]), palBar(list, 'big'), lab); s.appendChild(cur);
  palFoot(s, N); return { kind: 'pal_period', period: keys[i], shown: top4.map(t => t[0]) };
}
function palShift() {
  const N = D.numbers.brodsky_cveta; const s = palFrame(); const m = $('div', 'pmain'); m.style.top = '380px';
  m.appendChild($('div', 'label plabel', 'Что сдвинулось'));
  const col = {}; Object.values(N.periods).forEach(l => l.forEach(([n, v, c]) => { col[n] = c; }));
  sentencesOf(N.shift).forEach(t => {
    const nm = (t.match(/«([^»]+)»/) || [])[1]; const r = $('div', 'psh'); const sw = $('i'); sw.style.background = col[nm.toLowerCase()] || '#999';
    const tx = $('div', 'pst'); richInto(tx, t); add(r, sw, tx); m.appendChild(r);
  });
  s.appendChild(m); palFoot(s, N); return { kind: 'pal_shift' };
}
function palFinal() {
  const N = D.numbers.brodsky_cveta; const s = mkSlide('dark rl glow rl-p', 1080, 1920); const m = $('div', 'pmain'); m.style.top = '520px';
  const lg = logo('НА_ПРОСВЕТ'); lg.classList.add('pfin');
  add(m, lg, $('div', 'rule'), $('div', 'pnote serif', N.periods_note), $('div', 'psect', N.section), $('div', 'purl', N.url), $('div', 'pprof', 'Ссылка в профиле'));
  s.appendChild(m); return { kind: 'pal_final' };
}
function palCover() {
  const N = D.numbers.brodsky_cveta; const s = mkSlide('dark rl glow rl-p', 1080, 1920); const tc = $('div', 'tc'); tc.style.top = '600px';
  const last = N.periods[Object.keys(N.periods)[0]];
  const lg = logo('НА_ПРОСВЕТ'); lg.style.fontSize = '84px';
  add(tc, lg, $('div', 'ptitle serif', 'Палитра Бродского'), palBar(last, 'cov'), $('div', 'psub serif', 'Какого цвета его стихи'));
  s.appendChild(tc); return { kind: 'pal_cover' };
}

Object.assign(window.RENDER, {
  planFull, fullPage, fCover, fWords, fFinal,
  zCover, zTable, zExtreme, zEvidence, garyDialog, chekhovRecords, brodskyRecords,
  rgQuestion, rgAuthor, rgFinal, rgCover,
  zvCover, zvCounts, zvElephant, zvTwo, zvText,
  palTitle, palBig, palPeriod, palShift, palFinal, palCover,
});
