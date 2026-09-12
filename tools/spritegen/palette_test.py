import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from generator.math.palette import named_palette  # noqa: E402

NEW_PALETTES = [
    "grim_steel", "wraith_ash", "rusted_stone", "cult_blood",
    "corrupted_flesh", "bone_relic", "sickly_green", "black_water",
]


def main():
    for name in NEW_PALETTES:
        rgb = named_palette(name, 0.5)
        assert len(rgb) == 3, f"{name} did not return an RGB triple"
        for channel in rgb:
            assert 0 <= channel <= 255, f"{name} produced an out-of-range channel: {rgb}"
    print("OK:", len(NEW_PALETTES), "palettes valid")


if __name__ == "__main__":
    main()
