#!/usr/bin/env python3
"""
Zoom portrait JPEG files by a specified percentage (default: 10%).
Crops equally from the edges and resizes back to original dimensions using high-quality Lanczos resampling.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent
DEFAULT_PORTRAITS_DIR = PROJECT_ROOT / "src" / "assets" / "portraits"


def zoom_image(image_path: Path, zoom_percent: float = 10.0, output_path: Path | None = None) -> None:
    if output_path is None:
        output_path = image_path

    with Image.open(image_path) as img:
        if img.mode != "RGB":
            img = img.convert("RGB")

        w, h = img.size
        scale = 1.0 + (zoom_percent / 100.0)

        crop_w = w / scale
        crop_h = h / scale

        left = (w - crop_w) / 2.0
        top = (h - crop_h) / 2.0
        right = left + crop_w
        bottom = top + crop_h

        cropped = img.crop((left, top, right, bottom))
        zoomed = cropped.resize((w, h), Image.Resampling.LANCZOS)
        zoomed.save(output_path, "JPEG", quality=95)
        print(f"Zoomed {image_path.name} by {zoom_percent}% ({w}x{h} -> cropped {crop_w:.1f}x{crop_h:.1f} -> resized to {w}x{h})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Zoom and crop portrait JPEG files by a percentage.")
    parser.add_argument("--percent", type=float, default=10.0, help="Zoom percentage (default: 10.0)")
    parser.add_argument("--dir", type=str, default=str(DEFAULT_PORTRAITS_DIR), help="Portraits directory")
    args = parser.parse_args()

    portraits_dir = Path(args.dir)
    if not portraits_dir.is_absolute():
        portraits_dir = PROJECT_ROOT / portraits_dir

    jpg_files = sorted(portraits_dir.glob("*.jpg"))
    if not jpg_files:
        print(f"No .jpg files found in {portraits_dir}")
        return

    print(f"Zooming {len(jpg_files)} portraits in {portraits_dir} by {args.percent}%...")
    for jpg in jpg_files:
        zoom_image(jpg, zoom_percent=args.percent)

    print(f"Successfully zoomed all {len(jpg_files)} portraits!")


if __name__ == "__main__":
    main()

