import json
from week2 import full_slides
def build(add, plan, DATA):
    K = '2026-10-26_q096'
    add('2026-10-26_stories_1.png', (1080, 1920), f'RENDER.storyQuestion("{K}")', 'golosa', 'story')
    for i in range(3):
        add(f'2026-10-26_stories_{i+2}.png', (1080, 1920), f'RENDER.storyAnswer("{K}",{i})', 'golosa', 'story')
    for i, (c, reg) in enumerate([('zvCover', 'cover'), ('zvCounts', 'post'), ('zvElephant', 'post'), ('zvTwo', 'post'), ('zvText', 'post')], 1):
        add(f'2026-10-27_post_{i}.png', (1080, 1350), f'RENDER.{c}()', 'np', reg)
    add('2026-10-28_stories_1.png', (1080, 1920), 'RENDER.brodskyRecords()', 'np', 'story')
    calls = ['palTitle', 'palBig'] + [f'palPeriod({i})' for i in range(5)] + ['palShift', 'palFinal']
    for i, c in enumerate(calls, 1):
        add(f'2026-10-29_reel_{i}.png', (1080, 1920), f'RENDER.{c.split("(")[0]}({c.split("(")[1][:-1] if "(" in c else ""})', 'np', 'reel')
    add('2026-10-29_reel_cover.png', (1080, 1920), 'RENDER.palCover()', 'np', 'reel')
    K = '2026-10-30_q041'
    add('2026-10-30_stories_1.png', (1080, 1920), f'RENDER.storyQuestion("{K}")', 'golosa', 'story')
    for i in range(3):
        add(f'2026-10-30_stories_{i+2}.png', (1080, 1920), f'RENDER.storyAnswer("{K}",{i})', 'golosa', 'story')
    F = '2026-10-31_q070_full'
    add('2026-10-31_post_1.png', (1080, 1350), f'RENDER.fCover("{F}","Из своего времени")', 'golosa', 'cover')
    i, pl = full_slides(add, plan, F, '2026-10-31', 2, None)
    add(f'2026-10-31_post_{i}.png', (1080, 1350), 'RENDER.fFinal()', 'golosa', 'post')
    assert i <= 10, f'слайдов в посте F: {i} > 10'
    print('  план ответов целиком (week3 F):', pl, 'всего слайдов', i)

def _n(v): return str(v).replace('.', ',')
def expect(J):
    N = J['numbers']; Z = N['gary_zveri']; B = N['brodsky_rekordy']; C = N['brodsky_cveta']; E = []
    E.append(('2026-10-27_post_1.png', ['МИР АВТОРА · ГАРИ', 'Главный зверь Гари — слон', '563', 'упоминания, из них 544 — в одной книге', Z['url'], Z['section']]))
    E.append(('2026-10-27_post_2.png', [Z['counts_note']] + [x for n, c, b in Z['counts'] for x in (n, str(c), f'({b})')]))
    E.append(('2026-10-27_post_3.png', [Z['elephant_note'], Z['elephant_example']['text'], '«' + Z['elephant_example']['book'] + '»'] + [x for n, y, c in Z['elephant_by_book'] for x in (n, str(y), str(c))]))
    sen = Z['headline'].split('. ')
    E.append(('2026-10-27_post_4.png', ['По числу книг впереди собака — 27 книг из 41, больше всего в «Белой собаке».', 'Удав упомянут 198 раз, 92% — у Ажара: это Голубчик из одноимённого романа.']))
    E.append(('2026-10-27_post_5.png', [Z['headline'], 'Раздел ' + Z['section'], Z['url'], 'Ссылка в профиле']))
    E.append(('2026-10-28_stories_1.png', ['РЕКОРДЫ · БРОДСКИЙ', B['rhyme']['label'], B['rhyme']['value'], B['rhyme']['count'], B['epithet']['label'], B['epithet']['value'], B['epithet']['count'], B['section'], B['url']]))
    E.append(('2026-10-29_reel_1.png', ['Палитра Бродского', 'Какого цвета его стихи']))
    E.append(('2026-10-29_reel_2.png', ['39%', '«чёрный» и «белый» — из всех цветовых прилагательных']))
    for i, k in enumerate(C['periods']):
        top = sorted(C['periods'][k], key=lambda x: -x[1])[:4]
        E.append((f'2026-10-29_reel_{i+3}.png', [k] + [x for n, v, c in top for x in (n, _n(v) + '%')]))
    E.append(('2026-10-29_reel_8.png', [C['shift']]))
    E.append(('2026-10-29_reel_9.png', [C['periods_note'], C['section'], C['url'], 'Ссылка в профиле']))
    F = J['fragments']['2026-10-31_q070_full']
    E.append(('2026-10-31_post_1.png', ['ИЗ СВОЕГО ВРЕМЕНИ', 'Спрашивает Гари', 'Париж, 1980', J['voices'][F['qid']]['q'], 'ЧЕХОВ · Ялта, зима 1900', F['cover_quote']['text']]))
    return E
