#!/usr/bin/env python3
"""
Builds the tutor's pixel-art sprite: an original long-haired guitarist, 32x40
pixels, drawn from shapes and outlined like a 90s portrait sprite. Writes
src/tutor/sprite.ts (palette-indexed rows plus per-expression overrides) and,
with --preview, a scaled PNG for review.

    python3 tools/tutor-sprite/build.py [--preview out.png]
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

W, H = 32, 40
OUT = Path(__file__).resolve().parents[2] / 'src' / 'tutor' / 'sprite.ts'

PALETTE = {
    'k': '#1a120d',  # outline
    'h': '#4a2c18',  # hair
    'H': '#7a4b27',  # hair highlight
    'd': '#2e1b0f',  # hair shadow
    's': '#e9b88f',  # skin
    'S': '#c48a63',  # skin shade
    'w': '#f4efe6',  # eye white
    'p': '#2a3a55',  # pupil
    'm': '#8c3a2e',  # mouth
    't': '#2f6a8f',  # shirt
    'T': '#214d69',  # shirt shade
    'g': '#e08a2c',  # guitar top
    'G': '#a8561a',  # guitar edge
    'n': '#6b4325',  # neck
    'f': '#d9d4c7',  # fret dots / strings
    'c': '#cfd3d8',  # hardware
    'b': '#2b2b2b',  # pickguard / headstock face
}


def blank():
    return [['.'] * W for _ in range(H)]


def put(g, x, y, c):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < W and 0 <= y < H:
        g[y][x] = c


def ellipse(g, cx, cy, rx, ry, c, only=None):
    for y in range(H):
        for x in range(W):
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 and (only is None or only(x, y)):
                g[y][x] = c


def rect(g, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(g, x, y, c)


def line(g, x0, y0, x1, y1, c, width=1):
    steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for i in range(steps + 1):
        t = i / steps
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        for dx in range(width):
            for dy in range(width):
                put(g, x + dx - width // 2, y + dy - width // 2, c)


def outline(g):
    out = [row[:] for row in g]
    for y in range(H):
        for x in range(W):
            if g[y][x] != '.':
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and g[ny][nx] not in '.k':
                    out[y][x] = 'k'
                    break
    return out


def build():
    g = blank()
    # Long hair behind: crown and two falls past the shoulders.
    ellipse(g, 16, 11, 8.6, 9.2, 'h')
    rect(g, 7, 11, 11, 25, 'h')
    rect(g, 20, 11, 24, 25, 'h')
    for y in range(22, 27):  # ragged ends
        for x in range(7, 25):
            if g[y][x] == 'h' and (x + y) % 3 == 0 and y > 23:
                g[y][x] = '.'
    # Shirt and shoulders.
    for y in range(19, H):
        spread = min(12.5, 6 + math.sqrt(y - 18) * 3.4)
        for x in range(W):
            if abs(x + 0.5 - 16) <= spread:
                g[y][x] = 'T' if x + 0.5 - 16 > spread - 3 else 't'
    # Neck and face.
    rect(g, 13, 15, 18, 19, 'S')
    ellipse(g, 16, 11.4, 5.3, 6.3, 's')
    ellipse(g, 16, 11.4, 5.3, 6.3, 'S', only=lambda x, y: x >= 20)
    # Front hair: fringe swept to one side, locks over the shoulders.
    for x in range(10, 23):
        depth = 7 + (1 if x < 14 else 0) - (1 if x > 18 else 0) + (1 if x in (12, 15, 19) else 0)
        for y in range(3, depth):
            if g[y][x] in 'sS':
                g[y][x] = 'h'
    rect(g, 9, 9, 10, 24, 'h')
    rect(g, 21, 9, 22, 24, 'h')
    for (x, y) in ((11, 7), (11, 8), (20, 7), (20, 8)):
        put(g, x, y, 'h')
    # Hair light from the upper left, shadow on the right.
    for (x0, y0, x1, y1) in ((11, 3, 15, 3), (9, 5, 12, 5), (8, 8, 8, 18), (13, 4, 14, 4)):
        line(g, x0, y0, x1, y1, 'H')
    line(g, 23, 10, 23, 23, 'd')
    line(g, 22, 18, 22, 24, 'd')
    # Arms in sleeves, then the guitar across the body.
    line(g, 6.5, 21, 9, 29, 't', 3)
    line(g, 25.5, 21, 24, 24, 'T', 3)
    ellipse(g, 9.5, 33.5, 6.2, 5.2, 'g')
    ellipse(g, 12.5, 28.5, 4.6, 4.0, 'g')
    ellipse(g, 9.5, 33.5, 6.2, 5.2, 'G', only=lambda x, y: ((x + 0.5 - 9.5) / 6.2) ** 2 + ((y + 0.5 - 33.5) / 5.2) ** 2 > 0.62 and (x > 9 or y > 35))
    rect(g, 7, 33, 11, 34, 'b')  # pickguard and bridge
    put(g, 12, 31, 'c')
    put(g, 13, 30, 'c')
    line(g, 14, 27, 28, 15, 'n', 2)
    for i in range(1, 5):  # fret dots along the neck
        t = i / 5
        put(g, 14 + 14 * t, 27 - 12 * t, 'f')
    rect(g, 28, 13, 29, 15, 'n')  # headstock with two tuners
    put(g, 27, 13, 'c')
    put(g, 30, 14, 'c')
    # Hands: picking hand on the body, fretting hand on the neck.
    rect(g, 10, 29, 12, 31, 's')
    put(g, 12, 31, 'S')
    rect(g, 22, 19, 24, 21, 's')
    put(g, 24, 21, 'S')
    g = outline(g)
    # Eyebrows and nose stay in every expression.
    for (x, y) in ((12, 9), (13, 9), (18, 9), (19, 9)):
        put(g, x, y, 'h')
    put(g, 16, 13, 'S')
    return g


EYES_OPEN = [(12, 11, 'w'), (13, 11, 'p'), (18, 11, 'w'), (19, 11, 'p')]
EYES_CLOSED = [(12, 11, 'k'), (13, 11, 'k'), (18, 11, 'k'), (19, 11, 'k')]
EXPRESSIONS = {
    'idle': EYES_OPEN + [(15, 15, 'm'), (16, 15, 'm'), (17, 15, 'm')],
    'blink': EYES_CLOSED + [(15, 15, 'm'), (16, 15, 'm'), (17, 15, 'm')],
    'talk': EYES_OPEN + [(15, 15, 'm'), (16, 15, 'k'), (17, 15, 'm'), (16, 16, 'm')],
    'happy': [(12, 11, 'k'), (13, 10, 'k'), (18, 10, 'k'), (19, 11, 'k'), (14, 14, 'm'), (15, 15, 'm'), (16, 15, 'm'), (17, 15, 'm'), (18, 14, 'm')],
    'think': [(12, 11, 'w'), (13, 10, 'p'), (18, 11, 'w'), (19, 10, 'p'), (16, 15, 'm'), (17, 15, 'm'), (13, 8, 'h'), (12, 8, 'h')],
    'oops': [(12, 11, 'p'), (13, 11, 'p'), (18, 11, 'p'), (19, 11, 'p'), (12, 10, 'w'), (19, 10, 'w'), (16, 15, 'k'), (16, 16, 'm')],
}


def write_ts(g):
    rows = [''.join(r) for r in g]
    lines = [
        '/* Generated by tools/tutor-sprite/build.py — do not edit by hand. */',
        '/** Original pixel-art tutor: a long-haired guitarist, 32 x 40, palette-indexed. */',
        f'export const SPRITE_WIDTH = {W};',
        f'export const SPRITE_HEIGHT = {H};',
        'export const PALETTE: Readonly<Record<string, string>> = {',
        *[f"  {k}: '{v}'," for k, v in PALETTE.items()],
        '};',
        '/** Base frame; "." is transparent. */',
        'export const BASE: readonly string[] = [',
        *[f"  '{r}'," for r in rows],
        '];',
        "export type Expression = " + ' | '.join(f"'{e}'" for e in EXPRESSIONS) + ';',
        '/** Pixels each expression redraws over the base: [x, y, colour key]. */',
        'export const EXPRESSIONS: Readonly<Record<Expression, readonly (readonly [number, number, string])[]>> = {',
    ]
    for name, px in EXPRESSIONS.items():
        lines.append(f'  {name}: [' + ', '.join(f"[{x}, {y}, '{c}']" for x, y, c in px) + '],')
    lines.append('};')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text('\n'.join(lines) + '\n')


def preview(g, path):
    from PIL import Image
    scale = 8
    frames = list(EXPRESSIONS.items())
    img = Image.new('RGB', (W * scale * len(frames), H * scale), (200, 214, 190))
    for i, (_, px) in enumerate(frames):
        grid = [r[:] for r in g]
        for x, y, c in px:
            grid[y][x] = c
        for y in range(H):
            for x in range(W):
                c = grid[y][x]
                if c == '.':
                    continue
                col = tuple(int(PALETTE[c][j:j + 2], 16) for j in (1, 3, 5))
                for yy in range(scale):
                    for xx in range(scale):
                        img.putpixel((i * W * scale + x * scale + xx, y * scale + yy), col)
    img.save(path)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview')
    a = ap.parse_args()
    sprite = build()
    write_ts(sprite)
    if a.preview:
        preview(sprite, a.preview)
