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


describe("character ground footprint", () => {
  it("allows the upper body to overlap the north wall in a narrow passage", () => {
    const system = movement([
      T.ROCK, T.ROCK, T.ROCK,
      T.GRASS, T.GRASS, T.GRASS,
      T.ROCK, T.ROCK, T.ROCK,
    ], 3, 3);
    const actor = { x: 16, y: 33, r: 10 };
    system.moveEntity(actor, 48, 0);
    expect(actor.x).toBe(64);
    expect(system.hitsSolid(actor.x, actor.y, actor.r)).toBe(false);
    system.moveY(actor, -8);
    expect(actor.y).toBeGreaterThanOrEqual(32);
    expect(actor.y).toBeLessThan(32.1);
    system.moveY(actor, 40);
    expect(actor.y + actor.r).toBeLessThanOrEqual(64);
    expect(actor.y + actor.r).toBeGreaterThan(63.9);
  });

  it("still blocks the sides and the feet while leaving the upper half free", () => {
    const system = movement([
      T.ROCK, T.ROCK, T.ROCK,
      T.ROCK, T.GRASS, T.ROCK,
      T.ROCK, T.ROCK, T.ROCK,
    ], 3, 3);
    expect(system.hitsSolid(48, 32, 10)).toBe(false);
    expect(system.hitsSolid(48, 31, 10)).toBe(true);
    expect(system.hitsSolid(41, 40, 10)).toBe(true);
    expect(system.hitsSolid(55, 40, 10)).toBe(true);
    expect(system.hitsSolid(48, 55, 10)).toBe(true);
  });
});
