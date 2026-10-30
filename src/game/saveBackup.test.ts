import { beforeAll, describe, expect, it } from "vitest";
import { bootGame, installHeadlessDom } from "./headlessGame";
import { createBackup, parseBackup } from "./saveBackup";
import { WorldState } from "./core/WorldState";
import { FORTRESS_LAYOUTS } from "./fortressLayouts";
import type { Game } from "./engine";

beforeAll(installHeadlessDom);
async function travel(game: Game, regionId: string) {
  await (game as any).changeRegion({ x: 0, y: 0, targetRegion: regionId, destination: { x: 0, y: 0 }, label: regionId });
}
function checkTransfer(game: Game) {
  const snapshot = game.saveWorld();
  const expected = new WorldState();
  expected.restore(snapshot);
  const imported = parseBackup(createBackup(snapshot));
  expect(imported).toEqual(expected.snapshot());
  game.loadWorld(imported);
  expect(game.world.regionId).toBe(snapshot.regionId);
  expect(game.world.harvestedShards).toEqual(new Set(snapshot.harvestedShards));
}

describe("backups of real expeditions", () => {
  it("accepts every frontier, town room and fortress, including a pilgrimage carrying all nine", async () => {
    const game = await bootGame();
    try {
      for (const region of ["overworld", "cinderwild", "moonlit-coast", "starfall-moors"]) {
        await travel(game, region);
        checkTransfer(game);
      }
      for (const town of ["ilyarael-township", "cinder-haven", "oarsmans-bight", "crater-watch"]) {
        for (const room of ["a", "b", "c"]) {
          await travel(game, `interior.${town}.${room}`);
          checkTransfer(game);
        }
      }
      for (const fortress of Object.keys(FORTRESS_LAYOUTS)) {
        await travel(game, fortress);
        Object.assign(game.player, game.map.shards[0]);
        game.tryInteract();
        game.advanceLock = 0;
        game.advanceDialogue();
        game.chooseDialogue(`harvest:${fortress}`);
        checkTransfer(game);
      }
      expect(game.shards).toBe(9);
      expect(game.wardUnlocked).toBe(true);
      expect(Object.keys(game.saveWorld().regions!).length).toBeGreaterThan(20);
      await travel(game, "overworld");
      checkTransfer(game);
    } finally { game.destroy(); }
  }, 30000);

  it("accepts pre-equipment, pre-atlas and pre-checkpoint optional fields using the normal legacy migration", async () => {
    const game = await bootGame();
    try {
      const old = game.saveWorld();
      old.version = 1;
      delete old.difficulty;
      delete old.regions;
      delete old.checkpoint;
      delete old.journal;
      delete old.quests;
      delete old.harvestedShards;
      delete old.deaths;
      delete old.atlasDiscoveries;
      delete old.player.equippedRelics;
      delete old.player.combatTool;
      delete old.player.guardTimer;
      delete old.player.guardCooldown;
      delete old.player.riposteTimer;
      delete old.player.parryCount;
      delete old.player.attackWindup;
      const before = structuredClone(old);
      const expected = new WorldState();
      expected.restore(old);
      expect(parseBackup(createBackup(old))).toEqual(expected.snapshot());
      expect(old).toEqual(before);
    } finally { game.destroy(); }
  });
});
