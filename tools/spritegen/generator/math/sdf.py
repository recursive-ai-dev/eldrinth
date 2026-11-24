#!/usr/bin/env python3
"""
2D signed distance functions and CSG.
=====================================

Hard-thresholded SDFs produce crisp pixel silhouettes with no anti-aliasing.
Distance-to-edge ``d`` is then reused as a *material coordinate* (guide §4.2):

    0.0 – 1.0   ink / outline
    1.0 – 2.0   rim / watercolor border
    2.0 +       fill, optionally lit by ∇d · L
"""

from __future__ import annotations

import math
from typing import Callable, Optional, Tuple

from .canvas import Canvas, TAG_BODY

SDF = Callable[[float, float], float]
RGB = Tuple[int, int, int]


def _clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else hi if v > hi else v


def sd_circle(px: float, py: float, cx: float, cy: float, r: float) -> float:
    return math.hypot(px - cx, py - cy) - r


def sd_box(px: float, py: float, cx: float, cy: float, hx: float, hy: float) -> float:
    dx = abs(px - cx) - hx
    dy = abs(py - cy) - hy
    ax, ay = max(dx, 0.0), max(dy, 0.0)
    return math.hypot(ax, ay) + min(max(dx, dy), 0.0)


def sd_round_box(
    px: float, py: float, cx: float, cy: float, hx: float, hy: float, r: float
) -> float:
    return sd_box(px, py, cx, cy, max(0.0, hx - r), max(0.0, hy - r)) - r


def sd_ellipse(px: float, py: float, cx: float, cy: float, rx: float, ry: float) -> float:
    """Cheap ellipse SDF (radial approximation, good enough at 32×32)."""
    rx = max(rx, 1e-6)
    ry = max(ry, 1e-6)
    qx = (px - cx) / rx
    qy = (py - cy) / ry
    return math.hypot(qx, qy) - 1.0


def sd_capsule(
    px: float, py: float, ax: float, ay: float, bx: float, by: float, r: float
) -> float:
    abx, aby = bx - ax, by - ay
    apx, apy = px - ax, py - ay
    denom = abx * abx + aby * aby
    t = 0.0 if denom == 0 else _clamp((apx * abx + apy * aby) / denom, 0.0, 1.0)
    return math.hypot(apx - abx * t, apy - aby * t) - r


def sd_triangle(
    px: float, py: float,
    ax: float, ay: float, bx: float, by: float, cx: float, cy: float,
) -> float:
    """Signed distance to a triangle (Inigo Quilez)."""
    def _edge(ex, ey, pxx, pyy, nx, ny):
        return (pxx - ex) * nx + (pyy - ey) * ny

    e0x, e0y = bx - ax, by - ay
    e1x, e1y = cx - bx, cy - by
    e2x, e2y = ax - cx, ay - cy
    v0x, v0y = px - ax, py - ay
    v1x, v1y = px - bx, py - by
    v2x, v2y = px - cx, py - cy

    def _dist_seg(vx, vy, ex, ey):
        t = _clamp((vx * ex + vy * ey) / (ex * ex + ey * ey + 1e-12), 0.0, 1.0)
        return math.hypot(vx - ex * t, vy - ey * t)

    d0 = _dist_seg(v0x, v0y, e0x, e0y)
    d1 = _dist_seg(v1x, v1y, e1x, e1y)
    d2 = _dist_seg(v2x, v2y, e2x, e2y)
    d = min(d0, d1, d2)
    s = e0x * e2y - e0y * e2x
    # winding via barycentric-ish edge tests
    c0 = e0x * v0y - e0y * v0x
    c1 = e1x * v1y - e1y * v1x
    c2 = e2x * v2y - e2y * v2x
    inside = (c0 >= 0 and c1 >= 0 and c2 >= 0) or (c0 <= 0 and c1 <= 0 and c2 <= 0)
    return -d if inside else d


def sd_hexagon(px: float, py: float, cx: float, cy: float, r: float) -> float:
    x = abs(px - cx)
    y = abs(py - cy)
    # regular hexagon, flat-top
    k = 0.86602540378  # sqrt(3)/2
    return max(x * 0.5 + y * k, x) - r


def sd_rhombus(px: float, py: float, cx: float, cy: float, hx: float, hy: float) -> float:
    x, y = abs(px - cx), abs(py - cy)
    return (x / max(hx, 1e-6) + y / max(hy, 1e-6)) - 1.0


def op_union(a: float, b: float) -> float:
    return a if a < b else b


def op_sub(a: float, b: float) -> float:
    """Subtract ``b`` from ``a`` (keep a, cut out b)."""
    return a if a > -b else -b


def op_intersect(a: float, b: float) -> float:
    return a if a > b else b


def op_smooth_union(a: float, b: float, k: float = 1.5) -> float:
    h = _clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return a * h + b * (1.0 - h) - k * h * (1.0 - h)


def op_onion(d: float, t: float) -> float:
    return abs(d) - t


def _shade(
    base: RGB,
    highlight: RGB,
    shadow: RGB,
    nx: float,
    ny: float,
    x: int = 0,
    y: int = 0,
    dither: bool = False,
    specular: Optional[RGB] = None,
) -> RGB:
    """3-band (or 4-band metallic + 2x2 dithered) Lambert from surface normal."""
    # light from top-left
    lambert = nx * -0.45 + ny * -0.70
    if specular is not None and lambert > 0.68:
        return specular
    if dither:
        bayer2 = 0.0 if ((x ^ y) & 1) == 0 else 1.0
        # subtle 2x2 Bayer checkerboard near band thresholds
        bayer_shift = (((x & 1) + 2 * (y & 1)) * 0.25 - 0.375) * 0.14
        lam = lambert + bayer_shift
    else:
        lam = lambert
    if lam > 0.26:
        return highlight
    if lam < -0.18:
        return shadow
    return base


def rasterize_sdf(
    canvas: Canvas,
    sdf: SDF,
    fill: RGB,
    highlight: Optional[RGB] = None,
    shadow: Optional[RGB] = None,
    tag: int = TAG_BODY,
    ink: Optional[RGB] = None,
    ink_width: float = 0.85,
    light: bool = True,
    bounds: Optional[Tuple[int, int, int, int]] = None,
    dither: bool = False,
    specular: Optional[RGB] = None,
) -> None:
    """Hard-threshold ``sdf < 0`` into ``canvas``, with optional 3-band lighting."""
    hi = highlight or fill
    sh = shadow or fill
    target = getattr(canvas, "_real", canvas)
    s = float(getattr(canvas, "_scale", 1.0))
    if bounds is not None:
        x0 = max(0, math.floor(bounds[0] * s))
        y0 = max(0, math.floor(bounds[1] * s))
        x1 = min(target.w, math.ceil(bounds[2] * s))
        y1 = min(target.h, math.ceil(bounds[3] * s))
    else:
        x0, y0, x1, y1 = 0, 0, target.w, target.h
    e = 0.6
    ink_t = ink_width / s
    for y in range(y0, y1):
        py = (y + 0.5) / s
        for x in range(x0, x1):
            px = (x + 0.5) / s
            d = sdf(px, py)
            if d >= 0.0:
                continue
            if ink is not None and d > -ink_t:
                target.set(x, y, ink, tag=tag)
                continue
            if light:
                nx = sdf(px + e, py) - sdf(px - e, py)
                ny = sdf(px, py + e) - sdf(px, py - e)
                nlen = math.hypot(nx, ny) or 1.0
                col = _shade(fill, hi, sh, nx / nlen, ny / nlen, x, y, dither=dither, specular=specular)
            else:
                col = fill
            target.set(x, y, col, tag=tag)


def rasterize_capsule(
    canvas: Canvas,
    ax: float, ay: float, bx: float, by: float, r: float,
    fill: RGB,
    highlight: Optional[RGB] = None,
    shadow: Optional[RGB] = None,
    tag: int = TAG_BODY,
    ink: Optional[RGB] = None,
    ink_width: float = 0.85,
    light: bool = True,
    dither: bool = False,
    specular: Optional[RGB] = None,
) -> None:
    """Tight-bounds fast capsule rasterizer."""
    pad = math.ceil(r + 2.0)
    bounds = (
        math.floor(min(ax, bx) - pad),
        math.floor(min(ay, by) - pad),
        math.ceil(max(ax, bx) + pad) + 1,
        math.ceil(max(ay, by) + pad) + 1,
    )
    rasterize_sdf(
        canvas,
        lambda px, py: sd_capsule(px, py, ax, ay, bx, by, r),
        fill, highlight, shadow, tag, ink=ink, ink_width=ink_width,
        light=light, bounds=bounds, dither=dither, specular=specular,
    )


def rasterize_ellipse(
    canvas: Canvas,
    cx: float, cy: float, rx: float, ry: float,
    fill: RGB,
    highlight: Optional[RGB] = None,
    shadow: Optional[RGB] = None,
    tag: int = TAG_BODY,
    ink: Optional[RGB] = None,
    ink_width: float = 0.85,
    light: bool = True,
    dither: bool = False,
    specular: Optional[RGB] = None,
) -> None:
    """Tight-bounds fast ellipse rasterizer."""
    m = min(rx, ry)
    bounds = (
        math.floor(cx - rx - 2.0),
        math.floor(cy - ry - 2.0),
        math.ceil(cx + rx + 2.0) + 1,
        math.ceil(cy + ry + 2.0) + 1,
    )
    rasterize_sdf(
        canvas,
        lambda px, py: sd_ellipse(px, py, cx, cy, rx, ry) * m,
        fill, highlight, shadow, tag, ink=ink, ink_width=ink_width,
        light=light, bounds=bounds, dither=dither, specular=specular,
    )


def rasterize_round_box(
    canvas: Canvas,
    cx: float, cy: float, hx: float, hy: float, r: float,
    fill: RGB,
    highlight: Optional[RGB] = None,
    shadow: Optional[RGB] = None,
    tag: int = TAG_BODY,
    ink: Optional[RGB] = None,
    ink_width: float = 0.85,
    light: bool = True,
    dither: bool = False,
    specular: Optional[RGB] = None,
) -> None:
    """Tight-bounds fast rounded-box rasterizer."""
    bounds = (
        math.floor(cx - hx - 2.0),
        math.floor(cy - hy - 2.0),
        math.ceil(cx + hx + 2.0) + 1,
        math.ceil(cy + hy + 2.0) + 1,
    )
    rasterize_sdf(
        canvas,
        lambda px, py: sd_round_box(px, py, cx, cy, hx, hy, r),
        fill, highlight, shadow, tag, ink=ink, ink_width=ink_width,
        light=light, bounds=bounds, dither=dither, specular=specular,
    )


def sdf_band_material(d: float) -> str:
    """Map unsigned distance to the ink/paper/watercolor bands of guide §4.2."""
    a = abs(d)
    if a < 0.10:
        return "ink"
    if a < 0.25:
        return "paper"
    if a < 0.30:
        return "watercolor_border"
    return "watercolor_fill"
