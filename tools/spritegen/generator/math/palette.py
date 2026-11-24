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

import colorsys
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
    # pale → deep human skin (warm). Monotonic in t: t=0 is the palest tone,
    # t=1 the deepest. (The old ramp looped and never got lighter than a tan.)
    "skin": (
        (0.508, 0.470, 0.410),
        (0.462, 0.370, 0.330),
        (0.38, 0.50, 0.50),
        (0.00, 0.00, 0.00),
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
    # Dark-fantasy, horror, and regional palettes
    "grim_steel": (
        (0.38, 0.40, 0.43), (0.18, 0.18, 0.20),
        (1.00, 1.00, 1.00), (0.00, 0.05, 0.12),
    ),
    "wraith_ash": (
        (0.30, 0.34, 0.32), (0.16, 0.18, 0.17),
        (0.80, 0.85, 0.80), (0.10, 0.15, 0.20),
    ),
    "rusted_stone": (
        (0.40, 0.30, 0.22), (0.20, 0.14, 0.10),
        (0.90, 0.80, 0.70), (0.00, 0.08, 0.18),
    ),
    "cult_blood": (
        (0.32, 0.08, 0.10), (0.22, 0.06, 0.08),
        (1.00, 0.60, 0.60), (0.00, 0.35, 0.40),
    ),
    "corrupted_flesh": (
        (0.34, 0.26, 0.30), (0.20, 0.14, 0.18),
        (0.85, 0.70, 0.90), (0.05, 0.30, 0.55),
    ),
    "bone_relic": (
        (0.62, 0.58, 0.48), (0.20, 0.18, 0.16),
        (0.70, 0.70, 0.60), (0.02, 0.06, 0.10),
    ),
    "sickly_green": (
        (0.28, 0.34, 0.18), (0.16, 0.20, 0.10),
        (0.80, 0.90, 0.70), (0.10, 0.05, 0.25),
    ),
    "black_water": (
        (0.06, 0.10, 0.16), (0.04, 0.06, 0.10),
        (0.60, 0.70, 0.90), (0.30, 0.35, 0.45),
    ),
    "spire_anima": (
        (0.38, 0.76, 0.75), (0.22, 0.20, 0.20),
        (1.00, 1.00, 0.90), (0.10, 0.22, 0.35),
    ),
    "volcanic_ember": (
        (0.55, 0.22, 0.08), (0.40, 0.18, 0.06),
        (1.00, 0.80, 0.40), (0.00, 0.10, 0.20),
    ),
    "sacred_gold": (
        (0.65, 0.55, 0.32), (0.25, 0.20, 0.12),
        (0.90, 0.85, 0.70), (0.05, 0.10, 0.20),
    ),
}


def named_palette(name: str, t: float) -> RGB:
    if name not in PALETTES:
        raise KeyError(name)
    a, b, c, d = PALETTES[name]
    return cosine_palette(t, a, b, c, d)


def _lerp_hue(h1: float, h2: float, amt: float) -> float:
    """Shortest-arc circular hue interpolation in [0, 1)."""
    diff = (h2 - h1 + 0.5) % 1.0 - 0.5
    return (h1 + diff * amt) % 1.0


def _hls_to_rgb8(h: float, l: float, s: float) -> RGB:
    r, g, b = colorsys.hls_to_rgb(h % 1.0, max(0.0, min(1.0, l)), max(0.0, min(1.0, s)))
    return (_clamp8(r * 255.0), _clamp8(g * 255.0), _clamp8(b * 255.0))


def shade_triplet(
    base: RGB,
    hi: float = 0.28,
    sh: float = 0.32,
    hue_shift: bool = True,
) -> Tuple[RGB, RGB, RGB]:
    """Highlight / base / shadow from one colour with pixel-art hue shifting.

    Highlights shift subtly toward sunlit warm gold; shadows shift cooler
    toward deep slate/indigo with slightly richer saturation so surfaces read
    like hand-pixeled palettes instead of flat linear brightness ramps.
    """
    if not hue_shift:
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

    h, l, s = colorsys.rgb_to_hls(base[0] / 255.0, base[1] / 255.0, base[2] / 255.0)
    # Warm highlight: nudge hue subtly toward golden yellow (0.13)
    if s < 0.08:
        hi_h = 0.12
        hi_s = min(0.18, s + 0.06)
    else:
        hi_h = _lerp_hue(h, 0.13, 0.14)
        hi_s = max(0.0, min(1.0, s * 0.90))
    hi_l = min(0.97, l + (1.0 - l) * (hi * 0.88))
    highlight = _hls_to_rgb8(hi_h, hi_l, hi_s)

    # Cool shadow: keep warm skin/amber hues natural (shift toward warm umber/terracotta
    # instead of wrapping through hot magenta); cool/neutral hues shift toward indigo.
    if s < 0.08:
        sh_h = 0.63
        sh_s = min(0.22, s + 0.10)
    elif h < 0.15 or h > 0.90:
        sh_h = _lerp_hue(h, 0.98, 0.12)
        sh_s = min(0.90, s * 1.04 + 0.02)
    else:
        sh_h = _lerp_hue(h, 0.68, 0.14)
        sh_s = min(1.0, s * 1.08 + 0.03)
    sh_l = max(0.04, l * (1.0 - sh * 1.02))
    shadow = _hls_to_rgb8(sh_h, sh_l, sh_s)

    return highlight, base, shadow


def shade_metal_ramp(base: RGB) -> Tuple[RGB, RGB, RGB, RGB]:
    """High-contrast 4-step metallic ramp: (specular, highlight, base, shadow)."""
    hi, mid, sh = shade_triplet(base, hi=0.38, sh=0.45, hue_shift=True)
    spec = (
        _clamp8(hi[0] + (255 - hi[0]) * 0.65),
        _clamp8(hi[1] + (255 - hi[1]) * 0.65),
        _clamp8(hi[2] + (248 - hi[2]) * 0.60),
    )
    return spec, hi, mid, sh


def material_outline_color(
    rgb: RGB,
    ink_bias: RGB = (16, 13, 24),
    darken_amt: float = 0.56,
    lit: bool = False,
) -> RGB:
    """Compute a hue-shifted selective-outline (sel-out) color for a pixel."""
    h, l, s = colorsys.rgb_to_hls(rgb[0] / 255.0, rgb[1] / 255.0, rgb[2] / 255.0)
    if s < 0.06:
        sh_h = 0.66
    elif h < 0.15 or h > 0.90:
        sh_h = _lerp_hue(h, 0.98, 0.14)
    else:
        sh_h = _lerp_hue(h, 0.70, 0.16)
    amt = darken_amt * (0.72 if lit else 1.0)
    sh_l = max(0.05, l * (1.0 - amt))
    sh_s = min(0.80, s * 1.06 + 0.06)
    dark = _hls_to_rgb8(sh_h, sh_l, sh_s)
    mix_t = 0.28 if lit else 0.48
    return (
        _clamp8(dark[0] * (1.0 - mix_t) + ink_bias[0] * mix_t),
        _clamp8(dark[1] * (1.0 - mix_t) + ink_bias[1] * mix_t),
        _clamp8(dark[2] * (1.0 - mix_t) + ink_bias[2] * mix_t),
    )


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
    return snap_canvas_to_palette(canvas, pal)


# ---------------------------------------------------------------------------
# Curated Studio Master Palettes (CIELAB-snappable for cohesive game worlds)
# ---------------------------------------------------------------------------

MASTER_PALETTES: Dict[str, Tuple[RGB, ...]] = {
    "pico8": (
        (0, 0, 0), (29, 43, 83), (126, 37, 83), (0, 135, 81),
        (171, 82, 54), (95, 87, 79), (194, 195, 199), (255, 241, 232),
        (255, 0, 77), (255, 163, 0), (255, 236, 39), (0, 228, 54),
        (41, 173, 255), (131, 118, 156), (255, 119, 168), (255, 204, 170),
    ),
    "sweetie16": (
        (26, 28, 44), (93, 39, 93), (177, 62, 83), (239, 125, 87),
        (255, 205, 117), (167, 240, 112), (56, 183, 100), (37, 113, 121),
        (41, 54, 111), (59, 93, 201), (65, 166, 246), (115, 239, 247),
        (244, 244, 244), (148, 176, 194), (86, 108, 134), (51, 60, 87),
    ),
    "endesga32": (
        (190, 74, 47), (215, 118, 67), (234, 212, 170), (228, 166, 114),
        (184, 111, 80), (115, 62, 57), (62, 39, 49), (162, 38, 51),
        (228, 59, 68), (247, 118, 34), (254, 174, 52), (254, 231, 97),
        (99, 199, 77), (62, 137, 72), (38, 92, 66), (25, 60, 62),
        (18, 78, 137), (0, 149, 233), (44, 232, 245), (255, 255, 255),
        (192, 203, 220), (139, 155, 180), (90, 105, 136), (58, 68, 102),
        (38, 43, 68), (24, 20, 37), (255, 0, 68), (104, 56, 108),
        (181, 80, 136), (246, 117, 122), (232, 183, 150), (194, 133, 105),
    ),
    "gameboy": (
        (15, 56, 15), (48, 98, 48), (139, 172, 15), (155, 188, 15),
    ),
    "slso8": (
        (13, 43, 69), (32, 60, 86), (84, 78, 104), (141, 105, 122),
        (208, 129, 89), (255, 170, 94), (255, 212, 163), (255, 236, 214),
    ),
}


def _resolve_palette(palette: Sequence[RGB] | str) -> Tuple[RGB, ...]:
    if isinstance(palette, str):
        key = palette.lower().strip()
        if key not in MASTER_PALETTES:
            raise KeyError(f"Unknown master palette {palette!r}. Known: {sorted(MASTER_PALETTES)}")
        return MASTER_PALETTES[key]
    return tuple(palette)


def _make_lab_mapper(pal: Tuple[RGB, ...]):
    pal_lab = [rgb_to_lab(c) for c in pal]
    cache: Dict[RGB, RGB] = {}

    def map_rgb(rgb: RGB) -> RGB:
        mapped = cache.get(rgb)
        if mapped is None:
            L1, a1, b1 = rgb_to_lab(rgb)
            best_idx = 0
            best_d = 1e18
            for idx, (L2, a2, b2) in enumerate(pal_lab):
                d = (L2 - L1) ** 2 + (a2 - a1) ** 2 + (b2 - b1) ** 2
                if d < best_d:
                    best_d = d
                    best_idx = idx
            mapped = pal[best_idx]
            cache[rgb] = mapped
        return mapped

    return map_rgb


def snap_canvas_to_palette(canvas: Canvas, palette: Sequence[RGB] | str) -> Canvas:
    """Snap every opaque pixel on ``canvas`` to the nearest CIELAB colour in ``palette``."""
    pal = _resolve_palette(palette)
    if not pal:
        return canvas.clone()
    map_rgb = _make_lab_mapper(pal)
    out = canvas.clone()
    for i, p in enumerate(out.px):
        if p[3] > 0:
            r, g, b = map_rgb((p[0], p[1], p[2]))
            out.px[i] = (r, g, b, 255)
    return out


def snap_pil_to_palette(image, palette: Sequence[RGB] | str):
    """Snap non-transparent pixels on an RGBA PIL image to ``palette`` (preserving alpha)."""
    pal = _resolve_palette(palette)
    if not pal:
        return image.copy()
    map_rgb = _make_lab_mapper(pal)
    rgba = image.convert("RGBA")
    data = list(rgba.getdata())
    out = []
    for r, g, b, a in data:
        if a > 0:
            nr, ng, nb = map_rgb((r, g, b))
            out.append((nr, ng, nb, a))
        else:
            out.append((0, 0, 0, 0))
    rgba.putdata(out)
    return rgba
