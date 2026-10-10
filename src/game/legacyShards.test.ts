import { beforeAll, describe, expect, it } from "vitest";
import { bootGame, installHeadlessDom } from "./headlessGame";
import { FORTRESS_LAYOUTS } from "./fortressLayouts";
import { restoreHarvestedShards } from "./core/WorldState";
import type { Game } from "./engine";

beforeAll(installHeadlessDom);
const ids = Object.keys(FORTRESS_LAYOUTS);
async function travel(game: Game, region: string) {
  await (game as any).changeRegion({ x: 0, y: 0, targetRegion: region, destination: { x: 0, y: 0 }, label: region });
}
function harvest(game: Game) {
  Object.assign(game.player, game.map.shards[0]);
  game.checkPickups();
  game.tryInteract();
  if (game.dialogue) {
    game.advanceLock = 0;
    game.advanceDialogue();
    game.chooseDialogue(`harvest:${game.world.regionId}`);
  }
}

describe("legacy shard identity recovery", () => {
  it.each(ids)("finishes an older save that harvested %s first", async (first) => {
    const game = await bootGame();
    try {
      await travel(game, first);
      harvest(game);
      await travel(game, "overworld");
      const old = game.saveWorld();
      delete old.harvestedShards;
      // Exercise regional evidence even without the newer intake journal.
      old.journal = [];
      const unchanged = structuredClone(old);
      game.loadWorld(old);
      expect(game.world.harvestedShards).toEqual(new Set([first]));
      expect(old).toEqual(unchanged);
      for (const id of ids) { await travel(game, id); harvest(game); }
      expect(game.shards).toBe(9);
      expect(game.wardUnlocked).toBe(true);
      const health = game.player.maxHp;
      await travel(game, first);
      harvest(game);
      expect(game.shards).toBe(9);
      expect(game.player.maxHp).toBe(health);
    } finally { game.destroy(); }
  });

  it("uses intake evidence when death discarded the harvested fortress", async () => {
    const game = await bootGame();
    try {
      const first = ids.at(-1)!;
      await travel(game, first); harvest(game);
      await travel(game, "overworld");
      const old = game.saveWorld();
      delete old.harvestedShards;
      delete old.regions![first];
      expect(restoreHarvestedShards(old)).toEqual(new Set([first]));
    } finally { game.destroy(); }
  });

  it("uses current items ahead of stale regional data when saved at a vessel", async () => {
    const game = await bootGame();
    try {
      const first = ids.at(-1)!;
      await travel(game, first);
      const stale = structuredClone(game.saveWorld().regions![first]);
      harvest(game);
      const old = game.saveWorld();
      delete old.harvestedShards;
      old.journal = [];
      old.regions![first] = stale;
      expect(restoreHarvestedShards(old)).toEqual(new Set([first]));
    } finally { game.destroy(); }
  });

  it("rejects ambiguous saves before changing the world instead of inventing identities", async () => {
    const game = await bootGame();
    try {
      const old = game.saveWorld();
      delete old.harvestedShards;
      old.shards = 1;
      const before = game.world.snapshot();
      expect(() => game.loadWorld(old)).toThrow("does not identify");
      expect(game.world.snapshot()).toEqual(before);
      expect(old.shards).toBe(1);
    } finally { game.destroy(); }
  });
});
