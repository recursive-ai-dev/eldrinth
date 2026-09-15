import { describe, expect, it } from "vitest";
import { generateMap } from "./map";
import { TILE, tileDefinition } from "./constants";
import type { MapData, Vec } from "./types";

function canWalk(map: MapData, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const tile = map.tiles[y * map.width + x];
  const def = tileDefinition(tile);
  return def.shape === "none" || def.shape === "oneWayUp" || def.shape === "trigger";
}

function findPathBFS(map: MapData, start: Vec, target: Vec): boolean {
  const width = map.width;
  const height = map.height;
  const visited = new Uint8Array(width * height);
  const queue: Vec[] = [start];
  visited[start.y * width + start.x] = 1;

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    if (x === target.x && y === target.y) return true;

    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const i = ny * width + nx;
      if (visited[i]) continue;
      if (!canWalk(map, nx, ny)) continue;
      visited[i] = 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return false;
}

describe("expanded map exploration & reachability", () => {
  it("allows walking from Old Lands spawn to every landmark and fortress", () => {
    const map = generateMap("overworld");
    const spawnTile = {
      x: Math.floor(map.spawn.x / TILE),
      y: Math.floor(map.spawn.y / TILE),
    };
    expect(canWalk(map, spawnTile.x, spawnTile.y)).toBe(true);

    const targets = [
      { name: "Ilyarael Wayfire", pos: { x: Math.floor(map.campfires[0].x / TILE), y: Math.floor(map.campfires[0].y / TILE) } },
      { name: "Orithel", pos: { x: Math.floor(map.npc.x / TILE), y: Math.floor(map.npc.y / TILE) } },
      ...map.exits.map((e) => ({ name: `Exit: ${e.label}`, pos: { x: e.x, y: e.y } })),
    ];

    for (const { name, pos } of targets) {
      const reached = findPathBFS(map, spawnTile, pos);
      expect(reached, `Expected route to ${name} at (${pos.x}, ${pos.y}) to be walkable`).toBe(true);
    }
  });

  it("allows walking from Cinderwild wayfire to every fortress and exit", () => {
    const map = generateMap("cinderwild");
    const hub = { x: 80, y: 56 };
    expect(canWalk(map, hub.x, hub.y)).toBe(true);

    for (const exit of map.exits) {
      const reached = findPathBFS(map, hub, { x: exit.x, y: exit.y });
      expect(reached, `Expected route to ${exit.label} at (${exit.x}, ${exit.y}) to be walkable`).toBe(true);
    }
  });

  it("allows walking from Moonlit Coast wayfire to every fortress and exit", () => {
    const map = generateMap("moonlit-coast");
    const hub = { x: 80, y: 56 };
    expect(canWalk(map, hub.x, hub.y)).toBe(true);

    for (const exit of map.exits) {
      const reached = findPathBFS(map, hub, { x: exit.x, y: exit.y });
      expect(reached, `Expected route to ${exit.label} at (${exit.x}, ${exit.y}) to be walkable`).toBe(true);
    }
  });

  it("allows walking from Starfall Moors wayfire to every fortress and exit", () => {
    const map = generateMap("starfall-moors");
    const hub = { x: 80, y: 56 };
    expect(canWalk(map, hub.x, hub.y)).toBe(true);

    for (const exit of map.exits) {
      const reached = findPathBFS(map, hub, { x: exit.x, y: exit.y });
      expect(reached, `Expected route to ${exit.label} at (${exit.x}, ${exit.y}) to be walkable`).toBe(true);
    }
  });

  it("ensures every fortress return destination is walkable and near its gate", () => {
    const overworld = generateMap("overworld");
    const cinderwild = generateMap("cinderwild");
    const coast = generateMap("moonlit-coast");
    const moors = generateMap("starfall-moors");
    const regions = { overworld, cinderwild, "moonlit-coast": coast, "starfall-moors": moors };

    for (const [regionId, region] of Object.entries(regions)) {
      const fortressExits = region.exits.filter((exit) => exit.targetRegion.startsWith("fortress."));
      for (const fExit of fortressExits) {
        const fortressMap = generateMap(fExit.targetRegion);
        const exitBack = fortressMap.exits[0];
        expect(exitBack.targetRegion).toBe(regionId);

        const destTileX = Math.floor(exitBack.destination.x / TILE);
        const destTileY = Math.floor(exitBack.destination.y / TILE);

        // Destination must be directly adjacent to the fortress gate
        const distToGate = Math.hypot(destTileX - fExit.x, destTileY - fExit.y);
        expect(distToGate).toBeLessThanOrEqual(2);

        // Destination must be a walkable floor tile
        expect(canWalk(region, destTileX, destTileY)).toBe(true);
      }
    }
  });
});
