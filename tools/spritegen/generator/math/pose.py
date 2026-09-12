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
