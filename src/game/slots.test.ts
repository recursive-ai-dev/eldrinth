import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlotStore } from "./slots";
import { isDifficulty, normalizeDifficulty } from "./types";
import { WorldState } from "./core/WorldState";
import { createBackup, parseBackup, MAX_BACKUP_BYTES } from "./saveBackup";

describe("Difficulty validation & SlotStore", () => {
  let slotStore: SlotStore;
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    slotStore = new SlotStore();
  });
  afterEach(() => vi.unstubAllGlobals());

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

  describe("portable pilgrimage backups", () => {
    it("round trips journal, exploration, equipment and decisions into a different empty slot", async () => {
      const snapshot = makeSnapshot("brutal");
      snapshot.player.relics = ["emberheart"];
      snapshot.player.equippedRelics = ["emberheart"];
      snapshot.player.combatTool = "gravehammer";
      snapshot.journal = [{ id: "personal:1", title: "My observation", text: "Return by the north road." }];
      snapshot.quests = { facts: ["courier-orders"], resolutions: { courier: "end" } };
      snapshot.atlasDiscoveries = { overworld: ["overworld:wayfire:1"] };
      await slotStore.save(1, snapshot);
      const contents = await slotStore.exportBackup(1);
      await slotStore.importBackup(3, contents);
      const restored = new WorldState();
      restored.restore(snapshot);
      expect((await slotStore.load(3))?.world).toEqual(restored.snapshot());
      expect((await slotStore.load(1))?.world).toEqual(snapshot);
      expect((await slotStore.list()).map(slot => slot.id)).toEqual([1, 3]);
    });

    it("never replaces an occupied slot, even when importing the same backup", async () => {
      const contents = createBackup(makeSnapshot("story"));
      await slotStore.save(1, makeSnapshot("brutal"));
      await expect(slotStore.importBackup(1, contents)).rejects.toThrow("changed in another tab");
      expect((await slotStore.load(1))?.difficulty).toBe("brutal");
      await expect(slotStore.importBackup(0, contents)).rejects.toThrow("empty save slot");
    });

    it("migrates older compatible world snapshots before writing an imported record", async () => {
      const old = makeSnapshot();
      old.version = 3;
      await slotStore.importBackup(2, createBackup(old));
      const restored = await slotStore.load(2);
      expect(restored?.world.version).toBe(4);
      expect(restored?.world.player.maxHp).toBe(18);
      expect(restored?.world.harvestedShards).toEqual([]);
    });

    it("rejects malformed, oversized, unsupported and ambiguous records without occupying a slot", async () => {
      const valid = createBackup(makeSnapshot());
      const mutations: ((world: any) => void)[] = [
        world => { world.version = 999; },
        world => { world.player.hp = "full"; },
        world => { world.player.swingHit = {}; },
        world => { world.regionId = "fortress.missing"; },
        world => { world.enemies = [null]; },
        world => { world.projectiles = [{}]; },
        world => { world.items = [{ x: 1, y: 2, t: 0, taken: false, type: "unknown" }]; },
        world => { world.regions = { overworld: null }; },
        world => { world.quests = { facts: null, resolutions: {} }; },
        world => { world.journal = [{ id: "note", title: [], text: "test" }]; },
        world => { world.checkpoint = { regionId: "unknown", x: 1, y: 2, name: "fire" }; },
        world => { world.atlasDiscoveries = { overworld: [{}] }; },
        world => { world.shards = 1; delete world.harvestedShards; },
        world => { world.shards = 1; world.harvestedShards = ["fortress.missing"]; },
      ];
      for (const mutate of mutations) {
        const backup = JSON.parse(valid);
        mutate(backup.world);
        await expect(slotStore.importBackup(1, JSON.stringify(backup))).rejects.toThrow();
      }
      await expect(slotStore.importBackup(1, "{bad json")).rejects.toThrow("not a valid");
      await expect(slotStore.importBackup(1, valid.replace('"version": 1,', '"version": 2,'))).rejects.toThrow("not a valid");
      await expect(slotStore.importBackup(1, " ".repeat(MAX_BACKUP_BYTES + 1))).rejects.toThrow("too large");
      await expect(slotStore.importBackup(1, valid.replace('"randomState": 1831565813', '"randomState": 1e999'))).rejects.toThrow();
      await expect(slotStore.importBackup(1, valid.replace('"world": {', '\"world\": {\"__proto__\": {},'))).rejects.toThrow("not a valid");
      expect(await slotStore.list()).toEqual([]);
    });

    it("bounds nested input before compatibility restore", () => {
      const valid = JSON.parse(createBackup(makeSnapshot()));
      valid.unknown = JSON.parse("[".repeat(30) + "0" + "]".repeat(30));
      expect(() => parseBackup(JSON.stringify(valid))).toThrow("not a valid");
    });
  });

  describe("independent save clients", () => {
    let storage: Map<string, string>;
    beforeEach(() => {
      storage = new Map();
      vi.stubGlobal("localStorage", {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      });
      let queue: Promise<unknown> = Promise.resolve();
      vi.stubGlobal("navigator", { locks: {
        request: (_name: string, callback: () => unknown) => {
          const result = queue.then(callback);
          queue = result.catch(() => undefined);
          return result;
        },
      } });
    });
    afterEach(() => vi.unstubAllGlobals());

    it("accepts only one simultaneous import into the same empty slot", async () => {
      const contents = createBackup(makeSnapshot("story"));
      const a = new SlotStore(), b = new SlotStore();
      const results = await Promise.allSettled([a.importBackup(2, contents), b.importBackup(2, contents)]);
      expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
      expect((await new SlotStore().list()).map(slot => slot.id)).toEqual([2]);
    });

    it("exporting a newer record does not grant an older session permission to overwrite it", async () => {
      const a = new SlotStore(), b = new SlotStore();
      await a.save(1, makeSnapshot("story"));
      await b.load(1);
      await a.save(1, makeSnapshot("brutal"));
      expect(parseBackup(await b.exportBackup(1)).difficulty).toBe("brutal");
      await expect(b.save(1, makeSnapshot("story"))).rejects.toThrow("changed in another tab");
    });

    it("rolls back a failed import and allows retry without erasing other records", async () => {
      const a = new SlotStore();
      await a.save(1, makeSnapshot("brutal"));
      const before = [...storage.entries()];
      const contents = createBackup(makeSnapshot("story"));
      const write = vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
      await expect(a.importBackup(2, contents)).rejects.toThrow("storage is full");
      expect([...storage.entries()]).toEqual(before);
      expect((await a.list()).map(slot => slot.id)).toEqual([1]);
      write.mockRestore();
      await a.importBackup(2, contents);
      expect((await new SlotStore().list()).map(slot => [slot.id, slot.difficulty])).toEqual([[1, "brutal"], [2, "story"]]);
    });

    it("retains concurrent writes to different slots from initially stale clients", async () => {
      const a = new SlotStore(), b = new SlotStore();
      await Promise.all([a.list(), b.list()]);
      await Promise.all([a.save(1, makeSnapshot("story")), b.save(2, makeSnapshot("brutal"))]);
      expect((await new SlotStore().list()).map(s => [s.id, s.difficulty])).toEqual([[1, "story"], [2, "brutal"]]);
    });

    it("rejects stale writes even after refreshing the title's slot labels", async () => {
      const a = new SlotStore(), b = new SlotStore();
      await a.save(1, makeSnapshot());
      await b.load(1);
      await a.save(1, makeSnapshot("brutal"));
      await b.list();
      await expect(b.save(1, makeSnapshot("story"))).rejects.toThrow("changed in another tab");
      expect((await new SlotStore().load(1))?.difficulty).toBe("brutal");
      // An explicit reload adopts the latest revision and can save again.
      await b.load(1);
      await b.save(1, makeSnapshot("story"));
    });

    it("rechecks supposedly empty slots and refuses to replace occupied records", async () => {
      const a = new SlotStore(), b = new SlotStore();
      await b.list();
      await b.prepareNew(1);
      await a.save(1, makeSnapshot("brutal"));
      await expect(b.prepareNew(1)).rejects.toThrow("changed in another tab");
      await expect(b.save(1, makeSnapshot())).rejects.toThrow("changed in another tab");
      expect((await new SlotStore().load(1))?.difficulty).toBe("brutal");
    });

    it("does not resurrect an erased slot or erase a newer revision", async () => {
      const a = new SlotStore(), b = new SlotStore();
      await a.save(1, makeSnapshot());
      await b.list();
      await a.save(1, makeSnapshot("brutal"));
      await expect(b.remove(1)).rejects.toThrow("changed in another tab");
      await b.list();
      await b.remove(1);
      await expect(a.save(1, makeSnapshot())).rejects.toThrow("changed in another tab");
      expect(await new SlotStore().list()).toEqual([]);
    });

    it("detects erase-and-recreate even when the snapshot and clock are identical", async () => {
      vi.spyOn(Date, "now").mockReturnValue(123);
      try {
        const a = new SlotStore(), b = new SlotStore();
        const snapshot = makeSnapshot();
        await a.save(1, snapshot);
        await b.list();
        await b.remove(1);
        await b.prepareNew(1);
        await b.save(1, snapshot);
        await expect(a.save(1, snapshot)).rejects.toThrow("changed in another tab");
      } finally { vi.restoreAllMocks(); }
    });

    it("only accepts one of two simultaneous writes to the same revision", async () => {
      const a = new SlotStore(), b = new SlotStore();
      await a.save(1, makeSnapshot());
      await b.load(1);
      const results = await Promise.allSettled([a.save(1, makeSnapshot("story")), b.save(1, makeSnapshot("brutal"))]);
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
    });

    it("migrates a v1 database without losing another slot or inventing a revision conflict", async () => {
      const source = new SlotStore();
      await source.save(1, makeSnapshot("story"));
      const oldDb = await (source as any).db();
      oldDb.run("ALTER TABLE save_slots DROP COLUMN revision");
      oldDb.run("PRAGMA user_version = 1");
      storage.set("eldrinth.sqlite.v1", btoa(String.fromCharCode(...oldDb.export())));
      const a = new SlotStore(), b = new SlotStore();
      await a.list();
      await b.load(1);
      await a.save(2, makeSnapshot("brutal"));
      await b.save(1, makeSnapshot("standard"));
      expect((await new SlotStore().list()).map(s => [s.id, s.difficulty])).toEqual([[1, "standard"], [2, "brutal"]]);
    });

    it("warns on quota failure while preserving the last persisted save", async () => {
      const a = new SlotStore();
      await a.save(1, makeSnapshot("story"));
      const before = [...storage.entries()];
      const write = vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
      await expect(a.save(1, makeSnapshot("brutal"))).rejects.toThrow("storage is full");
      expect(a.getStatus().ok).toBe(false);
      expect(a.getStatus().reason).toContain("storage is full");
      expect([...storage.entries()]).toEqual(before);
      expect((await a.load(1))?.difficulty).toBe("story");
      expect((await new SlotStore().load(1))?.difficulty).toBe("story");
      write.mockRestore();
      await a.save(1, makeSnapshot("brutal"));
      expect((await new SlotStore().load(1))?.difficulty).toBe("brutal");
      expect(a.getStatus().ok).toBe(true);
    });

    it("keeps an erase visible and retryable when storage refuses the deletion", async () => {
      const a = new SlotStore();
      await a.save(1, makeSnapshot("story"));
      await a.list();
      const before = [...storage.entries()];
      const write = vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
      await expect(a.remove(1)).rejects.toThrow("storage is full");
      expect((await a.list()).map(slot => slot.id)).toEqual([1]);
      expect([...storage.entries()]).toEqual(before);
      write.mockRestore();
      await a.remove(1);
      expect(await new SlotStore().list()).toEqual([]);
    });

    it("rejects writes while storage cannot be read and keeps the cached record intact", async () => {
      const a = new SlotStore();
      await a.save(1, makeSnapshot("story"));
      const read = vi.spyOn(localStorage, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
      await expect(a.save(1, makeSnapshot("brutal"))).rejects.toThrow("blocking local storage");
      read.mockRestore();
      expect((await a.load(1))?.difficulty).toBe("story");
      await a.save(1, makeSnapshot("brutal"));
      expect((await new SlotStore().load(1))?.difficulty).toBe("brutal");
    });

    it("never treats corrupt stored bytes as a new empty database", async () => {
      storage.set("eldrinth.sqlite.v1", "invalid base64!");
      const a = new SlotStore();
      await expect(a.list()).rejects.toThrow();
      await expect(a.save(1, makeSnapshot())).rejects.toThrow();
      expect(storage.get("eldrinth.sqlite.v1")).toBe("invalid base64!");
    });
  });

});
