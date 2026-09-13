"""The single source of truth for every generated Eldrinth sprite."""

CATALOG = {
    "player": {
        "kind": "human", "seed": "eldrinth-player-01", "palette": "grim_steel",
        "role": "player", "anims": ["walk", "attack"],
    },
    "enemy.wraith": {
        "kind": "creature", "archetype": "tentacle", "seed": "eldrinth-wraith-01",
        "palette": "wraith_ash", "anims": ["walk", "attack"],
    },
    "enemy.sentinel": {
        "kind": "creature", "archetype": "golem", "seed": "eldrinth-sentinel-01",
        "palette": "rusted_stone", "anims": ["walk", "attack"],
    },
    "enemy.adept": {
        "kind": "human", "seed": "eldrinth-adept-01", "palette": "cult_blood",
        "role": "adept", "anims": ["walk", "attack"],
    },
    "enemy.boss": {
        "kind": "creature", "archetype": "biped", "seed": "eldrinth-boss-01",
        "palette": "corrupted_flesh", "anims": ["walk", "attack"], "size": 64,
    },
    "item.shard": {
        "kind": "item", "category": "gem", "seed": "eldrinth-item-shard-01",
        "palette": "wraith_ash",
    },
    "item.potion": {
        "kind": "item", "category": "potion", "seed": "eldrinth-item-potion-01",
        "palette": "cult_blood",
    },
    "prop.campfire": {
        "kind": "prop", "seed": "eldrinth-prop-campfire-01", "prop_type": "campfire",
        "palette": "rusted_stone", "anims": ["idle"], "frames": 4, "directions": ["front"],
    },
    "prop.sign": {
        "kind": "prop", "seed": "eldrinth-prop-sign-01", "prop_type": "sign",
        "palette": "rusted_stone",
    },

    "tile.grass":          {"kind": "tile", "seed": "eldrinth-tile-grass",          "tile_kind": "grass", "palette": "sickly_green", "autotile": True},
    "tile.dgrass":         {"kind": "tile", "seed": "eldrinth-tile-dgrass",         "tile_kind": "moss",  "palette": "sickly_green", "feature": "darken"},
    "tile.path":           {"kind": "tile", "seed": "eldrinth-tile-path",           "tile_kind": "dirt",  "palette": "rusted_stone", "autotile": True},
    "tile.water":          {"kind": "tile", "seed": "eldrinth-tile-water",          "tile_kind": "water", "palette": "black_water", "autotile": True},
    "tile.tree":           {"kind": "tile", "seed": "eldrinth-tile-tree",           "tile_kind": "grass", "palette": "sickly_green", "feature": "tree"},
    "tile.rock":           {"kind": "tile", "seed": "eldrinth-tile-rock",           "tile_kind": "grass", "palette": "sickly_green", "feature": "rock"},
    "tile.rfloor":         {"kind": "tile", "seed": "eldrinth-tile-rfloor",         "tile_kind": "cobble", "palette": "grim_steel"},
    "tile.rwall":          {"kind": "tile", "seed": "eldrinth-tile-rwall",          "tile_kind": "brick", "palette": "grim_steel", "feature": "wall"},
    "tile.crystal":        {"kind": "tile", "seed": "eldrinth-tile-crystal",        "tile_kind": "grass", "palette": "sickly_green", "feature": "crystal"},
    "tile.flower":         {"kind": "tile", "seed": "eldrinth-tile-flower",         "tile_kind": "grass", "palette": "sickly_green", "feature": "flower"},
    "tile.bridge":         {"kind": "tile", "seed": "eldrinth-tile-bridge",         "tile_kind": "wood", "palette": "rusted_stone", "feature": "bridge"},
    "tile.grave":          {"kind": "tile", "seed": "eldrinth-tile-grave",          "tile_kind": "grass", "palette": "sickly_green", "feature": "grave"},
    "tile.bones":          {"kind": "tile", "seed": "eldrinth-tile-bones",          "tile_kind": "grass", "palette": "sickly_green", "feature": "bones"},
    "tile.tallgrass":      {"kind": "tile", "seed": "eldrinth-tile-tallgrass",      "tile_kind": "grass", "palette": "sickly_green", "feature": "tallgrass"},
    "tile.spirefloor":     {"kind": "tile", "seed": "eldrinth-tile-spirefloor",     "tile_kind": "cobble", "palette": "black_water", "feature": "rune"},
    "tile.sand":           {"kind": "tile", "seed": "eldrinth-tile-sand",           "tile_kind": "sand", "palette": "bone_relic", "autotile": True},
    "tile.ledge":          {"kind": "tile", "seed": "eldrinth-tile-ledge",          "tile_kind": "stone", "palette": "rusted_stone", "feature": "ledge"},
    "tile.slope_up_left":  {"kind": "tile", "seed": "eldrinth-tile-slope-up-left",  "tile_kind": "dirt", "palette": "rusted_stone", "feature": "slope_left"},
    "tile.slope_up_right": {"kind": "tile", "seed": "eldrinth-tile-slope-up-right", "tile_kind": "dirt", "palette": "rusted_stone", "feature": "slope_right"},
    "tile.trigger":        {"kind": "tile", "seed": "eldrinth-tile-trigger",        "tile_kind": "cobble", "palette": "grim_steel", "feature": "sigil"},
}

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

PROP_KEY_BY_TYPE = {"campfire": "prop.campfire", "sign": "prop.sign"}
