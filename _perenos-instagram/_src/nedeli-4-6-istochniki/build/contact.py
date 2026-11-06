#!/usr/bin/env python3
"""python3 build/contact.py week2 [--out DIR] [--to FILE]: контактный лист всех кадров недели в порядке публикации, с подписью имени файла."""
import argparse, pathlib
from PIL import Image, ImageDraw, ImageFont
B = pathlib.Path(__file__).resolve().parent; I = B.parent
ap = argparse.ArgumentParser(); ap.add_argument('week'); ap.add_argument('--out'); ap.add_argument('--to'); ap.add_argument('--cols', type=int, default=9); args = ap.parse_args()
OUT = pathlib.Path(args.out) if args.out else I / args.week / 'out'
files = sorted(p for p in OUT.glob('2026-*.png'))
font = ImageFont.truetype(str(B / 'fonts' / 'IBMPlexMono-500.ttf'), 20)
TH = 480; cols = args.cols; pad = 14; lab = 34
thumbs = []
for p in files:
    im = Image.open(p).convert('RGB'); r = TH / im.height; thumbs.append((p.name, im.resize((round(im.width * r), TH), Image.LANCZOS)))
rows = [thumbs[i:i + cols] for i in range(0, len(thumbs), cols)]
rw = [sum(t.width for _, t in r) + pad * (len(r) + 1) for r in rows]
sheet = Image.new('RGB', (max(rw), len(rows) * (TH + lab + pad) + pad), (60, 60, 60)); d = ImageDraw.Draw(sheet)
y = pad
for r in rows:
    x = pad
    for n, t in r:
        sheet.paste(t, (x, y + lab)); d.text((x, y + 6), n.replace('.png', '').replace('2026-', ''), fill=(240, 240, 240), font=font); x += t.width + pad
    y += TH + lab + pad
dest = pathlib.Path(args.to) if args.to else OUT / '_contact_sheet.png'
sheet.save(dest); print(dest, sheet.size, len(files))
