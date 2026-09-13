#!/usr/bin/env python3
"""
Deterministic humanoid character generator.
============================================

A 32×32 pixel-art human, fully mathematical:

1. Spec (body, palette, kit) is a pure function of the seed.
2. A 3-D rig is projected into front / side / back (pose imputation).
3. Limbs are SDF capsules; the torso and head are rounded boxes / ellipses.
4. Walk-cycle kinematics + FFD (hair/cloth) give temporally stable frames.
5. Production gate: L-corner prune, 1px inward ink, CoG alignment.

The same seed always yields the same pixels, on any machine.
"""

from __future__ import annotations

from typing import Any, Dict, Tuple

from .. import color
from ..rng import clamp, gaussian
from ..math.canvas import (
    Canvas, TAG_SKIN, TAG_CLOTH, TAG_HAIR, TAG_EYE, TAG_ACCENT, TAG_OUTLINE, TAG_METAL,
)
from ..math.sdf import sd_capsule, sd_ellipse, sd_round_box, sd_circle, rasterize_sdf, op_union
from ..math.palette import named_palette, shade_triplet, cosine_palette, PALETTES
from ..math.pose import Rig, walk_pose, attack_pose, project_point, DIRECTIONS
from ..pipeline import finalize, options_from
from .base import SpriteGenerator

_BODY = {
    "emaciated":         {"bulk": 0.00, "torso_w": 6.0, "shoulder": 0.62, "hip": 0.55, "arm": 0.55, "neck": 3,
                          "head_w": 7.0, "bmi": (13.0, 16.5)},
    "very_thin":         {"bulk": 0.10, "torso_w": 7.0, "shoulder": 0.78, "hip": 0.68, "arm": 0.62, "neck": 3,
                          "head_w": 7.5, "bmi": (16.5, 18.4)},
    "lean_athletic":     {"bulk": 0.34, "torso_w": 8.0, "shoulder": 1.02, "hip": 0.78, "arm": 0.78, "neck": 4,
                          "head_w": 7.5, "bmi": (18.5, 22.9)},
    "muscular_athletic": {"bulk": 0.52, "torso_w": 9.0, "shoulder": 1.25, "hip": 0.80, "arm": 0.95, "neck": 5,
                          "head_w": 7.5, "bmi": (22.5, 28.5)},
    "lean_normal":       {"bulk": 0.30, "torso_w": 8.0, "shoulder": 0.92, "hip": 0.84, "arm": 0.72, "neck": 4,
                          "head_w": 7.5, "bmi": (18.5, 24.0)},
    "average":           {"bulk": 0.45, "torso_w": 8.5, "shoulder": 1.00, "hip": 0.90, "arm": 0.75, "neck": 4,
                          "head_w": 8.0, "bmi": (20.0, 26.5)},
    "stocky":            {"bulk": 0.62, "torso_w": 9.5, "shoulder": 1.18, "hip": 1.00, "arm": 0.85, "neck": 5,
                          "head_w": 8.0, "bmi": (24.0, 30.0)},
    "overweight":        {"bulk": 0.74, "torso_w": 10.5, "shoulder": 1.06, "hip": 1.16, "arm": 0.88, "neck": 4,
                          "head_w": 8.0, "bmi": (27.0, 33.0)},
    "obese":             {"bulk": 0.92, "torso_w": 11.5, "shoulder": 1.00, "hip": 1.40, "arm": 0.92, "neck": 4,
                          "head_w": 8.5, "bmi": (33.0, 40.0)},
}

_HEIGHT_LEVELS = {
    "very_short": {"scale": 0.86, "inches": (57, 63)},
    "short":      {"scale": 0.93, "inches": (63, 66)},
    "average":    {"scale": 1.00, "inches": (66, 71)},
    "tall":       {"scale": 1.07, "inches": (71, 74)},
    "very_tall":  {"scale": 1.13, "inches": (74, 78)},
}

_AGE_RANGES = [
    ("teenager",    0.14, 13, 19),
    ("young_adult", 0.33, 20, 34),
    ("middle_aged", 0.34, 35, 54),
    ("older_adult", 0.15, 55, 69),
    ("elderly",     0.04, 70, 85),
]

_CLASSES = ["poor", "working", "middle", "upper", "rich"]


def _hex(rgb) -> str:
    return color.rgb_to_hex(rgb)


class HumanSpriteGenerator(SpriteGenerator):
    """Pixel-art humanoid (deterministic, multi-view, walk-cycle capable)."""

    type_name = "human"
    animated = True

    def _build(self, seed: int, **options) -> Tuple[Dict[str, Any], "Image.Image"]:
        opt = options_from(options)
        direction = opt["direction"] if opt["direction"] in DIRECTIONS else "front"
        frame = opt["frame"] % max(1, opt["frames"])
        action = opt["action"]
        role = options.get("role")

        rng = self.rng(seed)
        gender = rng.choice(["male", "female"])
        social_class = rng.choice(_CLASSES)
        age_category, actual_age = self._pick_age(rng)
        height, body_type, metrics, layout = self._body_layout(
            rng, gender, social_class, age_category, actual_age
        )

        # Continuous cosine palettes — unbounded colour space, still pure.
        skin_t = rng.random()
        hair_t = rng.random()
        cloth_t = rng.random()
        cloth2_t = rng.random()
        eye_t = rng.random()
        # skin uses the dedicated ramp; a slight hue jitter via a second palette
        skin = named_palette("skin", skin_t)
        if rng.random() < 0.08:
            # rare cool / olive shift
            skin = cosine_palette(
                skin_t,
                (0.40, 0.34, 0.26), (0.22, 0.18, 0.12),
                (0.90, 0.80, 0.70), (0.08, 0.12, 0.18),
            )
        hair = named_palette("hair", hair_t)
        if rng.random() < 0.12:
            hair = named_palette("magic", hair_t)  # fantasy dyes
        palette_name = options.get("palette")
        if palette_name not in PALETTES:
            palette_name = "cloth"
        top = named_palette(palette_name, cloth_t)
        bottom = named_palette(palette_name, cloth2_t)
        eye = cosine_palette(
            eye_t,
            (0.25, 0.28, 0.22), (0.25, 0.30, 0.35),
            (1.0, 1.1, 0.9), (0.05, 0.40, 0.70),
        )

        hair_style = self._pick_hair_style(rng, gender, social_class, age_category)
        top_style, bottom_style = self._pick_outfit(rng, gender, social_class)
        has_glasses = rng.random() < 0.22
        has_jewelry = rng.random() < (0.12 if social_class in ("poor", "working") else 0.62)
        has_hat = rng.random() < 0.10
        facial_hair = None
        if gender == "male" and age_category in ("young_adult", "middle_aged", "older_adult", "elderly"):
            if rng.random() < 0.35:
                facial_hair = rng.choice(["mustache", "goatee", "full_beard", "stubble"])

        spec = {
            "gender": gender,
            "social_class": social_class,
            "age_category": age_category,
            "age": actual_age,
            "height_category": height,
            "height_inches": round(metrics["height_inches"], 2),
            "height_display": metrics["height_display"],
            "weight_lbs": metrics["weight_pounds"],
            "bmi": round(metrics["bmi"], 1),
            "body_type": body_type,
            "body_fat": round(metrics["body_fat"], 3),
            "muscle": round(metrics["muscle"], 3),
            "skin": _hex(skin),
            "hair": _hex(hair),
            "hair_style": hair_style,
            "eye": _hex(eye),
            "clothing": {
                "top": _hex(top),
                "bottom": _hex(bottom),
                "top_style": top_style,
                "bottom_style": bottom_style,
            },
            "has_glasses": has_glasses,
            "has_jewelry": has_jewelry,
            "has_hat": has_hat,
            "facial_hair": facial_hair,
            "direction": direction,
            "frame": frame,
            "action": action,
            "role": role,
            "palette": palette_name,
            "pipeline": {
                "pose": "3d-rig-projection",
                "fill": "sdf-capsule",
                "palette": "cosine",
                "outline": "inward-1px",
                "align": "center-of-gravity",
            },
            "build": {
                "torso_w": round(layout["torso_w"], 2),
                "shoulder": round(layout["shoulder"], 2),
                "hip": round(layout["hip"], 2),
                "leg_len": layout["leg_len"],
                "head_w": round(layout["head_w"], 2),
            },
        }

        canvas = self._render(
            seed, layout, skin, hair, eye, top, bottom,
            top_style, bottom_style, hair_style, facial_hair,
            has_glasses, has_jewelry, has_hat, gender, direction, frame,
            opt["frames"], action, role,
        )
        outline = color.darken(skin, 0.55)
        canvas = finalize(
            canvas,
            outline=outline,
            quantize=opt["quantize"],
            use_scale2x=opt["use_scale2x"],
            scale=1,
            align=opt["align"],
            prune=opt["prune"],
            ffd_frame=frame if frame else None,
            ffd_frames=opt["frames"],
            ffd_amp=0.6 if frame else 0.0,
        )
        return spec, canvas.to_pil()

    # -- attribute pickers -------------------------------------------------
    def _pick_age(self, rng):
        total = sum(w for _, w, _, _ in _AGE_RANGES)
        r = rng.random() * total
        acc = 0.0
        for cat, w, lo, hi in _AGE_RANGES:
            acc += w
            if r <= acc:
                return cat, rng.randint(lo, hi)
        return "young_adult", rng.randint(20, 34)

    def _pick_hair_style(self, rng, gender, social_class, age_category):
        male = ["buzzcut", "crew", "short", "side_part", "messy", "slick", "bald", "mohawk"]
        female = ["long", "bob", "ponytail", "bangs", "curly", "braid", "bun", "short"]
        if social_class in ("upper", "rich"):
            male = ["slick", "side_part", "short", "pompadour"]
            female = ["bob", "ponytail", "braid", "long"]
        elif social_class == "poor":
            male = ["messy", "buzzcut", "crew", "bald"]
            female = ["ponytail", "short", "messy", "braid"]
        if age_category == "elderly":
            male = male + ["bald", "grey_short"]
            female = female + ["grey_bun", "grey_short"]
        return rng.choice(male if gender == "male" else female)

    def _pick_outfit(self, rng, gender, social_class):
        if gender == "male":
            top = rng.choice(["tshirt", "shirt", "polo", "suit", "tank", "hoodie", "sweater", "jacket"])
            bottom = rng.choice(["jeans", "pants", "slacks", "shorts", "cargo"])
        else:
            top = rng.choice(["tshirt", "blouse", "dress", "cardigan", "sweater", "tank", "jacket", "top"])
            bottom = rng.choice(["jeans", "pants", "slacks", "shorts", "leggings", "skirt"])
        if social_class in ("upper", "rich") and rng.random() < 0.4:
            top = "suit" if gender == "male" else rng.choice(["blouse", "dress", "jacket"])
        return top, bottom

    def _body_layout(self, rng, gender, social_class, age_category, actual_age):
        heights = list(_HEIGHT_LEVELS.items())
        weights = [1.0, 1.6, 3.6, 1.0, 0.35] if gender == "male" else [1.2, 2.2, 3.4, 0.7, 0.2]
        height = rng.weighted_choice([(name, w) for (name, _), w in zip(heights, weights)])
        level = _HEIGHT_LEVELS[height]
        inch_lo, inch_hi = level["inches"]
        height_inches = rng.uniform(inch_lo, inch_hi)

        body_names = list(_BODY.keys())
        base_w = [0.05, 0.10, 0.14, 0.10, 0.20, 0.24, 0.08, 0.06, 0.03]
        if age_category == "elderly":
            base_w = [0.16, 0.18, 0.06, 0.02, 0.14, 0.20, 0.05, 0.12, 0.07]
        elif age_category == "teenager":
            base_w = [0.06, 0.14, 0.16, 0.05, 0.24, 0.22, 0.02, 0.07, 0.04]
        elif age_category == "middle_aged":
            base_w = [0.03, 0.08, 0.10, 0.08, 0.18, 0.26, 0.10, 0.11, 0.06]
        if social_class in ("upper", "rich"):
            base_w = [b * 0.7 if i < 2 else b for i, b in enumerate(base_w)]
            base_w[3] += 0.04
            base_w[4] += 0.06
        elif social_class == "poor":
            base_w[0] += 0.04
            base_w[8] += 0.03
        total = sum(base_w)
        body_type = rng.weighted_choice([(name, w / total) for name, w in zip(body_names, base_w)])
        bp = _BODY[body_type]

        bmi_lo, bmi_hi = bp["bmi"]
        bmi = rng.uniform(bmi_lo, bmi_hi)
        weight_pounds = int(round((bmi * height_inches ** 2) / 703.0))
        weight_pounds = clamp(weight_pounds, 70, 550)
        muscle = bp["bulk"] * 0.7 + rng.uniform(0.0, 0.2)
        body_fat = 0.05 + (0.42 * (weight_pounds / 300.0)) * (1 + bmi / 60)
        feet = int(height_inches // 12)
        rem = int(round(height_inches % 12))

        scale = level["scale"]
        head_h = 8
        head_w = int(round(bp["head_w"]))
        torso_w = min(9.2, bp["torso_w"])
        torso_h = int(round(clamp(9 + (1 - scale) * 3, 8, 11)))
        leg_len = int(round(clamp(8 + (scale - 1.0) * 8, 7, 11)))
        arm_r = 1.25 + bp["arm"] * 0.45

        top_margin = 2
        head_top = top_margin
        head_bottom = head_top + head_h - 1
        neck_y = head_bottom + 1
        shoulder_y = neck_y + 1
        torso_bottom = shoulder_y + torso_h - 1
        hip_y = torso_bottom + 0.5
        knee_y = hip_y + leg_len * 0.48
        foot_y = min(self.size[1] - 2.2, hip_y + leg_len)

        layout = {
            "center": self.size[0] / 2.0,
            "head_w": head_w,
            "head_h": head_h,
            "head_top": head_top,
            "head_bottom": head_bottom,
            "neck_y": neck_y,
            "shoulder_y": shoulder_y,
            "torso_bottom": torso_bottom,
            "torso_w": torso_w,
            "torso_h": torso_h,
            "shoulder": bp["shoulder"],
            "hip": bp["hip"],
            "hip_y": hip_y,
            "knee_y": knee_y,
            "foot_y": foot_y,
            "leg_len": leg_len,
            "arm_r": arm_r,
            "depth": 2.6 + bp["bulk"] * 1.4,
        }
        metrics = {
            "height_inches": height_inches,
            "height_display": f"{feet}'{rem}\"",
            "weight_pounds": weight_pounds,
            "bmi": bmi,
            "body_fat": body_fat,
            "muscle": muscle,
        }
        return height, body_type, metrics, layout

    # -- rig ---------------------------------------------------------------
    def _make_rig(self, layout) -> Rig:
        r = Rig()
        hw = layout["head_w"] * 0.5
        tw = layout["torso_w"] * 0.5
        sw = tw * layout["shoulder"]
        hpw = tw * layout["hip"] * 0.85
        head_cy = (layout["head_top"] + layout["head_bottom"]) * 0.5
        r.add("head", 0.0, head_cy, 0.2)
        r.add("neck", 0.0, layout["neck_y"], 0.1)
        r.add("shoulder_l", -sw, layout["shoulder_y"], 0.9)
        r.add("shoulder_r",  sw, layout["shoulder_y"], -0.4)
        r.add("elbow_l", -sw - 0.6, layout["shoulder_y"] + layout["torso_h"] * 0.45, 1.0)
        r.add("elbow_r",  sw + 0.6, layout["shoulder_y"] + layout["torso_h"] * 0.45, -0.5)
        r.add("hand_l", -sw - 0.4, layout["torso_bottom"] + 1.2, 1.2)
        r.add("hand_r",  sw + 0.4, layout["torso_bottom"] + 1.2, -0.3)
        r.add("torso", 0.0, (layout["shoulder_y"] + layout["torso_bottom"]) * 0.5, 0.0)
        r.add("hip", 0.0, layout["hip_y"], 0.0)
        r.add("hip_l", -hpw, layout["hip_y"], 1.1)
        r.add("hip_r",  hpw, layout["hip_y"], -1.1)
        r.add("knee_l", -hpw, layout["knee_y"], 1.3)
        r.add("knee_r",  hpw, layout["knee_y"], -1.3)
        r.add("foot_l", -hpw - 0.4, layout["foot_y"], 1.6)
        r.add("foot_r",  hpw + 0.4, layout["foot_y"], -1.6)
        r.add("nose", 0.0, head_cy + 1.2, 1.8)
        r.add("eye_l", -1.8, layout["head_top"] + 3.2, 1.4)
        r.add("eye_r",  1.8, layout["head_top"] + 3.2, 1.4)
        return r

    def _pj(self, rig: Rig, name: str, direction: str, cx: float):
        return rig.project(name, direction, cx)

    # -- render ------------------------------------------------------------
    def _render(
        self, seed, layout, skin, hair, eye, top, bottom,
        top_style, bottom_style, hair_style, facial_hair,
        has_glasses, has_jewelry, has_hat, gender, direction, frame, nframes,
        action="walk", role=None,
    ) -> Canvas:
        w, h = self.size
        canvas = Canvas(w, h)
        cx = layout["center"]
        base_rig = self._make_rig(layout)
        rig = (attack_pose(base_rig, frame, nframes, facing=direction)
               if action == "attack" else
               walk_pose(base_rig, frame, nframes, facing=direction))

        skin_hi, skin_b, skin_sh = shade_triplet(skin, 0.26, 0.30)
        top_hi, top_b, top_sh = shade_triplet(top, 0.24, 0.32)
        bot_hi, bot_b, bot_sh = shade_triplet(bottom, 0.22, 0.34)
        hair_hi, hair_b, hair_sh = shade_triplet(hair, 0.30, 0.35)
        ink_skin = color.darken(skin, 0.50)
        shoe = color.darken(bottom, 0.55)

        side = direction in ("left", "right")
        back = direction == "back"

        def cap(ax, ay, bx, by, r, fill, hi, sh, tag, ink=None):
            def sdf(px, py):
                return sd_capsule(px, py, ax, ay, bx, by, r)
            rasterize_sdf(canvas, sdf, fill, hi, sh, tag, ink=ink, ink_width=0.55)

        def ell(cx_, cy_, rx, ry, fill, hi, sh, tag, ink=None):
            def sdf(px, py):
                # convert ellipse sdf (normalised) to pixel units roughly
                return sd_ellipse(px, py, cx_, cy_, rx, ry) * min(rx, ry)
            rasterize_sdf(canvas, sdf, fill, hi, sh, tag, ink=ink, ink_width=0.55)

        def rbox(cx_, cy_, hx, hy, rad, fill, hi, sh, tag, ink=None):
            def sdf(px, py):
                return sd_round_box(px, py, cx_, cy_, hx, hy, rad)
            rasterize_sdf(canvas, sdf, fill, hi, sh, tag, ink=ink, ink_width=0.55)

        # projected joints
        def P(name):
            return self._pj(rig, name, direction, cx)

        sl = P("shoulder_l"); sr = P("shoulder_r")
        el = P("elbow_l"); er = P("elbow_r")
        hl = P("hand_l"); hr = P("hand_r")
        hpl = P("hip_l"); hpr = P("hip_r")
        kl = P("knee_l"); kr = P("knee_r")
        fl = P("foot_l"); fr = P("foot_r")
        hd = P("head"); ts = P("torso"); hp = P("hip")

        arm_r = max(1.35, layout["arm_r"])
        leg_r = 1.55 + layout["hip"] * 0.20
        torso_hx = (layout["torso_w"] * 0.38) if not side else max(3.4, layout["depth"] * 0.85)
        torso_hy = layout["torso_h"] * 0.52

        # painter: far limb first
        left_first = sl[2] < sr[2]

        def draw_arm(s, e, hand, is_skin_lower=True):
            cap(s[0], s[1], e[0], e[1], arm_r, top_b, top_hi, top_sh, TAG_CLOTH)
            cap(e[0], e[1], hand[0], hand[1], arm_r * 0.85, skin_b, skin_hi, skin_sh, TAG_SKIN)

        def draw_leg(h_, k, f, dress=False):
            if dress:
                cap(h_[0], h_[1], f[0], f[1], leg_r * 0.9, skin_b, skin_hi, skin_sh, TAG_SKIN)
            elif bottom_style in ("shorts", "skirt"):
                midy = (h_[1] + k[1]) * 0.5
                cap(h_[0], h_[1], h_[0] * 0.2 + k[0] * 0.8, midy + 1.0, leg_r, bot_b, bot_hi, bot_sh, TAG_CLOTH)
                cap(k[0], k[1], f[0], f[1], leg_r * 0.85, skin_b, skin_hi, skin_sh, TAG_SKIN)
            else:
                cap(h_[0], h_[1], k[0], k[1], leg_r, bot_b, bot_hi, bot_sh, TAG_CLOTH)
                cap(k[0], k[1], f[0], f[1], leg_r * 0.92, bot_b, bot_hi, bot_sh, TAG_CLOTH)
            # shoe
            rbox(f[0], f[1] + 0.4, 1.8 if not side else 2.2, 0.9, 0.4, shoe, color.lighten(shoe, 0.2), color.darken(shoe, 0.2), TAG_METAL)

        dress = top_style == "dress"

        # FAR limbs
        if left_first:
            draw_arm(sl, el, hl)
            draw_leg(hpl, kl, fl, dress)
        else:
            draw_arm(sr, er, hr)
            draw_leg(hpr, kr, fr, dress)

        # torso — extend to the hips so legs never float
        fill_top = top_b
        rbox(ts[0], (ts[1] + hp[1]) * 0.5, torso_hx, max(torso_hy, abs(hp[1] - ts[1]) * 0.55 + 1.2),
             1.4, fill_top, top_hi, top_sh, TAG_CLOTH)
        if dress:
            # skirt / dress drape
            rbox(hp[0], hp[1] + 2.2, torso_hx + 1.2, 3.6, 1.4, fill_top, top_hi, top_sh, TAG_CLOTH)

        # belt
        if top_style in ("shirt", "suit", "jacket", "hoodie") and not dress:
            rbox(hp[0], hp[1] - 0.6, torso_hx * 0.95, 0.55, 0.2,
                 color.darken(bottom, 0.2), bot_hi, bot_sh, TAG_ACCENT)

        # suit lapels
        if top_style == "suit" and not side:
            rbox(ts[0] - torso_hx * 0.55, ts[1] - torso_hy * 0.35, 0.7, 2.2, 0.2,
                 color.darken(top, 0.25), top_hi, top_sh, TAG_CLOTH)
            rbox(ts[0] + torso_hx * 0.55, ts[1] - torso_hy * 0.35, 0.7, 2.2, 0.2,
                 color.darken(top, 0.25), top_hi, top_sh, TAG_CLOTH)

        # neck
        nk = P("neck")
        cap(hd[0], hd[1] + layout["head_h"] * 0.35, nk[0], nk[1] + 0.8, 1.05, skin_b, skin_hi, skin_sh, TAG_SKIN)

        # NEAR limbs
        if left_first:
            draw_arm(sr, er, hr)
            if not dress:
                draw_leg(hpr, kr, fr, False)
        else:
            draw_arm(sl, el, hl)
            if not dress:
                draw_leg(hpl, kl, fl, False)

        # head
        hx = (layout["head_w"] * 0.48) if not side else (layout["head_w"] * 0.46)
        hy = layout["head_h"] * 0.48
        ell(hd[0], hd[1], hx, hy, skin_b, skin_hi, skin_sh, TAG_SKIN)

        # hair
        self._hair(canvas, hd, hx, hy, hair_b, hair_hi, hair_sh, hair_style, direction, side, back)

        # face (not on back)
        if not back:
            self._face(canvas, rig, direction, cx, skin_b, eye, facial_hair, hair_b, gender, side)

        if has_glasses and not back:
            self._glasses(canvas, rig, direction, cx)
        if has_hat:
            self._hat(canvas, hd, hx, hair_style)
        if has_jewelry and not back:
            self._jewelry(canvas, nk, hd, gender)

        if role in ("player", "adept"):
            self._weapon(canvas, hr, direction, action, frame, role)

        return canvas

    def _weapon(self, canvas, hand, direction, action, frame, role):
        """Add the silhouette-defining sword or ritual staff to a combatant."""
        hx, hy = hand[0], hand[1]
        impact = action == "attack" and frame in (1, 2)
        sign = -1 if direction == "left" else 1
        if role == "adept":
            shaft = named_palette("rusted_stone", 0.55)
            glow = named_palette("cult_blood", 0.82)
            tx = hx + (sign * 7 if impact and direction in ("left", "right") else sign * 2)
            ty = hy - (2 if impact else 8)
            rasterize_sdf(canvas, lambda px, py: sd_capsule(px, py, hx, hy + 6, tx, ty, 0.8),
                          shaft, color.lighten(shaft, 0.2), color.darken(shaft, 0.3), TAG_METAL)
            rasterize_sdf(canvas, lambda px, py: sd_circle(px, py, tx, ty, 2.0),
                          glow, color.lighten(glow, 0.35), color.darken(glow, 0.25), TAG_ACCENT)
            return

        steel = named_palette("grim_steel", 0.78)
        blood = named_palette("cult_blood", 0.62)
        if direction in ("left", "right"):
            tx, ty = hx + sign * (9 if impact else 6), hy - (1 if impact else 6)
        else:
            swing = (5 if impact else 2) * (-1 if direction == "back" else 1)
            tx, ty = hx + swing, hy - (8 if not impact else 3)
        rasterize_sdf(canvas, lambda px, py: sd_capsule(px, py, hx, hy, tx, ty, 0.9),
                      steel, color.lighten(steel, 0.38), color.darken(steel, 0.28), TAG_METAL)
        # A dark red crossguard makes the tiny weapon readable at native scale.
        gx, gy = hx, hy
        rasterize_sdf(canvas, lambda px, py: sd_capsule(px, py, gx - 2, gy, gx + 2, gy, 0.65),
                      blood, color.lighten(blood, 0.2), color.darken(blood, 0.3), TAG_ACCENT)

    def _hair(self, canvas, hd, hx, hy, hair_b, hair_hi, hair_sh, style, direction, side, back):
        cx, cy = hd[0], hd[1]
        ink = color.darken(hair_b, 0.4)

        def ell(cx_, cy_, rx, ry):
            def sdf(px, py):
                return sd_ellipse(px, py, cx_, cy_, rx, ry) * min(rx, ry)
            rasterize_sdf(canvas, sdf, hair_b, hair_hi, hair_sh, TAG_HAIR, ink=ink, ink_width=0.4)

        def cap(ax, ay, bx, by, r):
            def sdf(px, py):
                return sd_capsule(px, py, ax, ay, bx, by, r)
            rasterize_sdf(canvas, sdf, hair_b, hair_hi, hair_sh, TAG_HAIR, ink=ink, ink_width=0.4)

        if style in ("bald",):
            return
        # cap
        ell(cx, cy - hy * 0.45, hx * 1.05, hy * 0.7)
        if style in ("buzzcut", "crew", "grey_short", "short"):
            return
        if style == "mohawk":
            cap(cx, cy - hy - 1.5, cx, cy - hy * 0.2, 1.1)
            return
        if style in ("slick", "side_part", "pompadour"):
            ell(cx + (0.8 if not side else 0.3), cy - hy * 0.6, hx * 0.9, hy * 0.55)
            return
        if style == "bun" or style == "grey_bun":
            ell(cx, cy - hy - 1.4, 2.0, 1.7)
            return
        # long / bob / ponytail / curly / braid / bangs / messy
        if style in ("long", "curly", "braid", "bob", "ponytail", "bangs", "messy"):
            if not side:
                cap(cx - hx * 0.95, cy, cx - hx * 1.05, cy + hy + (5 if style != "bob" else 1.5), 1.2)
                cap(cx + hx * 0.95, cy, cx + hx * 1.05, cy + hy + (5 if style != "bob" else 1.5), 1.2)
            else:
                cap(cx - (1.2 if direction == "left" else -1.2), cy, cx - (1.4 if direction == "left" else -1.4),
                    cy + hy + 4, 1.3)
            if style == "ponytail":
                ox = 0 if not back else 0
                cap(cx + (hx if not side else 0), cy - hy * 0.2,
                    cx + (hx + 2 if not side else 0), cy + hy + 4, 1.15)
            if style == "bangs":
                cap(cx - hx * 0.7, cy - hy * 0.1, cx + hx * 0.7, cy - hy * 0.05, 0.7)
            if style == "curly":
                ell(cx - hx, cy + 1, 1.6, 1.6)
                ell(cx + hx, cy + 1, 1.6, 1.6)

    def _face(self, canvas, rig, direction, cx, skin, eye, facial_hair, hair, gender, side):
        el = rig.project("eye_l", direction, cx)
        er = rig.project("eye_r", direction, cx)
        ns = rig.project("nose", direction, cx)
        white = (245, 245, 245)
        # only draw an eye if it faces the camera (positive depth)
        eyes = []
        if side:
            # the eye with greater depth
            pick = el if el[2] >= er[2] else er
            if pick[2] > 0.2:
                eyes.append(pick)
        else:
            eyes = [el, er]
        for ex, ey, _d in eyes:
            ix, iy = int(round(ex)), int(round(ey))
            canvas.set(ix - 1, iy, white, TAG_EYE)
            canvas.set(ix, iy, white, TAG_EYE)
            canvas.set(ix + 1, iy, white, TAG_EYE)
            canvas.set(ix, iy, eye, TAG_EYE)
            canvas.set(ix, iy + 1, color.darken(eye, 0.25), TAG_EYE)
        if side:
            canvas.set(int(round(ns[0])), int(round(ns[1])), color.darken(skin, 0.18), TAG_SKIN)
        # mouth
        mx = int(round((el[0] + er[0]) * 0.5)) if not side else int(round(ns[0] - (0.6 if direction == "right" else -0.6)))
        my = int(round(el[1] + 3.2))
        mouth = color.darken(skin, 0.40)
        canvas.set(mx, my, mouth, TAG_SKIN)
        canvas.set(mx - 1, my, mouth, TAG_SKIN)
        canvas.set(mx + 1, my, mouth, TAG_SKIN)
        if facial_hair:
            c = color.darken(hair, 0.08)
            if facial_hair == "mustache":
                for dx in range(-2, 3):
                    canvas.set(mx + dx, my - 1, c, TAG_HAIR)
            elif facial_hair == "goatee":
                for dy in range(0, 3):
                    canvas.set(mx, my + dy, c, TAG_HAIR)
                    canvas.set(mx - 1, my + dy, c, TAG_HAIR)
                    canvas.set(mx + 1, my + dy, c, TAG_HAIR)
            elif facial_hair == "full_beard":
                for dy in range(0, 3):
                    for dx in range(-3, 4):
                        canvas.set(mx + dx, my + dy, c, TAG_HAIR)
            elif facial_hair == "stubble":
                for dx in range(-3, 4, 2):
                    canvas.set(mx + dx, my + 1, c, TAG_HAIR)

    def _glasses(self, canvas, rig, direction, cx):
        el = rig.project("eye_l", direction, cx)
        er = rig.project("eye_r", direction, cx)
        frame = (28, 28, 32)
        if direction in ("left", "right"):
            pick = el if el[2] >= er[2] else er
            x, y = int(round(pick[0])), int(round(pick[1]))
            for dx in range(-2, 3):
                canvas.set(x + dx, y - 1, frame, TAG_METAL)
                canvas.set(x + dx, y + 1, frame, TAG_METAL)
            canvas.set(x - 2, y, frame, TAG_METAL)
            canvas.set(x + 2, y, frame, TAG_METAL)
            return
        y = int(round(el[1]))
        for x in range(int(round(el[0])) - 2, int(round(er[0])) + 3):
            canvas.set(x, y - 1, frame, TAG_METAL)
        canvas.set(int(round(el[0])) - 2, y, frame, TAG_METAL)
        canvas.set(int(round(er[0])) + 2, y, frame, TAG_METAL)
        canvas.set(int(round((el[0] + er[0]) * 0.5)), y, frame, TAG_METAL)

    def _hat(self, canvas, hd, hx, style):
        hat = (72, 48, 32)
        hi, b, sh = shade_triplet(hat, 0.2, 0.3)
        def sdf(px, py):
            return sd_round_box(px, py, hd[0], hd[1] - 4.2, hx + 1.4, 1.3, 0.4)
        rasterize_sdf(canvas, sdf, b, hi, sh, TAG_CLOTH)

    def _jewelry(self, canvas, nk, hd, gender):
        gold = named_palette("metal", 0.72)
        if gender == "female":
            canvas.set(int(round(hd[0] - 3.4)), int(round(hd[1] + 1)), gold, TAG_ACCENT)
            canvas.set(int(round(hd[0] + 3.4)), int(round(hd[1] + 1)), gold, TAG_ACCENT)
            canvas.set(int(round(nk[0])), int(round(nk[1] + 2)), gold, TAG_ACCENT)
        else:
            canvas.set(int(round(nk[0])), int(round(nk[1] + 2)), gold, TAG_ACCENT)
