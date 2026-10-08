# На просвет

Литературный проект. Невидимое наследие писателей: Бродский, Чехов, Гари.

| Исследование | Страница | Код и методика |
|---|---|---|
| Бродский на просвет | [/brodsky/](https://samvelkoch.github.io/naprosvet/brodsky/) | [samvelkoch/brodsky](https://github.com/samvelkoch/brodsky) |
| Чехов на просвет | [/chekhov/](https://samvelkoch.github.io/naprosvet/chekhov/) | [samvelkoch/chekhov](https://github.com/samvelkoch/chekhov) |
| Ромен Гари на просвет | [/gary/](https://samvelkoch.github.io/naprosvet/gary/) | [samvelkoch/gary](https://github.com/samvelkoch/gary) |
| Голоса на просвет | [/golosa/](https://samvelkoch.github.io/naprosvet/golosa/) | `golosa/` в этом репозитории |

Каждое исследование — один самодостаточный HTML-файл (`<автор>/index.html`), собранный пайплайном из соответствующего репозитория.
Сайт — GitHub Pages из ветки `main`, корень репозитория.

«Голоса» — ответы трёх персон на три опросника по 100 вопросов. Исходники в `golosa/src/` (`<отвечает>.<составитель>-100.json`), сборка `python3 golosa/build.py` → `golosa/data.json`.
