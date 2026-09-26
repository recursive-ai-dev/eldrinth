# Changelog

All notable changes to ELDRINTH: The Unbound Spire.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
semantic versioning.

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
- No CI. `dist/` is committed and must only be changed by `npm run build`; nothing enforces that.
- `ROADMAP.md` Milestone 2's equipment layer, per-region elite behaviours and authored activity
  sites are designed but **not** implemented, and Milestone 3 (New Pilgrimage) is deferred beyond
  the epilogue.
