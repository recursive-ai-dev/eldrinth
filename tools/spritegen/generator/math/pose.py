#!/usr/bin/env python3
"""
Multi-directional pose imputation (mathematical MDIGAN).
========================================================

Guide §1 frames missing views as a data-imputation problem.  Rather than a
104M-parameter CollaGAN we keep a tiny 3-D rig and project it:

    front  →  (x, y)     depth =  z
    back   →  (-x, y)    depth = -z
    right  →  (z, y)     depth = -x
    left   →  (-z, y)    depth =  x

Walk-cycle kinematics (4 frames) offset limbs in the plane of motion.
A :class:`PoseImputer` can also synthesise a side/back buffer from a *front
pixel buffer + depth field* when a rig isn't available — the closed-form
stand-in for CollaGAN's missing-domain decoder.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Tuple

from .canvas import Canvas, TRANSPARENT

DIRECTIONS = ("front", "right", "back", "left")


@dataclass
class Joint:
    """A named 3-D landmark in character space (y grows downward)."""
    name: str
    x: float
    y: float
    z: float = 0.0

    def copy(self) -> "Joint":
        return Joint(self.name, self.x, self.y, self.z)


def project_point(x: float, y: float, z: float, direction: str, cx: float) -> Tuple[float, float, float]:
    """Return ``(screen_x, screen_y, depth)``.  Greater depth = closer to camera."""
    if direction == "front":
        return cx + x, y, z
    if direction == "back":
        return cx - x, y, -z
    if direction == "right":
        return cx + z, y, -x
    if direction == "left":
        return cx - z, y, x
    return cx + x, y, z


@dataclass
class Rig:
    """A named set of 3-D joints plus convenience accessors."""
    joints: Dict[str, Joint] = field(default_factory=dict)

    def add(self, name: str, x: float, y: float, z: float = 0.0) -> Joint:
        j = Joint(name, x, y, z)
        self.joints[name] = j
        return j

    def get(self, name: str) -> Joint:
        return self.joints[name]

    def copy(self) -> "Rig":
        r = Rig()
        r.joints = {k: v.copy() for k, v in self.joints.items()}
        return r

    def project(self, name: str, direction: str, cx: float) -> Tuple[float, float, float]:
        j = self.joints[name]
        return project_point(j.x, j.y, j.z, direction, cx)

    def apply(self, fn: Callable[[Joint], None]) -> "Rig":
        for j in self.joints.values():
            fn(j)
        return self


def idle_bob(rig: Rig, frame: int, nframes: int = 4, amp: float = 0.6) -> Rig:
    """Subtle vertical bob used for idle / front-walk."""
    t = (frame / float(max(1, nframes))) * 2.0 * math.pi
    dy = amp * math.sin(t)
    out = rig.copy()
    for j in out.joints.values():
        j.y += dy
    return out


def walk_pose(rig: Rig, frame: int, nframes: int = 4, facing: str = "front") -> Rig:
    """4-frame walk.  Side views stride in Z; front/back stride in X."""
    t = (frame / float(max(1, nframes))) * 2.0 * math.pi
    out = rig.copy()
    # contact → down → passing → up
    # Kept well under the rig's own left/right depth separation (~1.5, see
    # human.py's _make_rig z offsets for hands/elbows — the tightest pair)
    # so a stride never drives a limb pair's screen-space gap down near
    # zero, let alone swap their near/far order. That collapse-to-a-sliver
    # at the extremes of the cycle is what read as the limbs "flopping"
    # through each other.
    stride = 0.8
    lift = 1.0

    # One leg swings forward-and-up at a time while the other stays put —
    # not both legs oscillating simultaneously in opposite directions. The
    # latter (each foot tracing a full back-and-forth sine every frame,
    # only its *lift* zeroed during "stance") kept even the "planted" foot
    # sliding sideways across the ground every frame, which is what read
    # as a synchronized shuffle instead of discrete steps.
    def _swing(u: float) -> Tuple[float, float]:
        """u in [0, 1]: a single forward+up hump, zero at both ends."""
        p = u * math.pi
        return stride * math.sin(p), max(0.0, lift * math.sin(p))

    cycle = (t % (2.0 * math.pi)) / (2.0 * math.pi)  # in [0, 1)
    if cycle < 0.5:
        lx, ly = _swing(cycle / 0.5)
        rx, ry = 0.0, 0.0
        arx, ary = _swing(cycle / 0.5)   # right arm swings with the left leg
        alx, aly = 0.0, 0.0
    else:
        lx, ly = 0.0, 0.0
        rx, ry = _swing((cycle - 0.5) / 0.5)
        arx, ary = 0.0, 0.0
        alx, aly = _swing((cycle - 0.5) / 0.5)  # left arm swings with the right leg

    # vertical bob of the whole body
    bob = 0.28 * abs(math.sin(t * 2.0))
    for j in out.joints.values():
        j.y -= bob  # up is negative y

    side = facing in ("left", "right")

    def _limb(name: str, sx: float, sy: float, zsign: float = 1.0):
        if name not in out.joints:
            return
        j = out.joints[name]
        if side:
            j.z += sx * zsign
            j.y -= sy
        else:
            j.x += sx * 0.55
            j.y -= sy * 0.45

    # Knee carries most of the foot's swing (not half of it) and the hip
    # carries a small fraction too, so the whole leg reads as swinging from
    # the hip. At the old 0.5 knee fraction the knee's motion was small
    # enough to round away to nothing pixel-wise while the foot alone
    # cleared the rounding threshold — that isolated, everything-above-
    # the-foot-frozen look is what read as the ankle spinning on its own,
    # marionette-style. The knee/hip pairs have plenty of depth-separation
    # headroom (unlike the hands, which cap how large `stride` can be, see
    # above), so this doesn't reopen the crossing bug.
    _limb("foot_l", lx, ly, 1.0)
    _limb("knee_l", lx * 0.75, ly * 0.65, 1.0)
    _limb("hip_l", lx * 0.18, 0.0, 1.0)
    _limb("foot_r", rx, ry, 1.0)
    _limb("knee_r", rx * 0.75, ry * 0.65, 1.0)
    _limb("hip_r", rx * 0.18, 0.0, 1.0)
    _limb("hand_l", alx * 0.7, aly * 0.3, -1.0)
    _limb("elbow_l", alx * 0.35, aly * 0.15, -1.0)
    _limb("hand_r", arx * 0.7, ary * 0.3, -1.0)
    _limb("elbow_r", arx * 0.35, ary * 0.15, -1.0)

    # Small torso counter-sway: real gait carries a slight twist through
    # the shoulders and head opposite the leg phase. Without it the upper
    # body reads as a rigid pole bolted onto a pair of walking legs — the
    # limbs move but nothing above the hips ever does. Kept tiny (a
    # fraction of the already-small stride) so it reads as "alive" rather
    # than adding its own wobble.
    _limb("shoulder_l", lx * 0.22, 0.0, 0.5)
    _limb("shoulder_r", rx * 0.22, 0.0, 0.5)
    _limb("neck", alx * 0.18, 0.0, 0.5)
    _limb("head", alx * 0.18, 0.0, 0.5)
    return out


GATHER_ACTIONS = ("chop", "mine", "harvest", "build")


def gather_pose(rig: Rig, frame: int, nframes: int = 8, facing: str = "front",
                action: str = "chop") -> Rig:
    """Looping work cycle: raise tool, committed downward strike, recover.

    ``chop``/``mine``/``build`` are two-handed overhead strikes (mining
    crouches deeper, building taps shorter); ``harvest`` is a low sweeping
    sickle arc that leans the torso into the crop.
    """
    out = rig.copy()
    u = (frame % max(1, nframes)) / float(max(1, nframes))
    # 0..0.55 raise (eased), 0.55..0.75 strike, 0.75..1 recover
    if u < 0.55:
        raise_t = math.sin((u / 0.55) * math.pi / 2.0)
    elif u < 0.75:
        raise_t = 1.0 - (u - 0.55) / 0.20
    else:
        raise_t = 0.0
    strike = 1.0 if 0.55 <= u < 0.75 else 0.0
    side = facing in ("left", "right")
    reach = {"chop": 1.0, "mine": 0.9, "build": 0.6, "harvest": 1.2}.get(action, 1.0)
    up = (1.9 if action != "harvest" else 0.4) * raise_t * (0.6 if action == "build" else 1.0)
    back = -1.1 * raise_t
    fwd = 1.6 * reach * strike

    def _move(name, dz, dy, zsign=1.0):
        j = out.joints.get(name)
        if j is None:
            return
        if side:
            j.z += dz * zsign
            j.y -= dy
        else:
            j.x += dz * 0.5 * zsign
            j.y -= dy * 0.8

    for hand, elbow, shoulder in (("hand_r", "elbow_r", "shoulder_r"), ("hand_l", "elbow_l", "shoulder_l")):
        _move(hand, back + fwd, up)
        _move(elbow, (back + fwd) * 0.6, up * 0.55)
        _move(shoulder, (back + fwd) * 0.15, 0.0)
    dip = (0.55 if action == "mine" else 0.35) * strike + (0.3 if action == "harvest" else 0.0) * raise_t
    for joint in out.joints.values():
        joint.y += dip
    for name in ("hip_r", "knee_r", "foot_r"):
        _move(name, 0.3 * strike, 0.0)
    return out


def attack_pose(rig: Rig, frame: int, nframes: int = 4, facing: str = "front") -> Rig:
    """Wind-up, committed weapon strike, and recovery for a humanoid rig."""
    out = rig.copy()
    n = max(1, nframes - 1)
    u = frame / float(n)
    extend = math.sin(u * math.pi)
    windup = max(0.0, 1.0 - u * 2.0)
    thrust = 1.8 * extend - 1.15 * windup
    lift = 0.55 * extend
    side = facing in ("left", "right")

    def _limb(name: str, forward: float, up: float, zsign: float = 1.0):
        if name not in out.joints:
            return
        joint = out.joints[name]
        if side:
            joint.z += forward * zsign
            joint.y -= up
        else:
            joint.x += forward * 0.7
            joint.y -= up * 0.45

    _limb("hand_r", thrust, lift, 1.0)
    _limb("elbow_r", thrust * 0.65, lift * 0.5, 1.0)
    _limb("shoulder_r", thrust * 0.16, 0.0, 0.6)
    _limb("hand_l", -extend * 0.35, 0.0, -1.0)
    _limb("shoulder_l", -extend * 0.12, 0.0, -0.5)
    _limb("hip_r", extend * 0.28, 0.0, 1.0)
    _limb("knee_r", extend * 0.42, 0.0, 1.0)
    _limb("foot_r", extend * 0.55, 0.0, 1.0)

    # The whole silhouette dips into the impact instead of hovering rigidly.
    for joint in out.joints.values():
        joint.y += 0.35 * extend
    return out


COMBAT_ACTIONS = ("idle", "walk", "attack", "cast", "hurt", "death")


def cast_pose(rig: Rig, frame: int, nframes: int = 4, facing: str = "front") -> Rig:
    """Channeling magic: both hands rise skyward and pulse with arcane recoil."""
    out = rig.copy()
    u = (frame % max(1, nframes)) / float(max(1, nframes))
    surge = math.sin(u * math.pi)
    pulse = 0.35 * math.sin(u * 2.0 * math.pi)
    side = facing in ("left", "right")

    for hand, elbow, shoulder, xsign in (
        ("hand_r", "elbow_r", "shoulder_r", 1.0),
        ("hand_l", "elbow_l", "shoulder_l", -1.0),
    ):
        if hand in out.joints:
            j = out.joints[hand]
            j.y -= 3.8 * (0.45 + 0.55 * surge)
            if side:
                j.z += (1.2 + 0.8 * surge)
            else:
                j.x += xsign * (0.7 + 0.5 * surge)
        if elbow in out.joints:
            j = out.joints[elbow]
            j.y -= 2.1 * (0.45 + 0.55 * surge)
            if side:
                j.z += 0.7 * surge
        if shoulder in out.joints:
            out.joints[shoulder].y -= 0.45 * surge

    # Slight levitating brace across head & torso
    for j in out.joints.values():
        j.y -= 0.25 * surge + 0.15 * pulse
    return out


def hurt_pose(rig: Rig, frame: int, nframes: int = 4, facing: str = "front") -> Rig:
    """Hit-stagger: knockback recoil on impact frames, then braced recovery."""
    out = rig.copy()
    n = max(1, nframes - 1)
    u = frame / float(n)
    recoil = math.sin(min(1.0, u * 1.2) * math.pi)
    side = facing in ("left", "right")
    zpush = -1.6 * recoil
    xpush = -0.9 * recoil

    for name in ("head", "neck", "torso", "nose", "eye_l", "eye_r"):
        if name in out.joints:
            j = out.joints[name]
            if side:
                j.z += zpush
            else:
                j.x += xpush
            j.y -= 0.4 * recoil

    # Arms fly up/out defensively on stagger
    for name, sgn in (("hand_l", -1.0), ("hand_r", 1.0), ("elbow_l", -1.0), ("elbow_r", 1.0)):
        if name in out.joints:
            j = out.joints[name]
            j.y -= 1.6 * recoil
            j.x += sgn * 0.9 * recoil
    return out


def death_pose(rig: Rig, frame: int, nframes: int = 4, facing: str = "front") -> Rig:
    """Progressive collapse onto the ground plane over ``0..nframes-1``."""
    out = rig.copy()
    n = max(1, nframes - 1)
    u = min(1.0, max(0.0, frame / float(n)))
    t = u * u * (3.0 - 2.0 * u)  # smoothstep fall progression

    foot_l = out.joints.get("foot_l")
    foot_r = out.joints.get("foot_r")
    ground_y = 29.0
    if foot_l and foot_r:
        ground_y = max(foot_l.y, foot_r.y)

    side = facing in ("left", "right")
    for name, j in out.joints.items():
        if name in ("foot_l", "foot_r"):
            if side:
                j.z += 1.4 * t
            j.y = min(29.5, j.y + 0.5 * t)
            continue
        if name in ("knee_l", "knee_r"):
            j.y = j.y + (ground_y - 1.5 - j.y) * (t * 0.88)
            if side:
                j.z += 0.9 * t
            continue
        # Upper body drops toward ground_y while spreading slightly laterally
        drop = (ground_y - 2.2 - j.y) * (t * 0.92)
        j.y = min(28.5, j.y + drop)
        if name in ("hand_l", "elbow_l"):
            j.x -= 1.8 * t
        elif name in ("hand_r", "elbow_r"):
            j.x += 1.8 * t
        elif name in ("head", "neck", "nose", "eye_l", "eye_r"):
            # Tilt head onto one side on final collapse
            if side:
                j.z -= 2.2 * t
            else:
                j.x -= 2.0 * t
    return out


class PoseImputer:
    """Synthesise a missing view from a front buffer + per-row depth.

    This is the closed-form stand-in for MDIGAN / CollaGAN-3 (guide §1):
    given a front silhouette we build a depth field from half-width, then
    splat into the target domain.  Used as a fallback / debug path; the
    primary renderer projects a 3-D rig instead.
    """

    def depth_field(self, src: Canvas) -> List[List[float]]:
        w, h = src.w, src.h
        depth = [[0.0] * w for _ in range(h)]
        for y in range(h):
            xs = [x for x in range(w) if src.opaque(x, y)]
            if not xs:
                continue
            lo, hi = xs[0], xs[-1]
            mid = 0.5 * (lo + hi)
            half = max(0.5, 0.5 * (hi - lo))
            for x in xs:
                # cylindrical depth: 1 at centre, 0 at silhouette edge
                depth[y][x] = 1.0 - abs(x - mid) / half
        return depth

    def impute(self, src: Canvas, direction: str) -> Canvas:
        if direction == "front":
            return src.clone()
        if direction == "back":
            out = Canvas(src.w, src.h)
            for y in range(src.h):
                for x in range(src.w):
                    if src.opaque(x, y):
                        out.set(src.w - 1 - x, y, src.get(x, y), src.get_tag(x, y))
            return out
        # side: splat by depth
        depth = self.depth_field(src)
        out = Canvas(src.w, src.h)
        cx = (src.w - 1) / 2.0
        sign = 1.0 if direction == "right" else -1.0
        # painter: far to near
        order = []
        for y in range(src.h):
            for x in range(src.w):
                if src.opaque(x, y):
                    order.append((depth[y][x], x, y))
        order.sort()  # far (small depth) first
        for d, x, y in order:
            sx = int(round(cx + sign * (d - 0.15) * (src.w * 0.22)))
            out.set(sx, y, src.get(x, y), src.get_tag(x, y))
        return out
