# Engine Architecture

> This document used to be the migration plan for splitting the monolithic `engine.ts`. That migration is
> now complete. The sections below describe the resulting architecture as it currently exists.

The monolithic `engine.ts` has been decomposed into dedicated, single-responsibility subsystems under
`src/game/`. `engine.ts` itself remains the lifecycle coordinator: it owns the canvas, the `WorldState`,
all subsystems, the region repository, and the callback bridge to React.

---

## Directory structure

```
src/game/
├── core/
│   ├── FixedStepLoop.ts   # requestAnimationFrame + fixed 60 Hz simulation stepping
│   ├── SceneStack.ts      # SceneId stack (title/overworld/interior/pause/ending)
│   ├── SpatialGrid.ts     # Spatial hash for O(1) combat / collision queries
│   └── WorldState.ts      # Mutable aggregate: player, enemies, projectiles, quests, journal, etc.
├── systems/
│   ├── InputSystem.ts     # Window listeners, key mapping, action buffers
│   ├── MovementSystem.ts  # Velocity, knockback, sub-step collision & sliding
│   ├── CombatSystem.ts    # Hitbox queries, damage resolution, invulnerability
│   ├── AISystem.ts        # Enemy behavioral steering, timers, and attack telegraphs
│   ├── GameFlowSystem.ts  # Objectives, prompts, HUD assembly
│   └── (Particle/camera logic is still inline in engine.ts / renderer.ts)
├── entities/
│   ├── components.ts      # Component definitions for the entity archetype system
│   ├── archetypes.ts      # Player / enemy / projectile / item archetypes
│   ├── EntityFactory.ts   # Spawn/despawn from archetypes + projectile pooling
│   ├── EntityPool.ts      # Object pool for projectiles
│   ├── EntityRegistry.ts  # Stable IDs, generation counters, tag/component queries
│   └── index.ts           # Public exports
├── render/
│   ├── renderer.ts        # Canvas draw passes, lighting, particles, text
│   ├── spriteAtlas.ts     # Vite asset discovery, image preload/cache
│   └── spriteCatalog.ts   # Static catalogue of required sprites
├── engine.ts              # Game class: orchestrator, callbacks, region transitions
├── map.ts                 # Procedural overworld + fortress map generation
├── fortress.ts            # Fortress layout parsing / validation
├── fortressLayouts.ts     # Nine authored fortress interiors
├── quests.ts              # Three investigations and their choices
├── regions.ts             # Region cache + web-worker source
├── escalation.ts          # Shard harvest costs, ward dialogue, warden entries
├── hazard.ts              # Environmental damage
├── slots.ts               # SQLite-in-WASM save slots
├── constants.ts           # TILE size, MAP_W/H, tile catalogue, shape catalogue
├── types.ts               # Shared interfaces
└── math.ts                # Pure geometry / vector helpers
```

---

## Subsystem responsibilities

### `core/FixedStepLoop.ts`

- Accumulates raw `dt` from `requestAnimationFrame`.
- Runs a fixed 60 Hz simulation step while time is banked.
- Calls `render()` every animation frame.
- Clamps and handles tab-suspension recovery.

### `core/SceneStack.ts`

- Small explicit stack of `SceneId`.
- `push("pause")` overlays pause on top of the world; `pop()` resumes.
- Root scene is either `"overworld"` or `"interior"` depending on whether the player is in a fortress.

### `core/WorldState.ts`

- The single mutable aggregate for a running session.
- Holds `player`, `enemies`, `projectiles`, `items`, `journal`, `quests`, `checkpoint`, `shards`, etc.
- Provides `snapshot()` and `restore()` for save/load.
- Bumps `WorldSnapshot.version` when save format changes; `restore()` migrates older versions.

### `core/SpatialGrid.ts`

- Fixed cell grid based on tile size.
- `insert` / `clear` / `queryCircle` / `queryRect`.
- Used by `CombatSystem` for attack-box and projectile lookups instead of $O(N)$ scans.

### `systems/InputSystem.ts`

- Listens for `keydown`, `keyup`, and `blur`.
- Maintains a `Set<string>` of pressed keys and action buffers for `attack`, `dash`, `interact`, `pause`.
- Exposes `getMovementVector()`, `consumePressed(action)`, `clear()`.
- Clean `destroy()` removes listeners on unmount.

### `systems/MovementSystem.ts`

- Reads intended velocities from player input and AI output.
- Performs axis-separated sub-step movement (≤2px) against the tile shape catalogue in `constants.ts`.
- Handles wall sliding, one-way ledges, slopes, knockback decay, and dash motion.

### `systems/CombatSystem.ts`

- Evaluates player attack frames and directional hitboxes.
- Queries `SpatialGrid` for valid targets.
- Applies damage, invulnerability, knockback, death handling, and projectile collisions.
- Manages the `swingHit` set so each attack hits each enemy once.

### `systems/AISystem.ts`

- See `AI_SYSTEM.md`.
- Runs wraith, sentinel, adept, and boss state machines.
- Emits projectiles, summons, and damage callbacks through `AIContext`.

### `systems/GameFlowSystem.ts`

- Builds `HudData` from world state.
- Computes current objective text ("Find the next shard", "Return to Orithel", etc.).
- Detects nearby interactables (NPC, signs, campfires) and returns prompt strings.

---

## Orchestration in `engine.ts`

`Game.update()` runs the pipeline in this order every fixed tick:

1. `input.update()` — consume buffered actions.
2. `ai.updateEnemy(...)` for each living enemy — set intended velocities and telegraphs.
3. `movement.update()` — integrate player and enemy physics.
4. `grid.clear()` + `grid.insert(...)` — rebuild spatial index.
5. `combat.update()` — resolve attacks, projectiles, contact damage, deaths.
6. `flow.update()` — objectives, prompts, HUD push.
7. Camera follow + screenshake decay.
8. Region-transition / death / checkpoint bookkeeping.

`Game.render()` delegates to `renderGame()` in `renderer.ts` with the current camera and world state.

---

## Adding a new subsystem

1. Create `src/game/systems/YourSystem.ts` with a clear responsibility.
2. Add an instance field to `Game` in `engine.ts`.
3. Instantiate it in `Game.init()` with any dependencies.
4. Call it from `Game.update()` in the appropriate pipeline position.
5. Add unit tests in `src/game/systems/YourSystem.test.ts`.
6. Update this document.

---

## What is deliberately still in `engine.ts`

- Canvas context setup, DPR handling, resize logic.
- Region loading / caching / transitions via `RegionRepository`.
- Dialogue state machine and callback dispatch (`onHud`, `onDialogue`, `onPause`, `onEnd`, `onJournal`, `onInterior`).
- Checkpoint respawn, death handling, and ending triggers.
- Boss burst / summon helpers that are too specific to generalize cleanly.
- Particle and floating-text arrays (these may move to a dedicated `ParticleSystem` later if needed).

The goal is not zero lines in `engine.ts`; the goal is that `engine.ts` is only an orchestrator and
contains no duplicated physics, AI, or combat rules.
