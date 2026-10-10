"""Generate additive equipment icons from the sibling Shed Dev Sprites project.

The existing world atlas pipeline and its committed art are left untouched.
Use --check to regenerate in memory and verify the committed pixels/provenance.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT = PROJECT_ROOT / "src" / "assets" / "equipment"
PUBLIC_NOTICES = PROJECT_ROOT / "public" / "third-party" / "equipment"
NOTICE = """Eldrinth equipment and lantern imagery

Generated from Shed Dev Sprites (Apache License 2.0).
Source: https://github.com/recursive-ai-dev/shed-dev-sprites
The full upstream license is included in LICENSE.apache-2.0.

These seven 32px icons use the upstream item and lantern prop generators
without image postprocessing. Recipes, seeds, source revision, generator
fingerprint, and pixel/file checksums are recorded in
src/assets/equipment/manifest.json in the Eldrinth source repository.

Rebuild: python3 tools/spritegen/gen_equipment_icons.py
Verify:  python3 tools/spritegen/gen_equipment_icons.py --check
"""
RECIPES = {
    "wayblade": {"kind": "item", "category": "sword", "palette": "grim_steel"},
    "gravehammer": {"kind": "item", "category": "hammer", "palette": "rusted_stone"},
    "emberheart": {"kind": "item", "category": "gem", "palette": "volcanic_ember"},
    "ashstep": {"kind": "item", "category": "ring", "palette": "volcanic_ember"},
    "tidewell": {"kind": "item", "category": "potion", "palette": "black_water"},
    "starblade": {"kind": "item", "category": "dagger", "palette": "spire_anima"},
    "lantern": {"kind": "prop", "prop_type": "lantern", "frame": 0, "frames": 2},
}
# Curated upstream seeds keep the metal and ember silhouettes readable on the
# equipment panel's dark surface, without recoloring or replacing generator art.
SEED_VARIANTS = {"wayblade": 33, "gravehammer": 35, "ashstep": 13}


def source_provenance(source: Path) -> dict:
    """Fingerprint source bytes too, so a dirty checkout cannot hide changes."""
    digest = hashlib.sha256()
    for path in sorted((source / "generator").rglob("*.py")):
        digest.update(path.relative_to(source).as_posix().encode("utf-8") + b"\0")
        digest.update(path.read_bytes() + b"\0")
    try:
        revision = subprocess.check_output(
            ["git", "-C", str(source), "rev-parse", "HEAD"],
            text=True, stderr=subprocess.DEVNULL,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        revision = None
    return {
        "project": "shed-dev-sprites",
        "revision": revision,
        "generatorSha256": digest.hexdigest(),
        "license": "Apache-2.0",
    }


def pixel_hash(image: Image.Image) -> str:
    return hashlib.sha256(image.convert("RGBA").tobytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source", type=Path, default=PROJECT_ROOT.parent / "shed-dev-sprites",
        help="Shed Dev Sprites checkout (defaults to the sibling project)",
    )
    parser.add_argument("--check", action="store_true", help="verify without writing files")
    args = parser.parse_args()
    source = args.source.expanduser().resolve()
    if not (source / "generator" / "registry.py").is_file() or not (source / "LICENSE").is_file():
        parser.error(f"No Shed Dev Sprites generator and license at {source}; use --source PATH")

    # Prefer the requested upstream checkout over our vendored world generator.
    # Importing it must not write bytecode back into the user's sprite project.
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(source))
    from generator.registry import get_generator

    manifest = {"version": 1, "source": source_provenance(source), "icons": {}}
    outputs: dict[str, bytes] = {"LICENSE.apache-2.0": (source / "LICENSE").read_bytes(), "NOTICE.txt": NOTICE.encode("utf-8")}
    errors = []
    hashes = set()
    for icon_id, recipe in RECIPES.items():
        seed = f"eldrinth-equipment-{icon_id}-{SEED_VARIANTS.get(icon_id, 1):02d}"
        kind = recipe["kind"]
        options = {key: value for key, value in recipe.items() if key != "kind"}
        generator = get_generator(kind, size=32)
        sprite = generator.generate(seed, **options)
        image = sprite.image.convert("RGBA")
        image_hash = pixel_hash(image)
        if image.size != (32, 32) or image.getbbox() is None:
            raise ValueError(f"Invalid or empty icon: {icon_id}")
        if image.getchannel("A").getextrema()[0] != 0:
            raise ValueError(f"Icon has no transparent background: {icon_id}")
        if image_hash in hashes:
            raise ValueError(f"Duplicate equipment pixels: {icon_id}")
        hashes.add(image_hash)
        if pixel_hash(generator.generate(seed, **options).image) != image_hash:
            raise ValueError(f"Generator is not deterministic for {icon_id}")

        filename = f"{icon_id}.png"
        buffer = io.BytesIO()
        image.save(buffer, format="PNG", optimize=True)
        outputs[filename] = buffer.getvalue()
        manifest["icons"][icon_id] = {
            "file": filename, "seed": seed, "kind": kind, "options": options,
            "width": 32, "height": 32, "pixelSha256": image_hash,
            "fileSha256": hashlib.sha256(outputs[filename]).hexdigest(),
            "spec": sprite.spec,
        }
        if args.check:
            path = OUTPUT / filename
            try:
                committed_bytes = path.read_bytes()
                # Validate the committed encoding against its manifest while
                # comparing regenerated pixels independently of Pillow's PNG
                # compression. A toolchain change need not rewrite valid art.
                manifest["icons"][icon_id]["fileSha256"] = hashlib.sha256(committed_bytes).hexdigest()
                with Image.open(io.BytesIO(committed_bytes)) as committed:
                    if committed.size != image.size or pixel_hash(committed) != image_hash:
                        errors.append(f"{filename}: pixels differ from the recipe")
            except (OSError, ValueError) as error:
                errors.append(f"{filename}: {error}")

    manifest_bytes = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode("utf-8")
    outputs["manifest.json"] = manifest_bytes
    published_notices = {name: outputs[name] for name in ("NOTICE.txt", "LICENSE.apache-2.0")}
    if args.check:
        for filename in ("manifest.json", "NOTICE.txt", "LICENSE.apache-2.0"):
            path = OUTPUT / filename
            if not path.is_file() or path.read_bytes() != outputs[filename]:
                errors.append(f"{filename}: recipes, source provenance, or attribution differ")
        for filename, content in published_notices.items():
            path = PUBLIC_NOTICES / filename
            if not path.is_file() or path.read_bytes() != content:
                errors.append(f"public/third-party/equipment/{filename}: release attribution differs")
        if errors:
            print("Equipment icon verification failed:\n  " + "\n  ".join(errors), file=sys.stderr)
            return 1
        print(f"Verified {len(RECIPES)} deterministic equipment icons, source provenance, and license.")
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
    print(f"Generated {len(RECIPES)} equipment icons ({changed} files updated) into {OUTPUT}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
