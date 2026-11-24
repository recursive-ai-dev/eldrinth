#!/usr/bin/env python3
"""
Deterministic prompt / intent compiler (zero AI weights).
========================================================

Translates a descriptive phrase such as:

    "armored knight, crimson cloak, steel sword, attacking right, endesga32"
    "frost golem, eerie swamp, scale2x"
    "obsidian dagger, volcanic_ember, pico8"

into a deterministic ``(type, seed, options)`` recipe for any registered
generator.  Every rule is pure string matching + ``string_mix`` seeding, so
the same prompt always compiles to the exact same sprite on any machine.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from .rng import string_mix
from .math.palette import MASTER_PALETTES, PALETTES

_TYPE_KEYWORDS: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("scene", ("scene", "landscape", "panorama", "splash")),
    ("cover", ("cover", "card", "thumbnail", "poster")),
    ("dungeon", ("dungeon", "cave", "minimap", "labyrinth", "catacomb")),
    ("machine", ("catapult", "trebuchet", "ballista", "siege", "machine", "cannon")),
    ("mount", ("horse", "mount", "steed", "charger", "warhorse", "stallion")),
    ("structure", ("castle", "fortress", "keep", "citadel", "barracks", "stronghold")),
    ("settlement", ("cottage", "house", "roof", "doorway", "workbench", "hearth", "settlement", "village", "interior")),
    ("prop", ("campfire", "signpost", "lantern", "brazier", "torch", "prop")),
    ("tile", ("autotile", "tile", "terrain", "tileset")),
    ("creature", (
        "monster", "creature", "slime", "blob", "golem", "dragon", "beast",
        "quadruped", "biped", "winged", "tentacle", "demon", "imp", "squid",
        "kraken", "elemental", "bat", "spider", "hound",
    )),
    ("human", (
        "knight", "paladin", "warrior", "fighter", "mage", "wizard", "adept",
        "cultist", "warlock", "guard", "soldier", "pikeman", "spearman",
        "refugee", "villager", "peasant", "human", "person", "hero", "rogue",
        "archer", "cleric", "priest", "smith", "scribe", "npc", "man", "woman",
    )),
    ("item", (
        "sword", "blade", "greatsword", "dagger", "axe", "hammer", "mace",
        "bow", "staff", "wand", "shield", "potion", "flask", "gem", "crystal",
        "shard", "coin", "key", "scroll", "ring", "book", "tome", "item", "weapon",
    )),
)

_ROLE_MAP: Dict[str, str] = {
    "knight": "player", "paladin": "player", "hero": "player", "armored": "player",
    "warrior": "player",
    "mage": "adept", "wizard": "adept", "adept": "adept", "cultist": "adept",
    "warlock": "adept", "sorcerer": "adept",
    "guard": "guard", "soldier": "guard", "pikeman": "guard", "spearman": "guard",
    "sentry": "guard",
    "refugee": "refugee", "peasant": "refugee", "beggar": "refugee",
    "orithel": "orithel-the-last-watcher",
    "althea": "scribe-althea",
    "mirene": "sister-mirene",
    "barris": "barris-the-smith",
    "vance": "kiln-master-vance",
    "greta": "cinder-nurse-greta",
    "elodie": "elodie-outrunner",
    "morveth": "mistress-morveth",
    "lyra": "sister-lyra",
    "kieran": "kieran-blind-oar",
    "toran": "reeve-toran",
    "cassian": "hermit-cassian",
    "mina": "mina-drift-child",
}

_ARCHETYPE_MAP: Dict[str, str] = {
    "blob": "blob", "ooze": "blob",
    "slime": "slime", "jelly": "slime",
    "quadruped": "quadruped", "beast": "quadruped", "hound": "quadruped", "wolf": "quadruped",
    "biped": "biped", "imp": "biped", "demon": "biped", "goblin": "biped", "ogre": "biped",
    "winged": "winged", "bat": "winged", "dragon": "winged", "harpy": "winged", "fairy": "winged",
    "tentacle": "tentacle", "squid": "tentacle", "kraken": "tentacle", "octopus": "tentacle", "eldritch": "tentacle",
    "golem": "golem", "construct": "golem", "elemental": "golem", "titan": "golem",
}

_ITEM_CATEGORY_MAP: Dict[str, str] = {
    "sword": "sword", "blade": "sword", "greatsword": "sword", "longsword": "sword",
    "dagger": "dagger", "knife": "dagger", "dirk": "dagger",
    "axe": "axe", "hatchet": "axe",
    "hammer": "hammer", "mace": "hammer", "maul": "hammer",
    "bow": "bow", "longbow": "bow",
    "staff": "staff", "wand": "staff", "rod": "staff",
    "shield": "shield", "buckler": "shield",
    "potion": "potion", "flask": "potion", "elixir": "potion", "vial": "potion",
    "gem": "gem", "ruby": "gem", "emerald": "gem", "sapphire": "gem", "jewel": "gem",
    "shard": "shard", "crystal": "shard",
    "coin": "coin", "medallion": "coin",
    "key": "key",
    "scroll": "scroll", "parchment": "scroll",
    "ring": "ring", "band": "ring",
    "book": "book", "tome": "book", "grimoire": "book",
}

_TILE_KINDS = {
    "grass", "dirt", "stone", "sand", "water", "snow",
    "lava", "brick", "wood", "cobble", "moss", "mud",
}

_FACTION_MAP: Dict[str, str] = {
    "darkelf": "darkelf", "elf": "darkelf", "elven": "darkelf", "spire": "darkelf",
    "corrupted": "corrupted", "flesh": "corrupted", "demon": "corrupted", "blight": "corrupted",
    "human": "human", "kingdom": "human",
}

_STRUCTURE_KINDS = {"hall", "farm", "barracks", "mill", "blacksmith", "stables", "tower"}
_STRUCTURE_ALIASES: Dict[str, str] = {
    "keep": "hall", "castle": "hall", "citadel": "hall", "stronghold": "hall",
    "smithy": "blacksmith", "forge": "blacksmith",
    "windmill": "mill", "watchtower": "tower",
}

_PROP_MAP: Dict[str, str] = {
    "campfire": "campfire", "fire": "campfire", "bonfire": "campfire",
    "sign": "sign", "signpost": "sign",
    "lantern": "lantern", "lamp": "lantern",
    "brazier": "brazier", "torch": "brazier",
}

_SETTLEMENT_THEMES = {"oldstone", "cinder", "coastal", "moor"}
_SETTLEMENT_PARTS = {
    "cottage", "roof_left", "roof_mid", "roof_right",
    "wall_left", "wall_mid", "wall_right", "door",
    "interior_floor", "interior_wall", "bed", "table",
    "shelf", "workbench", "hearth", "lamp", "rug",
}

_MOOD_MAP: Dict[str, str] = {
    "dark": "dark", "night": "dark", "shadow": "dark", "grim": "dark",
    "cold": "cold", "winter": "cold", "frost": "cold", "ice": "cold", "snowy": "cold",
    "warm": "warm", "sunset": "warm", "desert": "warm", "amber": "warm", "sunny": "warm",
    "eerie": "eerie", "swamp": "eerie", "haunted": "eerie", "cursed": "eerie", "fog": "eerie",
    "wild": "wild", "forest": "wild", "meadow": "wild", "day": "wild",
}

_PALETTE_MAP: Dict[str, str] = {
    "crimson": "cult_blood", "blood": "cult_blood", "cursed": "cult_blood", "red": "blood",
    "steel": "grim_steel", "iron": "grim_steel", "silver": "metal", "metallic": "metal",
    "ash": "wraith_ash", "wraith": "wraith_ash", "ghost": "wraith_ash", "pale": "wraith_ash",
    "rust": "rusted_stone", "rusted": "rusted_stone", "bronze": "rusted_stone", "copper": "rusted_stone",
    "flesh": "corrupted_flesh", "corrupted": "corrupted_flesh", "rot": "corrupted_flesh",
    "bone": "bone_relic", "ivory": "bone_relic", "skeleton": "bone_relic", "undead": "bone_relic",
    "poison": "sickly_green", "toxic": "sickly_green", "acid": "sickly_green", "swamp": "sickly_green", "slime": "slime",
    "abyss": "black_water", "obsidian": "black_water", "void": "black_water",
    "anima": "spire_anima", "teal": "spire_anima", "cyan": "spire_anima", "astral": "spire_anima",
    "ember": "volcanic_ember", "flame": "volcanic_ember", "fire": "volcanic_ember", "inferno": "volcanic_ember", "volcanic": "volcanic_ember",
    "gold": "sacred_gold", "golden": "sacred_gold", "sacred": "sacred_gold", "holy": "sacred_gold", "royal": "sacred_gold",
    "magic": "magic", "arcane": "magic", "purple": "magic", "violet": "magic",
    "lava": "lava", "magma": "lava",
    "water": "water", "ocean": "water", "blue": "water",
    "frost": "snow", "ice": "snow", "snow": "snow",
    "grass": "grass", "forest": "grass", "emerald": "grass", "green": "grass",
    "wood": "wood", "timber": "wood", "oak": "wood",
    "sand": "sand", "desert": "sand",
    "stone": "stone", "rock": "stone", "grey": "stone",
}

_DIRECTION_MAP: Dict[str, str] = {
    "front": "front", "south": "front", "forward": "front",
    "back": "back", "north": "back", "rear": "back",
    "left": "left", "west": "left",
    "right": "right", "east": "right",
}

_ACTION_MAP: Dict[str, str] = {
    "idle": "idle", "standing": "idle", "breathing": "idle",
    "walk": "walk", "walking": "walk",
    "attack": "attack", "attacking": "attack", "strike": "attack", "slash": "attack", "combat": "attack",
    "cast": "cast", "casting": "cast", "spell": "cast", "channel": "cast",
    "hurt": "hurt", "damaged": "hurt", "stagger": "hurt", "recoil": "hurt",
    "death": "death", "die": "death", "dying": "death", "dead": "death", "collapse": "death",
    "chop": "chop", "chopping": "chop", "woodcut": "chop",
    "mine": "mine", "mining": "mine", "dig": "mine",
    "harvest": "harvest", "harvesting": "harvest", "reap": "harvest",
    "build": "build", "building": "build", "craft": "build",
}

_WEAPON_STYLE_MAP: Dict[str, str] = {
    "sword": "sword", "greatsword": "sword", "blade": "sword",
    "staff": "staff", "wand": "staff", "rod": "staff",
    "halberd": "halberd", "spear": "halberd", "pike": "halberd", "lance": "halberd",
}


def compile_prompt(
    prompt: str,
    seed: Optional[int] = None,
    default_type: Optional[str] = None,
) -> Dict[str, Any]:
    """Compile a descriptive prompt into ``{type, seed, options, tokens}``.

    Purely deterministic: identical prompt + seed always produces identical
    compilation output.
    """
    raw = (prompt or "").strip()
    opts: Dict[str, Any] = {}

    # Extract optional quoted title (`titled "..."` or `title "..."`)
    title_m = re.search(r'(?:titled|title)\s+["\']([^"\']+)["\']', raw, flags=re.IGNORECASE)
    if title_m:
        opts["title"] = title_m.group(1)

    # Extract explicit seed if specified (`seed 42` or `#42`)
    parsed_seed: Optional[int] = seed
    seed_m = re.search(r'(?:\bseed\s*[:=]?\s*|#)(-?\d+)', raw, flags=re.IGNORECASE)
    if seed_m:
        parsed_seed = int(seed_m.group(1))

    # Extract explicit quantize (`quantize 8` or `8 colors` / `16 colours`)
    quant_m = re.search(r'(?:\bquantize\s*[:=]?\s*(\d+)|\b(\d+)\s*colou?rs\b)', raw, flags=re.IGNORECASE)
    if quant_m:
        qval = int(quant_m.group(1) or quant_m.group(2))
        opts["quantize"] = max(2, min(64, qval))

    tokens = re.findall(r'[a-z0-9_-]+', raw.lower())
    token_set = set(tokens)

    # 1. Infer sprite type (unless caller forced one or tokens clearly match)
    inferred_type: Optional[str] = None
    for stype, kws in _TYPE_KEYWORDS:
        if any(k in token_set for k in kws):
            inferred_type = stype
            break
    if inferred_type is None:
        # Check tile kinds as fallback for `tile`
        if token_set & _TILE_KINDS:
            inferred_type = "tile"
        elif token_set & _SETTLEMENT_THEMES or token_set & _SETTLEMENT_PARTS:
            inferred_type = "settlement"
        elif token_set & _STRUCTURE_KINDS or token_set & set(_STRUCTURE_ALIASES):
            inferred_type = "structure"
        elif token_set & set(_MOOD_MAP):
            inferred_type = "scene"
    stype = inferred_type or default_type or "human"

    # 2. Extract shared options
    for tok in tokens:
        if tok in _DIRECTION_MAP and "direction" not in opts:
            opts["direction"] = _DIRECTION_MAP[tok]
        if tok in _ACTION_MAP and "action" not in opts:
            opts["action"] = _ACTION_MAP[tok]
        if tok in MASTER_PALETTES and "master_palette" not in opts:
            opts["master_palette"] = tok
        if tok in ("pico-8", "pico8"):
            opts["master_palette"] = "pico8"
        elif tok in ("sweetie-16", "sweetie16"):
            opts["master_palette"] = "sweetie16"
        elif tok in ("endesga-32", "endesga32", "endesga"):
            opts["master_palette"] = "endesga32"
        elif tok in ("gameboy", "gb"):
            opts["master_palette"] = "gameboy"
        if tok in ("scale2x", "epx", "2x", "hd"):
            opts["scale2x"] = True
        if tok in ("48px", "48x48", "48"):
            opts["size"] = 48
        elif tok in ("64px", "64x64", "64", "highres"):
            opts["size"] = 64
        elif tok in ("32px", "32x32"):
            opts["size"] = 32
        if tok in ("blob", "blob47") and "blob" not in opts:
            opts["blob"] = True
        if tok in _WEAPON_STYLE_MAP and stype == "human" and "weapon_style" not in opts:
            opts["weapon_style"] = _WEAPON_STYLE_MAP[tok]
        if tok in _FACTION_MAP and "faction" not in opts:
            opts["faction"] = _FACTION_MAP[tok]

    # Palette selection (exact palette names first, then semantic aliases)
    for tok in tokens:
        if tok in PALETTES:
            opts["palette"] = tok
            break
    if "palette" not in opts:
        for tok in tokens:
            if tok in _PALETTE_MAP:
                opts["palette"] = _PALETTE_MAP[tok]
                break

    # 3. Type-specific semantic mappings
    if stype == "human":
        for tok in tokens:
            if tok in _ROLE_MAP:
                opts["role"] = _ROLE_MAP[tok]
                break
    elif stype == "creature":
        for tok in tokens:
            if tok in _ARCHETYPE_MAP:
                opts["archetype"] = _ARCHETYPE_MAP[tok]
                break
    elif stype == "item":
        for tok in tokens:
            if tok in _ITEM_CATEGORY_MAP:
                opts["category"] = _ITEM_CATEGORY_MAP[tok]
                break
    elif stype == "tile":
        for tok in tokens:
            if tok in _TILE_KINDS:
                opts["kind"] = tok
                break
    elif stype == "prop":
        for tok in tokens:
            if tok in _PROP_MAP:
                opts["prop_type"] = _PROP_MAP[tok]
                break
    elif stype == "settlement":
        for tok in tokens:
            if tok in _SETTLEMENT_THEMES:
                opts["theme"] = tok
            if tok in _SETTLEMENT_PARTS:
                opts["part"] = tok
    elif stype in ("scene", "cover"):
        for tok in tokens:
            if tok in _MOOD_MAP:
                opts["mood"] = _MOOD_MAP[tok]
                break
    elif stype == "structure":
        for tok in tokens:
            if tok in _STRUCTURE_KINDS:
                opts["kind"] = tok
                break
            if tok in _STRUCTURE_ALIASES:
                opts["kind"] = _STRUCTURE_ALIASES[tok]
                break

    # 4. Deterministic seed from prompt text when not explicitly supplied
    if parsed_seed is None:
        # Exclude transient view/scale/resolution flags from seed hash so "knight" and
        # "knight facing right 64px scale2x" share the exact same character identity!
        ignored = (
            set(_DIRECTION_MAP) | set(_ACTION_MAP)
            | {"scale2x", "epx", "2x", "hd", "32px", "32x32", "48px", "48x48", "64px", "64x64", "highres"}
        )
        identity_tokens = [t for t in tokens if t not in ignored]
        key = " ".join(identity_tokens) if identity_tokens else raw.lower()
        parsed_seed = (string_mix(key) % 999983) if key else 42

    return {
        "prompt": raw,
        "type": stype,
        "seed": parsed_seed,
        "options": opts,
    }
