#!/usr/bin/env python3
"""
Deterministic game hero scene (wide landscape) generator.
==========================================================

A 192x108 (16:9) illustrated landscape built from the other generators:

    * a mood-tinted, dithered sky with a sun or moon, stars or clouds,
    * two parallax ridges of hills fading into the horizon haze,
    * a terrain band of seamless tiles whose kind and palette come from the
      ``mood`` (the same :data:`~.cover.MOODS` as ``cover``),
    * ``settlement`` cottages on the far edge of the terrain, ``prop`` world
      anchors in the middle ground and a cast of ``creature`` / ``human``
      sprites in the foreground, all placed along the terrain by the seed,
    * mood particles, and the title drawn large (2x) at the top left.

Every choice comes from per-attribute forked RNGs (``self.rng(seed, name)``),
so the title never changes the composition and new attributes never shift
others.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Tuple

from PIL import Image

from .. import color
from ..font import GLYPH_H, SPACING, draw_text, text_width
from .base import SpriteGenerator
from .cover import MOODS, dimmed, fit_title, outlined
from .creature import CreatureSpriteGenerator
from .human import HumanSpriteGenerator
from .prop import PropSpriteGenerator
from .settlement import SettlementSpriteGenerator
from .tile import TileSpriteGenerator

W, H = 192, 108
TILE = 16
HORIZON = 66          # sky above, terrain below
SEED_RANGE = 2 ** 31
TITLE_X, TITLE_Y = 6, 6
TITLE_SCALE = 2
TITLE_MAX_LINES = 2
SKY_BANDS = 6
LEAD_MAX_UPSCALE = 20  # a lead sprite this small (cropped) is drawn 2x

#: mood -> the scene-only dressing (terrain colours come from ``MOODS``).
SCENE_MOODS: Dict[str, Dict[str, Any]] = {
    "dark": {"sky": ((14, 10, 26), (78, 44, 70)), "orb": "moon", "orb_color": (255, 214, 170),
             "sky_detail": "stars", "particles": "embers", "theme": "oldstone",
             "props": ("brazier", "lantern", "sign")},
    "cold": {"sky": ((24, 44, 92), (168, 200, 228)), "orb": "moon", "orb_color": (240, 248, 255),
             "sky_detail": "stars", "particles": "snow", "theme": "coastal",
             "props": ("lantern", "sign", "campfire")},
    "warm": {"sky": ((92, 38, 70), (252, 170, 90)), "orb": "sunset", "orb_color": (255, 236, 150),
             "sky_detail": "clouds", "particles": "dust", "theme": "cinder",
             "props": ("campfire", "sign", "brazier")},
    "eerie": {"sky": ((8, 20, 16), (60, 96, 70)), "orb": "moon", "orb_color": (200, 255, 170),
              "sky_detail": "stars", "particles": "fireflies", "theme": "moor",
              "props": ("lantern", "brazier", "sign")},
    "wild": {"sky": ((58, 120, 196), (186, 226, 236)), "orb": "sun", "orb_color": (255, 250, 210),
             "sky_detail": "clouds", "particles": "pollen", "theme": "oldstone",
             "props": ("sign", "campfire", "lantern")},
}

_CAST = {"creature": CreatureSpriteGenerator, "human": HumanSpriteGenerator}

# 4x4 Bayer matrix: ordered dithering between sky bands keeps it pixel-art.
_BAYER = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))


class SceneSpriteGenerator(SpriteGenerator):
    """Wide hero landscape: mood sky + terrain + village, props and cast + title."""

    type_name = "scene"
    default_size = (W, H)

    def _build(self, seed: int, **options) -> Tuple[Dict[str, Any], Image.Image]:
        title = str(options.get("title") or "")
        mood = options.get("mood") or "dark"
        if mood not in MOODS:
            raise ValueError(f"Unknown scene mood {mood!r}. Known: {sorted(MOODS)}")
        style = {**MOODS[mood], **SCENE_MOODS[mood]}

        img = Image.new("RGBA", (W, H), (0, 0, 0, 255))
        self._sky(img, style)
        orb = self._orb(img, seed, style)
        self._sky_detail(img, seed, style, orb)
        self._ridges(img, seed, style)
        self._terrain(img, seed, style)

        placed = self._settlements(seed, style) + self._props(seed, style) + self._cast(seed)
        for item, sprite_img in sorted(placed, key=lambda p: p[0]["y"] + p[1].height):
            if item["row"] != "back":
                self._shadow(img, item, sprite_img)
            if item["row"] != "front":
                haze = 0.35 if item["row"] == "back" else 0.0
                sprite_img = _hazed(dimmed(sprite_img, style["tint"]), style["sky"][1], haze)
            img.alpha_composite(sprite_img, (item["x"], item["y"]))

        self._particles(img, seed, style)
        self._vignette(img)
        lines = self._title(img, title, style)

        spec = {
            "mood": mood,
            "tile_kind": style["kind"],
            "tile_palette": style["palette"],
            "tile_seed": self.rand_seed(seed, "terrain", high=SEED_RANGE),
            "orb": {"kind": style["orb"], "x": orb[0], "y": orb[1], "r": orb[2]},
            "title": title,
            "title_lines": lines,
            "title_scale": TITLE_SCALE,
            "placed": [{k: v for k, v in p.items() if k != "anchor"} for p, _ in placed],
        }
        return spec, img

    # -- sky -------------------------------------------------------------------
    def _sky(self, img: Image.Image, style) -> None:
        top, low = style["sky"]
        bands = [color.mix(top, low, i / (SKY_BANDS - 1)) for i in range(SKY_BANDS)]
        px = img.load()
        for y in range(HORIZON):
            t = (y / float(HORIZON - 1)) * (SKY_BANDS - 1)
            band = min(int(t), SKY_BANDS - 2)
            frac = t - band
            for x in range(W):
                c = bands[band + 1] if frac * 16 > _BAYER[y % 4][x % 4] else bands[band]
                px[x, y] = (*c, 255)

    def _orb(self, img: Image.Image, seed: int, style) -> Tuple[int, int, int]:
        rng = self.rng(seed, "orb")
        if style["orb"] == "sunset":
            # a big sun sitting low on the horizon, behind the hills
            r = rng.randint(14, 18)
            cx, cy = rng.randint(112, 168), HORIZON - rng.randint(4, 10)
        else:
            r = rng.randint(6, 10)
            cx, cy = rng.randint(120, 176), rng.randint(14, 30)
        core = style["orb_color"]
        px = img.load()
        for y in range(max(0, cy - 3 * r), min(HORIZON, cy + 3 * r + 1)):
            for x in range(max(0, cx - 3 * r), min(W, cx + 3 * r + 1)):
                d = math.hypot(x - cx + 0.5, y - cy + 0.5) / r
                base = px[x, y][:3]
                if d <= 1.0:
                    c = core
                    if style["orb"] == "moon" and math.hypot(x - cx - r * 0.35, y - cy + r * 0.2) / r < 0.32:
                        c = color.darken(core, 0.12)        # a single crater
                    if style["orb"] == "sunset" and d > 0.2 and (y - cy) % 4 == 3 and y > cy:
                        c = color.mix(core, style["sky"][1], 0.55)  # retro sun stripes
                    px[x, y] = (*c, 255)
                elif d <= 1.5 and (d < 1.25 or (x + y) % 2 == 0):
                    # quantised halo: solid ring, then a checker-dithered fringe
                    px[x, y] = (*color.mix(base, core, 0.35), 255)
                elif d <= 3.0:
                    # two faint glow bands fading into the sky
                    px[x, y] = (*color.mix(base, core, 0.10 if d < 2.2 else 0.04), 255)
        return cx, cy, r

    def _sky_detail(self, img: Image.Image, seed: int, style, orb) -> None:
        rng = self.rng(seed, "sky-detail")
        px = img.load()
        ox, oy, r = orb
        if style["sky_detail"] == "stars":
            for _ in range(rng.randint(30, 46)):
                x, y = rng.randint(0, W - 1), rng.randint(0, HORIZON - 22)
                if math.hypot(x - ox, y - oy) < 2.2 * r:
                    continue
                bright = rng.random()
                c = color.mix(px[x, y][:3], (255, 255, 240), 0.35 + 0.55 * bright)
                px[x, y] = (*c, 255)
                if bright > 0.88 and 0 < x < W - 1 and 0 < y:
                    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                        px[nx, ny] = (*color.mix(px[nx, ny][:3], (255, 255, 240), 0.35), 255)
            return
        light = color.lighten(style["sky"][1], 0.35)
        shade = color.mix(style["sky"][1], style["sky"][0], 0.25)
        for _ in range(rng.randint(3, 5)):
            cx, cy = rng.randint(-10, W + 10), rng.randint(8, HORIZON - 26)
            puffs = [(cx + rng.randint(-14, 14), cy + rng.randint(-2, 2), rng.randint(4, 8))
                     for _ in range(rng.randint(3, 5))]
            floor_y = max(py for _, py, _ in puffs) + 2
            for y in range(max(0, cy - 12), min(HORIZON, floor_y + 1)):
                for x in range(max(0, cx - 26), min(W, cx + 27)):
                    inside = [((x - px_) / (pr * 1.6)) ** 2 + ((y - py) / pr) ** 2 for px_, py, pr in puffs]
                    d = min(inside)
                    if d <= 1.0:
                        c = shade if y >= floor_y - 2 else light
                        if d > 0.7 and y < floor_y - 2:
                            c = color.mix(light, shade, 0.3)
                        px[x, y] = (*color.mix(px[x, y][:3], c, 0.85), 255)

    def _ridges(self, img: Image.Image, seed: int, style) -> None:
        """Two parallax hill silhouettes, the far one lost in horizon haze."""
        top, low = style["sky"]
        far = color.mix(color.mix(low, style["tint"], 0.45), top, 0.25)
        near = color.darken(color.mix(far, style["tint"], 0.4), 0.3)
        px = img.load()
        for name, base_y, amp, step, fill in (("ridge-far", HORIZON - 14, 12, 28, far),
                                              ("ridge-near", HORIZON - 5, 7, 18, near)):
            heights = _ridge(self.rng(seed, name), base_y, amp, step)
            rim = color.lighten(fill, 0.12)
            for x in range(W):
                for y in range(max(0, heights[x]), HORIZON):
                    px[x, y] = (*(rim if y == heights[x] else fill), 255)

    # -- terrain ---------------------------------------------------------------
    def _terrain(self, img: Image.Image, seed: int, style) -> None:
        tile_seed = self.rand_seed(seed, "terrain", high=SEED_RANGE)
        floor = TileSpriteGenerator().generate(tile_seed, kind=style["kind"],
                                               palette=style["palette"]).image
        for ty in range(HORIZON, H, TILE):
            for tx in range(0, W, TILE):
                img.alpha_composite(floor, (tx, ty))
        px = img.load()
        haze = style["sky"][1]
        for y in range(HORIZON, H):
            depth = (y - HORIZON) / float(H - HORIZON)
            # banded grading: hazy toward the horizon, darker toward the viewer
            step = int(depth * 5) / 5.0
            for x in range(W):
                c = color.mix(px[x, y][:3], style["tint"], 0.22)
                c = color.mix(c, haze, 0.35 * (1.0 - step))
                c = color.darken(c, 0.06 + 0.32 * step)
                px[x, y] = (*c, 255)
        edge = color.mix(style["light"], haze, 0.4)
        for x in range(W):
            px[x, HORIZON] = (*color.mix(px[x, HORIZON][:3], edge, 0.5), 255)

    # -- placement ---------------------------------------------------------------
    def _settlements(self, seed: int, style) -> List[Tuple[Dict[str, Any], Image.Image]]:
        rng = self.rng(seed, "settlements")
        lots = rng.sample([22, 52, 82, 112, 142, 172], rng.randint(1, 3))
        out = []
        for i, cx in enumerate(sorted(lots)):
            sub_seed = self.rand_seed(seed, "settlement-seed", i, high=SEED_RANGE)
            raw = SettlementSpriteGenerator().generate(
                sub_seed, theme=style["theme"], part="cottage").image
            raw = raw.crop(raw.getbbox() or (0, 0, 1, 1))
            sprite_img = outlined(raw)
            feet = HORIZON + 6 + rng.randint(0, 3)
            out.append(self._place("settlement", sub_seed, sprite_img, cx + rng.randint(-6, 6),
                                   feet, "back", 1, part="cottage", theme=style["theme"]))
        return out

    def _props(self, seed: int, style) -> List[Tuple[Dict[str, Any], Image.Image]]:
        rng = self.rng(seed, "props")
        lots = rng.sample([16, 48, 80, 112, 144, 176], rng.randint(1, 2))
        out = []
        for i, cx in enumerate(sorted(lots)):
            prop_type = rng.choice(style["props"])
            sub_seed = self.rand_seed(seed, "prop-seed", i, high=SEED_RANGE)
            raw = PropSpriteGenerator().generate(sub_seed, prop_type=prop_type).image
            raw = raw.crop(raw.getbbox() or (0, 0, 1, 1))
            feet = HORIZON + 18 + rng.randint(0, 6)
            out.append(self._place("prop", sub_seed, outlined(raw), cx + rng.randint(-6, 6),
                                   feet, "mid", 1, prop_type=prop_type))
        return out

    def _cast(self, seed: int) -> List[Tuple[Dict[str, Any], Image.Image]]:
        layout = self.rng(seed, "cast-layout")
        count = layout.randint(1, 3)
        lots = layout.sample([30, 70, 110, 150], count)
        out = []
        for i, cx in enumerate(lots):
            pick = self.rng(seed, "cast", i)
            kind = "creature" if pick.random() < 0.6 else "human"
            sub_seed = self.rand_seed(seed, "cast-seed", i, high=SEED_RANGE)
            raw = _CAST[kind]().generate(sub_seed).image
            raw = raw.crop(raw.getbbox() or (0, 0, 1, 1))
            # the lead steps up to the camera, unless it is already a big sprite
            scale = 2 if i == 0 and max(raw.size) <= LEAD_MAX_UPSCALE else 1
            big = raw.resize((raw.width * scale, raw.height * scale), Image.NEAREST)
            sprite_img = outlined(big)
            if pick.random() < 0.5:
                sprite_img = sprite_img.transpose(Image.FLIP_LEFT_RIGHT)
            feet = H - 4 - layout.randint(0, 6) if i == 0 else H - 8 - layout.randint(0, 10)
            out.append(self._place(kind, sub_seed, sprite_img, cx + layout.randint(-8, 8),
                                   feet, "front", scale))
        return out

    @staticmethod
    def _place(kind: str, sub_seed: int, sprite_img: Image.Image, cx: int, feet: int,
               row: str, scale: int, **extra) -> Tuple[Dict[str, Any], Image.Image]:
        x = max(1, min(cx - sprite_img.width // 2, W - 1 - sprite_img.width))
        y = max(1, min(feet - sprite_img.height, H - 1 - sprite_img.height))
        return ({"type": kind, "seed": sub_seed, "x": x, "y": y, "scale": scale,
                 "row": row, **extra}, sprite_img)

    def _shadow(self, img: Image.Image, placed, sprite_img) -> None:
        cx = placed["x"] + sprite_img.width / 2.0
        fy = placed["y"] + sprite_img.height - 1
        rx = max(4.0, sprite_img.width * 0.45)
        ry = max(1.5, rx * 0.2)
        px = img.load()
        for y in range(int(fy - ry), int(fy + ry) + 1):
            for x in range(int(cx - rx), int(cx + rx) + 1):
                if 0 <= x < W and 0 <= y < H:
                    if ((x - cx) / rx) ** 2 + ((y - fy) / ry) ** 2 <= 1.0:
                        px[x, y] = (*color.darken(px[x, y][:3], 0.4), 255)

    # -- atmosphere --------------------------------------------------------------
    def _particles(self, img: Image.Image, seed: int, style) -> None:
        rng = self.rng(seed, "particles")
        px = img.load()
        kind = style["particles"]
        count = {"snow": (60, 80), "embers": (14, 22), "fireflies": (16, 24),
                 "dust": (18, 26), "pollen": (14, 22)}[kind]
        tone = style["particle"]
        for _ in range(rng.randint(*count)):
            x, y = rng.randint(1, W - 2), rng.randint(1, H - 2)
            if kind in ("embers", "fireflies") and y < HORIZON - 20:
                y += HORIZON - 20       # these hang low, near the ground
            if kind == "fireflies":
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    px[nx, ny] = (*color.mix(px[nx, ny][:3], tone, 0.3), 255)
            px[x, y] = (*color.mix(px[x, y][:3], tone, 0.9 if kind != "dust" else 0.5), 255)
            if kind == "snow" and rng.random() < 0.25:
                px[x, y + 1] = (*color.mix(px[x, y + 1][:3], tone, 0.4), 255)

    def _vignette(self, img: Image.Image) -> None:
        px = img.load()
        cx, cy = (W - 1) / 2.0, (H - 1) / 2.0
        for y in range(H):
            for x in range(W):
                d = math.hypot((x - cx) / cx, (y - cy) / cy)
                if d > 0.95:
                    # quantised elliptical falloff: only the corners darken
                    amount = 0.08 * min(3, int((d - 0.95) / 0.12) + 1)
                    px[x, y] = (*color.darken(px[x, y][:3], amount), 255)
        for x in range(W):
            px[x, 0] = px[x, H - 1] = (12, 10, 16, 255)
        for y in range(H):
            px[0, y] = px[W - 1, y] = (12, 10, 16, 255)

    # -- title -------------------------------------------------------------------
    def _title(self, img: Image.Image, title: str, style) -> List[str]:
        avail = W - 2 * TITLE_X
        lines = fit_title(title, avail, scale=TITLE_SCALE, max_lines=TITLE_MAX_LINES)
        ink = color.darken(style["tint"], 0.85)
        line_h = (GLYPH_H + SPACING) * TITLE_SCALE
        for i, line in enumerate(lines):
            x, y = TITLE_X, TITLE_Y + i * line_h
            # heavy outline + drop shadow so the title holds over any sky
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1),
                           (1, 1), (2, 2), (1, 2), (2, 1)):
                draw_text(img, line, (x + dx, y + dy), ink, scale=TITLE_SCALE)
            draw_text(img, line, (x, y), style["title"], scale=TITLE_SCALE)
            # a one-pixel lit top edge on every glyph row reads as bevelled type
            _highlight_top(img, line, (x, y), style["title"], style["light"])
        return lines


def _ridge(rng, base_y: int, amp: int, step: int) -> List[int]:
    """Cosine-interpolated random heights every ``step`` px across the width."""
    knots = [base_y - rng.randint(0, amp) for _ in range(W // step + 2)]
    heights = []
    for x in range(W):
        i, t = divmod(x, step)
        f = (1 - math.cos(math.pi * t / step)) / 2
        heights.append(int(round(knots[i] * (1 - f) + knots[i + 1] * f)))
    return heights


def _hazed(sprite: Image.Image, haze: Tuple[int, int, int], amount: float) -> Image.Image:
    """Fade a far sprite toward the horizon haze colour."""
    if amount <= 0:
        return sprite
    out = sprite.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (*color.mix((r, g, b), haze, amount * 0.5), a)
    return out


def _highlight_top(img: Image.Image, line: str, xy: Tuple[int, int], fill, light) -> None:
    """Brighten the top pixel row of each glyph stroke (pixels whose upper
    neighbour is not title-coloured)."""
    x0, y0 = xy
    w = text_width(line, TITLE_SCALE)
    hi = (*color.lighten(color.mix(fill, light, 0.5), 0.2), 255)
    px = img.load()
    fill_px = (*fill, 255)
    edge = [(x, y)
            for y in range(max(0, y0), min(img.height, y0 + GLYPH_H * TITLE_SCALE))
            for x in range(max(0, x0), min(img.width, x0 + w))
            if px[x, y] == fill_px and (y == 0 or px[x, y - 1] != fill_px)]
    for x, y in edge:
        px[x, y] = hi
