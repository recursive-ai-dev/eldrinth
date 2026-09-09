# Tilemap, Camera, and Streaming Audit

## Data-flow trace (2026-09-09)

`region.worker.ts` creates `MapData` with `generateMap()` → transfers full `tiles` and
`solid` arrays → `RegionRepository` retains the complete region → `Game.initialize()`
installs it in `WorldState`, builds a full-sized static canvas, and supplies its
separate `solid` array to `MovementSystem` → `renderGame()` draws the whole canvas
every frame.

## Findings recorded before implementation

1. **Unbounded world-size allocation.** The region source generates a complete map,
   `RegionRepository` retains it, and `buildStaticCanvas` allocates a canvas sized to
   the entire region. Memory and initial raster work grow with total world area;
   this cannot scale to an open world. **Before:** `O(world tiles + world pixels)`
   resident memory and startup work per acquired region. **Planned:** fixed-size,
   camera-neighborhood chunk cache with per-chunk canvases.
2. **No render culling.** `renderGame` blits a full-region static canvas. Although
   the browser clips destination pixels, the backing canvas is still monolithic and
   no visible chunk set exists. **Before:** no chunk culling or eviction. **Planned:**
   enumerate and draw only chunks intersecting the viewport plus a one-chunk guard.
3. **Collision has two authorities.** `generateMap` derives `solid` from tile IDs,
   then `MovementSystem` consumes the duplicate array while wards are a second
   exception path. New tile behavior can silently render without matching collision.
   **Before:** tile semantics are split among `constants.ts`, `map.ts`, and movement.
   **Planned:** central tile-shape definitions queried directly by collision,
   including solid, one-way, slope/ledge, and trigger metadata.
4. **Collision is not shape-accurate.** A circle is tested using four AABB corner
   samples plus its center, and movement advances in 2px loops. This can snag at
   corners, tunnel over small shape changes, and makes cost proportional to speed.
   **Before:** up to `ceil(distance/2) * 5` tile probes per axis. **Planned:**
   bounded broad-phase tile range with circle-vs-shape tests and binary-search sweep.
5. **Draw order is incomplete.** Base and tall tiles share one pre-rendered surface;
   entities are Y-sorted only relative to each other. Entities therefore cannot pass
   behind tree canopies, roofs, or overlays. **Before:** no ground/decoration/
   overlay separation. **Planned:** chunk layer canvases and a single Y-sorted
   world-object pass with tall overlays after entities.
6. **Camera has smoothing and bounds but no deadzone.** It targets the player center
   every simulation step; small player motions continually move the view. **Before:**
   visible camera drift/jitter risk and no viewport-margin policy. **Planned:**
   clamped, frame-rate-independent exponential smoothing following a deadzone.
7. **Chunk seams are undefined.** There is no neighbor-aware autotile/collision
   query or guard radius. **Before:** a future chunk boundary can disagree visually
   or physically. **Planned:** globally addressed tile lookup, one-tile neighbor
   sampling, and a prefetch guard ring.

## Implementation and verification

1. **Bounded layered chunk raster cache — implemented.**
   - **Before:** one `width * TILE` by `height * TILE` static canvas was built at
     initialization and blitted as a whole every frame.
   - **After:** `TileChunkRenderer` splits map rasterization into 16×16-tile
     ground and overlay canvases. It draws only viewport-intersecting chunks,
     warms a one-chunk (512px) guard ring, and evicts least-recently-used chunks
     beyond 64 canvases. At dash speed this guard exceeds a full frame's travel
     by over 50×, so normal boundary crossings reuse prebuilt tiles. Chunk tile
     noise is seeded with global coordinates, preventing a changed appearance
     after eviction/rebuild.
   - **Result:** canvas memory is bounded by 64 × 2 × 512² × 4 bytes (128 MiB
     worst-case backing-store allocation, generally much less by browser
     allocation strategy), rather than growing with world pixel dimensions;
     visible draw iteration is bounded by viewport chunk count.

2. **Layering and Y-sort — implemented.**
   - **Before:** every tile was flattened into the static canvas; items,
     enemies, and player were separate passes, so ordering between categories
     was fixed and tall scenery could not occlude actors.
   - **After:** ground tiles draw first; items, enemies, and player share a
     single world-Y sort; tall tree/rock/wall/grave/crystal overlay parts draw
     afterward. This provides the required ground, decoration/solid, entity,
     and overhead layers while retaining existing tile artwork.
   - **Result:** actor overlap is determined by world position rather than
     entity category, and tall tile canopies/upper faces correctly cover actors.

3. **Authoritative tile-shape collision — implemented.**
   - **Before:** map generation duplicated collision into `MapData.solid`; tile
     semantics and wards were checked in separate locations. Four corner and
     center probes were advanced in 2px increments.
   - **After:** `TILE_DEFINITIONS` is the sole tile-to-shape catalogue.
     `MovementSystem` retrieves tile IDs directly and handles solid, one-way
     ledge, slope, and non-blocking trigger shapes. Circle-vs-tile shape checks
     use a bounded nearby-tile broad phase; movement performs a nine-iteration
     binary sweep only when its destination is blocked. Wards enter the same
     query as a temporary solid and refresh immediately when unlocked.
   - **Result:** collision no longer depends on a stale/generated bitmap;
     fast movement has bounded collision work rather than `distance / 2` loops.
     `MovementSystem.test.ts` verifies high-distance solid stopping, world-edge
  blocking, one-way ledges, and trigger lookup.

4. **Camera policy — implemented.**
   - **Before:** the camera always eased toward player center using a
     timestep-dependent linear factor; resize did not re-clamp the view.
   - **After:** a 20%-of-view (capped) deadzone prevents small movement from
     moving the camera. Target clamping remains world-bound, smoothing uses
     `1 - exp(-8dt)` for frame-rate independence, and resize re-clamps then
     warms chunks.
   - **Result:** stable follow behavior with no edge overshoot.

5. **Bounded region residency — implemented.**
   - **Before:** a zero-user preloaded region could remain in
     `RegionRepository` indefinitely.
   - **After:** used regions retain an LRU timestamp and at most eight idle
     regions remain resident; active owners are never evicted.
   - **Result:** the retained region set is constant with respect to explored
     world size. `regions.test.ts` verifies the idle look-ahead cap.

## Verification (2026-09-09)

- `npm run build` passed.
- `npx vitest run` passed: 9 files, 14 tests.
- `git diff --check` passed.

## Current content-format boundary

The prototype's authored content is still generated as one small fixed
70×50-tile region in `map.ts` (there are no map files on disk). The runtime now
has bounded region and render caches, but replacing that prototype generator
with an on-disk per-region source is the remaining content-pipeline step for a
truly arbitrary-size authored world. Its required contract is already
`RegionSource.load(regionId)`; each supplied region should keep a bounded tile
size and use the same row-major tile IDs and `TILE_DEFINITIONS` catalogue.
