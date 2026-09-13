#!/usr/bin/env python3
"""
Deterministic Random / Hashing Core
====================================

Shed Dev Sprites is *fully mathematical and deterministic*. Nothing in the rendering
path uses Python's global ``random`` module or time/OS entropy. Every value in
every sprite is derived from a single 64-bit integer ``seed`` through a small,
carefully chosen set of pure integer hash/mix functions (SplitMix64).

Properties guaranteed by this module:

    * ``derive(seed, "hair_color", 0)`` is a **pure** function of its inputs.
      Calling it any number of times, in any order, gives the same value.
    * ``RNG(derive(seed, "layout"))`` produces an identical value stream on
      every run and on every machine (no float rounding drift, no OS entropy).
    * Deriving each *named attribute* from its own sub-RNG means the *order* in
      which attributes are requested never changes the output. Adding a new
      decorative attribute to one generator cannot "shift the random stream"
      and silently change every other attribute. This is what makes the sprite
      spec a stable, inspectable mathematical object.

The functions here are pure, dependency-free, and intentionally tiny so they
can be audited by hand.
"""

from __future__ import annotations

import math
from typing import Sequence, List, Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MASK64 = (1 << 64) - 1

# SplitMix64 gamma (golden-ratio constant 2^64 * phi)
_GAMMA = 0x9E3779B97F4A7C15

# Small mod-multiplier used by ``derive`` for string mixing
_STR_MIX = 0x100000001B3


# ---------------------------------------------------------------------------
# Pure integer mix functions
# ---------------------------------------------------------------------------

def mix64(x: int) -> int:
    """Integer-only avalanche hash: a bijection on 64-bit ints.

    This is the third round of SplitMix64.  It is *pure*: the same input always
    produces the same output, and it has no internal state.
    """
    x = (x ^ (x >> 30)) * 0xBF58476D1CE4E5B9
    x = (x & MASK64)
    x = (x ^ (x >> 27)) * 0x94D049BB133111EB
    x = (x & MASK64)
    x = x ^ (x >> 31)
    return x & MASK64


def splitmix64_next(state: int):
    """One step of the SplitMix64 *sequence* generator.

    Returns ``(new_state, output)``.  The sequence is a counter advanced by a
    golden-ratio constant then avalanced; its low bits are excellent.
    """
    state = (state + _GAMMA) & MASK64
    return state, mix64(state)


def string_mix(s: str) -> int:
    """Hash an arbitrary string down to a 64-bit integer (FNV-1a style).

    Pure and deterministic.  Used to turn attribute names like ``"hair"`` or
    ``"layout"`` into a stable numeric prefix.
    """
    x = 0xCBF29CE484222325
    for ch in str(s):
        x ^= ord(ch)
        x = (x * _STR_MIX) & MASK64
    return x


def derive(seed: int, *parts: Any, salt: int = 0) -> int:
    """Derive a fresh, stable 64-bit value from ``seed`` plus arbitrary parts.

    ``derive`` is the single entry-point for turning a base seed into a value
    for a specific attribute.  The output is a pure function of ``(seed,
    *parts, salt)`` — reordering calls never changes any result.

    Example::

        hair_seed = derive(42, "human", "hair", 7)
        layout_seed = derive(42, "human", "layout")
    """
    # NOTE: we intentionally do NOT OR with 1 here.  Setting the low bit would
    # fold every consecutive even/odd seed pair into the same value, which
    # destroys the seed -> attribute injectivity that the rest of Shed Dev Sprites
    # relies on.  XOR with the golden-ratio constant is already a bijection.
    x = (seed & MASK64) ^ _GAMMA
    x ^= salt & MASK64
    for part in parts:
        x ^= string_mix(part)
        x = (x << 1) | (x >> 63)          # rotate-left
        x = (x + _GAMMA) & MASK64
    return mix64(x)


# ---------------------------------------------------------------------------
# Deterministic RNG
# ---------------------------------------------------------------------------

class RNG:
    """A small, self-contained, deterministic 64-bit PRNG.

    All methods are derived from ``next_u64()`` so the output stream is a
    single predictable sequence.  Two instances created with the same seed
    produce identical streams forever.  ``RNG`` deliberately does NOT share any
    global state — it is safe to have thousands of independent instances.
    """

    __slots__ = ("state",)

    def __init__(self, seed: int = 0):
        # We mix the seed so even tiny seeds (0, 1, 2...) spread across the
        # full 64-bit space and start with a well-avalanched state.
        self.state = mix64((seed & MASK64) ^ (seed << 32) ^ (seed >> 32) ^ _GAMMA)

    # -- core --------------------------------------------------------------
    def next_u64(self) -> int:
        self.state, out = splitmix64_next(self.state)
        return out

    def next_bits(self, n: int) -> int:
        """Return ``n`` bits (n <= 64) as an integer."""
        return self.next_u64() & ((1 << n) - 1) if n < 64 else self.next_u64()

    # -- numeric helpers ---------------------------------------------------
    def random(self) -> float:
        """Uniform float in [0, 1)."""
        return self.next_u64() / float(1 << 64)

    def random_float(self, low: float, high: float) -> float:
        return low + self.random() * (high - low)

    def uniform(self, low: float, high: float) -> float:
        """Uniform float in [low, high).  Alias for :meth:`random_float`."""
        return low + self.random() * (high - low)

    def randint(self, a: int, b: int) -> int:
        """Uniform integer in [a, b] inclusive.  ``a`` may exceed ``b``."""
        if a > b:
            a, b = b, a
        return a + self.next_u64() % (b - a + 1)

    def randrange(self, a: int, b: int) -> int:
        """Uniform integer in [a, b)."""
        if a > b:
            a, b = b, a
        return a + self.next_u64() % (b - a)

    def randbelow(self, n: int) -> int:
        """Uniform integer in [0, n).  ``n`` may be 0 (returns 0)."""
        return 0 if n <= 0 else self.next_u64() % n

    # -- sequence helpers --------------------------------------------------
    def choice(self, seq: Sequence) -> Any:
        if not seq:
            raise ValueError("choice() on empty sequence")
        return seq[self.randbelow(len(seq))]

    def shuffle(self, seq: List) -> List:
        """In-place Fisher-Yates shuffle, deterministic."""
        for i in range(len(seq) - 1, 0, -1):
            j = self.randbelow(i + 1)
            seq[i], seq[j] = seq[j], seq[i]
        return seq

    def sample(self, seq: Sequence, k: int) -> List:
        """Deterministic sample of ``k`` unique elements."""
        if k >= len(seq):
            return list(seq)
        copy = list(seq)
        self.shuffle(copy)
        return copy[:k]

    def weighted_choice(self, pairs: Sequence[tuple]) -> Any:
        """Choose an item from ``(item, weight)`` pairs.

        Weights may be any non-negative floats; they need not sum to 1.
        """
        total = sum(w for _, w in pairs) or 1.0
        r = self.random() * total
        acc = 0.0
        for item, w in pairs:
            acc += w
            if r <= acc:
                return item
        return pairs[-1][0] if pairs else None

    # -- helper factories --------------------------------------------------
    def fork(self, *parts: Any) -> "RNG":
        """Create an independent, deterministic sub-RNG from this stream.

        Forking does not consume or perturb the parent stream, and the result
        depends only on this RNG's *current* state plus the label parts.
        """
        return RNG(derive(self.state, *parts))


# ---------------------------------------------------------------------------
# Convenience: build a deterministic RNG straight from parts
# ---------------------------------------------------------------------------

def rng_for(seed: int, *parts: Any) -> RNG:
    """Shorthand for ``RNG(derive(seed, *parts))``."""
    return RNG(derive(seed, *parts))


# ---------------------------------------------------------------------------
# Distribution helpers (pure, given an RNG)
# ---------------------------------------------------------------------------

def gaussian(rng: RNG, mean: float, stddev: float) -> float:
    """Box–Muller transform -> normal-distributed sample.  Deterministic."""
    u1 = max(rng.random(), 1e-12)
    u2 = rng.random()
    mag = math.sqrt(-2.0 * math.log(u1))
    return mean + stddev * mag * math.cos(2.0 * math.pi * u2)


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t
