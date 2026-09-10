# Entity Architecture Audit & Refactoring Log

## Pre-Refactor State (2026-09-09)

### Entity Types Identified

| Entity Type | Instance Count | Data Fields | Behavior | Current Location |
|-------------|---------------|-------------|----------|------------------|
| **Player** | 1 | 29 fields (position, HP, stamina, attack/dash timers, invulnerability, knockback, animation) | Movement, attack, dash, interact, dialogue | `WorldState.PlayerState` + `engine.ts:233-450` |
| **Enemy (wraith)** | 6 spawned | 24 fields (position, HP, speed, damage, AI timers, hurt flash, death animation) | Chase, bob, contact damage | `WorldState.EnemyState` + `AISystem.ts:62-71` |
| **Enemy (sentinel)** | 4 spawned | Same as wraith | Fast chase, contact damage | `WorldState.EnemyState` + `AISystem.ts:72-76` |
| **Enemy (adept)** | 3 spawned | Same + shootCd | Kite, telegraph spell, shoot projectile | `WorldState.EnemyState` + `AISystem.ts:77-98` |
| **Enemy (boss)** | 1 (conditional) | Same + burstCd, lungeCd, lungeTimer, summonCd, telegraph variants | Chase, lunge, burst, summon adds | `WorldState.EnemyState` + `AISystem.ts:109-161` |
| **Projectile** | 0-50 active | 7 fields (position, velocity, radius, life, damage, color) | Move, collide with player/tiles, expire | `WorldState.ProjectileState` + `engine.ts:567-580` |
| **Item (shard)** | 3 fixed | 4 fields (position, type, time, taken) | Float animation, pickup, grant HP | `WorldState.ItemState` + `engine.ts:582-595` |
| **Item (potion)** | 0 (unused) | Same as shard | (Not implemented) | Type defined only |
| **Sign** | 4 fixed | 3 fields (tile position, text) | Interact, show dialogue | `MapData.signs` + `engine.ts:476-483` |
| **NPC** | 1 fixed | 2 fields (position) | Interact, show dialogue | `MapData.npc` + `engine.ts:469-475` |

### Duplicated Logic Found

1. **Contact damage check** (3 locations):
   - `AISystem.ts:104-107` (wraith/sentinel/adept)
   - `AISystem.ts:158-161` (boss)
   - Same condition: `player.dying <= 0 && player.invuln <= 0 && !player.dashing && dist < enemy.r + player.r`

2. **Velocity steering** (2 locations):
   - `AISystem.ts:100-102` (regular enemies)
   - `AISystem.ts:129-131` (boss)
   - Same formula: `enemy.vx += (mvx - enemy.vx) * Math.min(1, dt * 12)`

3. **Entity death cleanup** (2 locations):
   - `engine.ts:790-804` (enemies)
   - `engine.ts:567-580` (projectiles)
   - Both iterate backwards and splice arrays

### God Objects Identified

1. **`engine.ts` Game class** (1045 lines):
   - Owns all entity arrays
   - Manages spawning/despawning
   - Handles input, AI, combat, rendering orchestration
   - Contains 47 magic numbers for entity stats
   - Directly mutates entity state in 12+ methods

2. **`EnemyState` interface** (24 fields):
   - Combines transform, health, AI state, animation, physics
   - Every enemy type carries unused fields (wraith doesn't use shootCd, sentinel doesn't use telegraph)

### Coupling Issues

**Adding a new enemy type requires editing:**
1. `types.ts` - Add to `EnemyType` union
2. `constants.ts` - Add stat constants
3. `engine.ts:610-650` - Add `makeEnemy()` case
4. `AISystem.ts:61-98` - Add AI branch
5. `renderer.ts:200-350` - Add `drawEnemy()` case
6. `map.ts` - Add spawn point

**Adding a new item type requires:**
1. `types.ts` - Add to `ItemType` union
2. `engine.ts:582-595` - Add pickup logic
3. `renderer.ts:400-450` - Add draw case
4. `map.ts` - Add placement

### Missing Infrastructure

- **No stable entity IDs**: Projectiles and items use array indices
- **No entity pooling**: Projectiles allocated/collected every frame
- **No data-driven archetypes**: Stats hard-coded as constants
- **No component queries**: Systems iterate raw arrays
- **No safe references**: Destroyed entities leave dangling pointers
- **No event system**: Direct method calls between systems

### Current Strengths (Keep)

- ✅ Systems are separated (AISystem, CombatSystem, MovementSystem, InputSystem, GameFlowSystem)
- ✅ FixedStepLoop provides deterministic simulation
- ✅ WorldState enables serialization
- ✅ SpatialGrid exists (unused but available)
- ✅ RenderState contract decouples rendering

## Refactoring Plan

### Phase 1: Foundation (Entity Registry + Components)
1. Create `EntityRegistry` with stable IDs
2. Define component types (Transform, Health, Sprite, Collider, AIState)
3. Implement component queries
4. Record in ENTITIES.md

### Phase 2: Entity Archetypes
1. Create data-driven archetype definitions
2. Implement entity factory
3. Migrate enemy types to archetypes
4. Record in ENTITIES.md

### Phase 3: Pooling & Lifecycle
1. Add entity pooling for projectiles
2. Implement spawn/despawn events
3. Add safe reference system
4. Record in ENTITIES.md

### Phase 4: Behavior Extraction
1. Extract contact damage into ContactDamageSystem
2. Extract steering into SteeringSystem
3. Migrate AI behaviors to data-driven
4. Record in ENTITIES.md

---

## Implementation Log

### Phase 1: Foundation - Entity Registry + Components (2026-09-09)

**Implemented:**
1. `src/game/entities/components.ts` - 13 component types (Transform, Velocity, Health, Sprite, Collider, AIState, Combat, Dash, Stamina, Projectile, Item, Interactable, Knockback, Death)
2. `src/game/entities/EntityRegistry.ts` - Entity management with:
   - Stable entity IDs with generation counters
   - Component storage and queries (single/multi-component)
   - Tag-based grouping
   - Safe references that detect destroyed entities
3. `src/game/entities/EntityPool.ts` - Object pooling for frequently created/destroyed entities
4. `src/game/entities/EntityRegistry.test.ts` - 9 tests covering ID uniqueness, component queries, tags, safe refs, pooling

**Duplication/Coupling Removed:**
- ✅ **Stable entity IDs**: Entities now have persistent identifiers that survive array reordering
- ✅ **Safe references**: Generation counters prevent stale pointers to destroyed entities
- ✅ **Component queries**: Systems can query by component type instead of iterating raw arrays
- ✅ **Tag-based grouping**: Entities can be grouped semantically (enemies, projectiles) without type unions
- ✅ **Object pooling**: Projectiles and particles can be recycled without GC pressure

**What This Enables:**
- Entities can now be composed from components rather than monolithic state objects
- Systems iterate by component presence, not by entity type
- Entity destruction is safe - references become invalid rather than dangling
- High-frequency entities (projectiles) can be pooled to reduce allocations

**Verification:**
- ✅ `npx vitest run src/game/entities/EntityRegistry.test.ts` - 9/9 tests passed
- ✅ TypeScript compilation successful
- ✅ No circular dependencies

---

### Phase 2: Entity Archetypes (2026-09-09)

**Implemented:**
1. `src/game/entities/archetypes.ts` - Data-driven archetype definitions:
   - 10 built-in archetypes: player, wraith, sentinel, adept, boss, projectile, shard, potion, npc, sign
   - Each archetype defines component composition and initial values
   - New archetypes can be added as plain objects without touching core systems
2. `src/game/entities/EntityFactory.ts` - Entity spawning and lifecycle:
   - Spawns entities from archetype names or objects
   - Applies component overrides at spawn time
   - Manages projectile pooling via EntityPool
   - Handles despawning with automatic pool recycling
3. `src/game/entities/EntityFactory.test.ts` - 10 comprehensive tests covering spawning, tags, overrides, pooling, and boss cooldowns

**Duplication/Coupling Removed:**
- ✅ **Data-driven definitions**: Entity stats now live in archetypes, not scattered across constants
- ✅ **Single spawn point**: EntityFactory replaces ad-hoc entity creation throughout the codebase
- ✅ **Automatic pooling**: Projectiles transparently use pool without caller awareness
- ✅ **Extensible archetypes**: New entity types require only adding an archetype object
- ✅ **Dead code removal**: Removed unused `drawItems` and `drawEnemies` from renderer (replaced by Y-sorted `drawSortedWorldObjects`)

**What This Enables:**
- Designers can define new entities by composing components in archetypes
- Runtime spawning uses a single, testable factory
- Object pooling reduces GC pressure for high-frequency entities
- Entity lifecycle (spawn/despawn) is centralized

**Verification:**
- ✅ `npx vitest run src/game/entities` - 19/19 tests passed (9 registry + 10 factory)
- ✅ `npx tsc --noEmit` - clean (zero errors)
- ✅ `npm run build` - successful (56 modules, 976.67 kB bundle)
- ✅ No circular dependencies

**Files Added:**
- `src/game/entities/archetypes.ts` (225 lines)
- `src/game/entities/EntityFactory.ts` (153 lines)
- `src/game/entities/EntityFactory.test.ts` (133 lines)
- `src/game/entities/index.ts` (updated exports)

---

### Phase 3 pre-record: shared enemy-body behavior (2026-09-09)

The regular-enemy and boss AI paths duplicate two gameplay formulas while differing
only in configuration:

1. **Contact damage eligibility and range:** `AISystem.ts:104` uses a two-pixel
   contact margin, while `AISystem.ts:158` uses a four-pixel contact margin.
2. **Velocity steering:** `AISystem.ts:100-102` and `AISystem.ts:129-131` repeat
   `enemy.vx += (mvx - enemy.vx) * Math.min(1, dt * 12)`.

The new modules below expose those calculations in a shape usable by both the
legacy `EnemyLike` objects and the component model. They deliberately do not yet
change projectile ownership, map spawning, rendering, or the engine update order.

### Phase 3 outcome: shared enemy-body behavior (2026-09-09)

**Implemented:**
1. `src/game/systems/contactDamage.ts` — one contact-damage formula with a configurable margin.
2. `src/game/systems/steering.ts` — one exponential velocity-steering formula.
3. `src/game/systems/AISystem.ts` — regular-enemy and boss paths now call those shared helpers.
4. Added six behavior-level tests covering damage eligibility, margins, responsiveness, snapping, and both-axis steering.

**Duplication/coupling removed:**
- ✅ Removed one duplicated contact-damage predicate by replacing it with two margin-configured calls.
- ✅ Removed one duplicated steering formula by replacing two manual integrations with `steerXY`.
- ✅ Kept existing boss/gameplay differences as explicit margin configuration instead of implicit code forks.

**Verification:**
- ✅ `npx vitest run` — 13 files, 39 tests passed.
- ✅ `npx tsc --noEmit` — clean.
- ✅ `npm run build` — successful, 58 modules.

## Next Steps

Phase 3 will focus on behavior extraction:
- Extract contact damage logic into a ContactDamageSystem
- Extract steering behaviors into a SteeringSystem  
- Migrate AI behaviors to data-driven configuration
- Record outcomes in ENTITIES.md

---


