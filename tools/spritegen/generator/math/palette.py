#!/usr/bin/env python3
"""
Cosine palettes, CIELAB, ΔE and Median-Cut quantization.
=========================================================

Guide §4.4 replaces HSL ramps with the GLSL cosine palette

    a + b * cos(2π * (c * t + d))

and guide §6.1 requires perceptual distances in CIELAB (ΔE Euclidean) plus
a clustering quantizer (Median Cut) so neural/procedural gradients collapse
to a crisp pixel-art palette.
"""

from __future__ import annotations

import math
from typing import Dict, List, Sequence, Tuple

from .canvas import Canvas, RGBA

RGB = Tuple[int, int, int]
Vec3 = Tuple[float, float, float]

_TWO_PI = 6.283185307179586


def _clamp8(v: float) -> int:
    if v < 0:
        return 0
    if v > 255:
        return 255
    return int(v + 0.5)


def cosine_palette(t: float, a: Vec3, b: Vec3, c: Vec3, d: Vec3) -> RGB:
    """``vec3 palette(t, a, b, c, d)`` — Inigo Quilez / guide §4.4."""
    t = 0.0 if t < 0.0 else 1.0 if t > 1.0 else t
    rgb = []
    for i in range(3):
        v = a[i] + b[i] * math.cos(_TWO_PI * (c[i] * t + d[i]))
        rgb.append(_clamp8(v * 255.0))
    return (rgb[0], rgb[1], rgb[2])


# Named cosine palettes (a, b, c, d).  Tuned for 32×32 game sprites.
PALETTES: Dict[str, Tuple[Vec3, Vec3, Vec3, Vec3]] = {
    # pale → deep human skin (warm)
    "skin": (
        (0.48, 0.32, 0.24),
        (0.32, 0.22, 0.16),
        (1.00, 0.85, 0.70),
        (0.00, 0.05, 0.10),
    ),
    "hair": (
        (0.28, 0.20, 0.14),
        (0.28, 0.22, 0.16),
        (1.00, 0.90, 0.70),
        (0.15, 0.10, 0.05),
    ),
    "cloth": (
        (0.45, 0.40, 0.50),
        (0.35, 0.30, 0.35),
        (1.00, 1.00, 1.00),
        (0.00, 0.33, 0.67),
    ),
    "metal": (
        (0.55, 0.55, 0.58),
        (0.25, 0.25, 0.22),
        (1.00, 1.00, 0.80),
        (0.00, 0.05, 0.20),
    ),
    "grass": (
        (0.20, 0.45, 0.18),
        (0.12, 0.22, 0.10),
        (1.00, 1.20, 1.00),
        (0.10, 0.20, 0.30),
    ),
    "dirt": (
        (0.42, 0.30, 0.18),
        (0.18, 0.12, 0.08),
        (1.00, 0.90, 0.70),
        (0.05, 0.10, 0.00),
    ),
    "stone": (
        (0.45, 0.46, 0.48),
        (0.12, 0.12, 0.14),
        (1.00, 1.00, 1.00),
        (0.00, 0.05, 0.10),
    ),
    "water": (
        (0.15, 0.35, 0.55),
        (0.10, 0.20, 0.25),
        (1.00, 1.20, 1.40),
        (0.20, 0.30, 0.40),
    ),
    "sand": (
        (0.72, 0.62, 0.40),
        (0.12, 0.10, 0.08),
        (1.00, 0.90, 0.70),
        (0.00, 0.05, 0.10),
    ),
    "lava": (
        (0.70, 0.25, 0.08),
        (0.30, 0.25, 0.05),
        (1.40, 1.00, 0.60),
        (0.00, 0.15, 0.30),
    ),
    "snow": (
        (0.86, 0.90, 0.94),
        (0.08, 0.06, 0.06),
        (1.00, 1.00, 1.00),
        (0.00, 0.10, 0.20),
    ),
    "wood": (
        (0.42, 0.28, 0.16),
        (0.16, 0.10, 0.06),
        (1.00, 0.90, 0.70),
        (0.10, 0.05, 0.00),
    ),
    "magic": (
        (0.45, 0.30, 0.65),
        (0.35, 0.25, 0.30),
        (1.20, 1.00, 0.80),
        (0.00, 0.33, 0.67),
    ),
    "blood": (
        (0.45, 0.10, 0.10),
        (0.30, 0.08, 0.05),
        (1.00, 0.80, 0.60),
        (0.00, 0.10, 0.20),
    ),
    "slime": (
        (0.25, 0.55, 0.22),
        (0.20, 0.25, 0.10),
        (1.10, 1.00, 0.80),
        (0.15, 0.25, 0.05),
    ),
}


def named_palette(name: str, t: float) -> RGB:
    if name not in PALETTES:
        raise KeyError(name)
    a, b, c, d = PALETTES[name]
    return cosine_palette(t, a, b, c, d)


def shade_triplet(base: RGB, hi: float = 0.28, sh: float = 0.32) -> Tuple[RGB, RGB, RGB]:
    """Highlight / base / shadow from one cosine colour."""
    highlight = (
        _clamp8(base[0] + (255 - base[0]) * hi),
        _clamp8(base[1] + (255 - base[1]) * hi),
        _clamp8(base[2] + (255 - base[2]) * hi),
    )
    shadow = (
        _clamp8(base[0] * (1.0 - sh)),
        _clamp8(base[1] * (1.0 - sh)),
        _clamp8(base[2] * (1.0 - sh)),
    )
    return highlight, base, shadow


# ---------------------------------------------------------------------------
# CIELAB / ΔE  (D65, sRGB)
# ---------------------------------------------------------------------------

def _srgb_to_linear(u: float) -> float:
    u = u / 255.0
    return u / 12.92 if u <= 0.04045 else ((u + 0.055) / 1.055) ** 2.4


def _linear_to_srgb(u: float) -> float:
    u = 0.0 if u < 0.0 else u
    return 12.92 * u if u <= 0.0031308 else 1.055 * (u ** (1.0 / 2.4)) - 0.055


def rgb_to_xyz(rgb: RGB) -> Vec3:
    r, g, b = (_srgb_to_linear(rgb[0]), _srgb_to_linear(rgb[1]), _srgb_to_linear(rgb[2]))
    x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041
    return (x, y, z)


def _f_lab(t: float) -> float:
    d = 6.0 / 29.0
    return t ** (1.0 / 3.0) if t > d ** 3 else t / (3 * d * d) + 4.0 / 29.0


def rgb_to_lab(rgb: RGB) -> Vec3:
    x, y, z = rgb_to_xyz(rgb)
    # D65 white
    xn, yn, zn = 0.95047, 1.00000, 1.08883
    fx, fy, fz = _f_lab(x / xn), _f_lab(y / yn), _f_lab(z / zn)
    L = 116.0 * fy - 16.0
    a = 500.0 * (fx - fy)
    b = 200.0 * (fy - fz)
    return (L, a, b)


def lab_to_rgb(lab: Vec3) -> RGB:
    L, a, b = lab
    fy = (L + 16.0) / 116.0
    fx = a / 500.0 + fy
    fz = fy - b / 200.0
    d = 6.0 / 29.0

    def _finv(t: float) -> float:
        return t ** 3 if t > d else 3 * d * d * (t - 4.0 / 29.0)

    xn, yn, zn = 0.95047, 1.00000, 1.08883
    x, y, z = xn * _finv(fx), yn * _finv(fy), zn * _finv(fz)
    r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314
    g = x * -0.9692660 + y * 1.8760108 + z * 0.0415560
    b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252
    return (
        _clamp8(_linear_to_srgb(r) * 255.0),
        _clamp8(_linear_to_srgb(g) * 255.0),
        _clamp8(_linear_to_srgb(b) * 255.0),
    )


def delta_e(c1: RGB, c2: RGB) -> float:
    """CIE76 ΔE — Euclidean distance in Lab (guide §6.1)."""
    L1, a1, b1 = rgb_to_lab(c1)
    L2, a2, b2 = rgb_to_lab(c2)
    return math.sqrt((L2 - L1) ** 2 + (a2 - a1) ** 2 + (b2 - b1) ** 2)


# ---------------------------------------------------------------------------
# Median Cut
# ---------------------------------------------------------------------------

def median_cut(colors: Sequence[RGB], n: int = 16) -> List[RGB]:
    """Cluster ``colors`` into ``n`` palette entries via Median Cut."""
    if not colors:
        return [(0, 0, 0)]
    unique = list(set(colors))
    if len(unique) <= n:
        return unique

    boxes: List[List[RGB]] = [list(unique)]
    while len(boxes) < n:
        boxes.sort(key=len, reverse=True)
        box = boxes.pop(0)
        if len(box) < 2:
            boxes.append(box)
            break
        ranges = [
            max(c[ch] for c in box) - min(c[ch] for c in box)
            for ch in range(3)
        ]
        ch = ranges.index(max(ranges))
        box.sort(key=lambda c: c[ch])
        mid = len(box) // 2
        boxes.append(box[:mid])
        boxes.append(box[mid:])

    palette = []
    for box in boxes:
        if not box:
            continue
        r = sum(c[0] for c in box) // len(box)
        g = sum(c[1] for c in box) // len(box)
        b = sum(c[2] for c in box) // len(box)
        palette.append((r, g, b))
    return palette


def nearest_lab(color: RGB, palette: Sequence[RGB]) -> RGB:
    best = palette[0]
    best_d = 1e18
    for p in palette:
        d = delta_e(color, p)
        if d < best_d:
            best_d = d
            best = p
    return best


def quantize_canvas(canvas: Canvas, n: int = 16) -> Canvas:
    """Map every opaque pixel to an n-colour CIELAB palette (guide §6.1)."""
    colors = [(p[0], p[1], p[2]) for p in canvas.px if p[3] > 0]
    pal = median_cut(colors, n=max(2, n))
    out = canvas.clone()
    cache = {}
    for i, p in enumerate(out.px):
        if p[3] <= 0:
            continue
        key = (p[0], p[1], p[2])
        if key not in cache:
            cache[key] = nearest_lab(key, pal)
        r, g, b = cache[key]
        out.px[i] = (r, g, b, 255)
    return out
