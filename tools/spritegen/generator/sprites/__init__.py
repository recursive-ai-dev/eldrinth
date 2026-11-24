#!/usr/bin/env python3
"""Sprite generators for Shed Dev Sprites — humans, creatures, items, tiles."""

from __future__ import annotations

from ..registry import register
from .base import Sprite, SpriteGenerator, DEFAULT_SIZE, DIRECTIONS, WALK_FRAMES
from .human import HumanSpriteGenerator
from .creature import CreatureSpriteGenerator
from .item import ItemSpriteGenerator
from .tile import TileSpriteGenerator
from .dungeon import DungeonSpriteGenerator
from .settlement import SettlementSpriteGenerator
from .prop import PropSpriteGenerator
from .cover import CoverSpriteGenerator
from .scene import SceneSpriteGenerator
from .war import StructureSpriteGenerator, MountSpriteGenerator, MachineSpriteGenerator

# Registration makes the CLI / web / registry lookups work.
register(HumanSpriteGenerator)
register(CreatureSpriteGenerator)
register(ItemSpriteGenerator)
register(TileSpriteGenerator)
register(DungeonSpriteGenerator)
register(SettlementSpriteGenerator)
register(PropSpriteGenerator)
register(CoverSpriteGenerator)
register(SceneSpriteGenerator)
register(StructureSpriteGenerator)
register(MountSpriteGenerator)
register(MachineSpriteGenerator)

__all__ = [
    "Sprite",
    "SpriteGenerator",
    "DEFAULT_SIZE",
    "DIRECTIONS",
    "WALK_FRAMES",
    "register",
    "HumanSpriteGenerator",
    "CreatureSpriteGenerator",
    "ItemSpriteGenerator",
    "TileSpriteGenerator",
    "DungeonSpriteGenerator",
    "SettlementSpriteGenerator",
    "PropSpriteGenerator",
    "CoverSpriteGenerator",
    "SceneSpriteGenerator",
    "StructureSpriteGenerator",
    "MountSpriteGenerator",
    "MachineSpriteGenerator",
]
