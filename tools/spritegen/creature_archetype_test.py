import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from generator.sprites.creature import CreatureSpriteGenerator  # noqa: E402


def main():
    gen = CreatureSpriteGenerator()
    forced = gen.generate(seed=1, archetype="golem")
    assert forced.spec["archetype"] == "golem", forced.spec["archetype"]

    forced_again = gen.generate(seed=1, archetype="golem")
    assert forced.pixel_hash == forced_again.pixel_hash, "override must stay deterministic"

    unforced = gen.generate(seed=1)
    print("OK: forced=golem, unforced=", unforced.spec["archetype"])


if __name__ == "__main__":
    main()
