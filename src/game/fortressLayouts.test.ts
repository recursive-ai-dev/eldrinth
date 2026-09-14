import { describe, expect, it } from "vitest";
import { parseFortressLayout, shardIsReachable, unreachableSpawns } from "./fortress";
import { FORTRESS_LAYOUTS } from "./fortressLayouts";

describe("shipped fortress layouts", () => {
  const layouts = FORTRESS_LAYOUTS;

  it("ships nine distinct shard interiors", () => {
    expect(Object.keys(layouts)).toHaveLength(9);
    expect(new Set(Object.values(layouts).map((rows) => rows.join("\\n"))).size).toBe(9);
  });

  for (const [name, rows] of Object.entries(layouts)) {
    it(`${name} parses and is at least 25x19`, () => {
      const layout = parseFortressLayout(rows);
      expect(layout.width).toBeGreaterThanOrEqual(25);
      expect(layout.height).toBeGreaterThanOrEqual(19);
    });

    it(`${name} has a shard the player can reach from the door`, () => {
      expect(shardIsReachable(parseFortressLayout(rows))).toBe(true);
    });

    it(`${name} has a warden and at least one brazier`, () => {
      const layout = parseFortressLayout(rows);
      expect(layout.warden).not.toBeNull();
      expect(layout.braziers.length).toBeGreaterThan(0);
    });

    it(`${name} has no spawn sealed away from the player`, () => {
      expect(unreachableSpawns(parseFortressLayout(rows))).toEqual([]);
    });
  }
});
