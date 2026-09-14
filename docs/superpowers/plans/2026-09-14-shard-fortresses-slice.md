# Shard Fortress Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn one shard site — the Cinderwild Broken Shrine — from a 7×7
floor square into a fortress you enter, commit to, and leave worse than you
arrived.

**Architecture:** A fortress is a region, reusing `RegionExit` and
`changeRegion` wholesale. Its layout is an ASCII grid parsed by a pure,
Node-testable module (`engine.ts` can never be imported by a test — it drags
in `renderer.ts` and the sprite atlas, which expect a browser). Three
pressures make it cost something: no rest inside, darkness, and a warden
that is the shard's occupant.

**Tech Stack:** TypeScript, React 19, Vite, Canvas2D, Vitest, and the
vendored Python spritegen (dev-time only).

**Spec:** `docs/superpowers/specs/2026-09-14-shard-fortresses-slice-design.md`

## Global Constraints

- **A fortress is a region.** No new level concept, no new interaction verb.
  Exits fire on proximity to entries in `map.exits`.
- **`MapData` gains `dark`, `resetOnDeath` and `lights`.** The first two
  default to `false` and `lights` to `[]`, so every existing region renders
  and behaves exactly as it does today.
- **One existing region's tiles DO change.** The spec's §9 claim that
  existing regions produce identical tile arrays holds for the new fields
  only. Task 3 removes the Cinderwild's loose shard site, which also removes
  the road drawn to it and its 7x7 clearing, because both loops iterate
  `shardTiles`. That is the point of the task, not a regression.
- **The fortress must be at least 25×19 tiles.** `centerCam` clamps with
  `Math.max(0, mapPxW - viewW)`, so a map smaller than the 800×600 viewport
  pins to the corner with dead space. The layout in Task 3 is 26×19.
- **Every layout must pass a flood fill from `D` to `S`.** The ending gates
  on all nine shards, so an unreachable shard is an unwinnable run.
- **Adding a tile type to `T` breaks `spriteCatalog.test.ts` until its art
  exists.** That test asserts every `T` value has a `TILE_SPRITE_KEY` entry
  and a generated `sheet.png` + `manifest.json`. Tile and art land together.
- Python is dev-time only. It is never imported, bundled, or invoked from
  browser code.
- Run `npx vitest run` and `npx tsc --noEmit` before every commit.

---

### Task 1: The layout parser and its reachability guard

Everything pure, in one new module, with one test file. Later tasks only
consume it.

**Files:**
- Create: `src/game/fortress.ts`
- Test: `src/game/fortress.test.ts`

**Interfaces:**
- Consumes: `T` and `TileType` from `src/game/constants.ts`; `EnemySpawn`
  and `Vec` from `src/game/types.ts`.
- Produces, exported from `src/game/fortress.ts`:
  - `interface FortressLayout { width: number; height: number; tiles: Uint8Array; door: Vec; shard: Vec; warden: Vec | null; enemies: Vec[]; braziers: Vec[] }`
    — all positions in **tile** coordinates, not pixels.
  - `parseFortressLayout(rows: string[]): FortressLayout`
  - `shardIsReachable(layout: FortressLayout): boolean`
  - `unreachableSpawns(layout: FortressLayout): Vec[]` — warden and enemy
    positions the player cannot walk to

- [ ] **Step 1: Write the failing tests**

Create `src/game/fortress.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { T } from "./constants";
import { parseFortressLayout, shardIsReachable, unreachableSpawns } from "./fortress";

const TINY = [
  "#####",
  "#D..#",
  "#.#.#",
  "#*S.#",
  "#####",
];

describe("parseFortressLayout", () => {
  it("maps every glyph to the right tile and position", () => {
    const layout = parseFortressLayout(TINY);

    expect(layout.width).toBe(5);
    expect(layout.height).toBe(5);
    expect(layout.door).toEqual({ x: 1, y: 1 });
    expect(layout.shard).toEqual({ x: 2, y: 3 });
    expect(layout.braziers).toEqual([{ x: 1, y: 3 }]);
    expect(layout.tiles[0 * 5 + 0]).toBe(T.RWALL);
    expect(layout.tiles[1 * 5 + 2]).toBe(T.RFLOOR);
  });

  it("treats the door, shard, brazier and spawn glyphs as walkable floor", () => {
    const layout = parseFortressLayout(TINY);
    for (const p of [layout.door, layout.shard, ...layout.braziers]) {
      expect(layout.tiles[p.y * layout.width + p.x]).toBe(T.RFLOOR);
    }
  });

  it("collects wardens and ordinary enemies separately", () => {
    const layout = parseFortressLayout(["#####", "#D.W#", "#.E.#", "#..S#", "#####"]);
    expect(layout.warden).toEqual({ x: 3, y: 1 });
    expect(layout.enemies).toEqual([{ x: 2, y: 2 }]);
  });

  it("rejects ragged rows", () => {
    expect(() => parseFortressLayout(["###", "#D.S#", "###"])).toThrow(/width/i);
  });

  it("rejects an unknown glyph", () => {
    expect(() => parseFortressLayout(["####", "#DZ#", "#.S#", "####"])).toThrow(/Z/);
  });

  it("rejects a layout without exactly one shard", () => {
    expect(() => parseFortressLayout(["####", "#D.#", "#..#", "####"])).toThrow(/shard/i);
    expect(() => parseFortressLayout(["####", "#DS#", "#S.#", "####"])).toThrow(/shard/i);
  });

  it("rejects a layout without exactly one door", () => {
    expect(() => parseFortressLayout(["####", "#.S#", "#..#", "####"])).toThrow(/door/i);
    expect(() => parseFortressLayout(["####", "#DS#", "#D.#", "####"])).toThrow(/door/i);
  });
});

describe("shardIsReachable", () => {
  it("accepts a shard the player can walk to", () => {
    expect(shardIsReachable(parseFortressLayout(TINY))).toBe(true);
  });

  it("rejects a shard sealed behind walls", () => {
    const sealed = parseFortressLayout([
      "######",
      "#D.#S#",
      "#..###",
      "######",
    ]);
    expect(shardIsReachable(sealed)).toBe(false);
  });
});

describe("unreachableSpawns", () => {
  it("finds nothing when every spawn can be walked to", () => {
    const layout = parseFortressLayout(["#####", "#D.W#", "#.E.#", "#..S#", "#####"]);
    expect(unreachableSpawns(layout)).toEqual([]);
  });

  it("reports a warden sealed behind walls", () => {
    const layout = parseFortressLayout([
      "######",
      "#DS#W#",
      "#..###",
      "######",
    ]);
    expect(unreachableSpawns(layout)).toEqual([{ x: 4, y: 1 }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/fortress.test.ts`
Expected: FAIL — `src/game/fortress.ts` does not exist.

- [ ] **Step 3: Implement the parser**

Create `src/game/fortress.ts`:

```typescript
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
```

This references `T.EMBERS`, which Task 2 adds. Until then the module will
not type-check — that is expected and is why Task 2 follows immediately.

- [ ] **Step 4: Add the EMBERS placeholder so this task compiles**

`T.EMBERS` is fully specified in Task 2 (tile definition, sprite key,
generated art). To keep this task independently green, add **only** the
enum value now, in `src/game/constants.ts`, immediately after `TRIGGER`:

```typescript
  TRIGGER: 19,
  EMBERS: 20,
```

Do not add its `TILE_DEFINITIONS` entry, `TILE_SPRITE_KEY` entry, or
catalog entry yet — those are Task 2. `spriteCatalog.test.ts` will fail
until Task 2 lands, so **this task's commit is expected to leave that one
test red.** Note it in your report; do not try to fix it here and do not
delete the test.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/game/fortress.test.ts && npx tsc --noEmit`
Expected: all fortress tests PASS, no type errors. `npx vitest run` overall
will show `spriteCatalog.test.ts` failing on the missing `EMBERS` art —
expected, and resolved by Task 2.

- [ ] **Step 6: Commit**

```bash
git add src/game/fortress.ts src/game/fortress.test.ts src/game/constants.ts
git commit -m "Add the fortress layout parser and its reachability guard

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The embers hazard tile and its art

Closes the catalog-completeness failure Task 1 left open.

**Files:**
- Modify: `src/game/constants.ts` (`TILE_DEFINITIONS`, `TileDefinition`)
- Modify: `src/game/render/renderer.ts` (`TILE_SPRITE_KEY`)
- Modify: `tools/spritegen/catalog.py`
- Generated: `src/assets/sprites/tile.embers/{sheet.png,manifest.json}`

**Interfaces:**
- Consumes: `T.EMBERS` from Task 1.
- Produces: `TileDefinition.harm?: number` — the health cost of standing on
  a tile, consumed by Task 6.

- [ ] **Step 1: Add the harm field and the tile definition**

In `src/game/constants.ts`, add an optional field to `TileDefinition`
alongside the existing `trigger`:

```typescript
  /** Health cost per application for standing on this tile. */
  harm?: number;
```

Then add the definition to `TILE_DEFINITIONS`, after the `T.TRIGGER` entry:

```typescript
  [T.EMBERS]: { shape: "none", harm: 1 },
```

Embers are walkable — the cost is the point, not a blocked route.

- [ ] **Step 2: Add the renderer key**

In `src/game/render/renderer.ts`, add to `TILE_SPRITE_KEY` after the
`T.TRIGGER` entry:

```typescript
  [T.EMBERS]: "tile.embers",
```

- [ ] **Step 3: Add the catalog entry**

In `tools/spritegen/catalog.py`, add alongside the other `tile.*` entries:

```python
    "tile.embers":         {"kind": "tile", "seed": "eldrinth-tile-embers",         "tile_kind": "dirt",  "palette": "cult_blood", "feature": "crystal"},
```

`cult_blood` is the existing red-toned palette used by `enemy.adept` and
`item.potion`, so the hazard reads as dangerous in the game's established
colour language rather than introducing a new one.

- [ ] **Step 4: Generate the art**

Run: `npm run gen:sprites`
Expected: writes `src/assets/sprites/tile.embers/sheet.png` and
`manifest.json`, and regenerates existing sheets deterministically (their
seeds are unchanged, so `git status` should show only the new directory as
added; if existing sheets show as modified, stop and report it — that means
something other than this entry changed).

- [ ] **Step 5: Verify the integrity test picks up the new atlas**

No manual hash bookkeeping is needed. `asset_integrity_test.py` reads
`manifest["pixelHashes"]` out of each generated `manifest.json` and checks
it against the committed `sheet.png`, so `gen:sprites` writes the hashes and
the test verifies they agree. It enumerates `CATALOG`, so the new entry is
covered automatically.

Run: `.venv/bin/python tools/spritegen/asset_integrity_test.py`
Expected: `OK: 30 atlases and <N> frame hashes verified` — 30, up from 29.
If it reports 29, the catalog entry was not picked up; if it reports a hash
mismatch, the committed sheet and manifest disagree and the generator did
not finish cleanly.

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, including `spriteCatalog.test.ts`, which was red after
Task 1 and is now satisfied by the new key and generated atlas.

- [ ] **Step 7: Commit**

```bash
git add src/game/constants.ts src/game/render/renderer.ts tools/spritegen/catalog.py tools/spritegen/asset_integrity_test.py src/assets/sprites/tile.embers
git commit -m "Add the embers hazard tile and generate its art

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The fortress region

**Files:**
- Modify: `src/game/types.ts` (`MapData`)
- Modify: `src/game/map.ts` (`generateMap` dispatch; the Cinderwild shard site)
- Create: `src/game/fortressLayouts.ts`
- Test: `src/game/fortressLayouts.test.ts`

**Interfaces:**
- Consumes: `parseFortressLayout` and `shardIsReachable` from Task 1.
- Produces: region id `"fortress.cinderwild-shrine"`; `MapData.dark` and
  `MapData.resetOnDeath`, both consumed by Tasks 4 and 5;
  `BROKEN_SHRINE` exported from `src/game/fortressLayouts.ts`.

- [ ] **Step 1: Add the MapData fields**

In `src/game/types.ts`, add to `MapData` after `campfires`:

```typescript
  /** Interiors render under a darkness overlay punched by light sources. */
  dark: boolean;
  /** Dying here discards the region's retained inhabitants. */
  resetOnDeath: boolean;
  /** Light sources that are not rest points. Pixel coordinates. */
  lights: Vec[];
```

All three are required fields, so the compiler will point at every map
builder that needs updating. In `generateMap`'s overworld return and in
`generateFrontierMap`'s return, add
`dark: false, resetOnDeath: false, lights: []`.

`lights` is separate from `campfires` on purpose: a brazier gives light but
must not be restable, and `campfires` is what `tryInteract` offers a rest
at. Task 5 consumes `lights`; it is declared here so every builder gains all
three fields in one compiler pass.

- [ ] **Step 2: Write the layout**

Create `src/game/fortressLayouts.ts`. This layout is 26 wide × 19 tall —
above the 25×19 minimum, so the camera never pins to a corner:

```typescript
/**
 * The Broken Shrine, in the Cinderwild. An entry pair of rooms, a hall that
 * has to be crossed, and the chamber where the courier's shell lies around
 * the vessel. 26x19 so the map is never smaller than the viewport.
 */
export const BROKEN_SHRINE = [
  "#########D################",
  "#............#...........#",
  "#..^^........#.....E.....#",
  "#............#...........#",
  "#............#...........#",
  "#########.########.#######",
  "#........................#",
  "#...*................*...#",
  "#........................#",
  "#.......^^....^^.........#",
  "#........................#",
  "######.##############.####",
  "#........................#",
  "#........................#",
  "#.......S.......W........#",
  "#........................#",
  "#....E..............E....#",
  "#........................#",
  "##########################",
];
```

- [ ] **Step 3: Write the layout's test**

Create `src/game/fortressLayouts.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { parseFortressLayout, shardIsReachable, unreachableSpawns } from "./fortress";
import { BROKEN_SHRINE } from "./fortressLayouts";

describe("shipped fortress layouts", () => {
  const layouts = { BROKEN_SHRINE };

  for (const [name, rows] of Object.entries(layouts)) {
    it(`${name} parses and is at least 25x19`, () => {
      const layout = parseFortressLayout(rows);
      expect(layout.width).toBeGreaterThanOrEqual(25);
      expect(layout.height).toBeGreaterThanOrEqual(19);
    });

    it(`${name} has a shard the player can reach from the door`, () => {
      expect(shardIsReachable(parseFortressLayout(rows))).toBe(true);
    });

    it(`${name} has a warden and at least one brazier`, () => {
      const layout = parseFortressLayout(rows);
      expect(layout.warden).not.toBeNull();
      expect(layout.braziers.length).toBeGreaterThan(0);
    });

    it(`${name} has no spawn sealed away from the player`, () => {
      expect(unreachableSpawns(parseFortressLayout(rows))).toEqual([]);
    });
  }
});
```

Adding a layout to the `layouts` object above is all sub-project 2 needs to
do to bring the other eight under the same guarantees.

- [ ] **Step 4: Build the fortress map**

In `src/game/map.ts`, add a builder and route to it from `generateMap`.
Change the dispatch line:

```typescript
export function generateMap(regionId = "overworld"): MapData {
  if (regionId.startsWith("fortress.")) return generateFortressMap(regionId);
  if (regionId !== "overworld") return generateFrontierMap(regionId);
```

Then add the builder, importing `parseFortressLayout` from `./fortress` and
`BROKEN_SHRINE` from `./fortressLayouts`:

```typescript
const FORTRESS_LAYOUTS: Record<string, { name: string; rows: string[]; returnTo: { region: string; destination: Vec } }> = {
  "fortress.cinderwild-shrine": {
    name: "The Broken Shrine",
    rows: BROKEN_SHRINE,
    returnTo: { region: "cinderwild", destination: { x: px(72), y: px(21) } },
  },
};

function generateFortressMap(regionId: string): MapData {
  const config = FORTRESS_LAYOUTS[regionId];
  if (!config) throw new Error(`Unknown fortress: ${regionId}`);
  const layout = parseFortressLayout(config.rows);
  const enemySpawns: EnemySpawn[] = layout.enemies.map(({ x, y }) => ({ x, y, type: "wraith" as const }));
  if (layout.warden) enemySpawns.push({ x: layout.warden.x, y: layout.warden.y, type: "sentinel", elite: true });

  return {
    regionName: config.name,
    width: layout.width,
    height: layout.height,
    tiles: layout.tiles,
    wardTiles: [],
    spawn: { x: px(layout.door.x), y: px(layout.door.y + 1) },
    npc: { x: -9999, y: -9999 },
    signs: [],
    shards: [{ x: px(layout.shard.x), y: px(layout.shard.y) }],
    enemySpawns,
    bossCenter: { x: px(layout.shard.x), y: px(layout.shard.y) },
    exits: [{
      x: layout.door.x,
      y: layout.door.y,
      targetRegion: config.returnTo.region,
      destination: config.returnTo.destination,
      label: "the Cinderwild",
    }],
    campfires: [],
    dark: true,
    resetOnDeath: true,
    lights: layout.braziers.map(({ x, y }) => ({ x: px(x), y: px(y) })),
  };
}
```

`campfires: []` is what makes §4's "commit at the door" true — there is
nothing to rest at and no checkpoint can be set inside.

- [ ] **Step 5: Replace the Cinderwild shard site with a gate**

In `generateFrontierMap`, the Cinderwild's `shardTiles` currently place a
loose shard at `[72, 20]`. Remove that entry from the `cinderwild` config's
`shardTiles` array so it reads `shardTiles: [[84, 53]]`, and add an exit
into the fortress alongside the region's existing exits:

```typescript
      exits: [
        { x: 3, y: 38, targetRegion: "overworld", destination: { x: px(94), y: px(56) }, label: "The Old Lands" },
        { x: 88, y: 66, targetRegion: "starfall-moors", destination: { x: px(12), y: px(8) }, label: "Starfall Moors" },
        { x: 72, y: 20, targetRegion: "fortress.cinderwild-shrine", destination: { x: px(9), y: px(1) }, label: "The Broken Shrine" },
      ],
```

The arrival destination is the tile below the fortress door, matching
`spawn` in Step 4.

**The road-drawing loop and the landmark clearing both iterate
`config.shardTiles`**, so removing the entry also removes the road and the
7×7 floor square that used to mark the site. That is intended — the gate
replaces them. Check the loop that pushes the `records` sign for this
region: the "The Broken Shrine" sign at `72, 20` should stay, since it is
now the sign outside the fortress door.

- [ ] **Step 6: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass. `map.test.ts` and `regions.test.ts` assert geometry on
the overworld and frontier maps; if either asserts the Cinderwild's shard
count, update it to reflect that one shard now lives inside the fortress.

- [ ] **Step 7: Commit**

```bash
git add src/game/types.ts src/game/map.ts src/game/fortressLayouts.ts src/game/fortressLayouts.test.ts
git commit -m "Make the Broken Shrine a fortress region you enter

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Commit at the door

**Files:**
- Modify: `src/game/engine.ts` (the `Game` class field, the death branch, `rememberRegion`, `respawnAtCheckpoint`)

**Interfaces:**
- Consumes: `MapData.resetOnDeath` from Task 3.
- Produces: nothing later tasks import.

**Locate by content, not line number.** `engine.ts` is over 1300 lines and
many tasks have shifted it. Search for the quoted code.

- [ ] **Step 1: Add the discard flag**

Add a private field to the `Game` class, near the other private state such
as `changingRegion`:

```typescript
  /** Set when the player dies somewhere whose half-cleared state must not persist. */
  private discardCurrentRegion = false;
```

- [ ] **Step 2: Set it on death inside a resetting region**

Find the death branch — the code reading
`if (this.world.checkpoint) this.respawnAtCheckpoint();` inside the
`p.dying > 0` block — and set the flag before respawning:

```typescript
        if (this.world.checkpoint) {
          if (this.map.resetOnDeath) this.discardCurrentRegion = true;
          this.respawnAtCheckpoint();
        }
        else {
          this.ended = true;
          this.cb.onEnd("spent");
        }
```

Keep the existing `else` branch exactly as it is.

- [ ] **Step 3: Honour the flag when leaving the region**

`respawnAtCheckpoint` calls `changeRegion`, which calls `rememberRegion()` —
so without this step the dead, half-emptied fortress would be saved on the
way out and the flag would achieve nothing. Replace `rememberRegion`:

```typescript
  private rememberRegion() {
    if (this.discardCurrentRegion) {
      delete this.world.regions[this.world.regionId];
      this.discardCurrentRegion = false;
      return;
    }
    this.world.regions[this.world.regionId] = { enemies: this.enemies, items: this.items, bossId: this.boss?.id ?? null, bossSpawned: this.bossSpawned };
  }
```

- [ ] **Step 4: Clear the flag on a same-region respawn**

`respawnAtCheckpoint` returns early when the checkpoint is in the current
region, so `changeRegion` — and therefore `rememberRegion` — never runs and
the flag would leak into the next region change. A fortress has no campfire
so this path cannot occur for one today, but the flag must not be left
armed. In `respawnAtCheckpoint`, inside the `point.regionId === this.world.regionId`
branch, add before the `return`:

```typescript
      this.discardCurrentRegion = false;
```

- [ ] **Step 5: Push the interior scene on entry**

The `interior` scene exists in `SceneId` and in the store's pause handling
but is pushed by nothing. In `changeRegion`, after `this.world.regionId = region.id;`,
the scene should reflect whether the player is inside a fortress. Add to
`GameCallbacks` in `src/game/types.ts`:

```typescript
  onInterior: (inside: boolean) => void;
```

Call it from `changeRegion` after the region id is set:

```typescript
      this.cb.onInterior(region.id.startsWith("fortress."));
```

Forward it in `src/components/GameCanvas.tsx` alongside the other callbacks:

```typescript
      onInterior: (inside) => cbRef.current.onInterior(inside),
```

In `src/stores/useGameStore.ts`, add an action that swaps the root scene
without disturbing any overlay:

```typescript
  setInterior: (inside: boolean) => set((state) => {
    const scenes = [...state.scenes];
    const root = inside ? "interior" : "overworld";
    if (scenes[0] === "overworld" || scenes[0] === "interior") scenes[0] = root;
    return { scenes };
  }),
```

Declare it in the `GameState` interface as
`setInterior: (inside: boolean) => void;`, add it to the `Omit<...>` list on
`initialState` beside the other actions, and wire it in `src/App.tsx`:

```typescript
    onInterior: (inside) => setInterior(inside),
```

pulling `setInterior` from the store's destructured actions. `showGame`
already covers `overworld` and `pause`; extend it so the canvas still
renders inside a fortress:

```typescript
  const showGame = screen === "overworld" || screen === "interior" || screen === "pause";
```

- [ ] **Step 6: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass. Any store test asserting the scene list should be
unaffected, since `setInterior` only rewrites a root that is already
`overworld` or `interior`.

- [ ] **Step 7: Commit**

```bash
git add src/game/engine.ts src/game/types.ts src/components/GameCanvas.tsx src/stores/useGameStore.ts src/App.tsx
git commit -m "Reset a fortress on death and mark interiors as their own scene

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Darkness

**Files:**
- Modify: `src/game/render/renderer.ts`

**Interfaces:**
- Consumes: `MapData.dark` from Task 3, and `map.campfires` — braziers are
  carried as light positions, see Step 1.
- Produces: nothing later tasks import.

- [ ] **Step 1: Draw the darkness overlay**

`MapData.lights` already exists and is populated — Task 3 added the field
and `generateFortressMap` fills it from the layout's braziers. This task
only reads it.

In `src/game/render/renderer.ts`, add this function and call it from the
main render path **after** the world and entities are drawn and **before**
any screen-space effects:

```typescript
const PLAYER_LIGHT_RADIUS = 96;
const BRAZIER_LIGHT_RADIUS = 176;

function drawDarkness(g: RenderState, ctx: CanvasRenderingContext2D) {
  if (!g.map.dark) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(2,3,6,0.93)";
  ctx.fillRect(g.cam.x, g.cam.y, g.viewW, g.viewH);

  // Punch the lit areas back out of the darkness we just laid down.
  ctx.globalCompositeOperation = "destination-out";
  const punch = (x: number, y: number, radius: number) => {
    const hole = ctx.createRadialGradient(x, y, radius * 0.15, x, y, radius);
    hole.addColorStop(0, "rgba(0,0,0,1)");
    hole.addColorStop(0.65, "rgba(0,0,0,0.55)");
    hole.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  punch(g.player.x, g.player.y, PLAYER_LIGHT_RADIUS);
  for (const light of g.map.lights) punch(light.x, light.y, BRAZIER_LIGHT_RADIUS);
  ctx.restore();
}
```

`g.cam.x/y` are used for the fill origin because the render path draws in
world space with the camera translated; if the surrounding code has already
reset the transform at the point you insert the call, fill from `0,0`
instead and confirm visually in Task 8 that the overlay covers the viewport.

- [ ] **Step 2: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass. The overworld and frontier maps set `dark: false`, so
`drawDarkness` returns immediately and their rendering is untouched.

- [ ] **Step 3: Commit**

```bash
git add src/game/render/renderer.ts src/game/types.ts src/game/map.ts
git commit -m "Render interiors under darkness punched by the player and braziers

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Hazard damage

**Files:**
- Modify: `src/game/engine.ts`
- Test: `src/game/hazard.test.ts`
- Create: `src/game/hazard.ts`

**Interfaces:**
- Consumes: `TileDefinition.harm` from Task 2.
- Produces: `hazardDamageAt(tile: number, invuln: number): number` exported
  from `src/game/hazard.ts` — returns the damage to apply this frame, or 0.

- [ ] **Step 1: Write the failing test**

Create `src/game/hazard.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { T } from "./constants";
import { hazardDamageAt } from "./hazard";

describe("hazardDamageAt", () => {
  it("harms a player standing on embers", () => {
    expect(hazardDamageAt(T.EMBERS, 0)).toBe(1);
  });

  it("does not harm on ordinary floor", () => {
    expect(hazardDamageAt(T.RFLOOR, 0)).toBe(0);
    expect(hazardDamageAt(T.GRASS, 0)).toBe(0);
  });

  it("does not stack with existing invulnerability", () => {
    expect(hazardDamageAt(T.EMBERS, 0.4)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/game/hazard.test.ts`
Expected: FAIL — `src/game/hazard.ts` does not exist.

- [ ] **Step 3: Implement**

Create `src/game/hazard.ts`:

```typescript
import { tileDefinition } from "./constants";

/**
 * Damage for standing on a tile this frame. Reuses the player's existing
 * invulnerability window so hazard damage cannot stack with a hit taken in
 * the same moment.
 */
export function hazardDamageAt(tile: number, invuln: number): number {
  if (invuln > 0) return 0;
  return tileDefinition(tile).harm ?? 0;
}
```

- [ ] **Step 4: Apply it in the engine**

In `src/game/engine.ts`, inside the player update where `p.invuln` is
already decremented each frame, add after the movement resolution and
before `checkPickups()`:

```typescript
    const standingOn = this.movement.tileAtPx(p.x, p.y);
    if (standingOn >= 0) {
      const harm = hazardDamageAt(this.map.tiles[standingOn], p.invuln);
      if (harm > 0) {
        p.hp -= harm;
        p.invuln = DIFFICULTY_TUNING[this.world.difficulty].hitInvulnerability;
        p.hurtFlash = 0.35;
        this.addText(p.x, p.y, `-${harm}`, "#ff8a5c", 13);
        if (p.hp <= 0) p.dying = PLAYER_DEATH_TIME;
      }
    }
```

Import `hazardDamageAt` from `./hazard`. If the death constant is named
differently, use whatever the existing death path assigns to `p.dying`;
search for `p.dying =` to find it.

- [ ] **Step 5: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/game/hazard.ts src/game/hazard.test.ts src/game/engine.ts
git commit -m "Make embers cost health to stand on

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The warden's journal entry

The warden itself already spawns — Task 3 pushes it as an `elite` sentinel.
This task is what it means when it dies.

**Files:**
- Modify: `src/game/engine.ts`
- Modify: `src/game/escalation.ts`
- Test: `src/game/escalation.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks beyond the fortress region id.
- Produces: `fortressWardenEntry(regionId: string)` exported from
  `src/game/escalation.ts`, returning a `JournalEntry` or `null`.

- [ ] **Step 1: Write the failing test**

Add to `src/game/escalation.test.ts`:

```typescript
describe("fortress warden", () => {
  it("records what the Broken Shrine's warden was", () => {
    const entry = fortressWardenEntry("fortress.cinderwild-shrine");
    expect(entry).not.toBeNull();
    expect(entry?.id).toBe("warden:fortress.cinderwild-shrine");
    expect(entry?.text).toContain("courier");
  });

  it("writes nothing for a region with no warden", () => {
    expect(fortressWardenEntry("overworld")).toBeNull();
    expect(fortressWardenEntry("cinderwild")).toBeNull();
  });
});
```

Add `fortressWardenEntry` to the file's existing import from `./escalation`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/game/escalation.test.ts`
Expected: FAIL — `fortressWardenEntry` is not exported.

- [ ] **Step 3: Implement**

Add to `src/game/escalation.ts`:

```typescript
/** What was actually guarding the shard, recorded after the shell stops moving. */
const FORTRESS_WARDEN_TEXT: Record<string, string> = {
  "fortress.cinderwild-shrine": "The thing in the shrine wore the courier's shape the way a coat wears a hook. It fought me the whole way down and it was never going to win, and it knew that, and it fought anyway. Whatever is in the vessel has been listening to it defend this room for nine hundred years.",
};

export function fortressWardenEntry(regionId: string): JournalEntry | null {
  const text = FORTRESS_WARDEN_TEXT[regionId];
  if (!text) return null;
  return { id: `warden:${regionId}`, title: "What kept the shrine", text, source: "Firsthand discovery" };
}
```

- [ ] **Step 4: Push it when the warden dies**

In `src/game/engine.ts`, find where an enemy's death is resolved — search
for where `alive` is set to `false` for a slain enemy. Add, for elites in a
fortress:

```typescript
        if (enemy.elite && this.world.regionId.startsWith("fortress.")) {
          const entry = fortressWardenEntry(this.world.regionId);
          if (entry && !this.world.journal.some((existing) => existing.id === entry.id)) {
            this.world.journal.push(entry);
            this.publishJournal();
            this.msg("A note has been copied into your journal. Press L to read it.");
          }
        }
```

Import `fortressWardenEntry` from `./escalation`. The `some(...)` guard
matches the existing journal-bleed guard so a reloaded save cannot duplicate
the entry. If `EnemyState` has no `elite` field, carry the flag through from
the spawn — search `EnemySpawn` and `makeEnemy` to see how `elite` is
currently consumed, and report if it is dropped rather than stored.

- [ ] **Step 5: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/game/escalation.ts src/game/escalation.test.ts src/game/engine.ts
git commit -m "Record what the fortress warden was, once it stops moving

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Verification and playthrough

**Files:** none except `ROADMAP.md` in Step 6.

- [ ] **Step 1: Full suite, types, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass, no type errors, build succeeds.

- [ ] **Step 2: Confirm the loose shard is gone**

Run:

```bash
grep -n "shardTiles: \[\[72, 20\]" src/game/map.ts || echo "clean"
```

Expected: `clean`. A hit means the Cinderwild still places a loose shard at
the fortress gate as well as inside.

- [ ] **Step 3: Confirm every region still declares the new fields**

Run:

```bash
grep -c "resetOnDeath" src/game/map.ts
```

Expected: `3` — the overworld return, the frontier return, and the fortress
return. A lower number means a map builder is missing a field and the
compiler should have caught it; investigate rather than adding it blindly.

- [ ] **Step 4: Headless playthrough**

Playwright and a headless Chromium are **not** reliably pre-installed in
this session's scratchpad — a previous session's path will not exist. Check
for an available `playwright-core` and a system Chrome first and use those;
only install if neither is present, and say in your report what you used.

Start the dev server with `npm run dev` in the background and poll
`http://localhost:5173` until it answers — do not `sleep` a fixed amount.
Stop it with `lsof -ti:5173 -sTCP:LISTEN | xargs -r kill`; never a broad
`pkill`. Launch chromium with `args: ['--no-sandbox']`.

Screen flow: content warning → title → Enter → intro (Escape skips) → game.
Reaching the Cinderwild on foot is slow; driving the engine directly is
acceptable, and a previous task exposed the `Game` instance on `window`
temporarily for exactly this. **Revert any such hook before committing** and
say so in your report.

Confirm and screenshot:
1. Entering `fortress.cinderwild-shrine` loads The Broken Shrine.
2. The interior renders **dark**, with a lit radius around the player and
   brighter pools at the two braziers.
3. Standing on an embers tile costs health and shows the damage text.
4. The warden is present near the shard chamber.
5. Taking the shard costs maximum health as usual and does **not** eject the
   player — they can walk back out through the door.
6. `console --errors` reports nothing.

- [ ] **Step 5: Confirm the fortress resets on death**

Drive the player to death inside the fortress. Confirm they respawn at the
Cinderwild wayfire, then re-enter the fortress and confirm the enemies and
the shard are present again. This is the one behaviour with no unit test
and the one most likely to be silently wrong.

- [ ] **Step 6: Update the roadmap**

`ROADMAP.md`'s Milestone 2 describes adding "small, authored activity sites"
to each region. Record that the first of these has landed: the Cinderwild's
shard now sits inside an enterable fortress with no rest, darkness, hazards
and a warden, and that the remaining eight sites follow.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Verify the fortress slice and record it in the roadmap

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
