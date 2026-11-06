import json
def full_slides(add, plan, key, date, start, post_cover_call):
    """обложка + ответы целиком (портрет или текстовые слайды) -> возвращает следующий номер"""
    i = start
    pl = plan(f'RENDER.planFull({json.dumps(key)})')
    for item in pl:
        for idx in range(item['n']):
            add(f'{date}_post_{i}.png', (1080, 1350), f'RENDER.fullPage({json.dumps(key)},{json.dumps(item["author"])},{idx})', 'golosa', 'post')
            i += 1
    return i, pl

def build(add, plan, DATA):
    K = '2026-10-19_q008'
    add('2026-10-19_stories_1.png', (1080, 1920), f'RENDER.storyQuestion("{K}")', 'golosa', 'story')
    for i in range(3):
        add(f'2026-10-19_stories_{i+2}.png', (1080, 1920), f'RENDER.storyAnswer("{K}",{i})', 'golosa', 'story')
    for i, (c, reg) in enumerate([('zCover', 'cover'), ('zTable', 'post'), ('zExtreme', 'post'), ('zEvidence', 'post')], 1):
        add(f'2026-10-20_post_{i}.png', (1080, 1350), f'RENDER.{c}()', 'np', reg)
    add('2026-10-21_stories_1.png', (1080, 1920), 'RENDER.garyDialog()', 'np', 'story')
    R = '2026-10-22_reel_q095'
    add('2026-10-22_reel_1.png', (1080, 1920), f'RENDER.rgQuestion("{R}")', 'golosa', 'reel')
    for i in range(3):
        add(f'2026-10-22_reel_{i+2}.png', (1080, 1920), f'RENDER.rgAuthor("{R}",{i})', 'golosa', 'reel')
    add('2026-10-22_reel_5.png', (1080, 1920), 'RENDER.rgFinal()', 'golosa', 'reel')
    add('2026-10-22_reel_cover.png', (1080, 1920), 'RENDER.rgCover()', 'golosa', 'reel')
    add('2026-10-23_stories_1.png', (1080, 1920), 'RENDER.chekhovRecords()', 'np', 'story')
    F = '2026-10-24_q019_full'
    add('2026-10-24_post_1.png', (1080, 1350), f'RENDER.fCover("{F}","За одним столом")', 'golosa', 'cover')
    i, pl = full_slides(add, plan, F, '2026-10-24', 2, None)
    add(f'2026-10-24_post_{i}.png', (1080, 1350), f'RENDER.fWords("{F}")', 'golosa', 'post')
    print('  план ответов целиком (week2 F):', pl)

# ---- ожидания для verify: (файл, [строки, которые обязаны быть на слайде]) ----
def _n(v): return str(v).replace('.', ',')
def _i(v): return f'{v:,}'.replace(',', ' ')
def expect(J):
    N = J['numbers']; Z = N['chekhov_znaki']; G = N['gary_dialog']; R = N['chekhov_rekordy']; E = []
    s0, s1 = Z['signs']
    E.append(('2026-10-20_post_1.png', ['БЫЛО / СТАЛО · ЧЕХОВ', s0['sign'], f"{_n(s0['early'])} → {_n(s0['late'])}", 'восклицательных знаков на 1000 слов', f"{Z['early']} → {Z['late']}", Z['url'], Z['section']]))
    E.append(('2026-10-20_post_2.png', [Z['early'], Z['late']] + [x for s in Z['signs'] for x in (s['sign'], s['name'], _n(s['early']), _n(s['late']))]))
    E.append(('2026-10-20_post_3.png', ['«' + Z['extreme']['title'] + '»', str(Z['extreme']['year']), str(Z['extreme']['value']), Z['extreme']['sign'], Z['extreme']['unit']]))
    E.append(('2026-10-20_post_4.png', [Z['headline'], Z['method'], 'Раздел ' + Z['section'], Z['url'], 'Ссылка в профиле']))
    E.append(('2026-10-21_stories_1.png', ['ЦИФРА ДНЯ · ГАРИ', 'Самая разговорная книга Гари — «' + G['top'][0][0] + '»', 'медиана по книгам', _n(G['median']) + '%', G['method'], G['section'], G['url']]
              + [x for t in G['top'] + G['bottom'] for x in (t[0], str(t[1]), _n(t[2]) + '%')]))
    E.append(('2026-10-23_stories_1.png', ['РЕКОРД · ЧЕХОВ', R['shortest']['label'], '«' + R['shortest']['title'] + '»', f"{_i(R['shortest']['words'])} слов, {R['shortest']['year']}",
              R['longest']['label'], '«' + R['longest']['title'] + '»', f"{_i(R['longest']['words'])} слов, {R['longest']['year']}", 'Оба — 1884 год.', R['section'], R['url']]))
    F = J['fragments']['2026-10-22_reel_q095']; V = J['voices'][F['qid']]
    E.append(('2026-10-22_reel_1.png', ['Спрашивает Бродский', 'Венеция, ноябрь 1993', V['q']]))
    E.append(('2026-10-22_reel_5.png', ['все 900 ответов', 'ссылка в профиле']))
    E.append(('2026-10-24_post_1.png', ['ЗА ОДНИМ СТОЛОМ', 'Спрашивает Гари', 'Париж, 1980', 'Отец. Одно слово.']))
    E.append(('2026-10-24_post_5.png', ['Флота.', 'Лавка.', 'Чужой.', 'Все 900 ответов — в разделе «Голоса_», ссылка в профиле']))
    return E
