#!/usr/bin/env python3
"""
A tiny 5x7 bitmap pixel font.
=============================

Covers ``A-Z``, ``0-9``, space and ``. , ! ? : ' -``.  Lowercase is drawn as
uppercase and every other character is drawn as ``?``, so :func:`draw_text`
never raises on any string.  Glyphs are 7 rows of 5 characters, ``#`` = ink.
Pure function of its inputs: identical calls give identical pixels.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from PIL import Image

GLYPH_W = 5
GLYPH_H = 7
#: Blank columns between glyphs / blank rows between lines (before scaling).
SPACING = 1

GLYPHS: Dict[str, Tuple[str, ...]] = {
    "A": (".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"),
    "B": ("####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."),
    "C": (".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."),
    "D": ("####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."),
    "E": ("#####", "#....", "#....", "####.", "#....", "#....", "#####"),
    "F": ("#####", "#....", "#....", "####.", "#....", "#....", "#...."),
    "G": (".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"),
    "H": ("#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"),
    "I": (".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."),
    "J": ("..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."),
    "K": ("#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"),
    "L": ("#....", "#....", "#....", "#....", "#....", "#....", "#####"),
    "M": ("#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"),
    "N": ("#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"),
    "O": (".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."),
    "P": ("####.", "#...#", "#...#", "####.", "#....", "#....", "#...."),
    "Q": (".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"),
    "R": ("####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"),
    "S": (".####", "#....", "#....", ".###.", "....#", "....#", "####."),
    "T": ("#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."),
    "U": ("#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."),
    "V": ("#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."),
    "W": ("#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."),
    "X": ("#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"),
    "Y": ("#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."),
    "Z": ("#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"),
    "0": (".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."),
    "1": ("..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."),
    "2": (".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"),
    "3": ("#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."),
    "4": ("...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."),
    "5": ("#####", "#....", "####.", "....#", "....#", "#...#", ".###."),
    "6": ("..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."),
    "7": ("#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."),
    "8": (".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."),
    "9": (".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."),
    " ": (".....", ".....", ".....", ".....", ".....", ".....", "....."),
    ".": (".....", ".....", ".....", ".....", ".....", ".##..", ".##.."),
    ",": (".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."),
    "!": ("..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."),
    "?": (".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."),
    ":": (".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."),
    "'": ("..#..", "..#..", ".#...", ".....", ".....", ".....", "....."),
    "-": (".....", ".....", ".....", "#####", ".....", ".....", "....."),
}


def _glyph(ch: str) -> Tuple[str, ...]:
    return GLYPHS.get(ch.upper() if ch.isascii() else ch, GLYPHS["?"])


def text_width(text: str, scale: int = 1) -> int:
    """Pixel width of ``text`` drawn on one line (0 for empty text)."""
    if not text:
        return 0
    return (len(text) * (GLYPH_W + SPACING) - SPACING) * scale


def wrap_lines(text: str, max_width: Optional[int], scale: int = 1) -> List[str]:
    """Split ``text`` into lines no wider than ``max_width``, breaking on spaces.

    A single word wider than ``max_width`` keeps its own line (and is clipped
    when drawn).  Without ``max_width`` the text is one line.
    """
    if max_width is None:
        return [text]
    lines: List[str] = []
    current = ""
    for word in text.split(" "):
        if not word:
            continue
        candidate = f"{current} {word}" if current else word
        if current and text_width(candidate, scale) > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current or not lines:
        lines.append(current)
    return lines


def draw_text(img: Image.Image, text: str, xy: Tuple[int, int],
              fill: Tuple[int, int, int], scale: int = 1,
              max_width: Optional[int] = None) -> Tuple[int, int]:
    """Draw ``text`` with its top-left at ``xy``; return the ``(width, height)`` drawn.

    With ``max_width`` the text wraps on spaces.  Ink outside the image is
    clipped, and the returned size is clipped to the image too.
    """
    text = str(text)
    scale = max(1, int(scale))
    x0, y0 = int(xy[0]), int(xy[1])
    iw, ih = img.size
    ink = (int(fill[0]), int(fill[1]), int(fill[2]), 255)
    pixels = img.load()
    line_h = (GLYPH_H + SPACING) * scale

    lines = wrap_lines(text, max_width, scale)
    for row, line in enumerate(lines):
        ly = y0 + row * line_h
        if ly >= ih:
            break
        for col, ch in enumerate(line):
            gx = x0 + col * (GLYPH_W + SPACING) * scale
            if gx >= iw:
                break
            for gy, bits in enumerate(_glyph(ch)):
                for bx, bit in enumerate(bits):
                    if bit != "#":
                        continue
                    for dy in range(scale):
                        py = ly + gy * scale + dy
                        if not 0 <= py < ih:
                            continue
                        for dx in range(scale):
                            px = gx + bx * scale + dx
                            if 0 <= px < iw:
                                pixels[px, py] = ink

    width = max((text_width(line, scale) for line in lines), default=0)
    height = len(lines) * line_h - SPACING * scale if width else 0
    width = max(0, min(width, iw - x0))
    height = max(0, min(height, ih - y0))
    return width, height
