#!/usr/bin/env python3
"""
Deterministic world prop generator (campfire, signposts, interactive relics).
=============================================================================

Props provide high-visibility world anchors (safe resting zones, landmark
navigation posts). Like human and creature sprites, they are rendered with
integer-coordinate pixel math and cosine/named palettes.
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
            d.rectangle((14, 8, 17, 30), fill=ink)
            d.rectangle((15, 9, 16, 29), fill=wood_mid)
            d.line((15, 9, 15, 29), fill=wood_hi)
            d.line((16, 9, 16, 29), fill=wood_dark)

            # Ground support stones
            d.ellipse((11, 28, 15, 31), fill=ink)
            d.ellipse((12, 28, 14, 30), fill=steel)
            d.ellipse((16, 28, 20, 31), fill=ink)
            d.ellipse((17, 28, 19, 30), fill=steel_hi)

            # 2. Carved signboard with waypoint chevron
            d.polygon([(6, 7), (23, 7), (26, 12), (23, 17), (6, 17)], fill=ink)
            d.polygon([(7, 8), (22, 8), (25, 12), (22, 16), (7, 16)], fill=board_mid)
            d.line((7, 8, 22, 8, 25, 12), fill=board_hi)
            d.line((7, 16, 22, 16, 25, 12), fill=wood_dark)

            # 3. Weathered rune / direction notches
            d.line((9, 11, 20, 11), fill=wood_dark)
            d.line((9, 13, 17, 13), fill=wood_dark)

            # 4. Iron mounting rivet
            d.rectangle((15, 11, 16, 12), fill=ink)
            d.point((15, 11), fill=steel_hi)

        return spec, image
