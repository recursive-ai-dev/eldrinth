import { describe, expect, it } from "vitest";
import { slotStore } from "./slots";
import { isDifficulty, normalizeDifficulty } from "./types";
import { WorldState } from "./core/WorldState";

describe("Difficulty validation & SlotStore", () => {
  function makeSnapshot(difficulty?: any) {
    const world = new WorldState();
    world.player = {
      x: 1, y: 2, r: 3, hp: 4, maxHp: 6, stamina: 7, maxStamina: 8,
      staminaRegenDelay: 0, dir: "down", speed: 1, attackTimer: 0, attackCd: 0,
      attackDur: 0, attacking: false, swingHit: new Set(), swingDmg: 1,
      invuln: 0, dashTimer: 0, dashCd: 0, dashDir: "down", dashing: false,
      walkT: 0, hurtFlash: 0, kx: 0, ky: 0, dying: 0, relics: [], dashCostDiscount: 0, attackBonus: 0,
    };
    const snap = world.snapshot();
    if (difficulty !== undefined) {
      snap.difficulty = difficulty;
    }
    return snap;
  }

  it("validates and normalizes difficulty values", () => {
    expect(isDifficulty("story")).toBe(true);
    expect(isDifficulty("standard")).toBe(true);
    expect(isDifficulty("brutal")).toBe(true);
    expect(isDifficulty("corrupted")).toBe(false);
    expect(isDifficulty(null)).toBe(false);
    expect(isDifficulty(undefined)).toBe(false);
    expect(isDifficulty(123)).toBe(false);

    expect(normalizeDifficulty("story")).toBe("story");
    expect(normalizeDifficulty("standard")).toBe("standard");
    expect(normalizeDifficulty("brutal")).toBe("brutal");
    expect(normalizeDifficulty("corrupted")).toBe("standard");
    expect(normalizeDifficulty(null)).toBe("standard");
    expect(normalizeDifficulty(undefined)).toBe("standard");
  });

  it("saves and loads valid difficulty correctly", async () => {
    const snap = makeSnapshot("brutal");
    await slotStore.save(1, snap);

    const loaded = await slotStore.load(1);
    expect(loaded).not.toBeNull();
    expect(loaded?.difficulty).toBe("brutal");
    expect(loaded?.world.difficulty).toBe("brutal");

    const slots = await slotStore.list();
    const slot1 = slots.find((s) => s.id === 1);
    expect(slot1?.difficulty).toBe("brutal");
  });

  it("normalizes corrupted database difficulty column on load and list", async () => {
    const snap = makeSnapshot("story");
    // Manually inject a row with invalid difficulty in database column
    const db = await (slotStore as any).db();
    db.run(
      "INSERT OR REPLACE INTO save_slots (id, difficulty, shards, updated_at, world_json) VALUES (?, ?, ?, ?, ?)",
      [2, "corrupted_mode", 5, Date.now(), JSON.stringify(snap)]
    );

    const slots = await slotStore.list();
    const slot2 = slots.find((s) => s.id === 2);
    expect(slot2?.difficulty).toBe("standard");

    const loaded = await slotStore.load(2);
    expect(loaded).not.toBeNull();
    expect(loaded?.difficulty).toBe("story");
    expect(loaded?.world.difficulty).toBe("story");
  });

  it("normalizes corrupted snapshot JSON difficulty on load without throwing", async () => {
    const snap = makeSnapshot("corrupted_json_difficulty");
    const db = await (slotStore as any).db();
    db.run(
      "INSERT OR REPLACE INTO save_slots (id, difficulty, shards, updated_at, world_json) VALUES (?, ?, ?, ?, ?)",
      [3, "completely_invalid", 0, Date.now(), JSON.stringify(snap)]
    );

    const loaded = await slotStore.load(3);
    expect(loaded).not.toBeNull();
    // Both invalid db difficulty and invalid json difficulty should fallback to "standard"
    expect(loaded?.difficulty).toBe("standard");
    expect(loaded?.world.difficulty).toBe("standard");
  });

  it("returns null safely for malformed JSON or missing player in save slot", async () => {
    const db = await (slotStore as any).db();
    db.run(
      "INSERT OR REPLACE INTO save_slots (id, difficulty, shards, updated_at, world_json) VALUES (?, ?, ?, ?, ?)",
      [1, "standard", 0, Date.now(), "{ bad json"]
    );
    expect(await slotStore.load(1)).toBeNull();

    db.run(
      "INSERT OR REPLACE INTO save_slots (id, difficulty, shards, updated_at, world_json) VALUES (?, ?, ?, ?, ?)",
      [1, "standard", 0, Date.now(), JSON.stringify({ version: 4 })]
    );
    expect(await slotStore.load(1)).toBeNull();

    db.run(
      "INSERT OR REPLACE INTO save_slots (id, difficulty, shards, updated_at, world_json) VALUES (?, ?, ?, ?, ?)",
      [1, "standard", 0, Date.now(), JSON.stringify({ ...makeSnapshot(), enemies: null })]
    );
    expect(await slotStore.load(1)).toBeNull();
  });
});
