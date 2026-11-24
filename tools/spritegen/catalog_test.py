import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from catalog import (  # noqa: E402
    CATALOG, ENEMY_KEY_BY_TYPE, WARDEN_KEY_BY_REGION, ITEM_KEY_BY_TYPE,
    PROP_KEY_BY_TYPE, CIVIC_KEY_BY_TYPE, FORTRESS_KEY_BY_ID,
    TILE_KEY_BY_T_NAME, REGIONAL_TILE_KEYS, ACTOR_KEY_BY_ROLE,
    NPC_KEY_BY_PORTRAIT, REGIONAL_MASTER_PALETTES,
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
    assert set(WARDEN_KEY_BY_REGION) == {"old-lands", "cinderwild", "moonlit-coast", "starfall-moors"}
    assert set(ITEM_KEY_BY_TYPE) == {"shard", "potion"}
    assert set(PROP_KEY_BY_TYPE) == {"campfire", "sign", "lantern", "brazier"}
    assert set(CIVIC_KEY_BY_TYPE) == {"hall", "smithy", "shrine", "watchtower"}
    assert len(FORTRESS_KEY_BY_ID) == 9
    assert len(REGIONAL_TILE_KEYS) == 18
    assert set(ACTOR_KEY_BY_ROLE) == {"player", "guard", "refugee"}
    assert len(NPC_KEY_BY_PORTRAIT) == 13
    assert set(REGIONAL_MASTER_PALETTES) == {"oldlands", "cinderwild", "moonlit", "starfall"}

    for tile_key in ("tile.grass", "tile.path", "tile.water", "tile.rwall", "tile.sand"):
        assert CATALOG[tile_key]["autotile"] == "blob", f"{tile_key} must use 47-tile Blob Wang"

    for npc_key in NPC_KEY_BY_PORTRAIT.values():
        assert "idle" in CATALOG[npc_key]["anims"] and "walk" in CATALOG[npc_key]["anims"]

    for caster in ("enemy.adept", "enemy.boss", *WARDEN_KEY_BY_REGION.values()):
        assert {"idle", "walk", "attack", "cast", "hurt", "death"} <= set(CATALOG[caster]["anims"])

    mapped = (
        set(TILE_KEY_BY_T_NAME.values())
        | REGIONAL_TILE_KEYS
        | set(ENEMY_KEY_BY_TYPE.values())
        | set(WARDEN_KEY_BY_REGION.values())
        | set(ITEM_KEY_BY_TYPE.values())
        | set(PROP_KEY_BY_TYPE.values())
        | set(CIVIC_KEY_BY_TYPE.values())
        | set(FORTRESS_KEY_BY_ID.values())
        | set(ACTOR_KEY_BY_ROLE.values())
        | set(NPC_KEY_BY_PORTRAIT.values())
        | HOUSES
    )
    assert mapped == set(CATALOG), (mapped - set(CATALOG), set(CATALOG) - mapped)
    print("OK:", len(CATALOG), "catalog entries")


if __name__ == "__main__":
    main()
