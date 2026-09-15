# AI System Reference

This document describes the current enemy behavior system in `src/game/systems/AISystem.ts`.
The AI is intentionally small and data-driven: enemy logic lives in one system file, movement intent is
passed to `MovementSystem` through velocity fields, and all side effects (projectiles, summons, damage,
screen shake, floating text) are emitted through callbacks so the system stays testable and
framework-agnostic.

---

## 1. File layout

```
src/game/systems/
├── AISystem.ts      # Enemy behavior update loop + boss state machine
├── steering.ts      # Velocity smoothing / acceleration helper
└── contactDamage.ts # Contact-damage resolution against the player
```

`AISystem` is owned and driven by `Game` in `src/game/engine.ts`. It is invoked once per fixed simulation
tick after input and before movement.

---

## 2. `EnemyLike` interface

`AISystem` does not import the full `WorldState.EnemyState`; it works against a minimal `EnemyLike`
interface:

```typescript
export interface EnemyLike {
  id: number;
  type: EnemyType;          // "wraith" | "sentinel" | "adept" | "boss"
  x, y: number;             // pixel position
  r: number;                // collision radius
  hp, maxHp: number;
  speed: number;
  dmg: number;
  vx, vy: number;           // current velocity (knockback + intended motion)
  hurt: number;             // hurt-flash timer
  t: number;                // lifetime timer (used for bobbing)
  shootCd: number;          // adept spell cooldown
  lungeCd, lungeTimer: number;
  lungeVx, lungeVy: number;
  burstCd, summonCd: number;
  telegraph: "spell" | "lunge" | "burst" | null;
  telegraphTimer: number;
  wanderA: number;          // wraith wander angle
  bob: number;              // visual bob offset
  alive: boolean;
  dying: number;
}
```

Keeping the interface narrow makes unit tests easy: tests can construct a plain object and pass it
through `updateEnemy` without spinning up the whole engine.

---

## 3. `AIContext`

The system receives everything it needs through a single context object:

```typescript
export interface AIContext {
  player: { x, y, r, dying, invuln, dashing };
  onShoot: (x, y, ux, uy, speed, damage, color) => void;
  onBossBurst: (enemy: EnemyLike) => void;
  onSummonAdd: (enemy: EnemyLike) => void;
  onDamagePlayer: (damage, fx, fy) => void;
  onMessage?: (text: string) => void;
  onText?: (x, y, text, color, size) => void;
  onShake?: (mag: number) => void;
  random?: () => number;          // injected for deterministic tests
  engagementMultiplier?: number;    // difficulty scaling (story < 1 < brutal)
}
```

No DOM, no canvas, no React, no store access. `Game` implements the callbacks and forwards actions to
the appropriate systems (e.g. `onShoot` spawns a projectile, `onBossBurst` delegates to the boss burst
helper in `engine.ts`).

---

## 4. Enemy behaviors

### Wraith

- Aggro radius: 260 px (scaled by `engagementMultiplier`).
- Inside radius: chase the player at full speed.
- Outside radius: slow figure-eight wander using `wanderA`.
- Visual: `bob = sin(t * 4) * 3`.
- Damage: contact only (handled by `contactDamageFor`).

### Sentinel

- Aggro radius: 320 px (scaled by `engagementMultiplier`).
- Inside radius: direct chase at full speed.
- No wander; stops when player is out of range.
- Damage: contact only.
- Elite sentinels are used as fortress wardens (`elite: true` in `EnemySpawn`).

### Adept

- Engagement radius: 360 px.
- Kites the player:
  - Too close (< 168 px): retreat.
  - Too far (> 224 px): approach.
  - Comfortable band: orbit strafe.
- Casts a purple projectile every ~1.7s with a 0.45s "spell" telegraph.
- Damage: projectile + contact.

### Boss (The Unbound)

A simple state machine using `telegraph`/`telegraphTimer`:

1. **Lunge** — telegraph 0.65s, then dash at 380 px/s for 0.5s toward the player.
2. **Radial burst** — telegraph 0.55s, then `onBossBurst` fires 14 projectiles in a circle.
3. **Summon** — once HP drops below 45%, spawns a wraith add every 6.5s via `onSummonAdd`.
4. Base movement: slowly closes distance (46 px/s) when not lunging/telegraphing.

Cooldowns:
- Lunge: 4.0–5.2s (randomized).
- Burst: 2.4s.
- Summon: 6.5s while wounded.

---

## 5. Movement intent

`AISystem` does **not** move entities. It writes intended velocity into `enemy.vx/vy` (blended via
`steerXY` for smooth acceleration), then `MovementSystem` consumes those velocities and resolves wall
sliding and knockback. This separation keeps physics in one place and makes AI easy to test in isolation.

---

## 6. Contact damage

All contact damage is delegated to `src/game/systems/contactDamage.ts`:

```typescript
export function contactDamageFor(
  player: { dying, invuln, dashing, r },
  enemy: { x, y, r, dmg },
  contactPadding?: number
): number | null
```

It returns the enemy's damage if the player is alive, not invulnerable, not dashing, and the circles
overlap (with a small padding). The boss uses a larger padding.

---

## 7. How to add a new enemy behavior

1. Add the type to `EnemyType` in `src/game/types.ts`.
2. Add stats in `src/game/engine.ts` (search for the enemy constant block).
3. Add a branch in `AISystem.updateEnemy`.
4. If the enemy needs projectiles/summons, extend `AIContext` and wire the callback in `Game`.
5. Add a render case in `renderer.ts` if the visual differs from existing sprites.
6. Add unit tests in `src/game/systems/AISystem.test.ts` or a new `*.test.ts` file.

---

## 8. Design notes

- **No behavior classes / strategy map**: the current system uses a plain `if/else` branch. This is
  deliberate for a small roster; once the roster grows past ~6 distinct behaviors, consider extracting
  behavior objects or a registry.
- **Determinism**: `random` is injectable. In production `Game` passes the world's PRNG; in tests a
  seeded or fixed random is passed.
- **Difficulty scaling**: `engagementMultiplier` comes from `DIFFICULTY_TUNING[difficulty].awareness`.
  It only affects aggro/engagement distances, not cooldowns or damage — those are tuned separately.
