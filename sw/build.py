"""Собирает sw.js (сервис-воркер приложения «На_просвет») из sw/sw.template.js.

В шаблон подставляются:
  * список предкэша: существующие файлы по маске (главная, манифест, theme.js, app.js, app.css,
    иконки, today/*, shelf/*, voices/{index.html,data.json,portrait.webp}, три страницы авторов);
    *.py и build.py не берутся, видео портретов не предкэшируются;
  * версия: первые 10 символов sha1 от путей и содержимого всех файлов списка и самого шаблона.
Любая правка сайта меняет версию, браузер видит новый sw.js и показывает плашку «Есть новая версия».

Запускать из любой папки после ЛЮБОЙ правки файлов из списка и коммитить sw.js вместе с ними:

    python3 sw/build.py           # пересобрать sw.js
    python3 sw/build.py --check   # только проверить, что sw.js актуален (код возврата 1, если нет)

Скрипт печатает число файлов и размер предкэша, а при размере больше 15 МБ падает.
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "sw" / "sw.template.js"
OUT = ROOT / "sw.js"
LIMIT_MB = 15

FIXED = [
    "index.html", "manifest.webmanifest", "theme.js", "app.js", "app.css",
    "favicon.svg", "favicon.ico", "apple-touch-icon.png",
    "voices/index.html", "voices/data.json", "voices/portrait.webp",
    "brodsky/index.html", "chekhov/index.html", "gary/index.html",
]
GLOBS = ["icons/*.png", "today/*", "shelf/*"]


def collect():
    found = set()
    missing = []
    for rel in FIXED:
        if (ROOT / rel).is_file():
            found.add(rel)
        else:
            missing.append(rel)
    for pattern in GLOBS:
        for p in ROOT.glob(pattern):
            if p.is_file() and p.suffix != ".py" and p.name != "build.py" and not p.name.startswith("."):
                found.add(p.relative_to(ROOT).as_posix())
    return sorted(found), missing


def main():
    check = "--check" in sys.argv[1:]
    files, missing = collect()
    if "index.html" not in files:
        sys.exit("нет index.html в корне: запускай скрипт из репозитория сайта")
    template = TEMPLATE.read_text(encoding="utf-8")

    h = hashlib.sha1()
    total = 0
    for rel in files:
        data = (ROOT / rel).read_bytes()
        total += len(data)
        h.update(rel.encode("utf-8") + b"\0" + data + b"\0")
    h.update(template.encode("utf-8"))
    version = h.hexdigest()[:10]

    mb = total / 1024 / 1024
    print("файлов в предкэше: %d, размер %.2f МБ, версия %s" % (len(files), mb, version))
    for rel in missing:
        print("  нет файла (пропущен): " + rel)
    if mb > LIMIT_MB:
        sys.exit("предкэш %.2f МБ больше лимита %d МБ" % (mb, LIMIT_MB))

    precache = json.dumps(["./" + f for f in files], ensure_ascii=False, indent=2)
    out = template.replace("__VERSION__", version).replace("__PRECACHE__", precache)
    if check:
        ok = OUT.is_file() and OUT.read_text(encoding="utf-8") == out
        print("sw.js актуален" if ok else "sw.js устарел: запусти python3 sw/build.py")
        sys.exit(0 if ok else 1)
    OUT.write_text(out, encoding="utf-8")
    print("записан " + str(OUT.relative_to(ROOT)))


if __name__ == "__main__":
    main()
