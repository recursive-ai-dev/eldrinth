import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from catalog import (  # noqa: E402
    CATALOG, ENEMY_KEY_BY_TYPE, ITEM_KEY_BY_TYPE, PROP_KEY_BY_TYPE,
    TILE_KEY_BY_T_NAME, ACTOR_KEY_BY_ROLE, NPC_KEY_BY_PORTRAIT,
)

EXPECTED_TILES = {
    "GRASS", "DGRASS", "PATH", "WATER", "TREE", "ROCK", "RFLOOR", "RWALL",
    "CRYSTAL", "FLOWER", "BRIDGE", "GRAVE", "BONES", "TALLGRASS",
    "SPIREFLOOR", "SAND", "LEDGE", "SLOPE_UP_LEFT", "SLOPE_UP_RIGHT", "TRIGGER",
    "EMBERS", "HOUSE_WALL", "INTERIOR_FLOOR", "INTERIOR_WALL",
}

HOUSES = {
    "prop.house.oldstone", "prop.house.cinder", "prop.house.coastal", "prop.house.moor",
}


def main():
    assert set(TILE_KEY_BY_T_NAME) == EXPECTED_TILES
    assert set(ENEMY_KEY_BY_TYPE) == {"wraith", "sentinel", "adept", "boss"}
    assert set(ITEM_KEY_BY_TYPE) == {"shard", "potion"}
    assert set(PROP_KEY_BY_TYPE) == {"campfire", "sign", "lantern", "brazier"}
    assert set(ACTOR_KEY_BY_ROLE) == {"player", "guard", "refugee"}
    assert len(NPC_KEY_BY_PORTRAIT) == 13

    mapped = (
        set(TILE_KEY_BY_T_NAME.values())
        | set(ENEMY_KEY_BY_TYPE.values())
        | set(ITEM_KEY_BY_TYPE.values())
        | set(PROP_KEY_BY_TYPE.values())
        | set(ACTOR_KEY_BY_ROLE.values())
        | set(NPC_KEY_BY_PORTRAIT.values())
        | HOUSES
    )
    assert mapped == set(CATALOG), (mapped - set(CATALOG), set(CATALOG) - mapped)
    print("OK:", len(CATALOG), "catalog entries")


if __name__ == "__main__":
    main()
