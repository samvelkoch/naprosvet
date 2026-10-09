# На просвет

Литературный проект. Невидимое наследие писателей: Бродский, Чехов, Гари.

| Исследование | Страница | Код и методика |
|---|---|---|
| Бродский на просвет | [/brodsky/](https://samvelkoch.github.io/naprosvet/brodsky/) | [samvelkoch/brodsky](https://github.com/samvelkoch/brodsky) |
| Чехов на просвет | [/chekhov/](https://samvelkoch.github.io/naprosvet/chekhov/) | [samvelkoch/chekhov](https://github.com/samvelkoch/chekhov) |
| Ромен Гари на просвет | [/gary/](https://samvelkoch.github.io/naprosvet/gary/) | [samvelkoch/gary](https://github.com/samvelkoch/gary) |
| Голоса | [/voices/](https://samvelkoch.github.io/naprosvet/voices/) | `voices/` в этом репозитории |

Каждое исследование — один самодостаточный HTML-файл (`<автор>/index.html`), собранный пайплайном из соответствующего репозитория.
Сайт — GitHub Pages из ветки `main`, корень репозитория.

«Голоса» — ответы трёх персон на три опросника по 100 вопросов. Исходники в `voices/src/` (`<отвечает>.<составитель>-100.json`), сборка `python3 voices/build.py` → `voices/data.json`.
