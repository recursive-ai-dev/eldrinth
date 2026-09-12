import { describe, expect, it } from "vitest";
import type { FrameRect } from "./spriteAtlas";

// getFrame's math is pure given a manifest + ready state, so test the
// row/col arithmetic directly rather than mocking Vite's import.meta.glob.
function computeFrame(
  manifest: {
    cellW: number;
    cellH: number;
    directions: string[];
    actions: Record<string, { row: number; frames: number }>;
  },
  direction: string,
  action: string,
  frame: number,
): FrameRect | null {
  const actionMeta = manifest.actions[action];
  if (!actionMeta) return null;
  const dirIndex = manifest.directions.indexOf(direction);
  if (dirIndex < 0) return null;
  const row = actionMeta.row * manifest.directions.length + dirIndex;
  const col = frame % actionMeta.frames;
  return { sx: col * manifest.cellW, sy: row * manifest.cellH, sw: manifest.cellW, sh: manifest.cellH };
}

const manifest = {
  cellW: 32,
  cellH: 32,
  directions: ["front", "right", "back", "left"],
  actions: { walk: { row: 0, frames: 4 }, attack: { row: 1, frames: 4 } },
};

describe("sprite frame lookup", () => {
  it("computes the first frame of the first direction at the origin", () => {
    expect(computeFrame(manifest, "front", "walk", 0)).toEqual({ sx: 0, sy: 0, sw: 32, sh: 32 });
  });

  it("offsets rows by direction index within an action", () => {
    expect(computeFrame(manifest, "back", "walk", 0)).toEqual({ sx: 0, sy: 32 * 2, sw: 32, sh: 32 });
  });

  it("offsets rows by action.row * direction count", () => {
    expect(computeFrame(manifest, "front", "attack", 0)).toEqual({ sx: 0, sy: 32 * 4, sw: 32, sh: 32 });
  });

  it("wraps frame index by the action's frame count", () => {
    expect(computeFrame(manifest, "front", "walk", 5)).toEqual(computeFrame(manifest, "front", "walk", 1));
  });

  it("returns null for an unknown action", () => {
    expect(computeFrame(manifest, "front", "idle", 0)).toBeNull();
  });

  it("returns null for an unknown direction", () => {
    expect(computeFrame(manifest, "diagonal", "walk", 0)).toBeNull();
  });
});
