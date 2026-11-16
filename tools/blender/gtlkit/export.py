"""
From raw renders to the files the app ships: edge feathering, sprite strips,
WebP encoding, a manifest and a generated TypeScript module. Uses Pillow and
NumPy only, so it can be re-run without Blender on renders kept on disk.
"""
import hashlib
import json
import os

import numpy as np
from PIL import Image


def feather(img: Image.Image, width: int) -> Image.Image:
    """Fades the alpha to zero over the last `width` pixels of every edge: a shadow can never be cut by the picture's border."""
    if width <= 0:
        return img
    a = np.asarray(img.convert('RGBA')).astype(np.float32)
    h, w = a.shape[:2]
    ramp_x = np.minimum(1.0, np.minimum(np.arange(w), np.arange(w)[::-1]) / float(width))
    ramp_y = np.minimum(1.0, np.minimum(np.arange(h), np.arange(h)[::-1]) / float(width))
    a[..., 3] *= np.outer(ramp_y, ramp_x)
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


def vignette(img: Image.Image, inner: float, outer: float = 1.0) -> Image.Image:
    """
    Fades the alpha radially, from full at `inner` to zero at `outer` (fractions
    of half the picture's width). For small parts on a catcher: the faint
    shading the catcher takes everywhere would otherwise show as a square.
    """
    a = np.asarray(img.convert('RGBA')).astype(np.float32)
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot((xx - (w - 1) / 2) / (w / 2), (yy - (h - 1) / 2) / (h / 2))
    a[..., 3] *= np.clip((outer - r) / max(1e-6, outer - inner), 0.0, 1.0)
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


def strip(frames):
    """Frames side by side, left to right: one sprite strip."""
    w, h = frames[0].size
    out = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        out.paste(f, (i * w, 0))
    return out


def save_webp(img: Image.Image, path: str, quality: int = 90) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, 'WEBP', quality=quality, method=6, exact=False)


def describe(path: str, css_w: float, css_h: float, scale: int, use: str, **extra):
    data = open(path, 'rb').read()
    with Image.open(path) as im:
        px_size = list(im.size)
    return {
        'file': os.path.basename(path), 'px': px_size, 'css': [css_w, css_h], 'scale': scale,
        'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()[:16], 'use': use, **extra,
    }


def write_json(path: str, value) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf8') as f:
        json.dump(value, f, indent=2, ensure_ascii=False)
        f.write('\n')


def write_ts(path: str, name: str, value, header: str) -> None:
    """A TypeScript module exporting `value` as a constant: the app reads geometry from the same numbers Blender used."""
    body = json.dumps(value, indent=2, ensure_ascii=False)
    with open(path, 'w', encoding='utf8') as f:
        f.write(f'{header}\nexport const {name} = {body} as const;\n')
