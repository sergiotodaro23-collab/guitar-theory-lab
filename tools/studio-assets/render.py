#!/usr/bin/env python3
"""
Procedural renderer for the Studio look's materials and hardware.

Every bitmap the Studio layout uses is generated here from code: no photo,
stock texture or third-party asset is involved, so all of it is original and
ships under the project's licence. Surfaces are height fields shaded with a
single light from the upper left (Lambert diffuse, Blinn-Phong specular,
optional anisotropy for brushed and spun metal), the same light the CSS
shadows use. Output is WebP at 2x for high-density screens.

    python3 tools/studio-assets/render.py            # writes src/ui/studio/assets/
    python3 tools/studio-assets/render.py --preview  # also writes a contact sheet

Deterministic: fixed seeds, so a re-run gives byte-identical files.
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[2] / 'src' / 'ui' / 'studio' / 'assets'
LIGHT = np.array([-0.45, -0.62, 0.65])  # upper left, towards the viewer
LIGHT = LIGHT / np.linalg.norm(LIGHT)


# ---------------------------------------------------------------- noise ----

def value_noise(h: int, w: int, cells_y: int, cells_x: int, rng: np.random.Generator, tile: bool = True) -> np.ndarray:
    """Smooth noise in [0, 1]; tileable when `tile` (the grid wraps)."""
    grid = rng.random((cells_y, cells_x)).astype(np.float32)
    if tile:
        big = np.tile(grid, (3, 3))
        img = Image.fromarray(big).resize((w * 3, h * 3), Image.BICUBIC)
        arr = np.asarray(img)[h:2 * h, w:2 * w]
    else:
        arr = np.asarray(Image.fromarray(grid).resize((w, h), Image.BICUBIC))
    return np.clip(arr, 0, 1)


def fbm(h: int, w: int, base: int, octaves: int, rng: np.random.Generator, gain: float = 0.5, aspect: float = 1.0, tile: bool = True) -> np.ndarray:
    total = np.zeros((h, w), np.float32)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        cy = max(1, int(base * 2 ** o))
        cx = max(1, int(base * 2 ** o * aspect))
        total += amp * value_noise(h, w, cy, cx, rng, tile)
        norm += amp
        amp *= gain
    return total / norm


def streaks(h: int, w: int, rng: np.random.Generator, length: int = 96) -> np.ndarray:
    """Horizontal brushing: per-row noise stretched along x, tileable."""
    rows = rng.normal(0, 1, (h, max(2, w // length))).astype(np.float32)
    big = np.tile(rows, (1, 3))
    img = Image.fromarray(big).resize((w * 3, h), Image.BILINEAR)
    arr = np.asarray(img)[:, w:2 * w]
    return arr / (np.abs(arr).max() + 1e-6)


# -------------------------------------------------------------- shading ----

def normals(height: np.ndarray, strength: float) -> np.ndarray:
    gy, gx = np.gradient(height.astype(np.float32))
    n = np.dstack([-gx * strength, -gy * strength, np.ones_like(height)])
    return n / np.linalg.norm(n, axis=2, keepdims=True)


def shade(height: np.ndarray, albedo: np.ndarray, strength: float = 1.0, ambient: float = 0.35,
          spec: float = 0.35, power: float = 24.0, aniso: np.ndarray | None = None) -> np.ndarray:
    n = normals(height, strength)
    diff = np.clip((n * LIGHT).sum(axis=2), 0, 1)
    half = LIGHT + np.array([0, 0, 1.0])
    half = half / np.linalg.norm(half)
    hl = np.clip((n * half).sum(axis=2), 0, 1) ** power
    if aniso is not None:
        hl = hl * 0.35 + aniso
    lit = albedo * (ambient + (1 - ambient) * diff[..., None]) + spec * hl[..., None]
    return np.clip(lit, 0, 1)


def rgb(hex_color: str) -> np.ndarray:
    hex_color = hex_color.lstrip('#')
    return np.array([int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


def ramp(t: np.ndarray, stops: list[tuple[float, str]]) -> np.ndarray:
    t = np.clip(t, 0, 1)
    out = np.zeros(t.shape + (3,), np.float32)
    xs = [s[0] for s in stops]
    cols = np.stack([rgb(s[1]) for s in stops])
    for c in range(3):
        out[..., c] = np.interp(t, xs, cols[:, c])
    return out


def save(name: str, color: np.ndarray, alpha: np.ndarray | None = None, quality: int = 84) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    data = (np.clip(color, 0, 1) * 255 + 0.5).astype(np.uint8)
    if alpha is not None:
        a = (np.clip(alpha, 0, 1) * 255 + 0.5).astype(np.uint8)
        img = Image.fromarray(np.dstack([data, a]), 'RGBA')
    else:
        img = Image.fromarray(data, 'RGB')
    path = OUT / f'{name}.webp'
    img.save(path, 'WEBP', quality=quality, method=6)
    return path


def grid(h: int, w: int) -> tuple[np.ndarray, np.ndarray]:
    return np.mgrid[0:h, 0:w].astype(np.float32)


def rounded_rect_sdf(h: int, w: int, x0: float, y0: float, x1: float, y1: float, r: float) -> np.ndarray:
    """Signed distance in pixels to a rounded rectangle: negative inside."""
    y, x = grid(h, w)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    hx, hy = (x1 - x0) / 2 - r, (y1 - y0) / 2 - r
    qx, qy = np.abs(x - cx) - hx, np.abs(y - cy) - hy
    outside = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0))
    inside = np.minimum(np.maximum(qx, qy), 0)
    return outside + inside - r


def smooth(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)


def blur(arr: np.ndarray, radius: float) -> np.ndarray:
    """Separable Gaussian blur on a float array, edges clamped."""
    sigma = max(radius, 1e-3)
    k = int(math.ceil(sigma * 3))
    t = np.arange(-k, k + 1, dtype=np.float32)
    kern = np.exp(-(t ** 2) / (2 * sigma ** 2))
    kern /= kern.sum()
    out = arr.astype(np.float32)
    for axis in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[axis] = (k, k)
        padded = np.pad(out, pad, mode='edge')
        out = sum(kern[i] * np.take(padded, range(i, i + out.shape[axis]), axis=axis) for i in range(2 * k + 1))
    return out


def drop_shadow(alpha: np.ndarray, dx: int, dy: int, radius: float, opacity: float) -> np.ndarray:
    shifted = np.roll(np.roll(alpha, dy, axis=0), dx, axis=1)
    return blur(shifted, radius) * opacity


def over(top_rgb, top_a, bottom_rgb, bottom_a):
    out_a = top_a + bottom_a * (1 - top_a)
    out_rgb = (top_rgb * top_a[..., None] + bottom_rgb * (bottom_a * (1 - top_a))[..., None]) / np.maximum(out_a, 1e-6)[..., None]
    return out_rgb, out_a


# ------------------------------------------------------------ materials ----

def brushed_metal(name: str, w: int, h: int, base: str, seed: int, contrast: float = 0.09) -> None:
    rng = np.random.default_rng(seed)
    fine = streaks(h, w, rng, 160) * 0.55 + streaks(h, w, rng, 40) * 0.3 + streaks(h, w, rng, 12) * 0.15
    cloud = fbm(h, w, 2, 3, rng, aspect=2) - 0.5
    tone = 0.5 + fine * contrast + cloud * 0.05
    color = rgb(base)[None, None, :] * (0.78 + 0.44 * tone[..., None])
    grain = rng.normal(0, 0.012, (h, w, 1)).astype(np.float32)
    save(name, color + grain, quality=80)


def bench_wood(seed: int = 11) -> None:
    """Dark walnut planks the instrument sits on; tiles both ways."""
    w, h = 1024, 1024
    rng = np.random.default_rng(seed)
    y, x = grid(h, w)
    planks = 4
    ph = h / planks
    out = np.zeros((h, w, 3), np.float32)
    warp = fbm(h, w, 3, 5, rng, aspect=0.5) * 26
    fine = streaks(h, w, rng, 220) * 0.5 + streaks(h, w, rng, 60) * 0.5
    for p in range(planks):
        offset = rng.random() * 50
        band = (y - p * ph)
        rings = np.sin(band * 0.07 + warp * (0.5 + p * 0.12) + offset)
        rings = 0.5 + 0.5 * np.sign(rings) * np.abs(rings) ** 0.45
        t = 0.36 + 0.2 * rings + 0.2 * fine + (rng.random() - 0.5) * 0.14
        col = ramp(t, [(0, '#1b0f08'), (0.35, '#2e1a0e'), (0.6, '#4a2b16'), (1, '#6a4124')])
        mask = (y >= p * ph) & (y < (p + 1) * ph)
        out[mask] = col[mask]
        # Plank seam: a dark groove with a lit lower lip.
        seam = np.abs(y - p * ph)
        out *= (1 - 0.65 * np.exp(-(seam ** 2) / 3.0))[..., None]
        out += (0.05 * np.exp(-((y - p * ph - 2.5) ** 2) / 2.0))[..., None]
    height = fine * 0.6
    lit = shade(height, out, strength=1.4, ambient=0.75, spec=0.05, power=12)
    save('bench', lit, quality=78)


def maple_neck(seed: int = 21) -> None:
    """The neck's face: pale maple, long grain, a little flame. Stretched over the board rect."""
    w, h = 2480, 504
    rng = np.random.default_rng(seed)
    y, x = grid(h, w)
    warp = fbm(h, w, 2, 4, rng, aspect=4, tile=False) * 22
    grain = np.sin((y * 0.42 + warp) * 1.0)
    grain = 0.5 + 0.5 * np.sign(grain) * np.abs(grain) ** 0.35
    fine = streaks(h, w, rng, 260) * 0.6 + streaks(h, w, rng, 70) * 0.4
    flame = np.sin(x * 0.045 + fbm(h, w, 3, 3, rng, aspect=3, tile=False) * 6) * (fbm(h, w, 2, 2, rng, aspect=2, tile=False) - 0.35)
    t = 0.55 + 0.1 * grain + 0.1 * fine + 0.07 * flame + (fbm(h, w, 1, 3, rng, aspect=3, tile=False) - 0.5) * 0.18
    col = ramp(t, [(0, '#b98547'), (0.4, '#d9ad6c'), (0.65, '#ecc98d'), (1, '#f7e2b2')])
    # Lacquer: soft sheen across the width, darker edges where the neck rolls off.
    roll = 1 - 0.22 * (np.abs(y - h / 2) / (h / 2)) ** 3
    sheen = 0.06 * np.exp(-((y - h * 0.28) ** 2) / (2 * (h * 0.12) ** 2))
    lit = shade(fine * 0.5 + grain * 0.4, col, strength=0.9, ambient=0.8, spec=0.06, power=30)
    save('maple', lit * roll[..., None] + sheen[..., None], quality=82)


def paper(seed: int = 31) -> None:
    """Note-paper: ivory, short fibres, faint mottling. Tiles both ways."""
    w = h = 512
    rng = np.random.default_rng(seed)
    mottle = fbm(h, w, 3, 5, rng) - 0.5
    fibres = np.zeros((h, w), np.float32)
    img = Image.new('F', (w, h), 0)
    d = ImageDraw.Draw(img)
    for _ in range(1400):
        x0, y0 = rng.random() * w, rng.random() * h
        a = rng.random() * math.pi
        ln = 3 + rng.random() * 10
        d.line([(x0, y0), (x0 + ln * math.cos(a), y0 + ln * math.sin(a))], fill=float(rng.normal(0, 1)), width=1)
    fibres = blur(np.asarray(img), 0.6)
    fibres = fibres / (np.abs(fibres).max() + 1e-6)
    tooth = rng.normal(0, 1, (h, w)).astype(np.float32)
    tooth = blur(tooth, 0.7)
    height = mottle * 0.6 + fibres * 0.6 + tooth * 0.5
    t = 0.6 + mottle * 0.18 + fibres * 0.04
    col = ramp(t, [(0, '#e4d3a8'), (0.6, '#f3e6c3'), (1, '#fbf4dc')])
    save('paper', shade(height, col, strength=1.1, ambient=0.86, spec=0.0), quality=80)


# ------------------------------------------------------------- hardware ----

def knob(seed: int = 41) -> None:
    """A machined aluminium knob seen from the front: knurled skirt, spun cap, cast shadow. The pointer is drawn live."""
    s = 256
    rng = np.random.default_rng(seed)
    y, x = grid(s, s)
    c = s / 2 - 6
    dx, dy = x - c, y - c
    r = np.hypot(dx, dy)
    th = np.arctan2(dy, dx)
    R_SKIRT, R_CAP = 104, 80
    # Height: skirt with 48 ridges, a chamfer, the cap with a slight dome.
    skirt = (r <= R_SKIRT) * (0.55 + 0.05 * np.cos(th * 48) * smooth(R_CAP + 6, R_CAP + 12, r))
    skirt *= 1 - smooth(R_SKIRT - 6, R_SKIRT, r) * 0.6
    chamfer = np.clip((R_CAP + 8 - r) / 8, 0, 1) * 0.25
    cap = (r <= R_CAP) * (0.25 + 0.06 * (1 - (r / R_CAP) ** 2))
    spun = (r <= R_CAP) * np.sin(r * 2.2 + rng.random() * 3) * 0.004
    height = np.maximum(skirt, 0) + chamfer * (r > R_CAP - 1) + cap + spun
    height = blur(height * 60, 0.8) / 60
    # Spun-metal anisotropy: bright fans perpendicular to the light, fixed to the room, not the knob.
    light_angle = math.atan2(LIGHT[1], LIGHT[0])
    fan = np.abs(np.cos(th - light_angle - math.pi / 2)) ** 10
    aniso = (r <= R_CAP) * (0.22 * fan + 0.05 * fbm(s, s, 6, 2, rng))
    albedo = np.ones((s, s, 3), np.float32) * rgb('#a8adb3')
    albedo[r > R_CAP + 2] = rgb('#2a2c30')  # dark rubber skirt
    lit = shade(height * 40, albedo, strength=1.0, ambient=0.3, spec=0.25, power=40, aniso=aniso)
    alpha = smooth(R_SKIRT + 1.2, R_SKIRT - 0.8, r)
    shadow = drop_shadow(alpha, 6, 9, 9, 0.6)
    color, a = over(lit, alpha, np.zeros_like(lit), shadow)
    save('knob', color, a, quality=88)


def keycap(name: str, base: str, seed: int, glow: str | None = None) -> None:
    """Moulded key for a 9-slice border-image: 160 px, 40 px corners."""
    s, inset, rad = 160, 10, 22
    rng = np.random.default_rng(seed)
    d = rounded_rect_sdf(s, s, inset, inset - 2, s - inset, s - inset - 4, rad)
    alpha = smooth(0.8, -0.8, d)
    bevel = np.clip(-d / 9, 0, 1) ** 0.7
    texture = (fbm(s, s, 16, 2, rng) - 0.5) * 0.04
    height = bevel * 1.0 + texture
    albedo = np.ones((s, s, 3), np.float32) * rgb(base)
    if glow:
        # Back-lit translucent cap: brighter in the middle.
        y, x = grid(s, s)
        centre = np.exp(-(((x - s / 2) / 55) ** 2 + ((y - s / 2) / 40) ** 2))
        albedo = albedo * (0.8 + 0.4 * centre[..., None]) + rgb(glow) * 0.25 * centre[..., None]
    lit = shade(height * 6, albedo, strength=1.0, ambient=0.55, spec=0.18, power=18)
    rim = smooth(-1.5, 0.5, d) * 0.5
    lit = lit * (1 - rim[..., None])
    shadow = drop_shadow(alpha, 0, 5, 4, 0.55)
    color, a = over(lit, alpha, np.zeros_like(lit), shadow)
    save(name, color, a, quality=88)


def fader_cap(seed: int = 51) -> None:
    """Fader knob: grooved grip, white index line. 88 x 120 at 2x."""
    w, h = 88, 120
    rng = np.random.default_rng(seed)
    y, x = grid(h, w)
    d = rounded_rect_sdf(h, w, 8, 8, w - 8, h - 14, 6)
    alpha = smooth(0.8, -0.8, d)
    body = np.clip(-d / 6, 0, 1) ** 0.6
    grooves = 0.12 * (np.sin((y - 10) * 0.9) > 0.55) * (np.abs(y - (h - 6) / 2) > 7)
    height = body - grooves * (d < -4)
    albedo = ramp(0.5 + (fbm(h, w, 4, 2, rng) - 0.5) * 0.1 + 0 * x, [(0, '#3b3e43'), (1, '#55595f')])
    lit = shade(height * 8, albedo, strength=1.0, ambient=0.4, spec=0.3, power=26)
    index = (np.abs(y - (h - 6) / 2) < 2.2) & (d < -3)
    lit[index] = rgb('#f2f2ee')
    shadow = drop_shadow(alpha, 2, 7, 5, 0.65)
    color, a = over(lit, alpha, np.zeros_like(lit), shadow)
    save('fader-cap', color, a, quality=90)


def screw(seed: int = 61) -> None:
    s = 48
    y, x = grid(s, s)
    c = s / 2 - 1
    r = np.hypot(x - c, y - c)
    head = (r < 17) * (0.6 + 0.3 * np.sqrt(np.clip(1 - (r / 17) ** 2, 0, 1)))
    cross = ((np.abs(x - c) < 2.2) | (np.abs(y - c) < 2.2)) & (r < 11)
    height = blur(head - cross * 0.5, 0.6)
    albedo = np.ones((s, s, 3), np.float32) * rgb('#9fa3a8')
    lit = shade(height * 14, albedo, ambient=0.3, spec=0.4, power=30)
    alpha = smooth(17.6, 16.4, r)
    sink = smooth(21, 17, r) * 0.65  # countersink shadow ring
    color, a = over(lit, alpha, np.zeros_like(lit), sink)
    save('screw', color, a, quality=90)


def sticker(seed: int = 71) -> None:
    """
    The nameplate: a printed vinyl sticker on the chassis, worn a little. Olive
    ink, a cream print border, scuffs that show the white base, one lifted
    corner. The lettering is live text laid over it, so it stays sharp.
    """
    w, h = 880, 236
    rng = np.random.default_rng(seed)
    y, x = grid(h, w)
    edge_noise = (fbm(h, w, 6, 3, rng, tile=False) - 0.5) * 5
    d = rounded_rect_sdf(h, w, 14, 12, w - 18, h - 22, 14) + edge_noise
    # A torn corner, top right.
    tear = (x - (w - 18)) - (y - 12) + 44 + (fbm(h, w, 14, 2, rng, tile=False) - 0.5) * 14
    d = np.maximum(d, tear)
    alpha = smooth(0.9, -0.9, d)
    ink = ramp(fbm(h, w, 3, 4, rng, tile=False), [(0, '#3d4528'), (0.5, '#4a5432'), (1, '#57623b')])
    border = (d > -14) & (d < -9)
    ink[border] = rgb('#e9dfc2') * 0.94
    # Scuffs: the print rubbed off where hands touch, mostly near the edges.
    wear = fbm(h, w, 10, 4, rng, tile=False)
    near_edge = smooth(-40, -4, d)
    rubbed = smooth(0.7, 0.76, wear * 0.55 + near_edge * 0.4 + rng.random((h, w)).astype(np.float32) * 0.05)
    base = np.ones_like(ink) * rgb('#efe9da')
    col = ink * (1 - rubbed[..., None]) + base * rubbed[..., None]
    # Lifted corner, bottom left: lighter, with its own shadow below.
    lift = smooth(70, 0, (x - 14) + (h - 22 - y))
    height = fbm(h, w, 20, 2, rng, tile=False) * 0.02 + lift * 0.4 + rubbed * -0.03
    lit = shade(height * 30, col, strength=1.0, ambient=0.72, spec=0.1, power=14)
    lit = lit * (1 + 0.12 * lift[..., None])
    shadow = drop_shadow(alpha, 2, 4, 3, 0.5) + drop_shadow(alpha * lift, 5, 9, 6, 0.35)
    color, a = over(lit, alpha, np.zeros_like(lit), np.clip(shadow, 0, 0.8))
    save('sticker', color, a, quality=88)


def tape(seed: int = 81) -> None:
    """Masking tape strip with torn ends, translucent."""
    w, h = 200, 64
    rng = np.random.default_rng(seed)
    y, x = grid(h, w)
    jag_l = 10 + (value_noise(h, 1, 12, 1, rng, tile=False)[:, :1] - 0.5) * 12
    jag_r = w - 10 + (value_noise(h, 1, 12, 1, rng, tile=False)[:, :1] - 0.5) * 12
    inside = (x > jag_l) & (x < jag_r) & (y > 6) & (y < h - 6)
    alpha = blur(inside.astype(np.float32), 0.7) * 0.78
    tex = fbm(h, w, 8, 3, rng, tile=False)
    col = ramp(0.5 + (tex - 0.5) * 0.4 + streaks(h, w, rng, 30) * 0.05, [(0, '#d6c79c'), (1, '#efe3bf')])
    save('tape', col, alpha, quality=90)


def pin(seed: int = 91) -> None:
    """A red push-pin seen from above, with its shadow."""
    s = 64
    y, x = grid(s, s)
    c = 28
    r = np.hypot(x - c, y - c)
    dome = np.sqrt(np.clip(1 - (r / 16) ** 2, 0, 1))
    height = dome
    albedo = np.ones((s, s, 3), np.float32) * rgb('#b3261e')
    lit = shade(height * 16, albedo, ambient=0.3, spec=0.6, power=40)
    alpha = smooth(16.6, 15.4, r)
    shadow = drop_shadow(alpha, 7, 9, 4, 0.55)
    color, a = over(lit, alpha, np.zeros_like(lit), shadow)
    save('pin', color, a, quality=90)


def phone(seed: int = 101) -> None:
    """
    The tutor's phone, front view, 300 x 600 CSS px at 2x: a satin metal band,
    black glass, an earpiece slot and a camera. The screen and the three
    buttons under it are live elements placed in the transparent windows.
    """
    w, h = 600, 1200
    rng = np.random.default_rng(seed)
    y, x = grid(h, w)
    body = rounded_rect_sdf(h, w, 16, 12, w - 24, h - 28, 72)
    alpha = smooth(0.9, -0.9, body)
    band = smooth(-1, -14, body)  # 0 on the outer band, 1 inside
    bevel = np.clip(-body / 14, 0, 1) ** 0.5
    metal = rgb('#8b9097') * (0.85 + 0.3 * (fbm(h, w, 3, 3, rng, tile=False)[..., None] - 0.5))
    glass = np.ones((h, w, 3), np.float32) * rgb('#0b0c0e')
    albedo = metal * (1 - band[..., None]) + glass * band[..., None]
    height = bevel * 1.0 + band * 0.2
    lit = shade(height * 22, albedo, strength=1.0, ambient=0.4, spec=0.3, power=40)
    # Screen window and the button strip: fully transparent so live content shows through.
    screen = rounded_rect_sdf(h, w, 44, 120, w - 52, 1000, 10)
    keys = rounded_rect_sdf(h, w, 60, 1030, w - 68, 1130, 18)
    hole = np.minimum(screen, keys)
    alpha = alpha * smooth(-0.8, 0.8, hole)
    # Glass edge around the screen.
    lit = lit + (0.12 * np.exp(-((hole - 1.5) ** 2) / 2))[..., None]
    # Earpiece and camera.
    ear = rounded_rect_sdf(h, w, w / 2 - 54, 66, w / 2 + 46, 80, 7)
    lit[ear < 0] = rgb('#1c1e22')
    cam = np.hypot(x - (w / 2 + 92), y - 73)
    lit[cam < 10] = rgb('#151a26')
    lit[cam < 4] = rgb('#2b3b5c')
    # Side keys on the band.
    for (y0, y1) in ((260, 340), (360, 440)):
        side = rounded_rect_sdf(h, w, w - 28, y0, w - 16, y1, 4)
        alpha = np.maximum(alpha, smooth(0.8, -0.8, side))
        lit[side < 0] = rgb('#767b82')
    shadow = drop_shadow(alpha, 10, 16, 14, 0.6)
    color, a = over(lit, alpha, np.zeros_like(lit), shadow)
    save('phone', color, a, quality=86)


ASSETS = [
    lambda: brushed_metal('steel', 1024, 512, '#4b4f55', 1, contrast=0.3),
    lambda: brushed_metal('alu', 1024, 512, '#8e939a', 2, contrast=0.2),
    bench_wood, maple_neck, paper, knob,
    lambda: keycap('key', '#2f3237', 3),
    lambda: keycap('key-lit', '#e8771a', 4, glow='#ffb347'),
    fader_cap, screw, sticker, tape, pin, phone,
]


def contact_sheet() -> None:
    files = sorted(OUT.glob('*.webp'))
    thumbs = []
    for f in files:
        im = Image.open(f).convert('RGBA')
        im.thumbnail((360, 360))
        thumbs.append(im)
    sheet = Image.new('RGBA', (380 * 4, 380 * ((len(thumbs) + 3) // 4)), (120, 120, 120, 255))
    for i, im in enumerate(thumbs):
        sheet.alpha_composite(im, (380 * (i % 4) + 10, 380 * (i // 4) + 10))
    sheet.save(OUT.parent / 'contact-sheet.png')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', action='store_true')
    args = parser.parse_args()
    for make in ASSETS:
        make()
    if args.preview:
        contact_sheet()
    total = sum(f.stat().st_size for f in OUT.glob('*.webp'))
    print(f'{len(list(OUT.glob("*.webp")))} assets, {total / 1024:.0f} KiB in {OUT}')
