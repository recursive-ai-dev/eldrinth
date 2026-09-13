import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from catalog import CATALOG, ENEMY_KEY_BY_TYPE, ITEM_KEY_BY_TYPE, TILE_KEY_BY_T_NAME  # noqa: E402

EXPECTED_TILES = {
    "GRASS", "DGRASS", "PATH", "WATER", "TREE", "ROCK", "RFLOOR", "RWALL",
    "CRYSTAL", "FLOWER", "BRIDGE", "GRAVE", "BONES", "TALLGRASS",
    "SPIREFLOOR", "SAND", "LEDGE", "SLOPE_UP_LEFT", "SLOPE_UP_RIGHT", "TRIGGER",
}


def main():
    assert set(TILE_KEY_BY_T_NAME) == EXPECTED_TILES
    assert set(ENEMY_KEY_BY_TYPE) == {"wraith", "sentinel", "adept", "boss"}
    assert set(ITEM_KEY_BY_TYPE) == {"shard", "potion"}
    mapped = set(TILE_KEY_BY_T_NAME.values()) | set(ENEMY_KEY_BY_TYPE.values()) | set(ITEM_KEY_BY_TYPE.values()) | {"player"}
    assert mapped == set(CATALOG), (mapped - set(CATALOG), set(CATALOG) - mapped)
    print("OK:", len(CATALOG), "catalog entries")


if __name__ == "__main__":
    main()
