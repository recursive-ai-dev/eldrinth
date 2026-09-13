#!/usr/bin/env python3
"""
Batch statistics & diversity analysis for generated sprites.
============================================================

Given a list of :class:`Sprite` objects (usually a batch generated from a range
of seeds), :func:`summarize` produces a compact JSON-serializable report of the
distribution across every categorical field in their specs, plus uniqueness
and determinism facts.  This is useful for:

  * verifying a batch actually spans the intended variety,
  * balancing a procedural population for a game (e.g. not all NPCs are rich),
  * generating a "catalog" manifest alongside a sprite sheet.

Everything here is a pure function of the sprites — no hidden state.
"""

from __future__ import annotations

from typing import List, Dict, Any, Union
from collections import Counter, defaultdict

from .sprites import Sprite


def _flatten_values(spec: Dict[str, Any], prefix: str = "") -> List[tuple]:
    """Yield ``(path, value)`` for every leaf in a nested spec dict."""
    out = []
    for key, val in spec.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(val, dict):
            out.extend(_flatten_values(val, path))
        else:
            out.append((path, val))
    return out


def summarize(sprites: List[Sprite]) -> Dict[str, Any]:
    """Summarize a batch of sprites into a JSON-serializable report."""
    if not sprites:
        return {
            "count": 0,
            "types": {},
            "unique_pixel_hashes": 0,
            "duplicate_count": 0,
            "categorical_distributions": {},
            "numeric_ranges": {},
        }

    types = Counter(s.type for s in sprites)
    hashes = set(s.pixel_hash for s in sprites)
    duplicate_count = len(sprites) - len(hashes)

    # aggregate every categorical leaf value (non-numeric scalars)
    categorical: Dict[str, Counter] = defaultdict(Counter)
    numeric: Dict[str, List[float]] = defaultdict(list)

    for sp in sprites:
        for path, value in _flatten_values(sp.spec):
            if isinstance(value, bool):
                categorical[path][str(value)] += 1
            elif isinstance(value, (int, float)):
                if isinstance(value, float) or abs(value) > 20:
                    numeric[path].append(float(value))
                else:
                    categorical[path][str(value)] += 1
            elif isinstance(value, str):
                # hex colors / enums
                categorical[path][value] += 1
            elif value is None:
                categorical[path]["<none>"] += 1

    categorical_report = {
        path: {
            "n_distinct": len(counter),
            "distribution": dict(counter.most_common()),
        }
        for path, counter in sorted(categorical.items())
        if len(counter) <= 64  # don't dump huge cardinality fields
    }

    numeric_report = {
        path: {
            "min": min(vals),
            "max": max(vals),
            "mean": round(sum(vals) / len(vals), 3),
            "count": len(vals),
        }
        for path, vals in sorted(numeric.items())
        if len(vals) >= 3
    }

    return {
        "count": len(sprites),
        "types": dict(types),
        "unique_pixel_hashes": len(hashes),
        "uniqueness_ratio": len(hashes) / len(sprites),
        "duplicate_count": duplicate_count,
        "categorical_distributions": categorical_report,
        "numeric_ranges": numeric_report,
    }


def summarize_by_seed(gen, seeds) -> Dict[str, Any]:
    """Convenience: summarize `gen.generate(s) for s in seeds`."""
    return summarize([gen.generate(s) for s in seeds])
