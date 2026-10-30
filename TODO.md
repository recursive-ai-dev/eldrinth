# ELDRINTH — Potential Improvements (TODO)

Improvements ordered from **most negatively affecting the app** down to **barely a concern**. Each item is a discrete, testable change. Work top-to-bottom; do not skip ahead without finishing the current item's code, tests, typecheck, and lint.

## Tier 1 — Data integrity & run-loss risk (fix first)

- [x] **1. Deep schema validation for database-loaded saves** (`src/game/slots.ts`)
  - Impact: a save that passes the shallow `load()` checks but is structurally corrupt crashes `WorldState.restore` → `initError` screen → the run cannot continue and the slot is effectively lost. The autosave latch prevents overwrite, but the player still loses the session.
  - Change: add a shared non-throwing snapshot validator (`src/game/snapshotValidation.ts`) covering player/enemy/item/projectile numeric ranges, required arrays, region ids, `harvestedShards` consistency with `shards`, and cross-field invariants. Run it in `slots.load()` before accepting a record; invalid records return `null` ("could not be read") so the original record is preserved and the player can pick another slot or erase. Reuse the same validator for `importBackup` via `parseBackup`.
  - Verification: unit tests for valid v1–v4 snapshots, truncated/corrupt snapshots, wrong types, `harvestedShards` count mismatch, out-of-range numbers; typecheck; `npm test`.

- [x] **2. Add ESLint + lint script + CI gate**
  - Impact: no lint exists (`CODE_STABILIZATION_REPORT.md:24`). Style and obvious bugs (unused vars, `any`, loose comparisons) are only caught by review/tests.
  - Change: add ESLint config (recommended TS + React), a `lint` script, and run it in `.github/workflows/release-check.yml`. Fix any new lint errors introduced.
  - Verification: `npm run lint` exits 0; CI workflow updated.

- [x] **3. Region-transition failure needs retry/recovery instead of a hard stop**
  - Impact: `performRegionChange` stops the loop and calls `onFatal` on worker/load error, leaving the player on a frozen frame with only "Reload Region"/"Return to Title" and no retry (`CODEBASE_ASSESSMENT.md` fault-recovery concern).
  - Change: add bounded exponential-backoff retry for region acquisition; on exhaustion, surface a recoverable error screen offering "Retry region" / "Return to title" without ending the run. Preserve `discardCurrentRegion` semantics.
  - Verification: simulate worker failure via aborting `RegionSource`, assert retry attempts and recovery; typecheck; tests.

- [x] **4. Repeatable production-browser E2E smoke flow in CI**
  - Impact: release verification currently fetches files only (`verify-release.mjs`) and the browser smoke flow is manual (`CODEBASE_ASSESSMENT.md:119`). Layout, focus, touch, and journal typing regressions escape CI.
  - Change: add Playwright smoke specs covering nested-path startup, new game, dialogue advance, journal typing with real keys, save/reload/continue, pause, one region transition; gate CI on them running against the production build at `/eldrinth/`.
  - Verification: specs pass in headless Chromium; CI workflow references them.

- [x] **5. Coalesce autosave checkpoints (10s interval + visibilitychange)**
  - Impact: `backgroundCheckpoint` runs every 10s and on tab-hide; rapid toggles or repeated hide/show can fire duplicate saves back-to-back, thrashing localStorage and the cross-tab lock.
  - Change: debounce/throttle checkpoints so at most one save is in flight and repeats within a short window coalesce; keep the visibilitychange save but only if enough time has passed since the last successful checkpoint.
  - Verification: fake timers + `slotStore.save` spy; assert no duplicate saves within coalescing window; typecheck; tests.

## Tier 2 — Significant functional issues

- [x] **6. Shell-level automated tests for App/slot actions**
  - Impact: `App` has no test harness (deferred risk in `CODE_STABILIZATION_REPORT.md`). Slot ready/busy/error states, journal reset on engine reload, and slot-action gating are untested.
  - Change: add a React Testing Library suite for `App` (mock `slotStore`, `GameCanvas`, stores) covering: slots not ready disables Begin, loading→loaded transition, new game rechecks DB before preparing, erase/export/import, error display, and `onReady` closing the journal.
  - Verification: new tests pass; `npm test` green; typecheck.

- [ ] **7. Touch Pause/Journal availability at compact widths**
  - Impact: `VirtualControls.tsx:75` hides the Pause/Journal shortcut container at `sm:` breakpoints while movement/combat remain; touch players on tablets/landscape phones lose Pause and Journal (`CODEBASE_ASSESSMENT.md` P2 mobile gate).
  - Change: keep Journal/Pause shortcuts visible whenever touch controls are active, independent of viewport width; test both orientations and tablet widths.
  - Verification: component test + Playwright at 390×844 and 844×390 with touch emulation; both buttons reachable.

- [ ] **8. Height-aware title & HUD layouts for short viewports**
  - Impact: at 844×390 the title button is below the viewport and the HUD objective panel overlaps health/shards (`CODEBASE_ASSESSMENT.md` P2).
  - Change: make the title panel scrollable / height-aware and allocate explicit non-overlapping HUD zones at compact sizes; honor safe-area insets and dynamic viewport units.
  - Verification: Playwright screenshots/DOM measurements at 844×390; no clipped primary actions, no HUD overlap.

- [x] **9. Respect reduced-motion for canvas screen shake**
  - Impact: canvas shake is separate from CSS `prefers-reduced-motion`/`quietInterface`, so motion-sensitive players get shake regardless (`CODEBASE_ASSESSMENT.md:125`).
  - Change: gate `Game.shake()` and shake magnitude on a reduced-motion preference read from the store/preferences; when off, substitute a subtle flash or nothing.
  - Verification: test `shake()` no-op under reduced-motion; typecheck.

- [ ] **10. Accessibility foundations: screen-reader labels, focus, contrast**
  - Impact: no screen-reader audit or contrast certification; only a canvas `aria-label` exists (`CODEBASE_ASSESSMENT.md:125`).
  - Change: add meaningful `aria-label`s/roles to canvas, HUD vitals, journal, pause; ensure focus never traps; verify contrast-critical text meets AA where feasible.
  - Verification: automated axe-lite checks in Playwright if available, else manual audit notes; typecheck.

## Tier 3 — Moderate / maintainability

- [ ] **11. Extract authored content data out of `engine.ts`**
  - Impact: `engine.ts` is 2326 lines mixing simulation, lifecycle, dialogue, NPC lore, and town content; changes require understanding unrelated responsibilities (`CODEBASE_ASSESSMENT.md:135`).
  - Change: move `ORITHEL_LINES`, `townHealerEntry`/`townScoutEntry`/`townLoreEntry`/`townFortressLore` data and dialogue-line tables into `src/game/content/` modules; engine imports them. No behavior change.
  - Verification: behavior tests unchanged pass; typecheck; line-count reduced.

- [ ] **12. Persist & surface audio preferences (volume, soundscape toggles)**
  - Impact: `autoPause`/`screenShake` persist, but soundscape volume/mute and audio toggles are not persisted or exposed beyond `SoundSettings` (`useSoundscape`).
  - Change: add persisted audio preferences (master/sfx/music volume, soundscape on/off) to `readDisplayPreferences`/`saveDisplayPreferences` or a dedicated audio store; wire into `useSoundscape`.
  - Verification: preferences round-trip; audio muted when off; typecheck; tests.

- [ ] **13. Frame-time / performance telemetry and budget**
  - Impact: performance observed only in a 3s headless sample; boss fights, long sessions, mobile, Safari unmeasured (`CODEBASE_ASSESSMENT.md:133`).
  - Change: instrument frame intervals (p95/p99) in dev/bench, expose a simple telemetry panel or log, and define a frame-time budget that CI bench checks against.
  - Verification: bench harness reports p95; no regression vs baseline; typecheck.

- [ ] **14. Full control rebinding UI & settings surface**
  - Impact: `controlBindings.ts` + `ControlSettings.tsx` exist but key rebinding is not exposed in-game; audio/controller/settings are incomplete relative to the "1.0.0" label (`CODEBASE_ASSESSMENT.md:139`).
  - Change: expose a settings panel (controls rebind, audio, display, travel) persisted to localStorage; validate bindings and reject collisions.
  - Verification: rebind changes `mapKeyboardKey` output; persisted across reload; typecheck; tests.

- [ ] **15. Tile-cache memory bound for long sessions**
  - Impact: tile-cache traversal ended with ~64MiB backing canvases in the assessment environment; long sessions on mobile may grow unbounded (`CODEBASE_ASSESSMENT.md:131`).
  - Change: add an LRU eviction with a hard byte/count cap to `TileChunkRenderer` / region cache, evicting least-recently-used chunks when over budget.
  - Verification: test cache stays under cap after visiting many regions; typecheck.

- [ ] **16. Guard against `Math.random` / non-determinism in simulation**
  - Impact: determinism relies on `WorldState.nextRandom`; any stray `Math.random` in engine/systems breaks replay/snapshot determinism and seeded tests.
  - Change: grep for `Math.random` in `src/game`; replace with injected PRNG or remove; add a test asserting simulation determinism given identical input.
  - Verification: determinism test passes; no `Math.random` in game simulation; typecheck.

## Tier 4 — Polish, docs, bundle, nice-to-have

- [ ] **17. Docs reconciliation: CHANGELOG says no CI but release-check.yml exists**
  - Impact: stale documentation misleads contributors (`CODEBASE_ASSESSMENT.md:139`).
  - Change: reconcile `CHANGELOG.md`, `README.md`, `ONBOARDING.md` with actual CI/release process; mark historical audit prose as historical.
  - Verification: docs match CI workflow and `package.json` scripts.

- [ ] **18. Bundle size: address Vite chunk-size warning**
  - Impact: main chunk 512.41kB; Vite warns (`CODEBASE_ASSESSMENT.md:129`).
  - Change: code-split `renderer.ts`/region content or lazy-load non-critical assets; keep the warning resolved.
  - Verification: `npm run build` chunk-size warning reduced/absent; typecheck.

- [ ] **19. SQLite simplification evaluation**
  - Impact: SQL.js WASM (658kB) + localStorage export for three JSON snapshots adds startup/migration machinery without relational need (`CODEBASE_ASSESSMENT.md:137`).
  - Change: evaluate replacing with IndexedDB/localStorage JSON; only if save ownership semantics stay correct. Otherwise document why SQLite stays.
  - Verification: decision recorded; if implemented, save tests still pass.

- [ ] **20. "Discard unsaved changes" warning on close/reload**
  - Impact: closing mid-run loses unsaved progress silently beyond the 10s interval.
  - Change: `beforeunload` warning when a run has unsaved progress since last checkpoint; desktop host honors `eldrinthCheckpoint`.
  - Verification: warning set when dirty, cleared after save; typecheck.

- [ ] **21. Coverage tests for uncovered engine branches**
  - Impact: several dialogue/NPC/warden branches lack direct unit coverage.
  - Change: add targeted tests for `chooseDialogue` branches, warden styles, harvest cost curve edge cases (shard 1 vs 9), and `restoreHarvestedShards` ambiguous-save rejection.
  - Verification: new tests pass; coverage stable or improved; typecheck.

- [ ] **22. Import into occupied slot + replace-slot flow**
  - Impact: `importBackup` only targets empty slots; no way to replace an existing record from a backup file.
  - Change: add explicit overwrite confirmation and revision recheck for importing into an occupied slot.
  - Verification: test import into empty and occupied slots; typecheck.

- [ ] **23. Controller deadzone / gamepad tuning**
  - Impact: gamepad support exists (`gamepad.ts`, `pollGamepad`) but no deadzone configuration or tuning; drift can cause unintended movement.
  - Change: add a small deadzone on analog sticks and expose gamepad sensitivity in settings.
  - Verification: gamepad test covers deadzone; typecheck.

- [ ] **24. New Pilgrimage / NG+ seed & vows (roadmap milestone 3)**
  - Impact: explicitly deferred; not required for v1 but the epilogue already feeds it.
  - Change: seed display in journal, optional challenge vows that gate gameplay, completion records. Scope this lightly so it does not destabilize the release.
  - Verification: NG+ run completes; vows apply; typecheck; tests.

---

## How to work this list

1. Pick the top unchecked item.
2. Write or update tests first where behavior is specified.
3. Implement the change following existing conventions (Zustand store, deterministic PRNG, `GameCallbacks` boundary, no comments unless asked).
4. Run `npx tsc --noEmit`, `npm run lint` (once added), `npm test`.
5. Check the item off, then move to the next.
