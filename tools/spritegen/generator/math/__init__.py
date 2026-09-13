#!/usr/bin/env python3
"""
Shed Dev Sprites mathematical pipeline.
================================

Every pixel of every sprite is a pure function of an integer seed.  This
package is the *engine* of that function: cellular automata, signed distance
fields, cosine palettes, free-form deformation, Wang autotiling, and the
pixel-perfect post process (L-corner pruning, EPX/Scale2x, CIELAB
quantization, centre-of-gravity alignment).

Neural methods from the production literature (MDIGAN / CollaGAN, ResNet18
adjacency, Stable-Diffusion temporal modules) are replaced here by closed-form
equivalents so the generator stays fully mathematical and deterministic:

* Multi-view synthesis  →  3D rig projection + depth-ordered painter
* Connectivity classify →  Wang / blob bitmask autotiling
* Temporal coherence    →  FFD mesh layers (red/yellow/green) + walk kinematics
* Materiality           →  SDF distance thresholds + cosine palettes
"""

from .canvas import Canvas, TAG_EMPTY, TAG_BODY, TAG_BELLY, TAG_HAIR, TAG_CLOTH
from .canvas import TAG_SKIN, TAG_OUTLINE, TAG_ACCENT, TAG_EYE, TAG_METAL, TAG_FLOOR
from .noise import value_noise, fbm, domain_warp, warp_sample, lattice
from .sdf import (
    sd_circle, sd_box, sd_round_box, sd_capsule, sd_ellipse, sd_triangle,
    sd_hexagon, sd_rhombus, op_union, op_sub, op_intersect, op_smooth_union,
    op_onion, rasterize_sdf,
)
from .ca import (
    Grid, ca_step, recover_edge_cells, remove_secluded_cells,
    mirror_horizontal, hilbert_d2xy, cave_generate, density as ca_density,
    VON_NEUMANN, MOORE,
)
from .palette import (
    cosine_palette, named_palette, rgb_to_lab, lab_to_rgb, delta_e,
    median_cut, quantize_canvas, PALETTES,
)
from .pixel import (
    prune_l_corners, inward_outline, scale2x, cog_align, bresenham,
    pixel_line, recover_double_pixels,
)
from .ffd import ControlPoint, FFDGrid, apply_ffd
from .pose import (
    Joint, Rig, DIRECTIONS, project_point, walk_pose, idle_bob, PoseImputer,
)
from .wang import (
    neighbor_mask, autotile_ids, paint_autotile_map, classify_tile,
    segment_tiles, TILE_COMPLETE, TILE_PARTIAL, TILE_TEXTURE, TILE_PARTIAL_TEXTURE,
)

__all__ = [
    "Canvas",
    "value_noise", "fbm", "domain_warp", "warp_sample",
    "sd_circle", "sd_box", "sd_round_box", "sd_capsule",
    "op_union", "op_sub", "rasterize_sdf",
    "Grid", "ca_step", "recover_edge_cells", "remove_secluded_cells",
    "mirror_horizontal", "hilbert_d2xy", "cave_generate",
    "cosine_palette", "named_palette", "delta_e", "median_cut", "quantize_canvas",
    "prune_l_corners", "inward_outline", "scale2x", "cog_align",
    "ControlPoint", "FFDGrid", "apply_ffd",
    "Joint", "Rig", "DIRECTIONS", "walk_pose", "PoseImputer",
    "neighbor_mask", "autotile_ids", "paint_autotile_map", "classify_tile",
]
