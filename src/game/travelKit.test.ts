import { beforeAll, describe, expect, it } from "vitest";
import { bootGame, installHeadlessDom, silentCallbacks } from "./headlessGame";
import { equipmentData, previewRelic } from "./equipment";
import { WorldState } from "./core/WorldState";
import type { HudData } from "./types";

beforeAll(installHeadlessDom);

describe("travel kit integration", () => {
  it("retains surveyed landmarks through a snapshot without retaining references", async () => {
    let hud: HudData | undefined;
    const game = await bootGame({ ...silentCallbacks(), onHud: value => { hud = value; } });
    try {
      const fire = game.map.campfires[0];
      game.player.x = fire.x; game.player.y = fire.y;
      game.pushHud();
      const landmark = hud!.navigation!.landmarks.find(value => value.kind === "wayfire")!;
      expect(landmark).toBeDefined();
      const snapshot = game.saveWorld();
      const restored = new WorldState();
      restored.restore(snapshot);
      expect(restored.atlasDiscoveries.overworld).toContain(landmark.id);
      restored.atlasDiscoveries.overworld.length = 0;
      expect(snapshot.atlasDiscoveries!.overworld).toContain(landmark.id);
      delete snapshot.atlasDiscoveries;
      restored.restore(snapshot);
      expect(restored.atlasDiscoveries).toEqual({});
    } finally { game.destroy(); }
  });

  it("drops malformed survey records and IDs from another region on restore", async () => {
    const game = await bootGame();
    try {
      const snapshot = game.saveWorld();
      snapshot.atlasDiscoveries = JSON.parse('{"__proto__":["bad"],"overworld":["overworld:record:1:2","other:1",3,"overworld:record:1:2"],"cinderwild":"bad"}');
      const restored = new WorldState(); restored.restore(snapshot);
      expect(restored.atlasDiscoveries).toEqual({ overworld: ["overworld:record:1:2"] });
      expect(Object.getPrototypeOf(restored.atlasDiscoveries)).toBe(Object.prototype);
    } finally { game.destroy(); }
  });

  it("pauses on blur, respects opt-out, and does not open a second overlay over reading", async () => {
    const game = await bootGame();
    try {
      game.onBlur(); expect(game.paused).toBe(true);
      const time = game.world.simulationTime;
      game.simulateStep(1); expect(game.world.simulationTime).toBe(time);
      game.setPaused(false); game.autoPause = false;
      game.onBlur(); expect(game.paused).toBe(false);
      game.autoPause = true; game.setJournalOpen(true);
      game.onBlur(); expect(game.paused).toBe(false);
      game.setJournalOpen(false); game.onBlur(); expect(game.paused).toBe(true);
    } finally { game.destroy(); }
  });

  it("disables camera shake without disabling damage and reports active travel time", async () => {
    let hud: HudData | undefined;
    const game = await bootGame({ ...silentCallbacks(), onHud: value => { hud = value; } });
    try {
      game.screenShake = false; game.shakeMag = 0;
      const hp = game.player.hp;
      game.damagePlayer(2, game.player.x - 20, game.player.y);
      expect(game.player.hp).toBe(hp - 2); expect(game.shakeMag).toBe(0);
      game.world.simulationTime = 123; game.world.deaths = 2; game.pushHud();
      expect(hud!.journey).toEqual({ seconds: 123, deaths: 2, difficulty: "standard" });
    } finally { game.destroy(); }
  });
});

describe("loadout comparisons", () => {
  const player = { relics: ["emberheart", "ashstep", "tidewell", "starblade"], equippedRelics: [] as ("emberheart" | "ashstep" | "tidewell" | "starblade")[], attackBonus: 2, dashCostDiscount: 4 };
  it("previews both sides of a tradeoff without changing the player", () => {
    const before = structuredClone(player);
    expect(previewRelic(player, "tidewell")).toMatchObject({ damage: 3, movementPercent: 88, staminaRegen: 40, dashCost: 31 });
    expect(previewRelic(player, "starblade")).toMatchObject({ damage: 4, strikeInterval: 0.5 });
    expect(player).toEqual(before);
  });
  it("respects capacity and previews removal using the same equations as equipped stats", () => {
    const loaded = { ...player, equippedRelics: ["emberheart", "ashstep", "tidewell"] as const };
    const mutable = { ...loaded, equippedRelics: [...loaded.equippedRelics] };
    expect(previewRelic(mutable, "starblade")).toBeUndefined();
    expect(previewRelic(mutable, "tidewell")).toEqual(equipmentData({ ...mutable, equippedRelics: ["emberheart", "ashstep"] }).stats);
    expect(previewRelic({ ...player, relics: [] }, "tidewell")).toBeUndefined();
  });
});
