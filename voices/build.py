"""Сводит ответы персон в один файл для страницы «Голоса» (/voices/).

src/<отвечает>.<составитель>-100.json — 9 файлов (3 опросника × 3 автора),
src/<отвечает>.posetiteli-108.json — вопросы посетителей сайта (составитель не автор,
  поэтому разделов нет: у каждой персоны своя нарезка на беседы, текст вопроса берётся у Бродского),
src/questionnaires.json — названия разделов каждого опросника,
src/themes.json — сквозные темы (1–2 на вопрос).
Результат: data.json рядом со страницей.

    python3 voices/build.py
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "src"
AUTHORS = ("brodsky", "chekhov", "gary")  # порядок колонок как на главной


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    meta = load(SRC / "questionnaires.json")
    themes = load(SRC / "themes.json")
    authors, questions = {}, []
    for qid, q in meta.items():
        composer = q["composer"]
        stem = q.get("file", f"{composer}-100")
        files = {a: load(SRC / f"{a}.{stem}.json") for a in AUTHORS}
        for a, d in files.items():
            if d["questionnaire"]["id"] != qid or d["author"]["id"] != a:
                sys.exit(f"{a}.{stem}.json: ожидался {a} / {qid}, "
                         f"а внутри {d['author']['id']} / {d['questionnaire']['id']}")
            authors.setdefault(a, {k: d["author"][k] for k in ("name", "years", "persona_note", "sources")})
        rows = {a: d["answers"] for a, d in files.items()}
        own = composer in AUTHORS
        base = rows[composer if own else AUTHORS[0]]
        for a in AUTHORS:
            if [r["id"] for r in rows[a]] != [r["id"] for r in base]:
                sys.exit(f"{a} / {qid}: набор вопросов не совпадает с опросником")
        for i, r in enumerate(base):
            questions.append({
                "id": f"{composer}/{r['id']}",
                "by": composer,
                "s": r["section"] if own else q["sections"][0]["id"],
                "t": themes["map"][f"{composer}/{r['id']}"],
                "q": r["question"],
                "a": {a: rows[a][i]["answer"].strip() for a in AUTHORS},
            })
    data = {
        "authors": authors,
        # разделы по составителю опросника: questions[].by + questions[].s → название
        "sections": {v["composer"]: {s["id"]: (f"{s['num']}. " if s["num"] else "") + s["title"] for s in v["sections"]} for v in meta.values()},
        "themes": themes["themes"],
        "questions": questions,
    }
    out = HERE / "data.json"
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{out.name}: {len(questions)} вопросов × {len(AUTHORS)} ответа, {out.stat().st_size // 1024} КБ")


if __name__ == "__main__":
    main()
