#!/usr/bin/env python3
"""Deterministic settlement modules for readable villages and lived-in rooms.

The generator deliberately produces structural parts rather than a single
generic ``house`` token.  A map assembler can choose matching roof, facade,
door, floor, wall, and furnishing modules for a coherent town; the complete
``cottage`` composition is provided for engines that draw buildings as props.
"""

from __future__ import annotations

from typing import Any, Dict, Tuple

from PIL import Image, ImageDraw

from .. import color
from .base import SpriteGenerator


_THEMES = {
    "oldstone": {
        "roof": (83, 69, 78), "wall": (116, 111, 104), "trim": (171, 160, 138),
        "wood": (91, 57, 39), "floor": (75, 64, 54), "accent": (201, 168, 101),
    },
    "cinder": {
        "roof": (92, 43, 34), "wall": (128, 83, 56), "trim": (207, 137, 78),
        "wood": (76, 38, 26), "floor": (82, 49, 34), "accent": (247, 154, 68),
    },
    "coastal": {
        "roof": (48, 76, 89), "wall": (103, 133, 137), "trim": (178, 204, 190),
        "wood": (81, 63, 47), "floor": (67, 86, 88), "accent": (151, 217, 205),
    },
    "moor": {
        "roof": (63, 48, 81), "wall": (100, 82, 111), "trim": (179, 150, 201),
        "wood": (68, 50, 74), "floor": (61, 51, 71), "accent": (207, 180, 255),
    },
}

_PARTS = {
    "cottage", "roof_left", "roof_mid", "roof_right", "wall_left", "wall_mid",
    "wall_right", "door", "interior_floor", "interior_wall", "bed", "table",
    "shelf", "workbench", "hearth", "lamp", "rug",
}


class SettlementSpriteGenerator(SpriteGenerator):
    """Pixel-art building modules with a shared deterministic village grammar."""

    type_name = "settlement"
    default_size = (32, 32)

    def _build(self, seed: int, **options) -> Tuple[Dict[str, Any], Image.Image]:
        theme_name = str(options.get("theme", "oldstone")).lower()
        if theme_name not in _THEMES:
            theme_name = "oldstone"
        part = str(options.get("part", "cottage")).lower()
        if part not in _PARTS:
            part = "cottage"
        variant = int(options.get("variant", 0))
        locks = dict(options.get("locks") or {})
        part_seeds = {
            p: int(locks.get(p) if locks.get(p) is not None else options.get(f"{p}_seed", seed))
            for p in ("roof", "wall", "trim")
        }
        palette = _THEMES[theme_name]
        image = Image.new("RGBA", self.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        rng = self.rng(seed, theme_name, part, variant)
        part_rngs = {
            p: (rng if part_seeds[p] == seed else self.rng(part_seeds[p], theme_name, part, variant, p))
            for p in ("roof", "wall", "trim")
        }
        spec = {
            "theme": theme_name,
            "part": part,
            "variant": variant,
            "size": list(self.size),
            "part_seeds": part_seeds,
            "pipeline": {
                "grammar": "roof-facade-door-room-furnishing",
                "materials": "theme-ramp+integer-pixel-joinery",
                "composition": "modular-or-complete-cottage",
            },
        }

        if part == "cottage":
            self._cottage(draw, palette, rng, part_rngs=part_rngs)
        elif part.startswith("roof_"):
            self._roof_module(draw, palette, part.rsplit("_", 1)[1], rng)
        elif part.startswith("wall_"):
            self._wall_module(draw, palette, part.rsplit("_", 1)[1], rng)
        elif part == "door":
            self._door_module(draw, palette, rng)
        elif part == "interior_floor":
            self._floor(draw, palette, rng)
        elif part == "interior_wall":
            self._interior_wall(draw, palette, rng)
        else:
            self._furnishing(draw, palette, part, rng)
        return spec, image

    @staticmethod
    def _ink() -> Tuple[int, int, int, int]:
        return (18, 16, 22, 255)

    @staticmethod
    def _rgba(c):
        return (c[0], c[1], c[2], 255)

    @staticmethod
    def _seed_theme(base_p: Dict[str, tuple], rng) -> Dict[str, tuple]:
        """Subtly shift a named settlement theme per seed without losing its biome."""
        warmth = rng.choice([(215, 200, 175), (170, 190, 210), (195, 175, 165), (175, 205, 180)])
        amt = rng.uniform(0.02, 0.14)
        roof_adj = rng.uniform(-0.08, 0.10)
        roof = color.mix(base_p["roof"], warmth, amt)
        roof = color.lighten(roof, roof_adj) if roof_adj >= 0 else color.darken(roof, -roof_adj)
        return {
            "roof": roof,
            "wall": color.mix(base_p["wall"], warmth, amt * 0.8),
            "trim": color.mix(base_p["trim"], warmth, amt * 0.5),
            "wood": color.mix(base_p["wood"], warmth, amt * 0.6),
            "floor": color.mix(base_p["floor"], warmth, amt * 0.6),
            "accent": base_p["accent"],
        }

    def _cottage(self, d: ImageDraw.ImageDraw, base_p: Dict[str, tuple], rng, part_rngs=None) -> None:
        """Draw a seeded 3×3-style cottage frontage scaled cleanly to any square size."""
        w, h = self.size
        s = min(w, h) / 32.0
        u = max(1, int(round(s)))

        def q(v):
            return int(round(v * s))

        pr = part_rngs or {"roof": rng, "wall": rng, "trim": rng}
        p = self._seed_theme(base_p, rng)
        if pr["roof"] is not rng:
            p["roof"] = self._seed_theme(base_p, pr["roof"])["roof"]
        if pr["wall"] is not rng:
            w_p = self._seed_theme(base_p, pr["wall"])
            p["wall"], p["wood"] = w_p["wall"], w_p["wood"]
        if pr["trim"] is not rng:
            t_p = self._seed_theme(base_p, pr["trim"])
            p["trim"], p["accent"] = t_p["trim"], t_p["accent"]
        ink = self._ink()
        roof, wall, trim, wood, accent = (self._rgba(p[n]) for n in ("roof", "wall", "trim", "wood", "accent"))
        roof_hi = self._rgba(color.lighten(p["roof"], 0.26))
        roof_sh = self._rgba(color.darken(p["roof"], 0.36))
        wall_sh = self._rgba(color.darken(p["wall"], 0.28))
        wall_hi = self._rgba(color.lighten(p["wall"], 0.14))
        wood_hi = self._rgba(color.lighten(p["wood"], 0.24))

        # Architectural grammar parameters sampled per seed (respecting sub-seed locks)
        rr, wr, tr = pr["roof"], pr["wall"], pr["trim"]
        roof_peak_y = rr.choice([2, 3, 4])
        has_chimney = rr.random() < 0.72
        chim_side = rr.choice([-1, 1])
        has_dormer = rr.random() < 0.35
        door_cx = tr.choice([12, 16, 16, 20])
        brace_style = wr.choice(["posts", "half_timber", "cross"])
        has_planter = tr.random() < 0.55
        has_lantern = tr.random() < 0.50

        # Foundation shadow
        d.rectangle((q(3), q(29), q(28), q(31)), fill=ink)

        # Chimney behind roof
        if has_chimney:
            chx = 8 if chim_side < 0 else 21
            d.rectangle((q(chx), q(2), q(chx + 3), q(11)), fill=ink)
            d.rectangle((q(chx + 0.6), q(2.6), q(chx + 2.4), q(10)), fill=wall_sh)
            d.rectangle((q(chx - 0.5), q(2), q(chx + 3.5), q(3.2)), fill=trim)
            if s >= 1.0:
                d.point((q(chx + 1.5), q(1)), fill=(210, 210, 220, 180))

        # Gabled roof + under-eave shadow
        d.polygon([(q(2), q(15)), (q(16), q(roof_peak_y)), (q(30), q(15)), (q(28), q(18)), (q(4), q(18))], fill=ink)
        d.polygon([(q(3), q(15)), (q(16), q(roof_peak_y + 1)), (q(29), q(15)), (q(27), q(17)), (q(5), q(17))], fill=roof)
        d.line((q(5), q(14), q(16), q(roof_peak_y + 2), q(27), q(14)), fill=roof_hi, width=u)
        for y in range(8, 17, 3):
            shift = (y - 8) // 3
            d.line((q(6 + shift), q(y), q(26 - shift), q(y)), fill=roof_sh, width=u)

        # High-entropy seeded slate/shingle mottling
        slate_marks = rr.next_u64()
        for mark in range(16):
            row, col = divmod(mark, 4)
            x, y = 9 + col * 4 + row, 7 + row * 2
            shade = (slate_marks >> (mark * 4)) & 0xF
            tone = color.mix(p["roof"], p["trim"], shade / 42.0)
            d.point((q(x), q(y)), fill=self._rgba(tone))

        if has_dormer:
            d.rectangle((q(13), q(8), q(19), q(14)), fill=ink)
            d.rectangle((q(14), q(9), q(18), q(13)), fill=wall)
            d.rectangle((q(15), q(10), q(17), q(12)), fill=accent)

        d.rectangle((q(4), q(17), q(28), q(19)), fill=ink)
        d.rectangle((q(5), q(17), q(27), q(18)), fill=roof_sh)

        # Frontage facade + timber joinery
        d.rectangle((q(5), q(19), q(27), q(29)), fill=ink)
        d.rectangle((q(6), q(19), q(26), q(28)), fill=wall)
        d.line((q(6), q(20), q(26), q(20)), fill=trim, width=u)
        d.line((q(6), q(21), q(26), q(21)), fill=wall_hi, width=1)
        for x in (7, 23):
            d.rectangle((q(x), q(20), q(x + 1), q(28)), fill=wood)
            d.line((q(x), q(20), q(x), q(28)), fill=wood_hi, width=u)
        if brace_style == "half_timber":
            d.line((q(6), q(24), q(26), q(24)), fill=wood, width=u)
        elif brace_style == "cross":
            d.line((q(8), q(20), q(11), q(24)), fill=wood, width=u)
            d.line((q(24), q(20), q(21), q(24)), fill=wood, width=u)

        # Windows opposite the doorway
        win_xs = [x for x in (11, 16, 21) if abs(x - door_cx) >= 4]
        for idx, wx in enumerate(win_xs[:2]):
            wy = 22 + (idx % 2)
            d.rectangle((q(wx - 2), q(wy - 2), q(wx + 2), q(wy + 2)), fill=ink)
            d.rectangle((q(wx - 1), q(wy - 1), q(wx + 1), q(wy + 1)), fill=accent)
            d.point((q(wx - 1), q(wy - 1)), fill=(255, 244, 192, 255))
            if has_planter and idx == 0:
                d.rectangle((q(wx - 2), q(wy + 2), q(wx + 2), q(wy + 3)), fill=wood)
                d.point((q(wx), q(wy + 1)), fill=(96, 178, 86, 255))

        # Doorway + latch + optional lantern
        d.rectangle((q(door_cx - 2), q(22), q(door_cx + 2), q(29)), fill=ink)
        d.rectangle((q(door_cx - 1), q(23), q(door_cx + 1), q(28)), fill=wood)
        d.line((q(door_cx - 1), q(23), q(door_cx - 1), q(28)), fill=wood_hi, width=u)
        d.point((q(door_cx + 1), q(26)), fill=accent)
        if has_lantern:
            lx = door_cx - 3 if door_cx >= 16 else door_cx + 3
            d.point((q(lx), q(23)), fill=(255, 224, 128, 255))

        # Seed-derived stone/moss weathering marks
        for _ in range(5):
            x = rng.randint(6, 26)
            y = rng.randint(20, 28)
            if door_cx - 2 <= x <= door_cx + 2 and y >= 22:
                continue
            d.point((q(x), q(y)), fill=wall_sh)

    def _roof_module(self, d, p, side: str, rng) -> None:
        w, h = self.size
        ink, roof = self._ink(), self._rgba(p["roof"])
        hi, sh = self._rgba(color.lighten(p["roof"], .25)), self._rgba(color.darken(p["roof"], .34))
        d.rectangle((0, 0, w - 1, h - 1), fill=ink)
        d.rectangle((1, 1, w - 2, h - 4), fill=roof)
        if side == "left":
            d.polygon([(0, 0), (w - 1, 0), (0, h - 1)], fill=ink)
            d.polygon([(1, 1), (w - 2, 1), (1, h - 3)], fill=roof)
        elif side == "right":
            d.polygon([(0, 0), (w - 1, 0), (w - 1, h - 1)], fill=ink)
            d.polygon([(1, 1), (w - 2, 1), (w - 2, h - 3)], fill=roof)
        for y in range(4, h - 4, 5):
            d.line((1, y, w - 2, y), fill=sh)
        d.line((2, 2, w - 3, 2), fill=hi)
        d.line((0, h - 3, w - 1, h - 3), fill=sh, width=2)

    def _wall_module(self, d, p, side: str, rng) -> None:
        w, h = self.size
        ink, wall, wood = self._ink(), self._rgba(p["wall"]), self._rgba(p["wood"])
        trim = self._rgba(p["trim"])
        d.rectangle((0, 0, w - 1, h - 1), fill=ink)
        d.rectangle((1, 1, w - 2, h - 2), fill=wall)
        d.line((1, 2, w - 2, 2), fill=trim)
        if side in ("left", "right"):
            x = 3 if side == "left" else w - 4
            d.rectangle((x, 1, x + 1, h - 2), fill=wood)
        if side == "mid":
            d.rectangle((w // 2 - 3, h // 2 - 4, w // 2 + 3, h // 2 + 3), fill=ink)
            d.rectangle((w // 2 - 2, h // 2 - 3, w // 2 + 2, h // 2 + 2), fill=self._rgba(p["accent"]))
            d.line((w // 2, h // 2 - 3, w // 2, h // 2 + 2), fill=trim)
            d.line((w // 2 - 2, h // 2, w // 2 + 2, h // 2), fill=trim)

    def _door_module(self, d, p, rng) -> None:
        w, h = self.size
        ink, wood = self._ink(), self._rgba(p["wood"])
        hi, sh = self._rgba(color.lighten(p["wood"], .25)), self._rgba(color.darken(p["wood"], .38))
        d.rectangle((0, 0, w - 1, h - 1), fill=self._rgba(p["wall"]))
        d.rectangle((w // 2 - 7, 5, w // 2 + 7, h - 1), fill=ink)
        d.rectangle((w // 2 - 6, 6, w // 2 + 5, h - 1), fill=wood)
        d.line((w // 2 - 5, 7, w // 2 - 5, h - 2), fill=hi)
        d.line((w // 2 + 5, 7, w // 2 + 5, h - 2), fill=sh)
        d.line((w // 2 - 5, h // 2, w // 2 + 5, h // 2), fill=sh)
        d.point((w // 2 + 3, h // 2 + 4), fill=self._rgba(p["accent"]))

    def _floor(self, d, p, rng) -> None:
        w, h = self.size
        base, sh, hi = self._rgba(p["floor"]), self._rgba(color.darken(p["floor"], .28)), self._rgba(color.lighten(p["floor"], .16))
        d.rectangle((0, 0, w - 1, h - 1), fill=base)
        plank_h = max(4, h // 5)
        for y in range(0, h, plank_h):
            d.line((0, y, w - 1, y), fill=sh)
            offset = (y // plank_h % 2) * (w // 4)
            for x in range(offset, w, max(7, w // 2)):
                d.line((x, y + 1, x, min(h - 1, y + plank_h - 1)), fill=sh)
            d.line((1, min(h - 1, y + 1), w - 2, min(h - 1, y + 1)), fill=hi)

    def _interior_wall(self, d, p, rng) -> None:
        w, h = self.size
        wall, trim = self._rgba(p["wall"]), self._rgba(p["trim"])
        sh = self._rgba(color.darken(p["wall"], .30))
        d.rectangle((0, 0, w - 1, h - 1), fill=wall)
        d.rectangle((0, h - 7, w - 1, h - 1), fill=sh)
        d.line((0, h - 8, w - 1, h - 8), fill=trim, width=2)
        for x in range(3, w, 8):
            d.line((x, 1, x, h - 9), fill=sh)
            d.point((x + 1, 2), fill=trim)

    def _furnishing(self, d, p, part: str, rng) -> None:
        w, h = self.size
        ink, wood, accent = self._ink(), self._rgba(p["wood"]), self._rgba(p["accent"])
        hi, sh = self._rgba(color.lighten(p["wood"], .24)), self._rgba(color.darken(p["wood"], .36))
        trim = self._rgba(p["trim"])
        if part == "bed":
            d.rectangle((3, 8, w - 4, h - 4), fill=ink); d.rectangle((4, 9, w - 5, h - 5), fill=wood)
            d.rectangle((6, 11, w - 6, h // 2 + 2), fill=accent); d.line((6, h // 2 + 4, w - 6, h // 2 + 4), fill=hi)
            # Pillow + folded blanket stripe
            d.rectangle((7, 10, w // 2, 13), fill=trim)
            if rng.random() < 0.6:
                d.line((6, h // 2, w - 6, h // 2), fill=trim)
        elif part in ("table", "workbench"):
            top = 8 if part == "table" else 6
            d.rectangle((3, top, w - 4, top + 7), fill=ink); d.rectangle((4, top + 1, w - 5, top + 5), fill=wood)
            d.line((5, top + 1, w - 6, top + 1), fill=hi)
            for x in (6, w - 7): d.rectangle((x, top + 7, x + 2, h - 4), fill=sh)
            if part == "workbench":
                d.rectangle((w // 2 - 3, top - 3, w // 2 + 3, top), fill=accent)
            elif rng.random() < 0.65:
                mx = rng.randint(6, w - 10)
                d.rectangle((mx, top - 2, mx + 2, top), fill=trim)
        elif part == "shelf":
            d.rectangle((4, 3, w - 5, h - 3), fill=ink); d.rectangle((5, 4, w - 6, h - 4), fill=wood)
            for y in range(8, h - 4, 7):
                d.line((5, y, w - 6, y), fill=sh)
                for x in range(7, w - 8, 5):
                    if rng.random() < 0.7:
                        d.rectangle((x, y - 3, x + 2, y - 1), fill=accent if rng.random() < 0.6 else trim)
        elif part == "hearth":
            d.rectangle((4, 5, w - 5, h - 3), fill=ink); d.rectangle((5, 6, w - 6, h - 4), fill=self._rgba(p["wall"]))
            d.rectangle((8, 13, w - 9, h - 5), fill=sh)
            fh = rng.randint(9, 12)
            d.polygon([(w // 2, fh), (w - 10, h - 6), (10, h - 6)], fill=accent)
            d.point((w // 2, fh + 3), fill=(255, 245, 195, 255))
        elif part == "lamp":
            d.line((w // 2, 3, w // 2, h - 6), fill=ink, width=2); d.line((w // 2 - 1, 4, w // 2 - 1, h - 7), fill=wood)
            r = rng.choice([4, 5])
            d.ellipse((w // 2 - r, 8, w // 2 + r, 8 + r * 2), fill=ink)
            d.ellipse((w // 2 - r + 2, 10, w // 2 + r - 2, 6 + r * 2), fill=accent)
        elif part == "rug":
            d.rectangle((3, 8, w - 4, h - 5), fill=ink); d.rectangle((4, 9, w - 5, h - 6), fill=accent)
            d.rectangle((6, 11, w - 7, h - 8), fill=sh)
            for x in range(8, w - 7, 5):
                d.line((x, 12, x, h - 9), fill=trim)
        for _ in range(2):
            d.point((rng.randint(2, w - 3), rng.randint(2, h - 3)), fill=hi)
