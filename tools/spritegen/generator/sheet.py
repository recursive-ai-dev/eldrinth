#!/usr/bin/env python3
"""
Sprite sheet & tileset compositor.
==================================

Turns many individual sprites into a single atlas image (a "sprite sheet").
The compositor is also fully deterministic: cell placement depends only on the
grid geometry, not on any runtime randomness.
"""

from __future__ import annotations

import os
import math
from typing import List, Optional, Sequence, Tuple, Dict, Any

from PIL import Image

from .sprites import Sprite


def pack_rows(count: int, cols: int) -> int:
    """Number of rows needed for ``count`` sprites laid out in ``cols`` columns."""
    if cols <= 0:
        raise ValueError("cols must be positive")
    return max(1, math.ceil(count / cols))


def make_sheet(
    sprites: Sequence[Sprite],
    cols: Optional[int] = None,
    cell: Optional[int] = None,
    margin: int = 2,
    background: Tuple[int, int, int] = (42, 44, 52),
    transparent: bool = False,
) -> Tuple[Image.Image, Dict[str, Any]]:
    """Compose ``sprites`` into a single atlas image.

    Returns ``(image, meta)`` where ``meta`` describes the layout (cell size,
    grid, per-cell offsets) so a game engine can slice the atlas.

    Arguments
    ---------
    sprites:        The sprites to lay out.
    cols:           Columns in the grid.  Defaults to ``len(sprites)``.
    cell:           Cell width in pixels (square).  Defaults to the max needed
                    to fit every sprite with the given margin, so sprites of
                    differing sizes still fit.
    margin:         Padding between cells.
    background:     Sheet background color (ignored if ``transparent``).
    transparent:    If True, the sheet background is fully transparent.
    """
    if not sprites:
        raise ValueError("need at least one sprite to build a sheet")

    types = {s.type for s in sprites}
    if len(types) > 1:
        raise ValueError(
            f"sheet can only contain one sprite type, got {sorted(types)}"
        )

    # Determine cell size.
    max_w = max(s.size[0] for s in sprites)
    max_h = max(s.size[1] for s in sprites)
    if cell is None:
        cell = max(max_w, max_h) + 2 * margin
    else:
        cell = max(cell, max_w + 2 * margin, max_h + 2 * margin)

    if cols is None:
        cols = len(sprites)
    rows = pack_rows(len(sprites), cols)

    sheet_w = cols * cell - (margin if cols > 1 else 0)
    sheet_h = rows * cell - (margin if rows > 1 else 0)
    sheet_w = max(sheet_w, 1)
    sheet_h = max(sheet_h, 1)

    if transparent:
        sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    else:
        sheet = Image.new("RGBA", (sheet_w, sheet_h), (*background, 255))

    offsets = []
    for i, sp in enumerate(sprites):
        row = i // cols
        col = i % cols
        x0 = col * cell
        y0 = row * cell
        # center sprite within the cell
        dx = x0 + (cell - sp.size[0]) // 2
        dy = y0 + (cell - sp.size[1]) // 2
        sheet.paste(sp.image, (dx, dy), sp.image)
        offsets.append({"index": i, "x": dx, "y": dy, "w": sp.size[0], "h": sp.size[1]})

    meta = {
        "type": sprites[0].type,
        "sheet_width": sheet_w,
        "sheet_height": sheet_h,
        "cell_size": cell,
        "cols": cols,
        "rows": rows,
        "margin": margin,
        "count": len(sprites),
        "cells": offsets,
        "seeds": [s.seed for s in sprites],
    }
    return sheet, meta


def save_sheet(sheet: Image.Image, path: str) -> str:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    sheet.save(path, "PNG")
    return path


def save_meta(meta: Dict[str, Any], path: str) -> str:
    import json

    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w") as f:
        json.dump(meta, f, indent=2)
    return path


def tile_atlas(
    sprites: Sequence[Sprite],
    cols: Optional[int] = None,
    margin: int = 1,
) -> Tuple[Image.Image, Dict[str, Any]]:
    """Build a seamless-ish tileset atlas from tile sprites.

    Equivalent to :func:`make_sheet` but with sensible defaults for tiles
    (tight margin, single row).  Tiles are laid out left-to-right with no
    vertical gaps so adjacent tiles read as a terrain strip.
    """
    return make_sheet(sprites, cols=cols, cell=None, margin=margin, background=(42, 44, 52), transparent=False)


def _clip_tags(meta: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Build animation frame-tag ranges from ``meta`` (e.g. walk_front 0..3)."""
    dirs = meta.get("directions")
    actions = meta.get("actions")
    nframes = int(meta.get("frames") or 0)
    cells = meta.get("cells") or []
    if actions and dirs and nframes > 0 and len(cells) >= len(actions) * len(dirs) * nframes:
        tags: List[Dict[str, Any]] = []
        idx = 0
        for act in actions:
            loop = act not in ("death", "hurt")
            for d in dirs:
                tags.append({
                    "name": f"{act}_{d}",
                    "from": idx * nframes,
                    "to": (idx + 1) * nframes - 1,
                    "direction": "forward",
                    "loop": loop,
                })
                idx += 1
        return tags
    if dirs and nframes > 0 and len(cells) >= len(dirs) * nframes:
        act = str(meta.get("action") or "walk")
        loop = act not in ("death", "hurt")
        return [
            {
                "name": f"{act}_{d}",
                "from": idx * nframes,
                "to": (idx + 1) * nframes - 1,
                "direction": "forward",
                "loop": loop,
            }
            for idx, d in enumerate(dirs)
        ]
    return [{
        "name": "default",
        "from": 0,
        "to": max(0, len(cells) - 1),
        "direction": "forward",
        "loop": True,
    }]


def format_aseprite_json(
    meta: Dict[str, Any],
    image_name: str = "sheet.png",
    duration_ms: int = 125,
) -> Dict[str, Any]:
    """Convert compositor ``meta`` into an Aseprite-compatible JSON atlas."""
    cells = meta.get("cells") or []
    stype = meta.get("type", "sprite")
    frames: Dict[str, Any] = {}
    for idx, c in enumerate(cells):
        w, h = int(c["w"]), int(c["h"])
        frames[f"{stype}_{idx}.png"] = {
            "frame": {"x": int(c["x"]), "y": int(c["y"]), "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
            "duration": int(duration_ms),
        }
    return {
        "frames": frames,
        "meta": {
            "app": "Shed Dev Sprites",
            "version": "1.0",
            "image": image_name,
            "format": "RGBA8888",
            "size": {
                "w": int(meta.get("sheet_width", 0)),
                "h": int(meta.get("sheet_height", 0)),
            },
            "scale": "1",
            "frameTags": _clip_tags(meta),
        },
    }


def format_unity_atlas_json(
    meta: Dict[str, Any],
    image_name: str = "sheet.png",
    pivot: Tuple[float, float] = (0.5, 0.0),
    pixels_per_unit: int = 16,
) -> Dict[str, Any]:
    """Convert compositor ``meta`` into a Unity/generic engine slice descriptor."""
    cells = meta.get("cells") or []
    stype = meta.get("type", "sprite")
    return {
        "image": image_name,
        "type": stype,
        "sheet_size": {
            "w": int(meta.get("sheet_width", 0)),
            "h": int(meta.get("sheet_height", 0)),
        },
        "pixels_per_unit": int(pixels_per_unit),
        "clips": _clip_tags(meta),
        "sprites": [
            {
                "name": f"{stype}_{c['index']}",
                "rect": {"x": int(c["x"]), "y": int(c["y"]), "w": int(c["w"]), "h": int(c["h"])},
                "pivot": {"x": float(pivot[0]), "y": float(pivot[1])},
            }
            for c in cells
        ],
    }


def format_godot_tres(
    meta: Dict[str, Any],
    image_path: str = "res://sheet.png",
    fps: float = 8.0,
) -> str:
    """Export compositor ``meta`` as a Godot 4 ``SpriteFrames`` ``.tres`` file."""
    cells = meta.get("cells") or []
    load_steps = len(cells) + 2
    lines = [
        f'[gd_resource type="SpriteFrames" load_steps={load_steps} format=3]',
        "",
        f'[ext_resource type="Texture2D" path="{image_path}" id="1_atlas"]',
        "",
    ]
    for c in cells:
        i = int(c["index"])
        lines.extend([
            f'[sub_resource type="AtlasTexture" id="AtlasTexture_{i}"]',
            'atlas = ExtResource("1_atlas")',
            f'region = Rect2({int(c["x"])}, {int(c["y"])}, {int(c["w"])}, {int(c["h"])})',
            "",
        ])

    anim_blocks = []
    for tag in _clip_tags(meta):
        f_idx, t_idx = int(tag["from"]), int(tag["to"])
        frames_entries = [
            f'{{\n"duration": 1.0,\n"texture": SubResource("AtlasTexture_{k}")\n}}'
            for k in range(f_idx, t_idx + 1)
        ]
        loop_str = "true" if tag.get("loop", True) else "false"
        anim_blocks.append(
            f'{{\n"frames": [{", ".join(frames_entries)}],\n'
            f'"loop": {loop_str},\n"name": &"{tag["name"]}",\n"speed": {float(fps):.1f}\n}}'
        )

    lines.extend([
        "[resource]",
        f"animations = [{', '.join(anim_blocks)}]",
        "",
    ])
    return "\n".join(lines)
