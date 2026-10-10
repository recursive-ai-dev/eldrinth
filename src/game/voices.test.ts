import { beforeAll, describe, expect, it } from "vitest";
import { ANIMA_VOICES, carriedVoices, harvestDialogue } from "./voices";
import { FORTRESS_LAYOUTS } from "./fortressLayouts";
import { bootGame, installHeadlessDom } from "./headlessGame";
import type { Game } from "./engine";
import type { HudData } from "./types";
import { silentCallbacks } from "./headlessGame";

beforeAll(installHeadlessDom);
const archive = "fortress.old-lands-archive";

async function travel(game: Game, region: string) {
  await (game as any).changeRegion({ x: 0, y: 0, targetRegion: region, destination: { x: 0, y: 0 }, label: region });
}
function reachChoices(game: Game) {
  for (let n = 0; game.dialogue && !game.dialogue.choices && n < 10; n++) {
    game.advanceLock = 0;
    game.advanceDialogue();
  }
}
async function carry(game: Game, region: string) {
  await travel(game, region);
  Object.assign(game.player, game.map.shards[0]);
  game.tryInteract();
  reachChoices(game);
  game.chooseDialogue(`harvest:${region}`);
}

describe("Names in the Fire", () => {
  it("gives all nine distinct people a voice and never exposes an uncarried person", () => {
    expect(ANIMA_VOICES.map((voice) => voice.id).sort()).toEqual(Object.keys(FORTRESS_LAYOUTS).sort());
    expect(new Set(ANIMA_VOICES.map((voice) => voice.name)).size).toBe(9);
    expect(carriedVoices([archive, "unknown", archive]).map((voice) => voice.name)).toEqual(["Vaelen"]);
  });

  it("discloses the actual permanent health change, including the health floor", () => {
    expect(harvestDialogue(archive, 1, 18)?.lines[1]).toContain("no health cost");
    expect(harvestDialogue(archive, 6, 15)?.lines[1]).toContain("15 → 13");
    expect(harvestDialogue(archive, 9, 2)?.choices[0].label).toContain("health −1");
    expect(harvestDialogue(archive, 9, 1)?.choices[0].label).toContain("no health cost");
  });

  it("never harvests by touch, requires hearing the price, and leaves declined vessels available", async () => {
    const game = await bootGame();
    try {
      await travel(game, archive);
      Object.assign(game.player, game.map.shards[0]);
      game.checkPickups();
      expect(game.shards).toBe(0);
      game.tryInteract();
      expect(game.dialogue?.speaker).toBe("Vaelen");
      game.chooseDialogue(`harvest:${archive}`);
      expect(game.shards).toBe(0);
      reachChoices(game);
      game.chooseDialogue("leave");
      expect(game.items.some((item) => item.type === "shard" && !item.taken)).toBe(true);
      expect(game.shards).toBe(0);
      game.tryInteract();
      reachChoices(game);
      game.chooseDialogue(`harvest:${archive}`);
      const health = game.player.maxHp;
      expect(game.shards).toBe(1);
      game.chooseDialogue(`harvest:${archive}`);
      game.checkPickups();
      expect(game.shards).toBe(1);
      expect(game.player.maxHp).toBe(health);
    } finally { game.destroy(); }
  });

  it("offers replayable fireside memories, saves them once, and names them in the epilogue", async () => {
    let hud: HudData | undefined;
    const game = await bootGame({ ...silentCallbacks(), onHud: (next) => { hud = next; } });
    try {
      await carry(game, archive);
      expect(hud?.voices).toEqual([{ id: archive, name: "Vaelen", heard: false }]);
      await travel(game, "overworld");
      const fire = game.map.campfires[0];
      Object.assign(game.player, { x: fire.x, y: fire.y, hp: 1 });
      game.tryInteract();
      expect(game.player.hp).toBe(game.player.maxHp);
      reachChoices(game);
      game.chooseDialogue("fire:voices");
      expect(game.dialogue?.choices?.map((choice) => choice.id)).toEqual([`voice:${archive}`, "leave"]);
      game.chooseDialogue(`voice:${archive}`);
      expect(game.dialogue?.speaker).toBe("Vaelen");
      expect(hud?.voices?.[0].heard).toBe(true);
      game.chooseDialogue("fire:voices");
      game.chooseDialogue(`voice:${archive}`);
      expect(game.world.journal.filter((entry) => entry.id === `voice:${archive}`)).toHaveLength(1);
      const saved = game.saveWorld();
      game.loadWorld(saved);
      expect(game.world.journal.some((entry) => entry.id === `voice:${archive}`)).toBe(true);
      expect((game as any).buildEpilogue().join(" ")).toContain("Beside the fire, I listened to Vaelen");
      game.tryInteract();
      expect(game.dialogue?.choices?.[0].label).toContain("listen again");
    } finally { game.destroy(); }
  });

  it("does not treat a number pressed before the price appears as consent", async () => {
    const game = await bootGame();
    try {
      await travel(game, archive);
      game.enemies = [];
      Object.assign(game.player, game.map.shards[0]);
      game.tryInteract();
      game.setVirtualKey("1", true);
      game.setVirtualKey("1", false);
      game.simulateStep(1 / 60);
      game.setVirtualKey("e", true);
      game.simulateStep(1 / 60);
      expect(game.dialogue?.text).toContain("maximum health");
      game.simulateStep(1 / 60);
      expect(game.shards).toBe(0);
      expect(game.dialogue?.choices).toBeDefined();
      game.setVirtualKey("1", true);
      game.simulateStep(1 / 60);
      expect(game.shards).toBe(1);
    } finally { game.destroy(); }
  });

  it("rejects a fireside choice after leaving the fire and never grants unheard voices", async () => {
    const game = await bootGame();
    try {
      await carry(game, archive);
      await travel(game, "overworld");
      const fire = game.map.campfires[0];
      Object.assign(game.player, fire);
      game.tryInteract();
      reachChoices(game);
      game.chooseDialogue("fire:voices");
      game.chooseDialogue("voice:fortress.cinderwild-shrine");
      expect(game.world.journal.some((entry) => entry.id.startsWith("voice:"))).toBe(false);
      game.player.x += 200;
      game.chooseDialogue(`voice:${archive}`);
      expect(game.world.journal.some((entry) => entry.id.startsWith("voice:"))).toBe(false);
    } finally { game.destroy(); }
  });
});
