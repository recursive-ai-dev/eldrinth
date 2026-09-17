"""The single source of truth for every generated Eldrinth sprite."""

CATALOG = {
    "player": {
        "kind": "human", "seed": "eldrinth-player-01", "palette": "grim_steel",
        "role": "player", "anims": ["walk", "attack"],
    },
    "guard": {
        "kind": "human", "seed": "eldrinth-guard-01", "palette": "grim_steel",
        "role": "guard", "anims": ["walk", "attack"],
    },
    "refugee": {
        "kind": "human", "seed": "eldrinth-refugee-01", "palette": "rusted_stone",
        "role": "refugee", "anims": ["walk"],
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
        "kind": "item", "category": "shard", "seed": "eldrinth-item-shard-01",
        "palette": "spire_anima",
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
    "prop.lantern": {
        "kind": "prop", "seed": "eldrinth-prop-lantern-01", "prop_type": "lantern",
        "palette": "rusted_stone", "anims": ["idle"], "frames": 2, "directions": ["front"],
    },
    "prop.brazier": {
        "kind": "prop", "seed": "eldrinth-prop-brazier-01", "prop_type": "brazier",
        "palette": "rusted_stone", "anims": ["idle"], "frames": 4, "directions": ["front"],
    },
    # The 13 canonical lore NPCs
    "npc.orithel-the-last-watcher": {
        "kind": "human", "seed": "eldrinth-npc-orithel", "palette": "spire_anima",
        "role": "orithel-the-last-watcher", "anims": ["walk"],
    },
    "npc.scribe-althea": {
        "kind": "human", "seed": "eldrinth-npc-althea", "palette": "sacred_gold",
        "role": "scribe-althea", "anims": ["walk"],
    },
    "npc.sister-mirene": {
        "kind": "human", "seed": "eldrinth-npc-mirene", "palette": "sickly_green",
        "role": "sister-mirene", "anims": ["walk"],
    },
    "npc.barris-the-smith": {
        "kind": "human", "seed": "eldrinth-npc-barris", "palette": "volcanic_ember",
        "role": "barris-the-smith", "anims": ["walk"],
    },
    "npc.kiln-master-vance": {
        "kind": "human", "seed": "eldrinth-npc-vance", "palette": "volcanic_ember",
        "role": "kiln-master-vance", "anims": ["walk"],
    },
    "npc.cinder-nurse-greta": {
        "kind": "human", "seed": "eldrinth-npc-greta", "palette": "cult_blood",
        "role": "cinder-nurse-greta", "anims": ["walk"],
    },
    "npc.elodie-outrunner": {
        "kind": "human", "seed": "eldrinth-npc-elodie", "palette": "cult_blood",
        "role": "elodie-outrunner", "anims": ["walk"],
    },
    "npc.mistress-morveth": {
        "kind": "human", "seed": "eldrinth-npc-morveth", "palette": "black_water",
        "role": "mistress-morveth", "anims": ["walk"],
    },
    "npc.sister-lyra": {
        "kind": "human", "seed": "eldrinth-npc-lyra", "palette": "sickly_green",
        "role": "sister-lyra", "anims": ["walk"],
    },
    "npc.kieran-blind-oar": {
        "kind": "human", "seed": "eldrinth-npc-kieran", "palette": "black_water",
        "role": "kieran-blind-oar", "anims": ["walk"],
    },
    "npc.reeve-toran": {
        "kind": "human", "seed": "eldrinth-npc-toran", "palette": "spire_anima",
        "role": "reeve-toran", "anims": ["walk"],
    },
    "npc.hermit-cassian": {
        "kind": "human", "seed": "eldrinth-npc-cassian", "palette": "bone_relic",
        "role": "hermit-cassian", "anims": ["walk"],
    },
    "npc.mina-drift-child": {
        "kind": "human", "seed": "eldrinth-npc-mina", "palette": "wraith_ash",
        "role": "mina-drift-child", "anims": ["walk"],
    },
    # Town buildings are complete three-by-three-tile props. Their map tiles
    # still provide collision and interaction points; this layer supplies the
    # roofline, lit windows, and a door the player can actually read.
    "prop.house.oldstone": {"kind": "settlement", "seed": "eldrinth-house-oldstone", "theme": "oldstone", "part": "cottage", "size": [96, 96]},
    "prop.house.cinder":    {"kind": "settlement", "seed": "eldrinth-house-cinder",    "theme": "cinder",    "part": "cottage", "size": [96, 96]},
    "prop.house.coastal":   {"kind": "settlement", "seed": "eldrinth-house-coastal",   "theme": "coastal",   "part": "cottage", "size": [96, 96]},
    "prop.house.moor":      {"kind": "settlement", "seed": "eldrinth-house-moor",      "theme": "moor",      "part": "cottage", "size": [96, 96]},

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
    "tile.embers":         {"kind": "tile", "seed": "eldrinth-tile-embers",         "tile_kind": "dirt",  "palette": "volcanic_ember", "feature": "embers"},
    "tile.interior_floor": {"kind": "settlement", "seed": "eldrinth-interior-floor", "theme": "oldstone", "part": "interior_floor"},
    "tile.interior_wall":  {"kind": "settlement", "seed": "eldrinth-interior-wall",  "theme": "oldstone", "part": "interior_wall"},
}

TILE_KEY_BY_T_NAME = {
    "GRASS": "tile.grass", "DGRASS": "tile.dgrass", "PATH": "tile.path",
    "WATER": "tile.water", "TREE": "tile.tree", "ROCK": "tile.rock",
    "RFLOOR": "tile.rfloor", "RWALL": "tile.rwall", "CRYSTAL": "tile.crystal",
    "FLOWER": "tile.flower", "BRIDGE": "tile.bridge", "GRAVE": "tile.grave",
    "BONES": "tile.bones", "TALLGRASS": "tile.tallgrass",
    "SPIREFLOOR": "tile.spirefloor", "SAND": "tile.sand", "LEDGE": "tile.ledge",
    "SLOPE_UP_LEFT": "tile.slope_up_left", "SLOPE_UP_RIGHT": "tile.slope_up_right",
    "TRIGGER": "tile.trigger", "EMBERS": "tile.embers", "HOUSE_WALL": "tile.rfloor",
    "INTERIOR_FLOOR": "tile.interior_floor", "INTERIOR_WALL": "tile.interior_wall",
}

ENEMY_KEY_BY_TYPE = {
    "wraith": "enemy.wraith", "sentinel": "enemy.sentinel",
    "adept": "enemy.adept", "boss": "enemy.boss",
}

ITEM_KEY_BY_TYPE = {"shard": "item.shard", "potion": "item.potion"}

PROP_KEY_BY_TYPE = {
    "campfire": "prop.campfire",
    "sign": "prop.sign",
    "lantern": "prop.lantern",
    "brazier": "prop.brazier",
}

ACTOR_KEY_BY_ROLE = {
    "player": "player",
    "guard": "guard",
    "refugee": "refugee",
}

KNOWN_PORTRAIT_IDS = [
    "orithel-the-last-watcher",
    "scribe-althea",
    "sister-mirene",
    "barris-the-smith",
    "kiln-master-vance",
    "cinder-nurse-greta",
    "elodie-outrunner",
    "mistress-morveth",
    "sister-lyra",
    "kieran-blind-oar",
    "reeve-toran",
    "hermit-cassian",
    "mina-drift-child",
]

NPC_KEY_BY_PORTRAIT = {pid: f"npc.{pid}" for pid in KNOWN_PORTRAIT_IDS}
