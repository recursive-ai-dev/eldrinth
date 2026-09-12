# Procedural Sprite Pipeline: Graphics Overhaul Design

## Context

Eldrinth's renderer (`src/game/render/renderer.ts`) is currently 100% procedural
Canvas2D — every tile, character, and effect is drawn live each frame with
`fillRect`/`arc`/gradient calls (`drawTile`, `drawKnightBody`, `drawWraith`,
`drawSentinel`, `drawAdept`, `drawBoss`, etc.). There is no sprite/image
infrastructure in gameplay; the only raster assets in the repo are two static
UI background JPGs (`title.jpg`, `ending.jpg`) used by `TitleScreen.tsx` and
the end screen.

The goal is a graphics overhaul that gives Eldrinth real pixel-art sprites —
tiles, player, enemies, items — in a brutal, adult dark-fantasy style,
replacing the current vector-drawn placeholder aesthetic, while keeping
procedural effects (particles, glow/bloom, lighting vignette) as-is.

Two existing tools were evaluated as generation sources:

- **`~/Projects/aelthara/mcp_server`** — calls a remote free text-to-image API
  (Pollinations.ai) with a local procedural PIL fallback. Rejected for this
  pass: introduces a network dependency into asset generation and doesn't
  match the "fully offline, reproducible from a seed" direction chosen below.
- **`~/Projects/shed-dev-sprites`** — a fully offline, deterministic,
  math-only procedural pixel-art generator (cellular automata / SDF / noise
  / FFD rigging), supporting humans and 7 creature archetypes
  (`blob, slime, quadruped, biped, winged, tentacle, golem`), with palette
  control, 4-direction poses, and walk-cycle animation frames. No network,
  no API keys, no ML models — pure Python + Pillow + numpy. **Selected** as
  the generation source; its house palettes read as "cute" rather than
  brutal, so new dark-fantasy palettes are part of this work.

## Decisions

1. **Art style**: procedural pixel art via a vendored/adapted copy of
   shed-dev-sprites, not AI-generated raster art and not an enhancement of
   the current vector renderer.
2. **Build constraint**: the "browser-only, single-file build" constraint
   (`vite-plugin-singlefile`) is dropped. Sprite sheets ship as normal static
   assets in `dist/`, not base64-inlined.
3. **Scope**: everything in one pass — tiles, player, enemies, and items all
   move to sprites together, so the game doesn't end up half-procedural/
   half-sprite.
4. **Animation**: full walk-cycle and attack/idle animation frames from day
   one (the generator already produces these cheaply), not static-only.
5. **Integration architecture**: vendor the Python generator into the repo as
   a dev-time-only tool, driven by a catalog mapping game entities to
   generator params, producing committed PNG sheet + JSON manifest assets.
   Python never ships in the browser bundle and is never called at runtime.

## Architecture

```
tools/spritegen/                  (vendored + adapted from shed-dev-sprites)
  generator/...                   existing math + sprite modules (human, creature, item, tile)
  catalog.py                      NEW: eldrinth entity -> generator params mapping
  cli.py                          extended with a --catalog batch mode

src/assets/sprites/
  <entity-id>/
    sheet.png                     packed animation frames (all directions/actions)
    manifest.json                 frame rects, direction order, fps, pivot/anchor

src/game/render/
  spriteAtlas.ts                  NEW: loads sheet.png + manifest.json, frame lookup
  renderer.ts                     MODIFIED: draw* functions become drawImage calls
```

### Generation flow

`npm run gen:sprites` → a small Node script shells out to
`tools/spritegen/cli.py --catalog` → Python reads `catalog.py`, generates one
sheet + manifest per catalog entry → writes to `src/assets/sprites/*` →
committed to the repo like any other source asset → Vite bundles them as
normal static assets → `spriteAtlas.ts` loads them via `Image`/`fetch` at
game-init and caches decoded bitmaps → the renderer looks up the right frame
per draw call by entity type, facing direction, and animation time.

### Catalog

One entry per distinct visual thing the game needs, e.g.:

```python
CATALOG = {
    "player":         {"kind": "human",    "seed": "eldrinth-player-01", "palette": "grim_steel",      "anims": ["walk", "attack", "idle"]},
    "enemy.wraith":   {"kind": "creature", "archetype": "tentacle", "seed": "wraith-a1",  "palette": "wraith_ash",       "anims": ["walk", "attack", "idle"]},
    "enemy.sentinel": {"kind": "creature", "archetype": "golem",    "seed": "sentinel-a1","palette": "rusted_stone",     "anims": ["walk", "attack", "idle"]},
    "enemy.adept":    {"kind": "human",    "seed": "adept-a1",      "palette": "cult_blood",       "anims": ["walk", "attack", "idle"]},
    "enemy.boss":     {"kind": "creature", "archetype": "biped",    "seed": "boss-a1",     "palette": "corrupted_flesh", "anims": ["walk", "attack", "idle"]},
    "tile.grass":     {"kind": "tile",     "seed": "grass-a1",      "palette": "sickly_green"},
    "tile.water":     {"kind": "tile",     "seed": "water-a1",      "palette": "black_water", "autotile": True},
    "item.shard":     {"kind": "item",     "seed": "shard-a1",      "palette": "bone_relic"},
    # ... one entry per T tile enum value and per enemy/item type
}
```

Every value of the existing `T` tile enum (`src/game/constants.ts`) and every
enemy/item type gets exactly one catalog entry — this is the single source of
truth for what art exists.

### Art direction (palettes)

New dark-fantasy cosine-gradient palettes added to `math/palette.py`,
replacing/extending the generator's current generic set: `grim_steel`,
`wraith_ash`, `rusted_stone`, `cult_blood`, `corrupted_flesh`, `bone_relic`,
`sickly_green`, `black_water` — desaturated, high-contrast, blood/rust/bone/
ash tones. The CA/SDF silhouette generation stays geometric either way; tone
comes from palette choice and archetype selection (e.g. `tentacle`/`golem`
for monstrous enemies).

Tile autotiling reuses the generator's existing `wang.py` bitmask system so
terrain edges (grass↔water↔path) blend automatically.

### Renderer integration

- `spriteAtlas.ts` exposes `getFrame(entityId, action, direction, t)` →
  `{img, sx, sy, sw, sh}`, picking the right animation frame for elapsed time
  `t` at a fixed fps (e.g. 8fps walk cycle) from the loaded manifest.
- Each `draw*` function in `renderer.ts` (`drawKnightBody`, `drawWraith`,
  `drawSentinel`, `drawAdept`, `drawBoss`, `drawTile`) is replaced with a
  `ctx.drawImage(atlas.img, sx, sy, sw, sh, dx, dy, TILE, TILE)` call, scaled
  up from the generator's native 32×32/16×16 resolution (likely 2x–3x
  nearest-neighbor, `imageSmoothingEnabled = false`, for a crisp pixel-art
  look).
- `TileChunkRenderer`'s offscreen-canvas chunk baking is unchanged
  architecturally — it now bakes `drawImage` calls into chunks instead of
  vector fills; the caching/eviction logic is untouched.
- Procedural effects are unaffected: particles, glow/bloom
  (`globalCompositeOperation = "lighter"`), floating text, the lighting
  vignette pass, and shadow ellipses stay exactly as they are today, drawn
  around/on top of sprites.

### Error handling

- Missing/failed sprite load falls back to a solid-color placeholder rect
  rather than crashing — a development-time safety net only; by ship time
  every catalog entry has a generated, committed asset.
- A test (extending or alongside existing render tests) asserts every `T`
  tile value and every enemy/item type has a corresponding catalog entry and
  an on-disk asset, so a missing entry fails CI rather than silently
  rendering a placeholder in production.

### Testing

- Unit tests for `spriteAtlas.ts`'s frame-lookup math (direction/time →
  correct source rect) using a fake manifest.
- Catalog-completeness test as described above.
- Existing `WorldState`/`AISystem`/`GameFlowSystem`/`regions` tests are
  unaffected — this work is isolated to rendering, not simulation.

### Build changes

- `vite-plugin-singlefile` removed from Vite config.
- `ROADMAP.md`'s "keep the browser-only, single-file build" line updated to
  reflect the dropped constraint.

## Out of scope for this pass

- AI-generated (Pollinations/aelthara-style) art — rejected in favor of the
  fully offline procedural approach.
- Runtime/in-browser sprite generation — generation is a dev-time-only step;
  Python is never shipped or invoked in the browser bundle.
- Any change to game simulation/logic (`WorldState`, `AISystem`,
  `GameFlowSystem`, `regions`) — this is a rendering-layer overhaul only.
