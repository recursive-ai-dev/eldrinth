import { beforeAll, describe, expect, it } from "vitest";
import { SIGN_READ_RADIUS, T, TILE, tileDefinition } from "./constants";
import type { Game } from "./engine";
import { bootGame, installHeadlessDom } from "./headlessGame";
import {
  LANTERN_RECORDS, LANTERN_REVEAL_RADIUS, addLanternDirections,
  lanternPosition, lanternReveals,
} from "./lantern";
import { generateMap } from "./map";
import type { MapData, Vec } from "./types";

beforeAll(installHeadlessDom);

function reachable(map: MapData, target: Vec): boolean {
  const start = { x: Math.floor(map.spawn.x / TILE), y: Math.floor(map.spawn.y / TILE) };
  const visited = new Set<number>();
  const queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const point = queue[cursor];
    if (point.x === target.x && point.y === target.y) return true;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = point.x + dx, y = point.y + dy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const index = y * map.width + x;
      if (visited.has(index) || tileDefinition(map.tiles[index]).shape === "solid") continue;
      visited.add(index);
      queue.push({ x, y });
    }
  }
  return false;
}

function progress(game: Game): string {
  const p = game.player;
  return JSON.stringify({
    hp: p.hp, maxHp: p.maxHp, stamina: p.stamina, maxStamina: p.maxStamina,
    attackBonus: p.attackBonus, dashCostDiscount: p.dashCostDiscount,
    relics: p.relics, equipment: game.getEquipment(),
    shards: game.shards, harvestedShards: [...game.world.harvestedShards],
    quests: game.world.quests, checkpoint: game.world.checkpoint,
  });
}

describe("authored lamplight records", () => {
  it.each(LANTERN_RECORDS)("places $id on reachable ground with a readable geographic lead", record => {
    const map = generateMap(record.regionId);
    expect(tileDefinition(map.tiles[record.y * map.width + record.x]).shape).not.toBe("solid");
    expect(reachable(map, record), `${record.title} must be reachable from the region arrival`).toBe(true);
    const leads = map.signs.filter(sign => sign.text.includes(record.route));
    expect(leads).toHaveLength(1);
    expect(reachable(map, leads[0])).toBe(true);
    expect(record.route).toMatch(/east|west|north|south/i);
    expect(map.signs.some(sign => sign.text.includes(record.text))).toBe(false);
    for (const sign of map.signs) {
      expect(Math.hypot(sign.x - record.x, sign.y - record.y) * TILE,
        `${record.title} must not overlap the reading radius of ${sign.title}`).toBeGreaterThanOrEqual(SIGN_READ_RADIUS * 2);
    }
    // Reapplying authored directions must not duplicate prose or overwrite facts.
    const original = structuredClone(map.signs);
    addLanternDirections(record.regionId, map.signs);
    expect(map.signs).toEqual(original);
  });

  it("requires an open lantern, range, and unobstructed sight before exposing an inscription", () => {
    const map = { ...generateMap("overworld"), width: 10, height: 10, tiles: new Uint8Array(100).fill(T.PATH) };
    const record = { ...LANTERN_RECORDS[0], x: 5, y: 5 };
    const position = lanternPosition(record);
    const player = { x: position.x - TILE * 2, y: position.y };
    expect(lanternReveals(record, player, map, false)).toBe(false);
    expect(lanternReveals(record, player, map, true)).toBe(true);
    expect(lanternReveals(record, { x: position.x - LANTERN_REVEAL_RADIUS, y: position.y }, map, true)).toBe(false);
    map.tiles[5 * map.width + 4] = T.RWALL;
    expect(lanternReveals(record, player, map, true)).toBe(false);
    map.tiles[5 * map.width + 4] = T.PATH;
    expect(lanternReveals(record, player, map, true)).toBe(true);
  });

});

describe("lantern in the live engine", () => {
  it("reveals distant writing but only reads it inside the normal interaction radius", async () => {
    const game = await bootGame();
    try {
      const record = LANTERN_RECORDS[0];
      const position = lanternPosition(record);
      Object.assign(game.player, { x: position.x - SIGN_READ_RADIUS, y: position.y });
      game.toggleLantern();
      expect(game.revealedLamplightRecord).toBe(record);
      expect(game.prompt).toBe("");
      game.tryInteract();
      expect(game.dialogue).toBeNull();
      game.player.x += 0.1;
      game.updatePrompt();
      expect(game.prompt).toBe("Press E to read lamplight writing");
      game.tryInteract();
      expect(game.dialogue?.speaker).toBe(record.title);
    } finally { game.destroy(); }
  });

  it("toggles R once per press while a held key leaves the lantern unchanged", async () => {
    const game = await bootGame();
    try {
      game.enemies = [];
      expect(game.lanternOn).toBe(false);
      game.setVirtualKey("r", true);
      game.simulateStep(1 / 60);
      expect(game.lanternOn).toBe(true);
      for (let i = 0; i < 10; i++) {
        game.setVirtualKey("r", true);
        game.simulateStep(1 / 60);
      }
      expect(game.lanternOn).toBe(true);
      game.setVirtualKey("r", false);
      game.setVirtualKey("r", true);
      game.simulateStep(1 / 60);
      expect(game.lanternOn).toBe(false);
    } finally { game.destroy(); }
  });

  it("rejects toggles during pause, journal, dialogue, death, ending, and region transition", async () => {
    const game = await bootGame();
    try {
      game.setPaused(true);
      expect(game.toggleLantern()).toBe(false);
      game.setPaused(false);
      game.setJournalOpen(true);
      expect(game.toggleLantern()).toBe(false);
      game.setJournalOpen(false);
      game.openDialogue(["A conversation in progress."], "Witness", "#fff");
      expect(game.toggleLantern()).toBe(false);
      game.advanceDialogue();
      game.player.dying = 0.5;
      expect(game.toggleLantern()).toBe(false);
      game.player.dying = 0;
      game.ended = true;
      expect(game.toggleLantern()).toBe(false);
      game.ended = false;
      const transitionState = game as unknown as { changingRegion: boolean };
      transitionState.changingRegion = true;
      expect(game.toggleLantern()).toBe(false);
      transitionState.changingRegion = false;
      expect(game.lanternOn).toBe(false);
      expect(game.toggleLantern()).toBe(true);
      expect(game.lanternOn).toBe(true);
    } finally { game.destroy(); }
  });

  it("discards an R press during pause instead of toggling when play resumes", async () => {
    const game = await bootGame();
    try {
      game.enemies = [];
      game.setPaused(true);
      game.setVirtualKey("r", true);
      game.simulateStep(1 / 60);
      expect(game.lanternOn).toBe(false);
      game.setVirtualKey("r", false);
      game.setPaused(false);
      game.simulateStep(1 / 60);
      expect(game.lanternOn).toBe(false);
      game.setVirtualKey("r", true);
      game.simulateStep(1 / 60);
      expect(game.lanternOn).toBe(true);
    } finally { game.destroy(); }
  });

  it("clears menu input even when pause and resume happen before the next tick", async () => {
    const game = await bootGame();
    try {
      game.enemies = [];
      game.setPaused(true);
      game.setVirtualKey("r", true);
      game.setPaused(false);
      game.simulateStep(1 / 60);
      expect(game.lanternOn).toBe(false);
    } finally { game.destroy(); }
  });

  it.each(LANTERN_RECORDS)("reads $id only in lamplight, copying it once without changing progression", async record => {
    const game = await bootGame();
    try {
      game.world.regionId = record.regionId;
      game.map = generateMap(record.regionId);
      Object.assign(game.player, lanternPosition(record));
      game.items = [];
      game.enemies = [];
      const before = progress(game);
      const id = `lamplight:${record.id}`;

      game.updatePrompt();
      expect(game.prompt).toBe("");
      game.tryInteract();
      expect(game.dialogue).toBeNull();
      expect(game.world.journal.some(entry => entry.id === id)).toBe(false);

      game.toggleLantern();
      expect(game.prompt).toBe("Press E to read lamplight writing");
      game.tryInteract();
      expect(game.dialogue?.speaker).toBe(record.title);
      expect(game.dialogue?.text).toBe(record.text);
      expect(game.world.journal.filter(entry => entry.id === id)).toEqual([{
        id, title: record.title, text: `${record.text}\n\n${record.route}`, source: game.map.regionName,
      }]);
      game.advanceDialogue();
      game.tryInteract();
      expect(game.world.journal.filter(entry => entry.id === id)).toHaveLength(1);
      expect(progress(game)).toBe(before);
    } finally { game.destroy(); }
  });

  it("restores copied writing and personal notes with the lantern shuttered, including older v4 saves", async () => {
    const game = await bootGame();
    try {
      const record = LANTERN_RECORDS[0];
      const oldSave = game.saveWorld();
      const personal = { id: "personal:before-lantern", title: "My route", text: "Return along the west road." };
      game.world.journal.push(personal);
      Object.assign(game.player, lanternPosition(record));
      game.toggleLantern();
      game.tryInteract();
      game.advanceDialogue();
      const saved = JSON.parse(JSON.stringify(game.saveWorld()));
      expect(saved.version).toBe(4);
      expect(saved).not.toHaveProperty("lanternOn");
      game.world.journal.length = 0;
      game.loadWorld(saved);
      expect(game.lanternOn).toBe(false);
      expect(game.world.journal).toContainEqual(personal);
      expect(game.world.journal.some(entry => entry.id === `lamplight:${record.id}`)).toBe(true);
      const before = game.world.journal.length;
      game.toggleLantern();
      game.tryInteract();
      expect(game.world.journal).toHaveLength(before);
      game.loadWorld(oldSave);
      expect(game.lanternOn).toBe(false);
      expect(game.world.journal).toEqual(oldSave.journal);
      expect(game.toggleLantern()).toBe(true);
    } finally { game.destroy(); }
  });
});
