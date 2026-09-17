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
from ..math.sdf import sd_capsule, sd_ellipse, sd_round_box, sd_circle, rasterize_sdf, op_union, sd_rhombus
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


NPC_ROLES = {
    "orithel-the-last-watcher",
    "scribe-althea",
    "sister-mirene",
    "barris-the-smith",
    "kiln-master-vance",
    "cinder-nurse-greta",
    "elodie-outrunner",
    "mistress-morveth",
    "sister-lyra",
    "kieran-blind-oar",
    "reeve-toran",
    "hermit-cassian",
    "mina-drift-child",
}


def normalize_role(role: str | None) -> str | None:
    if not role:
        return None
    r = role.lower().strip()
    if r.startswith("npc."):
        r = r[4:]
    return r


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

        norm_role = normalize_role(role)
        if norm_role == "orithel-the-last-watcher":
            gender = "female"
            skin = (186, 245, 238)
            hair = (235, 250, 248)
            hair_style = "long"
            top = (24, 75, 82)
            bottom = (18, 55, 62)
            has_glasses = False
            has_hat = False
            has_jewelry = True
            facial_hair = None
        elif norm_role == "scribe-althea":
            gender = "female"
            age_category = "older_adult"
            actual_age = 58
            hair = (210, 214, 220)
            hair_style = "bun"
            top = (181, 132, 52)
            bottom = (138, 97, 34)
            has_glasses = True
            has_hat = False
            facial_hair = None
        elif norm_role == "sister-mirene":
            gender = "female"
            hair = (45, 40, 42)
            top = (38, 79, 67)
            bottom = (26, 56, 47)
            skin = (232, 215, 200)
            has_hat = False
            facial_hair = None
        elif norm_role == "barris-the-smith":
            gender = "male"
            age_category = "middle_aged"
            hair = (140, 144, 150)
            facial_hair = "full_beard"
            top = (92, 58, 36)
            bottom = (48, 38, 32)
            has_hat = False
        elif norm_role == "kiln-master-vance":
            gender = "male"
            top = (45, 45, 48)
            bottom = (32, 30, 34)
            has_hat = False
        elif norm_role == "cinder-nurse-greta":
            gender = "female"
            hair = (40, 32, 28)
            hair_style = "curly"
            top = (145, 52, 42)
            bottom = (180, 175, 165)
            facial_hair = None
        elif norm_role == "elodie-outrunner":
            gender = "female"
            hair = (45, 35, 30)
            hair_style = "ponytail"
            top = (135, 42, 48)
            bottom = (60, 55, 52)
            facial_hair = None
        elif norm_role == "mistress-morveth":
            gender = "female"
            hair = (235, 235, 240)
            hair_style = "braid"
            top = (32, 44, 54)
            bottom = (24, 32, 40)
            facial_hair = None
        elif norm_role == "sister-lyra":
            gender = "female"
            hair_style = "buzzcut"
            top = (42, 88, 64)
            bottom = (30, 65, 48)
            facial_hair = None
        elif norm_role == "kieran-blind-oar":
            gender = "male"
            hair = (110, 105, 100)
            facial_hair = "stubble"
            top = (52, 78, 105)
            bottom = (38, 48, 58)
        elif norm_role == "reeve-toran":
            gender = "male"
            hair = (28, 25, 30)
            top = (82, 42, 105)
            bottom = (36, 28, 44)
            has_glasses = False
            facial_hair = None
        elif norm_role == "hermit-cassian":
            gender = "male"
            hair = (200, 202, 205)
            facial_hair = "full_beard"
            top = (75, 38, 70)
            bottom = (48, 32, 44)
        elif norm_role == "mina-drift-child":
            gender = "female"
            age_category = "teenager"
            actual_age = 10
            hair = (220, 222, 228)
            hair_style = "braid"
            top = (48, 46, 52)
            bottom = (36, 34, 40)
            facial_hair = None
        elif norm_role == "guard":
            top = (42, 60, 92)
            bottom = (75, 78, 85)
            has_hat = False
        elif norm_role == "refugee":
            top = (68, 60, 52)
            bottom = (52, 46, 42)
            has_hat = False

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
        # Upstream humans derive their silhouette ink from skin tone. That is
        # suitable for civilian sprites, but it turns one-pixel armor and
        # weapon edges brown during finalization. Combat roles use their own
        # dark equipment ink so steel and ritual silhouettes stay readable.
        if norm_role == "player":
            outline = (10, 9, 13)
        elif norm_role == "adept":
            outline = (10, 6, 12)
        elif norm_role == "guard":
            outline = (12, 14, 18)
        elif norm_role == "refugee":
            outline = (22, 18, 16)
        elif norm_role == "orithel-the-last-watcher":
            outline = (18, 60, 66)
        elif norm_role in NPC_ROLES:
            outline = (16, 14, 18)
        else:
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

        # head and role equipment
        hx = (layout["head_w"] * 0.48) if not side else (layout["head_w"] * 0.46)
        hy = layout["head_h"] * 0.48

        norm_role = normalize_role(role)
        if norm_role == "player":
            self._knight_equipment(canvas, rig, direction, action, frame, layout, cx)
        elif norm_role == "adept":
            self._adept_equipment(canvas, rig, direction, action, frame, layout, cx)
        elif norm_role == "guard":
            self._guard_equipment(canvas, rig, direction, action, frame, layout, cx)
        elif norm_role == "refugee":
            self._refugee_equipment(canvas, rig, direction, action, frame, layout, cx)
        elif norm_role == "orithel-the-last-watcher":
            self._orithel_equipment(canvas, rig, direction, action, frame, layout, cx)
        elif norm_role in NPC_ROLES:
            ell(hd[0], hd[1], hx, hy, skin_b, skin_hi, skin_sh, TAG_SKIN)
            self._hair(canvas, hd, hx, hy, hair_b, hair_hi, hair_sh, hair_style, direction, side, back)
            if not back:
                self._face(canvas, rig, direction, cx, skin_b, eye, facial_hair, hair_b, gender, side)
            self._npc_equipment(canvas, rig, direction, action, frame, layout, cx, norm_role)
        else:
            ell(hd[0], hd[1], hx, hy, skin_b, skin_hi, skin_sh, TAG_SKIN)
            self._hair(canvas, hd, hx, hy, hair_b, hair_hi, hair_sh, hair_style, direction, side, back)
            if not back:
                self._face(canvas, rig, direction, cx, skin_b, eye, facial_hair, hair_b, gender, side)
            if has_glasses and not back:
                self._glasses(canvas, rig, direction, cx)
            if has_hat:
                self._hat(canvas, hd, hx, hair_style)
            if has_jewelry and not back:
                self._jewelry(canvas, nk, hd, gender)

        if norm_role in ("player", "adept", "guard"):
            self._weapon(canvas, hr, direction, action, frame, norm_role)

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
            rasterize_sdf(canvas, lambda px, py: sd_capsule(px, py, hx, hy + 6, tx, ty, 1.15),
                          shaft, color.lighten(shaft, 0.2), color.darken(shaft, 0.3), TAG_METAL)
            rasterize_sdf(canvas, lambda px, py: sd_circle(px, py, tx, ty, 2.0),
                          glow, color.lighten(glow, 0.35), color.darken(glow, 0.25), TAG_ACCENT)
            return

        if role == "guard":
            shaft = (100, 75, 52)
            steel = named_palette("grim_steel", 0.75)
            if impact and direction in ("left", "right"):
                tx, ty = hx + sign * 11, hy - 1
                bx, by = hx - sign * 5, hy + 2
            else:
                tx, ty = hx + (sign * 2 if direction in ("left", "right") else 1), hy - 11
                bx, by = hx - (sign * 1 if direction in ("left", "right") else 0), hy + 7
            rasterize_sdf(canvas, lambda px, py: sd_capsule(px, py, bx, by, tx, ty, 0.95),
                          shaft, color.lighten(shaft, 0.25), color.darken(shaft, 0.35), TAG_METAL)
            rasterize_sdf(canvas, lambda px, py: sd_capsule(px, py, tx, ty, tx + (sign * 2 if impact else 0), ty - 3, 1.2),
                          steel, color.lighten(steel, 0.35), color.darken(steel, 0.25), TAG_METAL)
            return

        steel = named_palette("grim_steel", 0.78)
        blood = named_palette("cult_blood", 0.62)
        if direction in ("left", "right"):
            tx, ty = hx + sign * (9 if impact else 6), hy - (1 if impact else 6)
        else:
            swing = (5 if impact else 2) * (-1 if direction == "back" else 1)
            tx, ty = hx + swing, hy - (8 if not impact else 3)
        rasterize_sdf(canvas, lambda px, py: sd_capsule(px, py, hx, hy, tx, ty, 1.25),
                      steel, color.lighten(steel, 0.38), color.darken(steel, 0.28), TAG_METAL)
        # A dark red crossguard makes the tiny weapon readable at native scale.
        gx, gy = hx, hy
        rasterize_sdf(canvas, lambda px, py: sd_capsule(px, py, gx - 2, gy, gx + 2, gy, 1.0),
                      blood, color.lighten(blood, 0.2), color.darken(blood, 0.3), TAG_ACCENT)

    def _knight_equipment(self, canvas, rig, direction, action, frame, layout, cx):
        side = direction in ("left", "right")
        back = direction == "back"
        sign = 1 if direction == "right" else -1

        def P(name):
            return self._pj(rig, name, direction, cx)

        hd = P("head"); nk = P("neck"); ts = P("torso"); hp = P("hip")
        sl = P("shoulder_l"); sr = P("shoulder_r")
        el = P("elbow_l"); er = P("elbow_r")
        hl = P("hand_l"); hr = P("hand_r")
        kl = P("knee_l"); kr = P("knee_r")
        fl = P("foot_l"); fr = P("foot_r")

        steel = named_palette("grim_steel", 0.72)
        steel_hi, steel_b, steel_sh = shade_triplet(steel, 0.28, 0.32)
        ink = (10, 9, 13)
        cyan = (57, 197, 191)
        cyan_hi = (185, 247, 230)
        cape_dark = (22, 26, 36)
        cape_lining = (64, 22, 28)

        def cap(ax, ay, bx, by, r, fill, hi, sh, tag, ink=None):
            def sdf(px, py):
                return sd_capsule(px, py, ax, ay, bx, by, r)
            rasterize_sdf(canvas, sdf, fill, hi, sh, tag, ink=ink, ink_width=0.55)

        def rbox(cx_, cy_, hx, hy, rad, fill, hi, sh, tag, ink=None):
            def sdf(px, py):
                return sd_round_box(px, py, cx_, cy_, hx, hy, rad)
            rasterize_sdf(canvas, sdf, fill, hi, sh, tag, ink=ink, ink_width=0.55)

        # 1. CAPE (Back layer)
        if back:
            def cape_sdf(px, py):
                top_y = min(sl[1], sr[1]) - 0.5
                bot_y = max(fl[1], fr[1]) - 1.0
                if py < top_y or py > bot_y:
                    return 999.0
                t = (py - top_y) / max(1.0, bot_y - top_y)
                half_w = 4.0 + t * 4.5
                mid_x = (sl[0] + sr[0]) * 0.5
                return abs(px - mid_x) - half_w
            rasterize_sdf(canvas, cape_sdf, cape_dark, color.lighten(cape_dark, 0.15), color.darken(cape_dark, 0.3), TAG_CLOTH, ink=ink)
            bot_y = int(max(fl[1], fr[1]) - 2.0)
            cx_mid = int((sl[0] + sr[0]) * 0.5)
            for dx in range(-6, 7):
                if canvas.opaque(cx_mid + dx, bot_y):
                    canvas.set(cx_mid + dx, bot_y, cape_lining, TAG_CLOTH)
        elif side:
            def side_cape_sdf(px, py):
                top_y = min(sl[1], sr[1])
                bot_y = max(fl[1], fr[1]) - 2.0
                if py < top_y or py > bot_y:
                    return 999.0
                t = (py - top_y) / max(1.0, bot_y - top_y)
                start_x = ts[0] - sign * 1.0
                end_x = ts[0] - sign * (4.2 + t * 2.5)
                min_x = min(start_x, end_x)
                max_x = max(start_x, end_x)
                if px < min_x or px > max_x:
                    return 999.0
                return -1.0
            rasterize_sdf(canvas, side_cape_sdf, cape_dark, color.lighten(cape_dark, 0.15), color.darken(cape_dark, 0.3), TAG_CLOTH, ink=ink)
        else:
            for side_sign in (-1, 1):
                def front_cape_sdf(px, py, sgn=side_sign):
                    top_y = ts[1]
                    bot_y = max(fl[1], fr[1]) - 2.0
                    if py < top_y or py > bot_y:
                        return 999.0
                    t = (py - top_y) / max(1.0, bot_y - top_y)
                    cx_c = ts[0] + sgn * (4.0 + t * 2.2)
                    return abs(px - cx_c) - 1.2
                rasterize_sdf(canvas, front_cape_sdf, cape_dark, color.lighten(cape_dark, 0.12), color.darken(cape_dark, 0.3), TAG_CLOTH)

        # 2. CUIRASS & FAULDS & PAULDRONS
        torso_hx = 3.8 if not side else 3.4
        torso_hy = layout["torso_h"] * 0.55
        rbox(ts[0], (ts[1] + hp[1]) * 0.5, torso_hx, max(torso_hy, abs(hp[1] - ts[1]) * 0.55 + 1.2),
             1.2, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)

        p_hx = 2.6 if not side else 2.2
        rbox(sl[0], sl[1] - 0.5, p_hx, 2.0, 0.8, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)
        rbox(sr[0], sr[1] - 0.5, p_hx, 2.0, 0.8, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)

        # Articulated plate sleeves, vambraces, gauntlets, and sabatons. The
        # arm overlays are especially important in the side attack frames:
        # without them the extended skin-coloured rig reads as a wooden bar.
        cap(sl[0], sl[1], el[0], el[1], 1.45, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)
        cap(sr[0], sr[1], er[0], er[1], 1.45, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)
        cap(el[0], el[1], hl[0], hl[1], 1.3, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)
        cap(er[0], er[1], hr[0], hr[1], 1.3, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)
        rbox(hl[0], hl[1], 1.2, 1.1, 0.45, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)
        rbox(hr[0], hr[1], 1.2, 1.1, 0.45, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)
        cap(kl[0], kl[1], fl[0], fl[1], 1.6, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)
        cap(kr[0], kr[1], fr[0], fr[1], 1.6, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)

        # 3. OATH-MARK (Cyan chest rune)
        if not back:
            rx = ts[0] if not side else (ts[0] + sign * 1.8)
            ry = ts[1]
            def rune_sdf(px, py):
                return sd_rhombus(px, py, rx, ry, 1.4, 1.8)
            rasterize_sdf(canvas, rune_sdf, cyan, cyan_hi, color.darken(cyan, 0.3), TAG_ACCENT)
            canvas.set(int(round(rx)), int(round(ry)), cyan_hi, TAG_ACCENT)

        # Gorget (neck armour) connecting chest to helm
        mid_sh_y = (sl[1] + sr[1]) * 0.5
        gorget_y = (hd[1] + mid_sh_y) * 0.5 + 0.5
        rbox(hd[0], gorget_y, 2.6 if not side else 2.4, 2.0, 0.6, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)

        # 4. GREATHELM (Direction-aware, seated on gorget)
        helm_y = hd[1] + 0.5
        def helm_sdf(px, py):
            d1 = sd_round_box(px, py, hd[0], helm_y, 3.2 if not side else 2.8, 2.8, 1.1)
            d2 = sd_capsule(px, py, hd[0], helm_y, hd[0], helm_y - 1.2, 2.6 if not side else 2.3)
            return min(d1, d2)
        rasterize_sdf(canvas, helm_sdf, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink, ink_width=0.55)

        if not back:
            if not side:
                vy = int(round(helm_y))
                vx = int(round(hd[0]))
                for dx in range(-2, 3):
                    canvas.set(vx + dx, vy, ink, TAG_METAL)
                canvas.set(vx - 1, vy, cyan, TAG_ACCENT)
                canvas.set(vx, vy, cyan_hi, TAG_ACCENT)
                canvas.set(vx + 1, vy, cyan, TAG_ACCENT)
                canvas.set(vx, vy - 2, steel_hi, TAG_METAL)
            else:
                vx = int(round(hd[0] + sign * 1.8))
                vy = int(round(helm_y))
                canvas.set(vx, vy, ink, TAG_METAL)
                canvas.set(vx + sign, vy, cyan_hi, TAG_ACCENT)
                canvas.set(vx, vy + 1, steel_sh, TAG_METAL)
                canvas.set(int(round(hd[0] - sign)), vy - 2, steel_hi, TAG_METAL)
        else:
            vx = int(round(hd[0]))
            for dy in range(-2, 2):
                canvas.set(vx, int(round(helm_y)) + dy, steel_hi, TAG_METAL)

    def _adept_equipment(self, canvas, rig, direction, action, frame, layout, cx):
        side = direction in ("left", "right")
        back = direction == "back"
        sign = 1 if direction == "right" else -1

        def P(name):
            return self._pj(rig, name, direction, cx)

        hd = P("head"); nk = P("neck"); ts = P("torso"); hp = P("hip")
        fl = P("foot_l"); fr = P("foot_r")

        blood_b = named_palette("cult_blood", 0.65)
        blood_hi, blood_b, blood_sh = shade_triplet(blood_b, 0.25, 0.32)
        void_black = (14, 8, 16)
        blood_eye = (235, 45, 65)
        blood_eye_hi = (255, 120, 140)
        ink = (10, 6, 12)

        def rbox(cx_, cy_, hx, hy, rad, fill, hi, sh, tag, ink=None):
            def sdf(px, py):
                return sd_round_box(px, py, cx_, cy_, hx, hy, rad)
            rasterize_sdf(canvas, sdf, fill, hi, sh, tag, ink=ink, ink_width=0.55)

        # Robe flowing from shoulders to feet
        bot_y = max(fl[1], fr[1])
        rbox(ts[0], (ts[1] + bot_y) * 0.5, 3.8 if not side else 3.2, (bot_y - ts[1]) * 0.5 + 1.0,
             1.4, blood_b, blood_hi, blood_sh, TAG_CLOTH, ink=ink)

        # Hood / Cowl
        def cowl_sdf(px, py):
            d1 = sd_round_box(px, py, hd[0], hd[1] + 0.8, 3.5 if not side else 3.1, 2.8, 0.8)
            d2 = sd_capsule(px, py, hd[0], hd[1] - 0.2, hd[0], hd[1] - 3.2, 2.2 if not side else 1.9)
            return min(d1, d2)
        rasterize_sdf(canvas, cowl_sdf, void_black, color.lighten(void_black, 0.2), ink, TAG_CLOTH, ink=ink, ink_width=0.55)

        if not back:
            ey = int(round(hd[1]))
            if not side:
                ex = int(round(hd[0]))
                canvas.set(ex - 1, ey, blood_eye, TAG_EYE)
                canvas.set(ex + 1, ey, blood_eye, TAG_EYE)
                canvas.set(ex - 1, ey - 1, blood_eye_hi, TAG_EYE)
                canvas.set(ex + 1, ey - 1, blood_eye_hi, TAG_EYE)
            else:
                ex = int(round(hd[0] + sign * 1.5))
                canvas.set(ex, ey, blood_eye, TAG_EYE)
                canvas.set(ex, ey - 1, blood_eye_hi, TAG_EYE)
        else:
            by = int(round(ts[1]))
            bx = int(round(ts[0]))
            for dy in (-1, 0, 1):
                canvas.set(bx, by + dy, (170, 32, 45), TAG_ACCENT)
            for dx in (-1, 1):
                canvas.set(bx + dx, by, (170, 32, 45), TAG_ACCENT)

    def _guard_equipment(self, canvas, rig, direction, action, frame, layout, cx):
        side = direction in ("left", "right")
        back = direction == "back"
        sign = 1 if direction == "right" else -1

        def P(name):
            return self._pj(rig, name, direction, cx)

        hd = P("head"); nk = P("neck"); ts = P("torso"); hp = P("hip")
        sl = P("shoulder_l"); sr = P("shoulder_r")
        el = P("elbow_l"); er = P("elbow_r")
        hl = P("hand_l"); hr = P("hand_r")
        kl = P("knee_l"); kr = P("knee_r")
        fl = P("foot_l"); fr = P("foot_r")

        steel = named_palette("grim_steel", 0.68)
        steel_hi, steel_b, steel_sh = shade_triplet(steel, 0.25, 0.30)
        gold = (195, 160, 68)
        surcoat = (42, 60, 92)
        surcoat_hi, surcoat_b, surcoat_sh = shade_triplet(surcoat, 0.20, 0.28)
        ink = (10, 10, 14)

        def cap(ax, ay, bx, by, r, fill, hi, sh, tag, ink=None):
            def sdf(px, py):
                return sd_capsule(px, py, ax, ay, bx, by, r)
            rasterize_sdf(canvas, sdf, fill, hi, sh, tag, ink=ink, ink_width=0.55)

        def rbox(cx_, cy_, hx, hy, rad, fill, hi, sh, tag, ink=None):
            def sdf(px, py):
                return sd_round_box(px, py, cx_, cy_, hx, hy, rad)
            rasterize_sdf(canvas, sdf, fill, hi, sh, tag, ink=ink, ink_width=0.55)

        # 1. Surcoat over chainmail
        torso_hx = 3.8 if not side else 3.4
        torso_hy = layout["torso_h"] * 0.55
        rbox(ts[0], (ts[1] + hp[1]) * 0.5, torso_hx, max(torso_hy, abs(hp[1] - ts[1]) * 0.55 + 1.2),
             1.0, surcoat_b, surcoat_hi, surcoat_sh, TAG_CLOTH, ink=ink)

        # Surcoat heraldic cross stripe
        if not back:
            mx = int(round(ts[0] if not side else ts[0] + sign * 1.2))
            my = int(round((ts[1] + hp[1]) * 0.5))
            for dy in range(-2, 3):
                canvas.set(mx, my + dy, gold, TAG_ACCENT)
            if not side:
                for dx in range(-2, 3):
                    canvas.set(mx + dx, my, gold, TAG_ACCENT)

        # 2. Steel pauldrons & chain sleeves
        p_hx = 2.4 if not side else 2.0
        rbox(sl[0], sl[1] - 0.4, p_hx, 1.8, 0.7, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)
        rbox(sr[0], sr[1] - 0.4, p_hx, 1.8, 0.7, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)
        cap(sl[0], sl[1], el[0], el[1], 1.35, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)
        cap(sr[0], sr[1], er[0], er[1], 1.35, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)
        cap(el[0], el[1], hl[0], hl[1], 1.25, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)
        cap(er[0], er[1], hr[0], hr[1], 1.25, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)

        # Greaves & boots
        cap(kl[0], kl[1], fl[0], fl[1], 1.45, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)
        cap(kr[0], kr[1], fr[0], fr[1], 1.45, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink)

        # 3. Guard Helmet (Iron kettle/nasal helm)
        helm_y = hd[1] + 0.3
        def helm_sdf(px, py):
            d_dome = sd_round_box(px, py, hd[0], helm_y - 0.8, 3.2 if not side else 2.8, 2.3, 1.0)
            d_brim = sd_capsule(px, py, hd[0] - 3.8, helm_y + 1.2, hd[0] + 3.8, helm_y + 1.2, 0.8)
            return min(d_dome, d_brim)
        rasterize_sdf(canvas, helm_sdf, steel_b, steel_hi, steel_sh, TAG_METAL, ink=ink, ink_width=0.55)

        if not back:
            ey = int(round(helm_y + 0.2))
            if not side:
                ex = int(round(hd[0]))
                canvas.set(ex - 1, ey, (35, 30, 32), TAG_EYE)
                canvas.set(ex + 1, ey, (35, 30, 32), TAG_EYE)
                canvas.set(ex, ey, steel_hi, TAG_METAL)
                canvas.set(ex, ey + 1, steel_sh, TAG_METAL)
            else:
                ex = int(round(hd[0] + sign * 1.5))
                canvas.set(ex, ey, (35, 30, 32), TAG_EYE)
                canvas.set(ex + sign, ey, steel_hi, TAG_METAL)

    def _refugee_equipment(self, canvas, rig, direction, action, frame, layout, cx):
        side = direction in ("left", "right")
        back = direction == "back"
        sign = 1 if direction == "right" else -1

        def P(name):
            return self._pj(rig, name, direction, cx)

        hd = P("head"); nk = P("neck"); ts = P("torso"); hp = P("hip")
        hl = P("hand_l"); hr = P("hand_r")
        fl = P("foot_l"); fr = P("foot_r")

        cloak_b = (68, 60, 52)
        cloak_hi, cloak_b, cloak_sh = shade_triplet(cloak_b, 0.18, 0.26)
        patch = (95, 82, 68)
        wood = (88, 62, 40)
        ink = (14, 12, 10)

        def rbox(cx_, cy_, hx, hy, rad, fill, hi, sh, tag, ink=None):
            def sdf(px, py):
                return sd_round_box(px, py, cx_, cy_, hx, hy, rad)
            rasterize_sdf(canvas, sdf, fill, hi, sh, tag, ink=ink, ink_width=0.55)

        # 1. Ragged traveler cloak
        bot_y = max(fl[1], fr[1]) - 1.0
        rbox(ts[0], (ts[1] + bot_y) * 0.5, 3.6 if not side else 3.0, (bot_y - ts[1]) * 0.5 + 0.8,
             1.2, cloak_b, cloak_hi, cloak_sh, TAG_CLOTH, ink=ink)

        # Patches on cloak
        py = int(round((ts[1] + hp[1]) * 0.5 + 1.0))
        px = int(round(ts[0] - 1.2 if not side else ts[0] - sign * 0.8))
        canvas.set(px, py, patch, TAG_CLOTH)
        canvas.set(px + 1, py, patch, TAG_CLOTH)
        canvas.set(px, py + 1, patch, TAG_CLOTH)

        # 2. Traveler's Hood/Cowl
        def cowl_sdf(px, py):
            d1 = sd_round_box(px, py, hd[0], hd[1] + 0.5, 3.3 if not side else 2.9, 2.6, 0.9)
            d2 = sd_capsule(px, py, hd[0], hd[1] - 0.5, hd[0] - (sign * 1.5 if side else 0), hd[1] - 2.8, 2.0)
            return min(d1, d2)
        rasterize_sdf(canvas, cowl_sdf, cloak_b, cloak_hi, cloak_sh, TAG_CLOTH, ink=ink, ink_width=0.55)

        # Shaded eyes inside cowl
        if not back:
            ey = int(round(hd[1] + 0.4))
            eye_c = (220, 205, 190)
            if not side:
                ex = int(round(hd[0]))
                canvas.set(ex - 1, ey, eye_c, TAG_EYE)
                canvas.set(ex + 1, ey, eye_c, TAG_EYE)
                canvas.set(ex - 1, ey - 1, (24, 20, 18), TAG_CLOTH)
                canvas.set(ex + 1, ey - 1, (24, 20, 18), TAG_CLOTH)
            else:
                ex = int(round(hd[0] + sign * 1.4))
                canvas.set(ex, ey, eye_c, TAG_EYE)
                canvas.set(ex, ey - 1, (24, 20, 18), TAG_CLOTH)

        # 3. Simple wooden walking stick
        sx, sy = hr[0], hr[1]
        staff_x = sx + (sign * 1.5 if side else 2.0)
        staff_top = sy - 7.0
        staff_bot = bot_y + 1.0
        rasterize_sdf(canvas, lambda px, py: sd_capsule(px, py, staff_x, staff_top, staff_x, staff_bot, 0.75),
                      wood, color.lighten(wood, 0.2), color.darken(wood, 0.3), TAG_CLOTH)

    def _orithel_equipment(self, canvas, rig, direction, action, frame, layout, cx):
        side = direction in ("left", "right")
        back = direction == "back"
        sign = 1 if direction == "right" else -1

        def P(name):
            return self._pj(rig, name, direction, cx)

        hd = P("head"); nk = P("neck"); ts = P("torso"); hp = P("hip")
        fl = P("foot_l"); fr = P("foot_r")

        teal_deep = (20, 62, 68)
        teal_b = (32, 102, 110)
        teal_hi = (118, 242, 223)
        teal_glow = (186, 245, 238)
        gold = (224, 196, 121)
        gold_hi = (248, 232, 175)

        def rbox(cx_, cy_, hx, hy, rad, fill, hi, sh, tag):
            rasterize_sdf(canvas, lambda px, py: sd_round_box(px, py, cx_, cy_, hx, hy, rad), fill, hi, sh, tag)

        # 1. Translucent teal projection robes
        bot_y = max(fl[1], fr[1]) + 0.5
        rbox(ts[0], (ts[1] + bot_y) * 0.5, 3.8 if not side else 3.2, (bot_y - ts[1]) * 0.5 + 1.0,
             1.4, teal_b, teal_hi, teal_deep, TAG_CLOTH)

        for dx in range(-3, 4):
            canvas.set(int(round(ts[0] + dx)), int(round(bot_y)), teal_hi, TAG_ACCENT)

        # 2. Severe gold-and-ivory collar / mantle
        collar_y = (hd[1] + ts[1]) * 0.5
        rbox(hd[0], collar_y, 3.4 if not side else 2.8, 1.6, 0.6, gold, gold_hi, color.darken(gold, 0.3), TAG_ACCENT)
        if not back:
            canvas.set(int(round(hd[0])), int(round(collar_y)), gold_hi, TAG_ACCENT)

        # 3. Ethereal head & white drifting hair
        hx = (layout["head_w"] * 0.46) if not side else (layout["head_w"] * 0.44)
        hy = layout["head_h"] * 0.46
        rasterize_sdf(canvas, lambda px, py: sd_ellipse(px, py, hd[0], hd[1], hx, hy),
                      teal_glow, (235, 255, 252), teal_b, TAG_SKIN)

        hair_c = (235, 248, 246)
        hair_hi = (255, 255, 255)
        for h_off in ((-2.5, 0.0, 2.5) if not side else (-1.5, 1.5)):
            h_bx = hd[0] + h_off
            h_by = hd[1] - 3.2
            rasterize_sdf(canvas, lambda px, py: sd_capsule(px, py, h_bx, h_by, h_bx - (sign * 1.2 if side else 0), h_by + 6.0, 0.9),
                          hair_c, hair_hi, teal_b, TAG_HAIR)

        if not back:
            ey = int(round(hd[1]))
            if not side:
                canvas.set(int(round(hd[0] - 1.5)), ey, (255, 255, 255), TAG_EYE)
                canvas.set(int(round(hd[0] + 1.5)), ey, (255, 255, 255), TAG_EYE)
            else:
                canvas.set(int(round(hd[0] + sign * 1.5)), ey, (255, 255, 255), TAG_EYE)

        # 4. Fractured Spire Halo shards floating overhead
        shards = [
            (hd[0] - 3.8, hd[1] - 5.5),
            (hd[0], hd[1] - 7.0),
            (hd[0] + 3.8, hd[1] - 5.5),
            (hd[0] - 2.0, hd[1] - 6.2),
            (hd[0] + 2.0, hd[1] - 6.2),
        ]
        for sx, sy in shards:
            canvas.set(int(round(sx)), int(round(sy)), teal_hi, TAG_ACCENT)
            canvas.set(int(round(sx)), int(round(sy - 1)), (255, 255, 255), TAG_ACCENT)

    def _npc_equipment(self, canvas, rig, direction, action, frame, layout, cx, npc: str):
        side = direction in ("left", "right")
        back = direction == "back"
        sign = 1 if direction == "right" else -1

        def P(name):
            return self._pj(rig, name, direction, cx)

        hd = P("head"); nk = P("neck"); ts = P("torso"); hp = P("hip")
        sl = P("shoulder_l"); sr = P("shoulder_r")
        hl = P("hand_l"); hr = P("hand_r")
        fl = P("foot_l"); fr = P("foot_r")

        def cap(ax, ay, bx, by, r, fill, hi, sh, tag):
            rasterize_sdf(canvas, lambda px, py: sd_capsule(px, py, ax, ay, bx, by, r), fill, hi, sh, tag)

        def rbox(cx_, cy_, hx, hy, rad, fill, hi, sh, tag):
            rasterize_sdf(canvas, lambda px, py: sd_round_box(px, py, cx_, cy_, hx, hy, rad), fill, hi, sh, tag)

        if npc == "scribe-althea":
            ochre = (181, 132, 52)
            hi_o, b_o, sh_o = shade_triplet(ochre, 0.22, 0.25)
            rbox(hd[0], hd[1] - 2.0, 3.4 if not side else 3.0, 1.8, 0.8, b_o, hi_o, sh_o, TAG_CLOTH)
            qx = int(round(hd[0] + (sign * 2.5 if side else 2.5)))
            qy = int(round(hd[1] - 3.5))
            canvas.set(qx, qy, (252, 250, 245), TAG_ACCENT)
            canvas.set(qx, qy - 1, (252, 250, 245), TAG_ACCENT)
            canvas.set(qx - 1, qy + 1, (220, 215, 205), TAG_ACCENT)
            lx = int(round((hl[0] + hr[0]) * 0.5))
            ly = int(round((hl[1] + hr[1]) * 0.5))
            rbox(lx, ly, 2.2, 2.6, 0.5, (84, 52, 26), (110, 72, 38), (55, 34, 18), TAG_ACCENT)
            canvas.set(lx, ly, (201, 168, 108), TAG_ACCENT)

        elif npc == "sister-mirene":
            veil = (38, 79, 67)
            hi_v, b_v, sh_v = shade_triplet(veil, 0.22, 0.28)
            rbox(hd[0], hd[1] - 1.5, 3.6 if not side else 3.2, 2.5, 0.9, b_v, hi_v, sh_v, TAG_CLOTH)
            by = int(round(ts[1] + 1.0))
            bx = int(round(ts[0]))
            for dy in range(0, 4):
                canvas.set(bx, by + dy, (20, 22, 24), TAG_ACCENT)
            canvas.set(bx, by + 4, (90, 210, 160), TAG_ACCENT)

        elif npc == "barris-the-smith":
            apron = (92, 58, 36)
            hi_a, b_a, sh_a = shade_triplet(apron, 0.18, 0.28)
            rbox(ts[0], (ts[1] + hp[1]) * 0.5 + 0.5, 3.6, 3.5, 0.8, b_a, hi_a, sh_a, TAG_CLOTH)
            hx, hy = hr[0], hr[1]
            cap(hx, hy + 2.0, hx, hy - 4.5, 0.7, (90, 65, 45), (120, 90, 60), (60, 42, 28), TAG_CLOTH)
            rbox(hx, hy - 5.0, 1.8, 1.2, 0.4, (110, 115, 120), (160, 165, 172), (70, 72, 78), TAG_METAL)
            canvas.set(int(round(hx + 1.2)), int(round(hy - 5.0)), (255, 145, 35), TAG_ACCENT)

        elif npc == "kiln-master-vance":
            if not back:
                gy = int(round(hd[1]))
                gx = int(round(hd[0] if not side else hd[0] + sign * 1.5))
                g_c = (255, 140, 30)
                g_hi = (255, 210, 90)
                if not side:
                    canvas.set(gx - 2, gy, (160, 90, 45), TAG_METAL)
                    canvas.set(gx - 1, gy, g_c, TAG_ACCENT)
                    canvas.set(gx, gy, (160, 90, 45), TAG_METAL)
                    canvas.set(gx + 1, gy, g_c, TAG_ACCENT)
                    canvas.set(gx + 2, gy, (160, 90, 45), TAG_METAL)
                else:
                    canvas.set(gx, gy, g_c, TAG_ACCENT)
                    canvas.set(gx + sign, gy, g_hi, TAG_ACCENT)
                    canvas.set(gx - sign, gy, (160, 90, 45), TAG_METAL)
            hx, hy = hr[0], hr[1]
            cap(hx, hy + 3.0, hx, hy - 7.0, 0.7, (60, 62, 68), (110, 115, 122), (38, 40, 45), TAG_METAL)
            canvas.set(int(round(hx)), int(round(hy - 8.0)), (245, 120, 25), TAG_ACCENT)

        elif npc == "cinder-nurse-greta":
            cap_c = (215, 210, 195)
            rbox(hd[0], hd[1] - 2.8, 2.6 if not side else 2.2, 1.2, 0.5, cap_c, (245, 242, 235), (170, 165, 150), TAG_CLOTH)
            rbox(ts[0], (ts[1] + hp[1]) * 0.5 + 0.5, 2.8, 3.0, 0.7, cap_c, (245, 242, 235), (170, 165, 150), TAG_CLOTH)
            vx, vy = int(round(hr[0])), int(round(hr[1]))
            canvas.set(vx, vy, (48, 140, 220), TAG_ACCENT)
            canvas.set(vx, vy - 1, (130, 205, 255), TAG_ACCENT)
            canvas.set(vx, vy + 1, (24, 75, 145), TAG_ACCENT)

        elif npc == "elodie-outrunner":
            scarf = (145, 140, 148)
            rbox(nk[0], nk[1], 3.0 if not side else 2.6, 1.4, 0.5, scarf, (185, 180, 188), (105, 100, 108), TAG_CLOTH)
            hx, hy = hr[0], hr[1]
            bot_y = max(fl[1], fr[1]) + 0.5
            cap(hx, bot_y, hx, hy - 6.5, 0.75, (95, 75, 55), (135, 110, 85), (65, 50, 35), TAG_CLOTH)
            canvas.set(int(round(hx + sign)), int(round(hy - 7.0)), (170, 175, 182), TAG_METAL)
            canvas.set(int(round(hx + sign * 2)), int(round(hy - 6.0)), (170, 175, 182), TAG_METAL)

        elif npc == "mistress-morveth":
            gy = int(round(hd[1] - 2.2))
            gx = int(round(hd[0] if not side else hd[0] + sign * 1.0))
            brass = (195, 155, 65)
            lens = (120, 210, 215)
            if not side:
                canvas.set(gx - 2, gy, brass, TAG_METAL)
                canvas.set(gx - 1, gy, lens, TAG_ACCENT)
                canvas.set(gx, gy, brass, TAG_METAL)
                canvas.set(gx + 1, gy, lens, TAG_ACCENT)
                canvas.set(gx + 2, gy, brass, TAG_METAL)
            else:
                canvas.set(gx, gy, brass, TAG_METAL)
                canvas.set(gx + sign, gy, lens, TAG_ACCENT)
            canvas.set(int(round(sl[0])), int(round(sl[1] + 2.0)), (230, 225, 215), TAG_ACCENT)
            canvas.set(int(round(sr[0])), int(round(sr[1] + 2.0)), (230, 225, 215), TAG_ACCENT)

        elif npc == "sister-lyra":
            pearl = (235, 240, 245)
            canvas.set(int(round(hd[0] - 2.8)), int(round(hd[1])), pearl, TAG_ACCENT)
            canvas.set(int(round(hd[0] + 2.8)), int(round(hd[1])), pearl, TAG_ACCENT)
            sx = int(round(hp[0] + (sign * 2.5 if side else 2.5)))
            sy = int(round(hp[1]))
            canvas.set(sx, sy, (120, 240, 180), TAG_ACCENT)
            canvas.set(sx, sy - 1, (200, 255, 230), TAG_ACCENT)

        elif npc == "kieran-blind-oar":
            if not back:
                wy = int(round(hd[1]))
                wrap_c = (185, 180, 170)
                if not side:
                    for dx in range(-2, 3):
                        canvas.set(int(round(hd[0] + dx)), wy, wrap_c, TAG_CLOTH)
                else:
                    for dx in range(0, 3):
                        canvas.set(int(round(hd[0] + sign * dx)), wy, wrap_c, TAG_CLOTH)
            hx, hy = hr[0], hr[1]
            bot_y = max(fl[1], fr[1]) + 1.0
            cap(hx, bot_y, hx, hy - 8.0, 0.8, (115, 80, 50), (150, 110, 75), (75, 50, 32), TAG_CLOTH)
            rbox(hx, hy - 9.0, 1.6, 2.0, 0.4, (115, 80, 50), (150, 110, 75), (75, 50, 32), TAG_CLOTH)

        elif npc == "reeve-toran":
            if not back:
                my = int(round(hd[1]))
                mx = int(round(hd[0] + 1.2 if not side else hd[0] + sign * 1.5))
                canvas.set(mx, my, (180, 225, 245), TAG_ACCENT)
                canvas.set(mx + 1, my, (215, 175, 75), TAG_METAL)
                canvas.set(mx, my - 1, (215, 175, 75), TAG_METAL)
            rbox(nk[0], nk[1], 3.2 if not side else 2.8, 1.3, 0.5, (105, 55, 135), (145, 85, 180), (68, 32, 90), TAG_CLOTH)

        elif npc == "hermit-cassian":
            moss = (75, 140, 55)
            moss_hi = (115, 185, 85)
            canvas.set(int(round(hl[0])), int(round(hl[1] - 1)), moss, TAG_ACCENT)
            canvas.set(int(round(hl[0] + 1)), int(round(hl[1] - 1)), moss_hi, TAG_ACCENT)
            canvas.set(int(round(hr[0])), int(round(hr[1] - 1)), moss, TAG_ACCENT)
            canvas.set(int(round(hr[0] - 1)), int(round(hr[1] - 1)), moss_hi, TAG_ACCENT)
            bx = int(round((hl[0] + hr[0]) * 0.5))
            by = int(round((hl[1] + hr[1]) * 0.5 + 1.0))
            rbox(bx, by, 2.0, 1.2, 0.4, (55, 60, 70), (85, 92, 105), (35, 38, 45), TAG_METAL)
            canvas.set(bx, by, (90, 160, 220), TAG_ACCENT)

        elif npc == "mina-drift-child":
            fork_x = int(round(hr[0] + (sign * 1.5 if side else 2.0)))
            fork_y = int(round(hr[1] - 2.0))
            silver = (210, 215, 225)
            canvas.set(fork_x, fork_y + 2, silver, TAG_METAL)
            canvas.set(fork_x - 1, fork_y, silver, TAG_METAL)
            canvas.set(fork_x + 1, fork_y, silver, TAG_METAL)
            canvas.set(fork_x - 1, fork_y - 2, silver, TAG_METAL)
            canvas.set(fork_x + 1, fork_y - 2, silver, TAG_METAL)
            canvas.set(fork_x, fork_y - 3, (180, 240, 255), TAG_ACCENT)

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
