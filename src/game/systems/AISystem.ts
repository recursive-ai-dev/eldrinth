import type { EnemyType } from "../types";
import { contactDamageFor } from "./contactDamage";
import { steerXY } from "./steering";

export interface EnemyLike {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  vx: number;
  vy: number;
  hurt: number;
  t: number;
  shootCd: number;
  lungeCd: number;
  lungeTimer: number;
  lungeVx: number;
  lungeVy: number;
  burstCd: number;
  summonCd: number;
  telegraph: "spell" | "lunge" | "burst" | null;
  telegraphTimer: number;
  wanderA: number;
  bob: number;
  alive: boolean;
  dying: number;
}

export interface AIContext {
  player: { x: number; y: number; r: number; dying: number; invuln: number; dashing: boolean };
  onShoot: (x: number, y: number, ux: number, uy: number, speed: number, damage: number, color: string) => void;
  onBossBurst: (enemy: EnemyLike) => void;
  onSummonAdd: (enemy: EnemyLike) => void;
  onDamagePlayer: (damage: number, fx: number, fy: number) => void;
  onMessage?: (text: string) => void;
  onText?: (x: number, y: number, text: string, color: string, size: number) => void;
  onShake?: (mag: number) => void;
  random?: () => number;
  /** Scales how close a non-boss enemy must be before it commits to combat. */
  engagementMultiplier?: number;
}

export class AISystem {
  updateEnemy(enemy: EnemyLike, dt: number, ctx: AIContext) {
    enemy.t += dt;
    const dx = ctx.player.x - enemy.x;
    const dy = ctx.player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const awareness = ctx.engagementMultiplier ?? 1;

    if (enemy.type === "boss") {
      this.updateBoss(enemy, dt, dist, ux, uy, ctx);
      return;
    }

    let mvx = 0;
    let mvy = 0;
    if (enemy.telegraphTimer > 0) enemy.telegraphTimer -= dt;
    if (enemy.type === "wraith") {
      if (dist < 260 * awareness) {
        mvx = ux * enemy.speed;
        mvy = uy * enemy.speed;
      } else {
        enemy.wanderA += dt;
        mvx = Math.cos(enemy.wanderA * 0.7) * enemy.speed * 0.3;
        mvy = Math.sin(enemy.wanderA * 0.9) * enemy.speed * 0.3;
      }
      enemy.bob = Math.sin(enemy.t * 4) * 3;
    } else if (enemy.type === "sentinel") {
      if (dist < 320 * awareness) {
        mvx = ux * enemy.speed;
        mvy = uy * enemy.speed;
      }
    } else if (enemy.type === "adept") {
      enemy.shootCd -= dt;
      if (dist < 360 * awareness) {
        if (dist < 168) {
          mvx = -ux * enemy.speed * 0.95;
          mvy = -uy * enemy.speed * 0.95;
        } else if (dist > 224) {
          mvx = ux * enemy.speed * 0.7;
          mvy = uy * enemy.speed * 0.7;
        } else {
          mvx = -uy * enemy.speed * 0.55;
          mvy = ux * enemy.speed * 0.55;
        }
        if (enemy.telegraph === "spell" && enemy.telegraphTimer <= 0) {
          enemy.telegraph = null;
          enemy.shootCd = 1.7;
          ctx.onShoot(enemy.x, enemy.y, ux, uy, 180, 1, "#b06bff");
        } else if (!enemy.telegraph && enemy.shootCd <= 0) {
          enemy.telegraph = "spell";
          enemy.telegraphTimer = 0.45;
        }
      }
    }

    steerXY(enemy, { x: mvx, y: mvy }, dt);

    const contactDamage = contactDamageFor(ctx.player, enemy);
    if (contactDamage !== null) {
      ctx.onDamagePlayer(contactDamage, enemy.x, enemy.y);
    }
  }

  private updateBoss(enemy: EnemyLike, dt: number, dist: number, ux: number, uy: number, ctx: AIContext) {
    enemy.burstCd -= dt;
    enemy.lungeCd -= dt;
    enemy.summonCd -= dt;

    let mvx = 0;
    let mvy = 0;
    if (enemy.telegraphTimer > 0) enemy.telegraphTimer -= dt;
    if (enemy.telegraph) {
      mvx = 0;
      mvy = 0;
    } else if (enemy.lungeTimer > 0) {
      enemy.lungeTimer -= dt;
      mvx = enemy.lungeVx;
      mvy = enemy.lungeVy;
    } else if (dist > 96) {
      mvx = ux * enemy.speed;
      mvy = uy * enemy.speed;
    }

    steerXY(enemy, { x: mvx, y: mvy }, dt);

    if (enemy.telegraph === "lunge" && enemy.telegraphTimer <= 0) {
      enemy.telegraph = null;
      enemy.lungeCd = 4 + (ctx.random?.() ?? 0.5) * 1.2;
      enemy.lungeTimer = 0.5;
      enemy.lungeVx = ux * 380;
      enemy.lungeVy = uy * 380;
      ctx.onText?.(enemy.x, enemy.y - 34, "LUNGE", "#ff6a6a", 16);
      ctx.onShake?.(6);
    } else if (!enemy.telegraph && enemy.lungeCd <= 0) {
      enemy.telegraph = "lunge";
      enemy.telegraphTimer = 0.65;
    }
    if (enemy.telegraph === "burst" && enemy.telegraphTimer <= 0) {
      enemy.telegraph = null;
      enemy.burstCd = 2.4;
      ctx.onBossBurst(enemy);
    } else if (!enemy.telegraph && enemy.burstCd <= 0) {
      enemy.telegraph = "burst";
      enemy.telegraphTimer = 0.55;
    }
    if (enemy.hp / enemy.maxHp < 0.45 && enemy.summonCd <= 0) {
      enemy.summonCd = 6.5;
      ctx.onSummonAdd(enemy);
    }

    const bossContactDamage = contactDamageFor(ctx.player, enemy, 4);
    if (bossContactDamage !== null) {
      ctx.onDamagePlayer(bossContactDamage, enemy.x, enemy.y);
    }
  }
}
