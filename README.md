# ELDRINTH: The Unbound Spire

A 2D open-world dark-fantasy action RPG for browsers and Linux desktops. No
backend or build-time data fetching is required. Gameplay and saves use only
the static bundle; optional web fonts fall back to local fonts. Maps and
gameplay are deterministic; the pixel art is generated offline and committed.

> You play a lone wayfarer hunting **nine Anima Shards** to quiet the
> **Unbound** — the last, broken mind of the **Mnemonic**, a machine the Elder
> Elves built out of living minds. The shards are not loot. Each one is a
> person still conscious inside the Spire, and taking it costs you permanent
> maximum health. Along the way you investigate accounts of institutional
> violence, and the decisions you bring back to Orithel shape the ending.

**Content rating: Mature.** The premise is institutional atrocity stated plainly
in flat clerical language. A content warning gates first launch. See
[Content](#content) below.

## Play

Install the standalone Debian desktop release on amd64 Linux:

```bash
sudo apt install ./eldrinth_1.2.0_amd64.deb
eldrinth
```

The game also appears in the desktop Games menu and plays fully offline. F11
toggles fullscreen. Desktop saves live in `~/.config/eldrinth` (or
`$XDG_CONFIG_HOME/eldrinth`) and survive package upgrades and removal.
See [Debian release instructions](packaging/README.md) for builds and verification.

For the browser version:

Download the build, host `dist/` from any static server, and open `index.html`.
The build uses relative asset paths, so it works from a domain root, a
subdirectory, or an itch.io zip without reconfiguration.

| Action | Keyboard |
| --- | --- |
| Move | `W` `A` `S` `D` / arrow keys |
| Attack | `J` / `Space` |
| Dash | `Shift` |
| Last Breath parry | `F` |
| Raise / shutter lantern | `R` / Lantern button |
| Switch combat tool | `Q` |
| Loadout | `I` |
| Speak / read / enter | `E` |
| Journal / illustrated field guide | `L` |
| Local atlas / pin a destination | `M` |
| Pause | `Esc` / `P` |
| Dialogue choices | `1`–`9` / `0` |

Touch controls appear automatically on coarse-pointer devices. Landscape is
recommended on phones.

### The Wayfarer’s Kit (unreleased)

Press **M** or **Atlas** to chart places you have actually seen. Search or filter
known wayfires, sanctuaries, roads, doorways, and records; pin a place for a live
bearing and distance. Surveyed places are stored with each pilgrimage. Distances
are straight-line estimates, so terrain may require a detour.

The **L** journal now includes an illustrated **Field guide**: a first-steps
checklist, enemy tactics, equipment reference, expedition progress, and lamplight
progress. Route hints open only when requested. Records can be filtered by status,
sorted, copied, or exported as text; personal observations have a character count
and writing feedback.

In **Pause → Equipment**, compare a relic’s effects before attuning it. **Journey**
shows active travel time, returns after falling, parries, and the next taking’s
health cost. **Save Checkpoint** writes progress without leaving the game. Save
slots show their last write time.

**Display → Travel & Comfort** adds high contrast, camera-shake and atmosphere
switches, fullscreen, and automatic pausing when the game loses focus. These
settings persist on the device. Automatic pausing is enabled by default; the
world waits for you to resume.

All 24 new field-kit images are generated from the local **shed-dev-sprites**
project, with recipes, source fingerprints, checksums, and the Apache-2.0 source
license included. Assets are bundled for offline play:

```bash
npm run gen:field-kit
npm run verify:field-kit
```

See [the 41 implemented improvements](docs/wayfarers-kit.md) and the
[art contact sheet](docs/field-kit-contact-sheet.png).

### The Lamplighter's Margin (unreleased)

Raise the lantern with `R` or the **Lantern** button. Scraped brass plates on
the arrival road and around the three frontier wayfires reveal concealed writing
when you bring the light close. Read with `E` to keep each account in the journal's
**Lamplight** section; the primer and regional survey notices give geographic
directions. The lantern also widens your personal light inside dark fortresses.
It uses no stamina or fuel, and every existing pilgrimage can use it. Reloading
shutters the lamp while keeping copied accounts. Original evidence, shard costs,
quest rewards, and equipment remain intact.

Weapons and relics now have pixel-art icons generated directly from the local
`shed-dev-sprites` project. Committed assets work offline without Python or the
sprite project. To regenerate or verify their source recipes locally:

```bash
npm run gen:equipment
npm run verify:equipment
# Use a different checkout when necessary:
python3 tools/spritegen/gen_equipment_icons.py --source /path/to/shed-dev-sprites --check
```

### Names in the Fire

Version 1.2 makes each taking a decision. Approach a vessel and press `E` to
hear the person inside, see the exact permanent health cost, and choose whether
to carry them or leave them for another visit. At a wayfire, the people you
carry share memories of their lives. Their words remain in the journal's
**Voices** section and the ending remembers whom you listened to. The pause
menu's **Names** section records whom you carry and whose memory you have heard.

Last Breath gives close combat a timed defence: face an incoming attack and
press `F` to parry. The brief guard costs stamina; a successful parry restores
some of it and strengthens your next strike. Touch controls include a Parry
button. Regional soundscapes and combat cues are synthesized locally and work
offline, with saved volume and mute controls in the pause menu.

### Expeditions and equipment

Version 1.1 adds a loadout with two combat tools and three relic slots. The
Wayblade offers fast, free strikes; the Gravehammer spends stamina on a slower,
heavier blow. Wayfire relics now have optional effects with tradeoffs: absorb
damage, reflect bolts while dashing, recover stamina faster, or strengthen your
strikes. Previously earned permanent bonuses remain intact when loading older
saves; use the loadout to attune their relics.

Four optional sites give each region another reason to explore: the Hollow of
the Uncounted in the Old Lands, Ashglass Causeway in Cinderwild, the Drowned
Court on the Moonlit Coast, and the Listening Ring in Starfall Moors. Road notes
give directions, discoveries enter your journal, and each completed site's
permanent reward is granted once.

The pause menu includes your loadout and display preferences. Camera zoom starts
at 150% and can be adjusted from 100% to 200% for a closer view. Display settings
also offer larger dialogue and journal text and a quiet interface with reduced
motion. Save & Return to Title
waits for a checkpoint before leaving the game; a failed save keeps you in your
current run.

Progress autosaves to `localStorage` every 10 seconds, on tab-hide, and on
unmount, across three slots. **Private/incognito windows can block storage
writes** — the game detects this and warns you rather than losing your run
silently.

Serve releases over **HTTPS** (localhost also works for development). Safe saves
use the browser's Web Locks API to serialize database writes across tabs. If
safe saving is unavailable, the game warns you and leaves existing records
untouched. Different slots can be played in separate tabs; if two tabs resume
the same slot, an older session is prevented from overwriting a newer save.
Reload that tab and continue the latest record to resume saving.

Older saves without shard identities are recovered from their intake and
fortress records. Ambiguous records are preserved and reported as incompatible,
rather than guessing which shards were collected.

## Develop

Use Node 24 LTS. Node 22.12+ in the 22.x line is also supported. npm is the supported package manager and
`package-lock.json` is the committed lockfile.

```bash
npm install
npm run dev          # dev server with hot reload
npm test             # unit + integration suite (src/)
npm run typecheck    # tsc --noEmit
npm run build        # typecheck gate, then production build into dist/
npm run verify:release # confirm built assets work under a nested static path
npx playwright install chromium # one-time setup for browser regression tests
npm run test:browser # production browser tests; run npm run build first
# Optionally use an installed Chrome instead of Playwright Chromium:
PLAYWRIGHT_CHANNEL=chrome npm run test:browser
npm run test:desktop:unit # desktop asset and navigation boundary checks
npm run build:deb    # production build, static check and standalone Debian package
npm run verify:deb   # package metadata, checksums, assets and sandbox helper
npm run test:desktop # launch the extracted package with temporary save data
npm run preview      # serve the production build
npm run bench        # performance harnesses (see below)
```

Sprite atlases are committed. To regenerate them you additionally need
Python 3.10+, Pillow, and numpy — none of which are runtime or build
dependencies for the browser game:

```bash
npm run gen:sprites
```

### Deployment

`vite.config.ts` sets `base: "./"`, so the build is location-independent. To
pin a specific deployment path:

```bash
ELDRINTH_BASE=/eldrinth/ npm run build
```

`dist/` is committed to the repository so a release can be served directly from
a branch. It must only ever be changed by running `npm run build`.
The release check in `.github/workflows/release-check.yml` installs from the
lockfile, runs unit and production-browser tests, builds, verifies the static assets, and fails if the
committed `dist/` differs from the build. No deployment variables are required.
It also builds and tests the Debian package and uploads `release/` as an artifact.
Debian package outputs are ignored by Git. Their build uses native Linux Electron
and `dpkg-deb`; end-to-end desktop checks use a virtual display on CI.

### Benchmarks

`bench/` holds measurement harnesses that print numbers rather than assert
them. They are excluded from `npm test` on purpose — they are slow and they
monkey-patch globals, so letting them into the release gate would make the
suite unreliable.

```bash
npm run bench                       # headless: render, simulate, save, memory
open http://localhost:5173/perf.html?mode=render   # real GPU frame timings
```

`src/game/render/renderer.ts` exports `__stageHook`; the browser bench assigns
to it to attribute frame time to individual pipeline stages. It is `undefined`
during normal play, so the per-stage calls cost one property read.

## Architecture in one paragraph

`src/game/` is the engine and knows nothing about React. `src/components/` is a
thin React shell that mounts the canvas and layers HUD and menus over it. The two
communicate only through the `GameCallbacks` interface. Maps are generated by
`src/game/map.ts` from a fixed seed; the nine shard fortresses are hand-authored
26×19 layouts in `src/game/fortressLayouts.ts`. Saves go through
`src/game/slots.ts`, which stores three snapshots in a SQLite database held in
`localStorage` via sql.js/WASM.

`ONBOARDING.md` is the full contributor guide — architecture, conventions, and
how-to recipes for adding regions, fortresses, quests, and tile types.

## Content

Mature, by design and by intent. The game's central claim is that the machine at
the world's heart is built out of living minds, that the nine shards are nine
people still conscious inside it, and that the institutions in the story process
those people as paperwork. Nothing in the approved copy is decorative shock; it
is load-bearing to the premise. The first-launch content warning discloses
institutional violence and death. Child killing and child harvesting are excluded
from the story; all harvested people are adults.

## Documentation

- [CHANGELOG.md](CHANGELOG.md) — release history and known issues
- [packaging/README.md](packaging/README.md) — Debian installation, builds and save location
- [AUDIT_LOG.md](AUDIT_LOG.md) — the v1 release audit: every blocker, with evidence
- [ROADMAP.md](ROADMAP.md) — milestones, including what is explicitly *not* shipped
- [ONBOARDING.md](ONBOARDING.md) — the full contributor guide

## License

MIT — see [LICENSE](LICENSE).
