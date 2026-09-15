import { describe, expect, it } from "vitest";
import { generateMap } from "./map";
import { FORTRESS_LAYOUTS } from "./fortressLayouts";
import { MAP_W, MAP_H, TILE, tileDefinition } from "./constants";

describe("the landmark-led journey", () => {
  it("places every shard in its own reachable fortress across expanded maps", () => {
    const overworld = generateMap("overworld");
    const cinderwild = generateMap("cinderwild");
    const coast = generateMap("moonlit-coast");
    const moors = generateMap("starfall-moors");
    const frontierMaps = [overworld, cinderwild, coast, moors];
    const fortressIds = Object.keys(FORTRESS_LAYOUTS);
    const fortressMaps = fortressIds.map(generateMap);

    // Map dimensions are expanded to 200 x 140
    expect(MAP_W).toBe(200);
    expect(MAP_H).toBe(140);
    expect(frontierMaps.every((map) => map.width === 200 && map.height === 140)).toBe(true);

    // Shards live solely inside fortresses
    expect(fortressMaps).toHaveLength(9);
    expect(frontierMaps.every((map) => map.shards.length === 0)).toBe(true);
    expect(fortressMaps.every((map) => map.shards.length === 1)).toBe(true);
    expect(fortressMaps.reduce((total, map) => total + map.shards.length, 0)).toBe(9);
    expect(fortressMaps.every((map) => map.dark && map.resetOnDeath && map.campfires.length === 0)).toBe(true);

    const fortressExits = frontierMaps
      .flatMap((map) => map.exits)
      .filter((exit) => exit.targetRegion.startsWith("fortress."));
    expect(fortressExits.map((exit) => exit.targetRegion).sort()).toEqual(fortressIds.sort());
    for (const exit of fortressExits) {
      expect(exit.destination).toEqual(generateMap(exit.targetRegion).spawn);
    }

    // Every fortress requires a substantial journey across the map (at least 25 tiles from spawn/wayfire)
    for (const region of frontierMaps) {
      const spawnTile = {
        x: Math.floor(region.spawn.x / TILE),
        y: Math.floor(region.spawn.y / TILE),
      };
      const regionFortressExits = region.exits.filter((exit) => exit.targetRegion.startsWith("fortress."));
      for (const fExit of regionFortressExits) {
        const dist = Math.hypot(fExit.x - spawnTile.x, fExit.y - spawnTile.y);
        expect(dist).toBeGreaterThanOrEqual(25);

        // Gateway tile itself must be walkable
        const gateTile = region.tiles[fExit.y * region.width + fExit.x];
        expect(tileDefinition(gateTile).shape).toBe("none");
      }
    }

    // Enemy patrols scaled for the expanded regions
    expect(overworld.enemySpawns).toHaveLength(18);
    expect([cinderwild, coast, moors].every((map) => map.enemySpawns.length === 10)).toBe(true);

    // Inter-region connections
    expect(
      overworld.exits
        .filter((exit) => !exit.targetRegion.startsWith("fortress.") && !exit.targetRegion.startsWith("interior."))
        .map((exit) => exit.targetRegion)
        .sort()
    ).toEqual(["cinderwild", "moonlit-coast"]);

    // Key lore signs and facts
    expect(overworld.signs.map((sign) => sign.fact).filter(Boolean)).toContain("courier-orders");
    expect(cinderwild.signs.map((sign) => sign.fact)).toContain("courier-memory");
    expect(coast.signs.map((sign) => sign.fact)).toEqual(expect.arrayContaining(["salt-graves", "salt-beacon"]));
    expect(moors.signs.map((sign) => sign.fact)).toContain("dawn-record");
  });
});
