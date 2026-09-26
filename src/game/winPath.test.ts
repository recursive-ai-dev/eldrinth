import { beforeAll, describe, expect, it } from "vitest";
import { bootGame, installHeadlessDom, silentCallbacks } from "./headlessGame";
import type { Game } from "./engine";
import type { EndingId } from "./core/SceneStack";
import { TILE } from "./constants";
import { generateMap } from "./map";
import { FORTRESS_LAYOUTS } from "./fortressLayouts";

/**
 * The win path, end to end, on the real engine.
 *
 * Nothing in the suite previously covered it: the suite proved the harvest cost
 * arithmetic, that fortresses parse, and that the boss dies — but never that a
 * player can actually *finish*. That is the one path whose failure is a shipping
 * blocker, so it is walked here in full: harvest all nine, unlock the ward,
 * reach the Spire, take the choice, kill the Unbound, and receive an ending.
 */

beforeAll(() => installHeadlessDom());

const FRONTIER = ["overworld", "cinderwild", "moonlit-coast", "starfall-moors"];

async function travel(game: Game, regionId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (game as any).changeRegion({ x: 0, y: 0, targetRegion: regionId, destination: { x: 0, y: 0 }, label: regionId });
  expect(game.world.regionId).toBe(regionId);
}

/**
 * Reads through a dialogue to the line its choices are attached to. Multi-line
 * dialogue defers its choices to the final line, and `advanceDialogue` refuses
 * to advance again for 0.16s, so the lock is cleared between steps.
 */
function readToChoices(game: Game): string[] {
  for (let i = 0; i < 20 && !game.dialogue?.choices; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (game as any).advanceLock = 0;
    game.advanceDialogue();
  }
  return game.dialogue?.choices?.map((choice) => choice.id) ?? [];
}

describe("the run can be finished", () => {
  it("harvests all nine shards, unlocks the ward, and beats the Unbound", async () => {
    const game = await bootGame();

    expect(game.world.regionId).toBe("overworld");
    expect(game.shards).toBe(0);
    expect(game.wardUnlocked).toBe(false);

    const fortressRegions = Object.keys(FORTRESS_LAYOUTS);
    expect(fortressRegions).toHaveLength(9);

    for (const regionId of fortressRegions) {
      await travel(game, regionId);
      expect(game.map.shards, `${regionId} holds no shard`).toHaveLength(1);

      const before = game.shards;
      const shard = game.map.shards[0];
      game.player.x = shard.x;
      game.player.y = shard.y;
      game.checkPickups();

      expect(game.shards, `${regionId} did not yield a shard`).toBe(before + 1);
      // Recorded against the vessel, so re-entering cannot re-award it.
      expect(game.world.harvestedShards.has(regionId)).toBe(true);
    }

    expect(game.shards).toBe(9);
    expect(game.wardUnlocked).toBe(true);

    // At the Spire with all nine, the ward opens the final audience.
    await travel(game, "overworld");
    game.player.x = game.map.bossCenter.x;
    game.player.y = game.map.bossCenter.y;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (game as any).openWardChoice();
    expect(readToChoices(game)).toEqual(["ending:surrender", "ending:refuse"]);

    // Surrendering the nine spawns the Unbound.
    game.chooseDialogue("ending:surrender");
    expect(game.boss).not.toBeNull();
    expect(game.boss!.hp).toBe(game.boss!.maxHp);
    expect(game.bossSpawned).toBe(true);

    // Killing it ends the run.
    game.boss!.dying = 0.01;
    game.simulateStep(1 / 60);
    game.simulateStep(1 / 60);
    expect(game.ended).toBe(true);

    game.destroy();
  }, 30000);

  it("reports an ending with an epilogue built from the run", async () => {
    const seen: { id: EndingId; epilogue: string[] }[] = [];
    const game = await bootGame({ ...silentCallbacks(), onEnd: (id, epilogue) => seen.push({ id, epilogue }) });

    // A run that investigated nothing still has to produce a closing account.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (game as any).endRun("refusal");

    expect(seen).toHaveLength(1);
    expect(seen[0].id).toBe("refusal");
    expect(seen[0].epilogue.length).toBeGreaterThan(0);
    expect(seen[0].epilogue.join(" ")).toMatch(/without opening a single one of his files/);

    game.destroy();
  });

  it("offers a way to turn back when arriving at the Spire short of nine", async () => {
    const game = await bootGame();
    const total = game.totalShards;

    game.player.x = game.map.bossCenter.x;
    game.player.y = game.map.bossCenter.y;
    game.world.harvestedShards.add("fortress.cinderwild-shrine");
    game.shards = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (game as any).openUnfinishedWardChoice();
    expect(readToChoices(game)).toEqual(["ending:decline", "ending:withdraw"]);
    expect(game.dialogueLines.join(" ")).toContain(`1 of ${total}`);

    // Backing out must not end the run.
    game.chooseDialogue("ending:decline");
    expect(game.ended).toBe(false);
    expect(game.dialogue).toBeNull();

    // Turning away does end it, and the shard is still carried.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (game as any).openUnfinishedWardChoice();
    readToChoices(game);
    game.chooseDialogue("ending:withdraw");
    expect(game.ended).toBe(true);
    expect(game.shards).toBe(1);

    game.destroy();
  });

  it("anchors the run so dying before any wayfire does not end it", async () => {
    const game = await bootGame();

    // A checkpoint exists from the moment the world is built, so the first
    // death respawns instead of ending the run.
    expect(game.world.checkpoint).not.toBeNull();

    game.player.hp = 0;
    game.player.dying = 0.01;
    game.simulateStep(1 / 60);
    game.simulateStep(1 / 60);

    expect(game.ended).toBe(false);
    expect(game.world.deaths).toBe(1);
    expect(game.player.hp).toBe(game.player.maxHp);

    game.destroy();
  });
});

describe("the map the win path depends on", () => {
  it("puts one shard behind a gate, in each of the nine fortresses", () => {
    const gates = FRONTIER.flatMap((regionId) =>
      generateMap(regionId).exits
        .filter((exit) => exit.targetRegion.startsWith("fortress."))
        .map((exit) => exit.targetRegion),
    );
    expect(new Set(gates).size).toBe(9);
    expect([...gates].sort()).toEqual(Object.keys(FORTRESS_LAYOUTS).sort());

    for (const regionId of gates) {
      const interior = generateMap(regionId);
      expect(interior.shards, `${regionId} has no shard`).toHaveLength(1);
      expect(interior.resetOnDeath, `${regionId} does not reset on death`).toBe(true);
      expect(interior.campfires, `${regionId} has a wayfire to rest at`).toHaveLength(0);
    }
  });

  it("keeps the Spire arena behind the ward and the spawn outside it", () => {
    const map = generateMap("overworld");
    expect(map.wardTiles.length).toBeGreaterThan(0);
    expect(map.bossCenter.x).toBeGreaterThan(0);

    const spawnTile = { x: Math.floor(map.spawn.x / TILE), y: Math.floor(map.spawn.y / TILE) };
    // Otherwise the fight starts before the player has chosen anything.
    expect(map.wardTiles).not.toContain(spawnTile.y * map.width + spawnTile.x);
  });
});
