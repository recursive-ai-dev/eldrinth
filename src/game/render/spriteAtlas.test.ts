import { describe, expect, it } from "vitest";
import { frameRectFor, type SpriteManifest } from "./spriteAtlas";

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
});
