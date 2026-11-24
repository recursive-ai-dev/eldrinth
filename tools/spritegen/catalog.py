"""The single source of truth for every generated Eldrinth sprite."""

# Cohesive regional master palettes (28-30 RGB stops each) locked via CIELAB ΔE
# snapping so terrain, foliage, cottages, civic halls, and fortresses read as a
# unified dark-fantasy material set in each of Eldrinth's four regions.
REGIONAL_MASTER_PALETTES = {
    "oldlands": (
        (10, 9, 13), (18, 22, 20), (24, 34, 22), (32, 30, 38),
        (34, 52, 26), (48, 74, 36), (70, 104, 50), (100, 140, 66),
        (54, 38, 26), (78, 56, 38), (106, 78, 52), (138, 106, 72),
        (58, 60, 68), (84, 86, 94), (116, 114, 108), (152, 148, 138),
        (192, 184, 162), (228, 220, 196), (248, 242, 222),
        (168, 132, 62), (218, 182, 98), (252, 226, 152),
        (146, 36, 46), (206, 62, 72),
        (36, 98, 106), (56, 178, 176), (132, 232, 224), (218, 252, 246),
    ),
    "cinderwild": (
        (12, 9, 10), (22, 16, 16), (34, 26, 24), (48, 36, 32),
        (58, 48, 38), (78, 64, 48), (102, 84, 60), (128, 106, 76),
        (72, 36, 26), (104, 52, 34), (138, 74, 46), (174, 104, 62),
        (62, 58, 62), (90, 84, 86), (126, 116, 112), (166, 152, 140),
        (210, 194, 174), (242, 228, 206),
        (148, 30, 18), (198, 58, 24), (242, 114, 30), (255, 178, 58),
        (255, 228, 136), (255, 248, 206),
        (46, 132, 136), (98, 204, 198),
    ),
    "moonlit": (
        (8, 12, 18), (14, 24, 36), (22, 38, 54), (32, 54, 72),
        (22, 46, 42), (36, 68, 60), (54, 94, 82), (78, 124, 106),
        (58, 48, 38), (86, 72, 56), (120, 106, 84), (158, 144, 118),
        (48, 62, 74), (74, 92, 104), (104, 128, 136), (142, 168, 172),
        (186, 204, 202), (224, 230, 220), (246, 246, 236),
        (164, 132, 68), (224, 192, 112), (252, 238, 184),
        (38, 132, 150), (78, 198, 206), (156, 238, 236), (222, 254, 250),
    ),
    "starfall": (
        (10, 8, 16), (20, 16, 30), (32, 24, 46), (46, 36, 64),
        (36, 40, 52), (52, 56, 72), (72, 66, 94), (96, 86, 122),
        (48, 36, 44), (74, 56, 64), (104, 80, 86), (138, 110, 112),
        (60, 62, 78), (88, 90, 110), (124, 124, 146), (166, 164, 186),
        (210, 208, 226), (242, 240, 252),
        (112, 62, 164), (156, 102, 214), (204, 162, 250), (236, 212, 255),
        (186, 152, 86), (238, 208, 132),
        (54, 172, 186), (138, 232, 238),
    ),
}

CATALOG = {
    # Core playable & town actors
    "player": {
        "kind": "human", "seed": "eldrinth-player-01", "palette": "grim_steel",
        "role": "player", "anims": ["idle", "walk", "attack", "hurt", "death"],
    },
    "guard": {
        "kind": "human", "seed": "eldrinth-guard-01", "palette": "grim_steel",
        "role": "guard", "anims": ["idle", "walk", "attack"],
    },
    "refugee": {
        "kind": "human", "seed": "eldrinth-refugee-01", "palette": "rusted_stone",
        "role": "refugee", "anims": ["idle", "walk"],
    },
    # Base enemy cast
    "enemy.wraith": {
        "kind": "creature", "archetype": "tentacle", "seed": "eldrinth-wraith-01",
        "palette": "wraith_ash", "anims": ["idle", "walk", "attack", "hurt", "death"],
    },
    "enemy.sentinel": {
        "kind": "creature", "archetype": "golem", "seed": "eldrinth-sentinel-01",
        "palette": "rusted_stone", "anims": ["idle", "walk", "attack", "hurt", "death"],
    },
    "enemy.adept": {
        "kind": "human", "seed": "eldrinth-adept-01", "palette": "cult_blood",
        "role": "adept", "anims": ["idle", "walk", "attack", "cast", "hurt", "death"],
    },
    "enemy.boss": {
        "kind": "creature", "archetype": "biped", "seed": "eldrinth-boss-01",
        "color_seed": 2, "palette": "corrupted_flesh",
        "anims": ["idle", "walk", "attack", "cast", "hurt", "death"], "size": 64,
    },
    # Regional elite sentinels / fortress wardens (distinct silhouettes & palettes)
    "enemy.warden.old-lands": {
        "kind": "creature", "archetype": "golem", "seed": "eldrinth-warden-old-lands-05",
        "palette": "sacred_gold", "size": 40,
        "anims": ["idle", "walk", "attack", "cast", "hurt", "death"],
    },
    "enemy.warden.cinderwild": {
        "kind": "creature", "archetype": "biped", "seed": "eldrinth-warden-cinderwild-05",
        "palette": "volcanic_ember", "size": 40,
        "anims": ["idle", "walk", "attack", "cast", "hurt", "death"],
    },
    "enemy.warden.moonlit-coast": {
        "kind": "creature", "archetype": "tentacle", "seed": "eldrinth-warden-moonlit-coast-01",
        "palette": "spire_anima", "size": 40,
        "anims": ["idle", "walk", "attack", "cast", "hurt", "death"],
    },
    "enemy.warden.starfall-moors": {
        "kind": "creature", "archetype": "winged", "seed": "eldrinth-warden-starfall-moors-03",
        "palette": "magic", "size": 40,
        "anims": ["idle", "walk", "attack", "cast", "hurt", "death"],
    },
    # Pickups & world props
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
    # The 13 canonical lore NPCs (with idle stance + walk frames)
    "npc.orithel-the-last-watcher": {
        "kind": "human", "seed": "eldrinth-npc-orithel", "palette": "spire_anima",
        "role": "orithel-the-last-watcher", "anims": ["idle", "walk"],
    },
    "npc.scribe-althea": {
        "kind": "human", "seed": "eldrinth-npc-althea", "palette": "sacred_gold",
        "role": "scribe-althea", "anims": ["idle", "walk"],
    },
    "npc.sister-mirene": {
        "kind": "human", "seed": "eldrinth-npc-mirene", "palette": "sickly_green",
        "role": "sister-mirene", "anims": ["idle", "walk"],
    },
    "npc.barris-the-smith": {
        "kind": "human", "seed": "eldrinth-npc-barris", "palette": "volcanic_ember",
        "role": "barris-the-smith", "anims": ["idle", "walk"],
    },
    "npc.kiln-master-vance": {
        "kind": "human", "seed": "eldrinth-npc-vance", "palette": "volcanic_ember",
        "role": "kiln-master-vance", "anims": ["idle", "walk"],
    },
    "npc.cinder-nurse-greta": {
        "kind": "human", "seed": "eldrinth-npc-greta", "palette": "cult_blood",
        "role": "cinder-nurse-greta", "anims": ["idle", "walk"],
    },
    "npc.elodie-outrunner": {
        "kind": "human", "seed": "eldrinth-npc-elodie", "palette": "cult_blood",
        "role": "elodie-outrunner", "anims": ["idle", "walk"],
    },
    "npc.mistress-morveth": {
        "kind": "human", "seed": "eldrinth-npc-morveth", "palette": "black_water",
        "role": "mistress-morveth", "anims": ["idle", "walk"],
    },
    "npc.sister-lyra": {
        "kind": "human", "seed": "eldrinth-npc-lyra", "palette": "sickly_green",
        "role": "sister-lyra", "anims": ["idle", "walk"],
    },
    "npc.kieran-blind-oar": {
        "kind": "human", "seed": "eldrinth-npc-kieran", "palette": "black_water",
        "role": "kieran-blind-oar", "anims": ["idle", "walk"],
    },
    "npc.reeve-toran": {
        "kind": "human", "seed": "eldrinth-npc-toran", "palette": "spire_anima",
        "role": "reeve-toran", "anims": ["idle", "walk"],
    },
    "npc.hermit-cassian": {
        "kind": "human", "seed": "eldrinth-npc-cassian", "palette": "bone_relic",
        "role": "hermit-cassian", "anims": ["idle", "walk"],
    },
    "npc.mina-drift-child": {
        "kind": "human", "seed": "eldrinth-npc-mina", "palette": "wraith_ash",
        "role": "mina-drift-child", "anims": ["idle", "walk"],
    },
    # Regional settlement cottages (3x3-tile props with centered doorways)
    "prop.house.oldstone": {"kind": "settlement", "seed": "eldrinth-house-oldstone", "trim_seed": 2, "theme": "oldstone", "part": "cottage", "size": [96, 96], "region_palette": "oldlands"},
    "prop.house.cinder":   {"kind": "settlement", "seed": "eldrinth-house-cinder",   "trim_seed": 1, "theme": "cinder",   "part": "cottage", "size": [96, 96], "region_palette": "cinderwild"},
    "prop.house.coastal":  {"kind": "settlement", "seed": "eldrinth-house-coastal",  "trim_seed": 3, "theme": "coastal",  "part": "cottage", "size": [96, 96], "region_palette": "moonlit"},
    "prop.house.moor":     {"kind": "settlement", "seed": "eldrinth-house-moor",     "trim_seed": 1, "theme": "moor",     "part": "cottage", "size": [96, 96], "region_palette": "starfall"},
    # Distinct civic structures (war.py `structure` at 96x96 = 3x3 tiles)
    "prop.civic.hall":       {"kind": "structure", "seed": "eldrinth-civic-hall-01",   "faction": "human",   "structure_kind": "hall",       "tiles": 3, "tile_px": 32, "region_palette": "oldlands"},
    "prop.civic.smithy":     {"kind": "structure", "seed": "eldrinth-civic-smithy-01", "faction": "human",   "structure_kind": "blacksmith", "tiles": 3, "tile_px": 32, "region_palette": "cinderwild"},
    "prop.civic.shrine":     {"kind": "structure", "seed": "eldrinth-civic-shrine-01", "faction": "darkelf", "structure_kind": "tower",      "tiles": 3, "tile_px": 32, "region_palette": "starfall"},
    "prop.civic.watchtower": {"kind": "structure", "seed": "eldrinth-civic-tower-01",  "faction": "human",   "structure_kind": "tower",      "tiles": 3, "tile_px": 32, "region_palette": "moonlit"},
    # Nine bespoke shard fortress exteriors (war.py `structure` at 128x128 = 4x4 tiles)
    "prop.fortress.old-lands-archive":    {"kind": "structure", "seed": "eldrinth-fort-archive-01",   "faction": "human",     "structure_kind": "hall",     "tiles": 4, "tile_px": 32, "region_palette": "oldlands"},
    "prop.fortress.old-lands-reliquary":  {"kind": "structure", "seed": "eldrinth-fort-reliquary-01", "faction": "darkelf",   "structure_kind": "tower",    "tiles": 4, "tile_px": 32, "region_palette": "oldlands"},
    "prop.fortress.old-lands-vault":      {"kind": "structure", "seed": "eldrinth-fort-vault-01",     "faction": "darkelf",   "structure_kind": "hall",     "tiles": 4, "tile_px": 32, "region_palette": "oldlands"},
    "prop.fortress.cinderwild-shrine":    {"kind": "structure", "seed": "eldrinth-fort-shrine-01",    "faction": "corrupted", "structure_kind": "hall",     "tiles": 4, "tile_px": 32, "region_palette": "cinderwild"},
    "prop.fortress.cinderwild-watchpost": {"kind": "structure", "seed": "eldrinth-fort-watchpost-01", "faction": "human",     "structure_kind": "barracks", "tiles": 4, "tile_px": 32, "region_palette": "cinderwild"},
    "prop.fortress.moonlit-salt-graves":  {"kind": "structure", "seed": "eldrinth-fort-salt-01",      "faction": "corrupted", "structure_kind": "barracks", "tiles": 4, "tile_px": 32, "region_palette": "moonlit"},
    "prop.fortress.moonlit-beacon":       {"kind": "structure", "seed": "eldrinth-fort-beacon-02",    "faction": "human",     "structure_kind": "tower",    "tiles": 4, "tile_px": 32, "region_palette": "moonlit"},
    "prop.fortress.starfall-observatory": {"kind": "structure", "seed": "eldrinth-fort-obs-01",       "faction": "darkelf",   "structure_kind": "mill",     "tiles": 4, "tile_px": 32, "region_palette": "starfall"},
    "prop.fortress.starfall-watch":       {"kind": "structure", "seed": "eldrinth-fort-watch-01",     "faction": "darkelf",   "structure_kind": "barracks", "tiles": 4, "tile_px": 32, "region_palette": "starfall"},

    # Core terrain sets (47-tile Blob Wang autotiling on grass, path, water, rwall, sand)
    "tile.grass":          {"kind": "tile", "seed": "eldrinth-tile-grass",          "tile_kind": "grass",  "palette": "sickly_green",   "autotile": "blob", "feature": "grass_edge", "region_palette": "oldlands"},
    "tile.dgrass":         {"kind": "tile", "seed": "eldrinth-tile-dgrass",         "tile_kind": "moss",   "palette": "sickly_green",   "feature": "darken", "region_palette": "oldlands"},
    "tile.path":           {"kind": "tile", "seed": "eldrinth-tile-path",           "tile_kind": "dirt",   "palette": "rusted_stone",   "autotile": "blob", "feature": "path_edge",  "region_palette": "oldlands"},
    "tile.water":          {"kind": "tile", "seed": "eldrinth-tile-water",          "tile_kind": "water",  "palette": "black_water",    "autotile": "blob", "feature": "water_edge"},
    "tile.tree":           {"kind": "tile", "seed": "eldrinth-tile-tree",           "tile_kind": "grass",  "palette": "sickly_green",   "feature": "tree",      "region_palette": "oldlands"},
    "tile.rock":           {"kind": "tile", "seed": "eldrinth-tile-rock",           "tile_kind": "grass",  "palette": "sickly_green",   "feature": "rock",      "region_palette": "oldlands"},
    "tile.rfloor":         {"kind": "tile", "seed": "eldrinth-tile-rfloor",         "tile_kind": "cobble", "palette": "grim_steel"},
    "tile.rwall":          {"kind": "tile", "seed": "eldrinth-tile-rwall",          "tile_kind": "brick",  "palette": "grim_steel",     "autotile": "blob", "feature": "wall"},
    "tile.crystal":        {"kind": "tile", "seed": "eldrinth-tile-crystal",        "tile_kind": "grass",  "palette": "sickly_green",   "feature": "crystal"},
    "tile.flower":         {"kind": "tile", "seed": "eldrinth-tile-flower",         "tile_kind": "grass",  "palette": "sickly_green",   "feature": "flower",    "region_palette": "oldlands"},
    "tile.bridge":         {"kind": "tile", "seed": "eldrinth-tile-bridge",         "tile_kind": "wood",   "palette": "rusted_stone",   "feature": "bridge"},
    "tile.grave":          {"kind": "tile", "seed": "eldrinth-tile-grave",          "tile_kind": "grass",  "palette": "sickly_green",   "feature": "grave",     "region_palette": "oldlands"},
    "tile.bones":          {"kind": "tile", "seed": "eldrinth-tile-bones",          "tile_kind": "grass",  "palette": "sickly_green",   "feature": "bones",     "region_palette": "oldlands"},
    "tile.tallgrass":      {"kind": "tile", "seed": "eldrinth-tile-tallgrass",      "tile_kind": "grass",  "palette": "sickly_green",   "feature": "tallgrass", "region_palette": "oldlands"},
    "tile.spirefloor":     {"kind": "tile", "seed": "eldrinth-tile-spirefloor",     "tile_kind": "cobble", "palette": "black_water",    "feature": "rune"},
    "tile.sand":           {"kind": "tile", "seed": "eldrinth-tile-sand",           "tile_kind": "sand",   "palette": "bone_relic",     "autotile": "blob", "feature": "sand_edge"},
    "tile.ledge":          {"kind": "tile", "seed": "eldrinth-tile-ledge",          "tile_kind": "stone",  "palette": "rusted_stone",   "feature": "ledge"},
    "tile.slope_up_left":  {"kind": "tile", "seed": "eldrinth-tile-slope-up-left",  "tile_kind": "dirt",   "palette": "rusted_stone",   "feature": "slope_left"},
    "tile.slope_up_right": {"kind": "tile", "seed": "eldrinth-tile-slope-up-right", "tile_kind": "dirt",   "palette": "rusted_stone",   "feature": "slope_right"},
    "tile.trigger":        {"kind": "tile", "seed": "eldrinth-tile-trigger",        "tile_kind": "cobble", "palette": "grim_steel",     "feature": "sigil"},
    "tile.embers":         {"kind": "tile", "seed": "eldrinth-tile-embers",         "tile_kind": "dirt",   "palette": "volcanic_ember", "feature": "embers"},
    "tile.interior_floor": {"kind": "settlement", "seed": "eldrinth-interior-floor", "theme": "oldstone", "part": "interior_floor"},
    "tile.interior_wall":  {"kind": "settlement", "seed": "eldrinth-interior-wall",  "theme": "oldstone", "part": "interior_wall"},

    # Regional palette-locked frontier terrain sets
    "tile.grass.cinderwild":     {"kind": "tile", "seed": "eldrinth-cinder-grass",     "tile_kind": "dirt",  "palette": "rusted_stone",   "autotile": "blob", "feature": "grass_edge", "biome": "cinderwild", "region_palette": "cinderwild"},
    "tile.dgrass.cinderwild":    {"kind": "tile", "seed": "eldrinth-cinder-dgrass",    "tile_kind": "mud",   "palette": "rusted_stone",   "feature": "darken",     "biome": "cinderwild", "region_palette": "cinderwild"},
    "tile.path.cinderwild":      {"kind": "tile", "seed": "eldrinth-cinder-path",      "tile_kind": "stone", "palette": "grim_steel",     "autotile": "blob", "feature": "path_edge",  "biome": "cinderwild", "region_palette": "cinderwild"},
    "tile.tree.cinderwild":      {"kind": "tile", "seed": "eldrinth-cinder-tree",      "tile_kind": "dirt",  "palette": "rusted_stone",   "feature": "tree",       "biome": "cinderwild", "region_palette": "cinderwild"},
    "tile.rock.cinderwild":      {"kind": "tile", "seed": "eldrinth-cinder-rock",      "tile_kind": "dirt",  "palette": "rusted_stone",   "feature": "rock",       "biome": "cinderwild", "region_palette": "cinderwild"},
    "tile.tallgrass.cinderwild": {"kind": "tile", "seed": "eldrinth-cinder-tallgrass", "tile_kind": "dirt",  "palette": "rusted_stone",   "feature": "tallgrass",  "biome": "cinderwild", "region_palette": "cinderwild"},

    "tile.grass.moonlit":        {"kind": "tile", "seed": "eldrinth-moonlit-grass",     "tile_kind": "grass", "palette": "sickly_green",    "autotile": "blob", "feature": "grass_edge", "biome": "moonlit", "region_palette": "moonlit"},
    "tile.dgrass.moonlit":       {"kind": "tile", "seed": "eldrinth-moonlit-dgrass",    "tile_kind": "moss",  "palette": "sickly_green",    "feature": "darken",     "biome": "moonlit", "region_palette": "moonlit"},
    "tile.path.moonlit":         {"kind": "tile", "seed": "eldrinth-moonlit-path",      "tile_kind": "sand",  "palette": "bone_relic",     "autotile": "blob", "feature": "path_edge",  "biome": "moonlit", "region_palette": "moonlit"},
    "tile.tree.moonlit":         {"kind": "tile", "seed": "eldrinth-moonlit-tree",      "tile_kind": "grass", "palette": "sickly_green",    "feature": "tree",       "biome": "moonlit", "region_palette": "moonlit"},
    "tile.rock.moonlit":         {"kind": "tile", "seed": "eldrinth-moonlit-rock",      "tile_kind": "grass", "palette": "sickly_green",    "feature": "rock",       "biome": "moonlit", "region_palette": "moonlit"},
    "tile.tallgrass.moonlit":    {"kind": "tile", "seed": "eldrinth-moonlit-tallgrass", "tile_kind": "grass", "palette": "sickly_green",    "feature": "tallgrass",  "biome": "moonlit", "region_palette": "moonlit"},

    "tile.grass.starfall":       {"kind": "tile", "seed": "eldrinth-starfall-grass",     "tile_kind": "moss",   "palette": "wraith_ash",      "autotile": "blob", "feature": "grass_edge", "biome": "starfall", "region_palette": "starfall"},
    "tile.dgrass.starfall":      {"kind": "tile", "seed": "eldrinth-starfall-dgrass",    "tile_kind": "moss",   "palette": "grim_steel",      "feature": "darken",     "biome": "starfall", "region_palette": "starfall"},
    "tile.path.starfall":        {"kind": "tile", "seed": "eldrinth-starfall-path",      "tile_kind": "cobble", "palette": "grim_steel",      "autotile": "blob", "feature": "path_edge",  "biome": "starfall", "region_palette": "starfall"},
    "tile.tree.starfall":        {"kind": "tile", "seed": "eldrinth-starfall-tree",      "tile_kind": "moss",   "palette": "wraith_ash",      "feature": "tree",       "biome": "starfall", "region_palette": "starfall"},
    "tile.rock.starfall":        {"kind": "tile", "seed": "eldrinth-starfall-rock",      "tile_kind": "moss",   "palette": "wraith_ash",      "feature": "rock",       "biome": "starfall", "region_palette": "starfall"},
    "tile.tallgrass.starfall":   {"kind": "tile", "seed": "eldrinth-starfall-tallgrass", "tile_kind": "moss",   "palette": "wraith_ash",      "feature": "tallgrass",  "biome": "starfall", "region_palette": "starfall"},
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

REGIONAL_TILE_KEYS = {
    f"tile.{base}.{region}"
    for region in ("cinderwild", "moonlit", "starfall")
    for base in ("grass", "dgrass", "path", "tree", "rock", "tallgrass")
}

ENEMY_KEY_BY_TYPE = {
    "wraith": "enemy.wraith", "sentinel": "enemy.sentinel",
    "adept": "enemy.adept", "boss": "enemy.boss",
}

WARDEN_KEY_BY_REGION = {
    "old-lands": "enemy.warden.old-lands",
    "cinderwild": "enemy.warden.cinderwild",
    "moonlit-coast": "enemy.warden.moonlit-coast",
    "starfall-moors": "enemy.warden.starfall-moors",
}

ITEM_KEY_BY_TYPE = {"shard": "item.shard", "potion": "item.potion"}

PROP_KEY_BY_TYPE = {
    "campfire": "prop.campfire",
    "sign": "prop.sign",
    "lantern": "prop.lantern",
    "brazier": "prop.brazier",
}

CIVIC_KEY_BY_TYPE = {
    "hall": "prop.civic.hall",
    "smithy": "prop.civic.smithy",
    "shrine": "prop.civic.shrine",
    "watchtower": "prop.civic.watchtower",
}

FORTRESS_KEY_BY_ID = {
    "fortress.old-lands-archive": "prop.fortress.old-lands-archive",
    "fortress.old-lands-reliquary": "prop.fortress.old-lands-reliquary",
    "fortress.old-lands-vault": "prop.fortress.old-lands-vault",
    "fortress.cinderwild-shrine": "prop.fortress.cinderwild-shrine",
    "fortress.cinderwild-watchpost": "prop.fortress.cinderwild-watchpost",
    "fortress.moonlit-salt-graves": "prop.fortress.moonlit-salt-graves",
    "fortress.moonlit-beacon": "prop.fortress.moonlit-beacon",
    "fortress.starfall-observatory": "prop.fortress.starfall-observatory",
    "fortress.starfall-watch": "prop.fortress.starfall-watch",
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
