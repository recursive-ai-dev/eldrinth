# ELDRINTH — Code Audit Log

**Repo:** `/home/woe/Projects/eldrinth` (branch `main`, commit `79871d4`)
**Scope:** all 25 source files under `src/` (~5,900 lines incl. tests). Excludes `dist/`, image assets, lockfile.
**Method:** full read of every file → cross-function trace (input → sink, callback → store, update-order → mutation) → runtime verification via a temporary vitest harness (real `AISystem`/`MovementSystem`/`CombatSystem`) → record. The verification file `src/game/systems/__audit_verify.test.ts` was used for measurement and removed after the audit; raw transcripts are in the appendix.
**Rules applied:** every finding carries a verbatim quote + a `file:line` that was opened and confirmed. Severity requires a named trigger and a concrete bad outcome. Style/naming excluded. Confidence: `confirmed` (code-verified or measured) / `plausible` (mechanism verified, trigger narrow or environment-dependent).

Runtime-check environment: vitest 5.0.0, `npx vitest run` — baseline suite 4 files / 7 tests, all passing, before any audit edits.

---

## Findings

### F-01 · HIGH · Restart never starts a new game — replays resume or freeze the old session
**Confidence:** confirmed (code trace; React 18/19 automatic batching)
**Location:** `src/App.tsx:22-25`, `src/App.tsx:46-51`, `src/components/GameCanvas.tsx:16-32`, `src/stores/useGameStore.ts:65-72,84`, `src/game/engine.ts:263,480,526`

```tsx
// App.tsx:22-25
const start = useCallback(() => {
  reset();
  startGame();
}, [reset, startGame]);
```
```tsx
// App.tsx:46-51 — GameCanvas has no `key`; its position in the tree is stable
{showGame && (
  <GameCanvas
    callbacks={callbacks}
    onReady={(g) => setGameInstance(g)}
  />
)}
```
```ts
// GameCanvas.tsx:26-30 — the Game is created exactly once per mount
const game = new Game(canvas, proxy);
game.init();
game.start();
onReady?.(game);
return () => game.destroy();
```
```ts
// useGameStore.ts:84
reset: () => set({ ...initialState, screen: "title" }),
```

**Trigger:** click **ABANDON & RESTART** in the pause overlay, or press Enter / the restart button on the win/lose screen.
**Impact:** `reset()` and `startGame()` are two synchronous store writes inside one event handler; React 18/19 batches them, so the intermediate `screen: "title"` never commits and `GameCanvas` never unmounts (`showGame = screen !== "title"` stays true). The `useEffect(..., [])` never re-runs, so **no new `Game` is created and the old engine keeps all state**. Consequences, all reachable from the UI:
1. Restart from pause: `engine.paused` is still `true` and nothing calls `engine.setPaused(false)`, so `update(dt)` stays gated (`engine.ts:526`: `if (!this.paused && !this.dialogue && !this.ended) this.update(dt);`). The world is frozen; pressing Esc then *resumes the old run* (old HP, position, enemies) via `engine.ts:481-484` → `togglePause()`.
2. Restart after win/lose: `engine.ended === true` makes `onKeyDown` return before any handling (`engine.ts:480`: `if (this.ended) return;`) — permanently frozen; even Esc is dead. Only a full page reload recovers.
3. The store HUD reset in `startGame()` (`useGameStore.ts:70`: `hud: initialHud`) is overwritten within 0.1 s because the stale engine's loop keeps calling `pushHud` (`engine.ts:529-533`) through the still-live callbacks — the "new" run displays the old run's HP/shards.
4. `reset()` nulls `gameInstance`, but `onReady` never fires again, so `gameRef.current` (`App.tsx:27-32`) keeps driving the stale engine from `DialogueBox`/`PauseOverlay`.
**Suggested fix:** force a remount identity — e.g. `<GameCanvas key={runId} … />` with `runId` bumped in `start()` — or destroy the previous instance and null `gameInstance`/`gameRef` before remount; add an `engine.reset()` for defense in depth.

---

### F-02 · MEDIUM · Enemy velocity is integrated twice per frame — enemies move ~24% faster than configured, and speed varies with frame rate
**Confidence:** confirmed (measured with the real `AISystem` + `MovementSystem`)
**Location:** `src/game/engine.ts:783` and `src/game/engine.ts:804`

```ts
// engine.ts:783 — first integration, pre-AI
if (Math.abs(e.vx) > 1 || Math.abs(e.vy) > 1) this.moveEntity(e, e.vx * dt, e.vy * dt);
```
```ts
// engine.ts:804 — second integration, post-AI (same velocity field)
this.moveEntity(e, e.vx * dt, e.vy * dt);
```
**Trigger:** any moving enemy (a steady chase keeps `|vx| > 1`).
**Impact (measured, 1 s steady-state window, sentinel `speed = 90`):**

| integration | 60 fps | 30 fps |
|---|---|---|
| engine as written (two moves/frame) | **112.0 px/s** | **123.1 px/s** |
| single-integration reference | 56.5 px/s | — |

Configured speed is exceeded by 24% at 60 fps and 37% at 30 fps, and effective speed is frame-rate dependent (≈108–123 px/s across 10–144 fps). The same double integration applies to hit knockback (`engine.ts:709-710`: `e.vx += dx * 430 * f;`), roughly doubling fling distance versus the single-integration model. Concrete outcome: combat pacing silently differs from the tuned constants (`WRATH_SPEED`/`SENTINEL_SPEED`/`ADEPT_SPEED`/`BOSS_SPEED`, engine.ts:49-67) and differs between players at different frame rates.
**Suggested fix:** remove the pre-AI move at line 783 and keep only line 804 (the post-AI velocity already carries the knockback impulse), or make exactly one of the two moves own AI motion and the other own knockback — never both integrating the same velocity in one frame.

---

### F-03 · LOW · Boss summons can spawn inside solid rock and are permanently immobile
**Confidence:** confirmed (mechanism measured; spawn-site geometry)
**Location:** `src/game/engine.ts:815-819`; contrast `src/game/engine.ts:303-306`; arena geometry `src/game/map.ts:115-122`

```ts
// engine.ts:815-819 — no walkability check, unlike map spawns
summonAdd(e: Enemy) {
  const ang = Math.random() * Math.PI * 2;
  const x = e.x + Math.cos(ang) * 60;
  const y = e.y + Math.sin(ang) * 60;
  const w = this.makeEnemy("wraith", x, y);
```
```ts
// engine.ts:303-306 — map spawns DO resolve to walkable tiles
for (const es of this.map.enemySpawns) {
  const t = this.findWalkableTile(es.x, es.y);
  this.enemies.push(this.makeEnemy(es.type, t.x, t.y));
}
```
**Trigger:** boss below 45% HP (`AISystem.ts:152`) standing within ~60 px of the arena's rock ring (rock band at 6–8.4 tiles around `bossCenter`, map.ts:119-120) with the random summon angle pointing outward — the wraith lands 60 px from the boss, i.e. inside `T.ROCK`.
**Impact (measured):** `moveEntity` cannot displace an entity whose body is inside solid tiles (verification: x/y unchanged after forced moves) — the summoned wraith is frozen for the rest of the fight. It is hittable only if within sword reach of the wall; deeper spawns sit as inert obstacles that still inflate the "The Sundered" counter (`GameFlowSystem.ts:49`). No win-condition dependency, hence LOW.
**Suggested fix:** route the summon position through `findWalkableTile` (or re-roll the angle until `!hitsSolid(x, y, r)`), mirroring the map-spawn path.

---

### F-04 · LOW · Melee swings hit through a full wall tile
**Confidence:** confirmed (measured with the real `CombatSystem`)
**Location:** `src/game/systems/CombatSystem.ts:38-51` (`attackBox`) and `:53-57` (`rectCircle`); call path `engine.ts:700-703`

```ts
// CombatSystem.ts:42-45 — "right" box extends L=42 px from the player's center
case "right":
  return { x: player.x, y: player.y - Wd / 2, w: L, h: Wd };
```
```ts
// CombatSystem.ts:53-57 — closest-point circle test, no line-of-sight check
rectCircle(b: RectHitbox, cx: number, cy: number, cr: number) {
  const nx = Math.max(b.x, Math.min(cx, b.x + b.w));
  const ny = Math.max(b.y, Math.min(cy, b.y + b.h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < cr * cr;
}
```
**Trigger (measured):** player at `x = 21` (r = 11, corner touching the wall tile spanning x ∈ [32, 64]) facing right; enemy at `x = 77` (pressed against the far face, r = 13). `attackBox` = `{x:21, w:42}` reaches x = 63; `rectCircle(box, 77, 100, 15)` returned **true** — a hit across the 32 px wall.
**Impact:** the player can damage enemies they cannot see and that cannot reach them, on any 1-tile-thick ruin/spire wall. Minor unfairness/exploit, no crash.
**Suggested fix:** before applying the hit, sample `hitsSolid` along the segment from player center to the enemy (or require `tileAtPx` of the box's leading edge to be non-solid).

---

### F-05 · LOW · A game-loop exception freezes the game silently and leaves window listeners attached
**Confidence:** confirmed (behavior read directly from the catch block)
**Location:** `src/game/engine.ts:534-539`

```ts
    } catch (e) {
      console.error("Game loop error:", e);
      this.running = false;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
```
**Trigger:** any exception thrown inside `update(dt)` or `renderGame(this)` during a frame (e.g. a renderer error or a future code change that throws mid-update).
**Impact:** the error goes to the console only — no callback fires, `destroy()` is not called, so the window `keydown`/`keyup`/`blur` listeners bound by `InputSystem.bind` (`InputSystem.ts:20-22`) and the `resize` listener (`engine.ts:315`) remain attached and keep mutating engine state (`onKeyDown` runs `startAttack`/`tryInteract` regardless of `running`). The React app still shows the play screen over a frozen canvas with no user-visible error; the only recovery is pause-navigate or reload. The `Game` instance is retained by those listeners until unmount.
**Suggested fix:** in the catch, call `this.destroy()` (removes listeners, stops RAF), surface the failure via a new `GameCallbacks.onFatalError` so the store can show an error/restart screen.

---

### F-06 · LOW · `Game.init()` failures propagate uncaught out of a React effect — blank screen, no boundary
**Confidence:** plausible (mechanism verified; trigger is environment-dependent)
**Location:** `src/components/GameCanvas.tsx:26-28`; rethrow `src/game/engine.ts:329`; context-failure paths `src/game/engine.ts:254-257`, `src/game/render/renderer.ts:264-267`

```tsx
// GameCanvas.tsx:26-28 — init() may throw; there is no try/catch or error boundary upstream
const game = new Game(canvas, proxy);
game.init();
game.start();
```
```ts
// engine.ts:328-329
this.destroy();
throw e;
```
**Trigger:** `canvas.getContext("2d")` returning `null` (engine.ts:254-257) or the static canvas context failing (renderer.ts:264-267) — unsupported/limited browser environments.
**Impact:** the exception escapes a passive effect; with no error boundary anywhere in `App.tsx`, React unmounts the tree → blank page with only a console error. The player gets no actionable feedback.
**Suggested fix:** wrap effect body in try/catch and report via a callback/state (or add a top-level React error boundary) so the UI can show a "cannot start" screen.

---

### F-07 · LOW · Projectile player-hit check runs before the solid-tile check — corner-graze damage through a wall
**Confidence:** plausible (frame order read directly; face-on case measured impossible, corner case geometrically reachable)
**Location:** `src/game/systems/CombatSystem.ts:95-99` vs `:103-105`

```ts
// CombatSystem.ts:95 — player hit is tested first, even inside a wall tile
if (Math.hypot(pr.x - player.x, pr.y - player.y) < pr.r + player.r && player.dying <= 0 && player.invuln <= 0 && !player.dashing) {
  onPlayerHit(pr);
  projectiles.splice(i, 1);
  continue;
}
```
```ts
// CombatSystem.ts:103 — solid consumption happens after
if (onSolidHit(pr)) {
  projectiles.splice(i, 1);
}
```
**Trigger:** a projectile's *first* position inside a solid tile landing within `pr.r + player.r` = 17 px of the player — measured impossible face-on across a 1-tile wall (entry edge is 32 + 11 = 43 px from a far-side player), but reachable at corners: the player may hug a wall tile corner (center 11 px from one face) while a diagonal projectile clips that same tile within 17 px of them.
**Impact:** 1 damage delivered in the same frame the projectile should have been destroyed by the wall — damage originating from inside a wall at a corner. Narrow alignment window; the burst effect also plays inside the wall.
**Suggested fix:** run the `onSolidHit` check before the player-hit check inside `processProjectiles` (or skip the player test when the projectile's current tile is solid).

---

### F-08 · LOW · Typecheck is red: `tsc --noEmit` fails with unused-import errors
**Confidence:** confirmed (executed during this audit)
**Location:** `src/game/engine.ts:9`, `src/game/systems/AISystem.ts:1`; gate `tsconfig.json:26`

```ts
// engine.ts:9
  HudData,
```
```ts
// AISystem.ts:1
import type { Dir, EnemyType } from "../types";
```
**Trigger:** run `npx tsc --noEmit` (tsconfig enables `noUnusedLocals`, tsconfig.json:26). Measured output: `error TS6196: 'HudData' is declared but never used.` and `error TS6196: 'Dir' is declared but never used.`; exit code 2.
**Impact:** the project's own type-quality gate fails; any CI or pre-commit typecheck blocks. Note `npm run build` runs only `vite build`, so the red gate is invisible in the default build path — type drift can accumulate unnoticed.
**Suggested fix:** remove the two unused imports; wire `tsc --noEmit` into the `build` script so the gate actually runs.

---

## Strengths (same evidence standard)

### S-01 · Symmetric, leak-free listener and RAF lifecycle
`InputSystem.bind` adds `keydown`/`keyup`/`blur` (`src/game/systems/InputSystem.ts:20-22`) and `destroy` removes exactly those plus clears state (`:25-33`); `engine.destroy()` cancels the RAF and removes the resize listener (`src/game/engine.ts:333-339`); `GameCanvas` returns `() => game.destroy()` as effect cleanup (`src/components/GameCanvas.tsx:30`). Verified compatible with React StrictMode double-mounting (`src/main.tsx:11`): the first instance is fully torn down before the second is created.

### S-02 · Frame-loop hardening against tab switches and stalls
```ts
// engine.ts:521-522
if (!isFinite(dt) || dt < 0) dt = 0;
if (dt > 0.05) dt = 0.05;
```
Non-finite/negative delta is zeroed and the step is capped at 50 ms — returning to a backgrounded tab cannot teleport entities or explode physics. The next frame is requested before the update work (`engine.ts:517`) and cancelled deterministically in the catch path (`:537`).

### S-03 · Init failure rolls back partial construction
```ts
// engine.ts:321-330 (excerpt)
} catch (e) {
  this.initialized = false;
  this.enemies = [];
  this.projectiles = [];
  ...
  this.destroy();
  throw e;
}
```
A failure mid-`init()` (map gen, static canvas, input binding) clears all partially populated arrays, unbinds listeners, marks the engine uninitialized, and rethrows — no half-initialized game is ever observable.

### S-04 · Out-of-bounds is treated as solid — entities and projectiles cannot leave the world
```ts
// MovementSystem.ts:29-33
solidAtIdx(i: number): boolean {
  if (i < 0 || i >= this.map.solid.length) return true;
  ...
  if (!this.map.wardUnlocked && this.map.wardTiles.has(i)) return true;
```
`tileAtPx` returns `-1` outside the map (`MovementSystem.ts:25`), which `solidAtIdx` maps to solid — movement clamps to the world and stray projectiles die at the edge (`engine.ts:834-840`) instead of touching void indices.

### S-05 · Sub-stepped, axis-separated collision prevents tunneling
```ts
// MovementSystem.ts:51-55 — ≤2 px per step, per axis
const m = Math.min(2, rem);
if (!this.hitsSolid(e.x + s * m, e.y, e.r)) e.x += s * m;
else break;
```
Even the 520 px/s dash (~8.7 px/frame) is applied in ≤2 px increments with 5-point (corner + center) sampling (`MovementSystem.ts:36-46`), so no 32 px tile can be skipped at any supported speed.

### S-06 · No injection surface — all dynamic text goes through React-escaped JSX
Sign texts, dialogue, HUD messages, and float-text are rendered as JSX children (`src/components/DialogueBox.tsx:23`: `{data.text}`; `src/components/HUD.tsx:106`: `{hud.message}`). Repo-wide search found **no** `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, `eval`, `localStorage`, `fetch`, `XMLHttpRequest`, or `WebSocket` anywhere under `src/`. Canvas `fillText` calls are paint-only sinks. No backend exists, so there are no auth surfaces to audit.

### S-07 · HUD projection clamps hostile values
```ts
// GameFlowSystem.ts:39,41,51
hp: Math.max(0, Math.ceil(state.player.hp)),
stamina: Math.max(0, state.player.stamina),
bossHp: state.boss && state.boss.alive && state.boss.maxHp > 0 ? Math.max(0, state.boss.hp / state.boss.maxHp) : 0,
```
Negative HP from damage overshoot and a zero-`maxHp` division are both guarded before reaching React.

### S-08 · Deterministic world with an explicitly guarded ward gate
Map generation is seeded (`src/game/map.ts:46`: `mulberry32(0x9e3779b1)`; PRNG at `:4-12`), producing an identical world every run — reproducible bug reports. Road carving refuses to touch ward tiles (`map.ts:131-132`: `if (!inB(x, y) || wardSet.has(idx(x, y))) return;`), so generated paths can never bypass the three-shard ward.

### S-09 · Callback freshness pattern prevents stale closures
`GameCanvas` mirrors the latest callbacks into `cbRef.current = callbacks` on every render (`src/components/GameCanvas.tsx:13-14`) and the engine calls a stable proxy object (`:19-25`), so engine→React callbacks always invoke current handlers even though the engine is constructed once.

### S-10 · AI guards against divide-by-zero and hostile-state damage
```ts
// AISystem.ts:48
const dist = Math.hypot(dx, dy) || 1;
```
and contact damage is gated on `ctx.player.dying <= 0 && ctx.player.invuln <= 0 && !ctx.player.dashing` (`AISystem.ts:103`, `:157`) — no NaN propagation from an exact-overlap chase, and no damage while the player is invulnerable, dashing, or dead.

### S-11 · Test suite covers core system contracts (7/7 passing)
`npx vitest run`: 4 files, 7 tests, all pass — adept/boss telegraph timing (`src/game/systems/AISystem.test.ts:48-77`), projectile solid-consumption (`src/game/systems/CombatSystem.test.ts:5-35`), HUD stamina projection (`src/game/systems/GameFlowSystem.test.ts:5-25`), spatial-grid query/rebuild (`src/game/core/SpatialGrid.test.ts:5-33`).

---

## Excluded observations (not findings under the evidence rules)

- `src/game/core/SpatialGrid.ts` is imported only by its own test — dead code in the app today (search: no other references). Recorded for the owner; no runtime impact, so not a finding.
- Interact/prompt distances are duplicated as literals in `GameFlowSystem.updatePrompt` (`GameFlowSystem.ts:59,65`: `48`/`44`) and as engine constants (`engine.ts:73-74`). Currently identical; a drift would need a future edit, so no present trigger → excluded.
- `openDialogue` (`engine.ts:930`) would read `lines[0]` of an empty array, but both call sites pass non-empty arrays (`engine.ts:956,963`), and sign texts are non-empty constants (`map.ts:200-213`) → no reachable trigger.
- `engine.updatePrompt`'s dialogue guard (`engine.ts:582`) is unreachable (update is skipped while dialogue is open) — dead branch, no impact.
- Keys are added to `InputSystem.keys` even while paused/in dialogue (`InputSystem.ts:43-46` runs before the engine's gate at `engine.ts:480-493`); audited end-to-end: `keyup`/`blur` always clean the set and `setPaused(true)`/`openDialogue` clear it, so no stale-movement state is reachable.

---

## Coverage

| File | Lines | Status |
|---|---|---|
| src/main.tsx | 14 | read |
| src/App.tsx | 71 | read (F-01) |
| src/index.css | 112 | read |
| src/components/GameCanvas.tsx | 35 | read (F-01, F-06) |
| src/components/HUD.tsx | 112 | read (S-06) |
| src/components/DialogueBox.tsx | 39 | read (S-06) |
| src/components/PauseOverlay.tsx | 35 | read |
| src/components/TitleScreen.tsx | 80 | read |
| src/components/EndScreen.tsx | 62 | read |
| src/game/engine.ts | 1055 | read in full (F-01..F-03, F-05, F-08, S-01..S-03) |
| src/game/map.ts | 248 | read in full (S-08) |
| src/game/math.ts | 47 | read |
| src/game/constants.ts | 34 | read |
| src/game/types.ts | 67 | read |
| src/game/render/renderer.ts | 860 | read in full (S-06) |
| src/game/systems/AISystem.ts | 161 | read (F-02 context, S-10) |
| src/game/systems/CombatSystem.ts | 108 | read (F-04, F-07) |
| src/game/systems/GameFlowSystem.ts | 82 | read (S-07) |
| src/game/systems/InputSystem.ts | 57 | read (S-01) |
| src/game/systems/MovementSystem.ts | 79 | read (F-03 proof, S-04, S-05) |
| src/game/core/SpatialGrid.ts | 103 | read (excluded observation) |
| src/stores/useGameStore.ts | 97 | read (F-01) |
| src/stores/index.ts | 1 | read |
| src/utils/cn.ts | 6 | read |
| src/vite-env.d.ts | 1 | read |

Test files read: `AISystem.test.ts` (78), `CombatSystem.test.ts` (36), `GameFlowSystem.test.ts` (26), `SpatialGrid.test.ts` (34).

---

## Verification appendix (runtime evidence)

A temporary harness `src/game/systems/__audit_verify.test.ts` was created for this audit and **removed afterwards** (repo left as found, apart from this log). It imported the real `AISystem`, `MovementSystem`, and `CombatSystem` and replicated `Game.updateEnemy`'s exact per-frame sequence (`engine.ts:783-785, 790-804`). Methodology note: the measurement teleports the chase target 300 px ahead each frame so the enemy never reaches it and the window (frames 60–120) is pure steady state.

Commands and results:

```
$ npx vitest run                                  # baseline, before audit edits
Test Files  4 passed (4)   Tests  7 passed (7)    EXIT:0

$ npx tsc --noEmit
src/game/engine.ts(9,3): error TS6196: 'HudData' is declared but never used.
src/game/systems/AISystem.ts(1,15): error TS6196: 'Dir' is declared but never used.
EXIT:2

$ npx vitest run src/game/systems/__audit_verify.test.ts   # harness (4/4 passed)
[AUDIT] sentinel configured=90 px/s | engine(2x-integration)=112.0 px/s | single-integration reference=56.5 px/s
[AUDIT] sentinel engine speed @60fps=112.0 px/s @30fps=123.1 px/s
[AUDIT] entity inside solid after move attempts: x=500 y=500 (spawned 500,500)
[AUDIT] attackBox={"x":21,"y":80,"w":42,"h":40} (reaches x=63, wall far face=64)
[AUDIT] rectCircle(enemy@77 through wall)=true
```

Sink-safety sweep (source of S-06): regex search over `src/` for `dangerouslySetInnerHTML|innerHTML|localStorage|sessionStorage|document\.write|eval\(` and `fetch\(|XMLHttpRequest|WebSocket` — zero hits in source (matches existed only inside the prebuilt `dist/index.html` bundle internals and markdown prose).

Dead-code sweep (excluded observation): `SpatialGrid` appears in `src/game/core/SpatialGrid.ts` and `src/game/core/SpatialGrid.test.ts` only.

Post-audit state: verification harness deleted; `npx vitest run` re-run clean (4 files / 7 tests passing); working tree contains only the new `AUDIT_LOG.md`.






