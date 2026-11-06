"""Раскладка недель 4–6 в Публикации (копия логики package.py + версии постов для сторис)."""
import re, shutil, sys
from pathlib import Path
from PIL import Image

ROOT = Path('/tmp/claude-0/ig/insta')
OUT = Path('/mnt/project-files/instagram/Публикации')
IG = Path('/mnt/project-files/instagram')
REC = Path('/tmp/claude-0/ig')
SITE = Path('/home/user/naprosvet')
WEEKS = {'week4': 'Неделя 4 · 2–7 ноября', 'week5': 'Неделя 5 · 9–14 ноября', 'week6': 'Неделя 6 · 16–21 ноября'}
DOW = dict(zip(['02','03','04','05','06','07','09','10','11','12','13','14','16','17','18','19','20','21'],
               ['Пн','Вт','Ср','Чт','Пт','Сб']*3))
EXTRA_POSTS = {'2026-11-10': IG / 'brodsky-poety', '2026-11-14': IG / 'golosa-mashina'}
REELS = {  # дата: (номер в motion_prompts_w4-6.md, файлы «для Motion»)
    '2026-11-05': ('Рилс 4 ·', [SITE / 'chekhov/portrait.mp4:chekhov_portrait.mp4']),
    '2026-11-12': ('Рилс 5 ·', [REC / 'ven_map_clean.png', REC / 'ven_map.png']),
    '2026-11-19': ('Рилс 6 ·', [REC / 'z_light.mp4', REC / 'z_ans.mp4']),
}
ZEN_STORY = ('2026-11-13', 'Сторис · Пт 13 ноября', [REC / f'z_{m}.mp4' for m in ('universe', 'drum', 'light', 'custom', 'ans')])
MOTION = (ROOT / 'motion_prompts_w4-6.md').read_text(encoding='utf-8')


def captions(week):
    text = (ROOT / week / 'captions.md').read_text(encoding='utf-8')
    out = {}
    for part in text.split('\n## ')[1:]:
        head, _, body = part.partition('\n')
        day = re.match(r'\S+ (\d+) ', head).group(1).zfill(2)
        out[day] = (head.strip(), re.sub(r'\n-{3,}\s*$', '', body.strip()).strip())
    return out


def prompt(key):
    part = MOTION.split(f'## {key}')[1].split('\n## ')[0]
    attach = re.search(r'\*\*Приложить:\*\*(.*?)\n\n', part, re.S).group(1).strip()
    return re.search(r'```\n(.*?)```', part, re.S).group(1).strip(), attach


def folder(date, head):
    rest = ' · '.join(p.strip() for p in head.split('·')[1:]).replace(':', ' —').replace('/', '-')
    return f'{date} {DOW[date[-2:]]} · {rest}'


def story_version(src, dst):
    im = Image.open(src).convert('RGB')
    bg = im.getpixel((4, 4))
    c = Image.new('RGB', (1080, 1920), bg)
    c.paste(im, (0, (1920 - im.height) // 2))
    c.save(dst, optimize=True)


def copy_assets(d, items):
    a = d / 'для Motion'; a.mkdir(exist_ok=True)
    for it in items:
        s, _, name = str(it).partition(':')
        shutil.copy2(s, a / (name or Path(s).name))


def main(week):
    dest = OUT / WEEKS[week]
    if dest.exists(): shutil.rmtree(dest)
    caps = captions(week)
    groups = {}
    for f in sorted((ROOT / week / 'out').glob('2026-*.png')):
        date, kind, tail = re.match(r'(2026-\d\d-\d\d)_(stories|post|reel)(?:_(.*))?\.png', f.name).groups()
        groups.setdefault((date, kind), []).append((tail or '', f))
    for date, src in EXTRA_POSTS.items():
        if date[-2:] in caps:
            groups[(date, 'post')] = [('', p) for p in sorted(src.glob('post-*.png'), key=lambda p: int(p.stem.split('-')[1]))]
    for (date, kind), files in sorted(groups.items()):
        head, body = caps[date[-2:]]
        d = dest / folder(date, head); d.mkdir(parents=True)
        if kind == 'reel':
            (d / 'кадры').mkdir()
            cover = [f for t, f in files if t == 'cover'] or [files[0][1]]
            shutil.copy2(cover[0], d / '00_обложка.png')
            for i, (_, f) in enumerate([x for x in files if x[0] != 'cover'], 1):
                shutil.copy2(f, d / 'кадры' / f'{i:02d}.png')
            key, assets = REELS[date]
            p, attach = prompt(key)
            copy_assets(d, assets)
            (d / 'промпт для Motion.txt').write_text(p + '\n\n---\nПриложить: ' + attach + '\n', encoding='utf-8')
            (d / 'подпись.txt').write_text(body + '\n', encoding='utf-8')
            (d / 'сторис.txt').write_text('После публикации — репост рилса в сторис (обложка 00_обложка.png уже 1080×1920).\n', encoding='utf-8')
        else:
            for i, (_, f) in enumerate(files, 1):
                shutil.copy2(f, d / f'{i:02d}.png')
            if kind == 'post':
                s = d / 'для сторис'; s.mkdir()
                for i, (_, f) in enumerate(files, 1):
                    story_version(f, s / f'{i:02d}.png')
                (s / 'заметка.txt').write_text('Те же слайды в формате сторис 1080×1920. Стикер-ссылка: samvelkoch.github.io/naprosvet\n', encoding='utf-8')
            (d / ('подпись.txt' if kind == 'post' else 'заметка.txt')).write_text(body + '\n', encoding='utf-8')
            if date == ZEN_STORY[0]:
                p, attach = prompt(ZEN_STORY[1])
                copy_assets(d, ZEN_STORY[2])
                (d / 'промпт для Motion.txt').write_text(p + '\n\n---\nПриложить: ' + attach + '\n', encoding='utf-8')
    print(dest)
    for p in sorted(dest.rglob('*')):
        if p.is_file(): print('  ', p.relative_to(dest))


if __name__ == '__main__':
    for w in sys.argv[1:] or WEEKS: main(w)
