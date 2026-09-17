#!/usr/bin/env python3
"""
Deterministic world prop generator (campfire, signposts, lanterns, braziers).
=============================================================================

Props provide high-visibility world anchors (safe resting zones, landmark
navigation posts, regional settlement fixtures). Like human and creature sprites,
they are rendered with integer-coordinate pixel math and cosine/named palettes.
"""

from __future__ import annotations

import math
from typing import Any, Dict, Tuple

from PIL import Image, ImageDraw

from ..pipeline import options_from
from .base import SpriteGenerator, Sprite


class PropSpriteGenerator(SpriteGenerator):
    """Deterministic pixel-art world prop generator."""

    type_name = "prop"
    default_size = (32, 32)
    animated = True

    def _build(self, seed: int, **options) -> Tuple[Dict[str, Any], Image.Image]:
        opt = options_from(options)
        prop_type = options.get("prop_type", "sign")
        frame = opt["frame"] % max(1, opt["frames"])
        w, h = self.size

        image = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(image)

        ink = (10, 9, 13, 255)
        shade = (32, 30, 36, 255)
        steel = (90, 94, 102, 255)
        steel_hi = (145, 148, 154, 255)
        wood_dark = (52, 36, 26, 255)
        wood_mid = (92, 52, 36, 255)
        wood_hi = (142, 88, 56, 255)
        board_mid = (168, 126, 86, 255)
        board_hi = (212, 172, 126, 255)
        fire_dark = (150, 34, 20, 255)
        fire_mid = (240, 105, 28, 255)
        fire_hi = (255, 195, 52, 255)
        fire_core = (255, 250, 205, 255)

        spec = {
            "prop_type": prop_type,
            "seed": seed,
            "frame": frame,
            "size": [w, h],
        }

        rng = self.rng(seed, prop_type)

        if prop_type == "campfire":
            # 1. Hearth stone ring (depth-sorted)
            # Rear stones
            for a in (180, 225, 270, 315, 0):
                rad = math.radians(a)
                sx = int(16 + math.cos(rad) * 9.5)
                sy = int(21 + math.sin(rad) * 4.5)
                d.ellipse((sx - 3, sy - 2, sx + 3, sy + 2), fill=ink)
                d.ellipse((sx - 2, sy - 2, sx + 2, sy + 1), fill=shade)
                d.point((sx, sy - 1), fill=steel)

            # 2. Ash pit & glowing charcoal bed
            d.ellipse((8, 18, 23, 25), fill=shade)
            d.line((11, 21, 20, 21), fill=fire_dark)
            d.point((13, 22), fill=fire_mid)
            d.point((18, 20), fill=fire_mid)

            # Cross logs
            d.line((9, 23, 22, 19), fill=wood_dark, width=2)
            d.line((10, 19, 21, 23), fill=wood_mid, width=2)

            # 3. Animated flame tongues (4 distinct frames)
            flame_shapes = [
                # Frame 0: High center lick, lean left
                {
                    "outer": [(10, 22), (14, 13), (15, 7), (18, 14), (21, 22), (16, 24)],
                    "mid": [(12, 21), (15, 10), (18, 18), (16, 23)],
                    "hi": [(14, 19), (15, 13), (17, 19)],
                    "spark": (14, 5),
                },
                # Frame 1: Dancing peak, split tongue
                {
                    "outer": [(9, 22), (13, 15), (14, 6), (17, 12), (20, 8), (22, 22), (16, 24)],
                    "mid": [(11, 21), (14, 9), (17, 15), (19, 12), (18, 21), (15, 23)],
                    "hi": [(13, 18), (14, 12), (17, 17)],
                    "spark": (19, 6),
                },
                # Frame 2: Broad roaring blaze
                {
                    "outer": [(10, 22), (12, 13), (16, 5), (19, 13), (22, 22), (16, 24)],
                    "mid": [(12, 21), (16, 8), (19, 16), (17, 22)],
                    "hi": [(14, 19), (16, 11), (18, 19)],
                    "spark": (16, 3),
                },
                # Frame 3: Wind-swept tongue, right lean
                {
                    "outer": [(9, 22), (13, 14), (17, 6), (20, 14), (22, 22), (16, 24)],
                    "mid": [(11, 21), (16, 9), (19, 16), (17, 22)],
                    "hi": [(13, 18), (16, 12), (18, 18)],
                    "spark": (18, 4),
                },
            ]
            f = flame_shapes[frame % 4]
            d.polygon(f["outer"], fill=fire_dark)
            d.polygon(f["mid"], fill=fire_mid)
            d.polygon(f["hi"], fill=fire_hi)
            d.point((16, 17), fill=fire_core)
            d.point((15, 18), fill=fire_core)
            d.point(f["spark"], fill=fire_hi)

            # 4. Fore stones (overlapping logs and flame base)
            for a in (45, 90, 135):
                rad = math.radians(a)
                sx = int(16 + math.cos(rad) * 9.5)
                sy = int(21 + math.sin(rad) * 4.5)
                d.ellipse((sx - 3, sy - 2, sx + 3, sy + 2), fill=ink)
                d.ellipse((sx - 2, sy - 2, sx + 2, sy + 1), fill=steel)
                d.point((sx, sy - 1), fill=steel_hi)

        elif prop_type == "sign":
            # 1. Sturdy wooden post
            post_x = 14 + (rng.next_u64() % 3) - 1
            d.rectangle((post_x, 8, post_x + 3, 30), fill=ink)
            d.rectangle((post_x + 1, 9, post_x + 2, 29), fill=wood_mid)
            d.line((post_x + 1, 9, post_x + 1, 29), fill=wood_hi)
            d.line((post_x + 2, 9, post_x + 2, 29), fill=wood_dark)

            # Ground support stones
            num_stones = 2 + (rng.next_u64() % 3)
            for i in range(num_stones):
                gx = 8 + int(rng.uniform(0, 13))
                d.ellipse((gx, 28, gx + 4, 31), fill=ink)
                d.ellipse((gx + 1, 28, gx + 3, 30), fill=steel_hi if i % 2 == 0 else steel)

            # 2. Carved signboard with waypoint chevron
            pointing_left = (rng.next_u64() % 2) == 1
            sign_y = 7 + (rng.next_u64() % 3)
            if pointing_left:
                d.polygon([(6, sign_y + 5), (9, sign_y), (26, sign_y), (26, sign_y + 10), (9, sign_y + 10)], fill=ink)
                d.polygon([(7, sign_y + 5), (10, sign_y + 1), (25, sign_y + 1), (25, sign_y + 9), (10, sign_y + 9)], fill=board_mid)
                d.line((7, sign_y + 5, 10, sign_y + 1, 25, sign_y + 1), fill=board_hi)
            else:
                d.polygon([(6, sign_y), (23, sign_y), (26, sign_y + 5), (23, sign_y + 10), (6, sign_y + 10)], fill=ink)
                d.polygon([(7, sign_y + 1), (22, sign_y + 1), (25, sign_y + 5), (22, sign_y + 9), (7, sign_y + 9)], fill=board_mid)
                d.line((7, sign_y + 1, 22, sign_y + 1, 25, sign_y + 5), fill=board_hi)

            # 3. Weathered rune / direction notches
            notch_count = 1 + (rng.next_u64() % 4)
            for k in range(notch_count):
                ny = sign_y + 3 + (k % 3) * 2
                nx0 = 9 + (k * 3)
                d.line((nx0, ny, nx0 + 2, ny), fill=wood_dark)

            # 4. Iron mounting rivet
            rivet_x = post_x + 1
            d.rectangle((rivet_x, sign_y + 4, rivet_x + 1, sign_y + 5), fill=ink)
            d.point((rivet_x, sign_y + 4), fill=steel_hi)

            # Subtle wood grain / moss pixel based on seed
            for _ in range(4):
                mx = int(rng.uniform(7, 24))
                my = int(rng.uniform(sign_y + 1, sign_y + 8))
                d.point((mx, my), fill=(68, 114, 46, 255) if rng.random() < 0.4 else wood_hi)

        elif prop_type == "lantern":
            # Town lantern post
            d.rectangle((14, 12, 17, 30), fill=ink)
            d.rectangle((15, 13, 16, 29), fill=steel)
            d.line((15, 13, 15, 29), fill=steel_hi)
            # Stone pedestal base
            d.rectangle((12, 28, 19, 31), fill=ink)
            d.rectangle((13, 29, 18, 30), fill=shade)
            # Ornate cross arm & lantern cage
            d.line((12, 12, 19, 12), fill=ink, width=2)
            d.line((13, 12, 18, 12), fill=steel_hi)
            # Glass housing
            d.rectangle((13, 5, 18, 11), fill=ink)
            d.rectangle((14, 6, 17, 10), fill=(255, 220, 120, 240))
            d.point((15, 7 + (frame % 2)), fill=(255, 255, 220, 255))
            d.point((16, 8), fill=(255, 180, 50, 255))
            # Pagoda hood
            d.polygon([(11, 6), (16, 2), (20, 6)], fill=ink)
            d.polygon([(12, 5), (16, 3), (19, 5)], fill=steel_hi)

        elif prop_type == "brazier":
            # Stone dungeon brazier with arcane embers
            d.rectangle((11, 20, 20, 30), fill=ink)
            d.rectangle((12, 21, 19, 29), fill=shade)
            d.line((12, 21, 19, 21), fill=steel_hi)
            # Bowl rim
            d.polygon([(8, 15), (23, 15), (20, 21), (11, 21)], fill=ink)
            d.polygon([(9, 16), (22, 16), (19, 20), (12, 20)], fill=steel)
            # Arcane glowing flame tongues (animated)
            c_hi = (185, 245, 235, 255)
            c_mid = (55, 195, 190, 255)
            c_dark = (24, 75, 82, 255)
            tongues = [
                [(11, 16), (15, 8), (17, 12), (20, 16)],
                [(12, 16), (16, 7), (18, 11), (21, 16)],
                [(10, 16), (14, 10), (16, 6), (20, 16)],
                [(11, 16), (15, 7), (18, 13), (21, 16)],
            ]
            tg = tongues[frame % 4]
            d.polygon(tg, fill=c_dark)
            d.polygon([(tg[0][0] + 1, 16), (tg[1][0], tg[1][1] + 2), (tg[2][0], tg[2][1] + 2), (tg[3][0] - 1, 16)], fill=c_mid)
            d.point((tg[1][0], tg[1][1] + 1), fill=c_hi)

        return spec, image
