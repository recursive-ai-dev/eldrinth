import { describe, expect, it } from "vitest";
import { T } from "../constants";
import { MovementSystem } from "./MovementSystem";

function movement(tiles: number[], width = tiles.length, height = 1) {
  return new MovementSystem({
    width,
    height,
    wardTiles: new Set<number>(),
    wardUnlocked: false,
    tileAt: (x, y) => x < 0 || y < 0 || x >= width || y >= height ? undefined : tiles[y * width + x],
  });
}

describe("MovementSystem tile-shape collision", () => {
  it("derives a fast movement stop from the authoritative tile definition", () => {
    const system = movement([T.GRASS, T.ROCK, T.GRASS]);
    const body = { x: 16, y: 16, r: 8 };
    system.moveX(body, 100);
    expect(body.x).toBeLessThan(24.1);
    expect(body.x).toBeGreaterThan(23);
  });

  it("treats unloaded/out-of-bounds tiles as solid and reports trigger metadata", () => {
    const system = movement([T.TRIGGER]);
    expect(system.hitsSolid(-1, 16, 4)).toBe(true);
    expect(system.hitsSolid(16, 16, 4)).toBe(false);
    expect(system.triggerAtPx(16, 16)).toBe("tile");
  });

  it("honours one-way ledges only while moving down through their top edge", () => {
    const system = movement([T.GRASS, T.LEDGE], 1, 2);
    expect(system.hitsSolid(16, 30, 4, 20)).toBe(true);
    expect(system.hitsSolid(16, 30, 4, 35)).toBe(false);
  });
});
