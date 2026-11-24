#!/usr/bin/env python3
"""
Deterministic Biome & Game-Engine Asset Pack Generator.
=======================================================

Builds a cohesive, palette-locked, game-ready asset pack for a target biome:
  - 47-tile Blob Wang autotile sets + 16-tile Wang sets per biome terrain
  - Multi-clip hero/NPC animation sheets (idle/walk/attack/cast/hurt/death)
  - Biome creature multi-action sheets + seeded mounts & war machines
  - Cohesive settlement cottages, war structures, props, items & cave layout
  - Engine sidecars (Godot 4 SpriteFrames .tres, Aseprite JSON, or Unity JSON)
  - Combined ``pack_overview.png`` + ``manifest.json``
"""

from __future__ import annotations

import io
import json
import os
import zipfile
from typing import Any, Dict, List, Optional, Sequence, Tuple

from PIL import Image, ImageDraw

from .registry import get_generator
from .rng import derive
from .math.wang import BLOB_47_MASKS
from . import sheet as sheetmod
from .sprites.base import CLIP_ACTIONS


BIOME_PRESETS: Dict[str, Dict[str, Any]] = {
    "dark_forest": {
        "master_palette": "endesga32",
        "theme": "oldstone",
        "faction": "human",
        "tiles": ("grass", "dirt", "mud", "wood"),
        "roles": ("player", "guard", "adept"),
        "archetypes": ("slime", "quadruped", "biped"),
        "categories": ("sword", "bow", "potion", "key"),
        "props": ("campfire", "sign", "lantern"),
        "structures": ("tower", "barracks"),
    },
    "dungeon_crypt": {
        "master_palette": "slso8",
        "theme": "moor",
        "faction": "corrupted",
        "tiles": ("stone", "cobble", "brick"),
        "roles": ("adept", "player", "guard"),
        "archetypes": ("tentacle", "biped", "golem"),
        "categories": ("staff", "scroll", "key", "shard"),
        "props": ("brazier", "lantern"),
        "structures": ("tower", "hall"),
    },
    "desert_outpost": {
        "master_palette": "pico8",
        "theme": "cinder",
        "faction": "human",
        "tiles": ("sand", "stone", "wood"),
        "roles": ("player", "guard", "refugee"),
        "archetypes": ("quadruped", "winged", "blob"),
        "categories": ("dagger", "coin", "ring", "gem"),
        "props": ("campfire", "sign"),
        "structures": ("stables", "mill"),
    },
    "frozen_citadel": {
        "master_palette": "sweetie16",
        "theme": "coastal",
        "faction": "darkelf",
        "tiles": ("snow", "stone", "water"),
        "roles": ("guard", "adept", "player"),
        "archetypes": ("golem", "winged", "tentacle"),
        "categories": ("axe", "shield", "potion", "gem"),
        "props": ("brazier", "lantern"),
        "structures": ("tower", "hall"),
    },
    "volcanic_forge": {
        "master_palette": "endesga32",
        "theme": "cinder",
        "faction": "corrupted",
        "tiles": ("lava", "stone", "brick"),
        "roles": ("player", "guard", "adept"),
        "archetypes": ("golem", "biped", "winged"),
        "categories": ("hammer", "axe", "gem", "shard"),
        "props": ("brazier", "campfire"),
        "structures": ("blacksmith", "barracks"),
    },
}


def list_biomes() -> List[str]:
    return sorted(BIOME_PRESETS)


def _png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _export_sidecar(export_fmt: str, meta: Dict[str, Any], image_name: str) -> Tuple[str, bytes]:
    fmt = (export_fmt or "godot").lower()
    if fmt == "aseprite":
        ext = ".aseprite.json"
        data = json.dumps(sheetmod.format_aseprite_json(meta, image_name=image_name), indent=2).encode("utf-8")
    elif fmt == "unity":
        ext = ".unity.json"
        data = json.dumps(sheetmod.format_unity_atlas_json(meta, image_name=image_name), indent=2).encode("utf-8")
    else:
        ext = ".tres"
        data = sheetmod.format_godot_tres(meta, image_path=f"res://{image_name}").encode("utf-8")
    return ext, data


def build_biome_pack(
    biome: str = "dark_forest",
    seed: int = 42,
    *,
    size: int = 32,
    master_palette: Optional[str] = None,
    export_fmt: str = "godot",
    include_clips: Sequence[str] = CLIP_ACTIONS,
    out_dir: Optional[str] = None,
    overview_only: bool = False,
) -> Dict[str, Any]:
    """Generate a complete, palette-locked game asset pack for ``biome``."""
    bkey = (biome or "dark_forest").lower().strip().replace(" ", "_")
    if bkey not in BIOME_PRESETS:
        bkey = "dark_forest"
    preset = BIOME_PRESETS[bkey]
    mp = (master_palette or preset["master_palette"]).lower()
    sz = max(32, min(64, int(size or 32)))
    clips = tuple(include_clips) if include_clips else CLIP_ACTIONS

    files: Dict[str, bytes] = {}
    assets: List[Dict[str, Any]] = []

    def add_image_asset(rel_path: str, img: Image.Image, kind: str, extra: Optional[Dict[str, Any]] = None) -> None:
        raw = _png_bytes(img)
        files[rel_path] = raw
        entry = {"path": rel_path, "kind": kind, "size": list(img.size)}
        if extra:
            entry.update(extra)
        assets.append(entry)

    # 1. Tiles: 47-tile Blob autotiles + 16-tile Wang sets per terrain kind
    tile_gen = get_generator("tile", size=min(32, sz))
    tile_samples = []
    for idx, tkind in enumerate(preset["tiles"]):
        tseed = derive(seed, bkey, "tile", tkind)
        if overview_only:
            tile_samples.append(tile_gen.generate(tseed, kind=tkind, mask=15, blob=True, master_palette=mp))
            continue
        blob_sprites = [
            tile_gen.generate(tseed, kind=tkind, mask=m, blob=True, master_palette=mp)
            for m in BLOB_47_MASKS
        ]
        tile_samples.append(blob_sprites[0])
        bimg, bmeta = sheetmod.make_sheet(blob_sprites, cols=8, margin=1, background=(24, 22, 20))
        bmeta["blob_masks"] = list(BLOB_47_MASKS)
        rel = f"tiles/blob47_{tkind}.png"
        ext, sidecar = _export_sidecar(export_fmt, bmeta, os.path.basename(rel))
        add_image_asset(rel, bimg, "autotile_blob47", {"terrain": tkind, "count": len(blob_sprites)})
        files[f"tiles/blob47_{tkind}{ext}"] = sidecar
        if idx == 0:
            w_sprites = [
                tile_gen.generate(tseed, kind=tkind, mask=m, blob=False, master_palette=mp)
                for m in range(16)
            ]
            wimg, _ = sheetmod.make_sheet(w_sprites, cols=4, margin=1, background=(24, 22, 20))
            add_image_asset(f"tiles/wang16_{tkind}.png", wimg, "autotile_wang16", {"terrain": tkind})

    # 2. Characters: multi-clip sheets (idle, walk, attack, cast, hurt, death)
    human_gen = get_generator("human", size=sz)
    hero_previews = []
    for i, role in enumerate(preset["roles"]):
        cseed = derive(seed, bkey, "hero", role, i)
        hero_previews.append(human_gen.generate(cseed, role=role, action="attack", frame=1, master_palette=mp))
        if overview_only:
            continue
        anim_img, ameta = human_gen.generate_multi_anim_sheet(
            cseed, actions=clips, frames=4, role=role, master_palette=mp,
        )
        rel = f"characters/{role}_{cseed}_clips.png"
        ext, sidecar = _export_sidecar(export_fmt, ameta, os.path.basename(rel))
        add_image_asset(rel, anim_img, "character_clips", {"role": role, "seed": cseed, "actions": list(clips)})
        files[f"characters/{role}_{cseed}_clips{ext}"] = sidecar

    # 3. Creatures: multi-clip sheets per archetype
    creat_gen = get_generator("creature", size=sz)
    creat_previews = []
    for i, arch in enumerate(preset["archetypes"]):
        mseed = derive(seed, bkey, "creature", arch, i)
        creat_previews.append(creat_gen.generate(mseed, archetype=arch, master_palette=mp))
        if overview_only:
            continue
        cimg, cmeta = creat_gen.generate_multi_anim_sheet(
            mseed, actions=clips, frames=4, archetype=arch, master_palette=mp,
        )
        rel = f"creatures/{arch}_{mseed}_clips.png"
        ext, sidecar = _export_sidecar(export_fmt, cmeta, os.path.basename(rel))
        add_image_asset(rel, cimg, "creature_clips", {"archetype": arch, "seed": mseed, "actions": list(clips)})
        files[f"creatures/{arch}_{mseed}_clips{ext}"] = sidecar

    # 4. Structures, Settlement Cottages, Mounts & Machines
    settle_gen = get_generator("settlement", size=sz)
    struct_gen = get_generator("structure", size=sz)
    mount_gen = get_generator("mount", size=sz)
    machine_gen = get_generator("machine", size=sz)

    cottages = [
        settle_gen.generate(derive(seed, bkey, "cottage", k), theme=preset["theme"], part="cottage", master_palette=mp)
        for k in range(2 if overview_only else 3)
    ]
    war_structs = [
        struct_gen.generate(derive(seed, bkey, "structure", sk), faction=preset["faction"], kind=sk, master_palette=mp)
        for sk in (preset["structures"][:1] if overview_only else preset["structures"])
    ]
    mounts = [mount_gen.generate(derive(seed, bkey, "mount", k), faction=preset["faction"], direction="right", master_palette=mp)
              for k in range(1 if overview_only else 2)]
    machines = ([] if overview_only else
                [machine_gen.generate(derive(seed, bkey, "machine", 0), faction=preset["faction"], direction="right", master_palette=mp)])

    if not overview_only:
        cimg, _ = sheetmod.make_sheet(cottages, cols=3, margin=2, transparent=True)
        add_image_asset("structures/cottages_sheet.png", cimg, "settlement_cottages", {"theme": preset["theme"], "count": 3})
        wimg, _ = sheetmod.make_sheet(war_structs, cols=len(war_structs), margin=2, transparent=True)
        add_image_asset("structures/war_structures.png", wimg, "war_structures", {"faction": preset["faction"]})
        mimg, _ = sheetmod.make_sheet(mounts, cols=2, margin=2, transparent=True)
        add_image_asset("structures/mounts.png", mimg, "war_mounts", {"faction": preset["faction"]})
        kimg, _ = sheetmod.make_sheet(machines, cols=1, margin=2, transparent=True)
        add_image_asset("structures/machines.png", kimg, "war_machines", {"faction": preset["faction"]})

    # 5. Items, Props & Dungeon floorplan
    item_gen = get_generator("item", size=sz)
    prop_gen = get_generator("prop", size=min(32, sz))
    dung_gen = get_generator("dungeon", size=32)

    items = [
        item_gen.generate(derive(seed, bkey, "item", cat, n), category=cat, master_palette=mp)
        for cat in (preset["categories"][:3] if overview_only else preset["categories"])
        for n in range(1 if overview_only else 2)
    ]
    if not overview_only:
        props = [
            prop_gen.generate(derive(seed, bkey, "prop", pt), prop_type=pt, master_palette=mp)
            for pt in preset["props"]
        ]
        dung = dung_gen.generate(derive(seed, bkey, "dungeon"), master_palette=mp)
        iimg, _ = sheetmod.make_sheet(items, cols=4, margin=2, transparent=True)
        pimg, _ = sheetmod.make_sheet(props, cols=len(props), margin=2, transparent=True)
        add_image_asset("items_props/items_sheet.png", iimg, "items", {"categories": list(preset["categories"])})
        add_image_asset("items_props/props_sheet.png", pimg, "props", {"prop_types": list(preset["props"])})
        add_image_asset("tiles/dungeon_map.png", dung.image, "dungeon", {"seed": dung.seed})

    # 6. Contact Overview Sheet (`pack_overview.png`)
    overview_samples: List[Tuple[str, Image.Image]] = []
    for sp in tile_samples[:3]:
        overview_samples.append((sp.spec.get("kind", "tile"), sp.image))
    for sp in hero_previews[:3]:
        overview_samples.append((sp.spec.get("role") or "hero", sp.image))
    for sp in creat_previews[:3]:
        overview_samples.append((sp.spec.get("archetype", "mob"), sp.image))
    for sp in cottages[:2]:
        overview_samples.append(("cottage", sp.image))
    for sp in war_structs[:1] + mounts[:1] + items[:3]:
        overview_samples.append((sp.type, sp.image))

    tile_box = 72
    cols = 4
    rows = (len(overview_samples) + cols - 1) // cols
    ov = Image.new("RGBA", (cols * (tile_box + 8) + 16, rows * (tile_box + 20) + 34), (20, 22, 28, 255))
    ov_draw = ImageDraw.Draw(ov)
    ov_draw.text((10, 8), f"PACK: {bkey} | seed={seed} | palette={mp} | size={sz}px", fill=(230, 236, 248, 255))
    for idx, (label, im) in enumerate(overview_samples):
        r, c = divmod(idx, cols)
        bx = 10 + c * (tile_box + 8)
        by = 30 + r * (tile_box + 20)
        factor = max(1, tile_box // max(im.size))
        vis = im.resize((im.width * factor, im.height * factor), Image.NEAREST)
        ox = bx + (tile_box - vis.width) // 2
        oy = by + (tile_box - vis.height) // 2
        ov.alpha_composite(vis, (ox, oy))
        ov_draw.text((bx, by + tile_box + 2), str(label)[:12], fill=(168, 178, 198, 255))
    add_image_asset("pack_overview.png", ov, "overview", {})

    manifest = {
        "biome": bkey,
        "seed": int(seed),
        "size": sz,
        "master_palette": mp,
        "export_format": export_fmt,
        "clips": list(clips),
        "assets": assets,
    }
    files["manifest.json"] = json.dumps(manifest, indent=2).encode("utf-8")

    if out_dir:
        for rel_path, content in files.items():
            full = os.path.join(out_dir, rel_path)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "wb") as f:
                f.write(content)

    return {"manifest": manifest, "files": files, "overview": ov}


def build_biome_pack_zip(biome: str = "dark_forest", seed: int = 42, **kwargs) -> bytes:
    """Build a deterministic in-memory ZIP containing the complete biome pack."""
    pack = build_biome_pack(biome=biome, seed=seed, **kwargs)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for rel_path in sorted(pack["files"]):
            zi = zipfile.ZipInfo(rel_path, date_time=(2026, 1, 1, 0, 0, 0))
            zf.writestr(zi, pack["files"][rel_path])
    return buf.getvalue()
