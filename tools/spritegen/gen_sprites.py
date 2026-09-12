"""Batch-generate every sprite in CATALOG into src/assets/sprites/.

Dev-time only. Run via `npm run gen:sprites` (see package.json), never
invoked by the shipped game.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

from catalog import CATALOG  # noqa: E402
from generator.registry import get_generator  # noqa: E402
from generator.sprites.tile import TileSpriteGenerator  # noqa: E402
from generator import sheet as sheetmod  # noqa: E402

OUT_ROOT = HERE.parent.parent / "src" / "assets" / "sprites"


def _write(out_dir: Path, image, manifest: dict):
    out_dir.mkdir(parents=True, exist_ok=True)
    image.save(out_dir / "sheet.png")
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))


def gen_animated(key: str, entry: dict):
    kind = entry["kind"]  # "human" | "creature"
    gen = get_generator(kind)
    gen_kwargs = {}
    if kind == "creature" and "archetype" in entry:
        gen_kwargs["archetype"] = entry["archetype"]

    directions = ["front", "right", "back", "left"]
    actions = entry.get("anims", ["walk"])
    frames_per_action = 4

    action_sheets = []
    action_meta = {}
    row = 0
    for action in actions:
        sprites = []
        for d in directions:
            sprites.extend(
                gen.generate_walk(
                    entry["seed"], direction=d, frames=frames_per_action,
                    action=action, **gen_kwargs,
                )
            )
        action_sheets.append(sprites)
        action_meta[action] = {"row": row, "frames": frames_per_action}
        row += 1

    # Stack each action's (directions x frames) block into one tall sheet:
    # rows = len(actions) * len(directions), cols = frames_per_action.
    all_sprites = [s for block in action_sheets for s in block]
    img, sheet_meta = sheetmod.make_sheet(
        all_sprites, cols=frames_per_action, margin=1, transparent=True,
    )

    manifest = {
        "kind": kind,
        "cellW": sheet_meta["cell_size"],
        "cellH": sheet_meta["cell_size"],
        "directions": directions,
        "actions": action_meta,
        "static": False,
    }
    _write(OUT_ROOT / key, img, manifest)
    print(f"  {key}: {img.size[0]}x{img.size[1]} ({len(actions)} action(s))")


def gen_static(key: str, entry: dict):
    kind = entry["kind"]  # "item" | "tile"
    if kind == "tile" and entry.get("autotile"):
        gen_autotile_static(key, entry)
        return
    if kind == "tile":
        gen = TileSpriteGenerator()
        sprite = gen.generate(entry["seed"], kind=entry.get("tile_kind"))
    else:
        gen = get_generator(kind)
        sprite = gen.generate(entry["seed"])

    manifest = {
        "kind": kind,
        "cellW": sprite.size[0],
        "cellH": sprite.size[1],
        "static": True,
    }
    _write(OUT_ROOT / key, sprite.image, manifest)
    print(f"  {key}: {sprite.size[0]}x{sprite.size[1]} (static)")


def gen_autotile_static(key: str, entry: dict):
    """16-mask Wang tileset laid out left-to-right in one row."""
    gen = TileSpriteGenerator()
    sprites = [gen.generate(entry["seed"], kind=entry.get("tile_kind"), mask=m) for m in range(16)]
    img, sheet_meta = sheetmod.make_sheet(sprites, cols=16, margin=0, transparent=True)
    manifest = {
        "kind": "tile",
        "cellW": sheet_meta["cell_size"],
        "cellH": sheet_meta["cell_size"],
        "static": True,
        "autotile": True,
        "masks": 16,
    }
    _write(OUT_ROOT / key, img, manifest)
    print(f"  {key}: {img.size[0]}x{img.size[1]} (16-mask autotile)")


def main():
    print(f"Generating {len(CATALOG)} catalog entries into {OUT_ROOT}")
    for key, entry in CATALOG.items():
        if entry["kind"] in ("human", "creature"):
            gen_animated(key, entry)
        else:
            gen_static(key, entry)
    print("Done.")


if __name__ == "__main__":
    main()
