# Changelog

All notable changes to ELDRINTH: The Unbound Spire.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
semantic versioning.

## [1.3.0] — 2026-10-27 — The Wayfarer’s Kit

### Added — Mastery and portability

- Distinct tactics for regional elite sentinels and fortress wardens: locked
  charges in the Old Lands, ember rings in Cinderwild, three-bolt fans on the
  Moonlit Coast, and orbiting crossfire in Starfall Moors. Directional warning
  lanes and labels show the upcoming attack; the field guide explains counters.
- Pause → Controls remaps movement, combat, equipment, journal, and atlas keys.
  Conflicting keys exchange bindings; fixed navigation and dialogue shortcuts
  remain available. Preferences persist with clear feedback if saving fails.
- Standard-mapping gamepads support movement, combat, interaction, lantern,
  weapon switching, and pause/resume, with a stick deadzone and edge-triggered
  actions. Menus and dialogue choices use keyboard or mouse.
- Export individual pilgrimages as JSON on the title screen and import into
  an empty slot to transfer between browser and desktop. Imports validate file
  size, structure, supported regions, and compatibility before writing, retain
  cross-tab locking, and never replace an occupied record.
- Erasing a slot now requires confirmation and offers an export reminder.

### Desktop release

- Standalone 1.3.0 Debian package, software-center metadata, and a manual page.
- Restore window size, position, maximized and fullscreen preferences. Bounds
  are kept visible after monitor changes; invalid preferences fall back safely.
- A native recovery dialog can reload after a renderer crash. Closing has a
  bounded checkpoint wait and keeps the game open if saving fails.
- Package verification checks release metadata, runtime helper permissions,
  application assets, licenses, AppStream version, manual, and archive checksums.


### Added — The Wayfarer’s Kit

- A discovery-based local atlas on `M`, saved surveys, searchable landmark
  categories, destination pins, compass bearings, and sanctuary/return-point status.
- An illustrated field guide, journal progress and status filters, record sorting,
  clipboard/text export, and clearer personal-note feedback.
- Loadout statistics, non-mutating relic comparisons, and an acquired-relic filter.
- Manual checkpoints, save timestamps, journey statistics, and next-vessel health
  forecasts in the pause menu.
- Persisted focus-loss pausing, high contrast, ambient-overlay and camera-shake
  switches, fullscreen controls, and comfort-setting reset.
- 24 deterministic field-kit images generated from `shed-dev-sprites`, with
  recipes, checksums, source attribution, license, and an offline verification tool.
- [Full inventory of 41 improvements](docs/wayfarers-kit.md).

### Added — The Lamplighter's Margin

- A carried lantern on `R` and a touch-accessible HUD button. Raising it reveals
  nearby concealed writing with clear line of sight and widens personal light in
  dark interiors. The lamp needs no fuel, stamina, unlock or save migration.
- Four optional brass-plate accounts across the Old Lands, Cinderwild, Moonlit
  Coast and Starfall Moors. Existing road notices give directions; reading with
  `E` preserves each account once in the journal's Lamplight category.
- Seven deterministic equipment/lantern icons generated from `shed-dev-sprites`,
  with source revision, recipes and hashes; existing world atlases are preserved.

### Fixed

- Interaction prompts and `E` now select the same nearest eligible inhabitant,
  doorway, wayfire or note. The old prompt could advertise resting while the
  action opened a nearby door, or miss an inhabitant inside interaction range.
- Lantern inputs during pause, dialogue or journal reading cannot become delayed
  toggles after returning to play. Cold loads shutter the lantern without losing
  copied writing.

## [1.2.0] — 2026-10-08 — Names in the Fire

### Added

- Nine named encounters at Anima vessels. Press `E` to hear the person inside
  and see the exact permanent maximum-health cost before choosing to carry them.
  Leaving a vessel keeps it available for a later visit.
- Nine personal memories heard beside wayfires, saved in the journal's new
  Voices section and reflected in the epilogue. The pause menu's Names section
  shows the people carried and the memories heard, including on existing saves.
- Last Breath: a directional parry on `F` and a touch Parry button. The
  0.24-second guard costs 18 stamina and has a 0.9-second cooldown; a successful
  parry returns 12 stamina and grants +2 damage to the next strike within two
  seconds. The HUD shows guard and riposte readiness.
- Offline procedural regional soundscapes and combat cues, with saved volume
  and mute preferences.
- A refreshed title, regional atmosphere and lights that accompany the people
  the pilgrim carries.

### Fixed

- Fortress lantern light now reveals the player and nearby terrain instead of
  erasing the rendered scene, keeping exploration and combat visible.

### Desktop

- Upgrade the standalone Debian release to 1.2.0. Existing desktop profiles,
  slots, equipment and display preferences remain available after reinstalling.

## [1.1.0] — 2026-10-08

- Keep visible terrain cached at wide camera settings to avoid rebuilding tile
  canvases every frame. Restore older saves safely when newly authored terrain
  occupies a player's or enemy's previous position.
- Keep equipment and resume keys locked while Save & Return waits for storage,
  so a late input cannot discard changes made after the checkpoint was captured.

### Added

- Two combat tools: the fast Wayblade and the heavier, stamina-consuming
  Gravehammer. Switch tools with `Q` or open the loadout with `I`.
- Three relic slots with optional effects and tradeoffs for Emberheart,
  Ashstep, Tidewell and Starblade. Older saves retain all earned permanent
  bonuses and can attune their previously collected relics.
- Four optional regional expeditions: the Hollow of the Uncounted, Ashglass
  Causeway, the Drowned Court and the Listening Ring. Directions and discoveries
  are recorded through the world and journal; completed rewards cannot be farmed.
- A closer camera, starting at 150% zoom, with a 100%–200% display preference.
  Add larger dialogue and journal text and a quiet interface with reduced motion.
- Journal search and a Save & Return to Title action that waits for the current
  checkpoint and keeps the run open if saving fails.

### Desktop

- Detect Wayland-only desktops in the launcher, so the game starts without
  requiring an XWayland display. Match this behavior in package smoke tests.
- Include release notes with the installed package. Preserve existing desktop
  profiles and saves during the upgrade from 1.0.1.
- Exercise combat-tool and camera-preference persistence through native window
  close/reopen, and journal persistence through Save & Return to Title.

## [1.0.1] — 2026-10-04

- Add a standalone offline Linux desktop release with a bundled Electron
  runtime, Debian package, desktop menu entry, icon, checksums and package checks.
  The release workflow builds, installs and tests the package and uploads it
  as a downloadable artifact.
- Wait for the final checkpoint before closing the desktop window. Failed saves
  keep the window open unless the player chooses to quit without saving.
- Roll back failed SQLite mutations and revision ownership. A failed save or
  erase now rejects the operation, preserves the visible record and can be retried.
  Writes are refused when the latest stored database cannot be read.
- Wait for region transitions before autosaving, so a death respawn cannot save
  a revived player in the old fortress. Report failed region loads through the
  recovery screen and protect the last successful save.
- Align the development Node requirement with the locked test runner and desktop
  tooling; Node 24 LTS is recommended.

- Wait for save records before enabling new-game or continue actions. Starting
  a pilgrimage rechecks that the slot is empty and never deletes an occupied record.
- Serialize SQLite writes between tabs and check per-slot revisions. Unrelated
  slots survive concurrent saves; stale saves and stale erase requests are rejected.
  Database schema 2 adds revision tokens and migrates existing schema-1 records.
  Safe persistence requires HTTPS or localhost and browser Web Locks support.
- Recover legacy shard identities from intake and regional records, including
  arbitrary collection orders. Preserve ambiguous saves with a visible error.
- Keep native spaces, arrow-key editing, and button activation out of game input.
- Keep touch Pause and Journal available in landscape and on tablets. Make the
  title scrollable on short screens and prevent compact HUD/control overlaps.
- Add production-browser regression tests to the release workflow for delayed
  save initialization, multiple tabs, quota failure, journal editing, reload,
  restart, and phone/tablet layouts.

## [1.0.0]

First releasable build. Ships the Old Lands, Cinderwild, Moonlit Coast and Starfall Moors as four
connected frontier regions; nine shard fortresses, each an authored 26×19 interior with its own
warden, ember hazards and darkness; four sanctuary settlements; four investigations and eight town
requests; and three endings.

`AUDIT_LOG.md` records what this pass found and fixed, with evidence. The short version: the build
gate was red, the build only worked from a domain root, the shard counter was farmable, one pause
menu button did not restart, one settlement interior spawned the player inside solid stone, region
gates oscillated, saves failed silently, and the final encounter was unwinnable for a player who
skipped the optional content without being told.

### Packaging

- `vite.config.ts` now emits **relative** asset URLs. The previous root-absolute URLs meant an
  itch.io zip — served from an arbitrary path — 404'd the region Web Worker (the game refused to
  start) and the sql.js wasm (every save was lost). Override with `ELDRINTH_BASE`.
- Removed a half-finished performance harness from `src/`, where `tsc --noEmit` was type-checking it
  and failing the release build. It now lives in `bench/` with its own vitest config, and
  `renderGame` gained the `__stageHook` it expected. Run it with `npm run bench`.
- `package.json` is no longer the Vite scaffold: named `eldrinth`, versioned, described, MIT.
  Added `LICENSE` and `README.md`.
- Deleted a conflicting `pnpm-lock.yaml` that resolved different dependency versions than the
  committed `package-lock.json`, making the committed `dist/` unreproducible, along with a stale
  pnpm-only `allowScripts` block and an orphaned gitlink for a leaked tool worktree.
- Added favicon, `theme-color`, Open Graph and Twitter card metadata, and a `<noscript>` explanation.

### Fixed

- **Shard counter could exceed nine.** Dying in a fortress discarded its saved state, which
  re-seeded the shard and re-incremented the counter. Harvested vessels are now identified and
  persisted, so a retry cannot re-award one — the "nine people" premise now holds.
- **"Abandon & Restart" did not restart.** It remounted the last autosave, silently rewinding the
  run. It was also the only in-game recovery from a bad state.
- **A settlement interior spawned the player inside solid stone**, and a stray wall row under one
  cottage put them inside a house wall on the way out. A new test asserts every transition in the
  world graph lands on a walkable tile, in both directions.
- **Region gates oscillated.** A fortress gate is one tile from its arrival point and the trigger
  radius is 1.35 tiles, so a player who stopped to look around was ejected and then ejected
  straight back, rebuilding the region each time. Gates now re-arm only once the player is clear.
- **The final encounter was unwinnable for a player who investigated nothing** — 5 maximum health
  against 96 HP at one damage a swing, roughly 35 seconds of uninterrupted swinging. Carrying the
  shards now deepens the blade (capped at +2, well under the +5 the investigations pay), and
  Orithel says plainly at the gate when the pilgrim is unprepared.
- **Dying before resting at a wayfire ended the entire run**, because the wayfire was optional. The
  arrival road is now the starting anchor.
- **A crash left a frozen screen with no explanation.** Added a React error boundary, and an
  `onFatal` channel for crashes inside the engine, which can never reach React. Both now offer a way
  forward instead of a blank page.
- **Save failures were silent and permanent.** A private window or full quota looked exactly like a
  working save. Failures now surface a warning, a failed database open no longer poisons the save
  system for the page's lifetime, and a `PRAGMA user_version` ladder means a future schema change
  cannot brick existing saves.
- **Keyboard-only players could not erase a save**, which locked them out of starting a new run once
  three slots were full. Escape also did not close the journal from the note field.

### Changed

- **Endings now reflect the run.** An epilogue is assembled from the investigations resolved, the
  choice made in each, the town requests completed, the warden accounts found, and the death count.
- **Reaching the Spire short of nine is now a choice** rather than a dead end: you can turn back.
  That replaces the old ending which fired only if you died before the first wayfire and told you
  to count entries that were not recorded.
- The content warning and `ROADMAP.md` promised a reference to sexual violence that exists nowhere
  in the shipped text. Both now describe the game that is actually here.
- The tile-chunk cache ceiling was 256 MB and measured 234 MB resident across a full overworld walk.
  Now 64 MB, with backing stores released on eviction.
- ~28 KB of per-pixel sprite hashes, which no runtime code reads, are no longer shipped to players.
  Main chunk 519.4 kB → 510.0 kB (167.5 → 159.0 kB gzip).
- Fortress braziers were shipped, preloaded and used to light the room, and never drawn. Now drawn.
- Mobile: safe-area insets for notched devices, `100dvh` sizing, and reduced-motion applied beyond
  the intro.
- Accessibility: pause, journal and ending are proper dialogs with focus management; the dialogue
  line and HUD prompts are live regions; thirteen failing contrast treatments raised; journal prose
  is selectable again.

### Removed

- `src/game/entities/` (986 lines) and `core/SpatialGrid.ts` (103), imported only by themselves and
  their own tests. `ONBOARDING.md` had documented `entities/` as live architecture.

### Known issues

- sql.js is 658 kB of WASM and is the largest startup cost, fetched only to render three slot
  labels. The snapshot is plain JSON, so `localStorage` would remove the download entirely. Left
  alone: it is a persistence redesign, not a fix.
- `dist/` is committed and must only be changed by `npm run build`; the release
  workflow checks that it matches a fresh build.
- `ROADMAP.md` Milestone 2's equipment layer, per-region elite behaviours and authored activity
  sites are designed but **not** implemented, and Milestone 3 (New Pilgrimage) is deferred beyond
  the epilogue.
