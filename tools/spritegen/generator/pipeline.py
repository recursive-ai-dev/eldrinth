#!/usr/bin/env python3
"""
Shared production pipeline.
===========================

Every generator rasterises into a :class:`Canvas` then runs this gate:

    prune L-corners → inward 1px ink outline → centre-of-gravity align
    → optional CIELAB quantization → optional EPX/Scale2x

The gate is a pure function of ``(canvas, options)`` so it cannot inject
entropy.  Animation frames share the same options, which is what keeps
style drift at zero (guide §5 + §6).
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Set, Tuple

from .math.canvas import Canvas
from .math.pixel import (
    prune_l_corners, inward_outline, sel_out_outline, internal_crease,
    cog_align, scale2x, scale_nn,
)
from .math.palette import quantize_canvas, shade_triplet, snap_canvas_to_palette, MASTER_PALETTES
from .math.ffd import FFDGrid, apply_ffd

RGB = Tuple[int, int, int]


def finalize(
    canvas: Canvas,
    outline: Optional[RGB] = None,
    quantize: Optional[int] = None,
    master_palette: Optional[str] = None,
    use_scale2x: bool = False,
    scale: int = 1,
    align: bool = True,
    prune: bool = True,
    ffd_frame: Optional[int] = None,
    ffd_frames: int = 4,
    ffd_amp: float = 0.0,
    ffd_tags: Optional[Set[int]] = None,
    sel_out: bool = False,
    ink_bias: Optional[RGB] = None,
    crease_pairs: Optional[Tuple[Tuple[int, int], ...]] = None,
) -> Canvas:
    """Run the production gate.  All flags default to the pixel-art look."""
    out = canvas
    if ffd_amp and ffd_frame is not None:
        grid = FFDGrid(out.w, out.h, nx=5, ny=5)
        grid.set_wave(ffd_frame, nframes=ffd_frames, amp=ffd_amp)
        out = apply_ffd(out, grid, tags=ffd_tags)
    if prune:
        out = prune_l_corners(out)
    if crease_pairs:
        out = internal_crease(out, crease_pairs, ink_bias=ink_bias or (16, 13, 24))
    if sel_out:
        out = sel_out_outline(out, ink_bias=ink_bias or (16, 13, 24))
        out = prune_l_corners(out)
    elif outline is not None:
        out = inward_outline(out, outline)
        out = prune_l_corners(out)
    if align:
        out = cog_align(out)
    if master_palette and str(master_palette).lower() in MASTER_PALETTES:
        out = snap_canvas_to_palette(out, str(master_palette).lower())
    elif quantize:
        out = quantize_canvas(out, n=int(quantize))
    if use_scale2x:
        out = scale2x(out)
    elif scale and scale > 1:
        out = scale_nn(out, int(scale))
    return out


def options_from(options: Dict[str, Any]) -> Dict[str, Any]:
    """Pull known pipeline flags out of a generator ``**options`` dict."""
    mp = (options.get("master_palette") or "").lower().strip() or None
    return {
        "quantize": options.get("quantize"),
        "master_palette": mp,
        "use_scale2x": bool(options.get("scale2x") or options.get("use_scale2x")),
        "scale": int(options.get("scale") or 1),
        "align": options.get("align", True),
        "prune": options.get("prune", True),
        "direction": (options.get("direction") or "front").lower(),
        "action": (options.get("action") or "walk").lower(),
        "frame": int(options.get("frame") or 0),
        "frames": int(options.get("frames") or 4),
        "ffd": float(options.get("ffd") or 0.0),
    }
