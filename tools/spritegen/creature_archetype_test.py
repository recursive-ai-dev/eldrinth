import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from generator.sprites.creature import CreatureSpriteGenerator  # noqa: E402


def main():
    gen = CreatureSpriteGenerator()
    forced = gen.generate(seed=1, archetype="golem")
    assert forced.spec["archetype"] == "golem"
    assert forced.pixel_hash == gen.generate(seed=1, archetype="golem").pixel_hash
    print("OK: forced=golem, unforced=", gen.generate(seed=1).spec["archetype"])


if __name__ == "__main__":
    main()
