# Shard Fortresses — Vertical Slice Design

**Status:** approved for implementation
**Scope:** sub-project 1 of 2. This builds the interior-region system and
**one** fully-realised fortress. The remaining eight sites, the offline
`ca.py` layout generator, hazard variety, and relic interactions are
sub-project 2 and are not specified here. The combat tuning pass is a
separate sub-project again.

**Goal:** A shard should cost something to reach. Today each one sits in a
7×7 floor square with two wall tiles and a road drawn straight to it — the
frontier sites — or on bare grass with nothing at all, in the Old Lands.
This makes one shard site a place you enter, commit to, and come out of
worse than you went in.

**Specs this builds on:**
- `docs/superpowers/specs/2026-09-13-the-harvest-narrative-design.md` — §1
  canon (the shards are nine conscious people) is binding.
- `docs/superpowers/specs/2026-09-14-harvest-cost-design.md` — the harvest
  already costs permanent maximum health. This spec is what that cost buys.

---

## 1. Why a slice, and which one

Interiors, nine layouts, darkness, hazards, warden behaviour and new art is
four subsystems. Splitting by layer would deliver "fortresses as places"
first — rooms with a pickup at the back, which is the current complaint with
more walking. So the split is vertical: one fortress with every pressure,
then the other eight against a design already proven.

**The slice fortress is the Cinderwild Broken Shrine**, the site currently
at `shardTiles [72, 20]` in `generateFrontierMap`. It is where the game's
strongest writing already sits — the courier's shell curled around the
vessel, the child awake for nine hundred years — so the occupant-defends
idea has something to be about. It also carries the `courier-memory` fact,
meaning the investigation and the fortress reinforce each other.

## 2. A fortress is a region

Fortresses reuse the region machinery wholesale rather than introducing a
level concept.

- New region id: `fortress.cinderwild-shrine`.
- `generateMap(regionId)` gains a branch returning the fortress `MapData`.
- The overworld site gains a `RegionExit` pointing in; the fortress map
  carries one pointing back out to the arrival tile.
- Entry pushes the `interior` scene, which exists in `SceneId` and in the
  pause handling (`useGameStore.ts:91`) but is currently pushed by nothing.

Exits fire on proximity to entries in `map.exits` (`engine.ts:771-774`), so
no new tile type, trigger, or interaction verb is required. `changeRegion`
already handles the async load, the abort signal, and per-region state.

**`MapData` gains two fields:** `dark: boolean` (§5) and
`resetOnDeath: boolean` (§4). Both default to `false`, so every existing
region is unaffected.

## 3. Layouts as ASCII

Every fortress — authored here, generated in sub-project 2 — is defined as
an array of equal-length strings.

| Glyph | Meaning |
|---|---|
| `#` | wall (blocking) |
| `.` | floor |
| `D` | door: the arrival tile and the exit back |
| `S` | the shard |
| `W` | warden spawn |
| `E` | ordinary enemy spawn |
| `*` | brazier: a light source |
| `^` | hazard floor |

A pure `parseFortressLayout(rows: string[]): FortressLayout` turns that into
a tile array plus spawn coordinates. It lives in its own module — importing
nothing from `engine.ts`, for the same reason `escalation.ts` exists: no
test in this repo can import `engine.ts`, which drags in `renderer.ts` and
the sprite-atlas layer and expects a browser.

The parser rejects malformed input rather than producing a broken level:
ragged row lengths, an unknown glyph, zero or multiple `S`, and zero or
multiple `D` are all errors. Sub-project 2's generator emits this same
format, so `map.ts` cannot tell authored from generated and every layout is
reviewable in a diff.

## 4. Commit at the door

The fortress map contains **no campfire**, so `tryInteract` finds nothing to
rest at and no checkpoint can be set inside. Whatever health the player
walks in with is the whole budget.

On death, `respawnAtCheckpoint` already returns the player to
`world.checkpoint` — always a wayfire, always outside — and calls
`changeRegion` when that checkpoint is in another region. That part is free.

What is not free: `rememberRegion()` stores enemies, items and boss state
into `world.regions[regionId]` so a region keeps its inhabitants across
visits, so a player who died halfway would return to a half-emptied
fortress. When `resetOnDeath` is set, the region's retained
state is discarded on death so the fortress is whole again.

Taking the shard does not eject the player. They walk back out through the
door they came in, past whatever they left alive.

## 5. Darkness

When `dark` is set, the renderer composites a darkness layer after the world
pass and before the HUD, punched through by radial gradients at the player
(small radius) and at each brazier (larger). This is the inverse of the
campfire glow already implemented with `globalCompositeOperation` and
`createRadialGradient` (`renderer.ts:802-815`), so the technique is
established rather than novel.

Darkness is per-region and opt-in. The overworld and the three frontier maps
set `dark: false` and render exactly as they do today.

## 6. Hazards

One new tile type, `T.EMBERS`, with `shape: "none"` and a new optional
`harm: number` field on `TileDefinition`. Standing on it costs health on a
cooldown, reusing the player's existing `invuln` timer so hazard damage
cannot stack with combat damage in the same frame.

One hazard, not a hazard system. Variety is sub-project 2's problem, and
only if the slice proves it earns its place.

## 7. The occupant defends

A warden spawns at the shard chamber, using the existing `elite` enemy flag
rather than a new archetype or new AI. The pressure comes from fighting it
with no way to heal and no light, not from novel behaviour.

Killing it writes a journal entry under the established `warden:` fact
pattern the quests already use (`warden:starfall-moors` exists today). The
entry names what the player has just done in the canon's terms: the thing
guarding the shard was the person in it.

## 8. Art

New `catalog.py` entries for the fortress set — wall, floor, door, brazier,
hazard — generated offline into `src/assets/sprites/`, committed, and
covered by the existing `asset_integrity_test.py`. Same pipeline as every
other tile; Python stays dev-time only and never ships.

The vendored generator in `tools/spritegen/` stays authoritative. Its
`sprites/tile.py` differs from the copy in `~/Projects/shed-dev-sprites`, so
regenerating from upstream would change art that already ships.

## 9. Testing

- `parseFortressLayout` — parses each glyph to the right tile and spawn;
  rejects ragged rows, unknown glyphs, and a layout with zero or several
  `S` or `D`.
- **Reachability.** A flood fill from `D` must reach `S`. The ending gates
  on all nine shards, so an unreachable shard is an unwinnable run. This
  assertion runs over every layout the game ships and is the single most
  important test in this spec.
- The warden spawn and every `E` are reachable from `D` too — an enemy
  sealed behind a wall is a softlock in any room that gates on clearing it,
  and a waste everywhere else.
- Hazard damage respects the invulnerability cooldown rather than applying
  every frame.
- Region reset on death discards retained enemies and items for a
  `resetOnDeath` region and leaves other regions untouched.
- Existing regions are unchanged: the overworld and the three frontier maps
  still produce identical tile arrays, since `dark` and `resetOnDeath`
  default to `false`.
- Full suite green (139 at time of writing), `tsc --noEmit` clean, and a
  headless playthrough entering the fortress, confirming darkness renders,
  taking the shard, and dying inside to confirm the reset.

## 10. Explicitly out of scope

The other eight fortresses; the offline `ca.py` layout generator; hazard
variety; relic interactions with darkness or hazards; the combat tuning pass
(boss, enemy and potion balance); Milestone 2's equipment layer; the
character bible and sprite appearances; and any change to the harvest cost
curve or the life bar.
