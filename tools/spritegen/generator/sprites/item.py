#!/usr/bin/env python3
"""
Deterministic item / icon generator — SDF construction.
=======================================================

Each icon is a CSG tree of capsules, boxes, ellipses and rhombi, rasterised
with hard SDF thresholds (no anti-aliasing) and a 3-band n·l shade.  Material
colours come from cosine palettes so every seed is a distinct metal / wood /
gem without a lookup table.
"""

from __future__ import annotations

from typing import Any, Dict, Tuple

from .. import color
from ..math.canvas import Canvas, ScaledCanvas, TAG_METAL, TAG_ACCENT, TAG_CLOTH, TAG_BODY, TAG_EYE
from ..math.sdf import (
    sd_capsule, sd_circle, sd_round_box, sd_ellipse, sd_rhombus, sd_triangle,
    op_union, op_sub, rasterize_sdf,
)
from ..math.palette import named_palette, shade_triplet, shade_metal_ramp, cosine_palette, PALETTES
from ..math.noise import fbm
from ..pipeline import finalize, options_from
from .base import SpriteGenerator

_CATEGORIES = [
    "sword", "dagger", "axe", "hammer", "bow", "staff", "shield",
    "potion", "gem", "coin", "key", "scroll", "ring", "book", "shard",
]

_TIERS = [
    ("wood",       "wood",   (0.20, 0.55)),
    ("iron",       "metal",  (0.25, 0.50)),
    ("steel",      "metal",  (0.50, 0.72)),
    ("gold",       "sand",   (0.55, 0.80)),
    ("silver",     "metal",  (0.70, 0.90)),
    ("mithril",    "water",  (0.45, 0.75)),
    ("obsidian",   "stone",  (0.05, 0.22)),
    ("dragonbone", "snow",   (0.70, 0.92)),
]

_VARIANTS = ["plain", "studded", "runed", "plated", "gemmed"]


class ItemSpriteGenerator(SpriteGenerator):
    """SDF-assembled RPG icon (deterministic)."""

    type_name = "item"
    handles_master_palette = True

    def _build(self, seed: int, **options) -> Tuple[Dict[str, Any], "Image.Image"]:
        opt = options_from(options)
        rng = self.rng(seed)
        requested_category = options.get("category")
        category = requested_category if requested_category in _CATEGORIES else rng.choice(_CATEGORIES)
        tier, pal, (t0, t1) = rng.choice(_TIERS)
        requested_palette = options.get("palette")
        if requested_palette in PALETTES:
            pal = requested_palette
        t = rng.uniform(t0, t1)
        mat = named_palette(pal, t)
        # continuous jitter so neighbouring seeds never collapse
        mat = (
            max(0, min(255, int(mat[0] + rng.uniform(-18, 18)))),
            max(0, min(255, int(mat[1] + rng.uniform(-18, 18)))),
            max(0, min(255, int(mat[2] + rng.uniform(-18, 18)))),
        )
        accent = named_palette("magic", rng.random())
        accent2 = named_palette("lava", rng.random())
        variant = rng.choice(_VARIANTS)
        flip = rng.random() < 0.5

        spec = {
            "category": category,
            "palette": pal,
            "tier": tier,
            "material": color.rgb_to_hex(mat),
            "accent": color.rgb_to_hex(accent),
            "accent2": color.rgb_to_hex(accent2),
            "variant": variant,
            "flip": flip,
            "pipeline": {
                "shape": "sdf-csg",
                "palette": "cosine",
                "outline": "inward-1px",
            },
        }

        canvas = Canvas(*self.size)
        vc = ScaledCanvas(canvas, 32) if self.size != (32, 32) else canvas
        self._render(vc, seed, category, mat, accent, accent2, variant, flip)
        if flip:
            canvas = self._mirror(canvas)
        outline = color.darken(mat, 0.55)
        canvas = finalize(
            canvas,
            outline=outline,
            sel_out=True,
            ink_bias=(16, 13, 24),
            quantize=opt["quantize"],
            master_palette=opt["master_palette"],
            use_scale2x=opt["use_scale2x"],
            align=opt["align"],
            prune=opt["prune"],
        )
        return spec, canvas.to_pil()

    def _mirror(self, src: Canvas) -> Canvas:
        out = Canvas(src.w, src.h)
        for y in range(src.h):
            for x in range(src.w):
                if src.opaque(x, y):
                    out.set(src.w - 1 - x, y, src.get(x, y), src.get_tag(x, y))
        return out

    def _fill(self, canvas, sdf, col, tag, light=True):
        if tag == TAG_METAL:
            spec, hi, b, sh = shade_metal_ramp(col)
            rasterize_sdf(canvas, sdf, b, hi, sh, tag, ink=None, light=light,
                          dither=True, specular=spec)
        else:
            hi, b, sh = shade_triplet(col, 0.28, 0.32)
            rasterize_sdf(canvas, sdf, b, hi, sh, tag, ink=None, light=light, dither=True)

    def _render(self, canvas, seed, category, mat, accent, accent2, variant, flip):
        w, h = canvas.w, canvas.h
        cx, cy = w / 2.0, h / 2.0
        wood = named_palette("wood", 0.4)

        if category in ("sword", "dagger"):
            self._blade(canvas, cx, cy, mat, accent, wood, dagger=(category == "dagger"))
        elif category == "axe":
            self._axe(canvas, cx, cy, mat, wood)
        elif category == "hammer":
            self._hammer(canvas, cx, cy, mat, wood)
        elif category == "bow":
            self._bow(canvas, cx, cy, mat, accent)
        elif category == "staff":
            self._staff(canvas, cx, cy, mat, accent, wood)
        elif category == "shield":
            self._shield(canvas, cx, cy, mat, accent)
        elif category == "potion":
            self._potion(canvas, cx, cy, mat, accent)
        elif category == "gem":
            self._gem(canvas, cx, cy, mat, accent)
        elif category == "shard":
            self._shard(canvas, cx, cy, mat, accent)
        elif category == "coin":
            self._coin(canvas, cx, cy, mat, accent)
        elif category == "key":
            self._key(canvas, cx, cy, mat, accent)
        elif category == "scroll":
            self._scroll(canvas, cx, cy, mat, accent)
        elif category == "ring":
            self._ring(canvas, cx, cy, mat, accent)
        elif category == "book":
            self._book(canvas, cx, cy, mat, accent)

        self._decorate(canvas, seed, cx, cy, variant, accent, accent2)

    def _blade(self, canvas, cx, cy, mat, accent, wood, dagger=False):
        # diagonal blade
        x0, y0 = cx - 6, cy + 6
        x1, y1 = cx + 7, cy - 8
        r = 1.05 if dagger else 1.45
        self._fill(canvas, lambda px, py: sd_capsule(px, py, x0, y0, x1, y1, r), mat, TAG_METAL)
        # tip
        self._fill(canvas, lambda px, py: sd_circle(px, py, x1, y1, 1.2), color.lighten(mat, 0.35), TAG_METAL)
        # guard
        gx, gy = cx - 2.5, cy + 3.5
        self._fill(canvas, lambda px, py: sd_round_box(px, py, gx, gy, 4.2, 1.0, 0.4), accent, TAG_ACCENT)
        # handle
        self._fill(canvas, lambda px, py: sd_capsule(px, py, cx - 5, cy + 5, cx - 8, cy + 10, 1.15), wood, TAG_CLOTH)
        # pommel
        self._fill(canvas, lambda px, py: sd_circle(px, py, cx - 8.2, cy + 10.5, 1.5), accent, TAG_ACCENT)

    def _axe(self, canvas, cx, cy, mat, wood):
        self._fill(canvas, lambda px, py: sd_capsule(px, py, cx, cy - 6, cx, cy + 10, 1.1), wood, TAG_CLOTH)
        self._fill(canvas, lambda px, py: sd_round_box(px, py, cx + 4.5, cy - 3, 4.5, 3.4, 0.8), mat, TAG_METAL)
        self._fill(canvas, lambda px, py: sd_capsule(px, py, cx + 7, cy - 6, cx + 8, cy + 1, 1.0),
                   color.lighten(mat, 0.3), TAG_METAL)

    def _hammer(self, canvas, cx, cy, mat, wood):
        self._fill(canvas, lambda px, py: sd_capsule(px, py, cx, cy - 4, cx, cy + 10, 1.15), wood, TAG_CLOTH)
        self._fill(canvas, lambda px, py: sd_round_box(px, py, cx, cy - 5, 6.2, 2.6, 0.6), mat, TAG_METAL)

    def _bow(self, canvas, cx, cy, mat, accent):
        # arc approximated by three capsules
        # two-arc bow (left) + string (right)
        self._fill(canvas, lambda px, py: sd_capsule(px, py, cx - 2, cy - 10, cx - 7, cy - 2, 1.4), mat, TAG_CLOTH)
        self._fill(canvas, lambda px, py: sd_capsule(px, py, cx - 7, cy - 2, cx - 7, cy + 2, 1.4), mat, TAG_CLOTH)
        self._fill(canvas, lambda px, py: sd_capsule(px, py, cx - 7, cy + 2, cx - 2, cy + 10, 1.4), mat, TAG_CLOTH)
        string = (230, 230, 220)
        self._fill(canvas, lambda px, py: sd_capsule(px, py, cx + 1, cy - 10, cx + 1, cy + 10, 0.75),
                   string, TAG_ACCENT, light=False)
        self._fill(canvas, lambda px, py: sd_circle(px, py, cx - 7, cy, 1.5), accent, TAG_ACCENT)

    def _staff(self, canvas, cx, cy, mat, accent, wood):
        self._fill(canvas, lambda px, py: sd_capsule(px, py, cx, cy - 4, cx, cy + 12, 1.15), wood, TAG_CLOTH)
        self._fill(canvas, lambda px, py: sd_circle(px, py, cx, cy - 7, 3.1), accent, TAG_ACCENT)
        self._fill(canvas, lambda px, py: sd_circle(px, py, cx - 1, cy - 8, 1.1), color.lighten(accent, 0.4), TAG_EYE)

    def _shield(self, canvas, cx, cy, mat, accent):
        self._fill(canvas, lambda px, py: sd_ellipse(px, py, cx, cy, 8.0, 10.0) * 8.0, mat, TAG_METAL)
        self._fill(canvas, lambda px, py: sd_rhombus(px, py, cx, cy - 1, 3.2, 4.0) * 3.2, accent, TAG_ACCENT)

    def _potion(self, canvas, cx, cy, mat, accent):
        glass_rim = (220, 235, 245)
        glass_sh = (40, 55, 65)
        # flask body (rounded base + slender neck)
        self._fill(canvas, lambda px, py: op_union(
            sd_circle(px, py, cx, cy + 3.5, 7.5),
            sd_capsule(px, py, cx, cy - 4, cx, cy - 8, 2.0),
        ), glass_sh, TAG_BODY)
        # wood cork stopper & neck cord
        self._fill(canvas, lambda px, py: sd_round_box(px, py, cx, cy - 9.5, 2.4, 1.4, 0.3),
                   (125, 75, 45), TAG_CLOTH)
        self._fill(canvas, lambda px, py: sd_capsule(px, py, cx - 3, cy - 7, cx + 3, cy - 7, 0.8),
                   (75, 45, 25), TAG_CLOTH)
        # glowing liquid with meniscus curve
        self._fill(canvas, lambda px, py: op_sub(
            sd_circle(px, py, cx, cy + 3.5, 5.8),
            sd_round_box(px, py, cx, cy - 3.0, 7.0, 4.0, 0.2),
        ), mat, TAG_ACCENT)
        # liquid core glow
        self._fill(canvas, lambda px, py: sd_ellipse(px, py, cx, cy + 4.5, 3.8, 2.8),
                   color.lighten(mat, 0.35), TAG_EYE)
        # Glass reflections (left curve highlight & glint)
        canvas.set(int(cx - 4), int(cy + 1), glass_rim, TAG_EYE)
        canvas.set(int(cx - 5), int(cy + 2), glass_rim, TAG_EYE)
        canvas.set(int(cx - 5), int(cy + 3), glass_rim, TAG_EYE)
        canvas.set(int(cx - 4), int(cy + 4), color.lighten(mat, 0.5), TAG_EYE)
        canvas.set(int(cx + 4), int(cy + 5), color.lighten(mat, 0.4), TAG_EYE)

    def _gem(self, canvas, cx, cy, mat, accent):
        self._fill(canvas, lambda px, py: sd_rhombus(px, py, cx, cy, 7.0, 9.5) * 7.0, mat, TAG_ACCENT)
        self._fill(canvas, lambda px, py: sd_rhombus(px, py, cx - 1, cy - 2, 2.4, 3.0) * 2.4,
                   color.lighten(mat, 0.45), TAG_EYE)

    def _shard(self, canvas, cx, cy, mat, accent):
        # Ethereal, multifaceted Anima Shard: crystalline diamond geometry with inner soul core
        soul_core = (245, 255, 250)
        soul_teal = (55, 220, 205)
        # Main crystal silhouette
        self._fill(canvas, lambda px, py: sd_rhombus(px, py, cx, cy, 6.5, 10.5) * 6.5, mat, TAG_ACCENT)
        # Upper facet left
        self._fill(canvas, lambda px, py: sd_triangle(px, py, cx, cy - 10.0, cx - 6.0, cy, cx, cy),
                   color.lighten(mat, 0.45), TAG_EYE)
        # Lower facet right
        self._fill(canvas, lambda px, py: sd_triangle(px, py, cx, cy + 10.0, cx + 6.0, cy, cx, cy),
                   color.darken(mat, 0.25), TAG_ACCENT)
        # Inner living soul spark
        self._fill(canvas, lambda px, py: sd_rhombus(px, py, cx, cy, 2.8, 4.2) * 2.8, soul_teal, TAG_ACCENT)
        self._fill(canvas, lambda px, py: sd_circle(px, py, cx, cy, 1.4), soul_core, TAG_EYE)
        # Specular glint
        canvas.set(int(cx - 1), int(cy - 4), (255, 255, 255), TAG_EYE)
        canvas.set(int(cx), int(cy - 5), (255, 255, 255), TAG_EYE)

    def _coin(self, canvas, cx, cy, mat, accent):
        self._fill(canvas, lambda px, py: sd_circle(px, py, cx, cy, 8.0), mat, TAG_METAL)
        self._fill(canvas, lambda px, py: sd_circle(px, py, cx, cy, 4.5), color.lighten(mat, 0.2), TAG_METAL)
        self._fill(canvas, lambda px, py: sd_circle(px, py, cx, cy, 1.6), accent, TAG_ACCENT)

    def _key(self, canvas, cx, cy, mat, accent):
        self._fill(canvas, lambda px, py: op_sub(
            sd_circle(px, py, cx, cy - 7, 4.2),
            sd_circle(px, py, cx, cy - 7, 2.0),
        ), mat, TAG_METAL)
        self._fill(canvas, lambda px, py: sd_capsule(px, py, cx, cy - 3, cx, cy + 9, 1.15), mat, TAG_METAL)
        self._fill(canvas, lambda px, py: sd_round_box(px, py, cx + 2.5, cy + 5, 2.4, 0.8, 0.2), mat, TAG_METAL)
        self._fill(canvas, lambda px, py: sd_round_box(px, py, cx + 2.0, cy + 8, 1.8, 0.8, 0.2), mat, TAG_METAL)

    def _scroll(self, canvas, cx, cy, mat, accent):
        paper = color.mix(color.lighten(named_palette("sand", 0.7), 0.18), mat, 0.14)
        self._fill(canvas, lambda px, py: sd_round_box(px, py, cx, cy, 8.5, 6.0, 0.6), paper, TAG_CLOTH)
        # Scroll handles reflect material tier (wood/gold/mithril/obsidian)
        self._fill(canvas, lambda px, py: sd_capsule(px, py, cx - 9, cy - 6, cx - 9, cy + 6, 1.5),
                   mat, TAG_METAL)
        self._fill(canvas, lambda px, py: sd_capsule(px, py, cx + 9, cy - 6, cx + 9, cy + 6, 1.5),
                   mat, TAG_METAL)
        ink = color.darken(paper, 0.45)
        for i, yy in enumerate((cy - 2, cy, cy + 2)):
            self._fill(canvas, lambda px, py, yy=yy: sd_capsule(px, py, cx - 4, yy, cx + 4, yy, 0.4),
                       ink, TAG_BODY, light=False)
        # Wax seal in accent color
        self._fill(canvas, lambda px, py: sd_circle(px, py, cx + 4, cy + 3, 1.6), accent, TAG_ACCENT)

    def _ring(self, canvas, cx, cy, mat, accent):
        self._fill(canvas, lambda px, py: op_sub(
            sd_ellipse(px, py, cx, cy + 1, 7.0, 5.0) * 5.5,
            sd_ellipse(px, py, cx, cy + 1, 4.2, 2.8) * 3.2,
        ), mat, TAG_METAL)
        self._fill(canvas, lambda px, py: sd_rhombus(px, py, cx, cy - 6, 2.6, 2.4) * 2.4, accent, TAG_ACCENT)

    def _book(self, canvas, cx, cy, mat, accent):
        cover = color.darken(mat, 0.1)
        self._fill(canvas, lambda px, py: sd_round_box(px, py, cx, cy, 8.0, 10.0, 0.6), cover, TAG_CLOTH)
        self._fill(canvas, lambda px, py: sd_round_box(px, py, cx + 6.5, cy, 1.4, 10.0, 0.2),
                   color.darken(cover, 0.25), TAG_CLOTH)
        self._fill(canvas, lambda px, py: sd_capsule(px, py, cx + 7, cy - 10, cx + 7, cy - 2, 0.7),
                   accent, TAG_ACCENT)
        self._fill(canvas, lambda px, py: sd_round_box(px, py, cx - 2, cy - 4, 3.5, 1.4, 0.3),
                   accent, TAG_ACCENT)

    def _decorate(self, canvas, seed, cx, cy, variant, accent, accent2):
        rng = self.rng(seed, "deco")
        if variant == "plain":
            canvas.set(int(cx - 3), int(cy - 5), color.lighten(accent2, 0.2), TAG_ACCENT)
        elif variant == "studded":
            for i in range(4):
                canvas.set(int(cx + (i % 2) * 6 - 3), int(cy + (i // 2) * 6 - 3),
                           color.lighten(accent, 0.25), TAG_METAL)
        elif variant == "runed":
            g = rng.next_u64()
            col = accent
            if g % 3 == 0:
                for p in ((int(cx) - 2, int(cy) - 2), (int(cx) + 2, int(cy) - 2), (int(cx), int(cy) + 2)):
                    canvas.set(p[0], p[1], col, TAG_ACCENT)
            elif g % 3 == 1:
                for dy in range(3):
                    canvas.set(int(cx) - 2, int(cy) - 2 + dy, col, TAG_ACCENT)
            else:
                canvas.fill_rect(int(cx) - 1, int(cy) - 2, int(cx) + 1, int(cy) - 1, col, TAG_ACCENT)
        elif variant == "plated":
            canvas.fill_rect(int(cx) - 4, int(cy), int(cx) + 4, int(cy) + 1, accent2, TAG_METAL)
        elif variant == "gemmed":
            canvas.set(int(cx) - 4, int(cy) - 4, accent, TAG_ACCENT)
            canvas.set(int(cx) + 4, int(cy) - 2, accent2, TAG_ACCENT)
            canvas.set(int(cx) - 1, int(cy) + 4, accent, TAG_ACCENT)
