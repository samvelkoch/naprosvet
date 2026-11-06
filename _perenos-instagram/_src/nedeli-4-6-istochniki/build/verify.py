#!/usr/bin/env python3
"""python3 build/verify.py week2 [--out DIR] [--dump DIR]
Проверяет то, что реально отрисовано (dump/*.json = innerText каждого слайда), против <week>/src/*.json."""
import argparse, json, re, sys, pathlib, importlib
from PIL import Image
B = pathlib.Path(__file__).resolve().parent; I = B.parent
ap = argparse.ArgumentParser(); ap.add_argument('week'); ap.add_argument('--out'); ap.add_argument('--dump'); args = ap.parse_args()
W = I / args.week; OUT = pathlib.Path(args.out) if args.out else W / 'out'; DUMP = pathlib.Path(args.dump) if args.dump else B / 'dump' / args.week
J = {n: json.loads((W / 'src' / f'{n}.json').read_text(encoding='utf-8')) for n in ['numbers', 'personas', 'fragments', 'voices']}
dumps = {d.name[:-5].replace('__', '/'): json.loads(d.read_text(encoding='utf-8')) for d in sorted(DUMP.glob('*.json'))}
PLAQUE = 'РЕКОНСТРУКЦИЯ ЛИЧНОСТИ · НЕ ЦИТАТА'
fail = []
def check(cond, msg):
    if not cond: fail.append(msg); print('  FAIL:', msg)
norm = lambda s: re.sub(r'\s+', ' ', s.replace('\u2060', '').replace(' ', ' ')).strip()
nrm = lambda s: norm(s).lower()
strip = lambda p: p.replace('*', '')

print(f'== {args.week}: кадров {len(dumps)} ==')
print('\n== 1. Фрагменты и ответы ==')
for key, F in J['fragments'].items():
    if key.startswith('_'): continue
    V = J['voices'][F['qid']]
    qs = [d for d in dumps.values() if d['info'].get('qid') == F['qid'] and d['info']['kind'] in ('story_q', 'rg_q', 'f_cover')]
    check(qs and all(d['info']['question'] == V['q'] for d in qs), f'{key}: вопрос не совпал с voices[{F["qid"]}].q')
    for d in qs: check(('Спрашивает ' + J['personas'][F['asker']]['name'].split()[-1]).upper() in d['text'].upper(), f'{key}: asker не виден в {d["name"]}')
    print(f'  {key}: вопрос == voices["{F["qid"]}"].q ✓ (в {len(qs)} кадр.), спрашивает {F["asker"]}')
    if F.get('full'):
        for a in F['order']:
            exp = [strip(p) for p in V['a'][a].split('\n\n')]
            pgs = sorted([d for d in dumps.values() if d['info'].get('kind') == 'full_page' and d['info']['key'] == key and d['info']['author'] == a], key=lambda d: d['info']['idx'])
            check(pgs and [d['info']['idx'] for d in pgs] == list(range(len(pgs))) and all(d['info']['n'] == len(pgs) for d in pgs), f'{key}/{a}: нумерация страниц')
            got = [p for d in pgs for p in d['info']['paras']]
            check(got == exp, f'{key}/{a}: склеенный текст слайдов != полный ответ')
            joined_ok = '\n\n'.join(got) == strip(V['a'][a])
            check(joined_ok, f'{key}/{a}: склейка через \\n\\n != ответ без *')
            for d in pgs:
                fs = d['info']['fs']; mn = 34 if d['info']['mode'] == 'portrait' else 32
                check(fs >= mn, f'{d["name"]}: кегль {fs} < {mn}')
                check(norm(d['text']).count('(продолжение)') == (1 if d['info']['idx'] > 0 else 0), f'{d["name"]}: пометка «(продолжение)»')
                check(('→' in d['text']) == (d['info']['mode'] == 'text' and d['info']['idx'] < d['info']['n'] - 1), f'{d["name"]}: стрелка → внизу')
            print(f'  {key}/{a}: ответ ЦЕЛИКОМ {len(strip(V["a"][a]))} зн., {len(exp)} абз., слайдов {len(pgs)} ({pgs[0]["info"]["mode"]}, кегль {pgs[0]["info"]["fs"]}px): склейка == ответ ✓')
        if F.get('cover_quote'):
            cq = F['cover_quote']; check(cq['text'] in V['a'][cq['author']], f'{key}: cover_quote не подстрока ответа'); print(f'  {key}: cover_quote — подстрока ответа {cq["author"]} ✓')
        words = [d for d in dumps.values() if d['info'].get('kind') == 'f_words']
        for d in words:
            exp = [re.sub(r'\*[^*]*\*', '', V['a'][a].split('\n\n')[0]).strip() for a in F['order']]
            check(d['info']['words'] == exp, f'{key}: слова на итоговом слайде'); print(f'  {key}: слова в столбик {d["info"]["words"]} == первые строки ответов ✓')
    else:
        for a in F['order']:
            parts = F['answers'][a]; ans = V['a'][a]
            for p in parts: check(p in ans, f'{key}/{a}: часть не подстрока voices: {p[:40]}')
            ds = [d for d in dumps.values() if d['info'].get('kind') in ('story_a', 'rg_a') and d['info']['qid'] == F['qid'] and d['info']['author'] == a]
            check(len(ds) == 1 and ds[0]['info']['parts'] == [strip(p) for p in parts], f'{key}/{a}: на слайде != фрагмент')
            if ds:
                d = ds[0]; mn = 40 if d['info']['kind'] == 'story_a' else 44; check(int(d['info']['fs']) >= mn, f'{d["name"]}: кегль {d["info"]["fs"]} < {mn}')
                print(f'  {d["name"]} [{a}] {len(parts)} part(s): подстрока voices ✓, отрисовано == фрагмент ✓, кегль {d["info"]["fs"]}px (мин. {mn})')
        order_names = [d['info']['author'] for d in sorted([d for d in dumps.values() if d['info'].get('kind') in ('story_a', 'rg_a') and d['info']['qid'] == F['qid']], key=lambda d: d['name'])]
        check(order_names == F['order'], f'{key}: порядок авторов {order_names} != {F["order"]}')

print('\n== 2. Плашка на кадрах ГОЛОСА_ ==')
gol = [k for k, d in dumps.items() if d['track'] == 'golosa']
bad = [k for k in gol if [norm(x) for x in dumps[k]['plaque']] != [PLAQUE]]
check(not bad, f'нет плашки: {bad}')
print(f'  кадров ГОЛОСА_: {len(gol)}; плашка «{PLAQUE}» на {len(gol) - len(bad)}')

print('\n== 3. Обязательные тексты на кадрах (по innerText) ==')
sys.path.insert(0, str(B / 'specs')); mod = importlib.import_module(args.week)
for fname, strings in mod.expect(J):
    t = nrm(dumps[fname]['text']); miss = [s for s in strings if nrm(s) not in t]
    check(not miss, f'{fname}: нет на слайде: {miss}'); print(f'  {fname}: {len(strings)} строк ✓' if not miss else f'  {fname}: нет {miss}')

print('\n== 4. Цифры слайдов НА_ПРОСВЕТ -> numbers.json ==')
NUM = re.compile(r'\d+(?:[  ]\d{3}(?!\d))*(?:[.,]\d+)?')
toks = lambda s: [float(re.sub(r'[  ]', '', m.group()).replace(',', '.')) for m in NUM.finditer(s)]
allowed = set()
def walk(o):
    if isinstance(o, dict): [allowed.update(toks(k)) for k in o]; [walk(v) for v in o.values()]
    elif isinstance(o, list): [walk(v) for v in o]
    elif isinstance(o, (int, float)) and not isinstance(o, bool): allowed.add(float(o))
    elif isinstance(o, str): allowed.update(toks(o))
walk(J['numbers'])
for k, d in dumps.items():
    if d['track'] != 'np': continue
    vals = toks(d['text']); bad = [v for v in vals if v not in allowed]
    check(not bad, f'{k}: цифры не из numbers.json: {bad}')
    print(f'  {k} -> {[int(v) if v == int(v) else v for v in vals]}{"" if not bad else "  !!! " + str(bad)}')

print('\n== 5. Размеры PNG, шрифты ==')
for k, d in dumps.items():
    im = Image.open(OUT / k); exp = tuple(d['size'])
    if k.startswith('reel_assets'): check(im.mode == 'RGBA' and im.getpixel((0, 0))[3] == 0, f'{k}: нет альфы')
    else: check(exp == ((1080, 1350) if '_post_' in k else (1080, 1920)), f'{k}: неожиданный размер в спеке {exp}')
    check(im.size == exp, f'{k}: размер файла {im.size} != {exp}')
    check(all(f.endswith('loaded') for f in d['fonts']) and len(d['fonts']) >= 5, f'{k}: шрифты не loaded')
print(f'  проверено {len(dumps)} файлов: 1080×1920 / 1080×1350 (или RGBA-ассеты), все 5 @font-face = loaded')
print('\nИТОГ:', 'ВСЁ ОК' if not fail else f'{len(fail)} ОШИБОК'); sys.exit(1 if fail else 0)
