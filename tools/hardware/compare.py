#!/usr/bin/env python3
"""
Side-by-side sheets from two sets of tools/hardware/shots.mjs screenshots.

    python tools/hardware/compare.py <shotsDir> <outDir> [before] [after]

For every viewport: the amp module before and after (default state, knobs
turned, switched off), cropped to the amplifier head. Needs Pillow.
"""
import os
import sys

from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
a, b = (sys.argv[3], sys.argv[4]) if len(sys.argv) > 4 else ('before', 'after')
os.makedirs(out, exist_ok=True)
CROP_H = 500  # device pixels from the top of the module: title bar and the head
for viewport in ('1440x900', '1280x720', '1024x768'):
    rows = []
    for state in ('amp', 'amp-turned', 'amp-off'):
        pair = [Image.open(os.path.join(src, f'{label}-{state}-{viewport}.png')).convert('RGB') for label in (a, b)]
        pair = [p.crop((0, 0, p.width, min(p.height, CROP_H))) for p in pair]
        rows.append(pair)
    w = max(p.width for row in rows for p in row)
    h = max(p.height for row in rows for p in row)
    sheet = Image.new('RGB', (w * 2 + 36, (h + 12) * len(rows) + 40), (18, 16, 14))
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 12), f'{a}  ·  {viewport}', fill=(230, 220, 200))
    draw.text((w + 24, 12), f'{b}  ·  {viewport}', fill=(230, 220, 200))
    for r, pair in enumerate(rows):
        for c, p in enumerate(pair):
            sheet.paste(p, (12 + c * (w + 12), 40 + r * (h + 12)))
    path = os.path.join(out, f'amp-{a}-{b}-{viewport}.webp')
    sheet.save(path, 'WEBP', quality=86, method=6)
    print(path, sheet.size, os.path.getsize(path))
