import initSqlJs, { type Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { WorldSnapshot } from "./core/WorldState";
import { type Difficulty, normalizeDifficulty } from "./types";

const DATABASE_KEY = "eldrinth.sqlite.v1";
export const SLOT_COUNT = 3;

/** Schema version stored in SQLite's `user_version`. Bump with a migration below. */
const SCHEMA_VERSION = 2;

const SUPPORTED_WORLD_VERSIONS = [1, 2, 3, 4];
const UNSAFE_SAVING = "Safe saving is unavailable here. Open the game over HTTPS in an up-to-date browser. Existing records have been left untouched.";

export interface SaveSlot {
  id: number;
  difficulty: Difficulty;
  shards: number;
  updatedAt: number;
}

export interface SlotSave extends SaveSlot { world: WorldSnapshot }

/**
 * Why saves are not reaching disk, or null while they are. The shell surfaces
 * this: a player who cannot persist progress must be told before they invest an
 * hour in a run, not after.
 */
export interface PersistenceStatus {
  ok: boolean;
  /** Player-facing explanation when `ok` is false. */
  reason: string | null;
  /** Underlying error, for the console. */
  cause: unknown;
}

type StatusListener = (status: PersistenceStatus) => void;

function encode(bytes: Uint8Array) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

function decode(value: string) {
  const raw = atob(value);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function describeWriteFailure(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
    return "This browser's storage is full, so progress cannot be saved. Free up some space and reload.";
  }
  return "This browser is blocking local storage (private or incognito windows usually do), so progress cannot be saved.";
}

/** SQLite-in-WASM persisted as one opaque database file in localStorage. */
export class SlotStore {
  private dbPromise: Promise<Database> | null = null;
  private persisted: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  // Listing records must not advance the revision owned by a running game.
  private owned = new Map<number, string | null>();
  private listed = new Map<number, string | null>();
  private status: PersistenceStatus = { ok: true, reason: null, cause: null };
  private listeners = new Set<StatusListener>();

  /** Subscribe to persistence health. Returns an unsubscribe function. */
  onStatusChange(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  getStatus(): PersistenceStatus {
    return this.status;
  }

  private setStatus(ok: boolean, reason: string | null, cause: unknown = null) {
    if (this.status.ok === ok && this.status.reason === reason) return;
    this.status = { ok, reason, cause };
    for (const listener of this.listeners) listener(this.status);
  }

  private async db() {
    if (!this.dbPromise) {
      // A rejected promise would otherwise be cached for the life of the page,
      // turning one transient failure into a permanently dead save system.
      const attempt = this.open().catch((error) => {
        if (this.dbPromise === attempt) this.dbPromise = null;
        throw error;
      });
      this.dbPromise = attempt;
    }
    return this.dbPromise;
  }

  private async open() {
    const locateFile = () => {
      if (typeof window === "undefined" && wasmUrl.startsWith("/")) {
        return "." + wasmUrl;
      }
      return wasmUrl;
    };
    const SQL = await initSqlJs({ locateFile });
    let bytes: Uint8Array | undefined;
    try {
      this.persisted = localStorage.getItem(DATABASE_KEY);
    } catch (error) {
      // Reading can fail even when writing would not, but a missing read is not
      // itself fatal: we open an empty database and warn that saves are at risk.
      this.setStatus(false, describeWriteFailure(error), error);
    }
    // Invalid data must never be mistaken for an empty database.
    if (this.persisted) bytes = decode(this.persisted);
    const db = new SQL.Database(bytes);
    try { this.migrate(db); } catch (error) { db.close(); throw error; }
    if (typeof window !== "undefined" && !globalThis.navigator?.locks) {
      this.setStatus(false, UNSAFE_SAVING);
    }
    return db;
  }

  /** Reload and mutate under one cross-tab lock; a cached database is only a view. */
  private run<T>(write: boolean, action: (db: Database) => T): Promise<T> {
    const execute = async () => {
      let db = await this.db();
      const locked = async () => {
        let readable = true;
        let saved = this.persisted;
        try { saved = localStorage.getItem(DATABASE_KEY); }
        catch (error) { readable = false; this.setStatus(false, describeWriteFailure(error), error); }
        if (readable && saved !== this.persisted) {
          const SQL = await initSqlJs();
          const latest = new SQL.Database(saved ? decode(saved) : undefined);
          try { this.migrate(latest); } catch (error) { latest.close(); throw error; }
          db.close();
          db = latest;
          this.dbPromise = Promise.resolve(db);
          this.persisted = saved;
        }
        if (write && !readable) throw new Error(this.status.reason ?? "Save records could not be read.");
        if (!write) return action(db);

        // SQLite is only a cache until localStorage accepts the exported bytes.
        // A failed write must restore both the cache and its revision ownership,
        // or an erase appears successful and a retry can conflict with itself.
        const before = db.export();
        const owned = new Map(this.owned);
        const listed = new Map(this.listed);
        try {
          const result = action(db);
          this.persist(db);
          return result;
        } catch (error) {
          const SQL = await initSqlJs();
          const previous = new SQL.Database(before);
          db.close();
          db = previous;
          this.dbPromise = Promise.resolve(db);
          this.owned = owned;
          this.listed = listed;
          throw error;
        }
      };
      if (globalThis.navigator?.locks) return navigator.locks.request(DATABASE_KEY, locked);
      // Non-browser tests can use a single-process queue. In browsers lacking
      // cross-tab locks, reads remain available but no persistent mutation is safe.
      if (write && typeof window !== "undefined") {
        throw new Error(UNSAFE_SAVING);
      }
      return locked();
    };
    const pending = this.queue.then(execute, execute);
    this.queue = pending.catch(() => undefined);
    return pending;
  }

  private revision(db: Database, id: number): string | null {
    const row = db.exec("SELECT revision FROM save_slots WHERE id = ?", [id])[0]?.values[0];
    return row ? String(row[0]) : null;
  }

  private assertRevision(db: Database, id: number, expected: string | null) {
    if (this.revision(db, id) !== expected) {
      throw new Error("This record changed in another tab. Reload and continue the latest record before saving again. No saved progress was overwritten.");
    }
  }

  async prepareNew(id: number) {
    return this.run(false, (db) => {
      this.assertRevision(db, id, null);
      this.owned.set(id, null);
    });
  }

  /**
   * `CREATE TABLE IF NOT EXISTS` does not upgrade an existing table, so a v2
   * schema would otherwise be read with v1 column assumptions and throw for
   * exactly the players with the longest runs. Each step runs at most once and
   * `user_version` records how far the database has come.
   */
  private migrate(db: Database) {
    const readVersion = Number(db.exec("PRAGMA user_version")[0]?.values[0]?.[0] ?? 0);
    if (readVersion > SCHEMA_VERSION) {
      // A database from a newer build. Leave it alone rather than risk
      // destroying progress written by a version that understands it.
      throw new Error(`Save data was written by a newer version of the game (schema ${readVersion}).`);
    }
    if (readVersion < 1) {
      db.run(`CREATE TABLE IF NOT EXISTS save_slots (
        id INTEGER PRIMARY KEY CHECK (id BETWEEN ${1} AND ${SLOT_COUNT}),
        difficulty TEXT NOT NULL,
        shards INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        world_json TEXT NOT NULL
      )`);
      db.run(`PRAGMA user_version = 1`);
    }
    if (readVersion < 2) {
      db.run("ALTER TABLE save_slots ADD COLUMN revision TEXT NOT NULL DEFAULT ''");
      // Stable across readers before the first v2 write; future writes get a
      // random revision, including identical snapshots saved in the same ms.
      db.run("UPDATE save_slots SET revision = 'legacy:' || id || ':' || updated_at");
      db.run("PRAGMA user_version = 2");
    }
  }

  private persist(db: Database) {
    try {
      const encoded = encode(db.export());
      localStorage.setItem(DATABASE_KEY, encoded);
      this.persisted = encoded;
      this.setStatus(true, null);
    } catch (error) {
      // Previously swallowed with a comment. A silent failure here looks exactly
      // like a successful one: the title screen keeps showing the last save and
      // the player loses a whole run with no warning.
      console.error("Failed to persist save data:", error);
      const reason = describeWriteFailure(error);
      this.setStatus(false, reason, error);
      throw new Error(reason);
    }
  }

  async list(): Promise<SaveSlot[]> {
    return this.run(false, (db) => {
      const result = db.exec("SELECT id, difficulty, shards, updated_at, revision FROM save_slots ORDER BY id")[0];
      this.listed.clear();
      return (result?.values ?? []).map((row) => {
        this.listed.set(Number(row[0]), String(row[4]));
        return { id: Number(row[0]), difficulty: normalizeDifficulty(row[1]), shards: Number(row[2]), updatedAt: Number(row[3]) };
      });
    });
  }

  async load(id: number): Promise<SlotSave | null> {
    return this.run(false, (db) => {
      const result = db.exec("SELECT difficulty, shards, updated_at, world_json, revision FROM save_slots WHERE id = ?", [id])[0];
      if (!result?.values[0]) return null;
      const [difficulty, shards, updatedAt, json, revision] = result.values[0];
      try {
        const world = JSON.parse(String(json)) as WorldSnapshot;
        if (!world || !SUPPORTED_WORLD_VERSIONS.includes(world.version) ||
            typeof world.regionId !== "string" || !world.regionId ||
            !world.player || !Array.isArray(world.player.swingHit) ||
            !Array.isArray(world.enemies) || !Array.isArray(world.projectiles) ||
            !Array.isArray(world.items)) return null;
        const validDifficulty = normalizeDifficulty(difficulty, normalizeDifficulty(world.difficulty, "standard"));
        world.difficulty = normalizeDifficulty(world.difficulty, validDifficulty);
        this.owned.set(id, String(revision));
        return { id, difficulty: validDifficulty, shards: Number(shards), updatedAt: Number(updatedAt), world };
      } catch { return null; }
    });
  }

  async save(id: number, world: WorldSnapshot) {
    return this.run(true, (db) => {
      this.assertRevision(db, id, this.owned.get(id) ?? null);
      const difficulty = normalizeDifficulty(world.difficulty, "standard");
      world.difficulty = difficulty;
      db.run("INSERT OR REPLACE INTO save_slots (id, difficulty, shards, updated_at, world_json, revision) VALUES (?, ?, ?, ?, ?, lower(hex(randomblob(16))))", [id, difficulty, world.shards, Date.now(), JSON.stringify(world)]);
      this.owned.set(id, this.revision(db, id));
    });
  }

  async remove(id: number) {
    return this.run(true, (db) => {
      this.assertRevision(db, id, this.listed.get(id) ?? null);
      db.run("DELETE FROM save_slots WHERE id = ?", [id]);
      this.listed.delete(id);
      // Keep the old owned revision: an outgoing game's autosave must not
      // resurrect a slot that the title screen just erased.
    });
  }
}

export const slotStore = new SlotStore();
