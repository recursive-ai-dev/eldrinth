"""Generate deterministic 192x108 regional landscape banners from Shed Dev Sprites.

Committed scenes work offline in browser and desktop builds without Python or
the sibling source checkout. Use --check to verify pixels, provenance, and
attribution in memory without modifying files.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image

from gen_equipment_icons import pixel_hash, source_provenance

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT = PROJECT_ROOT / "src" / "assets" / "scenes"
PUBLIC_NOTICES = PROJECT_ROOT / "public" / "third-party" / "scenes"

RECIPES = {
    "old-lands": {"seed": "eldrinth-scene-old-lands-03", "options": {"mood": "dark", "title": ""}},
    "cinderwild": {"seed": "eldrinth-scene-cinderwild-02", "options": {"mood": "warm", "title": ""}},
    "moonlit-coast": {"seed": "eldrinth-scene-moonlit-coast-07", "options": {"mood": "cold", "title": ""}},
    "starfall-moors": {"seed": "eldrinth-scene-starfall-moors-02", "options": {"mood": "eerie", "title": ""}},
}

NOTICE = """Eldrinth regional landscape banners

Generated from Shed Dev Sprites (Apache License 2.0).
Source: ../shed-dev-sprites, https://github.com/recursive-ai-dev/shed-dev-sprites
The full upstream license is included in LICENSE.apache-2.0.

These four 192x108 landscape scenes are generated deterministically by the
upstream `scene` generator (sky dithering, parallax ridges, terrain, cottages,
props, and cast) and locked to Eldrinth's regional master palettes. Recipes,
seeds, source revision, generator fingerprint, and SHA-256 checksums are
recorded in src/assets/scenes/manifest.json.

Rebuild: python3 tools/spritegen/gen_scenes.py
Verify:  python3 tools/spritegen/gen_scenes.py --check
"""


def png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=PROJECT_ROOT.parent / "shed-dev-sprites")
    parser.add_argument("--check", action="store_true", help="verify committed scenes without writing")
    args = parser.parse_args()
    source = args.source.expanduser().resolve()
    if not (source / "generator" / "registry.py").is_file() or not (source / "LICENSE").is_file():
        parser.error(f"No Shed Dev Sprites generator and license at {source}; use --source PATH")

    sys.dont_write_bytecode = True
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    sys.path.insert(0, str(source))
    from catalog import REGIONAL_MASTER_PALETTES
    from generator.math.palette import snap_pil_to_palette
    from generator.registry import get_generator

    palette_map = {
        "old-lands": "oldlands",
        "cinderwild": "cinderwild",
        "moonlit-coast": "moonlit",
        "starfall-moors": "starfall",
    }

    manifest = {"version": 1, "source": source_provenance(source), "scenes": {}}
    outputs: dict[str, bytes] = {
        "LICENSE.apache-2.0": (source / "LICENSE").read_bytes(),
        "NOTICE.txt": NOTICE.encode("utf-8"),
    }
    errors = []
    hashes = set()
    generator = get_generator("scene")
    for scene_id, recipe in RECIPES.items():
        seed = recipe["seed"]
        sprite = generator.generate(seed, **recipe["options"])
        raw = sprite.image.convert("RGBA")
        if raw.size != (192, 108):
            raise ValueError(f"Unexpected scene dimensions for {scene_id}: {raw.size}")
        if pixel_hash(generator.generate(seed, **recipe["options"]).image) != pixel_hash(raw):
            raise ValueError(f"Non-deterministic scene generator for {scene_id}")
        image = snap_pil_to_palette(raw, REGIONAL_MASTER_PALETTES[palette_map[scene_id]])
        image_hash = pixel_hash(image)
        if image.getbbox() is None or image_hash in hashes:
            raise ValueError(f"Empty or duplicate scene: {scene_id}")
        hashes.add(image_hash)
        filename = f"{scene_id}.png"
        outputs[filename] = png_bytes(image)
        entry = {
            "file": filename,
            "seed": seed,
            "kind": "scene",
            "options": recipe["options"],
            "regionPalette": palette_map[scene_id],
            "width": 192,
            "height": 108,
            "pixelSha256": image_hash,
            "fileSha256": hashlib.sha256(outputs[filename]).hexdigest(),
            "spec": sprite.spec,
        }
        manifest["scenes"][scene_id] = entry
        if args.check:
            try:
                committed_bytes = (OUTPUT / filename).read_bytes()
                entry["fileSha256"] = hashlib.sha256(committed_bytes).hexdigest()
                with Image.open(io.BytesIO(committed_bytes)) as committed:
                    if committed.mode != "RGBA" or committed.size != (192, 108) or pixel_hash(committed) != image_hash:
                        errors.append(f"{filename}: dimensions, channels, or pixels differ from recipe")
            except (OSError, ValueError) as error:
                errors.append(f"{filename}: {error}")

    outputs["manifest.json"] = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode("utf-8")
    published_notices = {name: outputs[name] for name in ("NOTICE.txt", "LICENSE.apache-2.0")}
    if args.check:
        actual_pngs = {path.name for path in OUTPUT.glob("*.png")}
        expected_pngs = {f"{scene_id}.png" for scene_id in RECIPES}
        if actual_pngs != expected_pngs:
            errors.append(f"Unexpected or missing scene PNGs: {sorted(actual_pngs ^ expected_pngs)}")
        for filename in ("manifest.json", "NOTICE.txt", "LICENSE.apache-2.0"):
            path = OUTPUT / filename
            if not path.is_file() or path.read_bytes() != outputs[filename]:
                errors.append(f"{filename}: recipes, source provenance, or attribution differ")
        for filename, content in published_notices.items():
            path = PUBLIC_NOTICES / filename
            if not path.is_file() or path.read_bytes() != content:
                errors.append(f"public/third-party/scenes/{filename}: release attribution differs")
        if errors:
            print("Scene verification failed:\n  " + "\n  ".join(errors), file=sys.stderr)
            return 1
        print(f"Verified {len(RECIPES)} deterministic regional scenes, source provenance, and license.")
        return 0

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
    print(f"Generated {len(RECIPES)} regional scenes ({changed} files updated) into {OUTPUT}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
