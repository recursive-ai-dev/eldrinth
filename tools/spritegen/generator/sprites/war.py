#!/usr/bin/env python3
"""Faction war-sprites: bespoke structures, mounts and siege machines.

Three factions (``human``, ``darkelf``, ``corrupted``) share one grammar but
speak it in different materials -- timber & slate, spire & crystal, flesh &
bone.  Every building type, mount and siege engine is its own drawing; nothing
is a recoloured cottage.  Everything is integer-pixel, deterministic and keyed
only on (seed, faction, kind, direction, frame).
"""

from __future__ import annotations

import math
from typing import Any, Dict, Tuple

from PIL import Image, ImageDraw

from .. import color
from ..rng import RNG, derive
from .base import SpriteGenerator

INK = (16, 13, 20, 255)


def _seed_palette(f: str, rng: RNG) -> Dict[str, Tuple[int, int, int]]:
    """Derive a seeded material variation within the faction's identity."""
    base = FACTIONS[f]
    warmth = rng.choice([
        (205, 190, 170), (165, 180, 200), (180, 160, 145),
        (170, 195, 175), (210, 175, 165),
    ])
    w_amt = rng.uniform(0.03, 0.16)
    r_shift = rng.uniform(-0.08, 0.10)
    a_shift = rng.uniform(0.0, 0.22)
    a_alt = rng.choice([(220, 170, 70), (190, 70, 80), (75, 165, 170), (155, 110, 210), (120, 175, 90)])

    def adjust(rgb, delta):
        return color.lighten(rgb, delta) if delta >= 0 else color.darken(rgb, -delta)

    return {
        "wall": color.mix(base["wall"], warmth, w_amt),
        "roof": adjust(color.mix(base["roof"], warmth, w_amt * 0.6), r_shift),
        "trim": adjust(base["trim"], rng.uniform(-0.06, 0.08)),
        "wood": adjust(base["wood"], rng.uniform(-0.10, 0.10)),
        "accent": color.mix(base["accent"], a_alt, a_shift),
        "glow": base["glow"],
        "ground": adjust(base["ground"], rng.uniform(-0.08, 0.08)),
    }

FACTIONS = {
    "human": dict(wall=(150, 146, 136), roof=(54, 82, 118), trim=(206, 196, 168), wood=(104, 70, 42),
                  accent=(84, 134, 206), glow=(255, 214, 128), ground=(92, 84, 70)),
    "darkelf": dict(wall=(66, 52, 86), roof=(38, 30, 58), trim=(158, 118, 208), wood=(52, 40, 66),
                    accent=(190, 120, 255), glow=(206, 150, 255), ground=(44, 38, 54)),
    "corrupted": dict(wall=(148, 74, 68), roof=(98, 36, 42), trim=(216, 200, 170), wood=(74, 38, 38),
                      accent=(255, 92, 60), glow=(255, 120, 70), ground=(70, 38, 36)),
}


def _c(rgb, a=255):
    return (int(rgb[0]), int(rgb[1]), int(rgb[2]), a)


def lt(rgb, f=0.25):
    return _c(color.lighten(tuple(rgb[:3]), f))


def dk(rgb, f=0.3):
    return _c(color.darken(tuple(rgb[:3]), f))


class _Pen:
    """Draw in a normalised 0..100 space onto any canvas size."""

    def __init__(self, img: Image.Image):
        self.img = img
        self.d = ImageDraw.Draw(img)
        self.w, self.h = img.size

    def X(self, v):
        return int(round(v * (self.w - 1) / 100.0))

    def Y(self, v):
        return int(round(v * (self.h - 1) / 100.0))

    def rect(self, x0, y0, x1, y1, fill, ink=True):
        X, Y = self.X, self.Y
        if ink:
            self.d.rectangle((X(x0) - 1, Y(y0) - 1, X(x1) + 1, Y(y1) + 1), fill=INK)
        self.d.rectangle((X(x0), Y(y0), X(x1), Y(y1)), fill=fill)

    def poly(self, pts, fill, ink=True):
        P = [(self.X(x), self.Y(y)) for x, y in pts]
        if ink:
            self.d.polygon(P, fill=INK, outline=INK)
            cx = sum(p[0] for p in P) / len(P)
            cy = sum(p[1] for p in P) / len(P)
            inner = [(int(p[0] + (1 if p[0] < cx else -1 if p[0] > cx else 0)),
                      int(p[1] + (1 if p[1] < cy else -1 if p[1] > cy else 0))) for p in P]
            self.d.polygon(inner, fill=fill)
        else:
            self.d.polygon(P, fill=fill)

    def ell(self, cx, cy, rx, ry, fill, ink=True):
        X, Y = self.X, self.Y
        box = (X(cx - rx), Y(cy - ry), X(cx + rx), Y(cy + ry))
        if ink:
            self.d.ellipse((box[0] - 1, box[1] - 1, box[2] + 1, box[3] + 1), fill=INK)
        self.d.ellipse(box, fill=fill)

    def line(self, x0, y0, x1, y1, fill, width=1):
        self.d.line((self.X(x0), self.Y(y0), self.X(x1), self.Y(y1)), fill=fill, width=width)

    def pt(self, x, y, fill):
        self.d.point((self.X(x), self.Y(y)), fill=fill)

    def shadow(self, cx, cy, rx, ry):
        self.d.ellipse((self.X(cx - rx), self.Y(cy - ry), self.X(cx + rx), self.Y(cy + ry)), fill=(0, 0, 0, 70))


# ---------------------------------------------------------------------------
# Structures
# ---------------------------------------------------------------------------

def _wall(p: _Pen, f: str, pal, x0, y0, x1, y1):
    base = _c(pal["wall"])
    p.rect(x0, y0, x1, y1, base)
    hi, sh = lt(pal["wall"], 0.14), dk(pal["wall"], 0.28)
    p.rect(x0, y1 - (y1 - y0) * 0.16, x1, y1, sh, ink=False)
    if f == "human":  # stone courses
        row = 0
        y = y0 + 4
        while y < y1 - 2:
            p.line(x0, y, x1, y, sh)
            x = x0 + (3 if row % 2 else 7)
            while x < x1:
                p.line(x, y, x, y + 4, sh)
                x += 9
            y += 4.2
            row += 1
        p.line(x0, y0 + 0.6, x1, y0 + 0.6, hi)
    elif f == "darkelf":  # fluted, smooth
        x = x0 + 4
        while x < x1:
            p.line(x, y0 + 2, x, y1 - 3, sh)
            p.line(x + 1, y0 + 2, x + 1, y1 - 3, hi)
            x += 7
        p.line(x0, y0 + 1, x1, y0 + 1, _c(pal["trim"]))
    else:  # flesh with veins and rib bone
        x = x0 + 5
        while x < x1:
            p.line(x, y0 + 1, x + 2, y0 + (y1 - y0) * 0.5, dk(pal["wall"], 0.4))
            p.line(x + 2, y0 + (y1 - y0) * 0.5, x - 1, y1 - 3, dk(pal["wall"], 0.4))
            x += 9
        for k in range(3):
            y = y0 + 4 + k * (y1 - y0) / 3.4
            p.line(x0 + 2, y, x1 - 2, y + 1.5, _c(pal["trim"]))


def _roof(p: _Pen, f: str, pal, x0, y0, x1, y1, h=None):
    """Roof occupying x0..x1 whose eave sits at y1 and peak rises by ``h``."""
    h = h if h is not None else (y1 - y0)
    base, hi, sh = _c(pal["roof"]), lt(pal["roof"], 0.22), dk(pal["roof"], 0.35)
    cx = (x0 + x1) / 2.0
    top = y1 - h
    if f == "human":
        p.poly([(x0 - 2, y1), (cx, top), (x1 + 2, y1)], base)
        y = top + 4
        while y < y1 - 1:
            half = (x1 - x0 + 4) / 2.0 * (y - top) / h
            p.line(cx - half + 2, y, cx + half - 2, y, sh)
            y += 3.6
        p.line(cx, top + 1, x0 + 2, y1 - 1, hi)
    elif f == "darkelf":
        # concave swept spire
        pts = [(x0 - 3, y1)]
        for t in range(1, 8):
            u = t / 8.0
            pts.append((x0 - 3 + (cx - x0 + 3) * (u ** 1.8), y1 - h * u))
        pts.append((cx, top - h * 0.18))
        for t in range(7, 0, -1):
            u = t / 8.0
            pts.append((x1 + 3 - (x1 + 3 - cx) * (u ** 1.8), y1 - h * u))
        pts.append((x1 + 3, y1))
        p.poly(pts, base)
        p.line(cx, top - h * 0.1, cx, y1 - 1, sh)
        p.line(cx - 1, top + 3, x0 + 3, y1 - 1, hi)
        p.poly([(cx, top - h * 0.34), (cx + 2.4, top - h * 0.12), (cx, top - h * 0.02), (cx - 2.4, top - h * 0.12)],
               _c(pal["glow"]))
    else:
        # bulging dome of flesh with tooth fringe
        p.ell(cx, y1 - h * 0.35, (x1 - x0) / 2 + 3, h * 0.72, base)
        p.rect(x0 - 3, y1 - 1, x1 + 3, y1 + 1, base, ink=False)
        for k in range(5):
            xx = x0 + (x1 - x0) * k / 4.0
            p.line(cx, top + 1, xx, y1 - 1, sh)
        p.ell(cx - (x1 - x0) * 0.18, y1 - h * 0.6, (x1 - x0) * 0.1, h * 0.12, hi, ink=False)
        n = max(5, int((x1 - x0) / 5))
        for k in range(n):
            xx = x0 - 1 + (x1 - x0 + 2) * k / max(1, n - 1)
            p.poly([(xx - 1.4, y1 + 0.5), (xx + 1.4, y1 + 0.5), (xx, y1 + 3.2)], _c(pal["trim"]))
    # eave shadow line
    p.line(x0 - 2, y1 + 0.5, x1 + 2, y1 + 0.5, sh)


def _door(p: _Pen, f, pal, cx, y1, w=9, h=18, lit=False):
    x0, x1 = cx - w / 2, cx + w / 2
    inner = _c(pal["glow"]) if lit else dk(pal["wood"], 0.15)
    if f == "darkelf":
        p.poly([(x0, y1), (x0, y1 - h * 0.7), (cx, y1 - h), (x1, y1 - h * 0.7), (x1, y1)], inner)
        p.line(cx, y1 - h + 2, cx, y1, dk(pal["wood"], 0.4))
    elif f == "corrupted":
        p.ell(cx, y1 - h * 0.45, w / 2, h * 0.52, dk(pal["roof"], 0.3))
        p.ell(cx, y1 - h * 0.35, w / 2 - 2, h * 0.38, inner if lit else (30, 8, 12, 255), ink=False)
        for k in (-2, 0, 2):
            p.poly([(cx + k - 0.8, y1 - h * 0.92), (cx + k + 0.8, y1 - h * 0.92), (cx + k, y1 - h * 0.72)],
                   _c(pal["trim"]), ink=False)
    else:
        p.rect(x0, y1 - h, x1, y1, inner)
        p.rect(x0 - 1, y1 - h - 2, x1 + 1, y1 - h, _c(pal["trim"]), ink=False)
        p.line(cx, y1 - h, cx, y1, dk(pal["wood"], 0.45))
        p.pt(cx + 1.5, y1 - h * 0.4, _c(pal["trim"]))


def _window(p, f, pal, cx, cy, s=3.6):
    if f == "darkelf":
        p.poly([(cx, cy - s), (cx + s * 0.6, cy), (cx, cy + s), (cx - s * 0.6, cy)], _c(pal["glow"]))
    elif f == "corrupted":
        p.ell(cx, cy, s * 0.6, s * 0.9, _c(pal["glow"]))
        p.line(cx, cy - s * 0.8, cx, cy + s * 0.8, INK)
    else:
        p.rect(cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2, _c(pal["glow"]))
        p.line(cx, cy - s / 2, cx, cy + s / 2, dk(pal["wood"]))


def _banner(p, f, pal, x, y, h=20):
    p.line(x, y, x, y + h, dk(pal["wood"], 0.2), 2)
    cloth = _c(pal["accent"])
    if f == "corrupted":
        p.poly([(x + 1, y + 1), (x + 9, y + 3), (x + 7, y + 10), (x + 9, y + 15), (x + 1, y + 12)], cloth)
    elif f == "darkelf":
        p.poly([(x + 1, y + 1), (x + 9, y + 1), (x + 5, y + 14)], cloth)
    else:
        p.rect(x + 1, y + 1, x + 9, y + 11, cloth)
        p.line(x + 1, y + 6, x + 9, y + 6, lt(pal["accent"], 0.4))


def _crenel(p, pal, x0, x1, y, n=5):
    step = (x1 - x0) / (n * 2 - 1)
    for k in range(n):
        xa = x0 + k * 2 * step
        p.rect(xa, y - 5, xa + step, y, _c(pal["wall"]))


def _tower_body(p, f, pal, cx, y0, y1, hw, top_kind="roof"):
    _wall(p, f, pal, cx - hw, y0, cx + hw, y1)
    if top_kind == "roof":
        _roof(p, f, pal, cx - hw, y0 - 18, cx + hw, y0 + 1, h=26)
    else:
        _crenel(p, pal, cx - hw - 1, cx + hw + 1, y0)


def _structure(f: str, kind: str, W: int, H: int, seed: int, variant: int) -> Image.Image:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    p = _Pen(img)
    rng = RNG(derive(seed, "structure", f, kind, variant))
    pal = _seed_palette(f, rng)
    p.shadow(50, 92, 44, 6)
    if kind == "hall":
        # keep with flanking towers, great door, banners, seeded roofline & heraldry
        t_dy = rng.randint(-5, 4)
        t_top = rng.choice(["roof", "roof", "crenel"])
        roof_h = rng.randint(28, 38)
        door_w = rng.randint(12, 16)
        has_bellcote = rng.random() < 0.55
        shield_style = rng.choice(["chevron", "cross", "split", "none"])
        for cx in (17, 83):
            _tower_body(p, f, pal, cx, 38 + t_dy, 90, 11, t_top)
            _window(p, f, pal, cx, 56 + t_dy // 2)
        _wall(p, f, pal, 24, 44, 76, 90)
        _roof(p, f, pal, 24, 46 - roof_h, 76, 46, h=roof_h)
        if has_bellcote:
            _wall(p, f, pal, 43, 20, 57, 36)
            _roof(p, f, pal, 42, 6, 58, 21, h=14)
            _window(p, f, pal, 50, 27, 2.8)
        _wall(p, f, pal, 34, 34, 66, 46)
        _door(p, f, pal, 50, 90, w=door_w, h=26, lit=True)
        for cx in (34, 66):
            _window(p, f, pal, cx, 66, 4.4)
        if shield_style != "none":
            p.poly([(46, 42), (54, 42), (54, 50), (50, 55), (46, 50)], _c(pal["accent"]))
            if shield_style == "cross":
                p.line(50, 43, 50, 53, _c(pal["trim"]))
                p.line(47, 47, 53, 47, _c(pal["trim"]))
            elif shield_style == "chevron":
                p.line(47, 49, 50, 45, _c(pal["trim"]))
                p.line(53, 49, 50, 45, _c(pal["trim"]))
        _banner(p, f, pal, 27, 48, 22)
        _banner(p, f, pal, 69, 48, 22)
        # Courtyard prop detail (barrels / brazier)
        if rng.random() < 0.7:
            bx = rng.choice([29, 71])
            p.rect(bx - 3, 82, bx + 3, 90, _c(pal["wood"]))
            p.line(bx - 3, 85, bx + 3, 85, dk(pal["wood"], 0.4))
        p.rect(40, 90, 60, 93, dk(pal["wall"], 0.2))
    elif kind == "farm":
        # tilled field + small hut + seeded crop species + optional silo / haystack
        flip_hut = rng.random() < 0.4
        crop_kind = rng.choice(["grain", "pumpkin", "herb", "flower"])
        has_hay = rng.random() < 0.65
        has_chimney = rng.random() < 0.6
        soil = dk(pal["ground"], 0.1)
        p.poly([(6, 54), (94, 54), (98, 92), (2, 92)], soil)
        for k in range(6):
            y = 60 + k * 5.4
            p.line(6 - k * 0.6, y, 94 + k * 0.6, y, dk(pal["ground"], 0.38))
            for x in range(10, 92, 9):
                xx = x + (k % 2) * 4
                if f == "human":
                    if crop_kind == "pumpkin":
                        p.ell(xx, y - 1.5, 2.5, 2.0, (224, 126, 38, 255))
                        p.pt(xx, y - 3.5, (72, 132, 54, 255))
                    elif crop_kind == "herb":
                        p.line(xx, y, xx - 1, y - 4, (78, 152, 74, 255))
                        p.line(xx, y, xx + 2, y - 3, (104, 178, 86, 255))
                    elif crop_kind == "flower":
                        p.line(xx, y, xx, y - 4, (74, 136, 62, 255))
                        p.pt(xx, y - 5, _c(pal["accent"]))
                    else:
                        p.line(xx, y, xx, y - 4, (214, 184, 84, 255))
                        p.pt(xx, y - 5, (240, 214, 120, 255))
                elif f == "darkelf":
                    p.ell(xx, y - 2, 2.2, 2.6, _c(pal["accent"]))
                    p.pt(xx, y - 3, (240, 220, 255, 255))
                else:
                    p.ell(xx, y - 2, 2.4, 2.8, _c(pal["accent"]), ink=True)
                    p.pt(xx - 0.6, y - 2.6, lt(pal["accent"], 0.5))
        hx0, hx1 = (54, 86) if flip_hut else (14, 46)
        _wall(p, f, pal, hx0, 28, hx1, 56)
        if has_chimney:
            ch_x = hx1 - 8 if not flip_hut else hx0 + 4
            p.rect(ch_x, 12, ch_x + 5, 26, dk(pal["wall"], 0.2))
            p.ell(ch_x + 2, 7, 2.5, 2, (165, 165, 175, 150), ink=False)
        _roof(p, f, pal, hx0, 12, hx1, 30, h=rng.randint(18, 24))
        _door(p, f, pal, (hx0 + hx1) // 2, 56, w=8, h=14)
        sc_x = 24 if flip_hut else 76
        if has_hay:
            p.ell(sc_x, 54, 9, 6, (206, 176, 82, 255) if f == "human" else _c(pal["trim"]))
        # scarecrow / totem
        p.line(sc_x, 32, sc_x, 56, _c(pal["wood"]), 2)
        p.line(sc_x - 7, 40, sc_x + 7, 40, _c(pal["wood"]), 2)
        p.ell(sc_x, 32, 4, 4, _c(pal["trim"]))
        p.pt(sc_x - 1, 31, INK)
        p.pt(sc_x + 1, 31, INK)
    elif kind == "barracks":
        # long drill hall: varied roof, flank buttresses, shield heraldry, weapon rack
        roof_mode = rng.choice(["flat", "peaked", "twin"])
        has_buttress = rng.random() < 0.6
        nspears = rng.randint(3, 5)
        _wall(p, f, pal, 8, 38, 92, 90)
        if has_buttress:
            _wall(p, f, pal, 4, 52, 11, 90)
            _wall(p, f, pal, 89, 52, 96, 90)
        if f == "human":
            if roof_mode == "peaked":
                _roof(p, f, pal, 6, 16, 94, 40, h=22)
            elif roof_mode == "twin":
                _roof(p, f, pal, 8, 20, 48, 40, h=18)
                _roof(p, f, pal, 52, 20, 92, 40, h=18)
                _crenel(p, pal, 42, 58, 40, 3)
            else:
                _crenel(p, pal, 8, 92, 40, 7)
        elif f == "darkelf":
            p.poly([(8, 38), (30, 20), (50, 36), (70, 20), (92, 38)], _c(pal["roof"]))
        else:
            _roof(p, f, pal, 8, 18, 92, 40, h=26)
        _door(p, f, pal, 50, 90, w=16, h=26, lit=True)
        for x in (22, 78):
            _window(p, f, pal, x, 62)
        # emblem
        p.poly([(44, 46), (56, 46), (56, 56), (50, 62), (44, 56)], _c(pal["accent"]))
        p.line(50, 47, 50, 60, lt(pal["accent"], 0.5))
        # weapon rack out front
        rack_left = rng.random() < 0.5
        rx = 12 if rack_left else 70
        dx = 84 if rack_left else 16
        p.rect(rx, 74, rx + 18, 77, _c(pal["wood"]))
        for k in range(nspears):
            xx = rx + 2 + k * max(3, 14 // max(1, nspears - 1))
            p.line(xx, 65, xx, 76, lt(pal["wall"], 0.5) if f != "corrupted" else _c(pal["trim"]))
        # training dummy
        p.line(dx, 70, dx, 90, _c(pal["wood"]), 2)
        p.ell(dx, 68, 3.6, 3.6, _c(pal["trim"]))
    elif kind == "mill":
        # windmill / spinning bone wheel with seeded blade count & rotor phase
        nblades = rng.choice([4, 4, 6])
        ang0 = rng.uniform(0.15, math.pi / 2)
        has_sacks_left = rng.random() < 0.6
        p.poly([(30, 90), (36, 36), (64, 36), (70, 90)], _c(pal["wall"]))
        _wall(p, f, pal, 34, 38, 66, 90)
        _roof(p, f, pal, 32, 16, 68, 40, h=rng.randint(20, 26))
        _door(p, f, pal, 50, 90, w=10, h=17)
        _window(p, f, pal, 50, 52)
        hub = (50, 30)
        for k in range(nblades):
            ang = ang0 + k * (2 * math.pi / nblades)
            ex, ey = hub[0] + math.cos(ang) * 37, hub[1] + math.sin(ang) * 37
            p.line(hub[0], hub[1], ex, ey, _c(pal["wood"]) if f != "corrupted" else _c(pal["trim"]), 2)
            nx, ny = -math.sin(ang), math.cos(ang)
            sw = 7 if nblades == 4 else 5
            sail = [(hub[0] + math.cos(ang) * 8, hub[1] + math.sin(ang) * 8),
                    (ex, ey),
                    (ex + nx * sw, ey + ny * sw),
                    (hub[0] + math.cos(ang) * 8 + nx * sw, hub[1] + math.sin(ang) * 8 + ny * sw)]
            col = _c(pal["trim"]) if f != "darkelf" else _c(pal["accent"])
            p.poly(sail, col, ink=True)
        p.ell(hub[0], hub[1], 3.5, 3.5, _c(pal["wood"]))
        sack_xs = (14, 20, 80) if has_sacks_left else (18, 76, 84)
        for x in sack_xs:
            p.ell(x, 86, 4, 4, _c(pal["trim"]))
    elif kind == "blacksmith":
        chim_h = rng.randint(10, 17)
        smoke_dy = rng.randint(0, 3)
        roof_h = rng.randint(21, 27)
        _wall(p, f, pal, 10, 42, 74, 90)
        _roof(p, f, pal, 8, 44 - roof_h, 76, 44, h=roof_h)
        # chimney with smoke
        p.rect(60, chim_h, 70, 40, dk(pal["wall"], 0.2))
        p.rect(59, chim_h - 3, 71, chim_h + 1, dk(pal["wall"], 0.3))
        for k, (sx, sy) in enumerate(((64, chim_h - 7 - smoke_dy), (67, max(1, chim_h - 12 - smoke_dy)))):
            p.ell(sx, sy, 3 + k, 2.4, (120, 116, 124, 160), ink=False)
        # open forge mouth glowing
        p.rect(18, 58, 44, 90, (26, 18, 18, 255))
        p.rect(22, 64, 40, 90, _c(pal["glow"]))
        p.rect(26, 70, 36, 90, (255, 240, 190, 255), ink=False)
        # anvil (offset slightly per seed)
        ax = 52 + rng.randint(-3, 2)
        p.rect(ax, 78, ax + 20, 82, (74, 76, 88, 255))
        p.rect(ax + 4, 82, ax + 16, 90, (58, 60, 70, 255))
        p.poly([(ax, 78), (ax - 6, 78), (ax, 81)], (74, 76, 88, 255))
        # hanging tools + quench barrel / coal heap
        if rng.random() < 0.7:
            p.rect(78, 66, 94, 90, _c(pal["wood"]))
            p.line(78, 74, 94, 74, dk(pal["wood"], 0.4))
            p.line(78, 82, 94, 82, dk(pal["wood"], 0.4))
        else:
            p.poly([(76, 90), (85, 76), (95, 90)], (36, 36, 42, 255))
        p.line(14, 48, 14, 58, (170, 170, 184, 255))
        p.rect(11, 46, 17, 49, (170, 170, 184, 255))
    elif kind == "stables":
        stall_heads = rng.choice([(24, 76), (24, 50), (50, 76), (24, 50, 76)])
        has_trough = rng.random() < 0.6
        _wall(p, f, pal, 8, 44, 92, 90)
        _roof(p, f, pal, 4, 16, 96, 46, h=rng.randint(26, 33))
        # loft door w/ hay
        p.rect(42, 28, 58, 42, dk(pal["wood"], 0.2))
        p.rect(44, 33, 56, 42, (214, 188, 92, 255) if f != "corrupted" else _c(pal["trim"]))
        # stalls
        for cx in (24, 50, 76):
            p.rect(cx - 8, 60, cx + 8, 90, (28, 20, 22, 255))
            p.rect(cx - 8, 60, cx - 6, 90, _c(pal["wood"]), ink=False)
            p.rect(cx + 6, 60, cx + 8, 90, _c(pal["wood"]), ink=False)
            p.rect(cx - 8, 58, cx + 8, 61, _c(pal["wood"]), ink=False)
        coats = [(190, 150, 110, 255), (112, 74, 48, 255), (210, 206, 200, 255)] if f == "human" else [
            (52, 42, 70, 255) if f == "darkelf" else (150, 88, 80, 255)
        ]
        for idx, cx in enumerate(stall_heads):
            head = rng.choice(coats)
            p.ell(cx, 74, 5, 8, head)
            p.pt(cx + 1.5, 71, _c(pal["glow"]) if f != "human" else INK)
        if has_trough:
            p.rect(10, 84, 32, 91, _c(pal["wood"]))
            p.rect(12, 85, 30, 87, (84, 150, 198, 255), ink=False)
        # fence
        for x in range(2, 98, 12):
            p.line(x, 88, x, 98, _c(pal["wood"]), 2)
        p.line(2, 91, 98, 91, _c(pal["wood"]), 2)
    elif kind == "tower":
        hw = rng.randint(19, 24)
        has_hoarding = rng.random() < 0.55
        has_beacon = rng.random() < 0.45
        has_banner = rng.random() < 0.7
        _wall(p, f, pal, 50 - hw, 28, 50 + hw, 92)
        if f == "human":
            if has_hoarding:
                p.rect(50 - hw - 5, 28, 50 + hw + 5, 36, _c(pal["wood"]))
            _crenel(p, pal, 50 - hw - 4, 50 + hw + 4, 28, 5)
            p.rect(50 - hw + 2, 20, 50 + hw - 2, 30, dk(pal["wall"], 0.1))
            _crenel(p, pal, 50 - hw - 4, 50 + hw + 4, 22, 5)
            if has_beacon:
                p.ell(50, 16, 5, 6, _c(pal["glow"]))
                p.ell(50, 17, 2.5, 3, (255, 245, 200, 255), ink=False)
        elif f == "darkelf":
            _roof(p, f, pal, 50 - hw - 2, 4, 50 + hw + 2, 30, h=rng.randint(46, 56))
        else:
            p.ell(50, 28, hw + 6, 14, _c(pal["roof"]))
            p.ell(50, 18, 13, 13, (236, 220, 200, 255))
            p.ell(50, 18, 6, 7, _c(pal["accent"]), ink=False)
            p.rect(49, 14, 51, 22, INK, ink=False)
        _window(p, f, pal, 50, 48, 5)
        _door(p, f, pal, 50, 92, w=11, h=16)
        _window(p, f, pal, 50, 68, 3.6)
        if has_banner:
            _banner(p, f, pal, 50 + hw - 4, 42, 20)
        # arrow slits
        for y in (40, 58):
            p.rect(50 - hw + 7, y, 50 - hw + 8, y + 5, INK, ink=False)
            p.rect(50 + hw - 8, y, 50 + hw - 7, y + 5, INK, ink=False)
    # per-seed weathering marks
    wall_base = _c(pal["wall"])
    px = img.load()
    for _ in range(12):
        x, y = rng.randint(0, W - 1), rng.randint(int(H * 0.3), H - 1)
        if px[x, y][:3] == tuple(wall_base[:3]):
            px[x, y] = dk(pal["wall"], 0.18)
    return img


STRUCTURE_KINDS = ("hall", "farm", "barracks", "mill", "blacksmith", "stables", "tower")
STRUCTURE_TILES = dict(hall=4, farm=2, barracks=3, mill=3, blacksmith=3, stables=3, tower=2)


class StructureSpriteGenerator(SpriteGenerator):
    """One bespoke, faction-themed building per ``kind``."""

    type_name = "structure"
    default_size = (96, 96)

    def _build(self, seed: int, **options) -> Tuple[Dict[str, Any], Image.Image]:
        faction = str(options.get("faction", "human"))
        if faction not in FACTIONS:
            faction = "human"
        kind = str(options.get("kind", "hall"))
        if kind not in STRUCTURE_KINDS:
            kind = "hall"
        tiles = int(options.get("tiles", STRUCTURE_TILES[kind]))
        per = int(options.get("tile_px", 32))
        size = tiles * per
        img = _structure(faction, kind, size, size, seed, int(options.get("variant", 0)))
        return dict(faction=faction, kind=kind, size=size), img


# ---------------------------------------------------------------------------
# Mounts (the steed only; a rider is composited by the asset script)
# ---------------------------------------------------------------------------

MOUNT_COATS = {
    "human": [
        dict(name="bay", coat=(142, 100, 64), mane=(48, 34, 26), eye=(20, 12, 12), hoof=(40, 32, 30)),
        dict(name="chestnut", coat=(158, 86, 52), mane=(92, 46, 28), eye=(20, 12, 12), hoof=(48, 34, 30)),
        dict(name="dapple_grey", coat=(158, 162, 170), mane=(94, 98, 108), eye=(20, 16, 18), hoof=(54, 54, 62)),
        dict(name="raven", coat=(48, 46, 56), mane=(24, 22, 30), eye=(40, 26, 26), hoof=(24, 22, 26)),
        dict(name="palomino", coat=(194, 154, 86), mane=(236, 222, 182), eye=(24, 16, 14), hoof=(66, 54, 42)),
        dict(name="roan", coat=(146, 94, 84), mane=(68, 42, 44), eye=(24, 14, 14), hoof=(44, 34, 34)),
    ],
    "darkelf": [
        dict(name="twilight", coat=(58, 46, 84), mane=(170, 110, 230), eye=(214, 150, 255), hoof=(30, 24, 40)),
        dict(name="void", coat=(38, 34, 56), mane=(126, 198, 255), eye=(170, 235, 255), hoof=(22, 20, 32)),
        dict(name="silvermist", coat=(108, 104, 136), mane=(220, 175, 255), eye=(245, 200, 255), hoof=(44, 40, 58)),
    ],
    "corrupted": [
        dict(name="flayed", coat=(156, 86, 78), mane=(214, 196, 164), eye=(255, 96, 60), hoof=(72, 36, 36)),
        dict(name="blight", coat=(96, 112, 74), mane=(204, 188, 142), eye=(190, 255, 84), hoof=(48, 44, 32)),
        dict(name="cinder", coat=(76, 46, 48), mane=(248, 138, 62), eye=(255, 190, 82), hoof=(34, 22, 22)),
    ],
}
MOUNT_BODY = {f: coats[0] for f, coats in MOUNT_COATS.items()}


def _mount(f: str, direction: str, action: str, frame: int, nframes: int, S: int, seed: int = 0) -> Tuple[Image.Image, int, int]:
    """Return (image, saddle_x, saddle_y) in pixels."""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    p = _Pen(img)
    rng = RNG(derive(seed, "mount", f))
    m = rng.choice(MOUNT_COATS[f])
    blanket_col = _c(rng.choice([
        FACTIONS[f]["accent"],
        color.mix(FACTIONS[f]["accent"], (220, 180, 70), 0.35),
        color.mix(FACTIONS[f]["accent"], (180, 50, 65), 0.35),
        color.mix(FACTIONS[f]["accent"], (60, 155, 145), 0.35),
    ]))
    has_barding = rng.random() < 0.42
    has_blaze = rng.random() < 0.55
    has_socks = rng.random() < 0.45
    armor_col = (146, 152, 166, 255) if f == "human" else _c(FACTIONS[f]["trim"])
    coat, hi, sh = _c(m["coat"]), lt(m["coat"], 0.2), dk(m["coat"], 0.32)
    t = (frame % nframes) / float(nframes)
    ph = t * 2 * math.pi
    p.shadow(50, 90, 30, 5)
    lunge = 0.0
    if action == "attack":
        lunge = math.sin(t * math.pi)
    if direction in ("left", "right"):
        bob = 1.2 * abs(math.sin(ph)) if action == "walk" else 0
        by = 60 - bob - lunge * 4
        # far legs first
        legs = [(30, 0.5), (66, 0.0), (36, 0.0), (72, 0.5)]
        order = sorted(range(4), key=lambda i: i % 2 == 0)
        for i in order:
            lx, off = legs[i]
            swing = math.sin(ph + off * 2 * math.pi) * (9 if action == "walk" else 2)
            lift = max(0.0, math.cos(ph + off * 2 * math.pi)) * (5 if action == "walk" else 0)
            if action == "attack" and i >= 2:
                swing = -lunge * 6
            col = sh if i % 2 == 0 else coat
            ax, ay = lx, by + 12
            bx, by2 = lx + swing * 0.8, 90 - lift
            p.poly([(ax - 3, ay), (ax + 3, ay), (bx + 2, by2), (bx - 2, by2)], col)
            if has_socks and f == "human":
                p.rect(bx - 2.2, by2 - 4, bx + 2.2, by2 - 1, (226, 222, 214, 255), ink=False)
            p.rect(bx - 2.4, by2 - 1, bx + 2.4, by2 + 1.6, _c(m["hoof"]))
        # tail
        tail = [(22, by + 2), (10, by + 12 + 3 * math.sin(ph)), (14, by + 22), (22, by + 8)]
        p.poly(tail, _c(m["mane"]) if f != "human" else dk(m["mane"], 0.0))
        # body, neck, head
        p.ell(48, by + 2, 26, 12, coat)
        p.ell(46, by - 2, 20, 5, hi, ink=False)
        if has_barding:
            p.poly([(58, by - 6), (76, by - 2), (72, by + 10), (54, by + 8)], armor_col)
        p.poly([(62, by - 6), (76 + lunge * 6, by - 24 - lunge * 4), (84 + lunge * 6, by - 20 - lunge * 4), (72, by + 4)], coat)
        hx, hy = 82 + lunge * 6, by - 22 - lunge * 4
        if f == "darkelf":
            p.poly([(hx - 8, hy - 6), (hx + 12, hy - 2), (hx + 12, hy + 6), (hx - 6, hy + 8)], coat)
            # antlers of crystal
            p.line(hx - 4, hy - 6, hx - 10, hy - 20, _c(m["mane"]), 2)
            p.line(hx - 7, hy - 14, hx - 1, hy - 18, _c(m["mane"]), 1)
            p.line(hx - 1, hy - 6, hx - 3, hy - 18, _c(m["mane"]), 2)
        elif f == "corrupted":
            p.poly([(hx - 8, hy - 6), (hx + 12, hy - 1), (hx + 12, hy + 8), (hx - 6, hy + 8)], coat)
            p.poly([(hx + 9, hy + 6), (hx + 12, hy + 12), (hx + 6, hy + 8)], _c(m["mane"]), ink=False)
            p.poly([(hx + 4, hy + 7), (hx + 7, hy + 12), (hx + 1, hy + 8)], _c(m["mane"]), ink=False)
            for k in range(4):  # spine ridge
                p.poly([(48 - 12 + k * 9 - 2, by - 12), (48 - 12 + k * 9 + 2, by - 12), (48 - 12 + k * 9, by - 19)],
                       _c(m["mane"]))
        else:
            p.poly([(hx - 8, hy - 6), (hx + 12, hy), (hx + 11, hy + 8), (hx - 6, hy + 8)], coat)
            if has_barding:
                p.poly([(hx - 4, hy - 5), (hx + 10, hy), (hx + 7, hy + 3), (hx - 4, hy + 1)], armor_col, ink=False)
            elif has_blaze:
                p.line(hx + 4, hy - 2, hx + 9, hy + 4, (238, 234, 224, 255), 1)
            p.line(hx - 6, hy - 8, hx - 14, by - 2, _c(m["mane"]), 3)
            p.line(hx - 4, hy - 8, hx - 10, by - 6, _c(m["mane"]), 3)
        p.ell(hx + 1, hy - 1, 1.6, 1.6, _c(m["eye"]), ink=False)
        # near legs
        for i in (0, 2):
            lx, off = legs[i]
            swing = math.sin(ph + off * 2 * math.pi) * (9 if action == "walk" else 2)
            lift = max(0.0, math.cos(ph + off * 2 * math.pi)) * (5 if action == "walk" else 0)
            if action == "attack" and i >= 2:
                swing = -lunge * 6
            ax, ay = lx + 4, by + 12
            bx, by2 = lx + 4 + swing * 0.8, 90 - lift
            p.poly([(ax - 3.5, ay), (ax + 3.5, ay), (bx + 2.4, by2), (bx - 2.4, by2)], coat)
            if has_socks and f == "human":
                p.rect(bx - 2.6, by2 - 4, bx + 2.6, by2 - 1, (226, 222, 214, 255), ink=False)
            p.rect(bx - 3, by2 - 1, bx + 3, by2 + 1.6, _c(m["hoof"]))
        # saddle blanket + trim
        p.rect(36, by - 8, 56, by - 4, blanket_col)
        p.line(37, by - 4, 55, by - 4, _c(FACTIONS[f]["trim"]))
        out = img
        if direction == "left":
            out = img.transpose(Image.FLIP_LEFT_RIGHT)
        sx = int((46 if direction == "right" else 100 - 46) * (S - 1) / 100)
        return out, sx, int((by - 8) * (S - 1) / 100)
    # front / back: head-on or rear view
    bob = 1.4 * abs(math.sin(ph)) if action == "walk" else 0
    by = 52 - bob - lunge * 3
    for i, lx in enumerate((34, 66)):
        swing = math.sin(ph + i * math.pi) * (4 if action == "walk" else 0)
        lift = max(0.0, math.cos(ph + i * math.pi)) * (4 if action == "walk" else 0)
        p.rect(lx - 4 + swing * 0.3, by + 14, lx + 4 + swing * 0.3, 90 - lift, sh if i == 0 else coat)
        p.rect(lx - 5 + swing * 0.3, 88 - lift, lx + 5 + swing * 0.3, 91 - lift, _c(m["hoof"]))
    p.ell(50, by + 10, 24, 16, coat)
    p.ell(50, by + 6, 17, 6, hi, ink=False)
    p.rect(30, by - 4, 70, by, blanket_col)
    if direction == "front":
        hy = by + 2 + lunge * 4
        p.poly([(38, hy - 10), (62, hy - 10), (60, hy + 20), (40, hy + 20)], coat)
        if has_barding:
            p.poly([(40, hy - 8), (60, hy - 8), (56, hy + 14), (44, hy + 14)], armor_col, ink=False)
        elif has_blaze and f == "human":
            p.line(50, hy - 4, 50, hy + 12, (238, 234, 224, 255), 2)
        p.ell(50, hy + 18, 7, 4.5, hi)
        p.pt(46, hy + 19, INK)
        p.pt(54, hy + 19, INK)
        p.ell(43, hy, 1.6, 1.6, _c(m["eye"]), ink=False)
        p.ell(57, hy, 1.6, 1.6, _c(m["eye"]), ink=False)
        if f == "darkelf":
            p.line(40, hy - 8, 34, hy - 24, _c(m["mane"]), 2)
            p.line(60, hy - 8, 66, hy - 24, _c(m["mane"]), 2)
        elif f == "corrupted":
            p.poly([(40, hy - 8), (36, hy - 20), (44, hy - 9)], _c(m["mane"]))
            p.poly([(60, hy - 8), (64, hy - 20), (56, hy - 9)], _c(m["mane"]))
        else:
            p.line(50, hy - 10, 50, hy + 8, _c(m["mane"]), 3)
    else:
        p.poly([(40, by + 6), (60, by + 6), (56, by + 30 + 2 * math.sin(ph)), (44, by + 30 + 2 * math.sin(ph))],
               _c(m["mane"]))
    return img, int(50 * (S - 1) / 100), int((by - 4) * (S - 1) / 100)


class MountSpriteGenerator(SpriteGenerator):
    """Steed frames: horse / nightmare stag / flesh-hound.  ``rider`` is optional."""

    type_name = "mount"
    animated = True
    default_size = (48, 48)

    def _build(self, seed: int, **options) -> Tuple[Dict[str, Any], Image.Image]:
        faction = str(options.get("faction", "human"))
        if faction not in FACTIONS:
            faction = "human"
        direction = str(options.get("direction", "right"))
        action = str(options.get("action", "walk"))
        frames = int(options.get("frames", 8))
        frame = int(options.get("frame", 0)) % max(1, frames)
        S = int(options.get("cell", self.size[0]))
        work_s = max(96, S * 2)
        base, sx, sy = _mount(faction, direction, action, frame, frames, work_s, seed=seed)
        rider = options.get("rider")
        if rider is not None:
            bbox = rider.getbbox()
            if bbox:
                crop = rider.crop((bbox[0], bbox[1], bbox[2], bbox[1] + max(6, int((bbox[3] - bbox[1]) * 0.62))))
                scale = max(2, work_s // 48)
                crop = crop.resize((crop.width * scale, crop.height * scale), Image.NEAREST)
                lean = 0
                if action == "attack" and direction in ("left", "right"):
                    lean = int(math.sin((frame % frames) / frames * math.pi) * 6) * (1 if direction == "right" else -1)
                base.alpha_composite(crop, (max(0, sx - crop.width // 2 + lean), max(0, sy - crop.height + 6)))
        small = base.resize((S, S), Image.NEAREST)
        return dict(faction=faction, direction=direction, action=action, frame=frame), small


# ---------------------------------------------------------------------------
# Siege machines
# ---------------------------------------------------------------------------

def _wheel(p, cx, cy, r, ang, col, rim, spokes=4):
    p.ell(cx, cy, r, r, rim)
    p.ell(cx, cy, r * 0.62, r * 0.62, col, ink=False)
    for k in range(spokes):
        a = ang + k * (2 * math.pi / spokes)
        p.line(cx, cy, cx + math.cos(a) * r * 0.9, cy + math.sin(a) * r * 0.9, rim)
    p.ell(cx, cy, 1.6, 1.6, rim, ink=False)


def _machine(f: str, direction: str, action: str, frame: int, nframes: int, S: int, seed: int = 0) -> Image.Image:
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    p = _Pen(img)
    rng = RNG(derive(seed, "machine", f))
    pal = _seed_palette(f, rng)
    t = (frame % nframes) / float(nframes)
    wood = _c(pal["wood"]) if f != "darkelf" else _c(pal["wall"])
    wood_hi, wood_sh = lt(wood, 0.22), dk(wood, 0.3)
    rim = dk(wood, 0.5) if f != "corrupted" else _c(pal["trim"])
    glow = _c(pal["glow"])
    spokes = rng.choice([4, 6, 8])
    has_mantlet = rng.random() < 0.48
    has_pennant = rng.random() < 0.6
    ammo_kind = rng.choice(["boulder", "firepot", "cluster"])
    p.shadow(50, 88, 34, 5)
    roll = t * 2 * math.pi if action == "walk" else 0.0
    # arm angle: rest -> cocked (attack t<0.5) -> released
    if action == "attack":
        arm = -0.35 + (-1.0 * (t / 0.5) if t < 0.5 else -1.35 + 2.5 * ((t - 0.5) / 0.5))
    else:
        arm = -0.35 + 0.04 * math.sin(roll * 2)
    side = direction in ("left", "right")
    if side:
        # chassis
        p.rect(14, 62, 86, 70, wood)
        p.rect(14, 62, 86, 64, wood_hi, ink=False)
        p.rect(22, 70, 78, 74, wood_sh)
        if has_mantlet:
            p.poly([(78, 46), (86, 48), (88, 68), (78, 68)], _c(pal["trim"]))
            p.line(82, 48, 82, 66, dk(pal["wood"], 0.4))
        # A-frame upright
        p.poly([(40, 62), (46, 24), (54, 24), (60, 62)], wood)
        p.line(50, 26, 50, 62, wood_sh)
        if has_pennant:
            p.line(50, 14, 50, 24, _c(pal["trim"]), 1)
            p.poly([(50, 14), (60, 17), (50, 20)], _c(pal["accent"]))
        pivot = (50, 28)
        L = 40
        # throwing arm
        ex, ey = pivot[0] + math.sin(arm) * L, pivot[1] - math.cos(arm) * L
        bx, by = pivot[0] - math.sin(arm) * L * 0.35, pivot[1] + math.cos(arm) * L * 0.35
        p.line(bx, by, ex, ey, wood_hi if f == "human" else _c(pal["trim"]), 4)
        if f == "human":
            p.poly([(ex - 6, ey - 2), (ex + 6, ey - 2), (ex + 4, ey + 5), (ex - 4, ey + 5)], wood_sh)  # sling bucket
            if action == "attack" and t < 0.5 or action != "attack":
                if ammo_kind == "firepot":
                    p.ell(ex, ey - 3, 3.8, 3.8, (186, 62, 34, 255))
                    p.ell(ex, ey - 6, 2.4, 2.6, (255, 198, 66, 255), ink=False)
                elif ammo_kind == "cluster":
                    p.ell(ex - 2, ey - 2, 2.2, 2.2, (118, 114, 106, 255))
                    p.ell(ex + 2, ey - 2, 2.2, 2.2, (104, 100, 94, 255))
                    p.ell(ex, ey - 4.5, 2.0, 2.0, (132, 128, 120, 255))
                else:
                    p.ell(ex, ey - 3, 3.6, 3.6, (110, 106, 98, 255))  # boulder
            p.rect(bx - 6, by - 2, bx + 6, by + 6, (120, 116, 110, 255))  # counterweight
        elif f == "darkelf":
            # ballista: bow limbs lit with crystal bowstring
            p.line(24, 56, 76, 56, glow, 1)
            p.poly([(18, 48), (30, 56), (18, 62)], _c(pal["accent"]))
            p.poly([(82, 48), (70, 56), (82, 62)], _c(pal["accent"]))
            bolt_x = 24 + 36 * (1 - (t / 0.5 if action == "attack" and t < 0.5 else 0)) if action == "attack" else 60
            p.line(bolt_x, 56, bolt_x + 28, 56, (240, 230, 255, 255), 2)
        else:
            # gore-spitter: tubular sac on bone arm
            p.ell(ex, ey, 7 + (3 if action == "attack" and t < 0.5 else 0), 7, _c(pal["wall"]))
            p.ell(ex, ey, 3, 3, glow, ink=False)
            p.ell(bx, by + 4, 6, 5, dk(pal["wall"], 0.2))
        wr = 10
        _wheel(p, 30, 80, wr, roll, wood, rim, spokes=spokes)
        _wheel(p, 70, 80, wr, roll, wood, rim, spokes=spokes)
        if direction == "left":
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
    else:
        # front/back: foreshortened frame, twin wheels, arm rising
        p.rect(26, 56, 74, 68, wood)
        p.rect(26, 56, 74, 58, wood_hi, ink=False)
        p.rect(30, 68, 70, 72, wood_sh)
        if has_mantlet:
            p.rect(28, 48, 72, 56, _c(pal["trim"]))
        for cx in (22, 78):
            p.rect(cx - 3, 62, cx + 3, 86, rim)
            p.rect(cx - 2, 64, cx + 2, 84, wood, ink=False)
            for k in range(3):
                yy = 66 + ((k * 7 + int(roll * 6)) % 18)
                p.line(cx - 2, yy, cx + 2, yy, rim)
        rise = -arm
        p.rect(46, 22 - rise * 6, 54, 58, wood_hi if f == "human" else _c(pal["trim"]))
        if f == "human":
            p.poly([(40, 18 - rise * 6), (60, 18 - rise * 6), (56, 28 - rise * 6), (44, 28 - rise * 6)], wood_sh)
            bcol = (255, 196, 68, 255) if ammo_kind == "firepot" else (110, 106, 98, 255)
            p.ell(50, 14 - rise * 6, 4, 4, bcol)
            p.rect(42, 50, 58, 58, (120, 116, 110, 255))
        elif f == "darkelf":
            p.line(18, 40, 82, 40, glow, 1)
            p.poly([(14, 34), (26, 40), (14, 46)], _c(pal["accent"]))
            p.poly([(86, 34), (74, 40), (86, 46)], _c(pal["accent"]))
            p.line(50, 22, 50, 40, (240, 230, 255, 255), 2)
        else:
            p.ell(50, 18 - rise * 6, 8, 8, _c(pal["wall"]))
            p.ell(50, 18 - rise * 6, 3, 3, glow, ink=False)
    return img


class MachineSpriteGenerator(SpriteGenerator):
    """Siege engines: human catapult, dark-elf crystal ballista, corrupted gore-spitter."""

    type_name = "machine"
    animated = True
    default_size = (48, 48)

    def _build(self, seed: int, **options) -> Tuple[Dict[str, Any], Image.Image]:
        faction = str(options.get("faction", "human"))
        if faction not in FACTIONS:
            faction = "human"
        direction = str(options.get("direction", "right"))
        action = str(options.get("action", "walk"))
        frames = int(options.get("frames", 8))
        frame = int(options.get("frame", 0)) % max(1, frames)
        S = int(options.get("cell", self.size[0]))
        work_s = max(96, S * 2)
        big = _machine(faction, direction, action, frame, frames, work_s, seed=seed)
        return dict(faction=faction, direction=direction, action=action, frame=frame), big.resize((S, S), Image.NEAREST)
