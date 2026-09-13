#!/usr/bin/env python3
"""
Cellular automata for low-resolution silhouettes.
=================================================

Von Neumann (4) and Moore (8) neighbourhoods, thresholded survival (default
T=4), bilateral mirroring, edge recovery, orphan-pixel pruning, and a
Hilbert-curve walkability layer for cave layouts (guide §2).

Density (survival vs. extinction) is the visual weight of the asset:
high survival → blocky golems; high extinction → skeletal insects.
"""

from __future__ import annotations

from typing import List, Sequence, Tuple

from ..rng import RNG, derive

Grid = List[List[int]]

VON_NEUMANN = ((0, -1), (0, 1), (-1, 0), (1, 0))
MOORE = VON_NEUMANN + ((-1, -1), (1, -1), (-1, 1), (1, 1))


def zeros(w: int, h: int) -> Grid:
    return [[0] * w for _ in range(h)]


def clone(g: Grid) -> Grid:
    return [row[:] for row in g]


def size_of(g: Grid) -> Tuple[int, int]:
    h = len(g)
    w = len(g[0]) if h else 0
    return w, h


def density(g: Grid) -> float:
    w, h = size_of(g)
    if w * h == 0:
        return 0.0
    return sum(sum(row) for row in g) / float(w * h)


def neighbor_sum(g: Grid, x: int, y: int, neighborhood=MOORE, wrap: bool = False) -> int:
    w, h = size_of(g)
    s = 0
    for dx, dy in neighborhood:
        nx, ny = x + dx, y + dy
        if wrap:
            s += g[ny % h][nx % w]
        elif 0 <= nx < w and 0 <= ny < h:
            s += g[ny][nx]
    return s


def ca_step(
    g: Grid,
    threshold: int = 4,
    neighborhood=MOORE,
    wrap: bool = False,
    birth: bool = True,
) -> Grid:
    """One thresholded CA step.

    A live cell persists if ``neighbors >= threshold``; a dead cell is born
    if ``birth`` and ``neighbors > threshold``.  T=4 on a Moore neighbourhood
    is the noise-killing smoother from guide §2.1.
    """
    w, h = size_of(g)
    out = zeros(w, h)
    for y in range(h):
        for x in range(w):
            n = neighbor_sum(g, x, y, neighborhood, wrap)
            if g[y][x]:
                out[y][x] = 1 if n >= threshold else 0
            elif birth and n > threshold:
                out[y][x] = 1
    return out


def recover_edge_cells(g: Grid) -> Grid:
    """Force every boundary cell live — prevents silhouette holes (guide §2.3)."""
    w, h = size_of(g)
    out = clone(g)
    if w == 0 or h == 0:
        return out
    for x in range(w):
        out[0][x] = 1
        out[h - 1][x] = 1
    for y in range(h):
        out[y][0] = 1
        out[y][w - 1] = 1
    return out


def remove_secluded_cells(g: Grid, neighborhood=MOORE) -> Grid:
    """Prune orphan pixels that have no live neighbours (guide §2.3)."""
    w, h = size_of(g)
    out = zeros(w, h)
    for y in range(h):
        for x in range(w):
            if g[y][x] and neighbor_sum(g, x, y, neighborhood) > 0:
                out[y][x] = 1
    return out


def remove_islands(g: Grid, min_size: int = 4) -> Grid:
    """Drop connected components smaller than ``min_size``."""
    w, h = size_of(g)
    seen = [[False] * w for _ in range(h)]
    out = zeros(w, h)
    for y in range(h):
        for x in range(w):
            if not g[y][x] or seen[y][x]:
                continue
            stack = [(x, y)]
            comp = []
            seen[y][x] = True
            while stack:
                cx, cy = stack.pop()
                comp.append((cx, cy))
                for dx, dy in MOORE:
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < h and g[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            if len(comp) >= min_size:
                for cx, cy in comp:
                    out[cy][cx] = 1
    return out


def mirror_horizontal(half: Grid) -> Grid:
    """Mirror a half-canvas (``w×h``) to ``(2w)×h`` for bilateral symmetry."""
    h = len(half)
    w = len(half[0]) if h else 0
    out = zeros(w * 2, h)
    for y in range(h):
        for x in range(w):
            v = half[y][x]
            out[y][x] = v
            out[y][w * 2 - 1 - x] = v
    return out


def seed_blob(
    rng: RNG,
    w: int,
    h: int,
    density_p: float = 0.48,
    cx: float = None,
    cy: float = None,
    rx: float = None,
    ry: float = None,
) -> Grid:
    """Ellipse-biased Bernoulli field — the CA's initial condition."""
    cx = (w - 1) / 2.0 if cx is None else cx
    cy = (h - 1) * 0.48 if cy is None else cy
    rx = w * 0.42 if rx is None else rx
    ry = h * 0.38 if ry is None else ry
    g = zeros(w, h)
    for y in range(h):
        for x in range(w):
            nx = (x - cx) / max(rx, 1e-6)
            ny = (y - cy) / max(ry, 1e-6)
            inside = nx * nx + ny * ny <= 1.0
            p = density_p if inside else density_p * 0.12
            g[y][x] = 1 if rng.random() < p else 0
    return g


def evolve(
    g: Grid,
    rounds: int = 4,
    threshold: int = 4,
    neighborhood=MOORE,
    prune: bool = True,
) -> Grid:
    for _ in range(max(0, rounds)):
        g = ca_step(g, threshold=threshold, neighborhood=neighborhood)
    if prune:
        g = remove_secluded_cells(g)
        g = remove_islands(g, min_size=3)
    return g


def _rot(n: int, x: int, y: int, rx: int, ry: int) -> Tuple[int, int]:
    if ry == 0:
        if rx == 1:
            x = n - 1 - x
            y = n - 1 - y
        x, y = y, x
    return x, y


def hilbert_d2xy(order: int, d: int) -> Tuple[int, int]:
    """Map 1-D Hilbert index ``d`` to ``(x, y)`` on a ``2^order × 2^order`` grid."""
    n = 1 << order
    x = y = 0
    s = 1
    t = int(d)
    while s < n:
        rx = 1 & (t // 2)
        ry = 1 & (t ^ rx)
        x, y = _rot(s, x, y, rx, ry)
        x += s * rx
        y += s * ry
        t //= 4
        s *= 2
    return x, y


def hilbert_path(order: int) -> List[Tuple[int, int]]:
    n = 1 << order
    return [hilbert_d2xy(order, i) for i in range(n * n)]


def _floor_reachable(g: Grid, start: Tuple[int, int]) -> List[List[bool]]:
    """BFS over floor (0) cells from ``start``, 4-connected."""
    w, h = size_of(g)
    seen = [[False] * w for _ in range(h)]
    sx, sy = start
    if not (0 <= sx < w and 0 <= sy < h) or g[sy][sx]:
        return seen
    seen[sy][sx] = True
    stack = [(sx, sy)]
    while stack:
        x, y = stack.pop()
        for dx, dy in VON_NEUMANN:
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not g[ny][nx] and not seen[ny][nx]:
                seen[ny][nx] = True
                stack.append((nx, ny))
    return seen


def _carve_line(g: Grid, x0: int, y0: int, x1: int, y1: int, corridor: int) -> None:
    """Bresenham line, stamping a ``corridor``-radius floor blob at every step
    so consecutive corridor waypoints are actually connected (not just each
    individually surrounded by floor)."""
    w, h = size_of(g)
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    x, y = x0, y0
    while True:
        for oy in range(-corridor, corridor + 1):
            for ox in range(-corridor, corridor + 1):
                xx, yy = x + ox, y + oy
                if 1 <= xx < w - 1 and 1 <= yy < h - 1:
                    g[yy][xx] = 0  # floor
        if x == x1 and y == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x += sx
        if e2 <= dx:
            err += dx
            y += sy


def cave_generate(
    seed: int,
    w: int = 32,
    h: int = 32,
    fill_p: float = 0.45,
    rounds: int = 5,
    threshold: int = 4,
    corridor: int = 1,
) -> Grid:
    """Cave CA + Hilbert corridor so the layout stays walkable (guide §2.2).

    Walkability is *guaranteed*, not just attempted: after the corridor is
    carved, a flood fill from the corridor's start finds every reachable
    floor cell, and any floor cell that isn't reachable is sealed back into
    wall.  This is what makes "every region stays reachable" actually true
    rather than merely likely.
    """
    rng = RNG(derive(seed, "cave", w, h))
    g = zeros(w, h)
    for y in range(h):
        for x in range(w):
            # keep a solid frame so caves don't open on the border
            if x == 0 or y == 0 or x == w - 1 or y == h - 1:
                g[y][x] = 1  # wall
            else:
                g[y][x] = 1 if rng.random() < fill_p else 0
    for _ in range(rounds):
        g = ca_step(g, threshold=threshold, neighborhood=MOORE, birth=True)
    g = recover_edge_cells(g)

    # Hilbert corridor: punch floor along a space-filling curve, scaled to the map.
    order = 0
    while (1 << order) < min(w, h):
        order += 1
    order = max(1, order - 1)
    n = 1 << order
    path = hilbert_path(order)
    # subsample so we don't floor the entire map, but connect consecutive
    # waypoints with a carved line so the corridor has no internal gaps.
    stride = max(1, len(path) // max(8, (w + h)))
    waypoints = []
    for i in range(0, len(path), stride):
        hx, hy = path[i]
        x = 1 + int(hx * (w - 2) / max(1, n - 1))
        y = 1 + int(hy * (h - 2) / max(1, n - 1))
        waypoints.append((x, y))
    for i, (x, y) in enumerate(waypoints):
        if i == 0:
            _carve_line(g, x, y, x, y, corridor)
        else:
            px, py = waypoints[i - 1]
            _carve_line(g, px, py, x, y, corridor)

    # Guarantee walkability: seal off any floor not reachable from the
    # corridor start instead of merely hoping the CA rooms happened to touch it.
    if waypoints:
        reachable = _floor_reachable(g, waypoints[0])
        for y in range(h):
            for x in range(w):
                if g[y][x] == 0 and not reachable[y][x]:
                    g[y][x] = 1
    return g


def silhouette(
    seed: int,
    w: int = 16,
    h: int = 32,
    density_p: float = 0.50,
    threshold: int = 4,
    rounds: int = 4,
    symmetric: bool = True,
    neighborhood=MOORE,
) -> Grid:
    """Half-canvas CA, optionally mirrored — the creature/human macro-structure."""
    rng = RNG(derive(seed, "sil", w, h, int(density_p * 1000), threshold))
    half_w = w // 2 if symmetric else w
    # For a mirrored silhouette the ellipse is anchored on the *inner* edge
    # so the two halves weld into one creature instead of a split pair.
    if symmetric:
        g = seed_blob(rng, half_w, h, density_p=density_p,
                      cx=half_w - 0.6, rx=half_w * 0.85, ry=h * 0.36)
    else:
        g = seed_blob(rng, half_w, h, density_p=density_p)
    # guaranteed spine on the seam so mirroring always produces one body
    if symmetric and half_w > 0:
        y0, y1 = int(h * 0.22), int(h * 0.72)
        for y in range(y0, y1):
            g[y][half_w - 1] = 1
            if half_w > 1:
                g[y][half_w - 2] = 1
    g = evolve(g, rounds=rounds, threshold=threshold, neighborhood=neighborhood)
    if density(g) < 0.08:
        # never emit an empty silhouette — stamp a guaranteed body ellipse
        rng2 = RNG(derive(seed, "sil-fallback", w, h))
        g = seed_blob(rng2, half_w, h, density_p=max(0.62, density_p), rx=half_w * 0.85, ry=h * 0.36)
        g = evolve(g, rounds=2, threshold=min(3, threshold), neighborhood=neighborhood)
    if symmetric:
        # weld seam before mirror
        if half_w > 0:
            for y in range(h):
                g[y][half_w - 1] = 1 if (g[y][half_w - 1] or (half_w > 1 and g[y][half_w - 2])) else g[y][half_w - 1]
        g = mirror_horizontal(g)
        # if w is odd, drop the extra column
        if len(g[0]) > w:
            g = [row[:w] for row in g]
        elif len(g[0]) < w:
            for row in g:
                row.append(row[-1] if row else 0)
        # one smoothing step to fuse the two halves, then drop specks
        g = ca_step(g, threshold=min(3, threshold), neighborhood=neighborhood)
        g = remove_islands(g, min_size=8)
        # force a connected torso disk if the weld still split
        if density(g) < 0.06:
            cx, cy = w // 2, int(h * 0.45)
            for y in range(h):
                for x in range(w):
                    if ((x - cx) / 6.0) ** 2 + ((y - cy) / 7.0) ** 2 <= 1.0:
                        g[y][x] = 1
    return g
