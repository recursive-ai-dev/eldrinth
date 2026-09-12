import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from generator.sprites.creature import CreatureSpriteGenerator  # noqa: E402


def main():
    gen = CreatureSpriteGenerator()
    walk = gen.generate(seed=3, archetype="golem", direction="front", frame=1, frames=4, action="walk")
    attack = gen.generate(seed=3, archetype="golem", direction="front", frame=1, frames=4, action="attack")
    assert walk.pixel_hash != attack.pixel_hash, "attack action must render differently from walk"
    assert attack.spec["action"] == "attack"
    print("OK: creature attack differs from walk")


if __name__ == "__main__":
    main()
