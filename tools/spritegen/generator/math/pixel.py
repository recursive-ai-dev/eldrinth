#!/usr/bin/env python3
"""
Pixel-perfect post-process: L-corners, EPX/Scale2x, CoG alignment.
==================================================================

Raw SDF / CA output still carries 'double' diagonal pixels and unaligned
mass.  This module is the production gate (guide §6):

* prune L-shape corners so every stroke is 1 px wide
* EPX/Scale2x integer upscale with no blur
* centre-of-gravity alignment so animation frames don't jitter
"""

from __future__ import annotations

from typing import List, Optional, Tuple

from .canvas import Canvas, TAG_OUTLINE, TRANSPARENT

RGB = Tuple[int, int, int]


def bresenham(x0: int, y0: int, x1: int, y1: int) -> List[Tuple[int, int]]:
    """Integer Bresenham line (inclusive)."""
    pts = []
    dx = abs(x1 - x0)
    dy = -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    x, y = x0, y0
    while True:
        pts.append((x, y))
        if x == x1 and y == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x += sx
        if e2 <= dx:
            err += dx
            y += sy
    return pts


def pixel_line(canvas: Canvas, x0: int, y0: int, x1: int, y1: int, color, tag=None) -> None:
    for x, y in bresenham(int(x0), int(y0), int(x1), int(y1)):
        canvas.set(x, y, color, tag)


def prune_l_corners(canvas: Canvas) -> Canvas:
    """Remove the middle pixel of every L-shaped 2-wide diagonal (guide §6.2).

    Pattern (and its 4 rotations / mirrors)::

        .X      X.      XX      XX
        XX  →   .X      X.      .X     (drop the corner)
    """
    w, h = canvas.w, canvas.h
    drop = []
    for y in range(h):
        for x in range(w):
            if not canvas.opaque(x, y):
                continue
            # 4 L-corners: the pixel is the 'elbow'
            # neighbours: N E S W
            n = canvas.opaque(x, y - 1)
            e = canvas.opaque(x + 1, y)
            s = canvas.opaque(x, y + 1)
            ww = canvas.opaque(x - 1, y)
            ne = canvas.opaque(x + 1, y - 1)
            nw = canvas.opaque(x - 1, y - 1)
            se = canvas.opaque(x + 1, y + 1)
            sw = canvas.opaque(x - 1, y + 1)
            orth = int(n) + int(e) + int(s) + int(ww)
            # classic 2-orthogonal L with empty diagonal interior
            if orth != 2:
                continue
            # NE elbow
            if n and e and not ne and not s and not ww:
                drop.append((x, y))
            # NW elbow
            elif n and ww and not nw and not s and not e:
                drop.append((x, y))
            # SE elbow
            elif s and e and not se and not n and not ww:
                drop.append((x, y))
            # SW elbow
            elif s and ww and not sw and not n and not e:
                drop.append((x, y))
    out = canvas.clone()
    for x, y in drop:
        out.clear_px(x, y)
    return out


def recover_double_pixels(canvas: Canvas) -> Canvas:
    """Alias of :func:`prune_l_corners` (guide naming)."""
    return prune_l_corners(canvas)


def inward_outline(canvas: Canvas, color: RGB, tag: int = TAG_OUTLINE) -> Canvas:
    """Replace silhouette-edge pixels with ``color`` (does not fatten the sprite).

    Thin 1–2 px features (every pixel is an 'edge') are left alone so the
    outline pass cannot eat limbs, bowstrings or tentacles.  A pixel is only
    recolored when it has a transparent neighbour *and* a neighbouring
    interior pixel (an opaque cell with ≥ 3 opaque cardinal neighbours).
    """
    def n_orth(x, y) -> int:
        return (
            int(canvas.opaque(x - 1, y))
            + int(canvas.opaque(x + 1, y))
            + int(canvas.opaque(x, y - 1))
            + int(canvas.opaque(x, y + 1))
        )

    interior = set()
    for y in range(canvas.h):
        for x in range(canvas.w):
            if canvas.opaque(x, y) and n_orth(x, y) >= 3:
                interior.add((x, y))

    edges = []
    for y in range(canvas.h):
        for x in range(canvas.w):
            if not canvas.opaque(x, y):
                continue
            if n_orth(x, y) == 4:
                continue
            # must be backed by an interior pixel so we don't devour thin strokes
            backed = (
                (x - 1, y) in interior or (x + 1, y) in interior
                or (x, y - 1) in interior or (x, y + 1) in interior
                or (x, y) in interior
            )
            if backed:
                edges.append((x, y))
    out = canvas.clone()
    for x, y in edges:
        out.set(x, y, color, tag=tag)
    return out


def cog_align(canvas: Canvas, target: Optional[Tuple[float, float]] = None) -> Canvas:
    """Translate the sprite so its mass sits on a standardised grid point.

    Default target is the canvas centre.  Shift is integer, so the operation
    is lossless and fully deterministic (guide §6.4).
    """
    if target is None:
        target = ((canvas.w - 1) / 2.0, (canvas.h - 1) * 0.55)
    cx, cy = canvas.center_of_gravity()
    dx = int(round(target[0] - cx))
    dy = int(round(target[1] - cy))
    if dx == 0 and dy == 0:
        return canvas.clone()
    out = Canvas(canvas.w, canvas.h)
    for y in range(canvas.h):
        for x in range(canvas.w):
            if canvas.opaque(x, y):
                out.set(x + dx, y + dy, canvas.get(x, y), canvas.get_tag(x, y))
    return out


def scale2x(canvas: Canvas) -> Canvas:
    """EPX / Scale2x (guide §6.3).

    For pixel ``P`` with cardinal neighbours A (top), C (left), B (right),
    D (bottom), the four sub-pixels are::

        1 = A if (C == A and C != D and A != B) else P
        2 = B if (A == B and A != C and B != D) else P
        3 = C if (D == C and D != B and C != A) else P
        4 = D if (B == D and B != A and D != C) else P
    """
    w, h = canvas.w, canvas.h
    out = Canvas(w * 2, h * 2)

    def eq(x1, y1, x2, y2) -> bool:
        return canvas.get(x1, y1) == canvas.get(x2, y2)

    for y in range(h):
        for x in range(w):
            p = canvas.get(x, y)
            tag = canvas.get_tag(x, y)
            a = canvas.get(x, y - 1) if y > 0 else p
            d = canvas.get(x, y + 1) if y + 1 < h else p
            c = canvas.get(x - 1, y) if x > 0 else p
            b = canvas.get(x + 1, y) if x + 1 < w else p
            # sub-pixels
            p1 = a if (c == a and c != d and a != b) else p
            p2 = b if (a == b and a != c and b != d) else p
            p3 = c if (d == c and d != b and c != a) else p
            p4 = d if (b == d and b != a and d != c) else p
            ox, oy = x * 2, y * 2
            out.set(ox, oy, p1, tag)
            out.set(ox + 1, oy, p2, tag)
            out.set(ox, oy + 1, p3, tag)
            out.set(ox + 1, oy + 1, p4, tag)
    return out


def scale_nn(canvas: Canvas, factor: int) -> Canvas:
    """Nearest-neighbour integer scale (no EPX)."""
    if factor <= 1:
        return canvas.clone()
    out = Canvas(canvas.w * factor, canvas.h * factor)
    for y in range(canvas.h):
        for x in range(canvas.w):
            c = canvas.get(x, y)
            tag = canvas.get_tag(x, y)
            if c[3] <= 0:
                continue
            for dy in range(factor):
                for dx in range(factor):
                    out.set(x * factor + dx, y * factor + dy, c, tag)
    return out
