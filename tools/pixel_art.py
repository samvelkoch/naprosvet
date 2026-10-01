# Рисует пиксель-арт для карточек главной (лев, таксы, мальчик): python tools/pixel_art.py
# Пишет превью *.png и svgs.json; SVG из svgs.json вставляются в index.html (.art). Нужен pillow.
from PIL import Image, ImageDraw
import json, sys

def canvas(w,h):
    im=Image.new('P',(w,h),0); im.putpalette([255,255,255, 190,50,35, 33,27,22]+[0]*(256*3-9)); return im, ImageDraw.Draw(im)

# ---------------- Венецианский лев (вид слева), 44x32 ----------------
def lion():
    W,H=46,32; im,d=canvas(W,H)
    d.ellipse([1,1,21,21],outline=2)                       # нимб (кольцо)
    # крыло: веер вверх и назад
    d.polygon([(22,18),(18,10),(21,4),(27,1),(35,1),(41,4),(44,10),(42,14),(38,15),(34,18),(28,19)],fill=1)
    for x2,y2 in [(24,5),(28,3),(33,3),(38,5),(42,9)]:
        d.line([(27,17),(x2,y2)],fill=0)                   # зазоры между перьями
    d.rounded_rectangle([14,16,37,25],radius=4,fill=1)     # тело
    d.rectangle([32,22,37,31],fill=1); d.rectangle([27,24,30,31],fill=1)   # задние лапы
    d.rectangle([14,23,17,28],fill=1); d.rectangle([19,23,22,28],fill=1)   # передние лапы
    d.line([(37,21),(42,21),(43,17)],fill=1)               # хвост
    d.ellipse([41,12,45,17],fill=2)                        # кисточка
    d.ellipse([3,3,19,19],fill=2)                          # грива
    for p in [(2,9),(1,13),(3,17),(6,20),(10,21),(15,20),(19,17),(20,12),(18,6),(14,2),(8,2),(4,5)]:
        d.point(p,fill=2)                                  # зубцы гривы
    d.ellipse([4,8,13,17],fill=1)                          # лицо
    d.rectangle([1,11,7,15],fill=1)                        # морда
    d.point((1,11),fill=2); d.point((1,12),fill=2)         # нос
    d.point((7,10),fill=2); d.point((8,10),fill=2)         # глаз
    d.line([(3,14),(6,14)],fill=0)                         # пасть
    d.rectangle([6,28,24,31],fill=2); d.line([(15,28),(15,31)],fill=0)     # книга под лапой
    return im

# ---------------- Две таксы ----------------
def dachshund_right():
    W,H=31,13; im,d=canvas(W,H)
    d.rounded_rectangle([4,4,22,8],radius=2,fill=1)        # длинное тело
    d.rectangle([21,3,25,7],fill=1); d.ellipse([23,2,28,7],fill=1)
    d.rectangle([27,4,30,6],fill=1)                        # длинная морда
    d.point((30,4),fill=2); d.point((30,5),fill=2)         # нос
    d.point((26,3),fill=2)                                 # глаз
    d.rectangle([22,3,24,8],fill=2)                        # длинное висячее ухо
    d.line([(4,4),(2,2),(1,0)],fill=1)                     # хвост
    for x in (5,8,18,21): d.rectangle([x,9,x+1,11],fill=1); d.point((x+2,11),fill=1)
    return im

def dachshunds():
    a=dachshund_right(); b=a.transpose(Image.FLIP_LEFT_RIGHT)
    W,H=66,14; im,d=canvas(W,H)
    for src,ox in ((a,0),(b,35)):
        g=to_grid(src)
        for y,row in enumerate(g):
            for x,c in enumerate(row):
                if c: im.putpixel((ox+x,y),c)
    for x in range(0,W,3): d.point((x,13),fill=2)
    return im

# ---------------- Одинокий мальчик с ботинком, 42x26 ----------------
def boy():
    W,H=42,26; im,d=canvas(W,H)
    d.rectangle([8,3,14,9],fill=1); d.rectangle([7,4,15,5],fill=1)       # голова, вихры
    d.point((10,6),fill=2); d.point((13,6),fill=2)                        # глаза
    d.rectangle([10,10,12,10],fill=1)                                     # шея
    d.rectangle([8,11,15,18],fill=1)                                      # туловище
    d.rectangle([6,12,7,18],fill=1)                                       # рука вдоль тела
    d.line([(15,12),(17,13),(19,14)],fill=1); d.line([(15,13),(17,14),(19,15)],fill=1)
    d.rectangle([19,15,20,16],fill=1)                                     # кисть
    d.rectangle([20,16,21,18],fill=2)                                     # голенище
    d.rectangle([19,19,25,21],fill=2); d.rectangle([20,19,21,21],fill=2)  # ботинок
    d.rectangle([8,19,10,23],fill=1); d.rectangle([13,19,15,23],fill=1)   # ноги
    d.rectangle([7,24,10,24],fill=1); d.rectangle([13,24,16,24],fill=1)   # ступни
    d.line([(10,25),(24,25)],fill=2)                                      # длинная тень
    for x in range(0,W,3): d.point((x,25),fill=2)
    # далёкая птица
    for p in [(33,4),(34,5),(35,4),(36,5),(37,4)]: d.point(p,fill=2)
    return im

def to_grid(im):
    w,h=im.size; px=im.load()
    return [[px[x,y] for x in range(w)] for y in range(h)]

def preview(name, im, scale=10):
    big=im.resize((im.width*scale,im.height*scale),Image.NEAREST).convert('RGB'); big.save(f'{name}.png')

def to_svg(im, px=4):
    w,h=im.size; g=to_grid(im); parts={1:[],2:[]}
    for y,row in enumerate(g):
        x=0
        while x<w:
            c=row[x]
            if c:
                x2=x
                while x2<w and row[x2]==c: x2+=1
                parts[c].append(f'M{x} {y}h{x2-x}v1h-{x2-x}z'); x=x2
            else: x+=1
    cls={1:'a',2:'k'}
    body=''.join(f'<path class="{cls[c]}" d="{"".join(p)}"/>' for c,p in parts.items() if p)
    return f'<svg class="pix" viewBox="0 0 {w} {h}" width="{w*px}" height="{h*px}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">{body}</svg>'

if __name__=='__main__':
    out={}
    for n,f in [('lion',lion),('dogs',dachshunds),('boy',boy)]:
        im=f(); preview(n,im); out[n]=to_svg(im)
    json.dump(out,open('svgs.json','w'),ensure_ascii=False)
    print({k:len(v) for k,v in out.items()})
