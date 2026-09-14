import { describe, expect, it } from "vitest";
import { generateMap } from "./map";

describe("the landmark-led journey", () => {
  it("places all nine shards and their investigation evidence in reachable regions", () => {
    const overworld = generateMap("overworld");
    const cinderwild = generateMap("cinderwild");
    const coast = generateMap("moonlit-coast");
    const moors = generateMap("starfall-moors");
    const brokenShrine = generateMap("fortress.cinderwild-shrine");

    // One of the Cinderwild's two shards now sits inside the Broken Shrine fortress
    // rather than loose on the frontier map, so it's counted via that region instead.
    expect([overworld, cinderwild, coast, moors, brokenShrine].reduce((total, map) => total + map.shards.length, 0)).toBe(9);
    expect(overworld.enemySpawns).toHaveLength(13);
    expect([cinderwild, coast, moors].every((map) => map.enemySpawns.length === 7)).toBe(true);
    expect(overworld.exits.map((exit) => exit.targetRegion).sort()).toEqual(["cinderwild", "moonlit-coast"]);
    expect(cinderwild.signs.map((sign) => sign.fact)).toContain("courier-memory");
    expect(coast.signs.map((sign) => sign.fact)).toEqual(expect.arrayContaining(["salt-graves", "salt-beacon"]));
    expect(moors.signs.map((sign) => sign.fact)).toContain("dawn-record");
  });
});
