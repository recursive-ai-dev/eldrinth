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
      map: { regionName: "Test", npc: { x: 0, y: 0 }, npcs: [], towns: [], exits: [], signs: [], campfires: [] },
      items: [],
    });

    expect(hud.stamina).toBe(65.5);
    expect(hud.maxStamina).toBe(100);
  });
});

describe("GameFlowSystem objectives", () => {
  const base = {
    player: { x: 0, y: 0, hp: 6, maxHp: 6, stamina: 100, maxStamina: 100, r: 11 },
    enemies: [],
    boss: null,
    shards: 0,
    totalShards: 9,
    wardUnlocked: false,
    bossSpawned: false,
    message: "",
    messageId: 0,
    prompt: "",
    dialogue: null,
    map: { regionName: "Test", npc: { x: 0, y: 0 }, npcs: [], towns: [], exits: [], signs: [], campfires: [] },
    items: [],
  };

  it("asks the player to record what was taken while shards remain", () => {
    const flow = new GameFlowSystem();
    expect(flow.currentObjective(base)).toBe("Read the roads. Record what was taken.");
  });

  it("names Orithel once the ward is open", () => {
    const flow = new GameFlowSystem();
    expect(flow.currentObjective({ ...base, shards: 9, wardUnlocked: true })).toContain("Orithel");
  });

  it("describes the Unbound as a crowd during the fight", () => {
    const flow = new GameFlowSystem();
    const state = { ...base, shards: 9, wardUnlocked: true, bossSpawned: true, boss: { alive: true, hp: 40, maxHp: 40 } };
    expect(flow.currentObjective(state)).toContain("screaming");
  });

  it("prompts at an interactive doorway instead of treating it as a walk-through gate", () => {
    const flow = new GameFlowSystem();
    const state = {
      ...base,
      player: { ...base.player, x: 48, y: 48 },
      map: {
        ...base.map,
        npc: { x: -9999, y: -9999 },
        exits: [{ x: 1, y: 1, label: "Althea's Ledger Room", requiresInteraction: true }],
      },
    };
    expect(flow.updatePrompt(state)).toBe("Press E to enter Althea's Ledger Room");
  });
});
