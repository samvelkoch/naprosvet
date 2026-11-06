import json
from week2 import full_slides
def build(add, plan, DATA):
    K = '2026-11-02_q090'
    add('2026-11-02_stories_1.png', (1080, 1920), f'RENDER.storyQuestion("{K}")', 'golosa', 'story')
    for i in range(3):
        add(f'2026-11-02_stories_{i+2}.png', (1080, 1920), f'RENDER.storyAnswer("{K}",{i})', 'golosa', 'story')
    k = 'chekhov_kunst'
    for i, (c, reg) in enumerate([(f'nCover("{k}")', 'cover'), (f'nBars("{k}",0)', 'post'), (f'nList("{k}",0)', 'post'), (f'nList("{k}",1)', 'post'), (f'nFinal("{k}")', 'post')], 1):
        add(f'2026-11-03_post_{i}.png', (1080, 1350), f'RENDER.{c}', 'np', reg)
    add('2026-11-04_stories_1.png', (1080, 1920), 'RENDER.sBars("brodsky_transport")', 'np', 'story')
    R = '2026-11-05_reel_q080'
    add('2026-11-05_reel_1.png', (1080, 1920), f'RENDER.rgQ3("{R}")', 'golosa', 'reel')
    add('2026-11-05_reel_2.png', (1080, 1920), f'RENDER.rgAuthor("{R}",0)', 'golosa', 'reel')
    add('2026-11-05_reel_3.png', (1080, 1920), f'RENDER.rgAuthor("{R}b",0)', 'golosa', 'reel')
    add('2026-11-05_reel_4.png', (1080, 1920), 'RENDER.rgFinal3()', 'golosa', 'reel')
    add('2026-11-05_reel_cover.png', (1080, 1920), f'RENDER.rgCover3("{R}")', 'golosa', 'reel')
    add('2026-11-06_stories_1.png', (1080, 1920), 'RENDER.sBars("gary_panteon")', 'np', 'story')
    F = '2026-11-07_q044_full'
    add('2026-11-07_post_1.png', (1080, 1350), f'RENDER.fCover("{F}","Анкета Бродского")', 'golosa', 'cover')
    i, pl = full_slides(add, plan, F, '2026-11-07', 2, None)
    add(f'2026-11-07_post_{i}.png', (1080, 1350), 'RENDER.fFinal3()', 'golosa', 'post')
    assert i <= 10, i
    print('  week4 F:', pl, i)
