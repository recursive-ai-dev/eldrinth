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
        palette = _THEMES[theme_name]
        image = Image.new("RGBA", self.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        rng = self.rng(seed, theme_name, part, variant)
        spec = {
            "theme": theme_name,
            "part": part,
            "variant": variant,
            "size": list(self.size),
            "pipeline": {
                "grammar": "roof-facade-door-room-furnishing",
                "materials": "theme-ramp+integer-pixel-joinery",
                "composition": "modular-or-complete-cottage",
            },
        }

        if part == "cottage":
            self._cottage(draw, palette, rng)
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

    def _cottage(self, d: ImageDraw.ImageDraw, p: Dict[str, tuple], rng) -> None:
        """Draw a complete 3×3-tile frontage into any square sprite size."""
        w, h = self.size
        u = max(1, min(w, h) // 32)
        # One logical unit becomes three physical pixels for a 96px cottage,
        # preserving the same deliberate chunky language as a 32px module.
        def q(v): return int(v * u)
        ink = self._ink()
        roof, wall, trim, wood, accent = (self._rgba(p[n]) for n in ("roof", "wall", "trim", "wood", "accent"))
        roof_hi = self._rgba(color.lighten(p["roof"], 0.25))
        roof_sh = self._rgba(color.darken(p["roof"], 0.36))
        wall_sh = self._rgba(color.darken(p["wall"], 0.28))
        wood_hi = self._rgba(color.lighten(p["wood"], 0.24))
        # Foundation shadow makes the cottage feel planted, not pasted on.
        d.rectangle((q(3), q(29), q(28), q(31)), fill=ink)
        # Gabled roof and its under-eave shadow.
        d.polygon([(q(2), q(15)), (q(16), q(2)), (q(30), q(15)), (q(28), q(18)), (q(4), q(18))], fill=ink)
        d.polygon([(q(3), q(15)), (q(16), q(3)), (q(29), q(15)), (q(27), q(17)), (q(5), q(17))], fill=roof)
        d.line((q(5), q(14), q(16), q(4), q(27), q(14)), fill=roof_hi, width=u)
        for y in range(8, 17, 3):
            shift = (y - 8) // 3
            d.line((q(6 + shift), q(y), q(26 - shift), q(y)), fill=roof_sh, width=max(1, u))
        # Slate mottling doubles as a high-entropy, but still natural, roof
        # pattern. It preserves the generator's seed-to-pixels uniqueness
        # guarantee even when two cottages happen to share wall weathering.
        slate_marks = rng.next_u64()
        for mark in range(16):
            row, col = divmod(mark, 4)
            x, y = 9 + col * 4 + row, 7 + row * 2
            shade = (slate_marks >> (mark * 4)) & 0xF
            tone = color.mix(p["roof"], p["trim"], shade / 48.0)
            d.point((q(x), q(y)), fill=self._rgba(tone))
        d.rectangle((q(4), q(17), q(28), q(19)), fill=ink)
        d.rectangle((q(5), q(17), q(27), q(18)), fill=roof_sh)
        # Frontage with timber braces, lit window, and a readable doorway.
        d.rectangle((q(5), q(19), q(27), q(29)), fill=ink)
        d.rectangle((q(6), q(19), q(26), q(28)), fill=wall)
        d.line((q(6), q(20), q(26), q(20)), fill=trim, width=u)
        for x in (8, 24):
            d.rectangle((q(x), q(20), q(x + 1), q(28)), fill=wood)
            d.line((q(x), q(20), q(x), q(28)), fill=wood_hi, width=max(1, u))
        # A pair of asymmetric window panes keeps repeated cottages from reading as a wall.
        for x, y in ((11, 22), (19, 23)):
            d.rectangle((q(x - 2), q(y - 2), q(x + 2), q(y + 2)), fill=ink)
            d.rectangle((q(x - 1), q(y - 1), q(x + 1), q(y + 1)), fill=accent)
            d.point((q(x - 1), q(y - 1)), fill=(255, 244, 192, 255))
        d.rectangle((q(14), q(22), q(18), q(29)), fill=ink)
        d.rectangle((q(15), q(23), q(17), q(28)), fill=wood)
        d.line((q(15), q(23), q(15), q(28)), fill=wood_hi, width=max(1, u))
        d.point((q(17), q(26)), fill=accent)
        # Seed-derived weathering is local and never changes the silhouette.
        for _ in range(4):
            x = rng.randint(6, 26)
            y = rng.randint(20, 28)
            if 14 <= x <= 18 and y >= 22:
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
        if part == "bed":
            d.rectangle((3, 8, w - 4, h - 4), fill=ink); d.rectangle((4, 9, w - 5, h - 5), fill=wood)
            d.rectangle((6, 11, w - 6, h // 2 + 1), fill=accent); d.line((6, h // 2 + 3, w - 6, h // 2 + 3), fill=hi)
        elif part in ("table", "workbench"):
            top = 8 if part == "table" else 6
            d.rectangle((3, top, w - 4, top + 7), fill=ink); d.rectangle((4, top + 1, w - 5, top + 5), fill=wood)
            d.line((5, top + 1, w - 6, top + 1), fill=hi)
            for x in (6, w - 7): d.rectangle((x, top + 7, x + 2, h - 4), fill=sh)
            if part == "workbench": d.rectangle((w // 2 - 3, top - 3, w // 2 + 3, top), fill=accent)
        elif part == "shelf":
            d.rectangle((4, 3, w - 5, h - 3), fill=ink); d.rectangle((5, 4, w - 6, h - 4), fill=wood)
            for y in range(8, h - 4, 7): d.line((5, y, w - 6, y), fill=sh)
            for x in range(8, w - 7, 6): d.rectangle((x, 5, x + 2, 7), fill=accent)
        elif part == "hearth":
            d.rectangle((4, 5, w - 5, h - 3), fill=ink); d.rectangle((5, 6, w - 6, h - 4), fill=self._rgba(p["wall"]))
            d.rectangle((8, 13, w - 9, h - 5), fill=sh); d.polygon([(w // 2, 10), (w - 10, h - 6), (10, h - 6)], fill=accent)
        elif part == "lamp":
            d.line((w // 2, 3, w // 2, h - 6), fill=ink, width=2); d.line((w // 2 - 1, 4, w // 2 - 1, h - 7), fill=wood)
            d.ellipse((w // 2 - 5, 8, w // 2 + 5, 18), fill=ink); d.ellipse((w // 2 - 3, 10, w // 2 + 3, 16), fill=accent)
        elif part == "rug":
            d.rectangle((3, 8, w - 4, h - 5), fill=ink); d.rectangle((4, 9, w - 5, h - 6), fill=accent)
            for x in range(7, w - 6, 6): d.line((x, 10, x, h - 7), fill=hi)
        for _ in range(2):
            d.point((rng.randint(2, w - 3), rng.randint(2, h - 3)), fill=hi)
