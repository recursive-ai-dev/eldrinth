import type { Dir } from "../types";

export interface RectHitbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CombatTarget {
  id?: number;
  x: number;
  y: number;
  r: number;
  alive?: boolean;
}

export interface CombatProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  dmg: number;
  color: string;
}

export interface PlayerCombatState {
  x: number;
  y: number;
  dir: Dir;
  swingHit?: Set<number>;
  swingDmg?: number;
}

export interface SwingOptions {
  /** True when terrain blocks the line between the swinger and a target. */
  occluded?: (fromX: number, fromY: number, toX: number, toY: number) => boolean;
}

export class CombatSystem {
  attackBox(player: PlayerCombatState): RectHitbox {
    const L = 42;
    const Wd = 40;
    switch (player.dir) {
      case "right":
        return { x: player.x, y: player.y - Wd / 2, w: L, h: Wd };
      case "left":
        return { x: player.x - L, y: player.y - Wd / 2, w: L, h: Wd };
      case "down":
        return { x: player.x - Wd / 2, y: player.y, w: Wd, h: L };
      case "up":
        return { x: player.x - Wd / 2, y: player.y - L, w: Wd, h: L };
    }
  }

  rectCircle(b: RectHitbox, cx: number, cy: number, cr: number) {
    const nx = Math.max(b.x, Math.min(cx, b.x + b.w));
    const ny = Math.max(b.y, Math.min(cy, b.y + b.h));
    return (cx - nx) ** 2 + (cy - ny) ** 2 < cr * cr;
  }

  resolvePlayerSwing(
    player: PlayerCombatState,
    enemies: CombatTarget[],
    onHit: (enemy: CombatTarget, dmg: number, dir: Dir) => void,
    options?: SwingOptions,
  ) {
    const box = this.attackBox(player);
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (player.swingHit?.has(enemy.id ?? -1)) continue;
      if (!this.rectCircle(box, enemy.x, enemy.y, enemy.r + 2)) continue;
      // The swing box is 42px long and an enemy body stopped against a wall
      // still presents a surface 32px from the player's centre, so the box
      // reaches a full tile through solid rock without a terrain test.
      if (options?.occluded?.(player.x, player.y, enemy.x, enemy.y)) continue;
      player.swingHit?.add(enemy.id ?? -1);
      onHit(enemy, player.swingDmg ?? 1, player.dir);
    }
  }

  processProjectiles(
    projectiles: CombatProjectile[],
    player: { x: number; y: number; r: number; dying: number; invuln: number; dashing: boolean },
    dt: number,
    onSolidHit: (projectile: CombatProjectile) => boolean,
    onPlayerHit: (projectile: CombatProjectile) => void,
    onExpire: (projectile: CombatProjectile) => void,
  ) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      if (pr.life <= 0) {
        onExpire(pr);
        projectiles.splice(i, 1);
        continue;
      }

      // Terrain is resolved before the player. Checked the other way round, a
      // bolt travelling through a wall was consumed by the wall only after it
      // had already been tested against anyone standing flush on the far side,
      // which let it graze them through solid rock.
      if (onSolidHit(pr)) {
        projectiles.splice(i, 1);
        continue;
      }

      if (Math.hypot(pr.x - player.x, pr.y - player.y) < pr.r + player.r && player.dying <= 0 && player.invuln <= 0 && !player.dashing) {
        onPlayerHit(pr);
        projectiles.splice(i, 1);
      }
    }
  }
}
