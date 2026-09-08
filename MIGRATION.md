To decouple the monolithic `engine.ts` (currently managing window listeners, map rendering, collision loops, AI, physics, rendering pipelines, and HUD callbacks), the engine will be decomposed into dedicated, single-responsibility subsystems under `src/game/`.

---

### Target Directory Architecture

```text
src/game/
├── core/
│   ├── Game.ts             # Lightweight lifecycle coordinator & RAF loop
│   ├── EventBus.ts         # Internal pub/sub for decoupling subsystems
│   └── SpatialGrid.ts      # Spatial hash partition for O(1) collision lookups
├── systems/
│   ├── InputSystem.ts      # Window listeners, key mapping, input buffering
│   ├── MovementSystem.ts   # Velocity, knockback, sub-step collision & sliding
│   ├── CombatSystem.ts     # Hitbox queries, damage resolution, invulnerability
│   ├── AISystem.ts         # Enemy behavioral steering, timers, and attacks
│   ├── ParticleSystem.ts   # Object-pooled particle management & simulation
│   └── CameraSystem.ts     # Deadzones, clamped world bounds, and screen shake
├── entities/
│   ├── EntityManager.ts    # Entity collections, lifecycles, and depth sorting
│   ├── Player.ts           # State machine & struct definition for the player
│   └── Enemy.ts            # Enemy definitions, stats, and type configurations
└── render/
    └── renderer.ts         # Pure rendering pipeline (canvas context & draw passes)

```

---

### Subsystem Breakdown & Implementation Design

#### 1. Spatial Partitioning (`core/SpatialGrid.ts`)

Currently, attacks and projectile collisions run nested $O(N)$ linear scans against all enemies.

* **Cell Grid:** A fixed grid based on tile size or bucket size (e.g., $64 \times 64$ pixels).
* **Methods:**
* `insert(entity: Collidable): void`
* `update(entity: Collidable): void`
* `queryCircle(x: number, y: number, radius: number): Collidable[]`
* `queryRect(rect: Rect): Collidable[]`


* **Lifecycle:** Cleared and populated at the start of each simulation frame or updated incrementally upon entity movement.

#### 2. Input System (`systems/InputSystem.ts`)

Isolates DOM event listener lifecycles from gameplay code.

* **Responsibilities:**
* Listens for `keydown`, `keyup`, and window `blur` events.


* Maintains an active input bitmask or `Set<string>`.


* Exposes continuous directional vectors: `getMovementVector(): Vec`.
* Provides action buffers for `attack`, `dash`, `interact`, and `pause` to prevent dropped frames.


* Clean teardown in `destroy()` to prevent memory leaks across React remounts.





#### 3. Movement & Collision System (`systems/MovementSystem.ts`)

Extracts the continuous collision detection and sliding logic currently implemented as sub-stepped loops in `engine.ts`.

* **Responsibilities:**
* Translates directional intent into pixel movement based on delta time ($dt$).


* Queries map tile solidity (`map.solid` and `wardTiles`) via `tileAtPx`.


* Runs decoupled axis-separated checks (`moveX`, `moveY`) using fixed 2px micro-steps for smooth wall sliding.


* Integrates velocity decay for player knockback (`kx`, `ky`) and enemy knockback (`vx`, `vy`).





#### 4. Combat & Hitbox System (`systems/CombatSystem.ts`)

Decouples attack box creation, hurt-boxes, and damage applications.

* **Responsibilities:**
* Evaluates attack frames, directional hitboxes (`attackBox`), and cooldowns.


* Queries the `SpatialGrid` for valid targets within attack sectors.
* Dispatches hit outcomes: applies damage numbers to floating text, triggers screen shake, applies invulnerability frames (`invuln`), and emits particle events.


* Processes pickup collection (`shards`, `potions`) and unlocks the boss ward when criteria are met.





#### 5. AI System (`systems/AISystem.ts`)

Replaces the `switch(type)` blocks in `updateEnemy` and `updateBoss` with dedicated behavior handlers.

* **Architecture:**
* An interface `EnemyBehavior` declaring `update(enemy: Enemy, context: AIContext, dt: number): void`.
* Specific implementations:
* `WraithBehavior`: Melee pursuit, orbital wander, vertical bobbing.


* `SentinelBehavior`: Aggressive pursuit with higher detection radius.


* `AdeptBehavior`: Distance kiting, strafing, and projectile firing cooldowns.


* `BossBehavior`: Phased state machine managing lunges, radial projectile barrages, and add summoning.







#### 6. Object-Pooled Particle System (`systems/ParticleSystem.ts`)

Eliminates GC pressure from `Array.push` and `Array.splice` operations on `particles`, `projectiles`, and `texts`.

* **Pre-allocated Pools:** Fixed-size pools (e.g., 500 particles, 100 projectiles, 50 text labels).
* **Recycling:** Active and dead index swapping avoids runtime memory allocations during heavy boss bursts or death explosions.



#### 7. Camera & Lighting System (`systems/CameraSystem.ts`)

Extracts viewport framing and screenshake calculation.

* **Responsibilities:**
* Viewport clamping against map pixel dimensions ($MAP\_W \times TILE$, $MAP\_H \times TILE$).


* Smooth target tracking using exponential decay lerping.


* Decaying screenshake offset generation (`lastShakeX`, `lastShakeY`).


* Renders atmospheric lighting masks and objective indicators via canvas passes.





---

### Orchestration Refactoring (`core/Game.ts`)

The root `Game` class becomes an orchestrator that owns instances of each subsystem and executes a clean pipeline:

```typescript
export class Game {
  private input: InputSystem;
  private movement: MovementSystem;
  private combat: CombatSystem;
  private ai: AISystem;
  private particles: ParticleSystem;
  private camera: CameraSystem;
  private grid: SpatialGrid;
  private entities: EntityManager;

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    // Instantiates subsystems and dependencies
  }

  public update(dt: number): void {
    // 1. Process buffered inputs
    this.input.update();

    // 2. Execute AI steering & attack intentions
    this.ai.update(this.entities, dt);

    // 3. Update player & enemy physics/movement
    this.movement.update(this.entities, dt);

    // 4. Update spatial index
    this.grid.rebuild(this.entities.getAllCollidables());

    // 5. Evaluate combat interactions, hitboxes, & projectiles
    this.combat.update(this.entities, this.grid, dt);

    // 6. Step particles and floating text
    this.particles.update(dt);

    // 7. Update camera tracking & shake
    this.camera.update(this.entities.player, dt);

    // 8. Resolve state triggers (dialogue, win/lose, HUD sync)
    this.checkGameEvents();
  }

  public render(): void {
    Renderer.draw({
      ctx: this.ctx,
      camera: this.camera,
      map: this.map,
      staticCanvas: this.staticCanvas,
      entities: this.entities,
      particles: this.particles,
    });
  }
}

```

---

### Step-by-Step Migration Plan

1. **Phase 1A: Pure Math & Spatial Extraction**
* Move geometry, vector, and collision helpers into `src/game/math.ts` and build `core/SpatialGrid.ts`.
* Unit test boundary edge cases in `SpatialGrid`.


2. **Phase 1B: State & Entity Struct Decomposition**
* Create `entities/Player.ts` and `entities/Enemy.ts`.
* Extract state definitions out of `engine.ts` into discrete interfaces.


3. **Phase 1C: System Migration (Loop Isolation)**
* Sequentially extract `InputSystem`, `CameraSystem`, and `ParticleSystem`.
* Keep rendering routines functional by supplying data snapshots through `Renderer.draw()`.


4. **Phase 1D: Physics & Combat Decoupling**
* Extract `MovementSystem` and verify wall sliding against `map.ts` geometry.


* Extract `CombatSystem` and `AISystem`, replacing internal direct mutations with event dispatches.


5. **Phase 1E: Single-File Bundle Verification**
* Run `npm run build` to ensure `vite-plugin-singlefile` bundles the modular imports into `dist/index.html` without tree-shaking regressions or circular dependency overhead.
