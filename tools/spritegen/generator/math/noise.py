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

import numpy as np

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


# ---------------------------------------------------------------------------
# Vectorized NumPy grid variants (exact same lattice hashes, ~50-100x faster)
# ---------------------------------------------------------------------------

def _lattice_table_wrapped(seed: int, wrap: int, channel: str) -> np.ndarray:
    tbl = np.empty((wrap, wrap), dtype=np.float64)
    for ly in range(wrap):
        for lx in range(wrap):
            tbl[ly, lx] = (derive(seed, "noise", channel, lx, ly) % 10007) / 10007.0
    return tbl


def value_noise_grid(
    seed: int,
    xs: np.ndarray,
    ys: np.ndarray,
    freq: float = 1.0,
    wrap: int = 0,
    channel: str = "n",
) -> np.ndarray:
    """Vectorized :func:`value_noise` over NumPy coordinate arrays."""
    fx = xs * freq
    fy = ys * freq
    x0 = np.floor(fx).astype(np.int64)
    y0 = np.floor(fy).astype(np.int64)
    tx = fx - x0
    ty = fy - y0
    sx = tx * tx * (3.0 - 2.0 * tx)
    sy = ty * ty * (3.0 - 2.0 * ty)

    if wrap > 0:
        x0m = np.mod(x0, wrap)
        x1m = np.mod(x0 + 1, wrap)
        y0m = np.mod(y0, wrap)
        y1m = np.mod(y0 + 1, wrap)
        tbl = _lattice_table_wrapped(seed, wrap, channel)
        a = tbl[y0m, x0m]
        b = tbl[y0m, x1m]
        c = tbl[y1m, x0m]
        d = tbl[y1m, x1m]
    else:
        x1 = x0 + 1
        y1 = y0 + 1
        ux = np.unique(np.concatenate([x0.ravel(), x1.ravel()]))
        uy = np.unique(np.concatenate([y0.ravel(), y1.ravel()]))
        x_min, y_min = int(ux[0]), int(uy[0])
        x_span = int(ux[-1]) - x_min + 1
        y_span = int(uy[-1]) - y_min + 1
        if x_span * y_span <= 4096:
            tbl = np.empty((y_span, x_span), dtype=np.float64)
            for ly in uy:
                for lx in ux:
                    tbl[int(ly) - y_min, int(lx) - x_min] = (
                        derive(seed, "noise", channel, int(lx), int(ly)) % 10007
                    ) / 10007.0
            a = tbl[y0 - y_min, x0 - x_min]
            b = tbl[y0 - y_min, x1 - x_min]
            c = tbl[y1 - y_min, x0 - x_min]
            d = tbl[y1 - y_min, x1 - x_min]
        else:
            cache = {}
            def _fetch(lx: int, ly: int) -> float:
                k = (lx, ly)
                v = cache.get(k)
                if v is None:
                    v = (derive(seed, "noise", channel, lx, ly) % 10007) / 10007.0
                    cache[k] = v
                return v
            flat_x0, flat_y0 = x0.ravel(), y0.ravel()
            flat_x1, flat_y1 = x1.ravel(), y1.ravel()
            n = flat_x0.size
            a = np.fromiter((_fetch(int(flat_x0[i]), int(flat_y0[i])) for i in range(n)), np.float64, n).reshape(x0.shape)
            b = np.fromiter((_fetch(int(flat_x1[i]), int(flat_y0[i])) for i in range(n)), np.float64, n).reshape(x0.shape)
            c = np.fromiter((_fetch(int(flat_x0[i]), int(flat_y1[i])) for i in range(n)), np.float64, n).reshape(x0.shape)
            d = np.fromiter((_fetch(int(flat_x1[i]), int(flat_y1[i])) for i in range(n)), np.float64, n).reshape(x0.shape)

    top = a + (b - a) * sx
    bot = c + (d - c) * sx
    return top + (bot - top) * sy


def fbm_grid(
    seed: int,
    xs: np.ndarray,
    ys: np.ndarray,
    octaves: int = 4,
    freq: float = 1.0,
    gain: float = 0.5,
    lacunarity: float = 2.0,
    wrap: int = 0,
    channel: str = "n",
) -> np.ndarray:
    """Vectorized :func:`fbm` over NumPy coordinate arrays."""
    amp = 1.0
    tot = np.zeros_like(xs, dtype=np.float64)
    norm = 0.0
    f = freq
    for i in range(max(1, octaves)):
        tot += amp * value_noise_grid(seed, xs, ys, freq=f, wrap=wrap, channel=channel + str(i))
        norm += amp
        amp *= gain
        f *= lacunarity
    return tot / (norm or 1.0)


def domain_warp_grid(
    seed: int,
    xs: np.ndarray,
    ys: np.ndarray,
    amp: float = 2.0,
    freq: float = 0.12,
    wrap: int = 0,
) -> Tuple[np.ndarray, np.ndarray]:
    """Vectorized :func:`domain_warp`."""
    dx = (fbm_grid(seed, xs, ys, octaves=3, freq=freq, wrap=wrap, channel="wx") - 0.5) * 2.0 * amp
    dy = (fbm_grid(seed, xs, ys, octaves=3, freq=freq, wrap=wrap, channel="wy") - 0.5) * 2.0 * amp
    return xs + dx, ys + dy


def warp_jacobian_grid(
    seed: int,
    xs: np.ndarray,
    ys: np.ndarray,
    amp: float = 2.0,
    freq: float = 0.12,
    wrap: int = 0,
    eps: float = 0.35,
) -> np.ndarray:
    """Vectorized :func:`warp_jacobian`."""
    x1, y1 = domain_warp_grid(seed, xs + eps, ys, amp, freq, wrap)
    x2, y2 = domain_warp_grid(seed, xs, ys + eps, amp, freq, wrap)
    x0, y0 = domain_warp_grid(seed, xs, ys, amp, freq, wrap)
    dxx = (x1 - x0) / eps
    dyx = (y1 - y0) / eps
    dxy = (x2 - x0) / eps
    dyy = (y2 - y0) / eps
    det = dxx * dyy - dxy * dyx
    return np.maximum(np.abs(det), 1e-4)


def warp_sample_grid(
    seed: int,
    xs: np.ndarray,
    ys: np.ndarray,
    amp: float = 2.0,
    freq: float = 0.12,
    wrap: int = 0,
    octaves: int = 4,
) -> Tuple[np.ndarray, np.ndarray]:
    """Vectorized :func:`warp_sample`."""
    wx, wy = domain_warp_grid(seed, xs, ys, amp, freq, wrap)
    n = fbm_grid(seed, wx, wy, octaves=octaves, freq=freq, wrap=wrap, channel="ws")
    j = warp_jacobian_grid(seed, xs, ys, amp, freq, wrap)
    return n, j


def paper_noise_grid(seed: int, xs: np.ndarray, ys: np.ndarray, wrap: int = 0) -> np.ndarray:
    """Vectorized :func:`paper_noise`."""
    n1 = value_noise_grid(seed, xs, ys, freq=0.18, wrap=wrap, channel="p1")
    n2 = value_noise_grid(seed, xs, ys, freq=0.55, wrap=wrap, channel="p2")
    n3 = value_noise_grid(seed, xs, ys, freq=1.40, wrap=wrap, channel="p3")
    return 0.50 * n1 + 0.35 * n2 + 0.15 * n3
