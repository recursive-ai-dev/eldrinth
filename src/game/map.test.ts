import { describe, expect, it } from "vitest";
import { generateMap } from "./map";
import { FORTRESS_LAYOUTS } from "./fortressLayouts";

describe("the landmark-led journey", () => {
  it("places every shard in its own reachable fortress", () => {
    const overworld = generateMap("overworld");
    const cinderwild = generateMap("cinderwild");
    const coast = generateMap("moonlit-coast");
    const moors = generateMap("starfall-moors");
    const frontierMaps = [overworld, cinderwild, coast, moors];
    const fortressIds = Object.keys(FORTRESS_LAYOUTS);
    const fortressMaps = fortressIds.map(generateMap);

    expect(fortressMaps).toHaveLength(9);
    expect(frontierMaps.every((map) => map.shards.length === 0)).toBe(true);
    expect(fortressMaps.every((map) => map.shards.length === 1)).toBe(true);
    expect(fortressMaps.reduce((total, map) => total + map.shards.length, 0)).toBe(9);
    expect(fortressMaps.every((map) => map.dark && map.resetOnDeath && map.campfires.length === 0)).toBe(true);

    const fortressExits = frontierMaps.flatMap((map) => map.exits)
      .filter((exit) => exit.targetRegion.startsWith("fortress."));
    expect(fortressExits.map((exit) => exit.targetRegion).sort()).toEqual(fortressIds.sort());
    for (const exit of fortressExits) {
      expect(exit.destination).toEqual(generateMap(exit.targetRegion).spawn);
    }

    expect(overworld.enemySpawns).toHaveLength(12);
    expect([cinderwild, coast, moors].every((map) => map.enemySpawns.length === 6)).toBe(true);
    expect(overworld.exits.filter((exit) => !exit.targetRegion.startsWith("fortress.")).map((exit) => exit.targetRegion).sort()).toEqual(["cinderwild", "moonlit-coast"]);
    expect(cinderwild.signs.map((sign) => sign.fact)).toContain("courier-memory");
    expect(coast.signs.map((sign) => sign.fact)).toEqual(expect.arrayContaining(["salt-graves", "salt-beacon"]));
    expect(moors.signs.map((sign) => sign.fact)).toContain("dawn-record");
  });
});
