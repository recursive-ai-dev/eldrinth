#!/usr/bin/env python3
"""
Sprite generator registry.
==========================

A small, extensible registry so the CLI, the web preview and user code can all
look up a generator by its ``type_name`` without importing every module.  New
generator types register themselves (or can be registered by the user).
"""

from __future__ import annotations

from typing import Dict, Type, List, Optional

#: Maps a ``type_name`` string -> generator *class* (not instance).
REGISTRY: Dict[str, type] = {}


def register(cls: type) -> type:
    """Class decorator that registers a generator class by its ``type_name``."""
    name = getattr(cls, "type_name", None)
    if name is None:
        raise ValueError(f"{cls.__name__} must define a `type_name`")
    REGISTRY[name] = cls
    return cls


def get_generator(name: str, **kwargs):
    """Instantiate a registered generator by ``name``.

    Raises ``KeyError`` if the name is unknown.
    """
    if name not in REGISTRY:
        raise KeyError(f"Unknown sprite type '{name}'. Known: {list(REGISTRY)}")
    return REGISTRY[name](**kwargs)


def list_types() -> List[str]:
    return sorted(REGISTRY)


def animated_types() -> List[str]:
    """Type names whose ``frame`` option actually changes rendered pixels."""
    return sorted(name for name, cls in REGISTRY.items() if getattr(cls, "animated", False))


def names() -> Dict[str, str]:
    """Map type_name -> human-readable module path."""
    return {name: f"{cls.__module__}.{cls.__name__}" for name, cls in sorted(REGISTRY.items())}
