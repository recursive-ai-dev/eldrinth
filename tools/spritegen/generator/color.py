#!/usr/bin/env python3
"""
Color Math & Palettes
=====================

Colors are treated as 3-vectors in a linear-ish RGB space and are produced
*mathematically* from HSL/HSV hues plus deterministic interpolation and
lighting.  Shed Dev Sprites does not rely on a random RGB picker for shading: every
shade, highlight, shadow and tint is a defined function of a base color.

The palette stores only a few *baseline* colors; all variants (skin tones,
hair colors, clothing shades, eye colors, outline colors...) are derived from
those baselines by deterministic angular/lightness operations.  That keeps a
generation fully parametric and reproducible.
"""

from __future__ import annotations

import colorsys
from typing import Tuple, List, Union

RGB = Tuple[int, int, int]
RGBA = Tuple[int, int, int, int]


# ---------------------------------------------------------------------------
# Conversion helpers
# ---------------------------------------------------------------------------

def clamp8(v: float) -> int:
    return int(max(0, min(255, v)))


def rgb_to_hsl(rgb: RGB) -> Tuple[float, float, float]:
    """Return ``(hue, saturation, lightness)`` with hue in [0, 1).

    Note: ``colorsys.rgb_to_hls`` returns ``(h, l, s)``; we reorder so our own
    API is consistently ``(h, s, l)``.
    """
    r, g, b = (c / 255.0 for c in rgb)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return (h, s, l)


def hsl_to_rgb(h: float, s: float, l: float) -> RGB:
    """Convert ``(hue, saturation, lightness)`` (hue in [0, 1)) to RGB.

    ``colorsys.hls_to_rgb`` expects ``(h, l, s)``, so we swap back here.
    """
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return (clamp8(r * 255), clamp8(g * 255), clamp8(b * 255))


def rgb_to_hsv(rgb: RGB) -> Tuple[float, float, float]:
    r, g, b = (c / 255.0 for c in rgb)
    return colorsys.rgb_to_hsv(r, g, b)


def hsv_to_rgb(h: float, s: float, v: float) -> RGB:
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    return (clamp8(r * 255), clamp8(g * 255), clamp8(b * 255))


# ---------------------------------------------------------------------------
# Color vector math
# ---------------------------------------------------------------------------

def mix(c1: RGB, c2: RGB, t: float) -> RGB:
    """Linear interpolation between two RGB colors."""
    t = max(0.0, min(1.0, t))
    return (
        clamp8(c1[0] + (c2[0] - c1[0]) * t),
        clamp8(c1[1] + (c2[1] - c1[1]) * t),
        clamp8(c1[2] + (c2[2] - c1[2]) * t),
    )


def shade(color: RGB, factor: float) -> RGB:
    """Multiply brightness by ``factor`` (1.0 = unchanged, <1 darker, >1 lighter)."""
    return (
        clamp8(color[0] * factor),
        clamp8(color[1] * factor),
        clamp8(color[2] * factor),
    )


def lighten(color: RGB, amount: float) -> RGB:
    """Boost saturation-preserving lightness by mixing toward white."""
    return mix(color, (255, 255, 255), amount)


def darken(color: RGB, amount: float) -> RGB:
    """Mix toward black."""
    return mix(color, (0, 0, 0), amount)


def with_alpha(color: RGB, alpha: int = 255) -> RGBA:
    return (color[0], color[1], color[2], alpha)


def tint_hue(color: RGB, hue_shift: float, amount: float = 1.0) -> RGB:
    """Shift a color's hue by ``hue_shift`` cycles and mix by ``amount``."""
    h, s, l = rgb_to_hsl(color)
    h = (h + hue_shift) % 1.0
    shifted = hsl_to_rgb(h, s, l)
    return mix(color, shifted, amount)


def saturation_boost(color: RGB, amount: float) -> RGB:
    h, s, l = rgb_to_hsl(color)
    return hsl_to_rgb(h, max(0.0, min(1.0, s * amount)), l)


def hex_to_rgb(hex_str: str) -> RGB:
    hex_str = hex_str.lstrip("#")
    return (int(hex_str[0:2], 16), int(hex_str[2:4], 16), int(hex_str[4:6], 16))


def rgb_to_hex(rgb: RGB) -> str:
    return "#{:02x}{:02x}{:02x}".format(rgb[0], rgb[1], rgb[2])


def perceptual_luminance(rgb: RGB) -> float:
    """Rec.709 relative luminance (0..1)."""
    r, g, b = (c / 255.0 for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


# ---------------------------------------------------------------------------
# Palette construction
# ---------------------------------------------------------------------------

def skin_ramp(center_hue: float, n_steps: int = 12) -> List[RGB]:
    """Mathematically build a smooth range of skin tones around a hue.

    ``center_hue`` is a baseline; saturation and lightness are spread across
    the ramp so we get pale, tan, and deep tones of one ethnicity.  Calling this
    with several center hues — 0.05 (sun-warmed), 0.09 (tan/olive), 0.11
    (brown), 0.02 (red-brown), 0.13 (deep) — covers a broad, realistic span of
    human skin without any hand-drawn RGB tuples.
    """
    tones = []
    for i in range(n_steps):
        t = i / max(1, n_steps - 1)
        # lightness climbs from a very light value down to a deep value.
        # Real skin spans an enormous lightness range, so we let it fall to
        # ~0.18 (deep brown) while keeping mid tones plausible.
        l = 0.74 - 0.56 * t
        # slight saturation drift deeper as lightness falls (less "plastic")
        s = 0.34 + 0.22 * t + (0.05 if center_hue < 0.05 else 0.0)
        h = center_hue + (0.02 if i % 3 == 0 else 0.0)
        tones.append(hsl_to_rgb(h % 1.0, min(1.0, s), min(1.0, l)))
    return tones


def hair_ramp() -> List[RGB]:
    """Baseline hair colors: near-black, browns, reds, greys, silver, fantasy."""
    bases = [
        ("black",    24, 0.06),   # near black, low lightness
        ("dark_brown", 36, 0.13),
        ("brown",    34, 0.20),
        ("chestnut", 30, 0.30),
        ("auburn",   22, 0.34),
        ("copper",   18, 0.42),
        ("ginger",   16, 0.52),
        ("blonde",   42, 0.60),
        ("ash_blonde", 48, 0.62),
        ("grey",     50, 0.45),   # low saturation is what reads as grey
        ("silver",   50, 0.72),
        ("white",    50, 0.86),
        ("raven",    235, 0.10),  # subtle blue-black
        ("moss",     90, 0.22),   # fantasy green
        ("violet",   280, 0.24),  # fantasy purple
        ("cyan",     190, 0.42),  # fantasy teal
    ]
    return [hsl_to_rgb(h/360, 0.30 + (0.30 if l > 0.35 else 0.0), l*0.85 + 0.10) for _name, h, l in bases]


def eye_colors() -> List[RGB]:
    bases = [
        ("brown", 30), ("dark_brown", 22), ("hazel", 34),
        ("amber", 40), ("green", 100), ("teal", 160),
        ("blue", 210), ("grey", 210), ("violet", 275),
    ]
    return [hsl_to_rgb(h/360, 0.42, 0.46 + (0.18 if h == 210 else 0.0)) for _name, h in bases]


def clothing_palette() -> List[RGB]:
    """A rich but cohesive set of garment colors (natural + a few fantasy)."""
    hues = [0, 20, 40, 90, 140, 180, 210, 230, 260, 280, 320, 350]
    colors = []
    for h in hues:
        for l in (0.22, 0.36, 0.52, 0.68):
            colors.append(hsl_to_rgb(h/360, 0.38, l))
    # plus some muted, desaturated "workwear" colors
    colors += [
        hsl_to_rgb(0.08, 0.12, 0.42),
        hsl_to_rgb(0.6, 0.08, 0.50),
        hsl_to_rgb(0.02, 0.20, 0.30),
        hsl_to_rgb(0.5, 0.14, 0.44),
    ]
    return colors


def skin_tones() -> List[RGB]:
    """The full, mathematically-built skin ramp.

    Center hues are chosen to represent families of human skin color, then each
    family is spread over 12 steps (light -> deep).  Together they span pale
    European through deep African tones plus tan, olive, and warm browns.
    """
    hues = [0.045, 0.075, 0.095, 0.06, 0.11, 0.03]
    tones: List[RGB] = []
    for hue in hues:
        tones.extend(skin_ramp(hue, 6))
    # dedupe while preserving order
    seen = set()
    out = []
    for t in tones:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def accent_ramp() -> List[RGB]:
    """Bright accessory / gemstone / highlight colors."""
    return [
        hsl_to_rgb(0.0, 0.85, 0.55),   # red
        hsl_to_rgb(0.14, 0.85, 0.55),  # orange
        hsl_to_rgb(0.16, 0.85, 0.50),  # gold
        hsl_to_rgb(0.33, 0.85, 0.50),  # green
        hsl_to_rgb(0.5, 0.85, 0.55),   # cyan
        hsl_to_rgb(0.62, 0.85, 0.55),  # blue
        hsl_to_rgb(0.78, 0.85, 0.60),  # violet
        hsl_to_rgb(0.92, 0.85, 0.55),  # magenta
        hsl_to_rgb(0.53, 0.30, 0.85),  # pale silver
    ]
