#!/usr/bin/env python3
"""
Deterministic value noise, fBm and domain warping.
==================================================

All lattice hashes go through :func:`generator.rng.derive`, so a noise field
is a pure function of ``(seed, x, y)``.  Wrapping variants tile seamlessly —
required for 16×16 terrain.  Domain warping is compensated with a local
Jacobian so stroke width stays constant (guide §4.3).
"""

from __future__ import annotations

import math
from typing import Tuple

from ..rng import derive

_TWO_PI = 6.283185307179586


def lattice(seed: int, lx: int, ly: int, channel: str = "n") -> float:
    """Hash a lattice point to ``[0, 1)``."""
    return (derive(seed, "noise", channel, lx, ly) % 10007) / 10007.0


def _fade(t: float) -> float:
    return t * t * (3.0 - 2.0 * t)


def value_noise(
    seed: int,
    x: float,
    y: float,
    freq: float = 1.0,
    wrap: int = 0,
    channel: str = "n",
) -> float:
    """Value noise in ``[0, 1]``.  ``wrap>0`` makes the field periodic with period ``wrap``."""
    fx = x * freq
    fy = y * freq
    x0 = int(math.floor(fx))
    y0 = int(math.floor(fy))
    tx = fx - x0
    ty = fy - y0
    if wrap > 0:
        x0m = x0 % wrap
        x1m = (x0 + 1) % wrap
        y0m = y0 % wrap
        y1m = (y0 + 1) % wrap
    else:
        x0m, x1m, y0m, y1m = x0, x0 + 1, y0, y0 + 1
    a = lattice(seed, x0m, y0m, channel)
    b = lattice(seed, x1m, y0m, channel)
    c = lattice(seed, x0m, y1m, channel)
    d = lattice(seed, x1m, y1m, channel)
    sx, sy = _fade(tx), _fade(ty)
    top = a + (b - a) * sx
    bot = c + (d - c) * sx
    return top + (bot - top) * sy


def fbm(
    seed: int,
    x: float,
    y: float,
    octaves: int = 4,
    freq: float = 1.0,
    gain: float = 0.5,
    lacunarity: float = 2.0,
    wrap: int = 0,
    channel: str = "n",
) -> float:
    """Fractal Brownian motion, normalised to roughly ``[0, 1]``."""
    amp = 1.0
    tot = 0.0
    norm = 0.0
    f = freq
    for i in range(max(1, octaves)):
        tot += amp * value_noise(seed, x, y, freq=f, wrap=wrap, channel=channel + str(i))
        norm += amp
        amp *= gain
        f *= lacunarity
        if wrap > 0:
            wrap = max(1, int(wrap * lacunarity)) if False else wrap
    return tot / (norm or 1.0)


def domain_warp(
    seed: int,
    x: float,
    y: float,
    amp: float = 2.0,
    freq: float = 0.12,
    wrap: int = 0,
) -> Tuple[float, float]:
    """Return warped coordinates ``(x', y')``."""
    dx = (fbm(seed, x, y, octaves=3, freq=freq, wrap=wrap, channel="wx") - 0.5) * 2.0 * amp
    dy = (fbm(seed, x, y, octaves=3, freq=freq, wrap=wrap, channel="wy") - 0.5) * 2.0 * amp
    return x + dx, y + dy


def warp_jacobian(
    seed: int,
    x: float,
    y: float,
    amp: float = 2.0,
    freq: float = 0.12,
    wrap: int = 0,
    eps: float = 0.35,
) -> float:
    """``|det J|`` of the warp, used to keep line thickness constant.

    Stroke width is multiplied by ``1 / max(jacobian, eps)`` so compressed
    regions of the warp don't thicken the pencil line (guide §4.3).
    """
    x1, y1 = domain_warp(seed, x + eps, y, amp, freq, wrap)
    x2, y2 = domain_warp(seed, x, y + eps, amp, freq, wrap)
    x0, y0 = domain_warp(seed, x, y, amp, freq, wrap)
    dxx = (x1 - x0) / eps
    dyx = (y1 - y0) / eps
    dxy = (x2 - x0) / eps
    dyy = (y2 - y0) / eps
    det = dxx * dyy - dxy * dyx
    return max(abs(det), 1e-4)


def warp_sample(
    seed: int,
    x: float,
    y: float,
    amp: float = 2.0,
    freq: float = 0.12,
    wrap: int = 0,
    octaves: int = 4,
) -> Tuple[float, float]:
    """Warped fBm plus the Jacobian compensation factor."""
    wx, wy = domain_warp(seed, x, y, amp, freq, wrap)
    n = fbm(seed, wx, wy, octaves=octaves, freq=freq, wrap=wrap, channel="ws")
    j = warp_jacobian(seed, x, y, amp, freq, wrap)
    return n, j


def paper_noise(seed: int, x: float, y: float, wrap: int = 0) -> float:
    """Multi-octave value-noise paper grain (guide §4.1)."""
    n1 = value_noise(seed, x, y, freq=0.18, wrap=wrap, channel="p1")
    n2 = value_noise(seed, x, y, freq=0.55, wrap=wrap, channel="p2")
    n3 = value_noise(seed, x, y, freq=1.40, wrap=wrap, channel="p3")
    return 0.50 * n1 + 0.35 * n2 + 0.15 * n3
