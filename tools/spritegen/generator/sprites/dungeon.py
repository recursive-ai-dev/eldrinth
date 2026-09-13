#!/usr/bin/env python3
"""
Deterministic dungeon / cave minimap.
=====================================

A 32×32 walkable cave: cellular automata for organic rooms, a Hilbert
corridor so every region stays reachable (guide §2.2), then Wang-shaded
stone/moss walls.  Useful as a minimap sprite or as a seed for a larger
autotiled level.
"""

from __future__ import annotations

from typing import Any, Dict, Tuple

from .. import color
from ..math.canvas import Canvas, TAG_FLOOR, TAG_WALL, TAG_ACCENT
from ..math.ca import cave_generate, density as ca_density
from ..math.palette import named_palette, shade_triplet
from ..math.wang import autotile_ids, neighbor_mask, NBIT, EBIT, SBIT, WBIT
from ..math.noise import paper_noise
from ..pipeline import options_from
from .base import SpriteGenerator


class DungeonSpriteGenerator(SpriteGenerator):
    """32×32 CA + Hilbert cave minimap (deterministic)."""

    type_name = "dungeon"
    default_size = (32, 32)

    def _build(self, seed: int, **options) -> Tuple[Dict[str, Any], "Image.Image"]:
        opt = options_from(options)
        rng = self.rng(seed)
        fill_p = 0.40 + rng.random() * 0.16
        rounds = rng.randint(4, 6)
        T = rng.choice([4, 4, 5])
        w, h = self.size
        grid = cave_generate(seed, w=w, h=h, fill_p=fill_p, rounds=rounds, threshold=T, corridor=1)
        # grid: 1 = wall, 0 = floor
        wall_t = rng.random() * 0.3 + 0.3
        floor_t = rng.random() * 0.3 + 0.45
        wall = named_palette("stone", wall_t)
        moss = named_palette("grass", rng.random() * 0.4 + 0.2)
        floor = named_palette("dirt", floor_t)
        whi, wb, wsh = shade_triplet(wall, 0.18, 0.28)
        fhi, fb, fsh = shade_triplet(floor, 0.16, 0.22)

        canvas = Canvas(w, h)
        ids = autotile_ids([[1 - cell for cell in row] for row in grid])  # floor occupancy
        for y in range(h):
            for x in range(w):
                n = paper_noise(seed, x, y, wrap=8)
                if grid[y][x]:  # wall
                    col = wsh if n < 0.33 else (whi if n > 0.72 else wb)
                    if n > 0.82:
                        col = moss
                    canvas.set(x, y, col, TAG_WALL)
                else:
                    col = fhi if n > 0.7 else (fsh if n < 0.3 else fb)
                    if ids[y][x] != (NBIT | EBIT | SBIT | WBIT):
                        # floor cell borders a wall on at least one side —
                        # a faint contact shadow (guide §3: Wang-bitmask shading).
                        col = fsh
                    canvas.set(x, y, col, TAG_FLOOR)

        # entrance marker (first floor cell in Hilbert-ish scan)
        placed = False
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                if grid[y][x] == 0:
                    canvas.set(x, y, named_palette("lava", 0.7), TAG_ACCENT)
                    placed = True
                    break
            if placed:
                break

        spec = {
            "fill_p": round(fill_p, 3),
            "rounds": rounds,
            "threshold": T,
            "wall_density": round(ca_density(grid), 3),
            "floor": color.rgb_to_hex(floor),
            "wall": color.rgb_to_hex(wall),
            "pipeline": {
                "layout": "cave-ca+hilbert-corridor",
                "shading": "wang-bitmask+paper-noise",
                "walkable": True,
            },
        }
        if opt["quantize"]:
            from ..math.palette import quantize_canvas
            canvas = quantize_canvas(canvas, n=int(opt["quantize"]))
        if opt["use_scale2x"]:
            from ..math.pixel import scale2x
            canvas = scale2x(canvas)
        return spec, canvas.to_pil()
