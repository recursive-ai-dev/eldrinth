"""Verify committed sheets exactly match their generated manifests."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

from catalog import CATALOG  # noqa: E402

SPRITES_ROOT = HERE.parent.parent / "src" / "assets" / "sprites"


def pixel_hash(image: Image.Image) -> str:
    return hashlib.md5(image.convert("RGBA").tobytes()).hexdigest()


def assert_frame(
    sheet: Image.Image,
    box: tuple[int, int, int, int],
    expected_hash: str,
    label: str,
) -> None:
    frame = sheet.crop(box)
    assert frame.getbbox() is not None, f"{label} is entirely transparent"
    actual_hash = pixel_hash(frame)
    assert actual_hash == expected_hash, (
        f"{label} hash mismatch: manifest={expected_hash}, sheet={actual_hash}"
    )


def check_static(key: str, sheet: Image.Image, manifest: dict) -> int:
    cell_w = manifest["cellW"]
    cell_h = manifest["cellH"]
    frames = manifest["frames"]
    hashes = manifest["pixelHashes"]
    assert len(hashes) == frames, f"{key}: static hash count does not match frames"
    assert sheet.size == (cell_w * frames, cell_h), (
        f"{key}: expected {(cell_w * frames, cell_h)}, got {sheet.size}"
    )
    for frame_index, expected_hash in enumerate(hashes):
        left = frame_index * cell_w
        assert_frame(
            sheet,
            (left, 0, left + cell_w, cell_h),
            expected_hash,
            f"{key}/frame-{frame_index}",
        )
    return frames


def check_animated(key: str, sheet: Image.Image, manifest: dict) -> int:
    cell_w = manifest["cellW"]
    cell_h = manifest["cellH"]
    directions = manifest["directions"]
    actions = manifest["actions"]
    hashes_by_action = manifest["pixelHashes"]
    columns = max(action["frames"] for action in actions.values())
    action_rows = max(action["row"] for action in actions.values()) + 1
    assert sheet.size == (cell_w * columns, cell_h * len(directions) * action_rows), (
        f"{key}: manifest layout does not match sheet size {sheet.size}"
    )

    checked = 0
    for action_name, action in actions.items():
        hashes = hashes_by_action[action_name]
        expected_count = len(directions) * action["frames"]
        assert len(hashes) == expected_count, (
            f"{key}/{action_name}: expected {expected_count} hashes, got {len(hashes)}"
        )
        hash_index = 0
        for direction_index, direction in enumerate(directions):
            row = action["row"] * len(directions) + direction_index
            top = row * cell_h
            for frame_index in range(action["frames"]):
                left = frame_index * cell_w
                assert_frame(
                    sheet,
                    (left, top, left + cell_w, top + cell_h),
                    hashes[hash_index],
                    f"{key}/{action_name}/{direction}/frame-{frame_index}",
                )
                hash_index += 1
                checked += 1
    return checked


def main() -> None:
    directories = {path.name for path in SPRITES_ROOT.iterdir() if path.is_dir()}
    assert directories == set(CATALOG), (
        f"sprite directories differ from catalog: "
        f"missing={set(CATALOG) - directories}, extra={directories - set(CATALOG)}"
    )

    checked_frames = 0
    for key in CATALOG:
        root = SPRITES_ROOT / key
        manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
        with Image.open(root / "sheet.png") as opened:
            sheet = opened.convert("RGBA")
        if manifest["static"]:
            checked_frames += check_static(key, sheet, manifest)
        else:
            checked_frames += check_animated(key, sheet, manifest)

    print(f"OK: {len(CATALOG)} atlases and {checked_frames} frame hashes verified")


if __name__ == "__main__":
    main()
