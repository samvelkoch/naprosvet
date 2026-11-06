def build(add, plan, DATA):
    K = '2026-11-09_q111'
    add('2026-11-09_stories_1.png', (1080, 1920), f'RENDER.storyQuestion("{K}")', 'golosa', 'story')
    for i in range(3):
        add(f'2026-11-09_stories_{i+2}.png', (1080, 1920), f'RENDER.storyAnswer("{K}",{i})', 'golosa', 'story')
    add('2026-11-11_stories_1.png', (1080, 1920), 'RENDER.sBars("chekhov_dengi")', 'np', 'story')
    k = 'brodsky_venecia'
    calls = [f'rnTitle("{k}")', f'rnImage("{k}",0)', f'rnList("{k}",0)', f'rnList("{k}",1)', f'rnList("{k}",2)', f'rnFields("{k}")', f'rnFinal("{k}")']
    for i, c in enumerate(calls, 1):
        add(f'2026-11-12_reel_{i}.png', (1080, 1920), f'RENDER.{c}', 'np', None)
    add('2026-11-12_reel_cover.png', (1080, 1920), f'RENDER.rnTitle("{k}")', 'np', None)
    for i in range(5):
        add(f'2026-11-13_stories_{i+1}.png', (1080, 1920), f'RENDER.zenFrame("zen_modes",{i})', 'golosa', None)
