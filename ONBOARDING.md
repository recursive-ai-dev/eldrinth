# ONBOARDING — ELDRINTH: The Unbound Spire

> A 2D open-world dark-fantasy action RPG that runs entirely in the browser.
> You play a lone wayfarer hunting **nine Anima Shards** to quiet the **Unbound**
> — the last, broken mind of the **Mnemonic**, a machine the Elder Elves built
> out of living minds. The shards are not loot; each one is a person still
> conscious inside the Spire, and taking them costs you permanent maximum health.
> Along the way you investigate three accounts of institutional violence, and
> the decisions you bring back to Orithel shape both your body and the ending.

This document is for new contributors. It explains how the project is set up, how the code is organized,
and how to make common changes without breaking things.

---

## Table of Contents

1. [What This Is](#1-what-this-is)
2. [Tech Stack](#2-tech-stack)
3. [Prerequisites](#3-prerequisites)
4. [Installation & Running](#4-installation--running)
5. [Project Layout](#5-project-layout)
6. [Architecture Overview](#6-architecture-overview)
7. [The Game Loop & State Model](#7-the-game-loop--state-model)
8. [The Map & World](#8-the-map--world)
9. [Combat, Entities & Rendering](#9-combat-entities--rendering)
10. [UI / React Shell](#10-ui--react-shell)
11. [Common Tasks (How-To)](#11-common-tasks-how-to)
12. [Conventions & Gotchas](#12-conventions--gotchas)
13. [Build & Distribution](#13-build--distribution)

---

## 1. What This Is

ELDRINTH is a small but complete HTML5 canvas game. There is **no backend, no network, or build-time
data fetching**. Maps and gameplay are deterministic; committed pixel-art atlases are generated offline
by `tools/spritegen`, then drawn through the Canvas 2D renderer. The React layer is a *thin shell* that
mounts the game canvas and overlays HUD/menus.

Key gameplay facts (handy for new contributors):

- Move with **WASD / Arrow keys**, **Attack** with **J / Space**, **Dash** with **Shift**, **Speak/Read**
  with **E**, open the **Journal** with **L**, **Pause** with **Esc / P**.
- Collect **9 Anima Shards**, each hidden in its own authored fortress, then return to the Glass Spire
  and decide whether to give them to Orithel.
- HP starts at 18 (6 hearts). Each shard harvest reduces maximum health on a rising curve — free for the
  first two, then −1, −1, −1, −2, −2, −3, −3 — for a total cost of 13 across a full run. Character growth
  instead comes from investigations and the wayfire relics they yield.
- The overworld is a fixed, procedurally generated 200×140 tile frontier. Each of the nine shards lives
  inside a separate 26×19 fortress with its own warden, no wayfire, and ember hazards; dying inside
  resets only that fortress.
- Four authored sanctuary settlements (Ilyarael Township, Cinder Haven, Oarsman's Bight, and Crater Watch)
  provide safe zones, regional lorekeepers, and healers.
- Three investigations run alongside the pilgrimage; resolving them at Orithel grants permanent, saveable
  rewards (max health, stamina, blade damage, or dash cost reduction).

---

## 2. Tech Stack

| Concern            | Choice                                                            |
| ------------------ | ----------------------------------------------------------------- |
| Language           | TypeScript 5.9 (strict mode)                                      |
| UI framework       | React 19 (used only for menu/HUD overlays)                        |
| Bundler / dev server | Vite 7                                                           |
| Styling            | Tailwind CSS v4 (via `@tailwindcss/vite` plugin)                  |
| Rendering          | HTML5 Canvas 2D (`<canvas>`, no WebGL, no game engine)           |
| Art pipeline       | Offline Python/Pillow sprite generation adapted from `shed-dev-sprites` |
| Build output       | Multi-file static bundle with cacheable image atlases              |
| Utility CSS class  | `clsx` + `tailwind-merge` (`cn()` helper)                         |

Versions are pinned in `package.json`. The styling pipeline is the new **Tailwind v4** model: there is
**no `tailwind.config.js`** — configuration is done in CSS via `@import "tailwindcss";` in
`src/index.css`.

---

## 3. Prerequisites

- **Node.js** (the lockfile resolves Vite 7, which requires a modern Node — 18+ recommended, 20+ safest).
- A package manager. The repo ships a `package-lock.json`, so use **npm**.
- **Python 3.10+, Pillow, and numpy** only when regenerating sprite assets; they are not runtime/build
  dependencies for the browser game.

No global installs are needed.

---

## 4. Installation & Running

```bash
npm install        # install dependencies
npm run dev        # start Vite dev server (hot reload)
npm run gen:sprites # regenerate committed sprite atlases (Python + Pillow + numpy)
```

Then open the URL Vite prints (typically `http://localhost:5173`).

Other scripts:

```bash
npm run build      # production build -> tsc typecheck gate followed by vite build -> dist/
npm run typecheck  # tsc --noEmit type check
npm test           # vitest run test suite
npm run preview    # serve the production build locally
```

> Note: `npm run build` is gated by `tsc --noEmit`, so type errors will immediately fail the production build. You can also run `npm run typecheck` (or `npx tsc --noEmit`) to verify types without building.

---

## 5. Project Layout

```
eldrinth/
├── index.html                 # App entry HTML; loads /src/main.tsx; Google Fonts (Cinzel, EB Garamond)
├── package.json               # Scripts, pinned deps
├── package-lock.json          # Locked dependency tree
├── tsconfig.json              # Strict TS config; path alias "@/*" -> "src/*"
├── vite.config.ts             # Vite + React + Tailwind; emits cacheable sprite assets; "@" alias
├── src/
│   ├── main.tsx               # React root: createRoot(<App/>)
│   ├── App.tsx                # Top-level screen state machine + save slots + HUD wiring
│   ├── index.css              # Tailwind import + custom keyframes/animations (msgFade, flick, vignette...)
│   ├── vite-env.d.ts          # Vite client types
│   ├── assets/                # UI images plus generated sprites/* sheets and manifests
│   ├── components/            # React overlays (NOT game logic)
│   │   ├── GameCanvas.tsx     # Mounts <canvas>, instantiates & drives the Game class
│   │   ├── HUD.tsx            # Hearts, shards, objective, boss bar, prompts, messages
│   │   ├── DialogueBox.tsx    # Dialogue panel with choices
│   │   ├── PauseOverlay.tsx   # Pause menu
│   │   ├── TitleScreen.tsx    # Main menu + lore + controls
│   │   ├── EndScreen.tsx      # Ending screens
│   │   ├── IntroSequence.tsx  # Opening cinematic
│   │   ├── Journal.tsx        # Player journal / field notes
│   │   └── ContentWarning.tsx # First-launch content warning
│   ├── game/                  # Pure game engine (framework-agnostic TypeScript)
│   │   ├── core/              # Lifecycle, scheduling, scene stack, world state, spatial index
│   │   │   ├── FixedStepLoop.ts
│   │   │   ├── SceneStack.ts
│   │   │   ├── SpatialGrid.ts
│   │   │   └── WorldState.ts
│   │   ├── systems/           # Single-responsibility simulation systems
│   │   │   ├── AISystem.ts    # Enemy behavior steering & telegraphs
│   │   │   ├── CombatSystem.ts
│   │   │   ├── GameFlowSystem.ts # Objectives, prompts, HUD assembly
│   │   │   ├── InputSystem.ts
│   │   │   └── MovementSystem.ts
│   │   ├── entities/          # Entity component catalogue, factory, pool, registry
│   │   │   ├── archetypes.ts
│   │   │   ├── components.ts
│   │   │   ├── EntityFactory.ts
│   │   │   ├── EntityPool.ts
│   │   │   ├── EntityRegistry.ts
│   │   │   └── index.ts
│   │   ├── render/            # Canvas rendering pipeline
│   │   │   ├── renderer.ts
│   │   │   ├── spriteAtlas.ts
│   │   │   └── spriteCatalog.ts
│   │   ├── engine.ts          # Game class: orchestrates systems, callbacks, region transitions
│   │   ├── map.ts             # Procedural overworld + fortress map generation -> MapData
│   │   ├── fortress.ts        # Fortress layout parsing, validation, reachability checks
│   │   ├── fortressLayouts.ts # The nine authored 26×19 fortress interiors
│   │   ├── quests.ts          # Three investigations, evidence, choices, rewards
│   │   ├── regions.ts         # Region cache + web-worker source
│   │   ├── escalation.ts      # Shard harvest costs, ward dialogue, warden journal entries
│   │   ├── hazard.ts          # Environmental damage (embers, etc.)
│   │   ├── slots.ts           # SQLite-in-WASM save slots (3 slots)
│   │   ├── types.ts           # Shared interfaces (MapData, HudData, DialogueData, GameCallbacks, etc.)
│   │   ├── constants.ts       # TILE size, MAP_W/H, tile-type ids, tile shape catalogue
│   │   └── math.ts            # Pure helpers shared by logic + rendering
│   └── utils/
│       └── cn.ts              # cn(...classes) -> clsx + tailwind-merge
├── tools/spritegen/           # Vendored/adapted procedural sprite generator and catalog
└── docs/superpowers/           # Sprite pipeline design and implementation plans
```

**Mental model:** everything under `src/game/` is the *game* (canvas, simulation, art). Everything under
`src/components/` is the *shell* (React menus layered on top). They communicate only through the
`GameCallbacks` interface (`onHud`, `onDialogue`, `onPause`, `onEnd`, `onJournal`, `onInterior`); the game never imports React.

---

## 6. Architecture Overview

```
  index.html
      │
      ▼
  main.tsx ──▶ App.tsx (screen state: "title"|"overworld"|"interior"|"pause"|"ending"; 3 SQLite save slots)
                  │
                  │ renders
                  ├── TitleScreen / IntroSequence / EndScreen / PauseOverlay (React)
                  ├── HUD (React, driven by HudData)
                  ├── Journal (React, driven by JournalEntry[])
                  ├── DialogueBox (React, driven by DialogueData)
                  └── GameCanvas (React)
                          │ instantiates, on mount
                          ▼
                     Game (engine.ts)
                          │ owns: canvas, WorldState, subsystems (Input, AI, Movement,
                          │   Combat, GameFlow), region repository, loop
                          │ pushes state UP via callbacks
                          ▼
                     cb.onHud / cb.onDialogue / cb.onPause / cb.onEnd / cb.onJournal / cb.onInterior
                          ▼
                     App re-renders the React overlays
```

The `Game` object is created once per play session. `App` holds a `gameRef` to it so buttons
(Resume, Restart, Advance Dialogue, Add Journal Note) can call imperative methods like `game.setPaused(false)`,
`game.advanceDialogue()`, and `game.addPersonalNote()`.

To **restart**, `App` remounts `<GameCanvas key={sessionId} />` with a bumped `sessionId`, which destroys the
old `Game` (cleanup in `useEffect`) and creates a fresh one. Restart = remount. Progress is otherwise
persisted into one of three SQLite-in-WASM save slots via `src/game/slots.ts`.

---

## 7. The Game Loop & State Model

Core class: `Game` in `src/game/engine.ts`.

Lifecycle:
- `new Game(canvas, callbacks)` — grabs 2D context.
- `game.init()` — set up input, load the starting region, spawn the player, bind window listeners, compute
  initial HUD.
- `game.start()` — kicks off `requestAnimationFrame(loop)`.
- `game.destroy()` — cancels RAF, removes listeners, and releases the active region (called on unmount).
- `game.loop(t)` — the heartbeat.

Loop structure (managed by `FixedStepLoop` + `SceneStack`):

1. Compute raw `dt`; clamp it to avoid huge jumps after tab switches and accumulate in the fixed-step loop.
2. Run a fixed 60 Hz simulation tick while time is banked: input → AI → movement → combat → flow/HUD.
3. `render()` every animation frame regardless (so paused/menus still draw the world).
4. HUD pushes are throttled to ~10 Hz.

The update pipeline inside each tick is:
- `InputSystem` — buffer keys, consume actions.
- `AISystem` — run enemy steering/telegraphs and set intended velocities.
- `MovementSystem` — integrate player and enemy motion with sub-step collision and sliding.
- `CombatSystem` — resolve attacks, projectiles, contact damage, knockback, deaths.
- `GameFlowSystem` — objective text, interaction prompts, HUD assembly.

**Important scene states:**
- `paused` — set by `setPaused`/`togglePause`; freezes the simulation tick.
- `dialogue` — when non-null, input is captured by dialogue advance and the world is frozen.
- `ended` — ending latched; stops further updates and ignores input.
- `interior` — the root scene while inside a fortress; used for lighting/darkness overlays.

Input is handled in `InputSystem.ts`. Note the **action priority**: pause keys first, then
dialogue-advance, then gameplay (movement set, attack, dash, interact). `InputSystem` maintains a
buffer of lowercased key names and action flags; `window blur` clears movement so the player doesn't
"stick" moving when the window loses focus.

---

## 8. The Map & World

World generation lives in `src/game/map.ts`. The overworld is **fully deterministic** — it uses a
seeded PRNG (`mulberry32(0x9e3779b1)`), so the frontier is identical every run.

Map data shape: `MapData` (`types.ts`):

| Field         | Meaning |
| ------------- | ------- |
| `width`/`height` | Grid size in tiles (from `MAP_W=200`, `MAP_H=140` in `constants.ts`). |
| `tiles`       | `Uint8Array` of tile-type ids (`T.*` from `constants.ts`). |
| `wardTiles`   | Indices of the ward barrier tiles guarding the Spire. |
| `spawn`       | Player start `Vec` (pixel coords). |
| `npc`         | Orithel the Watcher location (only in the Old Lands overworld). |
| `signs`       | Readable lore/control signs (`SignData[]`). |
| `shards`      | Anima Shard pickup positions (`Vec[]`) — in fortresses only. |
| `enemySpawns` | `EnemySpawn[] {x,y,type,elite?}` (grid coords). |
| `bossCenter`  | Center of the Spire arena where the boss spawns. |
| `exits`       | Region exits to other regions / fortresses. |
| `campfires`   | Wayfires: rest, set checkpoint, and grant a relic once. |
| `towns`       | Authored settlements (`TownData[]`) with townsfolk and a safe zone. |
| `dark`        | Whether the region uses the darkness/lighting overlay. |
| `resetOnDeath`| Whether dying resets only this region (true for fortresses). |
| `lights`      | Non-wayfire light sources (braziers in fortresses). |

The frontier is divided into four connected overworld regions, each generated by the same core function:

- **The Old Lands** — starting fields, Ilyarael's hall, Orithel, Ilyarael Township, and three local fortress exits.
- **Cinderwild** — east of the Old Lands; ember-choked roads, the Broken Shrine, and the Ruined Watchpost.
- **Moonlit Coast** — south-west; salt graves, the Keeper's Beacon, and the coastal frontier.
- **Starfall Moors** — south-east; the Fallen Observatory and the Astronomer's Watch.

Each of the **nine Anima Shards** lives in its own authored 26×19 fortress (`src/game/fortressLayouts.ts`):

| Fortress id | Region return | Theme |
| ----------- | ------------- | ----- |
| `fortress.cinderwild-shrine` | Cinderwild | The Broken Shrine |
| `fortress.cinderwild-watchpost` | Cinderwild | The Ruined Watchpost |
| `fortress.old-lands-archive` | Old Lands | The Weeping Archive |
| `fortress.old-lands-reliquary` | Old Lands | The Glass Reliquary |
| `fortress.old-lands-vault` | Old Lands | Ilyarael's Sealed Vault |
| `fortress.moonlit-salt-graves` | Moonlit Coast | The Salt Graves |
| `fortress.moonlit-beacon` | Moonlit Coast | The Keeper's Beacon |
| `fortress.starfall-observatory` | Starfall Moors | The Fallen Observatory |
| `fortress.starfall-watch` | Starfall Moors | The Astronomer's Watch |

Fortress layouts are parsed and validated by `src/game/fortress.ts` (`parseFortressLayout`,
`shardIsReachable`, `unreachableSpawns`). Every fortress must have exactly one door, one shard, and a
walkable path from the door to the shard.

### Settlements (towns)

Towns are **hand-authored** string layouts in `map.ts` (`TOWN_LAYOUTS`) stamped onto the frontier map by
`stampTown()`. Glyphs: `#` wall, `H` house block, `.` floor, `D` door, `N` NPC spot. A layout must have
exactly one door; the number of `N` spots must match the NPC definitions passed to `stampTown()`.

Each `TownData` carries:

- `x`/`y` — safe-zone centre in pixels.
- `safeRadius` — pixels; **enemies will not engage a player standing inside it**, and no patrol is spawned
  within it. The radius is derived from the layout footprint plus a one-tile buffer.
- `npcs` — `NpcData[]` with an `id`, display `name`, dialogue `color`, and a functional `role`:
  - `healer` — restores the player to full health, once per region visit.
  - `lore` — writes a directional journal entry pointing at a nearby landmark, once per region visit.
  - `merchant` and other roles are reserved for later; unhandled roles fall back to a greeting.
- `sign` — a readable welcome sign placed one tile inside the door.

Town services are tracked in `Game.usedTownServices` and cleared on region change, so a town refreshes each
time the player crosses a boundary.

To add a settlement: append a layout to `TOWN_LAYOUTS`, call `stampTown()` in the region generator, add a
spur road to the door, and add a unit test in `map.exploration.test.ts` covering reachability and safe-zone
placement.

Tile types are defined in `constants.ts` (`T` object + `TILE_DEFINITIONS` shape catalogue) and rendered
per-type in `renderer.ts` (`drawTile()`). To add a new terrain look, add an id in `T`, describe its
shape in `TILE_DEFINITIONS`, and add a case in `drawTile()`.

**Collision:** `tileDefinition()` in `constants.ts` is the single source of truth for "can I stand here".
It differentiates solid, one-way, slopes, triggers, and ember tiles. `MovementSystem` uses this catalogue
for axis-separated sub-step movement (≤2px) with smooth wall sliding. Ward tiles additionally block the
Spire entrance while `wardUnlocked` is false.

---

## 9. Combat, Entities & Rendering

### Entities

Mutable simulation state lives in `WorldState` (`src/game/core/WorldState.ts`), not directly on `Game`:
- `player` — position, HP/maxHp, stamina, attack/dash timers, invulnerability, knockback, relics, bonuses.
- `enemies` — types `wraith | sentinel | adept | boss`, plus an `elite` flag for fortress wardens.
- `projectiles`, `particles`, `texts` (floating damage numbers), `items` (shard/potion).

Enemy behaviors live in `src/game/systems/AISystem.ts` and are registered per `EnemyType`:
- **wraith** — slow chase within 260px, wanders otherwise; melee contact damage.
- **sentinel** — faster chaser (320px), tougher.
- **adept** — keeps distance (kiting), fires purple projectiles; flees if too close.
- **boss** (The Unbound) — lunges, radial **burst** of projectiles, and summons **wraith** adds once below 45% HP.
  Has 96 HP and a rotating crystal visual.

### Combat

- **Attack**: `startAttack` sets `attacking=true` for `attackDur` (0.2s). `CombatSystem` builds a directional
  `attackBox` and applies `swingDmg + attackBonus` once per enemy via the `swingHit` set. Knockback is applied
  on hit.
- **Dash**: `startDash` → 0.16s burst at 520px/s in facing dir; grants i-frames. Cost is discounted by the
  `ashstep` relic.
- **Damage to player**: ignores if invuln/dashing/ended; applies damage, 0.9s i-frames, knockback, screen
  shake, and sets `dying` on death.
- **Pickups**: shards now cost permanent max HP on harvest (see `escalation.ts`). Potions heal 4. Killing
  non-boss enemies has a chance to drop a potion.
- **Wayfire relics**: resting at a new campfire grants one of `emberheart` (+2 maxHp), `ashstep` (−12 dash
  stamina), `tidewell` (+25 maxStamina), or `starblade` (+1 blade damage). These stack with quest rewards
  and persist in saves.

### Rendering

`renderGame()` (`game/render/renderer.ts`):
1. Set DPR transform; clear.
2. Apply screen **shake** offset.
3. Translate by `-cam`; draw nearby terrain chunks baked from generated tile atlases, then the ward,
   depth-sorted props/items/actors, projectiles, particles, floating text, and tall-tile overlays.
4. Draw atmospheric lighting and vignette effects.

Tiles, the player, enemies, pickups, campfires, and signs use committed PNG sheets under
`src/assets/sprites/`. `spriteAtlas.ts` / `spriteCatalog.ts` preload assets and resolve
direction/action/frame rectangles; nearest-neighbour Canvas drawing preserves crisp pixels. Procedural
Canvas work remains for transient effects such as glow, attack arcs, projectiles, particles, telegraphs,
shadows, and lighting. Catalog tests ensure every shipped visual is present.

---

## 10. UI / React Shell

`App.tsx` is a screen state machine. Screens: `"title" | "overworld" | "interior" | "pause" | "ending"`.
`App` owns slot/journal state (`useState`) and feeds callbacks to `GameCanvas`. Three save slots are
managed by `slots.ts` (SQLite-in-WASM backed by `localStorage`).

- **`HUD.tsx`** purely renders `HudData` (hearts via inline SVG, shard counter, quest objective, foe
  count, boss bar, interaction prompt, fading message log). `pointer-events-none` so it never blocks the canvas.
- **`DialogueBox.tsx`** shows one line at a time and supports choices; click or **E** advances
  (`onAdvance` → `game.advanceDialogue()`), and choice clicks route through `game.chooseDialogue(id)`.
- **`Journal.tsx`** displays discovered investigation entries, warden accounts, personal notes, and the
  shard-bleed observations. Open with **L**; add notes via the text box at the bottom.
- **`TitleScreen` / `IntroSequence` / `EndScreen`** use `assets/title.jpg` and `assets/ending.jpg` as backdrops.
- **`ContentWarning.tsx`** gates first launch only; persists acknowledgement in `localStorage`.
- **`PauseOverlay`** — Resume calls `game.setPaused(false)`, Restart calls `start()` which bumps `sessionId`.

Styling uses Tailwind utility classes plus custom animation classes defined in `src/index.css`
(`.msg-fade`, `.flick`, `.glow-pulse`, `.vignette`, `.no-select`, `.font-title`). Fonts (Cinzel for titles,
EB Garamond for body) are loaded in `index.html` via Google Fonts.

---

## 11. Common Tasks (How-To)

> All coordinates in `map.ts` and `fortressLayouts.ts` are **grid** (tile) coordinates; the engine converts to
> pixels via `px(t) = t*TILE + TILE/2`.

### Move the player's starting position
Edit `spawn` in `generateOverworldMap()` (`map.ts`).

### Add / relocate an Anima Shard
Shards are inside fortresses, not the overworld. Edit the `S` glyph in the relevant fortress layout in
`fortressLayouts.ts`, then verify reachability with the tests in `fortress.test.ts`.

### Add or edit a fortress
Add a new string array to `fortressLayouts.ts` using the `fortress(doorColumn, interiorRows)` helper
(interior must be 17 rows of 24 chars, producing a 26×19 layout). Register it in `FORTRESS_REGIONS`
(`map.ts`) and `FORTRESS_LAYOUTS` (`fortressLayouts.ts`).

### Add a settlement
1. Append a hand-authored layout to `TOWN_LAYOUTS` (`map.ts`) with one `D` door and one `N` per townsperson.
2. Call `stampTown(tiles, "<town-id>", worldX, worldY, npcs)` in the region generator.
3. Carve a spur road from the nearest highway to the door tile.
4. If the NPC has a functional role, add its branch to `speakWithTownNpc()` in `engine.ts`.
5. Move any hand-placed enemy spawn that now falls inside the safe zone.
6. Add coverage in `map.exploration.test.ts` for reachability and safe-zone separation.

### Add a new enemy
Append to `enemySpawns` in `map.ts` (overworld) or the `E` glyphs in a fortress layout. For a brand-new
*behavior*, add a `type` to `EnemyType` (`types.ts`), add stats in `engine.ts`, and register a behavior in
`AISystem.ts`.

### Add a readable sign
Append a record to the per-region `records` table in `map.ts`. Press **E** near it. Add `fact` to hook it
into an investigation in `quests.ts`.

### Add an investigation
Add a `QuestDefinition` to `QUESTS` (`quests.ts`). Place its lead and evidence records in `map.ts` and wire
rewards (health, stamina, blade, dash) through `resolveQuest`.

### Change controls
Key bindings live in `InputSystem.ts`; the `engine.ts` step consumes them. The Title/Pause screens and
this document also hardcode the control hints — update those strings too.

### Change map size
`MAP_W` / `MAP_H` in `constants.ts`. Note `generateOverworldMap` uses many hardcoded region coordinates; you'll
likely need to adjust those too.

### Add a tile type
1. Add an id to `T` in `constants.ts`.
2. Describe its shape / hazard in `TILE_DEFINITIONS` (`constants.ts`).
3. Add a render case in `renderer.ts` (`drawTile()`).

### Tune combat numbers
Player stats are constants at the top of `engine.ts`. Enemy stats and boss tuning are also there.
Damage/knockback resolution is in `CombatSystem.ts`. Difficulty scaling is in `DIFFICULTY_TUNING`
(`engine.ts`).

### Change an ending or add a new one
Add the ending id to `EndingId` (`SceneStack.ts`), the copy to `ENDINGS` (`EndScreen.tsx`), and the trigger
to `endRun()` / `chooseDialogue()` in `engine.ts`.

---

## 12. Conventions & Gotchas

- **Strict TypeScript**: `noUnusedLocals`, `noUnusedParameters`, `strict` are on. Remove unused vars or the
  build/editor will complain.
- **Path alias**: use `@/...` imports (mapped in both `tsconfig.json` and `vite.config.ts`). Don't use
  relative `../` chains where the alias is cleaner, but either works.
- **No `tailwind.config.js`**: Tailwind v4 is configured entirely through CSS. Custom utilities/theme go in
  `src/index.css`.
- **The game never touches React**: keep `src/game/*` framework-agnostic. Communicate via `GameCallbacks`.
- **Restart = remount**: there is no in-place reset; `start()` bumps `sessionId`, which changes the `key` on
  `GameCanvas`.
- **Deterministic world**: `generateOverworldMap` uses a fixed seed — changing gameplay feel shouldn't
  accidentally depend on randomness varying between runs.
- **DPR handling**: canvas backing store is scaled by `devicePixelRatio` (capped at 2) in `resize()`;
  all drawing uses CSS pixel coordinates thanks to the `setTransform(dpr,...)` at the top of `render()`.
- **Save compatibility**: `WorldState.restore()` migrates older snapshots; bump `WorldSnapshot.version`
  only when you must break old saves, and add a migration branch for the previous version.
- **Tests are invoked directly**: run `npx vitest run`, `npx tsc --noEmit`, and the Python checks in
  `tools/spritegen/*_test.py`. There is no lint script.

---

## 13. Build & Distribution

```bash
npm run build
```

The production output is deliberately multi-file: JavaScript, CSS, WebAssembly, JPGs, and generated PNG
atlases are emitted as separate cacheable assets under `dist/assets/`. Use `npm run preview` or any static
HTTP server for the final check.

There is no CI, no environment config, and no backend. The game is fully client-side and self-contained.

---

## Quick Start Checklist for New Contributors

1. `npm install`
2. `npm run dev`, open the URL.
3. Read `src/game/engine.ts` top-to-bottom once — it is the main orchestrator.
4. Skim `src/game/map.ts` to learn the overworld regions and fortress exits.
5. Skim `src/game/fortressLayouts.ts` + `fortress.ts` to see the nine authored interiors.
6. Skim `src/game/quests.ts` to see how the three investigations are structured.
7. Skim `App.tsx` + `components/*` to see how the React shell talks to the engine.
8. Run `npx vitest run` and `npx tsc --noEmit` to confirm the baseline.
9. Make a small change (e.g. tweak a fortress `E` glyph) and confirm `npm run dev` reflects it.
