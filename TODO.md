# ELDRINTH — Comprehensive Improvement Backlog

Autonomously generated and prioritized improvement list. Ordered from **most negatively affecting the app** (critical data loss, crashes, major UX failures) to **barely a concern** (cosmetic, documentation, nice-to-have). Each item is discrete, testable, and actionable.

**Total: 36 improvements** across 7 tiers.

---

## Tier 0 — CRITICAL: Data Loss & Corruption (Must Fix First)

These defects can cause permanent loss of player progress or silent data corruption.

### 0.1. Deep snapshot validation for all loaded saves
**Impact:** CRITICAL — Corrupt snapshots can crash `WorldState.restore`, causing run loss with no recovery path.
**Problem:** Current validation in `snapshotValidation.ts` may not cover all cross-field invariants (e.g., harvestedShards consistency with fortress states, item IDs referencing valid items).
**Solution:** 
- Expand `validateWorldSnapshot` to validate: numeric ranges for all player/enemy/projectile fields, required array lengths, region IDs against known regions, harvestedShards ≤ 9 and ≤ total shards, fortress state consistency with harvestedShards, item validity, quest progress consistency
- Add validation for player position (must be walkable tile)
- Run validation in `slots.load()` BEFORE accepting any record
- Invalid records return `null` ("could not be read"), preserving original data
- Reuse validator for `importBackup` via `parseBackup`
**Verification:** Unit tests for valid v1-v4 snapshots, truncated/corrupt snapshots, wrong types, harvestedShards count mismatch, out-of-range numbers, invalid positions, cross-field inconsistencies; typecheck; `npm test`

### 0.2. Cross-tab save conflict resolution with revision tokens
**Impact:** CRITICAL — Two tabs can overwrite each other's saves silently (reproduced in CODEBASE_ASSESSMENT.md finding #2).
**Problem:** Each tab caches its own SQLite DB after single localStorage read. Every mutation exports entire DB to one shared key. No cross-tab synchronization.
**Solution:**
- Implement per-slot revision tokens (already partially in schema v2)
- Use Web Locks API to serialize writes between tabs
- Reject stale writes (revision mismatch)
- Reject writes when latest stored DB cannot be read
- Add explicit single-writer ownership semantics
- Test: separate-slot saves, same-slot conflicts, erase/save conflicts, ownership changes
**Verification:** Test with multiple tabs, concurrent saves, offline/online transitions; verify no data loss; typecheck

### 0.3. Legacy shard identity migration robustness
**Impact:** CRITICAL — Legacy saves can have incorrect shard identities, blocking progression at 8/9 (CODEBASE_ASSESSMENT.md finding #3).
**Problem:** When `harvestedShards` is absent, restoration assigns first N fortress IDs in object order, but collection order can differ.
**Solution:**
- Recover identities from available intake records and regional evidence
- Explicitly handle ambiguous saves (multiple possible identities)
- Preserve original save if recovery cannot be justified
- Add comprehensive test coverage for multiple collection orders
- Document supported save versions and migration invariants
**Verification:** Tests for all 9! collection orders, ambiguous save rejection, correct identity recovery; typecheck

### 0.4. Region transition failure recovery
**Impact:** CRITICAL — `performRegionChange` stops loop and calls `onFatal` on worker/load error, leaving frozen frame with only reload/title options (CODEBASE_ASSESSMENT.md).
**Problem:** No retry mechanism for transient failures.
**Solution:**
- Add bounded exponential backoff retry for region acquisition
- On exhaustion, surface recoverable error screen with "Retry region" / "Return to title"
- Preserve `discardCurrentRegion` semantics
- Don't mutate state until all setup has succeeded
**Verification:** Simulate worker failure via aborting `RegionSource`, assert retry attempts and recovery; test region cache failures; typecheck

---

## Tier 1 — HIGH: Functional Issues Affecting Core Gameplay

### 1.1. Journal typing loses spaces and arrow-key editing
**Impact:** HIGH — Players cannot type normally in journal (CODEBASE_ASSESSMENT.md finding #4).
**Problem:** Global game keydown handler prevents default for Space and arrow keys regardless of focused element.
**Solution:**
- Exclude editable targets (textarea, input) from gameplay key handling
- Only prevent defaults when gameplay owns that input
- Ensure native spaces, arrow-key editing work correctly
**Verification:** Test normal typing, selection, cursor navigation, Ctrl/Cmd+Enter, Escape in mounted application; Playwright tests with real keyboard events

### 1.2. Touch Pause/Journal unavailable at wider viewports
**Impact:** HIGH — Touch players lose Pause and Journal at 640px+ widths (CODEBASE_ASSESSMENT.md finding #5).
**Problem:** `VirtualControls.tsx:75` hides Pause/Journal container at `sm:` breakpoints while movement/combat remain visible.
**Solution:**
- Keep Journal/Pause shortcuts visible whenever touch controls are active
- Independent of viewport width
- Test both orientations (portrait/landscape) and tablet widths
**Verification:** Playwright tests at 390x844, 844x390, 1024x768 with touch emulation; both buttons reachable in all cases

### 1.3. Short viewports clip title actions and overlap HUD
**Impact:** HIGH — At 844x390, title button is below viewport, HUD objective panel overlaps health/shards (CODEBASE_ASSESSMENT.md finding #6).
**Problem:** Title uses vertically centered tall column in overflow-hidden viewport. HUD positions independently.
**Solution:**
- Make title panel scrollable/height-aware
- Allocate explicit non-overlapping HUD zones at compact sizes
- Honor safe-area insets and dynamic viewport units
- Add CSS container queries for responsive layout
**Verification:** Playwright screenshots/DOM measurements at 844x390; no clipped primary actions, no HUD overlap

### 1.4. Autosave checkpoint coalescing
**Impact:** HIGH — `backgroundCheckpoint` runs every 10s and on tab-hide; rapid toggles can fire duplicate saves back-to-back.
**Problem:** Thrashes localStorage and cross-tab lock.
**Solution:**
- Debounce/throttle checkpoints so at most one save is in flight
- Repeats within short window coalesce
- Keep visibilitychange save but only if enough time passed since last successful checkpoint
**Verification:** Fake timers + `slotStore.save` spy; assert no duplicate saves within coalescing window; typecheck

---

## Tier 2 — MEDIUM: Significant Functional Issues

### 2.1. Respect reduced-motion for canvas screen shake
**Impact:** MEDIUM — Canvas shake separate from CSS `prefers-reduced-motion` (CODEBASE_ASSESSMENT.md:125).
**Problem:** Motion-sensitive players get shake regardless of preference.
**Solution:**
- Gate `Game.shake()` and shake magnitude on reduced-motion preference from store
- When off, substitute subtle flash or nothing
- Persist preference in display settings
**Verification:** Test shake no-op under reduced-motion; verify persistence; typecheck

### 2.2. Screen reader accessibility audit
**Impact:** MEDIUM — No screen-reader audit or contrast certification (CODEBASE_ASSESSMENT.md:125).
**Problem:** Only canvas has `aria-label`; focus management incomplete.
**Solution:**
- Add meaningful `aria-label`s/roles to canvas, HUD vitals, journal, pause, dialogue
- Ensure focus never traps (test with keyboard-only navigation)
- Verify contrast-critical text meets AA where feasible
- Add `aria-live` regions for dynamic content (health changes, dialogue)
**Verification:** axe-lite checks in Playwright; manual keyboard navigation test; contrast ratio checks

### 2.3. Gamepad deadzone and sensitivity settings
**Impact:** MEDIUM — Gamepad support exists but no deadzone configuration; drift causes unintended movement.
**Problem:** Analog sticks have no deadzone; no sensitivity adjustment.
**Solution:**
- Add configurable deadzone (default ~0.1-0.2)
- Expose gamepad sensitivity in settings
- Add deadzone visualization/test in settings UI
**Verification:** Gamepad test covers deadzone; verify no drift movement; typecheck

### 2.4. Controller input conflict with keyboard
**Impact:** MEDIUM — Simultaneous keyboard and gamepad inputs can cause conflicts.
**Problem:** No prioritization or conflict resolution between input sources.
**Solution:**
- Define input priority (keyboard > gamepad or configurable)
- Add input source indicator in HUD
- Allow disabling specific input sources
**Verification:** Test mixed input scenarios; verify priority works; typecheck

---

## Tier 3 — MODERATE: Maintainability & Code Health

### 3.1. Extract authored content from engine.ts
**Impact:** MODERATE — `engine.ts` is 2326 lines mixing simulation, lifecycle, dialogue, NPC lore, town content (CODEBASE_ASSESSMENT.md:135).
**Problem:** Changes require understanding unrelated responsibilities.
**Solution:**
- Move `ORITHEL_LINES`, `townHealerEntry`, `townScoutEntry`, `townLoreEntry`, `townFortressLore` to `src/game/content/` modules
- Move dialogue-line tables to separate content files
- Engine imports content, doesn't own it
- No behavior change
**Verification:** Behavior tests unchanged pass; typecheck; line-count reduced; imports work correctly

### 3.2. Add comprehensive linting with ESLint
**Impact:** MODERATE — No lint exists currently (CODEBASE_ASSESSMENT.md:24).
**Problem:** Style issues, obvious bugs only caught by review/tests.
**Solution:**
- Add ESLint config (TypeScript + React recommended)
- Add `lint` script to package.json
- Add lint to CI gate in release-check.yml
- Fix all existing lint errors
- Configure prettier if not present for consistent formatting
**Verification:** `npm run lint` exits 0; CI workflow passes; no new lint errors introduced

### 3.3. Tile-cache memory bound for long sessions
**Impact:** MODERATE — Tile-cache traversal ended with ~64MiB; long sessions on mobile may grow unbounded (CODEBASE_ASSESSMENT.md:131).
**Problem:** No explicit eviction policy.
**Solution:**
- Add LRU eviction with hard byte/count cap to `TileChunkRenderer`
- Evict least-recently-used chunks when over budget
- Add memory usage telemetry in dev builds
**Verification:** Test cache stays under cap after visiting many regions; memory measurements in benchmarks; typecheck

### 3.4. Eliminate Math.random from simulation
**Impact:** MODERATE — Determinism relies on `WorldState.nextRandom`; stray `Math.random` breaks replay/snapshot determinism (CODEBASE_ASSESSMENT.md:131).
**Problem:** Any `Math.random` call in engine/systems breaks deterministic tests and save/load consistency.
**Solution:**
- Grep for all `Math.random` in `src/game`
- Replace with injected PRNG from WorldState
- Add determinism test: identical input → identical output for N simulation steps
**Verification:** Determinism test passes; no `Math.random` in game simulation; typecheck

### 3.5. Per-slot save metadata and statistics
**Impact:** MODERATE — Players want to know when saves were created, how much progress, difficulty.
**Problem:** SaveSlot interface has minimal metadata.
**Solution:**
- Add to SaveSlot: createdAt, totalPlaytime, lastRegion, shardsCollected, difficulty
- Display in slot selection UI
- Persist across saves
**Verification:** Metadata displayed correctly; persists across reloads; typecheck

---

## Tier 4 — POLISH: User Experience Enhancements

### 4.1. Persist audio preferences (volume, soundscape toggles)
**Impact:** LOW — Audio preferences not persisted (CODEBASE_ASSESSMENT.md).
**Problem:** `autoPause`/`screenShake` persist, but soundscape volume/mute and audio toggles are not.
**Solution:**
- Add persisted audio preferences (master/sfx/music volume, soundscape on/off)
- Extend `readDisplayPreferences`/`saveDisplayPreferences` or create dedicated audio store
- Wire into `useSoundscape`
- Add audio settings panel to pause menu
**Verification:** Preferences round-trip; audio muted when off; persists across sessions; typecheck

### 4.2. "Discard unsaved changes" warning on close/reload
**Impact:** LOW — Closing mid-run loses unsaved progress silently beyond 10s interval.
**Problem:** No confirmation before losing unsaved work.
**Solution:**
- Add `beforeunload` warning when run has unsaved progress since last checkpoint
- Desktop: honor `eldrinthCheckpoint` flag
- Track dirty state in App component
- Clear warning after successful save
**Verification:** Warning set when dirty, cleared after save; test with window.close(); typecheck

### 4.3. Height-aware responsive layouts throughout
**Impact:** LOW — Various components have fixed heights that may not work on all devices.
**Problem:** Title screen, HUD, dialogue boxes may clip on small screens.
**Solution:**
- Audit all fixed-height containers
- Replace with viewport-relative or flexible layouts
- Add safe-area insets for notched devices
- Test on multiple screen sizes
**Verification:** Playwright screenshots at various viewport sizes; no clipping; typecheck

### 4.4. Import into occupied slot with overwrite confirmation
**Impact:** LOW — `importBackup` only targets empty slots; no way to replace existing record (TODO.md item 22).
**Problem:** Players cannot import into occupied slot.
**Solution:**
- Add explicit overwrite confirmation for importing into occupied slot
- Add revision recheck for import into occupied slot
- Preserve backup of replaced save with timestamp
**Verification:** Test import into empty and occupied slots; verify confirmation UI; typecheck

### 4.5. Full control rebinding UI
**Impact:** LOW — Key rebinding exists but not fully exposed in-game (CODEBASE_ASSESSMENT.md:139).
**Problem:** `controlBindings.ts` + `ControlSettings.tsx` exist but UI incomplete.
**Solution:**
- Expose full control rebinding UI in pause menu
- Validate bindings and reject collisions
- Add visual feedback during rebinding
- Allow reset to defaults
**Verification:** Rebinding changes `mapKeyboardKey` output; persisted across reload; collision detection works; typecheck

---

## Tier 5 — PERFORMANCE: Optimization & Telemetry

### 5.1. Frame-time / performance telemetry and budget
**Impact:** LOW — Performance observed only in 3s headless sample; boss fights, mobile, Safari unmeasured (CODEBASE_ASSESSMENT.md:133).
**Problem:** No ongoing performance monitoring.
**Solution:**
- Instrument frame intervals (p95/p99) in dev/bench builds
- Expose simple telemetry panel or log
- Define frame-time budget (e.g., 16.67ms for 60fps)
- Add CI bench check against baseline
**Verification:** Bench harness reports p95; no regression vs baseline; typecheck

### 5.2. Bundle size optimization
**Impact:** LOW — Main chunk 512.41kB; Vite warns (CODEBASE_ASSESSMENT.md:129).
**Problem:** Large bundle affects load time, especially on mobile.
**Solution:**
- Code-split `renderer.ts` and region content
- Lazy-load non-critical assets
- Analyze bundle with `npm run build -- --analyze`
- Identify and optimize largest dependencies
**Verification:** `npm run build` chunk-size warning reduced/absent; bundle analyzer shows improvements; typecheck

### 5.3. SQLite simplification evaluation
**Impact:** LOW — SQL.js WASM (658kB) + localStorage export for 3 JSON snapshots adds complexity (CODEBASE_ASSESSMENT.md:137).
**Problem:** SQLite overhead for simple JSON storage.
**Solution:**
- Evaluate replacing with IndexedDB/localStorage JSON
- Document decision: if SQLite stays, document why (atomic writes, transactions)
- If migrating, ensure save ownership semantics preserved
**Verification:** Decision recorded in ADR; if implemented, save tests pass; typecheck

### 5.4. Region preloading and caching strategy
**Impact:** LOW — Region transitions may have visible load times.
**Problem:** Regions loaded on-demand with no preloading.
**Solution:**
- Implement region preloading for adjacent regions
- Add caching strategy based on player position
- Preload during gameplay when resources available
**Verification:** Measure region load times; verify preloading works; typecheck

---

## Tier 6 — TESTING: Coverage & Reliability

### 6.1. Production-browser E2E smoke flow in CI
**Impact:** LOW — Release verification fetches files only; browser smoke flow manual (CODEBASE_ASSESSMENT.md:119).
**Problem:** Layout, focus, touch, journal typing regressions escape CI.
**Solution:**
- Add Playwright smoke specs covering: nested-path startup, new game, dialogue advance, journal typing with real keys, save/reload/continue, pause, one region transition
- Gate CI on them running against production build at `/eldrinth/`
- Add tests for mobile viewports and touch emulation
**Verification:** Specs pass in headless Chromium; CI workflow references them; all browser tests green

### 6.2. Shell-level automated tests for App/slot actions
**Impact:** LOW — `App` has no test harness; slot ready/busy/error states untested (TODO.md item 6).
**Problem:** Slot lifecycle and error handling not covered.
**Solution:**
- Add React Testing Library suite for `App`
- Mock `slotStore`, `GameCanvas`, stores
- Cover: slots not ready disables Begin, loading→loaded transition, new game rechecks DB before preparing, erase/export/import, error display, `onReady` closing journal
**Verification:** New tests pass; `npm test` green; typecheck

### 6.3. Coverage for uncovered engine branches
**Impact:** LOW — Several dialogue/NPC/warden branches lack direct unit coverage (CODEBASE_ASSESSMENT.md).
**Problem:** Incomplete test coverage for game logic.
**Solution:**
- Add targeted tests for `chooseDialogue` branches
- Test warden styles and behaviors
- Test harvest cost curve edge cases (shard 1 vs 9)
- Test `restoreHarvestedShards` ambiguous-save rejection
**Verification:** New tests pass; coverage improved; typecheck

### 6.4. Mobile device and browser matrix testing
**Impact:** LOW — No formal mobile/other browser testing.
**Problem:** iOS/Safari, Firefox, various Android devices untested.
**Solution:**
- Set up BrowserStack/Sauce Labs or similar (optional, documented)
- Add Playwright tests for Firefox and WebKit
- Document manual testing requirements
- Add device/browser compatibility matrix
**Verification:** Tests pass in multiple browsers; compatibility documented

---

## Tier 7 — DOCUMENTATION & NICE-TO-HAVE

### 7.1. Docs reconciliation
**Impact:** VERY LOW — CHANGELOG says no CI but release-check.yml exists (CODEBASE_ASSESSMENT.md:139).
**Problem:** Stale documentation misleads contributors.
**Solution:**
- Reconcile `CHANGELOG.md`, `README.md`, `ONBOARDING.md` with actual CI/release process
- Mark historical audit prose as historical
- Add ADR (Architecture Decision Record) for major design decisions
- Document release process clearly
**Verification:** Docs match CI workflow and package.json scripts; no contradictions

### 7.2. Contribution guidelines update
**Impact:** VERY LOW — ONBOARDING.md may be outdated.
**Problem:** Architecture, conventions may have changed.
**Solution:**
- Update ONBOARDING.md with current architecture
- Add how-to recipes for adding regions, fortresses, quests, tile types
- Document testing requirements
- Add code review checklist
**Verification:** ONBOARDING.md accurate and complete

### 7.3. Performance profiling guide
**Impact:** VERY LOW — No guidance for performance analysis.
**Problem:** Contributors don't know how to profile.
**Solution:**
- Document profiling setup and tools
- Add performance budget documentation
- Document common performance pitfalls
- Add profiling to development workflow
**Verification:** Documentation added and accurate

### 7.4. Localization/i18n foundation
**Impact:** VERY LOW — Game is English-only.
**Problem:** No infrastructure for translation.
**Solution:**
- Add i18n library (react-i18next or similar)
- Extract all strings to JSON files
- Document translation process
- Add language selector (optional)
**Verification:** Strings extracted; i18n infrastructure in place; typecheck

---

## Implementation Order

**DO NOT skip ahead.** Work items in numerical order (0.1, 0.2, 0.3, ..., 7.4).

Each item requires:
1. **Tests first** — Write or update tests that specify desired behavior
2. **Implementation** — Follow existing conventions
3. **Verification** — Run:
   - `npx tsc --noEmit` (typecheck)
   - `npm run lint` (once ESLint added)
   - `npm test` (all tests pass)
   - Manual testing where applicable
4. **Check off** — Mark item complete in this file

---

## Tracking

- [ ] 0.1 Deep snapshot validation for all loaded saves
- [ ] 0.2 Cross-tab save conflict resolution with revision tokens
- [ ] 0.3 Legacy shard identity migration robustness
- [ ] 0.4 Region transition failure recovery
- [ ] 1.1 Journal typing loses spaces and arrow-key editing
- [ ] 1.2 Touch Pause/Journal unavailable at wider viewports
- [ ] 1.3 Short viewports clip title actions and overlap HUD
- [ ] 1.4 Autosave checkpoint coalescing
- [ ] 2.1 Respect reduced-motion for canvas screen shake
- [ ] 2.2 Screen reader accessibility audit
- [ ] 2.3 Gamepad deadzone and sensitivity settings
- [ ] 2.4 Controller input conflict with keyboard
- [ ] 3.1 Extract authored content from engine.ts
- [ ] 3.2 Add comprehensive linting with ESLint
- [ ] 3.3 Tile-cache memory bound for long sessions
- [ ] 3.4 Eliminate Math.random from simulation
- [ ] 3.5 Per-slot save metadata and statistics
- [ ] 4.1 Persist audio preferences (volume, soundscape toggles)
- [ ] 4.2 "Discard unsaved changes" warning on close/reload
- [ ] 4.3 Height-aware responsive layouts throughout
- [ ] 4.4 Import into occupied slot with overwrite confirmation
- [ ] 4.5 Full control rebinding UI
- [ ] 5.1 Frame-time / performance telemetry and budget
- [ ] 5.2 Bundle size optimization
- [ ] 5.3 SQLite simplification evaluation
- [ ] 5.4 Region preloading and caching strategy
- [ ] 6.1 Production-browser E2E smoke flow in CI
- [ ] 6.2 Shell-level automated tests for App/slot actions
- [ ] 6.3 Coverage for uncovered engine branches
- [ ] 6.4 Mobile device and browser matrix testing
- [ ] 7.1 Docs reconciliation
- [ ] 7.2 Contribution guidelines update
- [ ] 7.3 Performance profiling guide
- [ ] 7.4 Localization/i18n foundation

---

## Notes

- Items marked with (x) in the original TODO.md have been completed
- Reference: CODEBASE_ASSESSMENT.md, original TODO.md, CHANGELOG.md
- Prioritization based on: data loss risk > functional correctness > UX > maintainability > performance > documentation
