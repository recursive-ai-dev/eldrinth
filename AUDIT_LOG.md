# ELDRINTH — v1 Release Audit

**Scope:** the whole repository at the `v1.0.0` tag: `src/`, `index.html`, `vite.config.ts`,
`package.json`, and the shipped `dist/`. Excludes image assets and the Python sprite generator
internals.
**Method:** full read of the engine and shell → cross-function trace (input → sink, callback →
store, update-order → mutation) → runtime verification with the real `MovementSystem`,
`map.ts` generator and `headlessGame` harness → a subdirectory hosting check that serves the
production build under a path prefix and resolves every referenced asset as a browser would.
**Rules applied:** every finding carries a `file:line` that was opened and confirmed, a named
trigger, and a concrete bad outcome. Style and naming are out of scope.

Baseline at the start of this pass: 36 test files / 217 tests passing, `vite build` succeeding, and
`npm run build` — which gates on `tsc --noEmit` — **failing**.

## Post-pass state

`tsc --noEmit` clean · `vitest run` 35 files / 214 tests passing · `npm run build` succeeds ·
`dist/` regenerated and verified reachable from a subdirectory · main chunk 519.4 kB → 510.0 kB
(167.5 kB → 159.0 kB gzip) · tile-chunk cache, measured across a full overworld walk, 234 MB → 64 MB.

---

## Release blockers, fixed

### B-01 · CRITICAL · The release gate did not pass
`npm run build` is `tsc --noEmit && vite build`, and `tsconfig.json` includes `src`. An unfinished
performance harness sat in `src/__perf__/` and `src/game/perf.bench.test.ts`; the entry point
imported `__stageHook` from the renderer, which did not exist. Any `git add -A` shipped a red
build.

**Fix:** moved to `bench/` with a separate vitest config, so a diagnostic tool can never gate a
release or slow the suite (it monkey-patches `localStorage` and runs 2000-frame loops). Added the
missing `__stageHook` to `renderGame` as real per-stage instrumentation, not a stub.

### B-02 · CRITICAL · The build only worked from a domain root
`vite.config.ts` set no `base`, so all 72 asset URLs were absolute `/assets/…`. An itch.io zip is
served from an arbitrary path, where the region Web Worker 404s — `Game.initialize()` rejects and
the player gets "Initialization Failed" after committing to a new run — and the sql.js wasm 404s,
which kills every save.

**Fix:** `base: process.env.ELDRINTH_BASE ?? "./"`, overridable for a fixed deployment path.
Verified by serving `dist/` under `/itch/eldrinth/` and resolving every reference: 72/72 reachable,
worker and wasm both 200. The same check fails against an absolute base, so it is a real guard.

### B-03 · HIGH · The shard counter was farmable
Dying in a fortress sets `discardCurrentRegion`, which deletes that region's snapshot; re-entering
re-seeds the shard from `map.shards`, and `world.shards` was incremented again on pickup and never
decremented. The counter could exceed nine, and the "nine people" premise the whole story rests on
stopped meaning anything.

**Fix:** `WorldState.harvestedShards` records *which vessel* was emptied, persisted in the
snapshot. The count is now `harvestedShards.size`, and a stale shard item in an already-emptied
region is cleared without re-awarding. Old saves are backfilled from the shard count against the
canonical fortress order.

### B-04 · HIGH · "Abandon & Restart" did not restart
`App.restart` called `startGame()` while `checkpoint` still held the last autosave, so the pause
menu's only destructive action silently rewound the run by up to ten seconds — and it was the only
in-game way back from a bad state.

**Fix:** `restart` drops the checkpoint and closes the journal. Restart is a fresh run.

### B-05 · HIGH · A settlement interior trapped the player inside solid tiles
`interior.crater-watch.b` had its lamp glyph on the tile directly above the door, so
`townInteriorSpawn` placed the player inside a solid `CRYSTAL`. Separately, `crater-watch` had a
stray wall row under one cottage, so leaving that house deposited the player inside a `HOUSE_WALL`.
Both were recoverable by pressing E (the exit is 32px away and `SIGN_READ_RADIUS` is 44), but the
geometry was visibly broken.

**Fix:** moved the lamp; removed the stray wall row. New test walks the entire world graph and
asserts every transition — in both directions, since the entrance and the return are exits of
*different* maps — lands on a walkable tile. Verified to fail against each original bug.

### B-06 · HIGH · Walk-through region gates oscillated
Fortress gates are one tile (32px) from their arrival point and the trigger radius is `TILE * 1.35`
(43.2px), so a player who stopped to look around was ejected, then ejected straight back,
rebuilding the region each time.

**Fix:** gates are disarmed on arrival and re-arm only once the player is clear of every gate. The
check re-evaluates against the current map, so it cannot go stale across a region change.

### B-07 · HIGH · The ending was gated on content the game never said was required
The harvest curve bills 13 maximum health across nine shards, so a pilgrim who took all nine and
investigated nothing arrived at the boss on 5 HP against 96 HP at 1 damage per swing: 96 swings,
~35 seconds of uninterrupted swinging, while the Unbound lands 2 damage per contact hit. Measured,
not estimated. That player could not win, and nothing in the game said so — the objective text only
ever reported that the ward was open.

**Fix, in two parts.** Carrying the shards now deepens the blade (`shardBladeBonus`, capped at +2,
against the +5 the investigations pay, so skipping the reading is still the weaker build). And
Orithel says plainly at the gate when the pilgrim is unprepared, which makes the knife-edge an
informed decision and keeps "No." a real option rather than the only survivable one.

### B-08 · HIGH · Dying before resting at a wayfire ended the whole run
The checkpoint could only be set by resting at a wayfire, which is optional. A player who treated
the first fortress gate as a challenge, died inside, and had never sat down hit `endRun("spent")`
and lost everything.

**Fix:** the arrival road is the starting anchor. Wayfires still upgrade it.

### B-09 · HIGH · A crash left a frozen screen with no explanation
`FixedStepLoop` catches, stops the RAF, then calls `onError`, which only wrote to the console. The
player saw a still image of the game with no signal that anything had happened, and a crash inside
the engine can never reach a React error boundary.

**Fix:** `GameCallbacks.onFatal`; `GameCanvas` shows a recovery panel. Separately, a render-time
throw in the shell unmounted the whole tree into a blank dark page, so `main.tsx` now mounts
`ErrorBoundary`.

### B-10 · HIGH · Save failures were silent, and permanent
`slots.ts` swallowed every `localStorage` error with a `/* quota/private mode */` comment, so a
private window or a full quota looked exactly like a working save: the title screen kept showing the
last save and the run was discarded with no warning. A rejected `initSqlJs` was also cached in
`dbPromise` for the life of the page, turning one transient failure into a permanently dead save
system. And `App.tsx`'s `slotStore.load` had no `.catch`, so a failed load left Continue inert with
no message at all.

**Fix:** failures set a `PersistenceStatus` that the shell renders as a banner on the title screen
and in game; a failed open clears `dbPromise` so the next call retries; `load` reports a real error;
a `PRAGMA user_version` ladder means a future schema change cannot brick existing saves.

### B-11 · HIGH · Keyboard-only players could not erase a save
`TitleScreen`'s window-level handler called `preventDefault()` unconditionally on Enter/Space. A
button's activation is the default action of `keydown`, so this cancelled it — the slot erase button
was unreachable by keyboard, and since the screen's only stated remedy for three occupied slots is
"erase a slot", such a player was locked out of starting a new run entirely. It also meant Enter on
"SLOT 3" loaded slot 1.

**Fix:** the handler ignores events originating from an interactive element. The same guard was
added to `EndScreen`.

### B-12 · HIGH · The content warning described content that is not in the game
The first-launch warning and `ROADMAP.md` both promised "one reference to sexual violence recorded
as an administrative permission". No such reference exists anywhere in the shipped text. For a
hard-M release that is a compliance defect in one direction or the other.

**Fix (per maintainer decision):** the warning now describes the game that is actually here —
institutional violence and the killing of children — and `ROADMAP.md` matches.

### B-13 · MEDIUM · Endings ignored every decision the player made
Forty pieces of authored choice text fed into three static screens. The refusal button read "STAY"
over a body that says "It is not rescue. It is not over", on an action that starts a new run. The
`spent` ending told the player to "count the entries in this slot", but no death counter was
recorded. And reaching the Spire short of nine did nothing at all, so a run could be neither
finished nor stopped.

**Fix:** an epilogue assembled by `epilogueLines()` from the investigations resolved, the choice
made in each, the town requests completed, the warden accounts found, and the death count (now
tracked and persisted). The turn-back is reachable and replaces the old `spent` ending. All three
buttons read WALK AGAIN.

## Also fixed

- **Silent black screen on load.** Between mounting the canvas and `init()` resolving — a worker
  spawn, 40 sprite atlases, a generated map — the player saw nothing. `GameCanvas` now has a loading
  state.
- **234 MB of tile-chunk canvas.** `MAX_CACHED_CHUNKS` was 128, and each chunk is two 512×512
  canvases, so 256 MB was reachable; the 200×140 overworld is 117 chunks, so walking across the
  frontier filled the cache to 234 MB without ever evicting. Measured before and after with
  `npm run bench`: `CHUNKS resident=117/117 backingStoreMB=234` is now `resident=32/117
  backingStoreMB=64`. Eviction also zeroes the canvas dimensions, so the backing store is released
  immediately rather than at GC.
- **~28 KB of unused manifest hashes shipped to players.** The renderer globs all 53 sprite
  manifests eagerly, including a per-pixel hash per frame that nothing at runtime reads — the
  `SpriteManifest` interface has no such member. A Vite plugin strips it at bundle time. The
  integrity test that checks sheets against those hashes reads the committed files from disk, so
  it is unaffected.
- **Fortress braziers were never drawn.** All nine fortresses ship braziers, preload the atlas, key
  the sprite, and punch a hole in the darkness mask — and nothing ever called the draw. Every
  fortress was lit by an invisible fire. Now drawn in the depth-sorted pass.
- **Escape did not close the journal from the note field.** The target guard that stops typing "l"
  from toggling the panel also swallowed Escape, stranding the player behind a button labelled
  "ESC / L / CLOSE". Escape is now handled before the guard.
- **Overlay panels were not dialogs.** Pause, journal and ending had no `role="dialog"`, no
  `aria-modal`, and no focus management, so Tab walked out into the HUD behind them. Added a
  `Modal` primitive that moves focus in, traps Tab, and restores it on close. The dialogue line and
  the HUD prompt/message log are now live regions.
- **Mobile safe areas.** The HUD and touch controls were positioned from the viewport edges, putting
  the D-pad under the home indicator and the action cluster under a notch. Added `viewport-fit=cover`
  and safe-area helpers, and switched the root from `h-screen`/`w-screen` (100vh/100vw) to `100dvh`.
- **Journal text could not be selected.** `user-select: none` was on the app root, so long prose and
  the player's own notes were uncopyable. Selection is re-enabled on the journal, and the scroll
  containers no longer rubber-band the page out from under the game.
- **Contrast.** Thirteen text treatments failed WCAG AA, including the two numbers a player must read
  to play (max HP, shards collected) and a 9px dialogue role label. Raised, and the visible focus ring
  restored where `outline: none` had been substituted with colour alone.
- **Reduced motion** applied only to the intro; the looping decorative animations now stop too.
- **Packaging metadata.** `package.json` was still the Vite scaffold (`react-vite-tailwind`, 0.0.0,
  no license). Now named, versioned, described and MIT-licensed, with a committed `LICENSE` and
  `README`. Removed a conflicting `pnpm-lock.yaml` (which resolved different versions and made the
  committed `dist/` unreproducible), a stale pnpm-only `allowScripts` block naming a version its own
  lockfile contradicted, and an orphaned gitlink for a leaked tool worktree.
- **Web metadata.** Favicon, `theme-color`, Open Graph and Twitter tags, a `<noscript>` explanation,
  and a `noscript` fallback for players with JavaScript disabled.

## Dead code removed

`src/game/entities/` (archetypes, components, factory, pool, registry — 986 lines) and
`core/SpatialGrid.ts` (103 lines) were imported only by themselves and their own tests. The engine
uses flat `WorldState` arrays. `ONBOARDING.md` documented `entities/` as live architecture and a
`spriteCatalog.ts` that does not exist; both are corrected.

Four tile types — `LEDGE`, `SLOPE_UP_LEFT`, `SLOPE_UP_RIGHT`, `TRIGGER` — are defined, collided
against and rendered, but no generator ever places them. Kept rather than deleted: removing them
would touch collision, the renderer and four sprite atlases for no user-visible gain.

## Known, not fixed

- **sql.js is 658 kB of WASM** (322 kB gzip) and is the largest startup cost, fetched just to render
  three slot labels. The snapshot is plain JSON (~20 kB), so plain `localStorage` would remove the
  download, the emscripten glue, and the `CREATE TABLE` compatibility trap entirely. This is a
  persistence redesign rather than a fix, and was out of scope for the v1 pass.
- **`ROADMAP.md` Milestone 2's equipment layer, per-region elite behaviours, and authored activity
  sites are designed but not implemented.** They are now marked as such rather than written in the
  past tense.
- **Milestone 3 (New Pilgrimage) is not shipped** beyond the epilogue. Deferred deliberately.
