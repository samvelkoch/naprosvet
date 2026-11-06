from week2 import full_slides
def build(add, plan, DATA):
    K = '2026-11-16_q132'
    add('2026-11-16_stories_1.png', (1080, 1920), f'RENDER.storyQuestion("{K}")', 'golosa', 'story')
    for i in range(3):
        add(f'2026-11-16_stories_{i+2}.png', (1080, 1920), f'RENDER.storyAnswer("{K}",{i})', 'golosa', 'story')
    k = 'gary_dva'
    for i, (c, reg) in enumerate([(f'nCover("{k}")', 'cover'), (f'nPair("{k}",0)', 'post'), (f'nPair("{k}",1)', 'post'), (f'nPair("{k}",2)', 'post'), (f'nFinal("{k}")', 'post')], 1):
        add(f'2026-11-17_post_{i}.png', (1080, 1350), f'RENDER.{c}', 'np', reg)
    add('2026-11-18_stories_1.png', (1080, 1920), 'RENDER.sBars("brodsky_napitki")', 'np', 'story')
    for i in range(2):
        add(f'2026-11-19_reel_{i+1}.png', (1080, 1920), f'RENDER.zenFrame("zen_light",{i})', 'golosa', None)
    add('2026-11-19_reel_3.png', (1080, 1920), 'RENDER.rgFinal3()', 'golosa', 'reel')
    add('2026-11-20_stories_1.png', (1080, 1920), 'RENDER.sCards("chekhov_pets")', 'np', 'story')
    F = '2026-11-21_q012_full'
    add('2026-11-21_post_1.png', (1080, 1350), f'RENDER.fCover("{F}","Анкета Чехова")', 'golosa', 'cover')
    i, pl = full_slides(add, plan, F, '2026-11-21', 2, None)
    add(f'2026-11-21_post_{i}.png', (1080, 1350), 'RENDER.fFinal3()', 'golosa', 'post')
    print('  week6 F:', pl, i)
