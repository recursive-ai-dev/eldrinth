# ONBOARDING — ELDRINTH: The Unbound Spire

> A 2D open-world dark-fantasy action RPG that runs entirely in the browser.
> You play a lone wayfarer hunting three **Anima Shards** to break the ward on the **Glass Spire**,
> then slaying the **Unbound** — a mad, elf-forged artificial mind.

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
  with **E**, **Pause** with **Esc / P**.
- Collect **3 Anima Shards** → unlocks the ward → walk into the Spire arena → boss **The Unbound** spawns.
- HP is represented as hearts (start at 6). Each shard collected raises `maxHp` by 1 and heals 2.
- The whole game world is a fixed, procedurally **generated** map (deterministic seed), not hand-authored.

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
npm run build      # production build -> dist/ plus separate cacheable assets
npm run preview    # serve the production build locally
```

> Note: there is no `lint` or `typecheck` script defined in `package.json`. Type errors surface
> through `vite build` (which runs `tsc` only if configured — here it does not). To type-check manually:
> `npx tsc --noEmit`.

---

## 5. Project Layout

```
eldrinth/
├── index.html                 # App entry HTML; loads /src/main.tsx; Google Fonts (Cinzel, EB Garamond)
├── package.json               # Scripts, pinned deps
├── tsconfig.json              # Strict TS config; path alias "@/*" -> "src/*"
├── vite.config.ts             # Vite + React + Tailwind; emits cacheable sprite assets; "@" alias
├── src/
│   ├── main.tsx               # React root: createRoot(<App/>)
│   ├── App.tsx                # Top-level screen state machine (title/play/win/lose) + HUD wiring
│   ├── index.css              # Tailwind import + custom keyframes/animations (msgFade, flick, vignette...)
│   ├── vite-env.d.ts          # Vite client types
│   ├── assets/                # UI images plus generated sprites/* sheets and manifests
│   ├── components/            # React overlays (NOT game logic)
│   │   ├── GameCanvas.tsx     # Mounts <canvas>, instantiates & drives the Game class
│   │   ├── HUD.tsx            # Hearts, shards, objective, boss bar, prompts, messages
│   │   ├── DialogueBox.tsx    # Typewriter-free dialogue panel
│   │   ├── PauseOverlay.tsx   # Pause menu
│   │   ├── TitleScreen.tsx    # Main menu + lore + controls
│   │   └── EndScreen.tsx      # Win/lose screens
│   ├── game/                  # Pure game engine (framework-agnostic TypeScript)
│   │   ├── engine.ts          # Game class: loop, input, entities, physics, HUD, win/lose (orchestrator)
│   │   ├── map.ts             # Procedural world generation -> MapData
│   │   ├── types.ts           # Shared interfaces (MapData, HudData, DialogueData, GameCallbacks, etc.)
│   │   ├── constants.ts       # TILE size, MAP_W/H, tile-type ids (T), SOLID_TILES set
│   │   ├── math.ts            # Pure helpers shared by logic + rendering (clamp, rr, dot, hash2, DIRV/DIRA)
│   │   └── render/
│   │       ├── renderer.ts    # Atlas-backed world rendering plus procedural lighting/effects
│   │       └── spriteAtlas.ts # Vite asset discovery, image preload/cache, frame lookup
│   └── utils/
│       └── cn.ts              # cn(...classes) -> clsx + tailwind-merge
├── tools/spritegen/           # Vendored/adapted shed-dev-sprites generator and catalog
└── docs/superpowers/          # Sprite pipeline design and implementation plan
```

**Mental model:** everything under `src/game/` is the *game* (canvas, simulation, art). Everything under
`src/components/` is the *shell* (React menus layered on top). They communicate only through the
`GameCallbacks` interface (`onHud`, `onDialogue`, `onPause`, `onWin`, `onLose`); the game never imports React.

---

## 6. Architecture Overview

```
  index.html
      │
      ▼
  main.tsx ──▶ App.tsx (screen state: "title"|"play"|"win"|"lose")
                  │
                  │ renders
                  ├── TitleScreen / EndScreen / PauseOverlay (React)
                  ├── HUD (React, driven by HudData)
                  ├── DialogueBox (React, driven by DialogueData)
                  └── GameCanvas (React)
                          │ instantiates, on mount
                          ▼
                     Game (engine.ts)
                          │ owns: canvas, map, player, enemies, particles, loop
                          │ pushes state UP via callbacks
                          ▼
                     cb.onHud / cb.onDialogue / cb.onPause / cb.onWin / cb.onLose
                          ▼
                     App re-renders the React overlays
```

The `Game` object is created once per play session. `App` holds a `gameRef` to it so buttons
(Resume, Restart, Advance Dialogue) can call imperative methods like `game.setPaused(false)` and
`game.advanceDialogue()`.

To **restart**, `App` just remounts `<GameCanvas key={runKey} />` with a new `key`, which destroys the
old `Game` (cleanup in `useEffect`) and creates a fresh one. This is why there is no explicit
"reset" method — restart = remount.

---

## 7. The Game Loop & State Model

Core class: `Game` in `src/game/engine.ts:402`.

Lifecycle:
- `new Game(canvas, callbacks)` — grabs 2D context.
- `game.init()` — generate map, build the **static** terrain canvas, spawn player/enemies/shards, bind
  window input listeners (`keydown`/`keyup`/`blur`/`resize`), compute initial HUD.
- `game.start()` — kicks off `requestAnimationFrame(loop)`.
- `game.destroy()` — cancels RAF and removes listeners (called on unmount).
- `game.loop(t)` — the heartbeat.

Loop structure (`engine.ts:714`):

1. Compute `dt` (clamped to ≤ 0.05s to avoid huge jumps after tab switches).
2. If `!paused && !dialogue && !ended` → `update(dt)` (simulation step).
3. `render()` every frame regardless (so paused/menus still draw the world).
4. Throttle HUD pushes to ~10 Hz (`hudAccum`).

`update(dt)` order (`engine.ts:735`): player → enemies → projectiles → particles → items → floating text
→ camera follow → prompt detection. The camera smoothly lerps toward the player.

**Important flags on `Game`:**
- `paused` — set by `setPaused`/`togglePause`; freezes `update`.
- `dialogue` — when non-null, input is captured by dialogue advance and world is frozen.
- `ended` — win/lose latched; stops further updates and ignores input.

Input is handled in `onKeyDown` (`engine.ts:678`). Note the **action priority**: pause keys first, then
dialogue-advance, then gameplay (movement set, attack, dash, interact). Movement uses a `keys: Set<string>`
of lowercased key names; `onBlur` clears it so the player doesn't "stick" moving when the window loses focus.

---

## 8. The Map & World

World generation lives in `src/game/map.ts` (`generateMap()`). It is **fully deterministic** — it uses a
seeded PRNG (`mulberry32(0x9e3779b1)`), so the world is identical every run. There is no save system.

Map data shape: `MapData` (`types.ts:23`):

| Field         | Meaning |
| ------------- | ------- |
| `width`/`height` | Grid size in tiles (from `MAP_W=160`, `MAP_H=112` in `constants.ts`). |
| `tiles`       | `Uint8Array` of tile-type ids (`T.*` from `constants.ts`). |
| `solid`       | `Uint8Array` (0/1) — blocks movement (derived from `SOLID_TILES`). |
| `wardTiles`   | Indices of the ward barrier tiles guarding the Spire. |
| `spawn`       | Player start `Vec` (pixel coords). |
| `npc`         | Orithel the Watcher location. |
| `signs`       | Readable lore/control signs (`SignData[]`). |
| `shards`      | Anima Shard pickup positions (`Vec[]`). |
| `enemySpawns` | `EnemySpawn[] {x,y,type}` (grid coords). |
| `bossCenter`  | Center of the Spire arena where the boss spawns. |

The map is hand-**structured** procedurally (not random blobs): regions are carved by code in `generateMap()`:

- **Weeping Forest** (west, x<42): dense ancient timber and foggy tracks leading to the Weeping Archive.
- **Murkwater lake** (north-center, ellipse around 66,24) with an ancient **stone bridge** path across it.
- **Mountain barrier** (x≈84-87, full height) with a grand **mountain pass** at y 20-28.
- **Ruins of Ilyarael** (citadel 46-66, 64-82): the Great Hall, Orithel, the Last Ember wayfire, and the descent to Ilyarael's Sealed Vault.
- **Glass Spire arena** (circle around 140,26): `SPIREFLOOR` interior, rock ring, and **ward** tiles guarding the True Spire.
- **Roads/paths** carved with `carve()` connecting spawn → lake → pass → spire, with broad branches to the ruins, fortresses, and frontier exits.
- **Decoration**: crystals, tall grass, flowers, graves/bones scattered on grass.

Tile types are defined in `constants.ts` (`T` object) and rendered per-type in `drawTile()`
(`engine.ts:150`). To add a new terrain look, add an id in `T`, mark it solid in `SOLID_TILES` if needed,
and add a `case` in `drawTile()`.

**Collision:** `solidAtIdx` (`engine.ts:567`) is the single source of truth for "can I stand here".
It returns true for out-of-bounds, solid tiles, **and** ward tiles while `wardUnlocked` is false.
Movement is axis-separated (`moveX`/`moveY`) with small sub-steps (≤2px) for smooth wall sliding.

---

## 9. Combat, Entities & Rendering

### Entities

All live in `Game` instance arrays/members:
- `player: Player` — complex struct (`engine.ts:50`): hp, maxHp, dir, attack/dash timers, invuln, knockback (`kx/ky`), `dying`.
- `enemies: Enemy[]` — types `wraith | sentinel | adept | boss` (`makeEnemy`, `engine.ts:610`).
- `projectiles`, `particles`, `texts` (floating damage numbers), `items` (shard/potion).

Enemy behaviors (`updateEnemy`, `engine.ts:983`):
- **wraith** — slow chase within 260px, wanders otherwise; melee contact damage.
- **sentinel** — faster chaser (320px), tougher.
- **adept** — keeps distance (kiting), fires purple projectiles; flees if too close.
- **boss** (The Unbound) — `updateBoss` (`engine.ts:1045`): lunges, radial **burst** of projectiles, and
  summons **wraith** adds once below 45% HP. Has 42 HP and a rotating crystal visual.

### Combat

- **Attack**: `startAttack` → `attacking=true` for `attackDur` (0.2s). Each frame `doAttackHit`
  (`engine.ts:897`) builds a directional `attackBox` and applies `swingDmg` (1) once per enemy via
  `swingHit` set. Knockback applied in `hitEnemy`.
- **Dash**: `startDash` → 0.16s burst at 520px/s in facing dir; grants 0.2s `invuln` (i-frames).
- **Damage to player**: `damagePlayer` (`engine.ts:932`) — ignores if invuln/dashing/ended; applies
  damage, 0.9s i-frames, knockback, screen shake, and sets `dying` on death.
- **Pickups**: `checkPickups` (`engine.ts:951`) — shards (collect 3 → `wardUnlocked=true`, heal+maxHp),
  potions (heal 4). Killing non-boss enemies has a 28% chance to drop a potion.

### Rendering

`renderGame()` (`game/render/renderer.ts`):
1. Set DPR transform; clear.
2. Apply screen **shake** offset.
3. Translate by `-cam`; draw nearby terrain chunks baked from generated tile atlases, then the ward,
   depth-sorted props/items/actors, projectiles, particles, floating text, and tall-tile overlays.
4. Draw atmospheric lighting and vignette effects.

Tiles, the player, enemies, pickups, campfires, and signs use committed PNG sheets under
`src/assets/sprites/`. `spriteAtlas.ts` preloads them and resolves direction/action/frame rectangles;
nearest-neighbour Canvas drawing preserves crisp pixels. Procedural Canvas work remains for transient
effects such as glow, attack arcs, projectiles, particles, telegraphs, shadows, and lighting. Missing
assets retain simple development fallbacks, while catalog tests ensure every shipped visual is present.

---

## 10. UI / React Shell

`App.tsx` is a screen state machine. Screens: `"title" | "play" | "win" | "lose"`. `App` owns HUD/dialogue
state (`useState`) and feeds callbacks to `GameCanvas`.

- **`HUD.tsx`** purely renders `HudData` (hearts via inline SVG, shard counter, quest objective, foe
  count, boss bar, interaction prompt, fading message log). `pointer-events-none` so it never blocks the canvas.
- **`DialogueBox.tsx`** shows one line at a time; click or `E` advances (`onAdvance` → `game.advanceDialogue()`).
- **`TitleScreen` / `EndScreen`** use `assets/title.jpg` and `assets/ending.jpg` as backdrops.
- **`PauseOverlay`** — Resume calls `game.setPaused(false)`, Restart calls `start()` which bumps `runKey`.

Styling uses Tailwind utility classes plus custom animation classes defined in `src/index.css`
(`.msg-fade`, `.flick`, `.glow-pulse`, `.vignette`, `.no-select`, `.font-title`). Fonts (Cinzel for titles,
EB Garamond for body) are loaded in `index.html` via Google Fonts.

---

## 11. Common Tasks (How-To)

> All coordinates in `map.ts` are **grid** (tile) coordinates; the engine converts to pixels via `px(t) = t*TILE + TILE/2`.

### Move the player's starting position
Edit `spawn` in `generateMap()` (`map.ts:241`).

### Add / relocate an Anima Shard
Edit the `shards` array (`map.ts:214`). Coordinates are `{x: px(X), y: px(Y)}`.

### Add a new enemy
Append to `enemySpawns` (`map.ts:219`) with `{x, y, type}`. For a brand-new *behavior*, add a `type` to
`EnemyType` (`types.ts:3`), handle stats in `makeEnemy` (`engine.ts:610`), and branch in `updateEnemy`.

### Add a readable sign
Append to the `signs` array (`map.ts:200`): `{x, y, text}`. Press **E** near it.

### Change controls
Key bindings live in `onKeyDown` (`engine.ts:678`) and the movement reads in `updatePlayer`
(`engine.ts:813`). The Title/Pause screens also hardcode the control hints — update those strings too.

### Change map size
`MAP_W` / `MAP_H` in `constants.ts`. Note `generateMap` uses many hardcoded region coordinates; you'll
likely need to adjust those too.

### Add a tile type
1. Add id to `T` in `constants.ts`.
2. Add `case` in `drawTile()` (`engine.ts:150`).
3. If it blocks movement, add to `SOLID_TILES`.

### Tune combat numbers
Player stats: `init()` (`engine.ts:470`). Enemy stats: `makeEnemy`/`spawnBoss` (`engine.ts:610`/`658`).
Damage/knockback: `hitEnemy`/`damagePlayer`. Speeds: `Player.speed`, `Enemy.speed`.

### Change win/lose flow or add a new screen
`App.tsx` `Screen` type + the `onWin`/`onLose` callbacks. The boss death triggers `endWin()`
(`engine.ts:1250`).

---

## 12. Conventions & Gotchas

- **Strict TypeScript**: `noUnusedLocals`, `noUnusedParameters`, `strict` are on. Remove unused vars or the
  build/editor will complain. (Note `drawSentinel` ends with `void e;` to satisfy unused-param checks.)
- **Path alias**: use `@/...` imports (mapped in both `tsconfig.json` and `vite.config.ts`). Don't use
  relative `../` chains where the alias is cleaner, but either works.
- **No `tailwind.config.js`**: Tailwind v4 is configured entirely through CSS. Custom utilities/theme go in
  `src/index.css`.
- **The game never touches React**: keep `src/game/*` framework-agnostic. Communicate via `GameCallbacks`.
- **Restart = remount**: there is no in-place reset; `start()` changes the `key` on `GameCanvas`.
- **Deterministic world**: `generateMap` uses a fixed seed — changing gameplay feel shouldn't accidentally
  depend on randomness varying between runs.
- **DPR handling**: canvas backing store is scaled by `devicePixelRatio` (capped at 2) in `resize()`
  (`engine.ts:1289`); all drawing uses CSS pixel coordinates thanks to the `setTransform(dpr,...)` at the top
  of `render()`.
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
3. Read `src/game/engine.ts` top-to-bottom once — it is the whole game.
4. Skim `src/game/map.ts` to learn the world layout.
5. Skim `App.tsx` + `components/*` to see how the React shell talks to the engine.
6. Make a small change (e.g. move a shard) and confirm `npm run dev` reflects it.
