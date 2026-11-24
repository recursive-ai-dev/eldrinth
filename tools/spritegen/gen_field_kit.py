"""Generate journal, atlas, and expedition art from Shed Dev Sprites.

The committed images run without Python or the sibling source project. Rebuild
with this script; --check validates pixels, recipes, license, and provenance
without changing either checkout. --contact-sheet PATH writes a review sheet.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

from gen_equipment_icons import pixel_hash, source_provenance

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT = PROJECT_ROOT / "src" / "assets" / "field-kit"
PUBLIC_NOTICES = PROJECT_ROOT / "public" / "third-party" / "field-kit"

# Explicit options prevent upstream random category selection from changing the
# meaning of a UI symbol. Creature and pickup seeds match the world catalog.
RECIPES = {
    "journal": {"kind": "item", "options": {"category": "book", "palette": "bone_relic"}},
    "quest": {"kind": "item", "options": {"category": "scroll", "palette": "sacred_gold"}},
    "shard": {"kind": "item", "seed": "eldrinth-item-shard-01", "options": {"category": "shard", "palette": "spire_anima"}},
    "potion": {"kind": "item", "seed": "eldrinth-item-potion-01", "options": {"category": "potion", "palette": "cult_blood"}},
    "guard": {"kind": "item", "options": {"category": "shield", "palette": "grim_steel"}},
    "blade": {"kind": "item", "options": {"category": "sword", "palette": "bone_relic"}},
    "waypoint": {"kind": "prop", "seed": "eldrinth-prop-sign-01", "options": {"prop_type": "sign"}},
    "campfire": {"kind": "prop", "seed": "eldrinth-prop-campfire-01", "options": {"prop_type": "campfire", "frame": 0, "frames": 4}},
    "town": {"kind": "settlement", "options": {"part": "cottage", "theme": "oldstone"}},
    "fortress": {"kind": "dungeon", "opaque": True, "options": {}},
    "shrine": {"kind": "prop", "seed": "eldrinth-prop-brazier-01", "options": {"prop_type": "brazier", "frame": 0, "frames": 4}},
    "boss": {"kind": "creature", "seed": "eldrinth-boss-01", "renderSize": 64, "options": {"archetype": "biped", "palette": "corrupted_flesh", "color_seed": 2, "direction": "front", "frame": 0}},
    "wraith": {"kind": "creature", "seed": "eldrinth-wraith-01", "options": {"archetype": "tentacle", "palette": "wraith_ash", "direction": "front", "frame": 0}},
    "sentinel": {"kind": "creature", "seed": "eldrinth-sentinel-01", "options": {"archetype": "golem", "palette": "rusted_stone", "direction": "front", "frame": 0}},
    "adept": {"kind": "human", "seed": "eldrinth-adept-01", "options": {"role": "adept", "palette": "cult_blood", "direction": "front", "frame": 0}},
    "grassland": {"kind": "tile", "opaque": True, "options": {"kind": "grass", "palette": "sickly_green", "mask": 15}},
    "marsh": {"kind": "tile", "opaque": True, "options": {"kind": "moss", "palette": "wraith_ash", "mask": 15}},
    "mountain": {"kind": "tile", "opaque": True, "options": {"kind": "stone", "palette": "grim_steel", "mask": 15}},
    "coast": {"kind": "tile", "opaque": True, "options": {"kind": "water", "palette": "black_water", "mask": 15}},
    "spire": {"kind": "item", "options": {"category": "staff", "palette": "spire_anima"}},
    "lantern": {"kind": "prop", "seed": "eldrinth-prop-lantern-01", "options": {"prop_type": "lantern", "frame": 0, "frames": 2}},
    "gate": {"kind": "settlement", "opaque": True, "options": {"part": "door", "theme": "oldstone"}},
    "treasure": {"kind": "item", "options": {"category": "coin", "palette": "sacred_gold"}},
    "chart": {"kind": "dungeon", "opaque": True, "options": {}},
}

NOTICE = """Eldrinth field kit imagery

Generated from Shed Dev Sprites (Apache License 2.0).
Source: ../shed-dev-sprites, https://github.com/recursive-ai-dev/shed-dev-sprites
The full upstream license is included in LICENSE.apache-2.0.

Recipes, seeds, source revision, generator fingerprint, and pixel/file checksums
are recorded in manifest.json. The boss is rendered at its world size (64px)
and reduced to 32px with nearest-neighbor sampling; other art is rendered at
32px without recoloring. The book, scroll, shield, sword, coin, door, settlement,
terrain samples, and cave charts supply icons for field guide and atlas controls.

Rebuild: python3 tools/spritegen/gen_field_kit.py
Verify:  python3 tools/spritegen/gen_field_kit.py --check
Review:  python3 tools/spritegen/gen_field_kit.py --check --contact-sheet /tmp/field-kit.png

The game uses committed PNGs; neither Python nor the source checkout is needed
to play or build Eldrinth. Transparent symbols are decorative by default;
SpriteIcon accepts a label when the image itself carries information.
"""


def png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def contact_sheet(images: dict[str, Image.Image], destination: Path) -> None:
    """Inspect every icon on the dark UI surface, at 1x and 3x resolution."""
    columns, cell_width, cell_height = 6, 160, 164
    sheet = Image.new("RGB", (columns * cell_width, 44 + 4 * cell_height), "#111519")
    draw = ImageDraw.Draw(sheet)
    draw.text((16, 12), "ELDRINTH / FIELD KIT / SHED DEV SPRITES", fill="#e6dbc8")
    for index, (name, image) in enumerate(images.items()):
        x, y = (index % columns) * cell_width, 44 + (index // columns) * cell_height
        draw.rectangle((x + 5, y + 2, x + cell_width - 6, y + cell_height - 5), outline="#343b3d")
        sheet.paste(image.resize((96, 96), Image.Resampling.NEAREST), (x + 32, y + 8), image.resize((96, 96), Image.Resampling.NEAREST))
        sheet.paste(image, (x + 12, y + 117), image)
        draw.text((x + 50, y + 126), name, fill="#e6dbc8")
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=PROJECT_ROOT.parent / "shed-dev-sprites")
    parser.add_argument("--check", action="store_true", help="verify committed art without writing it")
    parser.add_argument("--contact-sheet", type=Path, help="optional path for a labeled 1x/3x review sheet")
    args = parser.parse_args()
    source = args.source.expanduser().resolve()
    if not (source / "generator" / "registry.py").is_file() or not (source / "LICENSE").is_file():
        parser.error(f"No Shed Dev Sprites generator and license at {source}; use --source PATH")

    sys.dont_write_bytecode = True
    sys.path.insert(0, str(source))
    from generator.registry import get_generator

    manifest = {"version": 1, "source": source_provenance(source), "icons": {}}
    outputs = {"LICENSE.apache-2.0": (source / "LICENSE").read_bytes(), "NOTICE.txt": NOTICE.encode("utf-8")}
    images: dict[str, Image.Image] = {}
    errors = []
    hashes = set()
    for icon_id, recipe in RECIPES.items():
        seed = recipe.get("seed", f"eldrinth-field-kit-{icon_id}-01")
        render_size = recipe.get("renderSize", 32)
        generator = get_generator(recipe["kind"], size=render_size)
        sprite = generator.generate(seed, **recipe["options"])
        raw = sprite.image.convert("RGBA")
        if raw.size != (render_size, render_size):
            raise ValueError(f"Unexpected source dimensions for {icon_id}: {raw.size}")
        if pixel_hash(generator.generate(seed, **recipe["options"]).image) != pixel_hash(raw):
            raise ValueError(f"Non-deterministic source generator for {icon_id}")
        image = raw.resize((32, 32), Image.Resampling.NEAREST) if render_size != 32 else raw
        image_hash = pixel_hash(image)
        if image.getbbox() is None or image_hash in hashes:
            raise ValueError(f"Empty or duplicate icon: {icon_id}")
        if not recipe.get("opaque") and image.getchannel("A").getextrema()[0] != 0:
            raise ValueError(f"Missing transparent icon background: {icon_id}")
        hashes.add(image_hash)
        images[icon_id] = image
        filename = f"{icon_id}.png"
        outputs[filename] = png_bytes(image)
        icon = {
            "file": filename, "seed": seed, "kind": recipe["kind"], "options": recipe["options"],
            "renderSize": render_size, "resampling": "nearest" if render_size != 32 else "none",
            "background": "opaque" if recipe.get("opaque") else "transparent",
            "width": 32, "height": 32, "pixelSha256": image_hash,
            "fileSha256": hashlib.sha256(outputs[filename]).hexdigest(), "spec": sprite.spec,
        }
        manifest["icons"][icon_id] = icon
        if args.check:
            try:
                committed_bytes = (OUTPUT / filename).read_bytes()
                icon["fileSha256"] = hashlib.sha256(committed_bytes).hexdigest()
                with Image.open(io.BytesIO(committed_bytes)) as committed:
                    if committed.mode != "RGBA" or committed.size != (32, 32) or pixel_hash(committed) != image_hash:
                        errors.append(f"{filename}: dimensions, channels, or pixels differ from the recipe")
            except (OSError, ValueError) as error:
                errors.append(f"{filename}: {error}")

    outputs["manifest.json"] = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode("utf-8")
    published_notices = {name: outputs[name] for name in ("NOTICE.txt", "LICENSE.apache-2.0")}
    if args.check:
        actual_pngs = {path.name for path in OUTPUT.glob("*.png")}
        expected_pngs = {f"{icon_id}.png" for icon_id in RECIPES}
        if actual_pngs != expected_pngs:
            errors.append(f"Unexpected or missing PNGs: {sorted(actual_pngs ^ expected_pngs)}")
        for filename in ("manifest.json", "NOTICE.txt", "LICENSE.apache-2.0"):
            path = OUTPUT / filename
            if not path.is_file() or path.read_bytes() != outputs[filename]:
                errors.append(f"{filename}: recipes, source provenance, or attribution differ")
        for filename, content in published_notices.items():
            path = PUBLIC_NOTICES / filename
            if not path.is_file() or path.read_bytes() != content:
                errors.append(f"public/third-party/field-kit/{filename}: release attribution differs")
        if errors:
            print("Field kit verification failed:\n  " + "\n  ".join(errors), file=sys.stderr)
            return 1
        print(f"Verified {len(images)} deterministic field kit icons, source provenance, and license.")
    else:
        OUTPUT.mkdir(parents=True, exist_ok=True)
        changed = 0
        for filename, content in outputs.items():
            path = OUTPUT / filename
            if not path.is_file() or path.read_bytes() != content:
                path.write_bytes(content)
                changed += 1
        PUBLIC_NOTICES.mkdir(parents=True, exist_ok=True)
        for filename, content in published_notices.items():
            path = PUBLIC_NOTICES / filename
            if not path.is_file() or path.read_bytes() != content:
                path.write_bytes(content)
                changed += 1
        print(f"Generated {len(images)} field kit icons ({changed} files updated) into {OUTPUT}.")
    if args.contact_sheet:
        contact_sheet(images, args.contact_sheet.expanduser().resolve())
        print(f"Contact sheet: {args.contact_sheet}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
