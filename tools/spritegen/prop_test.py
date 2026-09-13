"""Regression checks for generated landmark props."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from generator.registry import get_generator  # noqa: E402


def main():
    generator = get_generator("prop")

    campfire_hashes = [
        generator.generate(
            "eldrinth-prop-campfire-01",
            prop_type="campfire",
            frame=frame,
            frames=4,
        ).pixel_hash
        for frame in range(4)
    ]
    assert len(set(campfire_hashes)) == 4, "each flame frame must be visually distinct"
    assert campfire_hashes == [
        generator.generate(
            "eldrinth-prop-campfire-01",
            prop_type="campfire",
            frame=frame,
            frames=4,
        ).pixel_hash
        for frame in range(4)
    ], "campfire animation must be deterministic"

    sign = generator.generate("eldrinth-prop-sign-01", prop_type="sign")
    assert sign.size == (32, 32)
    assert sign.pixel_hash == generator.generate(
        "eldrinth-prop-sign-01", prop_type="sign"
    ).pixel_hash
    print("OK: prop sprites deterministic; campfire has 4 unique frames")


if __name__ == "__main__":
    main()
