'use strict';
const D = window.DATA;
// Типографика: тире не переносится в начало строки, «1904-го» не рвётся на дефисе.
const typo = t => String(t).replace(/ —/g, '\u00a0—').replace(/(\d)-(\p{L})/gu, '$1-\u2060$2');
const $ = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = typo(text); return e; };
const add = (p, ...c) => { c.flat().forEach(x => x && p.appendChild(x)); return p; };
const NB = ' ';
const PLAQUE = 'РЕКОНСТРУКЦИЯ ЛИЧНОСТИ · НЕ ЦИТАТА';
const BASE = (() => { let u = null; (function w(o) { if (u) return; if (o && typeof o === 'object') { if (typeof o.url === 'string') { u = o.url; return; } Object.values(o).forEach(w); } })(D.numbers); return u.match(/^(.*?\/naprosvet)/)[1]; })();   // samvelkoch.github.io/naprosvet

function logo(text, cls) {               // «_» окрашивается акцентом
  const e = $('span', 'logo ' + (cls || ''));
  text.split(/(_)/).forEach(t => { if (!t) return; if (t === '_') e.appendChild($('span', 'us', '_')); else e.appendChild(document.createTextNode(t)); });
  return e;
}
const mono = (t, cls) => $('span', 'mono ' + (cls || ''), t);
function withArrows(text, parent) {      // → и ✓ — моноширинным (в PT Serif их нет)
  text.split(/([→✓])/).forEach(t => { if (!t) return; parent.appendChild(/[→✓]/.test(t) ? $('span', 'arrow', t) : document.createTextNode(t)); });
  return parent;
}
function fit(box, max, min, what) {
  let s = max; box.style.fontSize = s + 'px';
  while (box.scrollHeight > box.clientHeight + 1 && s > min) { s -= 1; box.style.fontSize = s + 'px'; }
  if (box.scrollHeight > box.clientHeight + 1) throw new Error('НЕ ВЛЕЗАЕТ при ' + min + 'px: ' + what);
  box.dataset.fs = s; return s;
}
const surname = n => n.trim().split(/\s+/).pop();
const timepoint = a => { const P = D.personas[a]; return P.where.split(',')[0] + ', ' + P.when; };
const fmtInt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
const fmtPct = v => v.toFixed(1).replace('.', ',');
const qOf = qid => D.voices[qid].q;

function mkSlide(cls, w, h) {
  const s = $('div', 'slide ' + cls); s.style.width = w + 'px'; s.style.height = h + 'px';
  const root = document.getElementById('root'); root.innerHTML = ''; root.appendChild(s); return s;
}
function voicesFoot(s) {
  const f = $('div', 'foot'); add(f, logo('ГОЛОСА_'), $('span', 'plaque', PLAQUE)); s.appendChild(f);
}
function portraitImg(s, author, width, left, bottom) {
  const img = $('img', 'portrait' + (author === 'chekhov' ? '' : ' fade'));
  img.src = 'portraits/' + author + '.png';
  const h = author === 'chekhov' ? width : Math.round(width * 800 / 640);
  img.style.width = width + 'px'; img.style.height = h + 'px'; img.style.left = left + 'px'; img.style.top = (bottom - h) + 'px';
  s.appendChild(img); return img;
}
function fragParts(box, parts) {
  parts.forEach((p, i) => {
    if (i > 0) box.appendChild($('p', 'gap', '[ … ]'));
    const el = $('p', 'part');
    p.split(/(\*[^*]+\*)/).forEach(t => { if (!t) return; if (t[0] === '*') el.appendChild($('em', 'rem', t.slice(1, -1))); else el.appendChild(document.createTextNode(t)); });
    box.appendChild(el);
  });
}

/* ---------------- ГОЛОСА_ сторис ---------------- */
function storyQuestion(key) {
  const F = D.fragments[key]; const s = mkSlide('paper st st-q', 1080, 1920);
  const m = $('div', 'main');
  m.appendChild($('div', 'label lab', 'ВОПРОС ДНЯ'));
  const ar = $('div', 'askrow');
  add(ar, $('div', 'asker', 'Спрашивает ' + surname(D.personas[F.asker].name)), $('div', 'tp', timepoint(F.asker)), $('div', 'rule'));
  m.appendChild(ar);
  const qb = $('div', 'qbox serif', qOf(F.qid)); qb.id = 'qbox'; m.appendChild(qb);
  const hint = $('div', 'hint'); withArrows('Отвечают все трое →', hint); m.appendChild(hint);
  s.appendChild(m); voicesFoot(s);
  fit(qb, 96, 60, 'вопрос');
  return { kind: 'story_q', qid: F.qid, question: qb.textContent };
}
function storyAnswer(key, idx) {
  const F = D.fragments[key]; const a = F.order[idx]; const P = D.personas[a];
  const s = mkSlide('paper st st-a', 1080, 1920);
  portraitImg(s, a, 560, 48, 850);
  const side = $('div', 'side');
  add(side, $('div', 'rule'), $('div', 'nm', surname(P.name)), $('div', 'yr', P.years), $('div', 'tp', timepoint(a)));
  const qw = $('div', 'qwrap'); add(qw, $('div', 'label qlab', 'Вопрос'), $('div', 'qt', qOf(F.qid))); side.appendChild(qw);
  s.appendChild(side);
  const ans = $('div', 'answer serif'); fragParts(ans, F.answers[a]); s.appendChild(ans);
  voicesFoot(s);
  fit(ans, 54, 40, key + ' ' + a);
  return { kind: 'story_a', qid: F.qid, author: a, parts: [...ans.querySelectorAll('.part')].map(e => e.textContent), fs: ans.dataset.fs };
}

/* ---------------- ГОЛОСА_ посты ---------------- */
function postCover() {
  const s = mkSlide('paper po po-c', 1080, 1350);
  s.appendChild(logo('ГОЛОСА_', 'big'));
  s.appendChild($('div', 'sub serif', 'Знакомьтесь: три голоса'));
  const rows = $('div', 'rows');
  ['brodsky', 'chekhov', 'gary'].forEach(a => {
    const r = $('div', 'row'); const t = $('div', 't');
    add(t, $('b', null, surname(D.personas[a].name)), document.createTextNode(' — ' + timepoint(a)));
    add(r, $('div', 'rule'), t); rows.appendChild(r);
  });
  s.appendChild(rows);
  s.appendChild($('div', 'proj serif', D.personas._project));
  voicesFoot(s);
  return { kind: 'post_cover' };
}
function postPersona(a) {
  const P = D.personas[a]; const s = mkSlide('paper po po-p', 1080, 1350);
  portraitImg(s, a, 560, 40, a === 'chekhov' ? 700 : 770);
  const side = $('div', 'side');
  add(side, $('div', 'rule'), $('div', 'nm', P.name), $('div', 'yr', P.years), $('div', 'label srclab', 'Голос собран по:'));
  const sr = $('div', 'srcs serif'); P.sources.forEach(t => sr.appendChild($('div', 's', t))); side.appendChild(sr);
  s.appendChild(side);
  const lo = $('div', 'lower');
  const w = $('div', 'where');
  add(w, document.createTextNode(P.where), $('span', 'd', '·'), document.createTextNode(P.when), $('span', 'd', '·'), document.createTextNode('ему ' + P.age));
  add(lo, $('div', 'label wlab', 'Откуда говорит'), w, $('div', 'manner serif', P.manner));
  s.appendChild(lo); voicesFoot(s);
  fit(sr, 26, 22, 'sources ' + a);
  if (lo.scrollHeight > lo.clientHeight + 1) throw new Error('lower не влезает ' + a);
  return { kind: 'post_persona', author: a, srcFs: sr.dataset.fs };
}
function postDisclaimer() {
  const s = mkSlide('paper po po-d', 1080, 1350);
  const m = $('div', 'main');
  m.appendChild($('div', 'label lab', 'Что это такое'));
  m.appendChild($('div', 'disc serif', D.personas._disclaimer_site));
  const all = $('div', 'all'); all.textContent = 'Все 900 ответов — в разделе «Голоса_», ссылка в профиле'; m.appendChild(all);
  m.appendChild($('div', 'addr', BASE + '/voices/'));
  s.appendChild(m); voicesFoot(s);
  return { kind: 'post_disc' };
}

/* ---------------- НА_ПРОСВЕТ посты ---------------- */
function npFoot(s, N) {
  const f = $('div', 'src'); add(f, $('div', null, N.section), $('div', 'u', N.url)); s.appendChild(f);
}
function npTop(s) { const t = logo('НА_ПРОСВЕТ'); t.classList.add('top'); s.appendChild(t); }
function mifyCover() {
  const N = D.numbers.brodsky_mify; const s = mkSlide('dark np np-1', 1080, 1350); npTop(s);
  const b = $('div', 'body');
  add(b, $('div', 'label lab', 'Миф или факт · Бродский'), $('div', 'claim serif', N.claim));
  const v = $('div', 'verdict');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 40 40'); svg.setAttribute('class', 'tick'); svg.setAttribute('aria-label', '✓');
  const pth = document.createElementNS('http://www.w3.org/2000/svg', 'path'); pth.setAttribute('d', 'M6 21 L16 31 L35 9'); pth.setAttribute('fill', 'none'); pth.setAttribute('stroke', 'currentColor'); pth.setAttribute('stroke-width', '6'); pth.setAttribute('stroke-linecap', 'round'); pth.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(pth); v.appendChild(svg); v.appendChild(document.createTextNode(N.verdict.replace('✓', '').trim())); v.dataset.verdict = N.verdict; b.appendChild(v);
  s.appendChild(b);
  const sw = $('div', 'swipe'); withArrows('ЛИСТАЙТЕ →', sw); s.appendChild(sw);
  npFoot(s, N); return { kind: 'np_cover' };
}
function rhythmEl(r) {
  const e = $('div', 'rh');
  r.split('-').forEach((syl, i) => {
    if (i > 0) e.appendChild(document.createTextNode('-'));
    e.appendChild(syl === syl.toUpperCase() ? $('span', 'ta', syl) : document.createTextNode(syl));
  });
  return e;
}
function mifyDef() {
  const N = D.numbers.brodsky_mify; const s = mkSlide('dark np np-2', 1080, 1350); npTop(s);
  const b = $('div', 'body'); b.appendChild($('div', 'title', 'Что такое дольник'));
  const pairs = [['classic', 'Классический размер', N.examples[0]], ['dolnik', 'Дольник', N.examples[1]]];
  pairs.forEach(([k, lab, ex]) => {
    const blk = $('div', 'blk');
    const card = $('div', 'card');
    add(card, $('div', 'ex serif', ex.line), rhythmEl(ex.rhythm), $('div', 'esrc', ex.src));
    add(blk, $('div', 'label lab', lab.toLowerCase() === ex.meter.toLowerCase() ? lab : lab + ' · ' + ex.meter), $('div', 'def serif', N.definitions[k]), card);
    b.appendChild(blk);
  });
  s.appendChild(b); npFoot(s, N); return { kind: 'np_def' };
}
function mifyBig() {
  const N = D.numbers.brodsky_mify; const s = mkSlide('dark np np-3', 1080, 1350); npTop(s);
  const b = $('div', 'body');
  b.appendChild($('div', 'label lab', 'Дольник и тактовик'));
  const nums = $('div', 'nums');
  const c1 = $('div', 'col'); add(c1, $('div', 'big', N.big_from), $('div', 'yrs', N.big_from_label));
  const ar = $('div', 'arr', '→');
  const c2 = $('div', 'col'); add(c2, $('div', 'big to', N.big_to), $('div', 'yrs', N.big_to_label));
  add(nums, c1, ar, c2); b.appendChild(nums);
  b.appendChild($('div', 'what serif', 'строк написаны дольником и тактовиком'));
  s.appendChild(b); npFoot(s, N); return { kind: 'np_big' };
}
function mifyChart() {
  const N = D.numbers.brodsky_mify; const s = mkSlide('dark np np-4', 1080, 1350); npTop(s);
  const b = $('div', 'body'); b.appendChild($('div', 'ctitle', 'Какими размерами написаны стихи, % строк'));
  const ch = $('div', 'chart'); const keys = Object.keys(N.periods_legend);
  N.periods.forEach(P => {
    const row = $('div', 'crow'); row.appendChild($('div', 'pl', P.p));
    const bar = $('div', 'bar');
    keys.forEach(k => {
      const v = P[k]; if (!(v > 0)) return;              // 0,0 — сегмента нет
      const sg = $('div', 'seg', fmtPct(v)); sg.style.flexGrow = v; sg.style.flexBasis = '0'; sg.style.background = N.periods_legend[k][1];
      sg.dataset.k = k; sg.dataset.v = v; bar.appendChild(sg);
    });
    row.appendChild(bar); ch.appendChild(row);
  });
  b.appendChild(ch);
  const lg = $('div', 'legend');
  keys.forEach(k => { const l = $('div', 'lg'); const i = $('i'); i.style.background = N.periods_legend[k][1]; add(l, i, $('span', 'serif', N.periods_legend[k][0])); lg.appendChild(l); });
  b.appendChild(lg);
  b.appendChild($('div', 'note serif', 'На обложке — объединённый период 1985–1996. ' + N.periods_three_note));
  s.appendChild(b); npFoot(s, N);
  // подписи: прячем те, что не помещаются
  s.querySelectorAll('.seg').forEach(sg => { const t = sg.textContent; sg.textContent = ''; const sp = $('span', null, t); sg.appendChild(sp);
    if (sp.getBoundingClientRect().width + 8 > sg.getBoundingClientRect().width) sp.style.display = 'none'; });
  return { kind: 'np_chart' };
}
function mifyEvidence() {
  const N = D.numbers.brodsky_mify; const s = mkSlide('dark np np-5', 1080, 1350); npTop(s);
  const b = $('div', 'body');
  const evd = $('div', 'ev serif'); withArrows(N.evidence, evd);
  add(b, $('div', 'label lab', 'Оговорка и источник'), evd, $('div', 'cav serif', N.site_caveat));
  const w = $('div', 'where');
  const sect = N.section.split(' · ');
  add(w, $('div', 'sect', 'Раздел ' + sect[0] + ' и ' + sect[1]), $('div', 'addr', N.url), $('div', 'prof serif', 'Ссылка в профиле'));
  b.appendChild(w); s.appendChild(b); return { kind: 'np_evidence' };
}

/* ---------------- НА_ПРОСВЕТ сторис ---------------- */
function chekhovStory() {
  const N = D.numbers.chekhov_gde; const s = mkSlide('dark ns', 1080, 1920);
  const t = logo('НА_ПРОСВЕТ'); t.classList.add('top'); s.appendChild(t);
  const b = $('div', 'body');
  const top = N.answer[0][0];   // Ялта
  const head = 'Больше всего писем Чехов написал из ' + ({ 'Ялта': 'Ялты' }[top] || top);
  add(b, $('div', 'label lab', 'Цифра дня · Чехов'), $('div', 'head serif', head));
  const bars = $('div', 'bars'); const max = N.answer[0][1];
  N.answer.forEach(([name, n], i) => {
    const it = $('div', 'bi'); const br = $('div', 'bbar' + (i ? ' dim' : ''), fmtInt(n)); br.style.width = (n / max * 100) + '%';
    add(it, $('div', 'bn', name), br); bars.appendChild(it);
  });
  b.appendChild(bars); s.appendChild(b);
  s.appendChild($('div', 'corp', N.corpus.replace(/(\d) (?=\d{3}\b)/g, '$1' + NB)));
  const f = $('div', 'src'); add(f, $('div', null, N.section), $('div', null, N.url)); s.appendChild(f);
  s.appendChild($('div', 'stk'));       // пустое место под стикер-ссылку
  return { kind: 'ns' };
}

/* ---------------- рилс: статичные кадры ---------------- */
function reelBlock(i) {
  const R = D.numbers.reel_glavnoe[i]; const s = mkSlide('dark rl', 1080, 1920);
  const t = logo('НА_ПРОСВЕТ'); t.classList.add('top'); s.appendChild(t);
  const card = $('div', 'card'); const img = $('img'); img.src = 'portraits/' + R.author + '.png'; card.appendChild(img);
  const h = R.author === 'chekhov' ? 640 : 800; card.style.top = (190 + (800 - h) / 2) + 'px'; s.appendChild(card);
  const info = $('div', 'info');
  add(info, $('div', 'nm', R.name), $('div', 'yr', R.years), $('div', 'big', R.big), $('div', 'tx serif', R.text));
  s.appendChild(info);
  s.appendChild($('div', 'src', BASE + R.url));
  return { kind: 'reel_block', author: R.author };
}
function reelTitle() {
  const s = mkSlide('dark rl glow', 1080, 1920); const tc = $('div', 'tc'); tc.style.top = '640px';
  add(tc, logo('НА_ПРОСВЕТ'), $('div', 'tag serif', D.numbers.site_tagline), $('div', 'rule'));
  s.appendChild(tc); return { kind: 'reel_title' };
}
function reelEnd() {
  const s = mkSlide('dark rl glow', 1080, 1920); const tc = $('div', 'tc'); tc.style.top = '600px';
  const names = D.numbers.reel_glavnoe.map(r => r.name).join(' · ');
  add(tc, logo('НА_ПРОСВЕТ'), $('div', 'rule'), $('div', 'names', names), $('div', 'prof', 'Ссылка в профиле'));
  tc.querySelector('.rule').style.marginBottom = '44px';
  s.appendChild(tc); return { kind: 'reel_end' };
}
function reelCover() {
  const s = mkSlide('dark rl glow', 1080, 1920); const tc = $('div', 'tc'); tc.style.top = '520px';
  add(tc, logo('НА_ПРОСВЕТ'), $('div', 'rule'));
  const t2 = $('div', 'tag serif', 'Три писателя на просвет'); t2.style.fontSize = '84px'; t2.style.lineHeight = '1.1'; t2.style.marginTop = '56px';
  const names = $('div', 'names', D.numbers.reel_glavnoe.map(r => r.name).join(' · ')); names.style.marginTop = '64px';
  const tg = $('div', 'tag serif', D.numbers.site_tagline); tg.style.fontStyle = 'italic'; tg.style.color = 'var(--mut)'; tg.style.fontSize = '46px'; tg.style.marginTop = '56px';
  add(tc, t2, names, tg); tc.querySelector('.rule').style.marginBottom = '0';
  s.appendChild(tc); return { kind: 'reel_cover' };
}
function cardAsset(author) {      // только карточка + тень, на прозрачном фоне (рендер с omit_background)
  const w = 640, h = author === 'chekhov' ? 640 : 800, pad = 90;
  document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent';
  const root = document.getElementById('root'); root.innerHTML = '';
  const s = $('div', 'slide'); s.style.width = (w + 2 * pad) + 'px'; s.style.height = (h + 2 * pad) + 'px'; s.style.background = 'transparent'; root.appendChild(s);
  const c = $('div', 'cardasset'); c.style.left = pad + 'px'; c.style.top = pad + 'px'; c.style.width = w + 'px'; c.style.height = h + 'px';
  const img = $('img'); img.src = 'portraits/' + author + '.png'; img.style.cssText = 'display:block;width:640px;height:' + h + 'px'; c.appendChild(img); s.appendChild(c);
  return { kind: 'card_asset' };
}

window.RENDER = {
  storyQuestion, storyAnswer, postCover, postPersona, postDisclaimer,
  mifyCover, mifyDef, mifyBig, mifyChart, mifyEvidence, chekhovStory,
  reelBlock, reelTitle, reelEnd, reelCover, cardAsset,
};
