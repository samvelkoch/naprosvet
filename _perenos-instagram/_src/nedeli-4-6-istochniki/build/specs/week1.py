import json
Q1, Q2 = '2026-10-12_q091', '2026-10-16_q088'
def build(add, plan, DATA):
    for date, key in (('2026-10-12', Q1), ('2026-10-16', Q2)):
        add(f'{date}_stories_1.png', (1080, 1920), f"RENDER.storyQuestion({json.dumps(key)})", 'golosa', 'story')
        for i in range(3):
            add(f'{date}_stories_{i+2}.png', (1080, 1920), f"RENDER.storyAnswer({json.dumps(key)},{i})", 'golosa', 'story')
    for i, c in enumerate(['mifyCover', 'mifyDef', 'mifyBig', 'mifyChart', 'mifyEvidence'], 1):
        add(f'2026-10-13_post_{i}.png', (1080, 1350), f'RENDER.{c}()', 'np', 'cover' if i == 1 else 'post')
    add('2026-10-14_stories_1.png', (1080, 1920), 'RENDER.chekhovStory()', 'np', 'story')
    add('2026-10-15_reel_1_title.png', (1080, 1920), 'RENDER.reelTitle()', 'np', 'reel')
    for i, a in enumerate(['brodsky', 'chekhov', 'gary']):
        add(f'2026-10-15_reel_{i+2}_{a}.png', (1080, 1920), f'RENDER.reelBlock({i})', 'np', 'reel')
    add('2026-10-15_reel_5_end.png', (1080, 1920), 'RENDER.reelEnd()', 'np', 'reel')
    add('2026-10-15_reel_cover.png', (1080, 1920), 'RENDER.reelCover()', 'np', 'reel')
    for i, call in enumerate(['RENDER.postCover()', 'RENDER.postPersona("brodsky")', 'RENDER.postPersona("chekhov")',
                              'RENDER.postPersona("gary")', 'RENDER.postDisclaimer()'], 1):
        add(f'2026-10-17_post_{i}.png', (1080, 1350), call, 'golosa', 'cover' if i == 1 else 'post')
    for a in ['brodsky', 'chekhov', 'gary']:
        add(f'reel_assets/{a}_card.png', (640 + 180, (640 if a == 'chekhov' else 800) + 180),
            f'RENDER.cardAsset("{a}")', 'asset', None, transparent=True)

def _n(v): return str(v).replace('.', ',')
def expect(J):
    N = J['numbers']; M = N['brodsky_mify']; C = N['chekhov_gde']; P = J['personas']; E = []
    E.append(('2026-10-13_post_1.png', [M['claim'], M['verdict'].replace('✓', '').strip(), 'МИФ ИЛИ ФАКТ · БРОДСКИЙ', M['section'], M['url']]))
    E.append(('2026-10-13_post_2.png', list(M['definitions'].values()) + [e['line'] for e in M['examples']] + [e['src'] for e in M['examples']] + [e['rhythm'] for e in M['examples']]))
    E.append(('2026-10-13_post_3.png', [M['big_from'], M['big_to'], M['big_from_label'], M['big_to_label']]))
    E.append(('2026-10-13_post_4.png', [p['p'] for p in M['periods']] + [_n(p[k]) for p in M['periods'] for k in ('two',) if p[k] > 8] + [M['periods_three_note']] + [v[0] for v in M['periods_legend'].values()]))
    E.append(('2026-10-13_post_5.png', [M['evidence'], M['site_caveat'], M['url'], 'Ссылка в профиле']))
    f = lambda n: f'{n:,}'.replace(',', ' ')
    E.append(('2026-10-14_stories_1.png', [C['corpus'], C['url'], C['section'], 'Больше всего писем Чехов написал из Ялты'] + [x for c, n in C['answer'] for x in (c, f(n))]))
    for i, r in enumerate(N['reel_glavnoe']):
        E.append(([f for f in ('2026-10-15_reel_2_brodsky.png', '2026-10-15_reel_3_chekhov.png', '2026-10-15_reel_4_gary.png')][i], [r['name'], r['years'], r['big'], r['text']]))
    E.append(('2026-10-15_reel_1_title.png', [N['site_tagline']]))
    for i, a in enumerate(['brodsky', 'chekhov', 'gary'], 2):
        p = P[a]; E.append((f'2026-10-17_post_{i}.png', [p['name'], p['years'], p['where'], p['when'], 'ему ' + p['age'], p['manner']] + p['sources']))
    E.append(('2026-10-17_post_5.png', [P['_disclaimer_site']])); E.append(('2026-10-17_post_1.png', [P['_project']]))
    return E
