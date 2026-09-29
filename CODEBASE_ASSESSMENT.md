**ELDRINTH codebase and release-readiness assessment — 28 September 2026**

Assessed commit: `3ef768d98f857c8dd434117832ee76188c99d494`.

**Follow-up implementation:** The six reproduced findings below have now been
addressed in the working tree. Save loading is gated, database writes use cross-tab
locks and slot revisions, legacy identities use recorded evidence, native journal
editing is preserved, and compact/touch layouts have been repaired. Ambiguous
older saves are explicitly rejected without overwriting them. Verification after
the fixes: 246 unit/integration tests, nine production-browser tests, typecheck,
production build, nested-path verification, and four benchmark harnesses passed.
The committed distribution was regenerated. Safe saving requires HTTPS or
localhost and Web Locks support; unsupported browsers leave stored records
untouched. The assessment below documents the original revision, not a claim
that these reproduced defects remain in the fixed code. Full playtesting and
real-device/browser coverage remain outstanding release-validation work.

**Verdict: the project is close to a release candidate, but this revision should not be treated as ready for an unrestricted public 1.0.** The core game and packaging have substantial implementation and regression coverage. Two reproduced save-data-loss defects are sufficient to hold a release. Legacy save migration and the advertised touch experience also need attention. This calls for a focused stabilization pass, not an engine rewrite or implementation of the deferred roadmap.

This assessment combines source review, the existing automated checks, eight Python sprite checks, Chromium browser exercises, and targeted reproductions. Game source and committed build output were not changed. This document is the only repository addition.

**What was verified**

| Check | Result | What the result establishes |
| --- | --- | --- |
| Clean dependency installation, Node 24.14.0 | Passed | The committed npm lockfile installs in this environment. |
| `npm test` | 38 files, 225 tests passed | Existing unit and engine integration regressions remain green. |
| `npm run build` | Passed | Strict TypeScript checking and production bundling succeed. |
| `npm run verify:release` | Passed | Built files are available under a nested static URL. |
| `git diff --exit-code -- dist` after build | Passed | The committed distribution matches the fresh build. |
| `npm audit` | Zero reported vulnerabilities | No advisories were reported for the installed dependency tree at assessment time; this is not a security certification. |
| `npm run bench` | Four harnesses completed | Measurement harnesses execute; they are not performance acceptance tests. |
| All eight `tools/spritegen/*test.py` scripts | Passed | Includes 53 committed atlases and 759 frame hashes. |
| Production build in Chromium at `/eldrinth/` | Passed smoke flow | Content warning, new game, intro skip, engine startup, journal entry, autosave, reload/continue, and pause/resume work on the desktop happy path. |
| Production browser errors | None observed in that flow | No page exceptions or HTTP responses of 400+ during the exercised production flow. |

Node was initially absent from the assessment environment. A temporary Node runtime, isolated browser tooling, and a temporary Python environment were used. Their installation did not alter project dependencies. Browser fault reproductions used the development build where direct access to source modules was useful; the production happy path was exercised separately.

**Reproduced findings, in priority order**

Priority P1 means fix before public release within the supported scenario. P2 means a significant functional issue, including a release gate for platforms explicitly advertised as supported. None of the findings below depends solely on a speculative reading of the code.

1. **P1 — Starting a new game while saves are loading can delete an existing run.**

   Evidence: [App.tsx:32](/var/home/woez/eldrinth/src/App.tsx:32), [App.tsx:53](/var/home/woez/eldrinth/src/App.tsx:53), and [TitleScreen.tsx:29](/var/home/woez/eldrinth/src/components/TitleScreen.tsx:29).

   The shell initially represents the slot list as an empty array. There is no separate loading state. While SQL/WASM initialization is pending, the title screen therefore presents occupied slots as EMPTY and enables Begin New Pilgrimage. Starting immediately queues `slotStore.remove(slot)` against the same database initialization promise.

   Reproduction: create a saved run in slot 1, acknowledge the content warning, open another page with the WASM response held, and click Begin New Pilgrimage while the three slots read EMPTY. Release the response. Listing the database then returns `[]`: the existing slot has been deleted before the new run has even been played.

   Slow storage initialization can turn a normal-looking new-game action into loss of an existing run. Distinguish loading, failed, and loaded slot states; disable slot-dependent actions until loaded; and revalidate the selected empty slot at the storage boundary. An occupied slot should never be removed merely because the UI previously assumed it was empty.

2. **P1 — Two tabs can destroy each other's saves, even in different slots.**

   Evidence: [slots.ts:80](/var/home/woez/eldrinth/src/game/slots.ts:80), [slots.ts:100](/var/home/woez/eldrinth/src/game/slots.ts:100), and [slots.ts:140](/var/home/woez/eldrinth/src/game/slots.ts:140).

   Each page caches its own SQLite database after a single localStorage read. Every mutation exports that entire database into one shared localStorage key. There is no cross-tab synchronization or writer ownership.

   Reproduction: let tabs A and B initialize against an empty database. Save slot 1 in A, then slot 2 in B. A fresh third page sees only slot 2. B's older database has overwritten A's unrelated slot. The same mechanism can roll back progress or resurrect a deleted record.

   Protect the write lifecycle with explicit single-writer ownership or a storage design that safely merges independent slot updates. If retaining whole-database exports, merely listening for storage events is insufficient to make simultaneous read/modify/write operations safe. Cover separate-slot saves, same-slot conflicts, erase/save conflicts, and ownership changes.

3. **P1 for supported legacy saves — Shard migration guesses identities and can block normal progression at eight of nine.**

   Evidence: [WorldState.ts:237](/var/home/woez/eldrinth/src/game/core/WorldState.ts:237), [engine.ts:1023](/var/home/woez/eldrinth/src/game/engine.ts:1023).

   When `harvestedShards` is absent, restoration assigns the first N fortress IDs in object order. The game allows a different collection order, and older snapshots also retain each visited fortress's item state. Count alone cannot identify the harvested vessels.

   Reproduction: harvest only `fortress.starfall-watch`, return to the overworld, save, omit the newer identity field to exercise the supported older-v4 representation, then restore. The migration assumes `fortress.cinderwild-shrine` was harvested instead. Visiting and attempting to collect from all nine fortresses ends at `shards: 8, wardUnlocked: false`. One genuinely uncollected vessel is suppressed, while the originally collected vessel remains empty in its saved regional state.

   This is conditional on loading older snapshots; newly created snapshots with correct identities do not take this branch. The reproduction establishes broken ordinary progression, not that every conceivable recovery is impossible: a death/reset can change regional item state. Recover identities from available intake records and regional evidence, explicitly handle ambiguous saves, and test multiple collection orders. If pre-release saves are deliberately unsupported, make that policy explicit rather than silently accepting an incorrect migration.

4. **P2 — Journal typing loses spaces and arrow-key editing.**

   Evidence: [engine.ts:660](/var/home/woez/eldrinth/src/game/engine.ts:660), [InputSystem.ts:58](/var/home/woez/eldrinth/src/game/systems/InputSystem.ts:58), and [Journal.tsx:175](/var/home/woez/eldrinth/src/components/Journal.tsx:175).

   The global game keydown handler prevents the default action for Space and arrow keys regardless of the focused element or journal state. The shell's guard for editable elements does not protect against this separate engine listener.

   Reproduction in Chromium: open the journal and type `north road` using actual keyboard events. The textarea contains `northroad`. Press ArrowLeft at the end; the caret stays at position 9. Setting the textarea value programmatically or pasting text would miss this failure.

   Exclude editable targets and relevant UI controls from gameplay key handling, and only prevent defaults when gameplay owns that input. Verify normal typing, selection, cursor navigation, Ctrl/Cmd+Enter, and Escape in the mounted application.

5. **P2, mobile release gate — Touch players lose Pause and Journal at widths of 640px and above.**

   Evidence: [VirtualControls.tsx:75](/var/home/woez/eldrinth/src/components/VirtualControls.tsx:75).

   Touch controls are enabled by touch capability, but the container for Pause and Journal has `sm:hidden`. Those buttons disappear at wider viewports while the movement and combat controls remain visible. There are no equivalent clickable controls in the HUD.

   Reproduction with touch emulation: at 390×844 both buttons are visible; at 844×390 and 1024×768 neither is visible, while the movement pad remains visible. This affects the landscape-phone orientation recommended by the README, as well as tablets. Players without a physical keyboard cannot directly open those functions in that orientation.

   Keep these actions available whenever touch controls are active. Test both orientations and tablet widths instead of treating screen width as a proxy for keyboard availability.

6. **P2, mobile release gate — Short viewports clip title actions and overlap gameplay information.**

   Evidence: [TitleScreen.tsx:53](/var/home/woez/eldrinth/src/components/TitleScreen.tsx:53), [HUD.tsx:45](/var/home/woez/eldrinth/src/components/HUD.tsx:45), and [index.css:19](/var/home/woez/eldrinth/src/index.css:19).

   The title uses a vertically centered, tall content column inside an overflow-hidden viewport. The HUD independently positions a wide centered objective panel and fixed-width vitals at the same top edge.

   At 844×390, the title heading starts at y=-133.25 and the new-game button spans y=377.25 to 439.25. Most of that button and its label are below the viewport, with no normal page scrolling. In gameplay at the same size, the objective panel covers the right side of the health display and part of the shard display. These were measured in the DOM and visually checked in screenshots.

   Add height-aware layouts or a scrollable title panel, and allocate explicit non-overlapping HUD space at compact sizes. Safe-area insets and dynamic viewport units are useful existing work, but they do not solve content that cannot fit.

**What the codebase does well**

The separation between the framework-independent game and React presentation is useful and mostly clear. `WorldState` centralizes persistent gameplay state; `GameCallbacks` publishes the UI view; movement, combat, AI, and input have individual modules. Fixed-step simulation with bounded catch-up prevents a long tab stall from becoming a giant simulation delta. The random generator and snapshot design enable deterministic engine tests.

The tests cover meaningful game invariants: collision, combat occlusion, contact damage, region-gate rearming, exploration reachability, quest rewards, permanent shard cost, death resets, dialogue choices, initialization failure, and save-overwrite suppression after a failed restore. These are stronger than a suite made only of rendering snapshots or trivial getters. The previous stabilization work is present and its regression tests pass.

Region generation has a worker boundary and a reference-counted bounded cache. Sprite generation is offline, committed assets have integrity checks, and rendering limits its tile cache rather than retaining every visited tile indefinitely. The static deployment model avoids account and backend dependencies. Relative asset URLs and a current committed build are verified, and CI now enforces the documented release command sequence.

The implemented content is substantial for a compact game: four frontier regions, nine authored fortress interiors, settlements, four investigations, eight town requests, and three ending IDs with run-dependent epilogue text. The deferred equipment system, elite behaviours, authored activity sites, and New Pilgrimage features are explicitly outside the shipped scope. Their absence is not itself a release defect for the current v1 definition.

**Where confidence is weaker than the green tests suggest**

There is no committed real-browser end-to-end test layer in the release workflow. The component tests use hand-built DOM substitutes; they are useful for lifecycle checks but cannot establish responsive layout, native text editing, focus behaviour, or actual touch interaction. The source-level engine tests similarly cannot establish that the assembled application routes inputs correctly. The journal and touch findings demonstrate this gap directly.

The test named “harvests all nine shards … and beats the Unbound” teleports to each shard, directly opens the final dialogue, and sets `boss.dying = 0.01` ([winPath.test.ts:54](/var/home/woez/eldrinth/src/game/winPath.test.ts:54)). It establishes that progression state and ending callbacks connect. It does not establish navigational clarity, ordinary combat completion, boss fairness, or a human-playable difficulty curve. Separate reachability tests provide useful complementary evidence, but neither replaces a full playthrough.

The release-verification script fetches files and checks their existence and nonempty responses ([verify-release.mjs:43](/var/home/woez/eldrinth/tools/verify-release.mjs:43)); it does not execute the application. The production browser smoke flow in this assessment adds evidence for the current revision, but is not yet a repeatable CI gate.

Save validation remains shallow: many numeric fields, journal structures, quest structures, and cross-field invariants are trusted after JSON parsing. Previously fixed fatal-restore handling protects against one class of overwrites, which is valuable. It does not make every accepted snapshot valid. Maintain representative saved fixtures and explicitly define supported world versions and migration invariants.

Fault recovery is uneven. Engine-loop errors and initialization failures reach visible recovery screens. Region-transition failures are logged without equivalent player feedback, and the transition mutates state before all later setup has succeeded ([engine.ts:448](/var/home/woez/eldrinth/src/game/engine.ts:448)). Atlas failures resolve their preload promise and remain cached as unsuccessful loads ([spriteAtlas.ts:119](/var/home/woez/eldrinth/src/game/render/spriteAtlas.ts:119)). These are source-reviewed resilience concerns, not additional reproduced P1 findings. Exercise worker failure, image failure, retries, and failed respawns before promising robust network recovery.

Accessibility work includes dialog semantics, focus management for several overlays, live messages, selectable journal prose, and CSS reduced-motion handling. Those are worthwhile foundations. The confirmed keyboard and layout defects prevent treating the interface as accessibility-validated. No screen-reader audit or contrast certification was performed. Canvas screen shake also remains separate from CSS reduced-motion rules.

**Performance and maintenance assessment**

The distribution is about 2.8 MiB on disk. The main JavaScript chunk is 512.41 kB, 160.06 kB gzip; CSS is 75.88 kB, 13.49 kB gzip; SQLite WASM is 658.41 kB. Vite reports the main chunk-size warning. This is a manageable optimization concern rather than evidence of a broken release.

The save harness measured approximately 0.129 ms for a world snapshot and 2.721 ms for a slot save in this environment, with about 92.8 kB in the localStorage value for its sample. The tile-cache traversal ended with 32 chunks and an estimated 64 MiB of backing canvases. These measurements support the existing resource limits, but do not establish whole-browser peak memory or slower-device latency.

A three-second production browser sample near the starting area produced roughly 60 frames per second, with p95 frame intervals around 16.8 ms in the first sample. That is only a light-load headless Chromium observation. The headless render benchmark replaces drawing operations with stubs, so its very small render timings must not be represented as actual GPU/render cost. Boss fights, rapid region transitions, long sessions, mobile thermal limits, and Safari remain unmeasured here.

Maintainability is mixed, not poor overall. Strong typing, explicit systems, deterministic state, a lockfile, and useful tests make focused fixes practical. However, `engine.ts` is 2,124 lines, `renderer.ts` 2,307, and `map.ts` 1,386. The engine contains substantial authored dialogue and NPC lore alongside simulation and lifecycle code; changes often require understanding several unrelated responsibilities. Public mutable fields and test calls to private methods also make invariants easier to bypass. Extract content data and focused lifecycle responsibilities incrementally after release-critical fixes. Avoid a large restructuring merely to meet file-size preferences.

SQLite for three JSON snapshots adds startup and migration machinery without an obvious need for relational queries. It is a reasonable future simplification target. The immediate requirement is correct save ownership and loading semantics; switching persistence technologies alone would not automatically fix those behaviours. The dependency footprint is small and the current advisory check is clean. There is no lint script, but adding lint is lower priority than browser regressions and save-data protection.

Documentation needs a small reconciliation pass. In particular, [CHANGELOG.md:95](/var/home/woez/eldrinth/CHANGELOG.md:95) says there is no CI, while `.github/workflows/release-check.yml` is present and the README describes it. Prior audit prose should be treated as historical evidence, not an up-to-date release certificate. Audio, controller support, key rebinding, and a broader settings surface are not implemented in the inspected runtime; decide whether they belong in the product promise rather than implicitly assuming them from the “1.0.0” version label.

**Recommended release exit criteria**

1. Close both save-data-loss paths and add regressions that mount the actual application or exercise independent storage clients. Include delayed initialization, two tabs, different slots, deletion, and storage write failure.
2. Correct legacy identity migration or explicitly narrow compatibility, backed by fixtures and multiple shard collection orders. Preserve the original save if recovery cannot be justified.
3. Fix journal input ownership and verify typing with real keyboard events, not only programmatic textarea values.
4. If mobile remains advertised, fix touch action availability and compact layouts, then check phones in both orientations and tablets. Repeat in Safari/iOS as well as Chromium.
5. Put a production-browser smoke flow in CI: nested-path startup, new game, dialogue, journal typing, save/reload/continue, pause, restart, and at least one region transition. Keep the existing fast deterministic tests.
6. Conduct ordinary-play completion testing across the offered difficulties, including a minimally investigated run, a fully investigated run, death/retry, and saves during travel. Record the devices, browser versions, outcomes, and observed performance.

The scope of this assessment does not include a full human playthrough, real mobile hardware, Firefox/WebKit execution, an itch.io iframe deployment, long-duration GPU profiling, or formal accessibility evaluation. Browser emulation validates layout and event behaviour, not physical-device performance. Art-source rights were not independently audited. These limits matter when moving from “the code builds and runs” to “the advertised player experience is ready.”
