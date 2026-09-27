import initSqlJs, { type Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { WorldSnapshot } from "./core/WorldState";
import { type Difficulty, normalizeDifficulty } from "./types";

const DATABASE_KEY = "eldrinth.sqlite.v1";
export const SLOT_COUNT = 3;

/** Schema version stored in SQLite's `user_version`. Bump with a migration below. */
const SCHEMA_VERSION = 1;

const SUPPORTED_WORLD_VERSIONS = [1, 2, 3, 4];

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
class SlotStore {
  private dbPromise: Promise<Database> | null = null;
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
      const saved = localStorage.getItem(DATABASE_KEY);
      if (saved) bytes = decode(saved);
    } catch (error) {
      // Reading can fail even when writing would not, but a missing read is not
      // itself fatal: we open an empty database and warn that saves are at risk.
      this.setStatus(false, describeWriteFailure(error), error);
    }
    const db = new SQL.Database(bytes);
    this.migrate(db);
    return db;
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
  }

  private persist(db: Database) {
    try {
      localStorage.setItem(DATABASE_KEY, encode(db.export()));
      this.setStatus(true, null);
    } catch (error) {
      // Previously swallowed with a comment. A silent failure here looks exactly
      // like a successful one: the title screen keeps showing the last save and
      // the player loses a whole run with no warning.
      console.error("Failed to persist save data:", error);
      this.setStatus(false, describeWriteFailure(error), error);
    }
  }

  async list(): Promise<SaveSlot[]> {
    const result = (await this.db()).exec("SELECT id, difficulty, shards, updated_at FROM save_slots ORDER BY id")[0];
    if (!result) return [];
    return result.values.map((row: any[]) => ({ id: Number(row[0]), difficulty: normalizeDifficulty(row[1]), shards: Number(row[2]), updatedAt: Number(row[3]) }));
  }

  async load(id: number): Promise<SlotSave | null> {
    const result = (await this.db()).exec("SELECT difficulty, shards, updated_at, world_json FROM save_slots WHERE id = ?", [id])[0];
    if (!result?.values[0]) return null;
    const [difficulty, shards, updatedAt, json] = result.values[0];
    try {
      const world = JSON.parse(String(json)) as WorldSnapshot;
      if (!world || !SUPPORTED_WORLD_VERSIONS.includes(world.version) ||
          typeof world.regionId !== "string" || !world.regionId ||
          !world.player || !Array.isArray(world.player.swingHit) ||
          !Array.isArray(world.enemies) || !Array.isArray(world.projectiles) ||
          !Array.isArray(world.items)) return null;
      const validDifficulty = normalizeDifficulty(difficulty, normalizeDifficulty(world.difficulty, "standard"));
      world.difficulty = normalizeDifficulty(world.difficulty, validDifficulty);
      return { id, difficulty: validDifficulty, shards: Number(shards), updatedAt: Number(updatedAt), world };
    } catch { return null; }
  }

  async save(id: number, world: WorldSnapshot) {
    const db = await this.db();
    const difficulty = normalizeDifficulty(world.difficulty, "standard");
    world.difficulty = difficulty;
    db.run("INSERT OR REPLACE INTO save_slots (id, difficulty, shards, updated_at, world_json) VALUES (?, ?, ?, ?, ?)", [id, difficulty, world.shards, Date.now(), JSON.stringify(world)]);
    this.persist(db);
  }

  async remove(id: number) {
    const db = await this.db();
    db.run("DELETE FROM save_slots WHERE id = ?", [id]);
    this.persist(db);
  }
}

export const slotStore = new SlotStore();
