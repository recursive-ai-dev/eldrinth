"""Generate Eldrinth's complete, committed sprite atlas collection."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

from catalog import CATALOG  # noqa: E402
from generator.registry import get_generator  # noqa: E402

OUT_ROOT = HERE.parent.parent / "src" / "assets" / "sprites"
DIRECTIONS = ["front", "right", "back", "left"]
FRAMES = 4
TILE_VARIANTS = 4


def _pixel_hash(image: Image.Image) -> str:
    return hashlib.md5(image.convert("RGBA").tobytes()).hexdigest()


def _write(out_dir: Path, image: Image.Image, manifest: dict) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    image.save(out_dir / "sheet.png", format="PNG", optimize=True)
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


def _decorate_tile(image: Image.Image, feature: str | None) -> Image.Image:
    """Layer authored silhouettes over deterministic generator textures.

    The generator is excellent at materials; these tiny overlays give gameplay
    tiles a strong semantic read (tree, grave, bridge, crystal, and so on).
    Every operation is integer-coordinate and deterministic.
    """
    if not feature:
        return image
    if feature == "darken":
        return ImageEnhance.Brightness(image).enhance(0.68)

    out = image.copy().convert("RGBA")
    d = ImageDraw.Draw(out)
    ink = (12, 10, 13, 255)
    shade = (34, 31, 35, 255)
    steel = (91, 94, 101, 255)
    steel_hi = (145, 146, 143, 255)
    rust = (91, 52, 35, 255)
    bone = (194, 183, 148, 255)
    bone_hi = (231, 219, 180, 255)
    green = (25, 47, 21, 255)
    green_hi = (55, 78, 34, 255)
    cyan = (70, 178, 174, 255)
    cyan_hi = (185, 239, 218, 255)
    blood = (112, 18, 29, 255)

    if feature == "tree":
        d.rectangle((6, 8, 9, 15), fill=ink)
        d.rectangle((7, 8, 8, 15), fill=rust)
        d.polygon([(2, 8), (3, 3), (6, 1), (11, 2), (14, 6), (12, 10), (4, 10)], fill=ink)
        d.polygon([(3, 7), (4, 3), (7, 2), (11, 3), (13, 6), (11, 9), (5, 9)], fill=green)
        d.rectangle((5, 3, 9, 5), fill=green_hi)
        d.point((5, 2), fill=(83, 94, 47, 255))
    elif feature == "rock":
        d.polygon([(2, 13), (3, 7), (6, 4), (12, 5), (14, 9), (13, 14), (4, 14)], fill=ink)
        d.polygon([(3, 12), (4, 7), (7, 5), (11, 6), (13, 9), (12, 13), (4, 13)], fill=steel)
        d.polygon([(5, 7), (7, 5), (11, 6), (9, 8)], fill=steel_hi)
        d.line((8, 8, 6, 12), fill=shade, width=1)
    elif feature == "wall":
        d.rectangle((0, 7, 15, 15), fill=ink)
        d.rectangle((1, 7, 14, 14), fill=steel)
        d.line((1, 9, 14, 9), fill=steel_hi)
        d.line((1, 12, 14, 12), fill=shade)
        d.line((5, 7, 5, 9), fill=shade)
        d.line((10, 10, 10, 12), fill=shade)
        d.line((4, 13, 4, 14), fill=shade)
    elif feature == "crystal":
        d.polygon([(8, 1), (13, 8), (10, 14), (5, 14), (2, 9)], fill=ink)
        d.polygon([(8, 2), (12, 8), (9, 13), (5, 12), (3, 9)], fill=cyan)
        d.polygon([(8, 2), (8, 10), (4, 9)], fill=cyan_hi)
        d.polygon([(8, 10), (12, 8), (9, 13)], fill=(31, 91, 102, 255))
        d.point((7, 3), fill=(238, 255, 240, 255))
    elif feature == "flower":
        d.line((8, 8, 8, 14), fill=green_hi)
        d.line((8, 11, 5, 10), fill=green_hi)
        d.rectangle((6, 5, 9, 8), fill=(130, 42, 65, 255))
        d.point((5, 6), fill=(181, 74, 91, 255))
        d.point((10, 6), fill=(181, 74, 91, 255))
        d.rectangle((7, 6, 8, 7), fill=bone_hi)
    elif feature == "bridge":
        d.rectangle((0, 0, 2, 15), fill=ink)
        d.rectangle((13, 0, 15, 15), fill=ink)
        for y in (3, 7, 11):
            d.line((2, y, 13, y), fill=ink)
            d.line((3, y + 1, 12, y + 1), fill=(125, 75, 43, 255))
        d.point((4, 2), fill=steel_hi)
        d.point((11, 10), fill=steel_hi)
    elif feature == "grave":
        d.rectangle((3, 13, 13, 15), fill=ink)
        d.polygon([(4, 13), (4, 5), (6, 2), (10, 2), (12, 5), (12, 13)], fill=ink)
        d.polygon([(5, 12), (5, 5), (7, 3), (9, 3), (11, 5), (11, 12)], fill=steel)
        d.rectangle((7, 5, 8, 10), fill=shade)
        d.rectangle((6, 7, 10, 8), fill=shade)
        d.point((6, 4), fill=steel_hi)
    elif feature == "bones":
        d.line((3, 11, 12, 6), fill=ink, width=3)
        d.line((3, 11, 12, 6), fill=bone, width=1)
        for x, y in ((3, 11), (12, 6)):
            d.rectangle((x - 1, y - 1, x + 1, y + 1), fill=bone_hi)
        d.ellipse((5, 5, 10, 10), fill=ink)
        d.rectangle((6, 6, 9, 9), fill=bone)
        d.point((7, 7), fill=ink)
        d.point((9, 7), fill=ink)
    elif feature == "tallgrass":
        for x, top, lean in ((2, 5, 2), (5, 2, -1), (8, 4, 1), (11, 1, -2), (14, 5, -1)):
            d.line((x, 15, x + lean, top), fill=ink, width=2)
            d.line((x, 14, x + lean, top), fill=green_hi)
    elif feature == "rune":
        d.line((8, 2, 13, 8, 8, 13, 3, 8, 8, 2), fill=(24, 74, 86, 255), width=1)
        d.line((8, 4, 8, 12), fill=cyan)
        d.line((5, 8, 11, 8), fill=cyan)
        d.point((8, 8), fill=cyan_hi)
    elif feature == "ledge":
        d.polygon([(0, 8), (3, 7), (6, 9), (9, 7), (12, 8), (15, 6), (15, 15), (0, 15)], fill=ink)
        d.line((0, 7, 3, 6, 6, 8, 9, 6, 12, 7, 15, 5), fill=steel_hi, width=1)
        d.line((2, 11, 2, 14), fill=rust)
        d.line((10, 10, 9, 14), fill=rust)
    elif feature in ("slope_left", "slope_right"):
        points = [(0, 14), (15, 2)] if feature == "slope_left" else [(0, 2), (15, 14)]
        d.line((*points[0], *points[1]), fill=ink, width=3)
        d.line((*points[0], *points[1]), fill=bone, width=1)
    elif feature == "sigil":
        d.ellipse((3, 3, 12, 12), outline=blood, width=1)
        d.line((8, 2, 11, 11, 3, 6, 13, 6, 5, 12, 8, 2), fill=(172, 38, 47, 255), width=1)
        d.point((8, 7), fill=bone_hi)
    return out


def _art_direct_entity(
    image: Image.Image,
    key: str,
    direction: str,
    action: str,
    frame: int,
) -> Image.Image:
    """Give the generator's bodies an Eldrinth-specific readable silhouette."""
    source = image.convert("RGBA")
    under = Image.new("RGBA", source.size, (0, 0, 0, 0))
    u = ImageDraw.Draw(under)
    ink = (10, 9, 13, 255)
    steel = (57, 66, 78, 255)
    steel_hi = (124, 142, 151, 255)
    rust = (91, 43, 35, 255)
    cyan = (57, 197, 191, 255)
    cyan_hi = (182, 247, 226, 255)
    blood = (132, 24, 38, 255)
    bone = (202, 188, 151, 255)

    # Back layers expand the silhouette without painting over generated detail.
    if key == "player":
        u.polygon([(10, 12), (7, 27), (13, 25), (16, 30), (19, 25), (25, 27), (22, 12)], fill=(22, 27, 35, 255))
        u.line((10, 13, 8, 26), fill=ink, width=2)
        if direction == "back":
            u.polygon([(13, 12), (19, 12), (21, 27), (16, 24), (11, 27)], fill=(60, 24, 30, 255))
    elif key == "enemy.wraith":
        sway = (-1, 0, 1, 0)[frame % 4]
        for x, length in ((9, 6), (13, 9), (18, 8), (22, 5)):
            u.line((x, 21, x + sway, 21 + length), fill=ink, width=3)
            u.line((x, 21, x + sway, 20 + length), fill=(38, 70, 70, 220), width=1)
    elif key == "enemy.sentinel":
        u.rectangle((7, 12, 11, 27), fill=ink)
        u.rectangle((21, 12, 25, 27), fill=ink)
        u.rectangle((8, 13, 10, 28), fill=(54, 44, 39, 255))
        u.rectangle((22, 13, 24, 28), fill=(54, 44, 39, 255))
    elif key == "enemy.boss":
        # Crown-like antlers and a ragged mantle turn the CA body into a sovereign horror.
        u.line((10, 9, 5, 3, 7, 10), fill=ink, width=3)
        u.line((22, 9, 27, 3, 25, 10), fill=ink, width=3)
        u.line((10, 8, 6, 3), fill=bone)
        u.line((22, 8, 26, 3), fill=bone)
        u.polygon([(6, 13), (2, 18), (6, 19), (3, 24), (11, 22)], fill=(30, 21, 29, 255))
        u.polygon([(26, 13), (30, 18), (26, 19), (29, 24), (21, 22)], fill=(30, 21, 29, 255))

    under.alpha_composite(source)
    d = ImageDraw.Draw(under)

    if key == "player":
        # Closed helm, pauldrons, and the cyan oath-mark establish the knight at a glance.
        d.polygon([(12, 8), (13, 3), (16, 1), (19, 3), (20, 8), (18, 11), (14, 11)], fill=ink)
        d.polygon([(13, 7), (14, 3), (18, 3), (19, 7), (18, 9), (14, 9)], fill=steel)
        d.line((14, 7, 18, 7), fill=cyan_hi)
        d.point((18 if direction == "right" else 14 if direction == "left" else 16, 7), fill=(235, 255, 245, 255))
        d.polygon([(8, 13), (12, 11), (13, 16), (9, 17)], fill=steel)
        d.polygon([(24, 13), (20, 11), (19, 16), (23, 17)], fill=steel)
        d.line((10, 13, 12, 12), fill=steel_hi)
        d.line((22, 13, 20, 12), fill=steel_hi)
        d.polygon([(16, 15), (18, 18), (16, 22), (14, 18)], fill=ink)
        d.polygon([(16, 16), (17, 18), (16, 20), (15, 18)], fill=cyan)
        d.point((16, 17), fill=cyan_hi)
    elif key == "enemy.wraith":
        # Three cold eyes and a split death-mask distinguish it from a soft blob.
        d.line((11, 12, 15, 16, 11, 19), fill=(23, 44, 47, 255))
        d.line((21, 12, 17, 16, 21, 19), fill=(23, 44, 47, 255))
        for x in (12, 16, 20):
            d.rectangle((x - 1, 10, x, 11), fill=cyan_hi)
            d.point((x, 11), fill=cyan)
    elif key == "enemy.sentinel":
        # Layered plate, shoulder blocks, cracks, and a ward-core sell weight.
        d.rectangle((5, 10, 10, 17), fill=ink)
        d.rectangle((22, 10, 27, 17), fill=ink)
        d.rectangle((6, 11, 10, 15), fill=(75, 57, 47, 255))
        d.rectangle((22, 11, 26, 15), fill=(75, 57, 47, 255))
        d.polygon([(10, 9), (22, 9), (24, 16), (21, 24), (11, 24), (8, 16)], fill=ink)
        d.polygon([(11, 10), (21, 10), (22, 16), (20, 22), (12, 22), (10, 16)], fill=(74, 58, 49, 255))
        d.line((12, 12, 15, 15, 13, 19), fill=(128, 83, 50, 255))
        d.line((21, 12, 18, 15, 20, 20), fill=(42, 34, 32, 255))
        pulse = cyan_hi if action == "attack" and frame in (1, 2) else cyan
        d.polygon([(16, 13), (19, 17), (16, 21), (13, 17)], fill=ink)
        d.polygon([(16, 14), (18, 17), (16, 19), (14, 17)], fill=pulse)
    elif key == "enemy.adept":
        # A void hood and blood sigil keep the human base cultic rather than civilian.
        d.polygon([(11, 10), (12, 4), (16, 1), (20, 4), (21, 10), (18, 13), (14, 13)], fill=(28, 10, 18, 255))
        d.ellipse((13, 5, 19, 11), fill=ink)
        d.point((15, 8), fill=(220, 66, 79, 255))
        d.point((18, 8), fill=(220, 66, 79, 255))
        d.line((13, 17, 19, 17), fill=blood)
    elif key == "enemy.boss":
        # Rib-cage and heart glyph add anatomy to the generated corrupted mass.
        for y, spread in ((13, 5), (16, 6), (19, 5)):
            d.line((16 - spread, y, 14, y + 1), fill=bone)
            d.line((18, y + 1, 16 + spread, y), fill=bone)
        d.line((16, 11, 16, 23), fill=(91, 53, 58, 255))
        heart = (215, 45, 61, 255) if action == "attack" and frame in (1, 2) else blood
        d.polygon([(16, 15), (19, 18), (16, 22), (13, 18)], fill=ink)
        d.polygon([(16, 16), (18, 18), (16, 20), (14, 18)], fill=heart)

    return under


def gen_animated(key: str, entry: dict) -> None:
    gen = get_generator(entry["kind"])
    generator_options = {
        name: entry[name]
        for name in ("archetype", "palette", "role")
        if name in entry
    }
    actions = entry.get("anims", ["walk"])
    cell_w, cell_h = gen.size
    sheet = Image.new("RGBA", (cell_w * FRAMES, cell_h * len(actions) * len(DIRECTIONS)), (0, 0, 0, 0))
    hashes: dict[str, list[str]] = {}

    for action_index, action in enumerate(actions):
        action_hashes = []
        for direction_index, direction in enumerate(DIRECTIONS):
            sprites = gen.generate_walk(
                entry["seed"], direction=direction, frames=FRAMES,
                action=action, **generator_options,
            )
            for frame_index, sprite in enumerate(sprites):
                row = action_index * len(DIRECTIONS) + direction_index
                directed = _art_direct_entity(sprite.image, key, direction, action, frame_index)
                sheet.alpha_composite(directed, (frame_index * cell_w, row * cell_h))
                action_hashes.append(_pixel_hash(directed))
        hashes[action] = action_hashes

    manifest = {
        "kind": entry["kind"],
        "cellW": cell_w,
        "cellH": cell_h,
        "directions": DIRECTIONS,
        "actions": {action: {"row": i, "frames": FRAMES, "fps": 8} for i, action in enumerate(actions)},
        "static": False,
        "pixelHashes": hashes,
    }
    _write(OUT_ROOT / key, sheet, manifest)
    print(f"  {key}: {sheet.width}x{sheet.height} ({', '.join(actions)})")


def gen_static(key: str, entry: dict) -> None:
    gen = get_generator(entry["kind"])
    options = {}
    if entry["kind"] == "tile":
        options["kind"] = entry["tile_kind"]
    for name in ("palette", "category"):
        if name in entry:
            options[name] = entry[name]

    is_tile = entry["kind"] == "tile"
    # Static materials are interior tiles (mask 15). Mask 0 would emboss a
    # dark border around every cell and expose the grid at runtime.
    masks = range(16) if entry.get("autotile") else (15,)
    variants = range(TILE_VARIANTS) if is_tile else range(1)
    sprites = [
        gen.generate(f"{entry['seed']}-v{variant}", mask=mask, **options)
        for mask in masks
        for variant in variants
    ]
    images = [_decorate_tile(sprite.image, entry.get("feature")) for sprite in sprites]
    count = len(images)
    cell_w, cell_h = images[0].size
    sheet = Image.new("RGBA", (cell_w * count, cell_h), (0, 0, 0, 0))
    for i, image in enumerate(images):
        sheet.alpha_composite(image.convert("RGBA"), (i * cell_w, 0))

    manifest = {
        "kind": entry["kind"],
        "cellW": cell_w,
        "cellH": cell_h,
        "static": True,
        "autotile": bool(entry.get("autotile")),
        "frames": count,
        "masks": 16 if entry.get("autotile") else 1,
        "variants": TILE_VARIANTS if is_tile else 1,
        "pixelHashes": [_pixel_hash(image) for image in images],
    }
    _write(OUT_ROOT / key, sheet, manifest)
    suffix = "16 masks × 4 variants" if entry.get("autotile") else f"{count} variant(s)"
    print(f"  {key}: {sheet.width}x{sheet.height} ({suffix})")


def main() -> None:
    print(f"Generating {len(CATALOG)} entries into {OUT_ROOT}")
    for key, entry in CATALOG.items():
        if entry["kind"] in ("human", "creature"):
            gen_animated(key, entry)
        else:
            gen_static(key, entry)
    print("Done.")


if __name__ == "__main__":
    main()
