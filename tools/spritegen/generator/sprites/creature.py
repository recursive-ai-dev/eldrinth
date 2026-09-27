#!/usr/bin/env python3
"""
Deterministic creature generator — cellular-automata silhouettes.
=================================================================

Guide §2: organic variety at 8–32 px without a training set.  A half-canvas
CA is evolved under a Moore neighbourhood and mirrored for bilateral
symmetry.  Survival threshold T and fill density set the visual weight:

    high survival (T=3, dense)  →  blocky golems
    high extinction (T=5, sparse) → skeletal insects / tentacles

The binary mask is then shaded with a discrete SDF (Chamfer distance) so
ink / rim / fill bands follow the silhouette, and a 3-D rig-less walk is
applied via FFD on the outer (green) layer.
"""

from __future__ import annotations

from typing import Any, Dict, Tuple

from .. import color
from ..math.canvas import (
    Canvas, TAG_BODY, TAG_BELLY, TAG_EYE, TAG_ACCENT, TAG_HAIR, TAG_SKIN, TAG_METAL,
)
from ..math.ca import silhouette, evolve, seed_blob, mirror_horizontal, MOORE, VON_NEUMANN
from ..math.sdf import sd_capsule, sd_circle, sd_ellipse, sd_rhombus, sd_round_box, rasterize_sdf
from ..math.palette import named_palette, shade_triplet, cosine_palette, PALETTES
from ..math.pose import DIRECTIONS
from ..pipeline import finalize, options_from
from .base import SpriteGenerator

_ARCHETYPES = ["blob", "slime", "quadruped", "biped", "winged", "tentacle", "golem"]

# density, T, rounds, neighbourhood, extra
_ARCHETYPE = {
    "blob":      {"density": 0.62, "T": 3, "rounds": 3, "eyes": 2, "horns": False, "legs": 0, "nb": "moore"},
    "slime":     {"density": 0.58, "T": 3, "rounds": 4, "eyes": 2, "horns": False, "legs": 0, "nb": "moore"},
    "quadruped": {"density": 0.50, "T": 4, "rounds": 4, "eyes": 2, "horns": True,  "legs": 4, "nb": "moore"},
    "biped":     {"density": 0.46, "T": 4, "rounds": 4, "eyes": 2, "horns": True,  "legs": 2, "nb": "moore"},
    "winged":    {"density": 0.44, "T": 4, "rounds": 4, "eyes": 2, "horns": False, "legs": 2, "nb": "moore"},
    "tentacle":  {"density": 0.48, "T": 4, "rounds": 4, "eyes": 3, "horns": False, "legs": 0, "nb": "moore"},
    "golem":     {"density": 0.70, "T": 3, "rounds": 2, "eyes": 2, "horns": False, "legs": 2, "nb": "moore"},
}

_PALETTE_FOR = {
    "blob": "slime",
    "slime": "slime",
    "quadruped": "dirt",
    "biped": "blood",
    "winged": "magic",
    "tentacle": "water",
    "golem": "stone",
}


def _chamfer(mask) -> Tuple[list, list]:
    """8-way Chamfer distance transform.  Returns (inside_d, outside_d)."""
    h = len(mask)
    w = len(mask[0]) if h else 0
    INF = w + h + 5
    din = [[INF] * w for _ in range(h)]
    dout = [[INF] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if mask[y][x]:
                din[y][x] = 0
            else:
                dout[y][x] = 0
    # forward
    for y in range(h):
        for x in range(w):
            for dx, dy, c in ((-1, 0, 1), (0, -1, 1), (-1, -1, 2), (1, -1, 2)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    din[y][x] = min(din[y][x], din[ny][nx] + c)
                    dout[y][x] = min(dout[y][x], dout[ny][nx] + c)
    # backward
    for y in range(h - 1, -1, -1):
        for x in range(w - 1, -1, -1):
            for dx, dy, c in ((1, 0, 1), (0, 1, 1), (1, 1, 2), (-1, 1, 2)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    din[y][x] = min(din[y][x], din[ny][nx] + c)
                    dout[y][x] = min(dout[y][x], dout[ny][nx] + c)
    return din, dout


class CreatureSpriteGenerator(SpriteGenerator):
    """CA + SDF monster generator (deterministic)."""

    type_name = "creature"
    animated = True

    def _build(self, seed: int, **options) -> Tuple[Dict[str, Any], "Image.Image"]:
        opt = options_from(options)
        direction = opt["direction"] if opt["direction"] in DIRECTIONS else "front"
        frame = opt["frame"] % max(1, opt["frames"])
        action = opt["action"]
        rng = self.rng(seed)

        requested = options.get("archetype")
        archetype = requested if requested in _ARCHETYPES else rng.choice(_ARCHETYPES)
        geom = _ARCHETYPE[archetype]
        requested_palette = options.get("palette")
        pal_name = requested_palette if requested_palette in PALETTES else _PALETTE_FOR[archetype]
        t_base = rng.random()
        t_acc = rng.random()
        base = named_palette(pal_name, t_base)
        # occasional wild hue
        if rng.random() < 0.18:
            base = named_palette(rng.choice(["magic", "lava", "blood", "water", "slime"]), t_base)
        accent = named_palette(pal_name, min(1.0, t_acc + 0.28))
        belly = color.lighten(base, 0.28)
        outline = color.darken(base, 0.55)
        horned = geom["horns"] and rng.random() < 0.72
        spots = rng.randint(3, 7)

        spec = {
            "archetype": archetype,
            "base": color.rgb_to_hex(base),
            "belly": color.rgb_to_hex(belly),
            "accent": color.rgb_to_hex(accent),
            "eyes": geom["eyes"],
            "horned": horned,
            "wings": archetype == "winged",
            "spots": spots,
            "eye_color": color.rgb_to_hex(accent),
            "ca": {"density": geom["density"], "T": geom["T"], "rounds": geom["rounds"]},
            "direction": direction,
            "frame": frame,
            "action": action,
            "palette": pal_name,
            "pipeline": {
                "silhouette": "cellular-automata",
                "symmetry": "bilateral-mirror",
                "material": "chamfer-sdf",
                "palette": "cosine",
                "outline": "inward-1px",
            },
        }

        canvas = self._render(
            seed, rng, archetype, geom, base, belly, outline, accent,
            horned, spots, direction, frame, action,
        )
        canvas = finalize(
            canvas,
            outline=outline,
            quantize=opt["quantize"],
            use_scale2x=opt["use_scale2x"],
            align=opt["align"],
            prune=opt["prune"],
            ffd_frame=frame if frame else None,
            ffd_frames=opt["frames"],
            ffd_amp=0.8 if frame else 0.0,
        )
        return spec, canvas.to_pil()

    def _render(self, seed, rng, archetype, geom, base, belly, outline, accent,
                horned, spots, direction, frame, action="walk") -> Canvas:
        w, h = self.size
        canvas = Canvas(w, h)
        nb = VON_NEUMANN if geom["nb"] == "von" else MOORE
        # side views: don't mirror, use a thinner half
        symmetric = direction in ("front", "back")
        sil = silhouette(
            seed, w=w, h=h,
            density_p=geom["density"],
            threshold=geom["T"],
            rounds=geom["rounds"],
            symmetric=symmetric,
            neighborhood=nb,
        )
        if direction in ("left", "right"):
            # compress x toward a profile by skipping every other empty col on far side
            sil = self._profile(sil, direction)

        din, dout = _chamfer(sil)
        hi, b, sh = shade_triplet(base, 0.30, 0.34)
        bhi, bb, bsh = shade_triplet(belly, 0.22, 0.28)

        # paint body from CA + chamfer bands (guide §4.2 analog at pixel scale)
        cx = w / 2.0
        cy = h / 2.0
        for y in range(h):
            for x in range(w):
                if not sil[y][x]:
                    continue
                d = din[y][x]
                # belly: lower-centre interior
                nx = (x - cx) / (w * 0.5)
                ny = (y - cy) / (h * 0.5)
                is_belly = (nx * nx * 1.6 + (ny - 0.25) * (ny - 0.25) * 0.8) < 0.35 and d >= 2
                if d <= 1:
                    col, tag = sh, TAG_BODY
                elif is_belly:
                    col, tag = (bb if d >= 3 else bhi), TAG_BELLY
                elif d >= 3 and (x + y) % 7 == 0:
                    col, tag = hi, TAG_BODY
                else:
                    col, tag = b, TAG_BODY
                canvas.set(x, y, col, tag)

        # legs (SDF capsules hanging off the silhouette bottom)
        legs = geom["legs"]
        xs = [x for y in range(h) for x in range(w) if sil[y][x]]
        ys = [y for y in range(h) for x in range(w) if sil[y][x]]
        if xs and legs:
            minx, maxx = min(xs), max(xs)
            miny, maxy = min(ys), max(ys)
            foot_y = min(h - 2, maxy + 4)
            if legs == 4:
                positions = [0.18, 0.38, 0.62, 0.82]
            else:
                positions = [0.32, 0.68]
            for i, t in enumerate(positions):
                lx = minx + t * (maxx - minx)
                def _mk(ax, ay, bx, by, r):
                    def sdf(px, py):
                        return sd_capsule(px, py, ax, ay, bx, by, r)
                    return sdf
                # walk-cycle: alternate lift
                lift = 0
                if action == "attack" and frame:
                    lift = -1
                elif frame:
                    phase = (frame + i) % 2
                    lift = -1 if phase == 0 else 1
                rasterize_sdf(
                    canvas, _mk(lx, maxy - 1, lx + (1 if i % 2 else -1), foot_y + lift, 1.15),
                    b, hi, sh, TAG_BODY, ink=None, ink_width=0.4,
                )

        # wings
        if archetype == "winged" and xs:
            minx, maxx = min(xs), max(xs)
            miny, maxy = min(ys), max(ys)
            wy = miny + 2
            wing = color.darken(base, 0.25)
            whi, wb, wsh = shade_triplet(wing, 0.25, 0.3)
            for sign in (-1, 1):
                ax = (minx if sign < 0 else maxx)
                def sdf(px, py, ax=ax, sign=sign, wy=wy):
                    return sd_ellipse(px, py, ax + sign * 5, wy + 2, 5.5, 3.2) * 3.2
                rasterize_sdf(canvas, sdf, wb, whi, wsh, TAG_HAIR)

        # horns (for general archetypes, not biped boss)
        if horned and archetype != "biped" and xs:
            minx, maxx, miny = min(xs), max(xs), min(ys)
            horn = named_palette("sand", 0.75)
            hhi, hb, hsh = shade_triplet(horn, 0.2, 0.3)
            for sign in (-1, 1):
                hx = (minx + maxx) * 0.5 + sign * (maxx - minx) * 0.28
                def sdf(px, py, hx=hx, miny=miny, sign=sign):
                    return sd_capsule(px, py, hx, miny, hx + sign * 1.4, miny - 4.2, 0.85)
                rasterize_sdf(canvas, sdf, hb, hhi, hsh, TAG_METAL)

        # Boss antler-crown (sovereign crown)
        if archetype == "biped" and xs:
            minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
            antler_base = named_palette("bone_relic", 0.75)
            ahi, ab, ash = shade_triplet(antler_base, 0.25, 0.3)
            scale = max(1.0, w / 32.0)
            for sign in (-1, 1):
                ax0 = (minx + maxx) * 0.5 + sign * (maxx - minx) * 0.22
                ay0 = miny + 1
                ax1 = ax0 + sign * (maxx - minx) * 0.32
                ay1 = max(1, miny - int((maxy - miny) * 0.28))
                def sdf_antler1(px, py, ax0=ax0, ay0=ay0, ax1=ax1, ay1=ay1, scale=scale):
                    return sd_capsule(px, py, ax0, ay0, ax1, ay1, 1.1 * scale)
                rasterize_sdf(canvas, sdf_antler1, ab, ahi, ash, TAG_METAL)
                def sdf_tine(px, py, ax1=ax1, ay1=ay1, sign=sign, scale=scale):
                    return sd_capsule(px, py, ax1, ay1, ax1 + sign * 2.2 * scale, ay1 - 3.2 * scale, 0.75 * scale)
                rasterize_sdf(canvas, sdf_tine, ab, ahi, ash, TAG_METAL)

        # Boss ribcage and corrupted heart
        if archetype == "biped" and xs:
            cx_mid = (min(xs) + max(xs)) // 2
            cy_mid = (min(ys) + max(ys)) // 2
            bone_col = named_palette("bone_relic", 0.8)
            scale = max(1.0, w / 32.0)
            if direction != "back":
                rib_y_list = [cy_mid - int(3 * scale), cy_mid, cy_mid + int(3 * scale)]
                rib_w = int(4 * scale)
                for rib_y in rib_y_list:
                    for dx in range(-rib_w, rib_w + 1):
                        if abs(dx) >= int(2 * scale) and canvas.opaque(cx_mid + dx, rib_y):
                            canvas.set(cx_mid + dx, rib_y, bone_col, TAG_METAL)
                heart_col = (245, 45, 65) if action == "attack" and frame in (1, 2) else (175, 25, 42)
                heart_hi = (255, 140, 150) if action == "attack" and frame in (1, 2) else (215, 65, 80)
                hrx = 2.0 * scale
                hry = 2.6 * scale
                def sdf_heart(px, py, cx=cx_mid, cy=cy_mid, rx=hrx, ry=hry):
                    return sd_rhombus(px, py, cx, cy, rx, ry)
                rasterize_sdf(canvas, sdf_heart, heart_col, heart_hi, color.darken(heart_col, 0.4), TAG_ACCENT)
            else:
                spine_h = int(6 * scale)
                for dy in range(-spine_h, spine_h + 1):
                    canvas.set(cx_mid, cy_mid + dy, bone_col, TAG_METAL)

        # Golem stone shoulder plating and ward core
        if archetype == "golem" and xs:
            minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
            cx_mid = (minx + maxx) // 2
            cy_mid = (miny + maxy) // 2
            scale = max(1.0, w / 32.0)
            stone_dark = color.darken(base, 0.35)
            stone_hi = color.lighten(base, 0.25)
            p_y = miny + int((maxy - miny) * 0.25)
            sh_size = 3.0 * scale
            for sign in (-1, 1):
                px_c = cx_mid + sign * int((maxx - minx) * 0.36)
                def sdf_sh(px, py, px_c=px_c, p_y=p_y, s_sz=sh_size):
                    return sd_round_box(px, py, px_c, p_y, s_sz, s_sz, 0.8)
                rasterize_sdf(canvas, sdf_sh, base, stone_hi, stone_dark, TAG_BODY)
            if direction != "back":
                pulse = action == "attack" and frame in (1, 2)
                core_col = (185, 247, 235) if pulse else (55, 195, 190)
                core_hi = (245, 255, 250) if pulse else (185, 247, 235)
                crx = 2.0 * scale
                cry = 2.4 * scale
                def sdf_core(px, py, cx=cx_mid, cy=cy_mid, rx=crx, ry=cry):
                    return sd_rhombus(px, py, cx, cy - 1, rx, ry)
                rasterize_sdf(canvas, sdf_core, core_col, core_hi, color.darken(core_col, 0.4), TAG_ACCENT)
            else:
                for dy in (-2, 0, 2):
                    for dx in (-2, -1, 1, 2):
                        canvas.set(cx_mid + int(dx * scale), cy_mid + int(dy * scale), (25, 22, 28), TAG_METAL)

        # Wraith trailing spectral mist tendrils
        if archetype == "tentacle" and xs:
            minx, maxx, maxy = min(xs), max(xs), max(ys)
            cx_mid = (minx + maxx) // 2
            scale = max(1.0, w / 32.0)
            sway = (-1, 0, 1, 0)[frame % 4]
            for tx_rel, length in ((-5, 6), (-2, 8), (2, 7), (5, 5)):
                tx = cx_mid + int(tx_rel * scale)
                t_len = int(length * scale)
                for step in range(t_len):
                    ty = maxy - 2 + step
                    sw = sway if step > 2 else 0
                    if 0 <= tx + sw < w and 0 <= ty < h:
                        fade = step / float(t_len)
                        col = color.mix(base, (10, 24, 28), fade)
                        canvas.set(tx + sw, ty, col, TAG_BODY)

        # spots
        if xs:
            minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
            for i in range(spots):
                r = self.rng(seed, "spot", i)
                sx = r.randint(minx + 1, max(minx + 1, maxx - 1))
                sy = r.randint(miny + 1, max(miny + 1, maxy - 1))
                if canvas.opaque(sx, sy) and canvas.get_tag(sx, sy) == TAG_BODY:
                    canvas.set(sx, sy, color.mix(base, belly, 0.5), TAG_ACCENT)
                    canvas.set(sx + 1, sy, color.mix(base, belly, 0.35), TAG_ACCENT)

        # eyes (directional, not on back)
        if direction != "back" and xs:
            minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
            ey = miny + max(2, int((maxy - miny) * 0.32))
            if archetype == "tentacle":
                cx_mid = (minx + maxx) // 2
                if direction == "right":
                    canvas.set(cx_mid + 1, ey - 1, (245, 255, 250), TAG_EYE)
                    canvas.set(cx_mid + 3, ey, (185, 245, 235), TAG_EYE)
                elif direction == "left":
                    canvas.set(cx_mid - 3, ey, (185, 245, 235), TAG_EYE)
                    canvas.set(cx_mid - 1, ey - 1, (245, 255, 250), TAG_EYE)
                else:
                    canvas.set(cx_mid - 2, ey, (185, 245, 235), TAG_EYE)
                    canvas.set(cx_mid, ey - 1, (245, 255, 250), TAG_EYE)
                    canvas.set(cx_mid + 2, ey, (185, 245, 235), TAG_EYE)
            else:
                if direction == "right":
                    ex = maxx - 3
                    if 0 <= ex < w:
                        canvas.set(ex, ey, (250, 250, 250), TAG_EYE)
                        canvas.set(ex + 1, ey, accent, TAG_EYE)
                        canvas.set(ex + 1, ey + 1, color.darken(accent, 0.3), TAG_EYE)
                elif direction == "left":
                    ex = minx + 2
                    if 0 <= ex < w:
                        canvas.set(ex + 1, ey, (250, 250, 250), TAG_EYE)
                        canvas.set(ex, ey, accent, TAG_EYE)
                        canvas.set(ex, ey + 1, color.darken(accent, 0.3), TAG_EYE)
                else:
                    n = geom["eyes"]
                    for i in range(n):
                        t = (i + 1) / (n + 1)
                        ex = int(minx + t * (maxx - minx))
                        if canvas.opaque(ex, ey) or canvas.opaque(ex, ey + 1):
                            canvas.set(ex - 1, ey, (250, 250, 250), TAG_EYE)
                            canvas.set(ex, ey, (250, 250, 250), TAG_EYE)
                            canvas.set(ex + 1, ey, (250, 250, 250), TAG_EYE)
                            canvas.set(ex, ey, accent, TAG_EYE)
                            canvas.set(ex, ey + 1, color.darken(accent, 0.3), TAG_EYE)

        # mouth (wider, pale-toothed snarl through the attack impact)
        if xs:
            mx = (min(xs) + max(xs)) // 2
            my = min(h - 3, max(ys) - 2)
            mouth_half = 3 if action == "attack" and frame else 2
            for dx in range(-mouth_half, mouth_half + 1):
                if canvas.opaque(mx + dx, my):
                    canvas.set(mx + dx, my, color.darken(base, 0.5), TAG_BODY)
            for dx in range(-(mouth_half - 1), mouth_half):
                canvas.set(mx + dx, my - 1, (240, 240, 230), TAG_ACCENT)

        # slime drip
        if archetype == "slime" and xs:
            mx = (min(xs) + max(xs)) // 2
            my = max(ys)
            for k in range(3):
                canvas.set(mx + (k % 3) - 1, my + 1 + k // 2, base, TAG_BODY)

        return canvas

    def _profile(self, sil, direction):
        """Squash a front-generated CA into a side silhouette."""
        h = len(sil)
        w = len(sil[0]) if h else 0
        out = [[0] * w for _ in range(h)]
        cx = w // 2
        sign = 1 if direction == "right" else -1
        for y in range(h):
            xs = [x for x in range(w) if sil[y][x]]
            if not xs:
                continue
            width = max(2, int((max(xs) - min(xs) + 1) * 0.45))
            start = cx - width // 2 + sign
            for i in range(width):
                x = start + i
                if 0 <= x < w:
                    out[y][x] = 1
        return out
