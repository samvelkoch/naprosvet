/* недели 4–6: общие макеты под данные D.numbers[key]; тексты только из src/*.json */
const fv3 = n => Number.isInteger(n) ? fmtInt(n) : fmtN(n);
const ALLV = () => D.numbers.voices_total;     // «Все 448 вопросов …»
function fFinal3() {
  const s = mkSlide('paper po po-d', 1080, 1350); const m = $('div', 'main');
  m.appendChild($('div', 'label lab', 'Что это такое'));
  m.appendChild($('div', 'disc serif', D.personas._disclaimer_site));
  m.appendChild($('div', 'all', ALLV()));
  m.appendChild($('div', 'addr', BASE + '/voices/'));
  s.appendChild(m); voicesFoot(s); return { kind: 'f_final' };
}
function rgFinal3() {
  const s = mkSlide('paper rg rg-f', 1080, 1920); const m = $('div', 'main');
  add(m, logo('ГОЛОСА_', 'big'), $('div', 'rule'), $('div', 'l1 serif', D.numbers.voices_short), $('div', 'l2', 'ссылка в профиле'));
  s.appendChild(m); rgFoot(s); return { kind: 'rg_f' };
}
function rgQ3(key) {
  const F = D.fragments[key]; const s = mkSlide('paper rg rg-q', 1080, 1920);
  const m = $('div', 'main'); m.appendChild($('div', 'label lab', F.label));
  const ar = $('div', 'askrow'); add(ar, $('div', 'asker', 'Спрашивает ' + surname(D.personas[F.asker].name)), $('div', 'tp', timepoint(F.asker)), $('div', 'rule')); m.appendChild(ar);
  const qb = $('div', 'qbox serif', D.voices[F.qid].q); m.appendChild(qb);
  const hint = $('div', 'hint'); withArrows(F.hint, hint); m.appendChild(hint);
  s.appendChild(m); rgFoot(s); fit(qb, 100, 64, 'вопрос рилса');
  return { kind: 'rg_q', qid: F.qid, question: qb.textContent };
}
function rgCover3(key) {
  const F = D.fragments[key]; const s = mkSlide('paper rg rg-c', 1080, 1920); const m = $('div', 'main');
  add(m, logo('ГОЛОСА_', 'big'), $('div', 'rule'), $('div', 't serif', F.cover_title), $('div', 'names', F.cover_names));
  s.appendChild(m); rgFoot(s); return { kind: 'rg_cover' };
}
/* --- НА_ПРОСВЕТ, посты 1080×1350 --- */
function nCover(k) {
  const N = D.numbers[k], C = N.cover; const s = npBase('np np-1 np-v1', 1080, 1350); npTop(s);
  const b = $('div', 'body'); b.appendChild($('div', 'label lab', C.label));
  b.appendChild($('div', 'vtitle serif', C.title));
  if (C.big) b.appendChild($('div', 'vbig' + (String(C.big).length > 4 ? ' sm' : ''), C.big));
  if (C.cap) b.appendChild($('div', 'vcap serif', C.cap));
  s.appendChild(b); npFoot(s, N); return { kind: 'n_cover' };
}
function nBars(k, j) {
  const N = D.numbers[k], G = N.bars[j]; const s = npBase('np np-v2 wide', 1080, 1350); npTop(s);
  const b = $('div', 'body'); b.appendChild($('div', 'label lab', G.label));
  if (G.head) b.appendChild($('div', 'nhead serif', G.head));
  const ch = $('div', 'vchart'); const max = Math.max(...G.rows.map(r => r[1])); const BW = 360;
  G.rows.forEach(([name, n, sub], i) => {
    const r = $('div', 'vrow' + ((G.hot || []).includes(i) ? ' hot' : '')); const bar = $('div', 'vbar'); bar.style.width = (n / max * BW) + 'px';
    const v = $('div', 'vval'); add(v, document.createTextNode(fv3(n) + (G.unit || '') + ' '), sub ? $('span', 'vb', sub) : null);
    add(r, $('div', 'vn serif', name), bar, v); ch.appendChild(r);
  });
  b.appendChild(ch); if (G.note) b.appendChild($('div', 'vnote serif', G.note));
  s.appendChild(b); npFoot(s, N); return { kind: 'n_bars' };
}
function nList(k, j) {
  const N = D.numbers[k], L = N.lists[j]; const s = npBase('np np-l', 1080, 1350); npTop(s);
  const b = $('div', 'body'); b.appendChild($('div', 'label lab', L.label));
  if (L.head) b.appendChild($('div', 'nhead serif', L.head));
  const ul = $('div', 'nlist');
  L.items.forEach(([t, sub]) => { const it = $('div', 'ni'); add(it, $('div', 'nt serif', t), $('div', 'ns2', sub)); ul.appendChild(it); });
  b.appendChild(ul); s.appendChild(b); npFoot(s, N);
  fit(ul, L.fs || 60, 34, 'список ' + k + j);
  return { kind: 'n_list' };
}
function nPair(k, j) {
  const N = D.numbers[k], P = N.pairs[j]; const s = npBase('np np-pr', 1080, 1350); npTop(s);
  const b = $('div', 'body'); b.appendChild($('div', 'label lab', P.label));
  b.appendChild($('div', 'pbook serif', '«' + P.book + '»'));
  const box = $('div', 'pbox');
  [[P.l1, P.t1], [P.l2, P.t2]].forEach(([l, t]) => { const c = $('div', 'pc'); add(c, $('div', 'label pl', l), $('div', 'pt serif', t)); box.appendChild(c); });
  b.appendChild(box);
  if (P.stats) { const st = $('div', 'pst'); P.stats.forEach(([n, a, c]) => { const r = $('div', 'psr'); add(r, $('span', 'psn', n), $('span', 'psv', a + ' / ' + c)); st.appendChild(r); }); b.appendChild(st); }
  s.appendChild(b); npFoot(s, N); fit(box, P.fs || 46, 30, 'пара ' + k + j);
  return { kind: 'n_pair' };
}
function nFinal(k) { const N = D.numbers[k]; return npTextPost(N, N.final.label, N.final.headline, N.final.note); }
/* --- НА_ПРОСВЕТ, сторис 1080×1920 --- */
function sBars(k) {
  const N = D.numbers[k], S = N.story; const s = npBase('ns nsb', 1080, 1920); logoTop(s);
  const b = $('div', 'body' + (S.rows.length > 3 ? ' many' : '')); add(b, $('div', 'label lab', S.label), $('div', 'head serif', S.head));
  const bars = $('div', 'bars'); const max = Math.max(...S.rows.map(r => r[1]));
  S.rows.forEach(([name, n], i) => {
    const it = $('div', 'bi'); const br = $('div', 'bbar' + (i ? ' dim' : ''), fv3(n) + (S.unit || '')); br.style.width = Math.max(18, n / max * 100) + '%';
    add(it, $('div', 'bn', name), br); bars.appendChild(it);
  });
  b.appendChild(bars); s.appendChild(b);
  if (S.corp) s.appendChild($('div', 'corp', S.corp));
  const f = $('div', 'src'); add(f, $('div', null, N.section), $('div', null, N.url)); s.appendChild(f);
  s.appendChild($('div', 'stk')); return { kind: 'ns' };
}
function sCards(k) {
  const N = D.numbers[k], S = N.story;
  return recordsStory(S.label, N, S.cards.map(c => ({ label: c[0], main: c[1], sub: c[2] })), S.caption || null);
}
/* --- НА_ПРОСВЕТ, рилс 1080×1920 (кадры = конечные состояния) --- */
function rnBase() { const s = npBase('rl rn', 1080, 1920); logoTop(s); return s; }
function rnFoot(s, N) { const f = $('div', 'src rnsrc'); add(f, $('div', null, N.section), $('div', 'u', N.url)); s.appendChild(f); }
function rnTitle(k) {
  const N = D.numbers[k], R = N.reel; const s = rnBase(); const m = $('div', 'rm rm-t');
  add(m, $('div', 'label lab', R.label), $('div', 'rt serif', R.title), $('div', 'rule'), $('div', 'rs serif', R.sub));
  s.appendChild(m); rnFoot(s, N); return { kind: 'rn_title' };
}
function rnImage(k, j) {
  const N = D.numbers[k], I = N.reel.images[j]; const s = rnBase(); const m = $('div', 'rm rm-i');
  m.appendChild($('div', 'label lab', I.label));
  const im = $('img', 'rimg'); im.src = I.src; m.appendChild(im);
  if (I.cap) m.appendChild($('div', 'rcap2 serif', I.cap));
  s.appendChild(m); rnFoot(s, N); return { kind: 'rn_image' };
}
function rnList(k, j) {
  const N = D.numbers[k], L = N.reel.lists[j]; const s = rnBase(); const m = $('div', 'rm rm-l');
  m.appendChild($('div', 'label lab', L.label));
  const ul = $('div', 'rlist');
  L.items.forEach(([n, t, sub]) => { const it = $('div', 'rli'); add(it, $('div', 'rn1', n), $('div', 'rtx', null)); const tx = it.lastChild; add(tx, $('div', 'rt1 serif', t), $('div', 'rs1 serif', sub)); ul.appendChild(it); });
  m.appendChild(ul); s.appendChild(m); rnFoot(s, N); fit(ul, 64, 32, 'рилс-список ' + j);
  return { kind: 'rn_list' };
}
function rnFields(k) {
  const N = D.numbers[k], F = N.reel.fields; const s = rnBase(); const m = $('div', 'rm rm-f');
  add(m, $('div', 'label lab', F.label), $('div', 'rh serif', F.head), F.unit ? $('div', 'fu', F.unit) : '');
  const g = $('div', 'fg'); const max = Math.max(...F.rows.map(r => Math.max(r[1], r[2])));
  F.rows.forEach(([n, a, b2]) => {
    const r = $('div', 'fr'); const nm = $('div', 'fn serif', n);
    const ba = $('div', 'fb a'); ba.style.width = (a / max * 500) + 'px';
    const bb = $('div', 'fb b'); bb.style.width = (b2 / max * 500) + 'px';
    add(r, nm, add($('div', 'fbs'), add($('div', 'fl'), ba, $('span', 'fv', fv3(a))), add($('div', 'fl'), bb, $('span', 'fv d', fv3(b2))))); g.appendChild(r);
  });
  const lg = $('div', 'flg'); add(lg, $('span', 'k a'), document.createTextNode(F.la + '   '), $('span', 'k b'), document.createTextNode(F.lb));
  add(m, lg, g); s.appendChild(m); rnFoot(s, N); return { kind: 'rn_fields' };
}
function rnFinal(k) {
  const N = D.numbers[k], R = N.reel; const s = rnBase(); const m = $('div', 'rm rm-e');
  add(m, logo('НА_ПРОСВЕТ', 'big'), $('div', 'rule'), $('div', 'rs serif', R.end), $('div', 'psect', N.section), $('div', 'purl', N.url), $('div', 'pprof', 'Ссылка в профиле'));
  s.appendChild(m); return { kind: 'rn_final' };
}
/* --- ГОЛОСА_ Zen: кадр со скриншотом сайта 1080×1920 --- */
function zenFrame(k, j) {
  const Z = D.numbers[k], F = Z.frames[j]; const s = mkSlide('paper zf' + (F.dark ? ' zd' : ''), 1080, 1920);
  const t = $('div', 'zt'); add(t, $('div', 'label lab', F.label), $('div', 'zh serif', F.head)); s.appendChild(t);
  if (F.src) { const ph = $('div', 'zph'); const im = $('img'); im.src = F.src; ph.appendChild(im); s.appendChild(ph); }
  if (F.cap) s.appendChild($('div', 'zc serif', F.cap));
  voicesFoot(s); return { kind: 'zen' };
}
Object.assign(window.RENDER, { fFinal3, rgFinal3, rgQ3, rgCover3, nCover, nBars, nList, nPair, nFinal, sBars, sCards,
  rnTitle, rnImage, rnList, rnFields, rnFinal, zenFrame,
  fCover, fullPage, planFull, rgAuthor, storyQuestion, storyAnswer });
