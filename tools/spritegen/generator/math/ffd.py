#!/usr/bin/env python3
"""
Free-form deformation with red / yellow / green mesh layers.
============================================================

Guide §5.2: three control-point layers give temporal coherence without a
diffusion U-Net.

* **Red (immobile)** — anchors (torso, skull). Never move.
* **Yellow (dynamic)** — joints at structure edges (shoulders, hips, ears).
* **Green (outer)** — silhouette / hair / cloth / fur.

A pixel is displaced by bilinear interpolation of the surrounding grid.  Red
points contribute identity; yellow/green contribute the frame's offset.  The
same spec + frame index always yields the same deformation.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Optional, Tuple

from .canvas import Canvas, TAG_HAIR, TAG_CLOTH, TAG_ACCENT, TAG_EMPTY

RED, YELLOW, GREEN = 0, 1, 2


@dataclass
class ControlPoint:
    x: float
    y: float
    layer: int = GREEN  # 0 red, 1 yellow, 2 green
    dx: float = 0.0
    dy: float = 0.0

    @property
    def tx(self) -> float:
        return self.x if self.layer == RED else self.x + self.dx

    @property
    def ty(self) -> float:
        return self.y if self.layer == RED else self.y + self.dy


class FFDGrid:
    """Regular control lattice over a canvas, with per-layer amplitudes."""

    def __init__(self, w: int, h: int, nx: int = 5, ny: int = 5):
        self.w = w
        self.h = h
        self.nx = max(2, nx)
        self.ny = max(2, ny)
        self.points: List[ControlPoint] = []
        for j in range(self.ny):
            for i in range(self.nx):
                x = i * (w - 1) / float(self.nx - 1)
                y = j * (h - 1) / float(self.ny - 1)
                # interior of the body is red, mid-ring yellow, rim green
                u = abs(i - (self.nx - 1) / 2.0) / ((self.nx - 1) / 2.0)
                v = abs(j - (self.ny - 1) / 2.0) / ((self.ny - 1) / 2.0)
                rim = max(u, v)
                if rim < 0.35:
                    layer = RED
                elif rim < 0.75:
                    layer = YELLOW
                else:
                    layer = GREEN
                self.points.append(ControlPoint(x, y, layer))

    def _idx(self, i: int, j: int) -> int:
        return j * self.nx + i

    def set_wave(self, frame: int, nframes: int = 4, amp: float = 1.15) -> None:
        """Walk / idle organic motion: yellow+green points orbit slightly."""
        t = (frame / float(max(1, nframes))) * 2.0 * math.pi
        for p in self.points:
            if p.layer == RED:
                p.dx = p.dy = 0.0
                continue
            scale = 0.55 if p.layer == YELLOW else 1.0
            # hair/cloth (upper rows) sway more on X; lower rows bob on Y
            ny = p.y / max(1.0, self.h - 1)
            p.dx = amp * scale * math.sin(t + p.x * 0.35) * (1.15 - ny)
            p.dy = amp * scale * 0.55 * math.cos(t * 2.0 + p.y * 0.2) * ny

    def displace(self, x: float, y: float) -> Tuple[float, float]:
        """Inverse-bilinear: sample the deformed lattice at (x, y)."""
        if self.nx < 2 or self.ny < 2:
            return x, y
        gx = x * (self.nx - 1) / max(1, self.w - 1)
        gy = y * (self.ny - 1) / max(1, self.h - 1)
        i0 = int(math.floor(gx))
        j0 = int(math.floor(gy))
        i0 = max(0, min(self.nx - 2, i0))
        j0 = max(0, min(self.ny - 2, j0))
        tx = gx - i0
        ty = gy - j0
        p00 = self.points[self._idx(i0, j0)]
        p10 = self.points[self._idx(i0 + 1, j0)]
        p01 = self.points[self._idx(i0, j0 + 1)]
        p11 = self.points[self._idx(i0 + 1, j0 + 1)]
        dx = (
            (1 - tx) * (1 - ty) * (p00.tx - p00.x)
            + tx * (1 - ty) * (p10.tx - p10.x)
            + (1 - tx) * ty * (p01.tx - p01.x)
            + tx * ty * (p11.tx - p11.x)
        )
        dy = (
            (1 - tx) * (1 - ty) * (p00.ty - p00.y)
            + tx * (1 - ty) * (p10.ty - p10.y)
            + (1 - tx) * ty * (p01.ty - p01.y)
            + tx * ty * (p11.ty - p11.y)
        )
        return x + dx, y + dy


# tags that FFD is allowed to move (green/yellow layers in spirit)
_MOVABLE = {TAG_HAIR, TAG_CLOTH, TAG_ACCENT}


def apply_ffd(
    canvas: Canvas,
    grid: FFDGrid,
    tags: Optional[set] = None,
) -> Canvas:
    """Map movable pixels through the FFD lattice.

    Identity for red-anchored / body tags — this is what kills style-drift
    across a walk cycle: the silhouette core never crawls.

    Movable pixels are resolved by *backward* sampling — for each
    destination pixel, look up where it came from — rather than forward
    splatting each source pixel to a new spot. A forward splat leaves gaps
    wherever the local deformation stretches (not every destination pixel
    receives a source), which on a large solid-colour region like a shirt
    reads as the cloth visibly tearing/thinning each frame. Backward
    sampling visits every destination pixel exactly once, so coverage is
    always complete. The field is small and smooth enough that evaluating
    the displacement at the destination (rather than solving for the true
    source) is an accurate local inverse.
    """
    movable = tags if tags is not None else _MOVABLE
    out = Canvas(canvas.w, canvas.h)
    # first copy immovable pixels (identity)
    for y in range(canvas.h):
        for x in range(canvas.w):
            if not canvas.opaque(x, y):
                continue
            tag = canvas.get_tag(x, y)
            if tag not in movable:
                out.set(x, y, canvas.get(x, y), tag)
    # then backward-sample movable ones on top, one lookup per destination pixel
    for y in range(canvas.h):
        for x in range(canvas.w):
            px, py = x + 0.5, y + 0.5
            dx_field, dy_field = grid.displace(px, py)
            sx = int(round(x - (dx_field - px)))
            sy = int(round(y - (dy_field - py)))
            if not canvas.in_bounds(sx, sy) or not canvas.opaque(sx, sy):
                continue
            tag = canvas.get_tag(sx, sy)
            if tag not in movable:
                continue
            out.set(x, y, canvas.get(sx, sy), tag)
    return out
