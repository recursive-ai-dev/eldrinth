import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from generator.sprites.human import HumanSpriteGenerator  # noqa: E402


def main():
    gen = HumanSpriteGenerator()
    walk = gen.generate(seed=7, direction="front", frame=1, frames=4, action="walk")
    attack = gen.generate(seed=7, direction="front", frame=1, frames=4, action="attack")
    assert walk.pixel_hash != attack.pixel_hash, "attack pose must render differently from walk"
    assert attack.spec["action"] == "attack"

    img, meta = gen.generate_anim_sheet(seed=7, frames=4, action="attack")
    assert meta["frames"] == 4
    assert img.size[0] > 0 and img.size[1] > 0
    print("OK: attack sheet", img.size)


if __name__ == "__main__":
    main()
