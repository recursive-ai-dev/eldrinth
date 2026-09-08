import type { Dir, EnemyType } from "../types";

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
}

export class AISystem {
  updateEnemy(enemy: EnemyLike, dt: number, ctx: AIContext) {
    enemy.t += dt;
    const dx = ctx.player.x - enemy.x;
    const dy = ctx.player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;

    if (enemy.type === "boss") {
      this.updateBoss(enemy, dt, dist, ux, uy, ctx);
      return;
    }

    let mvx = 0;
    let mvy = 0;
    if (enemy.telegraphTimer > 0) enemy.telegraphTimer -= dt;
    if (enemy.type === "wraith") {
      if (dist < 260) {
        mvx = ux * enemy.speed;
        mvy = uy * enemy.speed;
      } else {
        enemy.wanderA += dt;
        mvx = Math.cos(enemy.wanderA * 0.7) * enemy.speed * 0.3;
        mvy = Math.sin(enemy.wanderA * 0.9) * enemy.speed * 0.3;
      }
      enemy.bob = Math.sin(enemy.t * 4) * 3;
    } else if (enemy.type === "sentinel") {
      if (dist < 320) {
        mvx = ux * enemy.speed;
        mvy = uy * enemy.speed;
      }
    } else if (enemy.type === "adept") {
      enemy.shootCd -= dt;
      if (dist < 360) {
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

    const steering = Math.min(1, dt * 12);
    enemy.vx += (mvx - enemy.vx) * steering;
    enemy.vy += (mvy - enemy.vy) * steering;

    if (ctx.player.dying <= 0 && ctx.player.invuln <= 0 && !ctx.player.dashing && dist < enemy.r + ctx.player.r - 2) {
      ctx.onDamagePlayer(enemy.dmg, enemy.x, enemy.y);
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

    const steering = Math.min(1, dt * 12);
    enemy.vx += (mvx - enemy.vx) * steering;
    enemy.vy += (mvy - enemy.vy) * steering;

    if (enemy.telegraph === "lunge" && enemy.telegraphTimer <= 0) {
      enemy.telegraph = null;
      enemy.lungeCd = 4 + Math.random() * 1.2;
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

    if (ctx.player.dying <= 0 && ctx.player.invuln <= 0 && !ctx.player.dashing && dist < enemy.r + ctx.player.r - 4) {
      ctx.onDamagePlayer(enemy.dmg, enemy.x, enemy.y);
    }
  }
}
