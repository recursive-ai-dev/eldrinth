"""Single source of truth mapping every eldrinth game entity to spritegen
generator parameters. Every T tile value (src/game/constants.ts), every
EnemyType, every ItemType, and "player" must appear here exactly once."""

CATALOG = {
    # -- player & enemies (kind: human | creature) --------------------------
    "player": {
        "kind": "human", "seed": "eldrinth-player-01",
        "palette_hint": "grim_steel", "anims": ["walk", "attack"],
    },
    "enemy.wraith": {
        "kind": "creature", "archetype": "tentacle", "seed": "eldrinth-wraith-01",
        "palette_hint": "wraith_ash", "anims": ["walk", "attack"],
    },
    "enemy.sentinel": {
        "kind": "creature", "archetype": "golem", "seed": "eldrinth-sentinel-01",
        "palette_hint": "rusted_stone", "anims": ["walk", "attack"],
    },
    "enemy.adept": {
        "kind": "human", "seed": "eldrinth-adept-01",
        "palette_hint": "cult_blood", "anims": ["walk", "attack"],
    },
    "enemy.boss": {
        "kind": "creature", "archetype": "biped", "seed": "eldrinth-boss-01",
        "palette_hint": "corrupted_flesh", "anims": ["walk", "attack"],
    },

    # -- items (kind: item, static) ------------------------------------------
    "item.shard": {"kind": "item", "seed": "eldrinth-item-shard-01", "palette_hint": "bone_relic"},
    "item.potion": {"kind": "item", "seed": "eldrinth-item-potion-01", "palette_hint": "cult_blood"},

    # -- tiles (kind: tile, static, one per T enum value) --------------------
    "tile.grass":          {"kind": "tile", "seed": "eldrinth-tile-grass",          "tile_kind": "grass", "palette_hint": "sickly_green", "autotile": True},
    "tile.dgrass":         {"kind": "tile", "seed": "eldrinth-tile-dgrass",         "tile_kind": "grass", "palette_hint": "sickly_green"},
    "tile.path":           {"kind": "tile", "seed": "eldrinth-tile-path",          "tile_kind": "dirt",  "palette_hint": "rusted_stone"},
    "tile.water":          {"kind": "tile", "seed": "eldrinth-tile-water",         "tile_kind": "water", "palette_hint": "black_water",   "autotile": True},
    "tile.tree":           {"kind": "tile", "seed": "eldrinth-tile-tree",          "tile_kind": "moss",  "palette_hint": "sickly_green"},
    "tile.rock":           {"kind": "tile", "seed": "eldrinth-tile-rock",          "tile_kind": "stone", "palette_hint": "rusted_stone"},
    "tile.rfloor":         {"kind": "tile", "seed": "eldrinth-tile-rfloor",        "tile_kind": "cobble","palette_hint": "grim_steel"},
    "tile.rwall":          {"kind": "tile", "seed": "eldrinth-tile-rwall",         "tile_kind": "brick", "palette_hint": "grim_steel"},
    "tile.crystal":        {"kind": "tile", "seed": "eldrinth-tile-crystal",       "tile_kind": "stone", "palette_hint": "wraith_ash"},
    "tile.flower":         {"kind": "tile", "seed": "eldrinth-tile-flower",        "tile_kind": "grass", "palette_hint": "sickly_green"},
    "tile.bridge":         {"kind": "tile", "seed": "eldrinth-tile-bridge",        "tile_kind": "wood",  "palette_hint": "rusted_stone"},
    "tile.grave":          {"kind": "tile", "seed": "eldrinth-tile-grave",         "tile_kind": "stone", "palette_hint": "bone_relic"},
    "tile.bones":          {"kind": "tile", "seed": "eldrinth-tile-bones",         "tile_kind": "sand",  "palette_hint": "bone_relic"},
    "tile.tallgrass":      {"kind": "tile", "seed": "eldrinth-tile-tallgrass",     "tile_kind": "grass", "palette_hint": "sickly_green"},
    "tile.spirefloor":     {"kind": "tile", "seed": "eldrinth-tile-spirefloor",    "tile_kind": "cobble","palette_hint": "wraith_ash"},
    "tile.sand":           {"kind": "tile", "seed": "eldrinth-tile-sand",          "tile_kind": "sand",  "palette_hint": "rusted_stone"},
    "tile.ledge":          {"kind": "tile", "seed": "eldrinth-tile-ledge",         "tile_kind": "stone", "palette_hint": "rusted_stone"},
    "tile.slope_up_left":  {"kind": "tile", "seed": "eldrinth-tile-slope-up-left", "tile_kind": "dirt",  "palette_hint": "rusted_stone"},
    "tile.slope_up_right": {"kind": "tile", "seed": "eldrinth-tile-slope-up-right","tile_kind": "dirt",  "palette_hint": "rusted_stone"},
    "tile.trigger":        {"kind": "tile", "seed": "eldrinth-tile-trigger",       "tile_kind": "cobble","palette_hint": "cult_blood"},
}

# Maps each catalog key back to the exact eldrinth-side identifier the
# renderer/loader will look it up by (see spriteAtlas.ts in Task 9).
TILE_KEY_BY_T_NAME = {
    "GRASS": "tile.grass", "DGRASS": "tile.dgrass", "PATH": "tile.path",
    "WATER": "tile.water", "TREE": "tile.tree", "ROCK": "tile.rock",
    "RFLOOR": "tile.rfloor", "RWALL": "tile.rwall", "CRYSTAL": "tile.crystal",
    "FLOWER": "tile.flower", "BRIDGE": "tile.bridge", "GRAVE": "tile.grave",
    "BONES": "tile.bones", "TALLGRASS": "tile.tallgrass",
    "SPIREFLOOR": "tile.spirefloor", "SAND": "tile.sand", "LEDGE": "tile.ledge",
    "SLOPE_UP_LEFT": "tile.slope_up_left", "SLOPE_UP_RIGHT": "tile.slope_up_right",
    "TRIGGER": "tile.trigger",
}

ENEMY_KEY_BY_TYPE = {
    "wraith": "enemy.wraith", "sentinel": "enemy.sentinel",
    "adept": "enemy.adept", "boss": "enemy.boss",
}

ITEM_KEY_BY_TYPE = {"shard": "item.shard", "potion": "item.potion"}
