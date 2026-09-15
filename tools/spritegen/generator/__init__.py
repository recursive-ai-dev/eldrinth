# Shed Dev Sprites — a fully mathematical, deterministic game-sprite generator.
#
# Generates humans, creatures, items and seamless tiles as clean pixel-art
# PNGs.  Every sprite is a pure function of a single integer seed: the same
# seed always yields the same sprite, on any machine, verifying via a pixel
# hash.  See README.md and the docstrings in each module.
#
# Keeping the original "human" generator available: `pure_generator` and
# `mass_generator` remain at the top level for backwards compatibility.

from __future__ import annotations

__version__ = "3.0.0"
__author__ = "Shed Dev Sprites"

from .rng import RNG, derive, mix64, string_mix, rng_for, gaussian, clamp
from . import color
from .registry import (
    REGISTRY,
    register,
    get_generator,
    list_types,
    names,
)
from . import sheet, stats
from .sprites import (
    Sprite,
    SpriteGenerator,
    HumanSpriteGenerator,
    CreatureSpriteGenerator,
    ItemSpriteGenerator,
    TileSpriteGenerator,
    DungeonSpriteGenerator,
    DIRECTIONS,
    WALK_FRAMES,
    SettlementSpriteGenerator,
)
from . import pipeline

__all__ = [
    "__version__",
    "RNG",
    "derive",
    "mix64",
    "string_mix",
    "rng_for",
    "gaussian",
    "clamp",
    "color",
    "sheet",
    "stats",
    "registry",
    "REGISTRY",
    "register",
    "get_generator",
    "list_types",
    "names",
    "Sprite",
    "SpriteGenerator",
    "HumanSpriteGenerator",
    "CreatureSpriteGenerator",
    "ItemSpriteGenerator",
    "TileSpriteGenerator",
    "DungeonSpriteGenerator",
    "SettlementSpriteGenerator",
    "DIRECTIONS",
    "WALK_FRAMES",
    "pipeline",
]
