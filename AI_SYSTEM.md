Here is a complete, modular draft for the `AISystem` and its behavior contracts. This design completely decouples entity updates from the monolithic `switch (type)` structure in `engine.ts` and introduces explicit steering, state transitions, and attack telegraphs.

---

### 1. Behavior Types & Context (`src/game/ai/types.ts`)

```typescript
import { Enemy, Player, Projectile } from "../types";

export interface AIContext {
  player: Player;
  time: number;
  dt: number;
  spawnProjectile: (p: Omit<Projectile, "id">) => void;
  spawnEnemy: (type: Enemy["type"], x: number, y: number) => void;
  triggerScreenShake: (magnitude: number) => void;
  addFloatingText: (x: number, y: number, text: string, color: string, size: number) => void;
  emitParticles: (x: number, y: number, color: string, count: number) => void;
  damagePlayer: (damage: number, sourceX: number, sourceY: number) => void;
}

export interface EnemyBehavior {
  update(enemy: Enemy, context: AIContext): void;
}

```

---

### 2. Concrete Behaviors (`src/game/ai/behaviors.ts`)

```typescript
import { Enemy } from "../types";
import { AIContext, EnemyBehavior } from "./types";

/**
 * Wraith: Drifts passively when distant, relentlessly pursues when in range,
 * and maintains continuous sinusoidal vertical bobbing[cite: 1].
 */
export class WraithBehavior implements EnemyBehavior {
  private readonly AGGRO_RADIUS = 260; //[cite: 1]

  public update(enemy: Enemy, ctx: AIContext): void {
    const { player, dt } = ctx;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    // Sinusoidal hover bobbing[cite: 1]
    enemy.bob = Math.sin(enemy.t * 4) * 3; //[cite: 1]

    let moveX = 0;
    let moveY = 0;

    if (dist < this.AGGRO_RADIUS) {
      moveX = nx * enemy.speed; //[cite: 1]
      moveY = ny * enemy.speed; //[cite: 1]
    } else {
      enemy.wanderA += dt; //[cite: 1]
      moveX = Math.cos(enemy.wanderA * 0.7) * enemy.speed * 0.3; //[cite: 1]
      moveY = Math.sin(enemy.wanderA * 0.9) * enemy.speed * 0.3; //[cite: 1]
    }

    enemy.intendedMoveX = moveX;
    enemy.intendedMoveY = moveY;

    // Contact damage check[cite: 1]
    this.checkContactDamage(enemy, ctx, dist);
  }

  private checkContactDamage(enemy: Enemy, ctx: AIContext, dist: number): void {
    const { player } = ctx;
    if (player.dying <= 0 && player.invuln <= 0 && !player.dashing) { //[cite: 1]
      if (dist < enemy.r + player.r - 2) { //[cite: 1]
        ctx.damagePlayer(enemy.dmg, enemy.x, enemy.y); //[cite: 1]
      }
    }
  }
}

/**
 * Sentinel: Fast chaser with a wider detection cone and heavy poise[cite: 1].
 */
export class SentinelBehavior implements EnemyBehavior {
  private readonly AGGRO_RADIUS = 320; //[cite: 1]

  public update(enemy: Enemy, ctx: AIContext): void {
    const { player } = ctx;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;

    let moveX = 0;
    let moveY = 0;

    if (dist < this.AGGRO_RADIUS) { //[cite: 1]
      moveX = (dx / dist) * enemy.speed; //[cite: 1]
      moveY = (dy / dist) * enemy.speed; //[cite: 1]
    }

    enemy.intendedMoveX = moveX;
    enemy.intendedMoveY = moveY;

    if (dist < enemy.r + player.r - 2) { //[cite: 1]
      if (player.dying <= 0 && player.invuln <= 0 && !player.dashing) { //[cite: 1]
        ctx.damagePlayer(enemy.dmg, enemy.x, enemy.y); //[cite: 1]
      }
    }
  }
}

/**
 * Adept: Distance kiter with strafing behaviors and projectile spell casting[cite: 1].
 */
export class AdeptBehavior implements EnemyBehavior {
  private readonly FLEE_RADIUS = 168; //[cite: 1]
  private readonly ENGAGE_RADIUS = 224; //[cite: 1]
  private readonly MAX_VISION = 360; //[cite: 1]

  public update(enemy: Enemy, ctx: AIContext): void {
    const { player, dt } = ctx;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    let moveX = 0;
    let moveY = 0;

    enemy.shootCd -= dt; //[cite: 1]

    if (dist < this.MAX_VISION) { //[cite: 1]
      if (dist < this.FLEE_RADIUS) {
        // Backpedal[cite: 1]
        moveX = -nx * enemy.speed * 0.95; //[cite: 1]
        moveY = -ny * enemy.speed * 0.95; //[cite: 1]
      } else if (dist > this.ENGAGE_RADIUS) {
        // Close gap[cite: 1]
        moveX = nx * enemy.speed * 0.7; //[cite: 1]
        moveY = ny * enemy.speed * 0.7; //[cite: 1]
      } else {
        // Perpendicular circle strafe[cite: 1]
        moveX = -ny * enemy.speed * 0.55; //[cite: 1]
        moveY = nx * enemy.speed * 0.55; //[cite: 1]
      }

      // Projectile attack[cite: 1]
      if (enemy.shootCd <= 0) { //[cite: 1]
        enemy.shootCd = 1.7; //[cite: 1]
        ctx.spawnProjectile({
          x: enemy.x,
          y: enemy.y,
          vx: nx * 180, //[cite: 1]
          vy: ny * 180, //[cite: 1]
          r: 6, //[cite: 1]
          life: 3.2, //[cite: 1]
          dmg: 1, //[cite: 1]
          color: "#b06bff", //[cite: 1]
        });
      }
    }

    enemy.intendedMoveX = moveX;
    enemy.intendedMoveY = moveY;

    if (dist < enemy.r + player.r - 2) { //[cite: 1]
      if (player.dying <= 0 && player.invuln <= 0 && !player.dashing) { //[cite: 1]
        ctx.damagePlayer(enemy.dmg, enemy.x, enemy.y); //[cite: 1]
      }
    }
  }
}

/**
 * Boss (The Unbound): Phased state machine executing lunges, radial bursts,
 * and reinforcement summons under 45% HP[cite: 1].
 */
export class BossBehavior implements EnemyBehavior {
  public update(enemy: Enemy, ctx: AIContext): void {
    const { player, dt } = ctx;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    enemy.burstCd -= dt; //[cite: 1]
    enemy.lungeCd -= dt; //[cite: 1]
    enemy.summonCd -= dt; //[cite: 1]

    let moveX = 0;
    let moveY = 0;

    // 1. Resolve active lunging or standard tracking[cite: 1]
    if (enemy.lungeTimer > 0) { //[cite: 1]
      enemy.lungeTimer -= dt; //[cite: 1]
      moveX = enemy.lungeVx; //[cite: 1]
      moveY = enemy.lungeVy; //[cite: 1]
    } else if (dist > 96) { //[cite: 1]
      moveX = nx * enemy.speed; //[cite: 1]
      moveY = ny * enemy.speed; //[cite: 1]
    }

    // 2. Trigger Lunge[cite: 1]
    if (enemy.lungeCd <= 0) { //[cite: 1]
      enemy.lungeCd = 4 + Math.random() * 1.2; //[cite: 1]
      enemy.lungeTimer = 0.5; //[cite: 1]
      enemy.lungeVx = nx * 380; //[cite: 1]
      enemy.lungeVy = ny * 380; //[cite: 1]
      ctx.addFloatingText(enemy.x, enemy.y - 34, "LUNGE", "#ff6a6a", 16); //[cite: 1]
      ctx.triggerScreenShake(6); //[cite: 1]
    }

    // 3. Trigger Radial Burst[cite: 1]
    if (enemy.burstCd <= 0) { //[cite: 1]
      enemy.burstCd = 2.4; //[cite: 1]
      this.executeRadialBurst(enemy, ctx);
    }

    // 4. Trigger Phase 2 Summon Adds (< 45% HP)[cite: 1]
    if (enemy.hp / enemy.maxHp < 0.45 && enemy.summonCd <= 0) { //[cite: 1]
      enemy.summonCd = 6.5; //[cite: 1]
      this.executeSummon(enemy, ctx);
    }

    enemy.intendedMoveX = moveX;
    enemy.intendedMoveY = moveY;

    if (dist < enemy.r + player.r - 4) { //[cite: 1]
      if (player.dying <= 0 && player.invuln <= 0 && !player.dashing) { //[cite: 1]
        ctx.damagePlayer(enemy.dmg, enemy.x, enemy.y); //[cite: 1]
      }
    }
  }

  private executeRadialBurst(enemy: Enemy, ctx: AIContext): void {
    const PROJECTILE_COUNT = 14; //[cite: 1]
    for (let i = 0; i < PROJECTILE_COUNT; i++) { //[cite: 1]
      const angle = (i / PROJECTILE_COUNT) * Math.PI * 2; //[cite: 1]
      ctx.spawnProjectile({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * 150, //[cite: 1]
        vy: Math.sin(angle) * 150, //[cite: 1]
        r: 6, //[cite: 1]
        life: 3.2, //[cite: 1]
        dmg: 1, //[cite: 1]
        color: "#39e0ff", //[cite: 1]
      });
    }
    ctx.triggerScreenShake(5); //[cite: 1]
    ctx.addFloatingText(enemy.x, enemy.y - 34, "BURST", "#7fe0ff", 15); //[cite: 1]
  }

  private executeSummon(enemy: Enemy, ctx: AIContext): void {
    const angle = Math.random() * Math.PI * 2; //[cite: 1]
    const sx = enemy.x + Math.cos(angle) * 60; //[cite: 1]
    const sy = enemy.y + Math.sin(angle) * 60; //[cite: 1]
    ctx.spawnEnemy("wraith", sx, sy); //[cite: 1]
    ctx.emitParticles(sx, sy, "#8fe6b8", 12); //[cite: 1]
    ctx.addFloatingText(enemy.x, enemy.y - 40, "RISE", "#8fe6b8", 15); //[cite: 1]
  }
}

```

---

### 3. AI System Coordinator (`src/game/systems/AISystem.ts`)

```typescript
import { Enemy, Player, Projectile } from "../types";
import { AIContext, EnemyBehavior } from "../ai/types";
import {
  WraithBehavior,
  SentinelBehavior,
  AdeptBehavior,
  BossBehavior,
} from "../ai/behaviors";

export class AISystem {
  private behaviors: Record<Enemy["type"], EnemyBehavior>;

  constructor() {
    this.behaviors = {
      wraith: new WraithBehavior(),
      sentinel: new SentinelBehavior(),
      adept: new AdeptBehavior(),
      boss: new BossBehavior(),
    };
  }

  public update(
    enemies: Enemy[],
    player: Player,
    dt: number,
    time: number,
    callbacks: {
      spawnProjectile: (p: Omit<Projectile, "id">) => void;
      spawnEnemy: (type: Enemy["type"], x: number, y: number) => void;
      triggerScreenShake: (mag: number) => void;
      addFloatingText: (x: number, y: number, text: string, color: string, size: number) => void;
      emitParticles: (x: number, y: number, color: string, count: number) => void;
      damagePlayer: (damage: number, x: number, y: number) => void;
    }
  ): void {
    const context: AIContext = {
      player,
      time,
      dt,
      ...callbacks,
    };

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy.alive || enemy.dying > 0) continue; //[cite: 1]

      enemy.t += dt; //[cite: 1]
      enemy.hurt = Math.max(0, enemy.hurt - dt); //[cite: 1]

      const behavior = this.behaviors[enemy.type];
      if (behavior) {
        behavior.update(enemy, context);
      }
    }
  }
}

```

---

### Key Architectural Improvements

* **Clean Separation of Physics vs Intent:** Behaviors set `intendedMoveX` and `intendedMoveY` rather than calling `this.moveEntity(...)` directly. The upcoming `MovementSystem` consumes these velocities and processes sub-step wall sliding uniformly.


* **Loose Coupling via `AIContext`:** The AI does not touch DOM canvases, HUD states, or array mutations directly; actions dispatch cleanly through callbacks.
* **Extensibility:** Adding future minibosses or environmental summons only requires registering a new `EnemyBehavior` class.
