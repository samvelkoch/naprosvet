"""Собирает карточки «На просвет сегодня» и отбор для «Чей ответ?» в today/cards.json.

Карточки: по одной записи на миф и на рекорд из трёх исследований
(brodsky/index.html, chekhov/index.html, gary/index.html):
    {"author", "kind": "myth|record", "text", "verdict": "yes|no|part|null", "num", "section"}
  * мифы Чехова и Гари берутся из JSON страницы (<script id="data-stats">, ключ myths), числа
    приводятся к виду страницы (десятичная запятая) и сверяются с отрисованной страницей;
  * мифы Бродского считаются в JS страницы, поэтому берутся из отрисованного DOM (#myths article);
  * рекорды всех трёх берутся из отрисованного DOM (#records .rec: заголовок .k, значение .v,
    пояснение .d). JSON-ключ records есть только у Бродского и Гари, и его набор не совпадает
    с показанным на странице (у Бродского 7 записей против 8 карточек, часть собирается в JS
    из других ключей; у Гари 11 против 9, там есть неотображаемые), у Чехова его нет вовсе;
    DOM даёт одну структуру и уже готовый человеческий текст для всех трёх.
Отрисовка: Playwright (Chromium) и локальный http.server из корня репозитория, который
поднимается и останавливается самим скриптом.
Вердикт «цифрами не решается» (none) и рекорды записываются как null.

Отбор для «Чей ответ?»: guessable(answer_text) проверяет первые две фразы ответа на имена
автора, его псевдонимы и города его жизни (список MARKERS ниже). В cards.json ключ guess:
{"<id вопроса>": ["brodsky", "gary"]} — авторы, чьи ответы годятся для анонимного показа
(только непустые). Вопросы берутся из voices/data.json, поэтому сначала python3 voices/build.py.

    pip install playwright && playwright install chromium   # один раз
    python3 voices/build.py
    python3 today/build.py
"""
import functools
import http.server
import json
import re
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HERE = Path(__file__).resolve().parent
AUTHORS = ("brodsky", "chekhov", "gary")
SECTIONS = {"myth": "mify", "record": "rekordy"}  # id разделов на страницах авторов
VERDICT_CLASS = {"v-yes": "yes", "v-no": "no", "v-part": "part"}
# На страницах «none» («цифрами не решается») рисуется как v-part; в JSON его отличаем сами.
VERDICT_JSON = {"yes": "yes", "no": "no", "part": "part", "none": None}

# ---------------------------------------------------------------- отбор для «Чей ответ?»
# Основы слов без окончаний, регистр не важен, совпадение с начала слова (так ловятся падежи:
# «Ленинграде», «Таганрогом», «Ялтинский»). Ложные срабатывания допустимы: они только
# убирают ответ из игры.
MARKERS = (
    # имена и псевдонимы авторов
    "бродск", "иосиф", "чехов", "антон", "павлович",
    "гари", "ромен", "ажар", "эмиль", "кацев", "касев", "фоско", "синибальди", "боргиа",
    "brodsk", "chekhov", "gary", "ajar", "romain", "kacew",
    # города и места жизни
    "ленинград", "петербург", "питер", "венеци", "таганрог", "ялт", "мелихов",
    "вильн", "вильню", "ницц", "париж",
)
MARKER_RE = re.compile(r"(?<![\w])(?:" + "|".join(re.escape(m) for m in MARKERS) + r")", re.I)
# Режиссёрские ремарки в начале ответа: *(долго смотрит на подпись)*
LEAD_REMARKS_RE = re.compile(r"\A\s*(?:\*[^*]+\*\s*)+")
# Конец фразы: . ! ? … или пустая строка; точка после одной заглавной буквы («А. Чехов») не конец.
SENTENCE_SPLIT_RE = re.compile(r"(?<![А-ЯЁA-Z])(?<=[.!?…])[»\"')\]]*\s+|\n\s*\n")


def first_phrases(answer_text, n=2):
    """Ремарки в начале ответа + первые n фраз остального текста."""
    text = answer_text.strip()
    m = LEAD_REMARKS_RE.match(text)
    lead = m.group(0) if m else ""
    parts = SENTENCE_SPLIT_RE.split(text[len(lead):].strip())
    return lead + " ".join(p for p in parts[:n] if p)


def markers_found(answer_text):
    """Найденные в первых двух фразах маркеры (для отчёта и проверки)."""
    return [m.group(0).lower() for m in MARKER_RE.finditer(first_phrases(answer_text))]


def guessable(answer_text):
    """Годится ли ответ для анонимного показа: в первых двух фразах нет имён, псевдонимов, городов."""
    return not markers_found(answer_text)


def build_guess(questions):
    guess = {}
    for q in questions:
        ok = [a for a in AUTHORS if guessable(q["a"][a])]
        if ok:
            guess[q["id"]] = ok
    return guess


# ---------------------------------------------------------------- карточки
def clean(s):
    """Пробелы схлопываются, мягкие переносы и пробелы нулевой ширины убираются; U+00A0 в числах остаётся."""
    s = re.sub(r"[​­]", "", s)
    s = re.sub(r"[ \t\r\n]+", " ", s)
    return s.strip()


def comma(s):
    """Как на страницах: 1.28 → 1,28."""
    return re.sub(r"(\d)\.(\d)", r"\1,\2", s)


def load_json_myths(author):
    html = (ROOT / author / "index.html").read_text(encoding="utf-8")
    m = re.search(r'<script type="application/json" id="data-stats">(.*?)</script>', html, re.S)
    if not m:
        sys.exit(f"{author}/index.html: нет <script type=\"application/json\" id=\"data-stats\">")
    myths = json.loads(m.group(1)).get("myths")
    if not myths:
        sys.exit(f"{author}/index.html: в data-stats нет ключа myths")
    for mm in myths:
        if mm["v"] not in VERDICT_JSON:
            sys.exit(f"{author}: миф {mm['id']}: неизвестный вердикт {mm['v']!r}")
    return myths


def render(playwright, base_url):
    """Отрисованные мифы (#myths article) и рекорды (#records .rec) всех авторов из DOM."""
    browser = playwright.chromium.launch()
    page = browser.new_page()
    out = {}
    js = """() => ({
      myths: [...document.querySelectorAll('#myths article')].map(a => ({
        q: a.querySelector('.q')?.textContent ?? '',
        cls: [...(a.querySelector('.verdict')?.classList ?? [])].find(c => c.startsWith('v-')) ?? null,
        num: a.querySelector('.num')?.textContent ?? ''})),
      records: [...document.querySelectorAll('#records .rec')].map(r => ({
        k: r.querySelector('.k')?.textContent ?? '',
        v: r.querySelector('.v')?.textContent ?? '',
        d: r.querySelector('.d')?.textContent ?? ''}))
    })"""
    for a in AUTHORS:
        page.goto(f"{base_url}/{a}/index.html", wait_until="load")
        page.wait_for_selector("#myths article", state="attached", timeout=120_000)
        page.wait_for_selector("#records .rec", state="attached", timeout=120_000)
        out[a] = page.evaluate(js)
    browser.close()
    return out


def myth_cards_from_dom(author, items):
    cards = []
    for it in items:
        if it["cls"] not in VERDICT_CLASS:
            sys.exit(f"{author}: у мифа «{it['q'][:40]}» нет известного класса вердикта ({it['cls']})")
        cards.append(card(author, "myth", it["q"], VERDICT_CLASS[it["cls"]], it["num"]))
    return cards


def card(author, kind, text, verdict, num):
    return {"author": author, "kind": kind, "text": clean(text), "verdict": verdict,
            "num": clean(num), "section": SECTIONS[kind]}


def myth_cards_from_json(author, myths, dom_items):
    cards = [card(author, "myth", m["q"], VERDICT_JSON[m["v"]], comma(m["num"])) for m in myths]
    # Сверка с отрисованной страницей: вопрос и первый .num должны совпасть, число мифов тоже.
    if len(dom_items) != len(cards):
        sys.exit(f"{author}: мифов в JSON {len(cards)}, на странице {len(dom_items)}")
    for c, d in zip(cards, dom_items):
        if c["text"] != clean(d["q"]) or c["num"] != clean(d["num"]):
            sys.exit(f"{author}: миф «{c['text'][:40]}»: JSON и страница расходятся")
        dv = VERDICT_CLASS.get(d["cls"])
        if c["verdict"] is not None and c["verdict"] != dv:
            sys.exit(f"{author}: миф «{c['text'][:40]}»: вердикт JSON {c['verdict']} ≠ страница {dv}")
    return cards


def record_cards(author, items):
    if not items:
        sys.exit(f"{author}: в #records нет рекордов")
    cards = []
    for r in items:
        k, v, d = clean(r["k"]), clean(r["v"]), clean(r["d"])
        num = f"{v} — {d}" if d else v
        cards.append(card(author, "record", k, None, num))
    return cards


def check_sections(cards):
    ids = {}
    for a in AUTHORS:
        html = (ROOT / a / "index.html").read_text(encoding="utf-8")
        ids[a] = set(re.findall(r'\bid="([^"]+)"', html))
    for c in cards:
        if c["section"] not in ids[c["author"]]:
            sys.exit(f"{c['author']}: раздел id=\"{c['section']}\" не найден в {c['author']}/index.html "
                     f"(карточка «{c['text'][:50]}»)")


def collect_cards():
    from playwright.sync_api import sync_playwright

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    handler = functools.partial(Quiet, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            dom = render(p, f"http://127.0.0.1:{server.server_address[1]}")
    finally:
        server.shutdown()
        server.server_close()

    cards = []
    for a in AUTHORS:
        if a == "brodsky":
            cards += myth_cards_from_dom(a, dom[a]["myths"])
        else:
            cards += myth_cards_from_json(a, load_json_myths(a), dom[a]["myths"])
        cards += record_cards(a, dom[a]["records"])
    return cards


def dump(cards, guess):
    """Детерминированный вывод: одна карточка в строке, фиксированный порядок ключей."""
    lines = [json.dumps(c, ensure_ascii=False, separators=(",", ":")) for c in cards]
    g = ",\n".join(f"{json.dumps(k, ensure_ascii=False)}:{json.dumps(v)}" for k, v in sorted(guess.items()))
    return '{"cards":[\n' + ",\n".join(lines) + '\n],\n"guess":{\n' + g + "\n}}\n"


def main():
    data_path = ROOT / "voices" / "data.json"
    if not data_path.exists():
        sys.exit("нет voices/data.json: сначала python3 voices/build.py")
    questions = json.loads(data_path.read_text(encoding="utf-8"))["questions"]

    cards = collect_cards()
    check_sections(cards)
    cards.sort(key=lambda c: (c["author"], c["kind"], c["text"]))
    keys = [(c["author"], c["kind"], c["text"]) for c in cards]
    if len(set(keys)) != len(keys):
        sys.exit("повторяются карточки (author, kind, text)")
    guess = build_guess(questions)

    out = HERE / "cards.json"
    out.write_text(dump(cards, guess), encoding="utf-8")
    print(f"{out.name}: {len(cards)} карточек")
    for a in AUTHORS:
        n = {k: sum(1 for c in cards if c["author"] == a and c["kind"] == k) for k in SECTIONS}
        print(f"  {a}: мифов {n['myth']}, рекордов {n['record']}")
    per_author = {a: sum(1 for v in guess.values() if a in v) for a in AUTHORS}
    print(f"guess: {len(guess)} из {len(questions)} вопросов имеют хотя бы один годный ответ "
          f"(по авторам: {per_author}); без годных: {len(questions) - len(guess)}")


if __name__ == "__main__":
    main()
