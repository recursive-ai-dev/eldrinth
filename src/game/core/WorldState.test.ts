import { describe, expect, it } from "vitest";
import { WorldState } from "./WorldState";

describe("WorldState snapshots", () => {
  it("round-trips mutable simulation state without retaining save references", () => {
    const world = new WorldState();
    world.player = {
      x: 1, y: 2, r: 3, hp: 4, maxHp: 6, stamina: 7, maxStamina: 8,
      staminaRegenDelay: 0, dir: "down", speed: 1, attackTimer: 0, attackCd: 0,
      attackDur: 0, attacking: false, swingHit: new Set([5]), swingDmg: 1,
      invuln: 0, dashTimer: 0, dashCd: 0, dashDir: "down", dashing: false,
      walkT: 0, hurtFlash: 0, kx: 0, ky: 0, dying: 0, relics: [], dashCostDiscount: 0, attackBonus: 0,
    };
    world.enemies = [{
      id: 5, type: "wraith", x: 1, y: 2, r: 3, hp: 4, maxHp: 4, speed: 1, dmg: 1,
      vx: 0, vy: 0, hurt: 0, t: 0, shootCd: 0, lungeCd: 0, lungeTimer: 0,
      lungeVx: 0, lungeVy: 0, burstCd: 0, summonCd: 0, telegraph: null,
      telegraphTimer: 0, wanderA: 0, bob: 0, alive: true, dying: 0,
    }];
    world.boss = world.enemies[0];
    world.regions = {
      overworld: { enemies: world.enemies, items: [], bossId: 5, bossSpawned: false },
    };
    world.checkpoint = { regionId: "overworld", x: 12, y: 24, name: "Test Wayfire" };
    world.quests = { facts: ["courier-orders"], resolutions: {} };
    const snapshot = world.snapshot();
    world.player.hp = 0;
    world.regions.overworld.enemies[0].hp = 0;

    const restored = new WorldState();
    restored.restore(snapshot);

    expect(restored.player.hp).toBe(4);
    expect(restored.player.swingHit).toEqual(new Set([5]));
    expect(restored.boss).toBe(restored.enemies[0]);
    expect(restored.regions.overworld.enemies[0].hp).toBe(4);
    expect(restored.checkpoint).toEqual({ regionId: "overworld", x: 12, y: 24, name: "Test Wayfire" });
    expect(restored.quests.facts).toEqual(["courier-orders"]);
  });

  it("migrates dense version-one Story saves into the calmer expedition balance", () => {
    const world = new WorldState();
    world.player = {
      x: 1, y: 2, r: 3, hp: 6, maxHp: 6, stamina: 7, maxStamina: 8,
      staminaRegenDelay: 0, dir: "down", speed: 1, attackTimer: 0, attackCd: 0,
      attackDur: 0, attacking: false, swingHit: new Set(), swingDmg: 1,
      invuln: 0, dashTimer: 0, dashCd: 0, dashDir: "down", dashing: false,
      walkT: 0, hurtFlash: 0, kx: 0, ky: 0, dying: 0, relics: [], dashCostDiscount: 0, attackBonus: 0,
    };
    world.enemies = Array.from({ length: 20 }, (_, id) => ({
      id, type: "wraith" as const, x: id, y: 0, r: 3, hp: 3, maxHp: 3, speed: 62, dmg: 1,
      vx: 0, vy: 0, hurt: 0, t: 0, shootCd: 0, lungeCd: 0, lungeTimer: 0,
      lungeVx: 0, lungeVy: 0, burstCd: 0, summonCd: 0, telegraph: null,
      telegraphTimer: 0, wanderA: 0, bob: 0, alive: true, dying: 0,
    }));
    const legacy = { ...world.snapshot(), version: 1 as const, difficulty: "story" as const, bossId: null };
    const restored = new WorldState();
    restored.restore(legacy);

    expect(restored.enemies.length).toBeLessThan(20);
    // v1 save: harvest-cost migration (0 shards, maxHp 6 -> 18) composes with
    // the legacy Story +2 population migration (18 -> 20).
    expect(restored.player.maxHp).toBe(20);
    expect(restored.enemies[0].speed).toBeCloseTo(45.88);
  });

  it("round-trips a resolution that granted no reward", () => {
    const world = new WorldState();
    world.player = {
      x: 1, y: 2, r: 3, hp: 4, maxHp: 6, stamina: 7, maxStamina: 8,
      staminaRegenDelay: 0, dir: "down", speed: 1, attackTimer: 0, attackCd: 0,
      attackDur: 0, attacking: false, swingHit: new Set(), swingDmg: 1,
      invuln: 0, dashTimer: 0, dashCd: 0, dashDir: "down", dashing: false,
      walkT: 0, hurtFlash: 0, kx: 0, ky: 0, dying: 0, relics: [], dashCostDiscount: 0, attackBonus: 0,
    };
    world.quests = {
      facts: ["courier-orders", "courier-memory"],
      resolutions: { courier: "end" },
    };

    const snapshot = world.snapshot();
    world.quests.resolutions.courier = "bind";

    const restored = new WorldState();
    restored.restore(snapshot);

    expect(restored.quests.resolutions.courier).toBe("end");
    expect(restored.quests.facts).toEqual(["courier-orders", "courier-memory"]);
  });

  it("drops pre-rewrite narrative journal entries from a v2 save, keeping personal notes and quest facts", () => {
    const world = new WorldState();
    world.player = {
      x: 1, y: 2, r: 3, hp: 4, maxHp: 6, stamina: 7, maxStamina: 8,
      staminaRegenDelay: 0, dir: "down", speed: 1, attackTimer: 0, attackCd: 0,
      attackDur: 0, attacking: false, swingHit: new Set(), swingDmg: 1,
      invuln: 0, dashTimer: 0, dashCd: 0, dashDir: "down", dashing: false,
      walkT: 0, hurtFlash: 0, kx: 0, ky: 0, dying: 0, relics: [], dashCostDiscount: 0, attackBonus: 0,
    };
    world.journal = [
      { id: "overworld:12:4", title: "Salt-Graves Ledger", text: "Old canon courier orders.", source: "A weathered marker" },
      { id: "orithel:spire", title: "The Unbound Spire", text: "Old canon Orithel briefing.", source: "Orithel · Ilyarael" },
      { id: "personal:40:0", title: "My observations", text: "A note I wrote myself.", source: "Camp" },
      { id: "bleed:6", title: "My observations", text: "Not mine, but new content.", source: "My own hand" },
    ];
    world.quests = { facts: ["courier-orders", "spire"], resolutions: { courier: "end" } };
    const v2 = { ...world.snapshot(), version: 2 as const };

    const restored = new WorldState();
    restored.restore(v2);

    expect(restored.journal.map((entry) => entry.id)).toEqual(["personal:40:0", "bleed:6"]);
    expect(restored.quests.facts).toEqual(["courier-orders", "spire"]);
    expect(restored.quests.resolutions.courier).toBe("end");
  });

  it("migrates a pre-inversion (v3) save's carried maxHp onto the fresh-rules target, clamping hp", () => {
    const world = new WorldState();
    world.player = {
      x: 1, y: 2, r: 3, hp: 9, maxHp: 12, stamina: 7, maxStamina: 8,
      staminaRegenDelay: 0, dir: "down", speed: 1, attackTimer: 0, attackCd: 0,
      attackDur: 0, attacking: false, swingHit: new Set(), swingDmg: 1,
      invuln: 0, dashTimer: 0, dashCd: 0, dashDir: "down", dashing: false,
      walkT: 0, hurtFlash: 0, kx: 0, ky: 0, dying: 0, relics: [], dashCostDiscount: 0, attackBonus: 0,
    };
    world.shards = 6;
    world.quests = { facts: ["courier-orders"], resolutions: { courier: "end" } };
    world.journal = [{ id: "personal:1:0", title: "My observations", text: "mine", source: "Camp" }];
    const v3 = { ...world.snapshot(), version: 3 as const };

    const restored = new WorldState();
    restored.restore(v3);

    // shards=6: old maxHp 12 -> 12 + 12 - 6 - cumulativeHarvestCost(6)=5 -> 13, the fresh-rules target.
    expect(restored.player.maxHp).toBe(13);
    expect(restored.player.hp).toBe(9);
    expect(restored.quests.resolutions.courier).toBe("end");
    expect(restored.journal.map((entry) => entry.id)).toEqual(["personal:1:0"]);
  });

  it("clamps hp down when the harvest-cost migration drops maxHp below current hp", () => {
    const world = new WorldState();
    world.player = {
      x: 1, y: 2, r: 3, hp: 15, maxHp: 15, stamina: 7, maxStamina: 8,
      staminaRegenDelay: 0, dir: "down", speed: 1, attackTimer: 0, attackCd: 0,
      attackDur: 0, attacking: false, swingHit: new Set(), swingDmg: 1,
      invuln: 0, dashTimer: 0, dashCd: 0, dashDir: "down", dashing: false,
      walkT: 0, hurtFlash: 0, kx: 0, ky: 0, dying: 0, relics: [], dashCostDiscount: 0, attackBonus: 0,
    };
    world.shards = 9;
    const v3 = { ...world.snapshot(), version: 3 as const };

    const restored = new WorldState();
    restored.restore(v3);

    // shards=9: 15 + 12 - 9 - 13 = 5, and hp clamps down from 15 to match.
    expect(restored.player.maxHp).toBe(5);
    expect(restored.player.hp).toBe(5);
  });

  it("restores difficulty correctly and safely falls back to standard when corrupted", () => {
    const world = new WorldState();
    world.player = {
      x: 1, y: 2, r: 3, hp: 4, maxHp: 6, stamina: 7, maxStamina: 8,
      staminaRegenDelay: 0, dir: "down", speed: 1, attackTimer: 0, attackCd: 0,
      attackDur: 0, attacking: false, swingHit: new Set(), swingDmg: 1,
      invuln: 0, dashTimer: 0, dashCd: 0, dashDir: "down", dashing: false,
      walkT: 0, hurtFlash: 0, kx: 0, ky: 0, dying: 0, relics: [], dashCostDiscount: 0, attackBonus: 0,
    };
    world.difficulty = "brutal";
    const snap = world.snapshot();

    const restored1 = new WorldState();
    restored1.restore(snap);
    expect(restored1.difficulty).toBe("brutal");

    const corruptedSnap = { ...snap, difficulty: "invalid_nightmare" as any };
    const restored2 = new WorldState();
    restored2.restore(corruptedSnap);
    expect(restored2.difficulty).toBe("standard");

    const missingSnap = { ...snap, difficulty: undefined };
    const restored3 = new WorldState();
    restored3.restore(missingSnap);
    expect(restored3.difficulty).toBe("standard");
  });
});
