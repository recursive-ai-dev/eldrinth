import { describe, expect, it } from "vitest";
import { WorldState } from "./WorldState";

describe("WorldState snapshots", () => {
  it("round-trips mutable simulation state without retaining save references", () => {
    const world = new WorldState();
    world.player = {
      x: 1, y: 2, r: 3, hp: 4, maxHp: 6, stamina: 7, maxStamina: 8,
      staminaRegenDelay: 0, dir: "down", speed: 1, attackTimer: 0, attackCd: 0,
      attackDur: 0, attacking: false, swingHit: new Set([5]), swingDmg: 1,
      invuln: 0, dashTimer: 0, dashCd: 0, dashDir: "down", dashing: false,
      walkT: 0, hurtFlash: 0, kx: 0, ky: 0, dying: 0,
    };
    world.enemies = [{
      id: 5, type: "wraith", x: 1, y: 2, r: 3, hp: 4, maxHp: 4, speed: 1, dmg: 1,
      vx: 0, vy: 0, hurt: 0, t: 0, shootCd: 0, lungeCd: 0, lungeTimer: 0,
      lungeVx: 0, lungeVy: 0, burstCd: 0, summonCd: 0, telegraph: null,
      telegraphTimer: 0, wanderA: 0, bob: 0, alive: true, dying: 0,
    }];
    world.boss = world.enemies[0];
    const snapshot = world.snapshot();
    world.player.hp = 0;

    const restored = new WorldState();
    restored.restore(snapshot);

    expect(restored.player.hp).toBe(4);
    expect(restored.player.swingHit).toEqual(new Set([5]));
    expect(restored.boss).toBe(restored.enemies[0]);
  });
});
