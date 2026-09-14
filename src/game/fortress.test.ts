import { describe, expect, it } from "vitest";
import { T } from "./constants";
import { parseFortressLayout, shardIsReachable, unreachableSpawns } from "./fortress";

const TINY = [
  "#####",
  "#D..#",
  "#.#.#",
  "#*S.#",
  "#####",
];

describe("parseFortressLayout", () => {
  it("maps every glyph to the right tile and position", () => {
    const layout = parseFortressLayout(TINY);

    expect(layout.width).toBe(5);
    expect(layout.height).toBe(5);
    expect(layout.door).toEqual({ x: 1, y: 1 });
    expect(layout.shard).toEqual({ x: 2, y: 3 });
    expect(layout.braziers).toEqual([{ x: 1, y: 3 }]);
    expect(layout.tiles[0 * 5 + 0]).toBe(T.RWALL);
    expect(layout.tiles[1 * 5 + 2]).toBe(T.RFLOOR);
  });

  it("treats the door, shard, brazier and spawn glyphs as walkable floor", () => {
    const layout = parseFortressLayout(TINY);
    for (const p of [layout.door, layout.shard, ...layout.braziers]) {
      expect(layout.tiles[p.y * layout.width + p.x]).toBe(T.RFLOOR);
    }
  });

  it("collects wardens and ordinary enemies separately", () => {
    const layout = parseFortressLayout(["#####", "#D.W#", "#.E.#", "#..S#", "#####"]);
    expect(layout.warden).toEqual({ x: 3, y: 1 });
    expect(layout.enemies).toEqual([{ x: 2, y: 2 }]);
  });

  it("rejects ragged rows", () => {
    expect(() => parseFortressLayout(["###", "#D.S#", "###"])).toThrow(/width/i);
  });

  it("rejects an unknown glyph", () => {
    expect(() => parseFortressLayout(["####", "#DZ#", "#.S#", "####"])).toThrow(/Z/);
  });

  it("rejects a layout without exactly one shard", () => {
    expect(() => parseFortressLayout(["####", "#D.#", "#..#", "####"])).toThrow(/shard/i);
    expect(() => parseFortressLayout(["####", "#DS#", "#S.#", "####"])).toThrow(/shard/i);
  });

  it("rejects a layout without exactly one door", () => {
    expect(() => parseFortressLayout(["####", "#.S#", "#..#", "####"])).toThrow(/door/i);
    expect(() => parseFortressLayout(["####", "#DS#", "#D.#", "####"])).toThrow(/door/i);
  });
});

describe("shardIsReachable", () => {
  it("accepts a shard the player can walk to", () => {
    expect(shardIsReachable(parseFortressLayout(TINY))).toBe(true);
  });

  it("rejects a shard sealed behind walls", () => {
    const sealed = parseFortressLayout([
      "######",
      "#D.#S#",
      "#..###",
      "######",
    ]);
    expect(shardIsReachable(sealed)).toBe(false);
  });
});

describe("unreachableSpawns", () => {
  it("finds nothing when every spawn can be walked to", () => {
    const layout = parseFortressLayout(["#####", "#D.W#", "#.E.#", "#..S#", "#####"]);
    expect(unreachableSpawns(layout)).toEqual([]);
  });

  it("reports a warden sealed behind walls", () => {
    const layout = parseFortressLayout([
      "######",
      "#DS#W#",
      "#..###",
      "######",
    ]);
    expect(unreachableSpawns(layout)).toEqual([{ x: 4, y: 1 }]);
  });
});
