import { T } from "./constants";
import type { Vec } from "./types";

export interface FortressLayout {
  width: number;
  height: number;
  tiles: Uint8Array;
  /** Tile coordinates. The door is both the arrival tile and the way out. */
  door: Vec;
  shard: Vec;
  warden: Vec | null;
  enemies: Vec[];
  braziers: Vec[];
}

/**
 * Glyphs that stand on floor. The marker records a position; the tile
 * underneath it is always walkable, so a shard is never sealed by the very
 * glyph that places it.
 */
const FLOOR_GLYPHS = new Set([".", "D", "S", "W", "E", "*"]);

export function parseFortressLayout(rows: string[]): FortressLayout {
  if (rows.length === 0) throw new Error("A fortress layout needs at least one row.");
  const width = rows[0].length;
  const height = rows.length;
  for (const [y, row] of rows.entries()) {
    if (row.length !== width) {
      throw new Error(`Fortress row ${y} has width ${row.length}, expected ${width}.`);
    }
  }

  const tiles = new Uint8Array(width * height);
  const doors: Vec[] = [];
  const shards: Vec[] = [];
  const enemies: Vec[] = [];
  const braziers: Vec[] = [];
  let warden: Vec | null = null;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const glyph = rows[y][x];
      if (glyph !== "#" && !FLOOR_GLYPHS.has(glyph) && glyph !== "^") {
        throw new Error(`Unknown fortress glyph "${glyph}" at ${x},${y}.`);
      }
      tiles[y * width + x] = glyph === "#" ? T.RWALL : glyph === "^" ? T.EMBERS : T.RFLOOR;
      if (glyph === "D") doors.push({ x, y });
      if (glyph === "S") shards.push({ x, y });
      if (glyph === "W") warden = { x, y };
      if (glyph === "E") enemies.push({ x, y });
      if (glyph === "*") braziers.push({ x, y });
    }
  }

  if (doors.length !== 1) throw new Error(`A fortress needs exactly one door, found ${doors.length}.`);
  if (shards.length !== 1) throw new Error(`A fortress needs exactly one shard, found ${shards.length}.`);

  return { width, height, tiles, door: doors[0], shard: shards[0], warden, enemies, braziers };
}

/** Every tile the player can walk to from the door. */
function reachable(layout: FortressLayout): Uint8Array {
  const { width, height, tiles, door } = layout;
  const seen = new Uint8Array(width * height);
  const queue: Vec[] = [door];
  seen[door.y * width + door.x] = 1;

  while (queue.length > 0) {
    const { x, y } = queue.pop()!;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const i = ny * width + nx;
      if (seen[i] || tiles[i] === T.RWALL) continue;
      seen[i] = 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

/**
 * The run is unwinnable if the shard cannot be reached, because the ending
 * gates on all nine.
 */
export function shardIsReachable(layout: FortressLayout): boolean {
  const seen = reachable(layout);
  return seen[layout.shard.y * layout.width + layout.shard.x] === 1;
}

/**
 * Spawns the player can never meet. An enemy sealed behind a wall is a
 * softlock anywhere a room gates on clearing it, and wasted everywhere else.
 */
export function unreachableSpawns(layout: FortressLayout): Vec[] {
  const seen = reachable(layout);
  const spawns = layout.warden ? [...layout.enemies, layout.warden] : [...layout.enemies];
  return spawns.filter(({ x, y }) => seen[y * layout.width + x] !== 1);
}
