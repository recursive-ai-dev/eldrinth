import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from generator.sprites.creature import CreatureSpriteGenerator  # noqa: E402


def main():
    gen = CreatureSpriteGenerator()
    options = {"seed": 3, "archetype": "golem", "direction": "front", "frame": 1, "frames": 4}
    walk = gen.generate(action="walk", **options)
    attack = gen.generate(action="attack", **options)
    assert walk.pixel_hash != attack.pixel_hash
    assert attack.spec["action"] == "attack"
    print("OK: creature attack differs from walk")


if __name__ == "__main__":
    main()
