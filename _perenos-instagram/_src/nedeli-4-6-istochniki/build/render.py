#!/usr/bin/env python3
"""Рендер PNG недели: python3 build/render.py week2 [--out DIR] [--dump DIR] [--only SUBSTR]
Данные — только из <week>/src/*.json (инжектируются как window.DATA). Макеты — slides.html/js/css.
Список кадров недели — build/specs/<week>.py."""
import argparse, json, sys, pathlib, importlib
from playwright.sync_api import sync_playwright
from PIL import Image

B = pathlib.Path(__file__).resolve().parent
I = B.parent
ap = argparse.ArgumentParser()
ap.add_argument('week'); ap.add_argument('--out'); ap.add_argument('--dump'); ap.add_argument('--only')
args = ap.parse_args()
W = I / args.week
OUT = pathlib.Path(args.out) if args.out else W / 'out'
DUMP = pathlib.Path(args.dump) if args.dump else B / 'dump' / args.week
OUT.mkdir(parents=True, exist_ok=True); DUMP.mkdir(parents=True, exist_ok=True)

# портреты: копия без gAMA/cHRM-чанков (иначе Chromium сдвигает цвет бумаги и виден прямоугольник); пиксели не меняются
(B / 'portraits').mkdir(exist_ok=True)
for a in ('brodsky', 'chekhov', 'gary'):
    Image.open(I / 'week1' / 'src' / 'portraits' / f'{a}.png').convert('RGB').save(B / 'portraits' / f'{a}.png')
DATA = {n: json.loads((W / 'src' / f'{n}.json').read_text(encoding='utf-8')) for n in ['numbers', 'personas', 'fragments', 'voices']}

REGIONS = {'story': (60, 250, 1020, 1580), 'post': (72, 60, 1008, 1290), 'cover': (84, 60, 996, 1290), 'reel': (60, 60, 930, 1600)}

FONT_CHECK = r"""
async () => {
  const faces = [...document.fonts];
  await Promise.all([
    document.fonts.load('400 40px "IBM Plex Mono"'), document.fonts.load('500 40px "IBM Plex Mono"'), document.fonts.load('600 40px "IBM Plex Mono"'),
    document.fonts.load('40px "PT Serif"'), document.fonts.load('italic 40px "PT Serif"')]);
  await document.fonts.ready;
  const st = faces.map(f => f.family + ' ' + f.weight + ' ' + f.style + ' ' + f.status);
  return {ok: document.fonts.check('600 40px "IBM Plex Mono"') && document.fonts.check('20px "PT Serif"') && document.fonts.check('italic 20px "PT Serif"')
              && faces.length >= 5 && faces.every(f => f.status === 'loaded'), st};
}
"""
LAYOUT_CHECK = r"""
(reg) => {
  const [x0, y0, x1, y1] = reg; const bad = [];
  const slide = document.querySelector('.slide');
  const w = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (!n.textContent.trim()) continue;
    const pe = n.parentElement; if (getComputedStyle(pe).visibility === 'hidden') continue;
    const r = document.createRange(); r.selectNodeContents(n);
    for (const b of r.getClientRects()) {
      if (b.width < 1) continue;
      if (b.left < x0 - 0.5 || b.right > x1 + 0.5 || b.top < y0 - 0.5 || b.bottom > y1 + 0.5)
        bad.push(['outside', n.textContent.trim().slice(0, 30), Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]);
    }
  }
  slide.querySelectorAll('*').forEach(e => {
    const cs = getComputedStyle(e);
    if (cs.overflow === 'hidden' && e.scrollHeight > e.clientHeight + 1 && e.tagName !== 'IMG') bad.push(['clipped', e.className, e.scrollHeight, e.clientHeight]);
    if (e.classList.contains('slide')) return;
    if (e.scrollWidth > e.clientWidth + 1 && cs.display !== 'inline' && cs.overflow === 'hidden') bad.push(['hclipped', e.className, e.scrollWidth, e.clientWidth]);
  });
  return bad;
}
"""

def new_page(br, w, h):
    pg = br.new_page(viewport={'width': w, 'height': h}, device_scale_factor=1)
    pg.on('pageerror', lambda e: print('PAGEERROR', e))
    pg.add_init_script('window.DATA = ' + json.dumps(DATA, ensure_ascii=False) + ';')
    pg.goto((B / 'slides.html').as_uri())
    fc = pg.evaluate(FONT_CHECK)
    if not fc['ok']:
        raise SystemExit(f"ШРИФТЫ НЕ ЗАГРУЖЕНЫ: {fc['st']}")
    return pg

SPECS = []
def add(name, size, call, track, region, transparent=False):
    SPECS.append(dict(name=name, size=size, call=call, track=track, region=region, transparent=transparent))

def main():
    with sync_playwright() as p:
        br = p.chromium.launch(**({'executable_path': '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'} if pathlib.Path('/opt/pw-browsers').exists() else {}))
        plan_pg = new_page(br, 1080, 1920)
        def plan(call):            # вычислить в браузере то, от чего зависит число кадров (пагинация ответов целиком)
            return plan_pg.evaluate(f"(() => {{ return {call}; }})()")
        sys.path.insert(0, str(B / 'specs'))
        mod = importlib.import_module(args.week)
        mod.build(add, plan, DATA)
        plan_pg.close()
        for sp in SPECS:
            if args.only and args.only not in sp['name']: continue
            w, h = sp['size']
            pg = new_page(br, w, h)
            info = pg.evaluate(f"(() => {{ return {sp['call']}; }})()")
            pg.evaluate("Promise.all([...document.images].map(i => i.decode()))")
            fc = pg.evaluate(FONT_CHECK)
            if not fc['ok']:
                raise SystemExit(f"ШРИФТЫ НЕ ЗАГРУЖЕНЫ (после рендера): {fc['st']}")
            if sp['region']:
                bad = pg.evaluate(LAYOUT_CHECK, list(REGIONS[sp['region']]))
                if bad:
                    print('LAYOUT VIOLATIONS', sp['name'], json.dumps(bad, ensure_ascii=False)); sys.exit(1)
            text = pg.evaluate("document.querySelector('.slide').innerText")
            plaque = pg.evaluate("[...document.querySelectorAll('.plaque')].map(e => e.textContent)")
            out = OUT / sp['name']; out.parent.mkdir(parents=True, exist_ok=True)
            pg.locator('.slide').screenshot(path=str(out), omit_background=bool(sp['transparent']))
            (DUMP / (sp['name'].replace('/', '__') + '.json')).write_text(json.dumps(
                dict(name=sp['name'], track=sp['track'], size=[w, h], info=info, text=text, plaque=plaque, fonts=fc['st']), ensure_ascii=False, indent=1), encoding='utf-8')
            print('ok', sp['name'], info.get('fs', '') if isinstance(info, dict) else '')
            pg.close()
        br.close()

if __name__ == '__main__':
    main()
