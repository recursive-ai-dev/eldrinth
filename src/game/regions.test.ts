import { describe, expect, it } from "vitest";
import { T } from "./constants";
import { RegionRepository, type RegionSource } from "./regions";

describe("RegionRepository", () => {
  it("keeps a bounded idle look-ahead window instead of retaining the explored world", async () => {
    const source: RegionSource = {
      load: async (id) => ({
        id,
        map: {
          width: 1,
          height: 1,
          tiles: new Uint8Array([T.GRASS]),
          wardTiles: [],
          spawn: { x: 0, y: 0 }, npc: { x: 0, y: 0 }, signs: [], shards: [], enemySpawns: [], bossCenter: { x: 0, y: 0 },
        },
      }),
    };
    const repository = new RegionRepository(source, 2);
    const signal = new AbortController().signal;

    await repository.preload("0,0", signal);
    await repository.preload("1,0", signal);
    await repository.preload("2,0", signal);

    expect(repository.residentCount).toBe(2);
  });
});
