# gary-chat: «Поговорить с Роменом Гари»

Cloudflare Worker между страницей `/gary/` и Claude API. Держит ключ API и персону, считает лимиты, отдаёт ответ потоком.

```
браузер (gary/chat.js) ──POST {messages}──> Worker ──> Claude API
                        <── NDJSON поток ──
```

- Персона: `src/persona.md` (в git не попадает, см. `.gitignore`). Это полный промпт проекта Romain Gary (`instructions-full.md`), к нему Worker дописывает короткие правила для веба: длина ответа, без markdown, выход из роли только при словах о самоубийстве.
- Лимиты: 5 вопросов на разговор, 600 символов на вопрос, 6 запросов в минуту с IP; с KV ещё 15 вопросов в день с IP и 500 в день на всех.
- Жёсткий потолок расходов — месячный лимит в Claude Console, его стоит выставить в любом случае.

## Запуск

```bash
cd worker/gary-chat
npm install
cp <путь>/instructions-full.md src/persona.md

# 1. Ключ: https://platform.claude.com → API Keys → Create Key; там же Billing (пополнить) и Limits (месячный потолок)
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY

# 2. (по желанию) дневные лимиты
npx wrangler kv namespace create GARY_LIMITS   # id вписать в wrangler.toml, раскомментировать [[kv_namespaces]]

# 3. Выкатить
npx wrangler deploy                             # напечатает https://gary-chat.<поддомен>.workers.dev
```

4. Вписать этот адрес в `gary/chat.js`: `var ENDPOINT = 'https://gary-chat.<поддомен>.workers.dev';`. Пока `ENDPOINT` пуст, кнопки на странице нет.

Логи и расход токенов по каждому ответу: `npx wrangler tail`.

Локально: `echo 'ANTHROPIC_API_KEY=sk-ant-...' > .dev.vars && npx wrangler dev` (в `ALLOWED_ORIGINS` добавить `http://localhost:...`).

## Стоимость

Модель задаётся `MODEL` в `wrangler.toml`. Оценка на один разговор из 5 вопросов: персона ≈ 12 тыс. токенов (оценка по объёму текста, точное число покажет `usage` в `wrangler tail`), ответ ≈ 600 токенов, персона кэшируется (запись ×1,25 один раз, дальше чтение).

| MODEL | $/1M вход / выход | ≈ $ за разговор | ≈ $ за 1000 разговоров |
|---|---|---|---|
| `claude-opus-5-5` (по умолчанию, effort `low`) | 4 / 20 | 0,15–0,20 | 150–200 |
| `claude-sonnet-5-5` | 2 / 10 | 0,08 | 80 |
| `claude-haiku-5-5` | 0,10 / 0,50 | 0,005 | 5 |

Без кэша Opus стоил бы ≈ 0,36 $ за разговор: персона оплачивалась бы целиком на каждом вопросе.
