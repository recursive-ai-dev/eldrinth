import { beforeAll, describe, expect, it, vi } from "vitest";
import { bootGame, installHeadlessDom } from "./headlessGame";
import type { Game } from "./engine";
import type { NpcData, RegionExit } from "./types";

beforeAll(installHeadlessDom);

async function interactionGame(): Promise<Game> {
  const game = await bootGame();
  game.player.x = 48;
  game.player.y = 48;
  game.items = [];
  game.enemies = [];
  game.map = {
    ...game.map,
    npc: { x: -9999, y: -9999 },
    npcs: [],
    signs: [],
    exits: [],
    campfires: [],
  };
  return game;
}

function healer(x: number, name: string): NpcData {
  return { x, y: 48, id: `test:${name}`, name, role: "healer", color: "#fff" };
}

function doorway(x: number, label: string): RegionExit {
  return { x, y: 1, label, targetRegion: "cinderwild", destination: { x: 2560, y: 1792 }, requiresInteraction: true };
}

describe("interaction prompts and actions in the live engine", () => {
  it("speaks with the advertised inhabitant when a doorway and wayfire overlap", async () => {
    const game = await interactionGame();
    try {
      game.map.npcs = [healer(52, "Near Healer")];
      game.map.exits = [doorway(2, "Side Room")];
      game.map.campfires = [{ x: 48, y: 48, name: "Nearby Fire", relic: "emberheart" }];
      game.player.hp = 1;
      const checkpoint = game.world.checkpoint;

      game.updatePrompt();
      expect(game.prompt).toBe("Press E to speak with Near Healer");
      game.tryInteract();
      expect(game.dialogue?.speaker).toBe("Near Healer");
      expect(game.player.hp).toBe(game.player.maxHp);
      expect(game.world.checkpoint).toBe(checkpoint);
    } finally { game.destroy(); }
  });

  it("enters the advertised nearest doorway before using a nearby fire or inhabitant", async () => {
    const game = await interactionGame();
    try {
      const nearDoor = doorway(1, "Near Room");
      game.map.exits = [doorway(2, "Far Room"), nearDoor];
      game.map.npcs = [healer(60, "Healer")];
      game.map.campfires = [{ x: 48, y: 48, name: "Nearby Fire", relic: "emberheart" }];
      const changeRegion = vi.spyOn(game as unknown as { changeRegion: (exit: RegionExit) => Promise<void> }, "changeRegion").mockResolvedValue();

      game.updatePrompt();
      expect(game.prompt).toBe("Press E to enter Near Room");
      game.tryInteract();
      expect(changeRegion).toHaveBeenCalledExactlyOnceWith(nearDoor);
      expect(game.dialogue).toBeNull();
      changeRegion.mockRestore();
    } finally { game.destroy(); }
  });

  it("opens and records the nearest note regardless of map array order", async () => {
    const game = await interactionGame();
    try {
      game.map.signs = [
        { x: 2, y: 1, title: "Far Note", text: "A different account." },
        { x: 1, y: 1, title: "Near Note", text: "The account beside the pilgrim." },
      ];
      game.updatePrompt();
      expect(game.prompt).toBe("Press E to read note");
      game.tryInteract();
      expect(game.dialogue?.speaker).toBe("Near Note");
      expect(game.dialogue?.text).toBe("The account beside the pilgrim.");
      expect(game.world.journal.some(entry => entry.title === "Near Note")).toBe(true);
      expect(game.world.journal.some(entry => entry.title === "Far Note")).toBe(false);
    } finally { game.destroy(); }
  });

  it("speaks with the nearest advertised inhabitant through the full conversation radius", async () => {
    const game = await interactionGame();
    try {
      game.map.npcs = [healer(95, "Far Healer"), healer(94, "Near Healer")];
      game.updatePrompt();
      expect(game.prompt).toBe("Press E to speak with Near Healer");
      game.tryInteract();
      expect(game.dialogue?.speaker).toBe("Near Healer");
    } finally { game.destroy(); }
  });
});
