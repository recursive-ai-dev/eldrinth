import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from catalog import CATALOG, TILE_KEY_BY_T_NAME, ENEMY_KEY_BY_TYPE, ITEM_KEY_BY_TYPE  # noqa: E402

EXPECTED_TILE_NAMES = {
    "GRASS", "DGRASS", "PATH", "WATER", "TREE", "ROCK", "RFLOOR", "RWALL",
    "CRYSTAL", "FLOWER", "BRIDGE", "GRAVE", "BONES", "TALLGRASS",
    "SPIREFLOOR", "SAND", "LEDGE", "SLOPE_UP_LEFT", "SLOPE_UP_RIGHT", "TRIGGER",
}
EXPECTED_ENEMY_TYPES = {"wraith", "sentinel", "adept", "boss"}
EXPECTED_ITEM_TYPES = {"shard", "potion"}


def main():
    assert set(TILE_KEY_BY_T_NAME) == EXPECTED_TILE_NAMES, TILE_KEY_BY_T_NAME.keys()
    assert set(ENEMY_KEY_BY_TYPE) == EXPECTED_ENEMY_TYPES
    assert set(ITEM_KEY_BY_TYPE) == EXPECTED_ITEM_TYPES

    for mapping in (TILE_KEY_BY_T_NAME, ENEMY_KEY_BY_TYPE, ITEM_KEY_BY_TYPE):
        for key in mapping.values():
            assert key in CATALOG, f"{key} referenced but missing from CATALOG"
    assert "player" in CATALOG

    print("OK:", len(CATALOG), "catalog entries")


if __name__ == "__main__":
    main()
