"""Generate Eldrinth's complete, committed sprite atlas collection."""
from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

from catalog import CATALOG, REGIONAL_MASTER_PALETTES  # noqa: E402
from generator.math.palette import snap_pil_to_palette  # noqa: E402
from generator.math.wang import (  # noqa: E402
    BLOB_47_MASKS, NBIT, EBIT, SBIT, WBIT, NEBIT, SEBIT, SWBIT, NWBIT,
)
from generator.registry import get_generator  # noqa: E402

PROJECT_ROOT = HERE.parent.parent
OUT_ROOT = PROJECT_ROOT / "src" / "assets" / "sprites"
PUBLIC_NOTICES = PROJECT_ROOT / "public" / "third-party" / "sprites"
DIRECTIONS = ["front", "right", "back", "left"]
FRAMES = 4
TILE_VARIANTS = 4

NOTICE = """Eldrinth world sprite atlases

Generated from Shed Dev Sprites (Apache License 2.0).
Source: https://github.com/recursive-ai-dev/shed-dev-sprites
The full upstream license is included in LICENSE.apache-2.0.

World characters, NPCs, creatures, regional wardens, 47-tile Blob Wang terrain
atlases, settlement cottages, civic structures, and shard fortress landmarks
are generated offline by tools/spritegen/gen_sprites.py from catalog.py.
Every frame hash is recorded in src/assets/sprites/*/manifest.json and verified
by tools/spritegen/asset_integrity_test.py and npm test without runtime Python.

Rebuild: npm run gen:sprites
Verify:  python3 tools/spritegen/asset_integrity_test.py
"""


def _pixel_hash(image: Image.Image) -> str:
    return hashlib.md5(image.convert("RGBA").tobytes()).hexdigest()


def _write(out_dir: Path, image: Image.Image, manifest: dict) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    image.save(out_dir / "sheet.png", format="PNG", optimize=True)
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


def _paint_blob_border(
    d: ImageDraw.ImageDraw,
    mask: int,
    outer_col: tuple[int, int, int, int],
    inner_col: tuple[int, int, int, int],
    width_px: int = 3,
    variant: int = 0,
) -> None:
    """Paint deterministic cardinal & inner-corner borders for 47-tile Blob masks."""
    n = bool(mask & NBIT)
    e = bool(mask & EBIT)
    s = bool(mask & SBIT)
    w = bool(mask & WBIT)
    jitter = (variant * 5) & 3

    if not n:
        d.rectangle((0, 0, 31, width_px - 1), fill=outer_col)
        d.line((0, width_px, 31, width_px), fill=inner_col)
        d.point(((7 + jitter) % 32, width_px + 1), fill=inner_col)
        d.point(((21 + jitter) % 32, width_px + 1), fill=inner_col)
    if not s:
        d.rectangle((0, 32 - width_px, 31, 31), fill=outer_col)
        d.line((0, 31 - width_px, 31, 31 - width_px), fill=inner_col)
        d.point(((11 + jitter) % 32, 30 - width_px), fill=inner_col)
        d.point(((25 + jitter) % 32, 30 - width_px), fill=inner_col)
    if not w:
        d.rectangle((0, 0, width_px - 1, 31), fill=outer_col)
        d.line((width_px, 0, width_px, 31), fill=inner_col)
        d.point((width_px + 1, (9 + jitter) % 32), fill=inner_col)
        d.point((width_px + 1, (23 + jitter) % 32), fill=inner_col)
    if not e:
        d.rectangle((32 - width_px, 0, 31, 31), fill=outer_col)
        d.line((31 - width_px, 0, 31 - width_px, 31), fill=inner_col)
        d.point((30 - width_px, (5 + jitter) % 32), fill=inner_col)
        d.point((30 - width_px, (19 + jitter) % 32), fill=inner_col)

    # Inner diagonal corners (when both adjacent cardinals are present)
    c_sz = width_px + 1
    if n and e and not (mask & NEBIT):
        d.rectangle((32 - c_sz, 0, 31, c_sz - 1), fill=outer_col)
        d.line((31 - c_sz, 0, 31 - c_sz, c_sz), fill=inner_col)
        d.line((31 - c_sz, c_sz, 31, c_sz), fill=inner_col)
    if e and s and not (mask & SEBIT):
        d.rectangle((32 - c_sz, 32 - c_sz, 31, 31), fill=outer_col)
        d.line((31 - c_sz, 31 - c_sz, 31 - c_sz, 31), fill=inner_col)
        d.line((31 - c_sz, 31 - c_sz, 31, 31 - c_sz), fill=inner_col)
    if s and w and not (mask & SWBIT):
        d.rectangle((0, 32 - c_sz, c_sz - 1, 31), fill=outer_col)
        d.line((c_sz, 31 - c_sz, c_sz, 31), fill=inner_col)
        d.line((0, 31 - c_sz, c_sz, 31 - c_sz), fill=inner_col)
    if w and n and not (mask & NWBIT):
        d.rectangle((0, 0, c_sz - 1, c_sz - 1), fill=outer_col)
        d.line((c_sz, 0, c_sz, c_sz), fill=inner_col)
        d.line((0, c_sz, c_sz, c_sz), fill=inner_col)


def _decorate_tile(
    image: Image.Image,
    feature: str | None,
    variant: int = 0,
    mask: int = 255,
    biome: str = "oldlands",
) -> Image.Image:
    """Layer authored silhouettes & Blob-47 transitions over generator textures.

    Every operation is integer-coordinate and deterministic.
    """
    if not feature:
        return image
    if feature == "darken":
        brightness = 0.68 + (variant % 4) * 0.03 - 0.04
        return ImageEnhance.Brightness(image).enhance(brightness)

    out = image.copy().convert("RGBA")
    d = ImageDraw.Draw(out)
    ink = (10, 9, 13, 255)
    shade = (32, 30, 36, 255)
    steel = (90, 94, 102, 255)
    steel_hi = (145, 148, 154, 255)
    rust = (92, 52, 36, 255)
    rust_hi = (132, 78, 48, 255)
    bone = (196, 185, 150, 255)
    bone_hi = (235, 224, 186, 255)
    cyan = (55, 195, 190, 255)
    cyan_hi = (185, 245, 235, 255)
    cyan_core = (240, 255, 250, 255)
    blood = (142, 24, 36, 255)
    blood_hi = (215, 52, 68, 255)

    # Biome-adapted foliage & stone hues
    if biome == "cinderwild":
        green = (48, 34, 28, 255)
        green_mid = (78, 46, 32, 255)
        green_hi = (128, 66, 38, 255)
        green_spec = (218, 112, 42, 255)
        rust = (58, 36, 28, 255)
        rust_hi = (92, 56, 40, 255)
        steel = (74, 66, 68, 255)
        steel_hi = (124, 112, 108, 255)
        moss_accent = (176, 84, 36, 255)
    elif biome == "moonlit":
        green = (20, 44, 42, 255)
        green_mid = (34, 68, 62, 255)
        green_hi = (54, 98, 86, 255)
        green_spec = (94, 152, 136, 255)
        rust = (62, 52, 42, 255)
        rust_hi = (96, 82, 66, 255)
        steel = (72, 90, 102, 255)
        steel_hi = (132, 158, 166, 255)
        moss_accent = (54, 102, 92, 255)
    elif biome == "starfall":
        green = (32, 26, 48, 255)
        green_mid = (54, 44, 78, 255)
        green_hi = (84, 68, 118, 255)
        green_spec = (158, 128, 212, 255)
        rust = (68, 56, 74, 255)
        rust_hi = (112, 96, 126, 255)
        steel = (78, 80, 102, 255)
        steel_hi = (142, 144, 174, 255)
        moss_accent = (108, 82, 154, 255)
    else:
        green = (26, 48, 22, 255)
        green_mid = (42, 74, 32, 255)
        green_hi = (68, 114, 46, 255)
        green_spec = (104, 156, 62, 255)
        moss_accent = (48, 76, 36, 255)

    if feature == "water_edge":
        _paint_blob_border(
            d, mask,
            outer_col=(36, 64, 82, 255),
            inner_col=(118, 196, 206, 255),
            width_px=2,
            variant=variant,
        )
    elif feature == "grass_edge":
        if biome == "cinderwild":
            _paint_blob_border(d, mask, (36, 26, 22, 255), (96, 74, 52, 255), width_px=2, variant=variant)
        elif biome == "moonlit":
            _paint_blob_border(d, mask, (18, 34, 38, 255), (68, 112, 98, 255), width_px=2, variant=variant)
        elif biome == "starfall":
            _paint_blob_border(d, mask, (24, 18, 36, 255), (92, 78, 122, 255), width_px=2, variant=variant)
        else:
            _paint_blob_border(d, mask, (22, 34, 18, 255), (76, 112, 52, 255), width_px=2, variant=variant)
    elif feature == "path_edge":
        if biome == "cinderwild":
            _paint_blob_border(d, mask, (34, 26, 24, 255), (124, 96, 72, 255), width_px=2, variant=variant)
        elif biome == "moonlit":
            _paint_blob_border(d, mask, (58, 56, 48, 255), (186, 178, 152, 255), width_px=2, variant=variant)
        elif biome == "starfall":
            _paint_blob_border(d, mask, (36, 32, 48, 255), (138, 132, 162, 255), width_px=2, variant=variant)
        else:
            _paint_blob_border(d, mask, (44, 32, 22, 255), (128, 98, 66, 255), width_px=2, variant=variant)
    elif feature == "sand_edge":
        _paint_blob_border(d, mask, (96, 82, 58, 255), (218, 204, 168, 255), width_px=2, variant=variant)

    elif feature == "tree":
        tx_off = (0, -2, 1, 0)[variant % 4]
        ty_off = (0, 0, -2, 1)[variant % 4]
        d.polygon([(11 + tx_off, 31), (13 + tx_off, 25), (13 + tx_off, 16 + ty_off),
                   (18 + tx_off, 16 + ty_off), (18 + tx_off, 25), (21 + tx_off, 31)], fill=ink)
        d.polygon([(12 + tx_off, 30), (14 + tx_off, 25), (14 + tx_off, 17 + ty_off),
                   (17 + tx_off, 17 + ty_off), (17 + tx_off, 25), (20 + tx_off, 30)], fill=rust)
        d.line((14 + tx_off, 17 + ty_off, 14 + tx_off, 28), fill=rust_hi)
        d.line((17 + tx_off, 17 + ty_off, 17 + tx_off, 29), fill=(42, 24, 18, 255))

        if variant % 4 == 0:
            lobes = [(9, 16, 7, 6), (22, 16, 7, 6), (16, 14, 8, 7), (10, 10, 6, 6), (21, 10, 6, 6), (15, 6, 6, 5)]
        elif variant % 4 == 1:
            lobes = [(8, 17, 8, 6), (20, 16, 6, 5), (14, 13, 7, 7), (8, 10, 6, 5), (18, 9, 6, 6), (12, 5, 5, 4)]
        elif variant % 4 == 2:
            lobes = [(10, 15, 6, 5), (21, 15, 7, 6), (16, 12, 7, 7), (11, 8, 5, 5), (20, 8, 6, 5), (16, 4, 6, 4)]
        else:
            lobes = [(7, 16, 6, 5), (24, 16, 6, 5), (16, 15, 8, 6), (11, 11, 6, 5), (21, 11, 6, 5), (16, 7, 7, 5)]

        for cx, cy, rx, ry in lobes:
            d.ellipse((cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1), fill=ink)
        for cx, cy, rx, ry in lobes:
            d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=green)
        for cx, cy, rx, ry in lobes:
            d.ellipse((cx - rx + 1, cy - ry + 1, cx + rx - 1, cy + ry - 1), fill=green_mid)
        for cx, cy, rx, ry in lobes[:4]:
            d.ellipse((cx - rx + 2, cy - ry + 2, cx + rx - 2, cy + ry - 2), fill=green_hi)
        for cx, cy, rx, ry in lobes:
            d.point((cx, cy - ry + 2), fill=green_spec)

    elif feature == "rock":
        if variant % 4 == 0:
            d.polygon([(4, 29), (3, 21), (7, 12), (13, 9), (20, 10), (27, 17), (28, 26), (24, 30)], fill=ink)
            d.polygon([(5, 28), (4, 21), (8, 13), (14, 10), (19, 11), (26, 18), (27, 26), (23, 29)], fill=shade)
            d.polygon([(8, 13), (14, 10), (17, 18), (7, 22)], fill=steel_hi)
            d.polygon([(14, 10), (19, 11), (26, 18), (20, 24), (17, 18)], fill=steel)
            d.line((13, 14, 10, 20, 11, 26), fill=ink)
            d.line((14, 10, 19, 11), fill=(185, 190, 198, 255))
            d.polygon([(5, 28), (11, 28), (9, 25)], fill=moss_accent)
        elif variant % 4 == 1:
            d.polygon([(7, 30), (5, 18), (10, 9), (17, 6), (22, 11), (25, 23), (22, 30)], fill=ink)
            d.polygon([(8, 29), (6, 19), (11, 10), (16, 7), (21, 12), (24, 23), (21, 29)], fill=shade)
            d.polygon([(11, 10), (16, 7), (16, 20), (8, 20)], fill=steel_hi)
            d.polygon([(16, 7), (21, 12), (24, 22), (16, 20)], fill=steel)
            d.line((16, 7, 16, 25), fill=ink)
        elif variant % 4 == 2:
            d.polygon([(3, 29), (2, 21), (7, 14), (14, 14), (15, 29)], fill=ink)
            d.polygon([(4, 28), (3, 22), (8, 15), (13, 15), (14, 28)], fill=steel_hi)
            d.polygon([(14, 29), (15, 17), (21, 11), (28, 16), (29, 29)], fill=ink)
            d.polygon([(15, 28), (16, 18), (21, 12), (27, 17), (28, 28)], fill=steel)
            d.line((14, 16, 14, 29), fill=ink)
        else:
            d.polygon([(2, 29), (4, 17), (11, 13), (22, 13), (29, 18), (30, 29)], fill=ink)
            d.polygon([(3, 28), (5, 18), (12, 14), (21, 14), (28, 19), (29, 28)], fill=shade)
            d.polygon([(5, 18), (12, 14), (21, 14), (26, 20), (7, 21)], fill=steel_hi)
            d.polygon([(7, 21), (26, 20), (28, 27), (4, 27)], fill=steel)
            d.polygon([(4, 28), (9, 28), (7, 25)], fill=moss_accent)

    elif feature == "wall":
        # 47-tile Blob Wang masonry: connected north-south wall tops merge into a
        # continuous dark parapet, while exposed south faces show 3D stone courses.
        n = bool(mask & NBIT)
        e = bool(mask & EBIT)
        s = bool(mask & SBIT)
        w = bool(mask & WBIT)
        cap_dark = (48, 46, 56, 255)
        cap_mid = (66, 64, 76, 255)
        cap_rim = (122, 124, 136, 255)
        x0 = 0 if w else 1
        x1 = 31 if e else 30
        top_y = 0 if n else 4

        # Parapet top fill
        d.rectangle((0, top_y, 31, 31), fill=ink)
        parapet_bot = 31 if s else 11
        d.rectangle((x0, top_y + (0 if n else 1), x1, parapet_bot), fill=cap_dark)
        # Subtle stone slab joints on the parapet roof
        slab_off = (variant % 4) * 4
        for sy in range(top_y + 4, parapet_bot, 8):
            d.line((x0, sy, x1, sy), fill=shade)
            sx = (x0 + slab_off + (sy & 4)) % 28 + 2
            if x0 < sx < x1:
                d.line((sx, max(top_y, sy - 4), sx, sy), fill=shade)
        if not n:
            d.rectangle((x0, 4, x1, 6), fill=cap_mid)
            d.line((x0, 4, x1, 4), fill=cap_rim)
        if not w:
            d.rectangle((1, top_y, 3, parapet_bot), fill=cap_mid)
            d.line((1, top_y, 1, parapet_bot), fill=cap_rim)
        if not e:
            d.rectangle((28, top_y, 30, parapet_bot), fill=cap_mid)
            d.line((30, top_y, 30, parapet_bot), fill=shade)

        # Exposed south facade: 3-course dressed stone front
        if not s:
            d.rectangle((0, 11, 31, 31), fill=ink)
            d.rectangle((x0, 12, x1, 16), fill=steel)
            d.line((x0, 12, x1, 12), fill=steel_hi)
            d.line((x0, 16, x1, 16), fill=shade)
            split1 = 14 + (variant % 2) * 2
            d.rectangle((x0, 17, split1, 23), fill=steel)
            d.rectangle((split1 + 2, 17, x1, 23), fill=steel)
            d.line((x0, 17, split1, 17), fill=steel_hi)
            d.line((split1 + 2, 17, x1, 17), fill=steel_hi)
            d.line((x0, 23, x1, 23), fill=shade)
            split2 = 21 - (variant % 2) * 3
            d.rectangle((x0, 24, split2, 30), fill=steel)
            d.rectangle((split2 + 2, 24, x1, 30), fill=steel)
            d.line((x0, 24, split2, 24), fill=steel_hi)
            d.line((split2 + 2, 24, x1, 30 if split2 + 2 > x1 else 24), fill=steel_hi)

        # Inner corner quoins for L-junctions and T-junctions
        if n and e and not (mask & NEBIT):
            d.rectangle((28, 0, 31, 4), fill=ink)
            d.rectangle((28, 1, 30, 3), fill=cap_rim)
        if w and n and not (mask & NWBIT):
            d.rectangle((0, 0, 3, 4), fill=ink)
            d.rectangle((1, 1, 3, 3), fill=cap_rim)
        if e and s and not (mask & SEBIT):
            d.rectangle((28, 27, 31, 31), fill=ink)
            d.line((28, 27, 31, 27), fill=steel_hi)
        if s and w and not (mask & SWBIT):
            d.rectangle((0, 27, 3, 31), fill=ink)
            d.line((0, 27, 3, 27), fill=steel_hi)

    elif feature == "crystal":
        if variant % 4 == 0:
            d.polygon([(16, 2), (24, 14), (20, 29), (12, 29), (8, 15)], fill=ink)
            d.polygon([(16, 3), (23, 14), (19, 28), (13, 28), (9, 15)], fill=cyan)
            d.polygon([(16, 3), (16, 28), (9, 15)], fill=cyan_hi)
            d.polygon([(16, 3), (23, 14), (16, 28)], fill=(32, 110, 118, 255))
            d.line((16, 3, 16, 28), fill=cyan_core)
            d.point((16, 4), fill=(255, 255, 255, 255))
            d.polygon([(6, 15), (10, 21), (8, 29), (4, 27)], fill=ink)
            d.polygon([(6, 16), (9, 21), (7, 28), (5, 26)], fill=cyan_hi)
            d.polygon([(26, 18), (29, 24), (27, 30), (22, 28)], fill=ink)
            d.polygon([(26, 19), (28, 24), (26, 29), (23, 27)], fill=(40, 130, 138, 255))
        elif variant % 4 == 1:
            d.polygon([(9, 4), (15, 14), (13, 29), (6, 29), (4, 16)], fill=ink)
            d.polygon([(9, 5), (14, 14), (12, 28), (7, 28), (5, 16)], fill=cyan)
            d.line((9, 5, 9, 28), fill=cyan_core)
            d.polygon([(18, 10), (25, 18), (22, 29), (16, 29)], fill=ink)
            d.polygon([(18, 11), (24, 18), (21, 28), (17, 28)], fill=cyan_hi)
            d.line((18, 11, 19, 28), fill=cyan_core)
        elif variant % 4 == 2:
            for cx, cy, rx, ry in [(8, 22, 4, 7), (15, 18, 5, 11), (23, 21, 4, 8), (14, 24, 3, 5)]:
                d.polygon([(cx, cy - ry), (cx + rx, cy), (cx, cy + ry), (cx - rx, cy)], fill=ink)
                d.polygon([(cx, cy - ry + 1), (cx + rx - 1, cy), (cx, cy + ry - 1), (cx - rx + 1, cy)], fill=cyan)
                d.point((cx, cy - ry + 1), fill=cyan_core)
        else:
            d.polygon([(16, 3), (25, 13), (21, 29), (11, 29), (7, 13)], fill=ink)
            d.polygon([(16, 4), (24, 13), (20, 28), (12, 28), (8, 13)], fill=cyan)
            d.polygon([(16, 4), (16, 28), (8, 13)], fill=cyan_hi)
            d.line((16, 4, 16, 28), fill=cyan_core)
            for pt in [(16, 5), (6, 9), (26, 8), (24, 20)]:
                d.point(pt, fill=(255, 255, 255, 255))

    elif feature == "flower":
        d.line((16, 14, 16, 29), fill=ink, width=2)
        d.line((16, 14, 16, 29), fill=green_hi)
        d.line((16, 23, 12, 20), fill=green_hi)
        d.line((16, 21, 20, 18), fill=green_hi)
        for a in (0, 72, 144, 216, 288):
            rad = math.radians(a + variant * 18)
            px = int(16 + math.cos(rad) * 6)
            py = int(14 + math.sin(rad) * 5)
            d.ellipse((px - 3, py - 3, px + 3, py + 3), fill=ink)
            d.ellipse((px - 2, py - 2, px + 2, py + 2), fill=blood)
            d.point((px, py), fill=blood_hi)
        d.ellipse((14, 12, 18, 16), fill=bone_hi)
        d.point((16, 14), fill=(255, 255, 230, 255))

    elif feature == "bridge":
        d.rectangle((0, 0, 3, 31), fill=ink)
        d.rectangle((28, 0, 31, 31), fill=ink)
        d.rectangle((1, 0, 2, 31), fill=steel_hi)
        d.rectangle((29, 0, 30, 31), fill=steel_hi)
        for y0 in (2, 8, 14, 20, 26):
            d.rectangle((3, y0, 28, y0 + 4), fill=rust)
            d.line((3, y0, 28, y0), fill=rust_hi)
            d.line((3, y0 + 4, 28, y0 + 4), fill=shade)
            d.point((4, y0 + 2), fill=steel_hi)
            d.point((27, y0 + 2), fill=steel_hi)

    elif feature == "grave":
        if variant % 4 == 0:
            d.polygon([(8, 30), (8, 12), (11, 6), (20, 6), (23, 12), (23, 30)], fill=ink)
            d.polygon([(9, 29), (9, 12), (12, 7), (19, 7), (22, 12), (22, 29)], fill=steel)
            d.line((9, 12, 12, 7, 19, 7), fill=steel_hi)
            d.rectangle((15, 11, 16, 23), fill=shade)
            d.rectangle((12, 14, 19, 15), fill=shade)
            d.ellipse((6, 27, 25, 31), fill=shade)
        elif variant % 4 == 1:
            d.rectangle((14, 7, 17, 29), fill=ink)
            d.rectangle((10, 12, 21, 15), fill=ink)
            d.ellipse((10, 8, 21, 19), outline=ink, width=2)
            d.rectangle((15, 8, 16, 28), fill=steel)
            d.rectangle((11, 13, 20, 14), fill=steel)
            d.ellipse((11, 9, 20, 18), outline=steel_hi, width=1)
            d.point((15, 13), fill=steel_hi)
            d.ellipse((7, 27, 24, 31), fill=shade)
        elif variant % 4 == 2:
            d.polygon([(11, 29), (13, 8), (17, 5), (20, 9), (18, 29)], fill=ink)
            d.polygon([(12, 28), (14, 9), (17, 6), (19, 10), (17, 28)], fill=steel)
            d.line([(14, 9), (17, 6), (19, 10)], fill=steel_hi)
            d.line([(14, 14), (17, 17), (15, 21)], fill=ink)
            d.polygon([(9, 27), (21, 27), (19, 30), (10, 30)], fill=shade)
        else:
            d.polygon([(5, 29), (5, 17), (7, 14), (11, 14), (13, 17), (13, 29)], fill=ink)
            d.polygon([(6, 28), (6, 18), (8, 15), (10, 15), (12, 18), (12, 28)], fill=steel)
            d.polygon([(15, 29), (15, 11), (18, 7), (24, 7), (27, 11), (27, 29)], fill=ink)
            d.polygon([(16, 28), (16, 12), (19, 8), (23, 8), (26, 12), (26, 28)], fill=steel)
            d.line([(16, 12), (19, 8), (23, 8)], fill=steel_hi)
            d.rectangle((20, 13, 21, 22), fill=shade)
            d.ellipse((4, 27, 28, 31), fill=shade)

    elif feature == "bones":
        if variant % 4 == 0:
            d.line((6, 9, 10, 16), fill=bone, width=2)
            d.line((25, 9, 21, 16), fill=bone, width=2)
            d.ellipse((10, 13, 21, 23), fill=ink)
            d.ellipse((11, 14, 20, 22), fill=bone)
            d.point((13, 18), fill=ink)
            d.point((17, 18), fill=ink)
            d.line((14, 21, 16, 21), fill=ink)
            for ry in (23, 26, 29):
                d.line((9, ry, 13, ry + 1), fill=bone_hi)
                d.line((18, ry + 1, 22, ry), fill=bone_hi)
        elif variant % 4 == 1:
            spine_pts = [(5, 27), (10, 25), (16, 20), (22, 22), (27, 16)]
            d.line(spine_pts, fill=ink, width=3)
            d.line(spine_pts, fill=bone, width=2)
            for sx, sy in spine_pts:
                d.point((sx, sy), fill=bone_hi)
                d.line((sx - 2, sy - 2, sx + 2, sy + 2), fill=bone_hi)
        elif variant % 4 == 2:
            d.line((7, 16, 24, 28), fill=ink, width=3)
            d.line((24, 16, 7, 28), fill=ink, width=3)
            d.line((7, 16, 24, 28), fill=bone, width=2)
            d.line((24, 16, 7, 28), fill=bone, width=2)
            d.ellipse((11, 10, 20, 19), fill=ink)
            d.ellipse((12, 11, 19, 18), fill=bone_hi)
            d.point((14, 15), fill=ink)
            d.point((17, 15), fill=ink)
        else:
            d.line((20, 7, 26, 13), fill=bone_hi, width=2)
            d.ellipse((9, 15, 17, 23), fill=bone)
            d.point((12, 19), fill=ink)
            for ry in (17, 21, 25, 28):
                d.line((5, ry, 10, ry + 1), fill=bone)
                d.line((16, ry + 1, 22, ry), fill=bone)

    elif feature == "tallgrass":
        blades = [(4, 6, 2), (8, 2, -2), (12, 5, 1), (16, 2, -1), (20, 7, 2), (24, 3, -2), (28, 6, -1)]
        sway_off = (0, 2, -1, 1)[variant % 4]
        for bx, top, lean in blades:
            d.line((bx, 31, bx + lean + sway_off, top), fill=ink, width=2)
            d.line((bx, 30, bx + lean + sway_off, top), fill=green_hi)
            d.point((bx + lean + sway_off, top), fill=green_spec)

    elif feature == "rune":
        d.ellipse((5, 5, 26, 26), outline=(32, 85, 96, 255), width=2)
        d.ellipse((7, 7, 24, 24), outline=cyan, width=1)
        d.line((16, 6, 16, 25), fill=cyan)
        d.line((6, 16, 25, 16), fill=cyan)
        d.polygon([(16, 8), (23, 16), (16, 23), (8, 16)], outline=cyan_hi)
        d.point((16, 16), fill=cyan_core)

    elif feature == "ledge":
        d.rectangle((0, 0, 31, 12), fill=steel)
        d.line((0, 13, 31, 13), fill=steel_hi, width=2)
        d.rectangle((0, 14, 31, 31), fill=shade)
        for x in (4, 12, 19, 27):
            d.line((x, 14, x, 31), fill=rust)

    elif feature in ("slope_left", "slope_right"):
        points = [(0, 30), (31, 2)] if feature == "slope_left" else [(0, 2), (31, 30)]
        d.line((*points[0], *points[1]), fill=ink, width=3)
        d.line((*points[0], *points[1]), fill=bone, width=1)

    elif feature == "sigil":
        d.ellipse((3, 3, 28, 28), outline=blood, width=2)
        d.ellipse((6, 6, 25, 25), outline=blood_hi, width=1)
        d.polygon([(16, 4), (22, 23), (6, 11), (25, 11), (9, 23)], outline=blood_hi)
        d.point((16, 16), fill=bone_hi)

    elif feature == "embers":
        magma_crust = (26, 12, 10, 255)
        magma_deep = (140, 28, 14, 255)
        magma_orange = (245, 105, 18, 255)
        magma_bright = (255, 195, 60, 255)
        magma_core = (255, 250, 205, 255)

        if variant % 4 == 0:
            d.polygon([(11, 10), (21, 10), (24, 18), (19, 23), (10, 21), (7, 15)], fill=magma_crust)
            d.polygon([(12, 11), (20, 11), (23, 17), (18, 22), (11, 20), (8, 16)], fill=magma_deep)
            d.polygon([(13, 13), (18, 12), (20, 16), (17, 20), (12, 18)], fill=magma_orange)
            d.ellipse((14, 14, 18, 18), fill=magma_bright)
            d.point((16, 16), fill=magma_core)
            d.line((11, 11, 3, 4), fill=magma_orange, width=1)
            d.line((21, 11, 28, 3), fill=magma_orange, width=1)
            d.line((18, 22, 23, 29), fill=magma_orange, width=1)
            d.line((10, 20, 2, 26), fill=magma_deep, width=1)
            for sp in [(5, 8), (26, 12), (14, 6), (20, 27)]:
                d.point(sp, fill=magma_bright)
        elif variant % 4 == 1:
            rift_pts = [(2, 28), (8, 22), (14, 19), (18, 13), (23, 10), (29, 3)]
            d.line(rift_pts, fill=magma_crust, width=5)
            d.line(rift_pts, fill=magma_deep, width=3)
            d.line(rift_pts, fill=magma_orange, width=2)
            d.line([(8, 22), (14, 19), (18, 13), (23, 10)], fill=magma_bright, width=1)
            d.point((14, 19), fill=magma_core)
            d.point((18, 13), fill=magma_core)
            d.line([(14, 19), (11, 13), (7, 12)], fill=magma_deep, width=1)
            d.line([(18, 13), (22, 19), (27, 21)], fill=magma_orange, width=1)
            for sp in [(10, 11), (25, 18), (17, 8), (12, 25)]:
                d.point(sp, fill=magma_bright)
        elif variant % 4 == 2:
            d.ellipse((6, 9, 25, 24), fill=magma_crust)
            d.ellipse((8, 11, 23, 22), fill=magma_deep)
            d.ellipse((10, 13, 21, 20), fill=magma_orange)
            d.ellipse((13, 14, 18, 18), fill=magma_bright)
            d.point((15, 16), fill=magma_core)
            d.point((16, 15), fill=magma_core)
            d.ellipse((3, 21, 7, 25), fill=magma_deep)
            d.point((5, 23), fill=magma_orange)
            d.ellipse((23, 5, 28, 9), fill=magma_deep)
            d.point((25, 7), fill=magma_orange)
            for sp in [(7, 7), (20, 8), (22, 24), (11, 27)]:
                d.point(sp, fill=magma_bright)
        else:
            d.line([(16, 31), (15, 22), (10, 16), (6, 8), (4, 2)], fill=magma_crust, width=3)
            d.line([(15, 22), (21, 15), (25, 10), (28, 4)], fill=magma_crust, width=3)
            d.line([(16, 31), (15, 22), (10, 16), (6, 8), (4, 2)], fill=magma_orange, width=1)
            d.line([(15, 22), (21, 15), (25, 10), (28, 4)], fill=magma_bright, width=1)
            d.line([(15, 23), (15, 21)], fill=magma_core, width=1)
            for sp in [(9, 14), (20, 13), (5, 6), (26, 7), (16, 10), (14, 28)]:
                d.point(sp, fill=magma_core if sp[1] < 12 else magma_bright)

    return out


def _apply_region_palette(image: Image.Image, region_palette: str | None) -> Image.Image:
    if not region_palette:
        return image
    ramp = REGIONAL_MASTER_PALETTES[region_palette]
    return snap_pil_to_palette(image, ramp)


def gen_animated(key: str, entry: dict) -> None:
    size = entry.get("size")
    gen_kwargs = {"size": size} if size else {}
    gen = get_generator(entry["kind"], **gen_kwargs)
    generator_options = {
        name: entry[name]
        for name in ("archetype", "palette", "role", "prop_type", "color_seed")
        if name in entry
    }
    actions = entry.get("anims", ["walk"])
    directions = entry.get("directions", DIRECTIONS)
    frames_count = entry.get("frames", FRAMES)
    cell_w, cell_h = gen.size
    sheet = Image.new("RGBA", (cell_w * frames_count, cell_h * len(actions) * len(directions)), (0, 0, 0, 0))
    hashes: dict[str, list[str]] = {}
    region_palette = entry.get("region_palette")

    for action_index, action in enumerate(actions):
        action_hashes = []
        for direction_index, direction in enumerate(directions):
            if hasattr(gen, "generate_walk"):
                sprites = gen.generate_walk(
                    entry["seed"], direction=direction, frames=frames_count,
                    action=action, **generator_options,
                )
            else:
                sprites = [
                    gen.generate(
                        entry["seed"], direction=direction, frame=frame_index,
                        frames=frames_count, action=action, **generator_options,
                    )
                    for frame_index in range(frames_count)
                ]
            for frame_index, sprite in enumerate(sprites):
                row = action_index * len(directions) + direction_index
                img = _apply_region_palette(sprite.image, region_palette)
                sheet.alpha_composite(img, (frame_index * cell_w, row * cell_h))
                action_hashes.append(_pixel_hash(img))
        hashes[action] = action_hashes

    manifest = {
        "kind": entry["kind"],
        "cellW": cell_w,
        "cellH": cell_h,
        "directions": directions,
        "actions": {action: {"row": i, "frames": frames_count, "fps": 8} for i, action in enumerate(actions)},
        "static": False,
        "pixelHashes": hashes,
    }
    _write(OUT_ROOT / key, sheet, manifest)
    print(f"  {key}: {sheet.width}x{sheet.height} ({', '.join(actions)})")


def gen_static(key: str, entry: dict) -> None:
    size = entry.get("size")
    gen_kwargs = {"size": size} if size else {}
    gen = get_generator(entry["kind"], **gen_kwargs)
    options = {}
    autotile_mode = entry.get("autotile")
    is_blob = autotile_mode == "blob"
    if entry["kind"] == "tile":
        options["kind"] = entry["tile_kind"]
        options["use_scale2x"] = True
        if is_blob:
            options["blob"] = True
    elif entry["kind"] == "prop":
        options["prop_type"] = entry.get("prop_type", "sign")
    elif entry["kind"] == "structure":
        options["faction"] = entry.get("faction", "human")
        options["kind"] = entry.get("structure_kind", "hall")
        options["tiles"] = entry.get("tiles", 3)
        options["tile_px"] = entry.get("tile_px", 32)
    for name in ("palette", "category", "theme", "part", "trim_seed"):
        if name in entry:
            options[name] = entry[name]

    is_tile = entry["kind"] == "tile"
    # Static materials are interior tiles (mask 255 / 15). Mask 0 would emboss a
    # dark border around every cell and expose the grid at runtime.
    if is_blob:
        masks: tuple[int, ...] | range = BLOB_47_MASKS
    elif autotile_mode:
        masks = range(16)
    else:
        masks = (255 if is_blob else 15,)
    variants = range(entry.get("variants", TILE_VARIANTS if is_tile else 1))
    biome = entry.get("biome", "oldlands")
    region_palette = entry.get("region_palette")
    images = []
    for mask in masks:
        for variant in variants:
            seed = f"{entry['seed']}-v{variant}" if is_tile else entry["seed"]
            sprite = gen.generate(seed, mask=mask, variant=variant, **options)
            decorated = _decorate_tile(
                sprite.image, entry.get("feature"), variant=variant, mask=mask, biome=biome
            )
            images.append(_apply_region_palette(decorated, region_palette))
    count = len(images)
    cell_w, cell_h = images[0].size
    cols = min(count, 16)
    rows = (count + cols - 1) // cols
    sheet = Image.new("RGBA", (cell_w * cols, cell_h * rows), (0, 0, 0, 0))
    for i, image in enumerate(images):
        sheet.alpha_composite(image.convert("RGBA"), ((i % cols) * cell_w, (i // cols) * cell_h))

    mask_count = 47 if is_blob else (16 if autotile_mode else 1)
    manifest = {
        "kind": entry["kind"],
        "cellW": cell_w,
        "cellH": cell_h,
        "columns": cols,
        "static": True,
        "autotile": bool(autotile_mode),
        **({"autotileMode": "blob47"} if is_blob else {}),
        **({"regionPalette": region_palette} if region_palette else {}),
        "frames": count,
        "masks": mask_count,
        "variants": TILE_VARIANTS if is_tile else 1,
        "pixelHashes": [_pixel_hash(image) for image in images],
    }
    _write(OUT_ROOT / key, sheet, manifest)
    suffix = f"{mask_count} masks × {TILE_VARIANTS} variants" if autotile_mode else f"{count} variant(s)"
    print(f"  {key}: {sheet.width}x{sheet.height} ({suffix})")


def _write_attribution() -> None:
    license_bytes = (HERE / "LICENSE").read_bytes()
    notice_bytes = NOTICE.encode("utf-8")
    for target in (OUT_ROOT, PUBLIC_NOTICES):
        target.mkdir(parents=True, exist_ok=True)
        (target / "LICENSE.apache-2.0").write_bytes(license_bytes)
        (target / "NOTICE.txt").write_bytes(notice_bytes)


def main() -> None:
    print(f"Generating {len(CATALOG)} entries into {OUT_ROOT}")
    for key, entry in CATALOG.items():
        if entry.get("anims") or entry["kind"] in ("human", "creature"):
            gen_animated(key, entry)
        else:
            gen_static(key, entry)
    _write_attribution()
    print("Done.")


if __name__ == "__main__":
    main()
