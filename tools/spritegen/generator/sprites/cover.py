#!/usr/bin/env python3
"""
Deterministic game cover (gallery thumbnail) generator.
=======================================================

A 96x96 illustrated card composed from the other generators:

    * a backdrop + floor of seamless terrain tiles whose kind and palette come
      from the ``mood`` (one of :data:`MOODS`), colour-graded, lit and vignetted,
    * a cast of 2-4 ``creature`` / ``item`` / ``human`` sprites, cropped and
      nearest-neighbour upscaled 2x or 3x into fixed stage slots,
    * mood particles, and the title in the 5x7 pixel font on a darkened band.

Every choice comes from per-attribute forked RNGs (``self.rng(seed, name)``),
so the title never changes the scene and new attributes never shift others.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from PIL import Image

from .. import color
from ..font import GLYPH_H, SPACING, draw_text, text_width, wrap_lines
from .base import SpriteGenerator
from .creature import CreatureSpriteGenerator
from .human import HumanSpriteGenerator
from .item import ItemSpriteGenerator
from .tile import TileSpriteGenerator

#: mood -> terrain kind/palette and the colours used to grade and dress it.
MOODS: Dict[str, Dict[str, Any]] = {
    "dark": {"kind": "stone", "palette": "grim_steel", "tint": (40, 30, 70),
             "light": (255, 190, 120), "particle": (255, 150, 70), "title": (235, 225, 210)},
    "cold": {"kind": "snow", "palette": "snow", "tint": (70, 110, 170),
             "light": (220, 240, 255), "particle": (255, 255, 255), "title": (225, 245, 255)},
    "warm": {"kind": "sand", "palette": "sand", "tint": (200, 90, 40),
             "light": (255, 220, 140), "particle": (255, 240, 180), "title": (255, 230, 170)},
    "eerie": {"kind": "moss", "palette": "sickly_green", "tint": (50, 90, 60),
              "light": (170, 255, 150), "particle": (190, 255, 120), "title": (200, 255, 190)},
    "wild": {"kind": "grass", "palette": "grass", "tint": (60, 120, 50),
             "light": (255, 245, 170), "particle": (255, 235, 120), "title": (255, 250, 220)},
}

SIZE = 96
TILE = 16
HORIZON = 40          # backdrop above, floor below
BAND_MAX_LINES = 2
TITLE_PAD = 3
SEED_RANGE = 2 ** 31
TINY = 12             # cropped sprites this small are upscaled 3x, others 2x

_CAST = {
    "creature": CreatureSpriteGenerator,
    "item": ItemSpriteGenerator,
    "human": HumanSpriteGenerator,
}

# Stage layouts by cast size: (slot, centre x, anchor y, anchor).  "feet"
# anchors the sprite's bottom edge to the floor; "centre" floats it.  The lead
# stands in front; everyone else is a step back and atmospherically dimmed.
_LAYOUTS = {
    2: (("lead", 36, 76, "feet"), ("right", 70, 70, "feet")),
    3: (("lead", 48, 76, "feet"), ("left", 20, 66, "feet"), ("right", 76, 66, "feet")),
    4: (("lead", 48, 76, "feet"), ("left", 20, 66, "feet"), ("right", 76, 66, "feet"),
        ("sky", 48, 18, "centre")),
}


class CoverSpriteGenerator(SpriteGenerator):
    """Illustrated title card: mood terrain + a small cast + pixel-font title."""

    type_name = "cover"
    default_size = (SIZE, SIZE)

    def _build(self, seed: int, **options) -> Tuple[Dict[str, Any], Image.Image]:
        title = str(options.get("title") or "")
        mood = options.get("mood") or "dark"
        if mood not in MOODS:
            raise ValueError(f"Unknown cover mood {mood!r}. Known: {sorted(MOODS)}")
        style = MOODS[mood]

        img = self._backdrop(seed, style)
        cast = self._cast(seed)
        self._light_pool(img, cast[0], style)
        self._particles(img, seed, style)
        for placed, sprite_img in self._ordered(cast):
            if placed["anchor"] == "feet":
                self._shadow(img, placed, sprite_img)
            if placed["slot"] != "lead":
                sprite_img = dimmed(sprite_img, style["tint"])
            img.alpha_composite(sprite_img, (placed["x"], placed["y"]))
        self._vignette(img)
        lines = self._title(img, title, style)

        spec = {
            "mood": mood,
            "tile_kind": style["kind"],
            "tile_palette": style["palette"],
            "tile_seed": self.rand_seed(seed, "terrain", high=SEED_RANGE),
            "title": title,
            "title_lines": lines,
            "sprites": [{k: p[k] for k in ("type", "seed", "x", "y", "scale", "slot")}
                        for p, _ in cast],
        }
        return spec, img

    # -- background ----------------------------------------------------------
    def _backdrop(self, seed: int, style: Dict[str, Any]) -> Image.Image:
        tiles = TileSpriteGenerator()
        tile_seed = self.rand_seed(seed, "terrain", high=SEED_RANGE)
        floor = tiles.generate(tile_seed, kind=style["kind"], palette=style["palette"]).image
        img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 255))
        for ty in range(0, SIZE, TILE):
            for tx in range(0, SIZE, TILE):
                img.alpha_composite(floor, (tx, ty))

        tint = style["tint"]
        px = img.load()
        for y in range(SIZE):
            if y < HORIZON:
                # backdrop: deep, tinted, brightening towards the horizon
                depth = y / float(HORIZON)
                amount, dark = 0.55, 0.62 - 0.30 * depth
            else:
                # floor: lightly graded, darker toward the front edge
                depth = (y - HORIZON) / float(SIZE - HORIZON)
                amount, dark = 0.22, 0.05 + 0.25 * depth
            for x in range(SIZE):
                c = px[x, y][:3]
                c = color.mix(c, tint, amount)
                c = color.darken(c, dark)
                px[x, y] = (*c, 255)
        hl = color.mix(style["light"], tint, 0.5)
        for x in range(SIZE):
            px[x, HORIZON] = (*color.mix(px[x, HORIZON][:3], hl, 0.45), 255)
            px[x, HORIZON - 1] = (*color.darken(px[x, HORIZON - 1][:3], 0.35), 255)
        return img

    def _light_pool(self, img: Image.Image, lead, style) -> None:
        placed, sprite_img = lead
        cx = placed["x"] + sprite_img.width // 2
        cy = placed["y"] + sprite_img.height // 2
        rx, ry = 40.0, 34.0
        px = img.load()
        for y in range(SIZE):
            for x in range(SIZE):
                d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
                if d < 1.0:
                    # quantised falloff keeps the glow pixel-art banded
                    level = int((1.0 - d) * 4) / 4.0
                    if level > 0:
                        c = color.mix(px[x, y][:3], style["light"], 0.16 * level)
                        px[x, y] = (*c, 255)

    def _vignette(self, img: Image.Image) -> None:
        px = img.load()
        c = (SIZE - 1) / 2.0
        for y in range(SIZE):
            for x in range(SIZE):
                d = max(abs(x - c), abs(y - c)) / c
                if d > 0.72:
                    amount = 0.12 * int((d - 0.72) / 0.28 * 4 + 1)
                    px[x, y] = (*color.darken(px[x, y][:3], min(amount, 0.5)), 255)
        for i in range(SIZE):
            for (x, y) in ((i, 0), (i, SIZE - 1), (0, i), (SIZE - 1, i)):
                px[x, y] = (12, 10, 16, 255)

    def _particles(self, img: Image.Image, seed: int, style) -> None:
        rng = self.rng(seed, "particles")
        px = img.load()
        for _ in range(rng.randint(10, 18)):
            x, y = rng.randint(2, SIZE - 3), rng.randint(2, SIZE - 22)
            base = px[x, y][:3]
            px[x, y] = (*color.mix(base, style["particle"], 0.85), 255)
            if rng.random() < 0.3:
                px[x + 1, y] = (*color.mix(px[x + 1, y][:3], style["particle"], 0.4), 255)

    # -- cast ------------------------------------------------------------------
    def _cast(self, seed: int) -> List[Tuple[Dict[str, Any], Image.Image]]:
        layout = self.rng(seed, "layout")
        count = layout.randint(2, 4)
        cast = []
        for i, (slot, cx, ay, anchor) in enumerate(_LAYOUTS[count]):
            pick = self.rng(seed, "cast", i)
            if slot == "sky":
                kind = "item"
            elif slot == "lead":
                kind = "creature" if pick.random() < 0.65 else "human"
            else:
                kind = pick.choice(["creature", "human", "human", "item"])
            sub_seed = self.rand_seed(seed, "cast-seed", i, high=SEED_RANGE)
            raw = _CAST[kind]().generate(sub_seed).image
            raw = raw.crop(raw.getbbox() or (0, 0, 1, 1))
            scale = 3 if max(raw.size) <= TINY else 2
            big = outlined(raw.resize((raw.width * scale, raw.height * scale), Image.NEAREST))
            if slot == "right" and pick.random() < 0.5:
                big = big.transpose(Image.FLIP_LEFT_RIGHT)
            jitter = layout.randint(-4, 4)
            x = cx + jitter - big.width // 2
            y = ay - big.height if anchor == "feet" else ay - big.height // 2
            x = max(1, min(x, SIZE - 1 - big.width))
            y = max(1, min(y, SIZE - 1 - big.height))
            cast.append(({"type": kind, "seed": sub_seed, "x": x, "y": y, "scale": scale,
                          "slot": slot, "anchor": anchor}, big))
        return cast

    @staticmethod
    def _ordered(cast):
        """Paint back-to-front: floating items, then by feet line."""
        return sorted(cast, key=lambda c: (c[0]["anchor"] == "feet",
                                           c[0]["y"] + c[1].height))

    def _shadow(self, img: Image.Image, placed, sprite_img) -> None:
        cx = placed["x"] + sprite_img.width / 2.0
        fy = placed["y"] + sprite_img.height - 1
        rx = max(4.0, sprite_img.width * 0.42)
        ry = max(2.0, rx * 0.22)
        px = img.load()
        for y in range(int(fy - ry), int(fy + ry) + 1):
            for x in range(int(cx - rx), int(cx + rx) + 1):
                if 0 <= x < SIZE and 0 <= y < SIZE:
                    if ((x - cx) / rx) ** 2 + ((y - fy) / ry) ** 2 <= 1.0:
                        px[x, y] = (*color.darken(px[x, y][:3], 0.45), 255)

    # -- title -----------------------------------------------------------------
    def _title(self, img: Image.Image, title: str, style) -> List[str]:
        avail = SIZE - 2 * TITLE_PAD
        lines = fit_title(title, avail)
        if not lines:
            return []
        line_h = GLYPH_H + SPACING
        band_h = len(lines) * line_h - SPACING + 2 * TITLE_PAD + 1
        top = SIZE - band_h

        px = img.load()
        accent = color.mix(style["light"], style["tint"], 0.35)
        for y in range(top, SIZE - 1):
            for x in range(1, SIZE - 1):
                px[x, y] = (*color.darken(color.mix(px[x, y][:3], style["tint"], 0.3), 0.72), 255)
        for x in range(1, SIZE - 1):
            px[x, top] = (*color.mix(px[x, top][:3], accent, 0.7), 255)

        shadow = color.darken(style["tint"], 0.8)
        for i, line in enumerate(lines):
            w = text_width(line)
            lx = (SIZE - w) // 2
            ly = top + TITLE_PAD + 1 + i * line_h
            draw_text(img, line, (lx + 1, ly + 1), shadow)
            draw_text(img, line, (lx, ly), style["title"])
        return lines


def fit_title(title: str, avail: int, scale: int = 1,
              max_lines: int = BAND_MAX_LINES) -> List[str]:
    """Upper-case, wrap to ``avail`` px at font ``scale`` and keep at most
    ``max_lines`` lines; any line that is cut short (or too wide) ends in an
    ellipsis."""
    lines = wrap_lines(" ".join(title.upper().split()), avail, scale)
    if lines == [""]:
        return []
    cut = len(lines) > max_lines
    lines = lines[:max_lines]
    for i, line in enumerate(lines):
        if text_width(line, scale) > avail or (cut and i == len(lines) - 1):
            while line and text_width(line + "...", scale) > avail:
                line = line[:-1].rstrip()
            lines[i] = line + "..."
    return lines


def outlined(sprite: Image.Image, ink: Tuple[int, int, int, int] = (10, 8, 14, 255)) -> Image.Image:
    """Pad by 1px and ring the opaque silhouette with a dark sticker outline,
    so overlapping cast members stay separable at thumbnail size."""
    w, h = sprite.size
    out = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    out.alpha_composite(sprite, (1, 1))
    src, dst = out.load(), out.copy()
    ring = dst.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if src[x, y][3]:
                continue
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w + 2 and 0 <= ny < h + 2 and src[nx, ny][3]:
                    ring[x, y] = ink
                    break
    return dst


def dimmed(sprite: Image.Image, tint: Tuple[int, int, int]) -> Image.Image:
    """Push a back-row sprite into the scene's air: tint and darken it."""
    out = sprite.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (*color.darken(color.mix((r, g, b), tint, 0.25), 0.18), a)
    return out
