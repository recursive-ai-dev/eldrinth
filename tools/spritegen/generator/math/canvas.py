#!/usr/bin/env python3
"""
Integer RGBA canvas.
====================

A compact, allocation-light pixel buffer.  All drawing is *hard* (alpha is
either 0 or 255) so the output never carries anti-aliasing — the production
constraint for pixel-art sprites.  A parallel ``tag`` buffer lets later
passes (FFD, outlines, material shaders) know what each pixel *is*.
"""

from __future__ import annotations

from typing import Iterable, List, Optional, Tuple

from PIL import Image

RGBA = Tuple[int, int, int, int]
RGB = Tuple[int, int, int]

TRANSPARENT: RGBA = (0, 0, 0, 0)

TAG_EMPTY = 0
TAG_BODY = 1
TAG_BELLY = 2
TAG_HAIR = 3
TAG_CLOTH = 4
TAG_SKIN = 5
TAG_OUTLINE = 6
TAG_ACCENT = 7
TAG_EYE = 8
TAG_METAL = 9
TAG_FLOOR = 10
TAG_WALL = 11
TAG_HIGHLIGHT = 12
TAG_SHADOW = 13


def _rgba(c) -> RGBA:
    if len(c) == 4:
        return (int(c[0]), int(c[1]), int(c[2]), int(c[3]))
    return (int(c[0]), int(c[1]), int(c[2]), 255)


class Canvas:
    """``w×h`` RGBA buffer plus a per-pixel integer tag."""

    __slots__ = ("w", "h", "px", "tag")

    def __init__(self, w: int, h: int):
        if w <= 0 or h <= 0:
            raise ValueError("canvas size must be positive")
        self.w = int(w)
        self.h = int(h)
        n = self.w * self.h
        self.px: List[RGBA] = [TRANSPARENT] * n
        self.tag: List[int] = [TAG_EMPTY] * n

    # -- indexing ----------------------------------------------------------
    def _i(self, x: int, y: int) -> Optional[int]:
        if 0 <= x < self.w and 0 <= y < self.h:
            return y * self.w + x
        return None

    def in_bounds(self, x: int, y: int) -> bool:
        return 0 <= x < self.w and 0 <= y < self.h

    def get(self, x: int, y: int) -> RGBA:
        i = self._i(x, y)
        return self.px[i] if i is not None else TRANSPARENT

    def get_tag(self, x: int, y: int) -> int:
        i = self._i(x, y)
        return self.tag[i] if i is not None else TAG_EMPTY

    def opaque(self, x: int, y: int) -> bool:
        i = self._i(x, y)
        return bool(i is not None and self.px[i][3] > 0)

    def set(self, x: int, y: int, color, tag: Optional[int] = None) -> None:
        i = self._i(int(x), int(y))
        if i is None:
            return
        c = _rgba(color)
        if c[3] <= 0:
            return
        self.px[i] = c
        if tag is not None:
            self.tag[i] = tag

    def set_if_empty(self, x: int, y: int, color, tag: Optional[int] = None) -> None:
        i = self._i(int(x), int(y))
        if i is None or self.px[i][3] > 0:
            return
        self.set(x, y, color, tag)

    def clear_px(self, x: int, y: int) -> None:
        i = self._i(int(x), int(y))
        if i is None:
            return
        self.px[i] = TRANSPARENT
        self.tag[i] = TAG_EMPTY

    # -- bulk --------------------------------------------------------------
    def fill_rect(self, x0: int, y0: int, x1: int, y1: int, color, tag: Optional[int] = None) -> None:
        if x1 < x0:
            x0, x1 = x1, x0
        if y1 < y0:
            y0, y1 = y1, y0
        c = _rgba(color)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, c, tag)

    def blit(self, other: "Canvas", dx: int = 0, dy: int = 0, opaque_only: bool = True) -> None:
        for y in range(other.h):
            for x in range(other.w):
                c = other.get(x, y)
                if opaque_only and c[3] <= 0:
                    continue
                self.set(x + dx, y + dy, c, other.get_tag(x, y))

    def clone(self) -> "Canvas":
        out = Canvas(self.w, self.h)
        out.px = list(self.px)
        out.tag = list(self.tag)
        return out

    def opaque_coords(self) -> Iterable[Tuple[int, int]]:
        for y in range(self.h):
            row = y * self.w
            for x in range(self.w):
                if self.px[row + x][3] > 0:
                    yield x, y

    def bbox(self) -> Optional[Tuple[int, int, int, int]]:
        xs = []
        ys = []
        for x, y in self.opaque_coords():
            xs.append(x)
            ys.append(y)
        if not xs:
            return None
        return min(xs), min(ys), max(xs), max(ys)

    def center_of_gravity(self) -> Tuple[float, float]:
        sx = sy = n = 0
        for x, y in self.opaque_coords():
            sx += x
            sy += y
            n += 1
        if n == 0:
            return (self.w - 1) / 2.0, (self.h - 1) / 2.0
        return sx / n, sy / n

    def mask(self) -> List[List[int]]:
        m = []
        for y in range(self.h):
            row = []
            for x in range(self.w):
                row.append(1 if self.opaque(x, y) else 0)
            m.append(row)
        return m

    def flood_from_mask(self, mask: List[List[int]], color, tag: Optional[int] = None) -> None:
        hh = min(self.h, len(mask))
        ww = min(self.w, len(mask[0]) if mask else 0)
        c = _rgba(color)
        for y in range(hh):
            for x in range(ww):
                if mask[y][x]:
                    self.set(x, y, c, tag)

    # -- export ------------------------------------------------------------
    def to_pil(self) -> Image.Image:
        img = Image.new("RGBA", (self.w, self.h), TRANSPARENT)
        img.putdata(self.px)
        return img

    @classmethod
    def from_pil(cls, img: Image.Image) -> "Canvas":
        img = img.convert("RGBA")
        w, h = img.size
        out = cls(w, h)
        out.px = list(img.getdata())
        for i, c in enumerate(out.px):
            if c[3] > 0:
                out.tag[i] = TAG_BODY
        return out

    def tobytes(self) -> bytes:
        return self.to_pil().tobytes()
