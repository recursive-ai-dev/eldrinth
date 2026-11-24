#!/usr/bin/env python3
"""
Wang / blob autotiling, region-growing segmentation, tile schema.
=================================================================

Guide §3 replaces a trained ResNet18 adjacency classifier with an exact
4-bit (NES-style) and 8-bit (blob) bitmask.  A region-growing pass cuts a
large canvas into 16×16 / 32×32 units and labels them:

    Complete / Partial / Texture / Partial Texture
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from .canvas import Canvas, TAG_FLOOR, TAG_WALL
from .noise import fbm, paper_noise
from .palette import named_palette, shade_triplet

# schema labels (guide §3.2)
TILE_COMPLETE = "complete"
TILE_PARTIAL = "partial"
TILE_TEXTURE = "texture"
TILE_PARTIAL_TEXTURE = "partial_texture"

# 4-bit NES bitmask: N=1 E=2 S=4 W=8  (1 = neighbour is SAME terrain)
NBIT, EBIT, SBIT, WBIT = 1, 2, 4, 8
NEBIT, SEBIT, SWBIT, NWBIT = 16, 32, 64, 128


def canonical_blob_mask(mask: int) -> int:
    """Normalise an 8-bit neighbour bitmask to one of the 47 canonical Blob masks.

    A diagonal bit (NE/SE/SW/NW) is kept only when both adjacent cardinal
    neighbours (N/E/S/W) are also present.
    """
    m = int(mask) & (NBIT | EBIT | SBIT | WBIT)
    if (mask & NBIT) and (mask & EBIT) and (mask & NEBIT):
        m |= NEBIT
    if (mask & EBIT) and (mask & SBIT) and (mask & SEBIT):
        m |= SEBIT
    if (mask & SBIT) and (mask & WBIT) and (mask & SWBIT):
        m |= SWBIT
    if (mask & WBIT) and (mask & NBIT) and (mask & NWBIT):
        m |= NWBIT
    return m


BLOB_47_MASKS: Tuple[int, ...] = tuple(
    m for m in range(256) if canonical_blob_mask(m) == m
)


def neighbor_mask(grid: List[List[int]], x: int, y: int, eight: bool = False) -> int:
    """Return the Wang bitmask of cell ``(x, y)``.  ``grid`` is 1=terrain, 0=other."""
    h = len(grid)
    w = len(grid[0]) if h else 0
    if not (0 <= x < w and 0 <= y < h):
        return 0
    me = grid[y][x]

    def same(xx, yy) -> bool:
        if not (0 <= xx < w and 0 <= yy < h):
            return True  # out-of-bounds counts as same so edges don't over-outline
        return grid[yy][xx] == me

    m = 0
    if same(x, y - 1):
        m |= NBIT
    if same(x + 1, y):
        m |= EBIT
    if same(x, y + 1):
        m |= SBIT
    if same(x - 1, y):
        m |= WBIT
    if eight:
        if same(x + 1, y - 1):
            m |= NEBIT
        if same(x + 1, y + 1):
            m |= SEBIT
        if same(x - 1, y + 1):
            m |= SWBIT
        if same(x - 1, y - 1):
            m |= NWBIT
    return m


def autotile_ids(grid: List[List[int]], eight: bool = False) -> List[List[int]]:
    h = len(grid)
    w = len(grid[0]) if h else 0
    return [[neighbor_mask(grid, x, y, eight=eight) for x in range(w)] for y in range(h)]


def _edge_pixels(tile: Canvas) -> Tuple[List[int], List[int], List[int], List[int]]:
    """Return RGBA-hashed edge strips (top, right, bottom, left)."""
    def key(c):
        return (c[0] << 24) | (c[1] << 16) | (c[2] << 8) | c[3]

    top = [key(tile.get(x, 0)) for x in range(tile.w)]
    bot = [key(tile.get(x, tile.h - 1)) for x in range(tile.w)]
    left = [key(tile.get(0, y)) for y in range(tile.h)]
    right = [key(tile.get(tile.w - 1, y)) for y in range(tile.h)]
    return top, right, bot, left


def classify_tile(tile: Canvas, opaque_threshold: float = 0.08) -> str:
    """Guide §3.1–3.2: non-transparency + edge similarity → schema label."""
    n = tile.w * tile.h
    opaque = sum(1 for p in tile.px if p[3] > 0)
    if n == 0 or opaque / n < opaque_threshold:
        return TILE_PARTIAL
    top, right, bot, left = _edge_pixels(tile)

    def _var(edge):
        return len(set(edge))

    # fully enclosed object: all edges mostly transparent
    edge_opaque = 0
    for x in range(tile.w):
        edge_opaque += int(tile.get(x, 0)[3] > 0) + int(tile.get(x, tile.h - 1)[3] > 0)
    for y in range(tile.h):
        edge_opaque += int(tile.get(0, y)[3] > 0) + int(tile.get(tile.w - 1, y)[3] > 0)
    edge_n = 2 * tile.w + 2 * tile.h
    edge_frac = edge_opaque / max(1, edge_n)

    # wrapping similarity: top~bottom and left~right → seamless texture
    def _sim(a, b):
        if not a:
            return 1.0
        return sum(int(u == v) for u, v in zip(a, b)) / float(len(a))

    wrap = 0.5 * (_sim(top, bot) + _sim(left, right))
    if wrap > 0.72 and edge_frac > 0.85:
        return TILE_TEXTURE
    if wrap > 0.40 and edge_frac > 0.50:
        return TILE_PARTIAL_TEXTURE
    if edge_frac < 0.20:
        return TILE_COMPLETE
    return TILE_PARTIAL


def segment_tiles(canvas: Canvas, tw: int = 16, th: int = 16) -> List[Dict]:
    """Region-growing cut of a large canvas into ``tw×th`` units (guide §3.1)."""
    cols = max(1, canvas.w // tw)
    rows = max(1, canvas.h // th)
    out = []
    for r in range(rows):
        for c in range(cols):
            tile = Canvas(tw, th)
            for y in range(th):
                for x in range(tw):
                    sx, sy = c * tw + x, r * th + y
                    if canvas.in_bounds(sx, sy) and canvas.opaque(sx, sy):
                        tile.set(x, y, canvas.get(sx, sy), canvas.get_tag(sx, sy))
            label = classify_tile(tile)
            out.append({
                "col": c, "row": r, "x": c * tw, "y": r * th,
                "w": tw, "h": th, "schema": label, "tile": tile,
            })
    return out


def _paint_tile_variant(
    canvas: Canvas,
    kind: str,
    seed: int,
    mask: int,
    base_t: float,
) -> None:
    """Render one 16×16 (or canvas-sized) terrain tile with a Wang mask.

    The mask carves 'empty' (neighbour-missing) edges so autotiled maps
    show cliffs / shorelines / grass borders.
    """
    w, h = canvas.w, canvas.h
    hi, base, sh = shade_triplet(named_palette(kind if kind in
        ("grass", "dirt", "stone", "water", "sand", "lava", "snow", "wood") else "stone", base_t))
    wrap = 8
    for y in range(h):
        for x in range(w):
            # edge falloff according to missing neighbours
            edge = 0.0
            if not (mask & NBIT):
                edge = max(edge, 1.0 - y / max(1.0, h * 0.35))
            if not (mask & SBIT):
                edge = max(edge, 1.0 - (h - 1 - y) / max(1.0, h * 0.35))
            if not (mask & WBIT):
                edge = max(edge, 1.0 - x / max(1.0, w * 0.35))
            if not (mask & EBIT):
                edge = max(edge, 1.0 - (w - 1 - x) / max(1.0, w * 0.35))
            n = fbm(seed, x, y, octaves=3, freq=0.18, wrap=wrap, channel=kind)
            g = paper_noise(seed, x, y, wrap=wrap)
            t = 0.55 * n + 0.25 * g + 0.20 * edge
            if t > 0.66:
                col = hi
            elif t < 0.33:
                col = sh
            else:
                col = base
            canvas.set(x, y, col, tag=TAG_FLOOR if edge < 0.85 else TAG_WALL)


def paint_autotile_map(
    grid: List[List[int]],
    kind: str,
    seed: int,
    tile: int = 16,
) -> Canvas:
    """Stamp a 2-D occupancy grid into a seamless autotiled atlas."""
    rows = len(grid)
    cols = len(grid[0]) if rows else 0
    out = Canvas(cols * tile, rows * tile)
    ids = autotile_ids(grid, eight=False)
    for y in range(rows):
        for x in range(cols):
            if not grid[y][x]:
                continue
            cell = Canvas(tile, tile)
            _paint_tile_variant(cell, kind, seed + y * 131 + x * 17, ids[y][x], 0.45)
            out.blit(cell, x * tile, y * tile)
    return out
