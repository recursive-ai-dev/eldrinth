# World Architecture

## Audit status

This document is maintained using the required sequence: **system mapping →
pre-record → implementation → record**. It is the source of truth for core
runtime ownership and lifecycle decisions.

## Pre-record: initial entry-point findings (2026-09-09)

`README.md` is not present. The browser entry point is `src/main.tsx`, which
mounts React `App` under `StrictMode`. `App` conditionally mounts `GameCanvas`
for every non-title screen and shares engine callbacks through a global Zustand
store. At this point it is not yet clear which object owns engine construction,
the animation-frame loop, or its teardown. This leaves the engine lifecycle
coupled to screen rendering and susceptible to React remount behavior.

**Boundary required:** one explicit runtime owner must create, start, stop, and
dispose the game engine; UI state must receive snapshots/events without owning
the engine lifecycle.

Further system findings will be appended before each corresponding change.

## System map: pre-implementation (2026-09-09)

| System | Initial owner / creation | Initial update or lifecycle | Finding |
| --- | --- | --- | --- |
| Application / screens | `main.tsx` mounts `App`; Zustand `useGameStore` holds `title`, `play`, `win`, and `lose` | React mounts `GameCanvas` outside title; result screens unmount it | There is no stack, and pause/dialogue are independent booleans rather than scenes. Interiors, menus, and cutscenes have no representation. |
| Runtime / loop | `GameCanvas` constructs `Game`, calls `init()` then `start()`, and calls `destroy()` on unmount | One RAF callback computes a variable `dt`, updates, renders, then publishes HUD | Engine ownership is implicit in a component. Simulation, rendering, UI publishing, and clock advancement share one callback. |
| Time | mutable `Game.time` | increments once per rendered frame, including paused/dialogue/ended frames | It is frame-rate dependent and drives both simulation-adjacent effects and rendering. There is no fixed simulation clock. |
| Input | `Game` creates `InputSystem` | DOM key handlers directly invoke pause, attack, dash, interaction, and dialogue methods | Gameplay mutations occur at browser-event time, outside a deterministic simulation order. |
| World / regions | `Game` directly calls synchronous `generateMap()` | one 70×50 generated map stays resident for the runtime | No authoritative world aggregate, region identity, preload, unload, or asynchronous loading boundary exists. |
| Entities / gameplay | mutable arrays and player/boss fields on `Game` | player → each enemy → death cleanup → projectiles → particles/text → items → camera → prompt | The order happens to be stable but is neither named nor documented as a contract; presentation effects share game ownership. |
| Rendering | `Game` creates canvas context; renderer imports the `Game` type and reads its internals | `renderGame(this)` per RAF | Renderer is coupled to the full engine instead of a render-state contract. Static map canvas is built during initialization. |
| UI | Zustand store plus `GameCallbacks` | HUD is pushed every 100 ms and UI invokes `Game` through a globally stored game instance | UI both observes and retains the engine, blurring command/event ownership. |
| Audio | none | none | Audio has no owner or lifecycle and must not be assumed by gameplay. |
| Teardown | React cleanup calls `Game.destroy()` | RAF, input, and resize listener are released | Runtime cleanup exists but is not represented as an application lifecycle contract; the store retains the former instance. |

## Pre-record: architecture changes to make next

1. Add a fixed-step loop that owns frame accumulation, calls simulation in a
   documented stable order, and renders only after zero or more simulation
   steps. The simulation clock advances only on fixed steps.
2. Establish `WorldState` as the sole aggregate for map, entities, progression,
   and simulation time. `Game` becomes a runtime coordinator and exposes a
   save/load target rather than being the save target itself.
3. Add explicit `SceneId`/`SceneStack` contracts for title, overworld,
   interiors, menus, pause, cutscenes, and endings. The current UI will use the
   subset it renders; future screens do not require ad-hoc booleans.
4. Add an asynchronous region repository contract with preload, acquire, and
   release semantics. The present generated overworld will be its first
   region; no region will be synchronously generated in the render callback.
5. Remove the renderer's dependency on the engine type by introducing a
   one-way render-state interface. UI receives events/snapshots and no longer
   stores the engine as global state.

The changes intentionally do not invent an audio implementation. A future
audio service will subscribe to runtime events and be started/stopped by the
runtime owner; simulation code will not import it.

## Pre-record: deterministic random source (2026-09-09)

The map generator uses a fixed local seed, but `Game` and `AISystem` use
`Math.random()` for enemy initialization, loot, summoning, particles, and a
boss cooldown. Some of those calls alter gameplay and are therefore not
reproducible from input and save state alone. The random source must belong to
`WorldState`, be serialized with it, and be passed to systems through their
explicit context. Renderer-only camera shake may remain presentation-local
because it cannot feed back into simulation.

## Implemented architecture (2026-09-09)

### Startup and teardown

1. `main.tsx` mounts React `App`.
2. `App` owns the UI-facing reference to the active runtime. Zustand owns only UI snapshots and the scene stack, never the runtime object.
3. Starting a session increments `sessionId` and mounts a fresh `GameCanvas`. `GameCanvas` constructs `Game`, awaits `init()`, then calls `start()`.
4. `Game.init()` acquires the `overworld` through `RegionRepository`. Browser builds use `WorkerRegionSource`, so map generation is off the main thread. Static canvas creation yields every eight map rows before the first frame.
5. Unmounting `GameCanvas` calls `Game.destroy()`: it aborts outstanding region work, stops RAF scheduling, releases input and resize listeners, and releases the acquired region. Result scenes consequently tear down the runtime.

`Game` is the runtime coordinator. It owns browser-bound services (canvas, fixed loop, input listener binding, region repository, and presentation-only camera/effects). It does **not** own saveable gameplay data.

### Authoritative world and save boundary

`WorldState` is the sole mutable aggregate for region id and map reference, fixed simulation time and tick number, player, enemies, projectiles, items, boss reference, progression, messages, the next entity id, and deterministic PRNG state.

`WorldState.snapshot()` and `WorldState.restore()` are the save/load boundary. The snapshot intentionally omits the static map payload (it is selected by `regionId`) and transient UI dialogue; it includes every mutable simulation value needed to resume the loaded region. `Game.saveWorld()` and `Game.loadWorld()` expose this boundary without making the runtime itself serializable; loading explicitly requires its region to have been acquired first.

### Time and deterministic update order

`FixedStepLoop` is the only RAF scheduler. It clamps browser frame time, accumulates it, runs zero or more 1/60-second simulation ticks (up to eight per rendered frame), then renders once. Excess catch-up time is discarded after the step limit so a suspended tab cannot issue a giant simulation delta.

For every fixed tick, `Game.simulateStep()` runs this contract in order:

1. Consume discrete input commands.
2. Advance `WorldState.simulationTime` and tick number if gameplay is active.
3. Update player movement, combat timers, pickups, and boss trigger.
4. Update enemies and AI in entity-array order.
5. Remove completed dying entities and resolve ending transition.
6. Update projectiles and collision damage.
7. Update items, presentation particles/text, and camera.
8. Project prompt/HUD snapshot to UI at most every 100 ms.

Rendering executes after the fixed ticks and only reads the explicit `RenderState` contract. It receives no update capability and has no import of `Game`. The simulation clock freezes while paused, in dialogue, or ended; there is no frame-rate-dependent game clock. All simulation-affecting random values come from `WorldState.nextRandom()` and are saved with the world.

### Scene and UI flow

`SceneStack` explicitly models `title`, `overworld`, `interior`, `menu`, `pause`, `cutscene`, `win`, and `lose`. Overlays push above a world scene rather than replacing it (`[overworld, pause]`); ending scenes replace the stack and unmount the runtime. The current UI renders title, overworld, pause, win, and lose. Interior/menu/cutscene are represented by the common stack contract so their addition cannot introduce another screen-state mechanism.

Runtime-to-UI communication remains a narrow `GameCallbacks` event port for HUD, dialogue, pause, win, and loss. UI-to-runtime commands use the active component's ref, not a global store. Gameplay systems receive only structural contexts and callbacks; they do not import UI, rendering, audio, or global stores. Audio remains intentionally absent; when added, it will subscribe to runtime events and follow the same start/stop lifecycle.

### Region lifecycle

`RegionRepository` supplies asynchronous `preload`, `acquire`, and `release` operations. It deduplicates in-flight loads and reference-counts resident regions. The current worker source produces the deterministic prototype overworld; authored interior and neighboring region sources can be introduced without changing game-loop ownership. Region generation and static canvas assembly are both kept out of the render callback, preventing region handoff from stalling normal frames.

### Record of changes and rationale

| Change | Why |
| --- | --- |
| Added `FixedStepLoop` and tests | Separates variable browser presentation cadence from fixed simulation cadence and makes update sequencing reviewable. |
| Added `WorldState`, snapshots, and a serialized PRNG | Gives save/load one target and makes gameplay decisions reproducible. |
| Routed input edges through simulation ticks | Browser-event timing can no longer directly mutate player/combat state. |
| Added `SceneStack`; removed `Game` from Zustand | Screen transitions are stack-based and UI cannot retain a stale global runtime. |
| Added worker-backed `RegionRepository` and yielding static-map build | Region work has explicit acquire/release ownership and avoids the render loop. |
| Replaced renderer's engine import with `RenderState` | Rendering is now a one-way consumer, eliminating the engine/render dependency cycle. |

## Verification

- `npx tsc --noEmit`
- `npx vitest run` — 10 tests passed
- `npm run build`

The new tests cover fixed-step scheduling, scene overlay stack behavior, and world snapshot restoration in addition to the pre-existing gameplay tests.
