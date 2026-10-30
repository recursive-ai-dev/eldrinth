import { describe, expect, it } from "vitest";
import { validateWorldSnapshot } from "./snapshotValidation";

function basePlayer() {
  return {
    x: 100, y: 100, r: 11, hp: 18, maxHp: 18, stamina: 100, maxStamina: 100,
    staminaRegenDelay: 0, speed: 152, attackTimer: 0, attackCd: 0, attackDur: 0.2,
    swingDmg: 1, invuln: 0, dashTimer: 0, dashCd: 0, walkT: 0, hurtFlash: 0,
    kx: 0, ky: 0, dying: 0, dir: "down" as const, dashDir: "down" as const,
    attacking: false, dashing: false, swingHit: [],
  };
}

function baseWorld(overrides: Record<string, unknown> = {}): unknown {
  const world: Record<string, unknown> = {
    version: 4,
    regionId: "overworld",
    simulationTime: 0,
    tick: 0,
    shards: 0,
    totalShards: 9,
    messageId: 0,
    nextEnemyId: 1,
    randomState: 0x6d2b79f5,
    message: "Seek the Anima Shards.",
    wardUnlocked: false,
    enemies: [],
    items: [],
    projectiles: [],
    bossId: null,
    bossSpawned: false,
    player: basePlayer(),
  };
  return { ...world, ...overrides };
}

describe("validateWorldSnapshot", () => {
  it("accepts a valid v4 snapshot", () => {
    const result = validateWorldSnapshot(baseWorld());
    expect(result.valid).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("accepts v1, v2 and v3 snapshots", () => {
    for (const version of [1, 2, 3]) {
      const result = validateWorldSnapshot(baseWorld({ version }));
      expect(result.valid).toBe(true);
      expect(result.reason).toBeNull();
    }
  });

  it("rejects a non-object", () => {
    expect(validateWorldSnapshot(null).valid).toBe(false);
    expect(validateWorldSnapshot("nope").valid).toBe(false);
    expect(validateWorldSnapshot(42).valid).toBe(false);
    expect(validateWorldSnapshot([1, 2, 3]).valid).toBe(false);
  });

  it("rejects an unsupported version", () => {
    expect(validateWorldSnapshot(baseWorld({ version: 0 })).valid).toBe(false);
    expect(validateWorldSnapshot(baseWorld({ version: 5 })).valid).toBe(false);
  });

  it("rejects an unknown region", () => {
    expect(validateWorldSnapshot(baseWorld({ regionId: "nowhere" })).valid).toBe(false);
    expect(validateWorldSnapshot(baseWorld({ regionId: "" })).valid).toBe(false);
    expect(validateWorldSnapshot(baseWorld({ regionId: 123 })).valid).toBe(false);
  });

  it("rejects invalid numeric simulation fields", () => {
    expect(validateWorldSnapshot(baseWorld({ simulationTime: NaN })).valid).toBe(false);
    expect(validateWorldSnapshot(baseWorld({ tick: Infinity })).valid).toBe(false);
    expect(validateWorldSnapshot(baseWorld({ shards: -1 })).valid).toBe(false);
    expect(validateWorldSnapshot(baseWorld({ shards: 10 })).valid).toBe(false);
    expect(validateWorldSnapshot(baseWorld({ shards: 2.5 })).valid).toBe(false);
    expect(validateWorldSnapshot(baseWorld({ totalShards: 8 })).valid).toBe(false);
  });

  it("rejects invalid player state", () => {
    const bad = baseWorld({ player: { ...basePlayer(), maxHp: 0 } });
    expect(validateWorldSnapshot(bad).valid).toBe(false);
    const badDir = baseWorld({ player: { ...basePlayer(), dir: "northeast" as any } });
    expect(validateWorldSnapshot(badDir).valid).toBe(false);
    const badHit = baseWorld({ player: { ...basePlayer(), swingHit: ["x"] as any } });
    expect(validateWorldSnapshot(badHit).valid).toBe(false);
    expect(validateWorldSnapshot(baseWorld({ player: null })).valid).toBe(false);
  });

  it("rejects invalid projectiles", () => {
    const bad = baseWorld({
      projectiles: [{ x: 0, y: 0, vx: 0, vy: 0, r: 6, life: 1, dmg: 1, color: "x".repeat(90) }],
    });
    expect(validateWorldSnapshot(bad).valid).toBe(false);
  });

  it("rejects harvested shards that do not match the shard count", () => {
    const mismatched = baseWorld({
      shards: 1,
      harvestedShards: ["fortress.cinderwild-shrine", "fortress.starfall-watch"],
    });
    expect(validateWorldSnapshot(mismatched).valid).toBe(false);

    const duplicate = baseWorld({
      shards: 1,
      harvestedShards: ["fortress.cinderwild-shrine", "fortress.cinderwild-shrine"],
    });
    expect(validateWorldSnapshot(duplicate).valid).toBe(false);

    const unknown = baseWorld({
      shards: 1,
      harvestedShards: ["not-a-real-fortress"],
    });
    expect(validateWorldSnapshot(unknown).valid).toBe(false);
  });

  it("accepts a v4 snapshot with matching harvestedShards", () => {
    const valid = baseWorld({
      shards: 1,
      harvestedShards: ["fortress.cinderwild-shrine"],
    });
    expect(validateWorldSnapshot(valid).valid).toBe(true);
  });

  it("rejects reserved keys and overly deep records", () => {
    const reserved: Record<string, unknown> = { ...(baseWorld() as Record<string, unknown>) };
    Object.defineProperty(reserved, "__proto__", { value: { x: 1 }, enumerable: true, writable: true, configurable: true });
    expect(validateWorldSnapshot(reserved).valid).toBe(false);

    let deep: any = { level: 0 };
    let cursor = deep;
    for (let i = 0; i < 30; i++) {
      cursor.next = { level: i + 1 };
      cursor = cursor.next;
    }
    expect(validateWorldSnapshot(baseWorld({ nested: deep })).valid).toBe(false);
  });

  it("rejects invalid journal, quests, regions, checkpoint, deaths, atlas", () => {
    expect(validateWorldSnapshot(baseWorld({ journal: [123] as any })).valid).toBe(false);
    expect(validateWorldSnapshot(baseWorld({ quests: { facts: "nope" as any } })).valid).toBe(false);
    expect(validateWorldSnapshot(baseWorld({ regions: { nowhere: {} as any } })).valid).toBe(false);
    expect(
      validateWorldSnapshot(baseWorld({ checkpoint: { regionId: "overworld", x: "x" as any, y: 0, name: "c" } })).valid,
    ).toBe(false);
    expect(validateWorldSnapshot(baseWorld({ deaths: -1 })).valid).toBe(false);
    expect(validateWorldSnapshot(baseWorld({ atlasDiscoveries: { nowhere: ["x"] } })).valid).toBe(false);
  });
});
