#!/usr/bin/env python3
"""
Deterministic seamless tile generator.
======================================

16×16 terrain tiles built from *wrapped* fBm + domain warping so edges match
their neighbours.  Cosine palettes supply the material colour; a Wang bitmask
(``mask``, 0..15) carves cliff / shore edges for autotiling (guide §3, §4).

Classification into Complete / Partial / Texture / Partial Texture is
recorded on the spec so a map assembler can reason about connectivity.
"""

from __future__ import annotations

from typing import Any, Dict, Tuple

from .. import color
from ..math.canvas import Canvas, TAG_FLOOR, TAG_WALL, TAG_ACCENT, TAG_BODY
from ..math.noise import fbm, domain_warp, paper_noise, warp_sample, value_noise
from ..math.palette import named_palette, shade_triplet, PALETTES
from ..math.wang import classify_tile, neighbor_mask, NBIT, EBIT, SBIT, WBIT
from ..pipeline import finalize, options_from
from .base import SpriteGenerator

_TILE_KINDS = [
    "grass", "dirt", "stone", "sand", "water", "snow",
    "lava", "brick", "wood", "cobble", "moss", "mud",
]

_PAL = {
    "grass": "grass", "dirt": "dirt", "stone": "stone", "sand": "sand",
    "water": "water", "snow": "snow", "lava": "lava", "brick": "dirt",
    "wood": "wood", "cobble": "stone", "moss": "grass", "mud": "dirt",
}


class TileSpriteGenerator(SpriteGenerator):
    """Wrapping-noise terrain tile (deterministic, autotile-aware)."""

    type_name = "tile"
    default_size = (16, 16)

    def _build(self, seed: int, **options) -> Tuple[Dict[str, Any], "Image.Image"]:
        opt = options_from(options)
        rng = self.rng(seed)
        kind = options.get("kind")
        if kind is None:
            kind = rng.choice(_TILE_KINDS)
        if kind not in _TILE_KINDS:
            kind = "stone"
        mask = options.get("mask")
        if mask is None:
            # full-neighbour (interior) tile by default, still unique via noise
            mask = 15
        mask = int(mask) & 15
        t0 = rng.random() * 0.3 + 0.35
        requested_palette = options.get("palette")
        pal = requested_palette if requested_palette in PALETTES else _PAL[kind]
        base = named_palette(pal, t0)
        accent = named_palette(pal, min(1.0, t0 + 0.18))

        spec = {
            "kind": kind,
            "base": color.rgb_to_hex(base),
            "accent": color.rgb_to_hex(accent),
            "mask": mask,
            "palette": pal,
            "wang": {
                "N": bool(mask & NBIT),
                "E": bool(mask & EBIT),
                "S": bool(mask & SBIT),
                "W": bool(mask & WBIT),
            },
            "pipeline": {
                "noise": "wrapped-fbm+domain-warp",
                "palette": "cosine",
                "connectivity": "wang-4bit",
            },
        }

        canvas = Canvas(*self.size)
        self._render(canvas, seed, kind, pal, t0, mask)
        # tiles should NOT CoG-align (that would break seamlessness)
        # and should NOT outline (that would break tiling)
        schema = classify_tile(canvas)
        spec["schema"] = schema
        if opt["quantize"]:
            from ..math.palette import quantize_canvas
            canvas = quantize_canvas(canvas, n=int(opt["quantize"]))
        if opt["use_scale2x"]:
            from ..math.pixel import scale2x
            canvas = scale2x(canvas)
        return spec, canvas.to_pil()

    def _render(self, canvas: Canvas, seed: int, kind: str, pal: str, t0: float, mask: int) -> None:
        w, h = canvas.w, canvas.h
        hi, base, sh = shade_triplet(named_palette(pal, t0), 0.22, 0.28)
        # Normalise pixel coords onto a 4-cell torus so noise(x,y) == noise(x+w,y)
        # (adjacent copies of the same seed/kind therefore share edges).
        cells = 4

        def _nx(x, y):
            return (x / float(w)) * cells, (y / float(h)) * cells

        # structured overlays
        for y in range(h):
            for x in range(w):
                ux, uy = _nx(x, y)
                n, jac = warp_sample(seed, ux, uy, amp=0.35, freq=1.0, wrap=cells, octaves=4)
                g = paper_noise(seed, ux, uy, wrap=cells)
                # edge falloff for missing wang neighbours (shore / cliff)
                edge = 0.0
                if not (mask & NBIT):
                    edge = max(edge, 1.0 - y / max(1.0, h * 0.40))
                if not (mask & SBIT):
                    edge = max(edge, 1.0 - (h - 1 - y) / max(1.0, h * 0.40))
                if not (mask & WBIT):
                    edge = max(edge, 1.0 - x / max(1.0, w * 0.40))
                if not (mask & EBIT):
                    edge = max(edge, 1.0 - (w - 1 - x) / max(1.0, w * 0.40))

                t = 0.50 * n + 0.22 * g + 0.28 * edge

                if kind == "water":
                    # animated-looking ripples (static per seed)
                    ripple = value_noise(seed, ux + 0.4 * uy, uy, freq=1.0, wrap=cells, channel="rip")
                    t = 0.45 * n + 0.55 * ripple
                    col = hi if t > 0.62 else (base if t > 0.38 else sh)
                    tag = TAG_FLOOR
                elif kind == "lava":
                    glow = value_noise(seed, ux, uy, freq=1.0, wrap=cells, channel="glow")
                    if glow > 0.72:
                        col = named_palette("lava", 0.85)
                    elif t > 0.6:
                        col = hi
                    else:
                        col = sh if t < 0.35 else base
                    tag = TAG_ACCENT if glow > 0.72 else TAG_FLOOR
                elif kind == "brick":
                    # running-bond brick grid
                    bw, bh = 5, 3
                    row = y // bh
                    ox = (bw // 2) if row % 2 else 0
                    mortar = (x + ox) % bw == 0 or y % bh == 0
                    col = sh if mortar else (hi if n > 0.6 else base)
                    tag = TAG_WALL if mortar else TAG_FLOOR
                elif kind == "wood":
                    grain = value_noise(seed, ux * 0.4, uy, freq=1.0, wrap=cells, channel="grain")
                    knot = value_noise(seed, ux, uy, freq=1.0, wrap=cells, channel="knot")
                    if knot > 0.88:
                        col = sh
                    else:
                        col = hi if grain > 0.66 else (sh if grain < 0.33 else base)
                    tag = TAG_FLOOR
                elif kind == "cobble":
                    cell = (x // 4) + (y // 4) * 4
                    jitter = (cell * 13 + seed) % 5
                    mortar = (x % 4 == 0) or (y % 4 == 0)
                    col = sh if mortar else (hi if jitter > 2 else base)
                    tag = TAG_WALL if mortar else TAG_FLOOR
                else:
                    col = hi if t > 0.64 else (sh if t < 0.36 else base)
                    tag = TAG_WALL if edge > 0.7 else TAG_FLOOR

                # jacobian-compensated micro-grain (constant "pencil" weight)
                if jac < 0.7 and (x + y) % 3 == 0:
                    col = color.darken(col, 0.08)
                canvas.set(x, y, col, tag)

        # sparse features (blades, pebbles) that *also* wrap via modular coords
        nfeat = 6 if kind in ("water", "lava") else 4
        for i in range(nfeat):
            fx = int(fbm(seed, i * 3.1, 1.7, octaves=1, freq=1.0, wrap=0, channel="fx") * (w - 1))
            fy = int(fbm(seed, i * 5.2, 2.9, octaves=1, freq=1.0, wrap=0, channel="fy") * (h - 1))
            self._feature(canvas, kind, fx % w, fy % h, base, hi, sh)

    def _feature(self, canvas, kind, x, y, base, hi, sh):
        if kind in ("grass", "moss"):
            canvas.set(x, y, hi, TAG_ACCENT)
            canvas.set(x, (y - 1) % canvas.h, color.lighten(hi, 0.15), TAG_ACCENT)
        elif kind in ("dirt", "mud", "sand"):
            canvas.set(x, y, sh, TAG_BODY)
            canvas.set((x + 1) % canvas.w, y, color.mix(sh, base, 0.4), TAG_BODY)
        elif kind in ("stone", "cobble"):
            canvas.set(x, y, sh, TAG_WALL)
            canvas.set(x, (y + 1) % canvas.h, sh, TAG_WALL)
        elif kind == "snow":
            canvas.set(x, y, color.lighten(hi, 0.4), TAG_ACCENT)
        elif kind == "water":
            canvas.set(x, y, color.lighten(hi, 0.35), TAG_ACCENT)
            canvas.set((x + 1) % canvas.w, (y - 1) % canvas.h, hi, TAG_ACCENT)
        elif kind == "lava":
            canvas.set(x, y, named_palette("lava", 0.9), TAG_ACCENT)
