import initSqlJs, { type Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { WorldSnapshot } from "./core/WorldState";
import { type Difficulty, normalizeDifficulty } from "./types";

const DATABASE_KEY = "eldrinth.sqlite.v1";
export const SLOT_COUNT = 3;

export interface SaveSlot {
  id: number;
  difficulty: Difficulty;
  shards: number;
  updatedAt: number;
}

export interface SlotSave extends SaveSlot { world: WorldSnapshot }

function encode(bytes: Uint8Array) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

function decode(value: string) {
  const raw = atob(value);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

/** SQLite-in-WASM persisted as one opaque database file in localStorage. */
class SlotStore {
  private dbPromise: Promise<Database> | null = null;

  private async db() {
    if (!this.dbPromise) this.dbPromise = this.open();
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
    } catch { /* persistence remains optional */ }
    const db = new SQL.Database(bytes);
    db.run(`CREATE TABLE IF NOT EXISTS save_slots (
      id INTEGER PRIMARY KEY CHECK (id BETWEEN 1 AND 3),
      difficulty TEXT NOT NULL,
      shards INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      world_json TEXT NOT NULL
    )`);
    return db;
  }

  private persist(db: Database) {
    try { localStorage.setItem(DATABASE_KEY, encode(db.export())); } catch { /* quota/private mode */ }
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
      if ((world.version !== 1 && world.version !== 2 && world.version !== 3 && world.version !== 4) || !world.player) return null;
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
