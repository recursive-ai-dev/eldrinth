import { describe, expect, it } from "vitest";
import {
  BLOB_47_MASKS,
  blobMaskIndex,
  canonicalBlobMask,
  frameRectFor,
  resolveActionName,
  staticFrameRectFor,
  type SpriteManifest,
} from "./spriteAtlas";

const manifest: SpriteManifest = {
  kind: "human",
  cellW: 32,
  cellH: 32,
  directions: ["front", "right", "back", "left"],
  actions: { walk: { row: 0, frames: 4 }, attack: { row: 1, frames: 4 } },
  static: false,
};

describe("sprite frame lookup", () => {
  it("places the first walk frame at the origin", () => {
    expect(frameRectFor(manifest, "front", "walk", 0)).toEqual({ sx: 0, sy: 0, sw: 32, sh: 32 });
  });

  it("offsets by direction inside an action block", () => {
    expect(frameRectFor(manifest, "back", "walk", 0)?.sy).toBe(64);
  });

  it("offsets attack below all walk directions", () => {
    expect(frameRectFor(manifest, "front", "attack", 0)?.sy).toBe(128);
  });

  it("wraps positive and negative frame indices", () => {
    expect(frameRectFor(manifest, "front", "walk", 5)?.sx).toBe(32);
    expect(frameRectFor(manifest, "front", "walk", -1)?.sx).toBe(96);
  });

  it("rejects unknown actions and directions", () => {
    expect(frameRectFor(manifest, "front", "idle", 0)).toBeNull();
    expect(frameRectFor(manifest, "diagonal", "walk", 0)).toBeNull();
  });

  it("resolves fallback actions cleanly when optional clips are absent", () => {
    expect(resolveActionName(manifest, "idle")).toBe("walk");
    expect(resolveActionName(manifest, "cast")).toBe("attack");
    expect(resolveActionName(manifest, "death")).toBe("walk");
    const fullManifest: SpriteManifest = {
      ...manifest,
      actions: {
        idle: { row: 0, frames: 4 },
        walk: { row: 1, frames: 4 },
        attack: { row: 2, frames: 4 },
        cast: { row: 3, frames: 4 },
        hurt: { row: 4, frames: 4 },
        death: { row: 5, frames: 4 },
      },
    };
    expect(resolveActionName(fullManifest, "cast")).toBe("cast");
    expect(frameRectFor(fullManifest, "front", "death", 3)).toEqual({ sx: 96, sy: 640, sw: 32, sh: 32 });
  });
});

describe("47-tile Blob Wang bitmask lookup", () => {
  it("enumerates all 47 canonical 8-neighbor Blob masks", () => {
    expect(BLOB_47_MASKS).toHaveLength(47);
    expect(BLOB_47_MASKS[0]).toBe(0);
    expect(BLOB_47_MASKS[46]).toBe(255);
  });

  it("ignores diagonal bits unless both adjacent cardinal neighbors are present", () => {
    // Isolated tile with all 4 diagonals set collapses to mask 0
    expect(canonicalBlobMask(16 | 32 | 64 | 128)).toBe(0);
    expect(blobMaskIndex(16 | 32 | 64 | 128)).toBe(0);
    // N + E + NE keeps NE (16), drops SW (64) since S/W are absent
    expect(canonicalBlobMask(1 | 2 | 16 | 64)).toBe(1 | 2 | 16);
    expect(BLOB_47_MASKS[blobMaskIndex(1 | 2 | 16 | 64)]).toBe(1 | 2 | 16);
    // Full interior tile maps to index 46
    expect(blobMaskIndex(255)).toBe(46);
  });

  it("slices 2D grid-wrapped static Blob atlases cleanly", () => {
    const blobTile: SpriteManifest = {
      kind: "tile",
      cellW: 32,
      cellH: 32,
      columns: 16,
      static: true,
      frames: 188,
    };
    expect(staticFrameRectFor(blobTile, 0)).toEqual({ sx: 0, sy: 0, sw: 32, sh: 32 });
    expect(staticFrameRectFor(blobTile, 15)).toEqual({ sx: 480, sy: 0, sw: 32, sh: 32 });
    expect(staticFrameRectFor(blobTile, 16)).toEqual({ sx: 0, sy: 32, sw: 32, sh: 32 });
    expect(staticFrameRectFor(blobTile, 187)).toEqual({ sx: 352, sy: 352, sw: 32, sh: 32 });
  });
});
