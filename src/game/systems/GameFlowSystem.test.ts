import { describe, expect, it } from "vitest";
import { GameFlowSystem } from "./GameFlowSystem";

describe("GameFlowSystem HUD", () => {
  it("projects stamina into HUD state", () => {
    const flow = new GameFlowSystem();
    const hud = flow.buildHud({
      player: { x: 0, y: 0, hp: 4, maxHp: 6, stamina: 65.5, maxStamina: 100, r: 11 },
      enemies: [],
      boss: null,
      shards: 0,
      totalShards: 3,
      wardUnlocked: false,
      bossSpawned: false,
      message: "",
      messageId: 0,
      prompt: "",
      dialogue: null,
      map: { npc: { x: 0, y: 0 }, signs: [] },
      items: [],
    });

    expect(hud.stamina).toBe(65.5);
    expect(hud.maxStamina).toBe(100);
  });
});
