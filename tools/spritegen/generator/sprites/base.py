#!/usr/bin/env python3
"""
Sprite base classes and the low-level, deterministic pixel toolkit.
====================================================================

``SpriteGenerator`` is the shared contract for every sprite type in Shed Dev Sprites:

    * Each generator takes a single integer ``seed``.
    * ``generate(seed)`` builds a deterministic *spec* (a plain dict of every
      parameter that was chosen) and *renders* it to an RGBA PIL image, then
      wraps both in a ``Sprite``.
    * The ``spec`` is a pure function of the seed.  Re-running with the same
      seed reproduces the exact same spec and the exact same pixels.

The drawing helpers at the bottom of this module are tiny and deterministic:
they operate purely on integer pixel coordinates and base colors, with no
hidden state.  This keeps the whole engine auditable and portable.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Tuple, Union

from PIL import Image, ImageDraw

from ..rng import RNG, derive, clamp, string_mix
from .. import color

DEFAULT_SIZE = 32
DIRECTIONS = ("front", "right", "back", "left")
WALK_FRAMES = 4

# ---------------------------------------------------------------------------
# Sprite container
# ---------------------------------------------------------------------------

Pixel = Tuple[int, int, int]  # RGB
PixelA = Tuple[int, int, int, int]  # RGBA


@dataclass
class Sprite:
    """A single generated sprite plus its deterministic provenance."""

    image: Image.Image
    seed: int
    type: str
    spec: Dict[str, Any] = field(default_factory=dict)

    @property
    def pixel_hash(self) -> str:
        """MD5 of the raw RGBA pixel buffer.

        This is the authoritative determinism fingerprint — it is independent
        of PNG encoding/compression differences between Pillow versions, so it
        is the correct thing to compare when verifying "same seed => same
        sprite".
        """
        return hashlib.md5(self.image.tobytes()).hexdigest()

    @property
    def size(self) -> Tuple[int, int]:
        return self.image.size

    def png_bytes(self) -> bytes:
        import io

        buf = io.BytesIO()
        self.image.save(buf, format="PNG", optimize=True)
        return buf.getvalue()

    def data_uri(self) -> str:
        import base64

        return "data:image/png;base64," + base64.b64encode(self.png_bytes()).decode("ascii")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "seed": self.seed,
            "type": self.type,
            "size": list(self.size),
            "pixel_hash": self.pixel_hash,
            "spec": self.spec,
        }


# ---------------------------------------------------------------------------
# Base generator
# ---------------------------------------------------------------------------

class SpriteGenerator:
    """Base class for all deterministic sprite generators.

    Subclasses implement :meth:`_build` which returns ``(spec, image)``.
    Everything shared (seeding, palettes, pixel toolkit) lives here.
    """

    #: Human-readable name, used in metadata / CLI.
    type_name: str = "sprite"
    default_size: Tuple[int, int] = (DEFAULT_SIZE, DEFAULT_SIZE)
    #: Whether `frame` actually changes this type's rendered pixels (walk
    #: kinematics / idle bob). Static types (item/tile/dungeon) ignore
    #: `frame` entirely — the web UI uses this to disable playback for them.
    animated: bool = False

    def __init__(self, size: Optional[int] = None, size_xy: Optional[Tuple[int, int]] = None):
        if size_xy is not None:
            self.size = size_xy
        else:
            s = size or self.default_size[0]
            self.size = (s, s) if size is None else (size, size)
        if self.size[0] <= 0 or self.size[1] <= 0:
            raise ValueError("Sprite size must be positive")

    # -- public API --------------------------------------------------------
    def generate(self, seed=0, **options) -> Sprite:
        """Generate a deterministic sprite from ``seed``.

        ``seed`` may be an integer or a string (a name/hash).  A string seed is
        hashed deterministically via ``string_mix`` so that e.g. ``"bob"``
        always yields the same sprite, on any machine.
        """
        raw_seed = self._normalize_seed(seed)
        spec, image = self._build(raw_seed, **options)
        return Sprite(image=image, seed=raw_seed, type=self.type_name, spec=spec)

    def _normalize_seed(self, seed) -> int:
        if isinstance(seed, str):
            return string_mix(seed)
        if isinstance(seed, float):
            return int(seed)
        return int(seed)

    def generate_many(self, seeds, **options) -> List[Sprite]:
        return [self.generate(s, **options) for s in seeds]

    def generate_poses(self, seed=0, **options) -> List[Sprite]:
        """Four directional views (front, right, back, left) of one seed."""
        return [self.generate(seed, direction=d, **options) for d in DIRECTIONS]

    def generate_walk(self, seed=0, direction: str = "front", frames: int = WALK_FRAMES, **options) -> List[Sprite]:
        """Walk-cycle frames for one direction.  Temporally coherent (same spec)."""
        return [self.generate(seed, direction=direction, frame=i, frames=frames, **options)
                for i in range(frames)]

    def generate_anim_sheet(self, seed=0, frames: int = WALK_FRAMES, **options) -> Tuple[Image.Image, Dict[str, Any]]:
        """4 directions × N frames atlas (row = direction, col = frame)."""
        from .. import sheet as sheetmod
        sprites = []
        for d in DIRECTIONS:
            sprites.extend(self.generate_walk(seed, direction=d, frames=frames, **options))
        img, meta = sheetmod.make_sheet(sprites, cols=frames, margin=1, transparent=True)
        meta["layout"] = "direction-rows x frame-cols"
        meta["directions"] = list(DIRECTIONS)
        meta["frames"] = frames
        return img, meta

    def _build(self, seed: int, **options) -> Tuple[Dict[str, Any], Image.Image]:
        raise NotImplementedError

    # -- deterministic helpers --------------------------------------------
    def rng(self, seed: int, *parts: Any, salt: int = 0) -> RNG:
        """A fresh, order-independent RNG for one named attribute."""
        return RNG(derive(seed, self.type_name, *parts, salt=salt))

    def rand_seed(self, seed: int, *parts: Any, low: int = 0, high: int = 2 ** 63) -> int:
        """A stable integer in ``[low, high]`` derived from ``seed + parts``."""
        return derive(seed, self.type_name, *parts) % (high - low) + low

    # -- palettes ----------------------------------------------------------
    def _palette(self) -> Dict[str, List[Pixel]]:
        return {
            "skin": color.skin_tones(),
            "hair": color.hair_ramp(),
            "eye": color.eye_colors(),
            "clothes": color.clothing_palette(),
            "accent": color.accent_ramp(),
        }

    # -- canvas ------------------------------------------------------------
    def new_canvas(self, bg: Optional[Pixel] = None) -> "ImageDraw.ImageDraw":
        if bg is None:
            img = Image.new("RGBA", self.size, (0, 0, 0, 0))
        else:
            img = Image.new("RGBA", self.size, color.with_alpha(bg, 255))
        return ImageDraw.Draw(img)

    def make_image(self) -> Image.Image:
        return Image.new("RGBA", self.size, (0, 0, 0, 0))

    # -- pixel drawing toolkit --------------------------------------------
    def px(self, draw, x: int, y: int, fill: Pixel) -> None:
        draw.point((int(x), int(y)), fill=color.with_alpha(fill, 255))

    def rect(self, draw, x0, y0, x1, y1, fill: Pixel) -> None:
        """Fill a pixel rectangle, auto-sorting coordinates so calls with
        inverted bounds are safe (the PIL API requires x1>=x0, y1>=y0)."""
        x0, y0, x1, y1 = self._rect_order(x0, y0, x1, y1)
        draw.rectangle([int(x0), int(y0), int(x1), int(y1)], fill=color.with_alpha(fill, 255))

    def _rect_order(self, x0, y0, x1, y1):
        if x1 < x0:
            x0, x1 = x1, x0
        if y1 < y0:
            y0, y1 = y1, y0
        return x0, y0, x1, y1

    def block(self, draw, x0, y0, x1, y1, fill: Pixel, outline: Optional[Pixel] = None) -> None:
        """Fill a pixel block and draw a crisp 1px outline on its perimeter."""
        x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
        if x1 < x0:
            x0, x1 = x1, x0
        if y1 < y0:
            y0, y1 = y1, y0
        draw.rectangle([x0, y0, x1, y1], fill=color.with_alpha(fill, 255))
        if outline is not None:
            oc = color.with_alpha(outline, 255)
            draw.line([(x0, y0), (x1, y0)], fill=oc)
            draw.line([(x0, y1), (x1, y1)], fill=oc)
            draw.line([(x0, y0), (x0, y1)], fill=oc)
            draw.line([(x1, y0), (x1, y1)], fill=oc)

    def block3d(self, draw, x0, y0, x1, y1, base: Pixel,
                outline: Optional[Pixel] = None,
                top_ratio: float = 0.2, bottom_ratio: float = 0.24,
                highlight: float = 0.22, shadow: float = 0.20) -> None:
        """A pixel block with a top highlight and a bottom shadow for depth."""
        x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
        self.block(draw, x0, y0, x1, y1, base, outline)
        h = y1 - y0 + 1
        w = x1 - x0 + 1
        if w > 2 and h > 2:
            top_h = max(1, int(round(h * top_ratio)))
            bot_h = max(1, int(round(h * bottom_ratio)))
            hi = color.lighten(base, highlight)
            sh = color.darken(base, shadow)
            draw.rectangle([x0 + 1, y0 + 1, x1 - 1, min(y0 + top_h, y1 - 1)],
                           fill=color.with_alpha(hi, 255))
            draw.rectangle([x0 + 1, max(y1 - bot_h, y0 + 1), x1 - 1, y1 - 1],
                           fill=color.with_alpha(sh, 255))

    def pixels_in(self, draw, coords, fill: Pixel) -> None:
        c = color.with_alpha(fill, 255)
        for (x, y) in coords:
            draw.point((int(x), int(y)), fill=c)

    def outline_block(self, draw, x0, y0, x1, y1, radius: int = 0, color_p: Pixel = (0, 0, 0)) -> None:
        """Draw a dark outline around a (possibly rounded) pixel block."""
        self.arc_outline(draw, x0, y0, x1, y1, radius, color_p)

    def arc_outline(self, draw, x0, y0, x1, y1, radius: int, color_p: Pixel) -> None:
        """Draw the dark inner-border of a rounded rectangle, used as outline."""
        oc = color.with_alpha(color_p, 255)
        if radius <= 0:
            draw.rectangle([x0, y0, x1, y1], outline=oc)
            return
        draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, outline=oc)

    # -- misc --------------------------------------------------------------
    def _clamp_rect(self, x0, y0, x1, y1):
        return (
            clamp(x0, 0, self.size[0] - 1),
            clamp(y0, 0, self.size[1] - 1),
            clamp(x1, 0, self.size[0] - 1),
            clamp(y1, 0, self.size[1] - 1),
        )
