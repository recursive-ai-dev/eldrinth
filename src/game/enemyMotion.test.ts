import { beforeAll, describe, expect, it } from "vitest";
import { bootGame, installHeadlessDom } from "./headlessGame";

describe("enemy locomotion", () => {
  beforeAll(() => installHeadlessDom());

  /**
   * Steady-state speed of a chasing enemy, measured over one second of real
   * fixed-step simulation. The target is teleported ahead each step so the
   * enemy never arrives and the window is pure pursuit.
   */
  async function measuredSpeed(type: "sentinel" | "adept" | "wraith") {
    const game = await bootGame();
    const enemy = game.makeEnemy(type, game.player.x + 200, game.player.y);
    enemy.x = game.player.x + 200;
    enemy.y = game.player.y;
    const startX = enemy.x;
    // Warm up past the steering ramp, then measure.
    for (let i = 0; i < 30; i++) {
      game.player.x = enemy.x + 240;
      game.updateEnemy(enemy, 1 / 60);
    }
    const windowStart = enemy.x;
    for (let i = 0; i < 60; i++) {
      game.player.x = enemy.x + 240;
      game.updateEnemy(enemy, 1 / 60);
    }
    const travelled = enemy.x - windowStart;
    game.destroy();
    return { speed: travelled, configured: enemy.speed, startX };
  }

  it("moves a sentinel at the speed its constant declares", async () => {
    const { speed, configured } = await measuredSpeed("sentinel");
    expect(configured).toBe(90);
    // Single integration of velocity per step. The pre-AI move this replaced
    // pushed the real figure to ~115 px/s.
    expect(speed).toBeGreaterThan(configured * 0.9);
    expect(speed).toBeLessThan(configured * 1.05);
  });

  it("moves an adept at its scaled approach speed, not 1.27x it", async () => {
    const { speed, configured } = await measuredSpeed("adept");
    // Beyond 224px an adept closes at 0.7x its configured speed.
    const intended = configured * 0.7;
    expect(speed).toBeGreaterThan(intended * 0.9);
    expect(speed).toBeLessThan(intended * 1.05);
  });

  it("still flings a struck enemy along the blow", async () => {
    const game = await bootGame();
    const enemy = game.makeEnemy("sentinel", game.player.x + 120, game.player.y);
    game.enemies.push(enemy);
    const before = enemy.x;
    game.hitEnemy(enemy, 1, "right");
    // The chase pulls it back a few frames later, so read the initial impulse.
    let furthest = before;
    for (let i = 0; i < 10; i++) {
      game.updateEnemy(enemy, 1 / 60);
      furthest = Math.max(furthest, enemy.x);
    }
    expect(furthest - before).toBeGreaterThan(8);
    game.destroy();
  });

  it("keeps sliding a corpse out of its knockback after the AI lets go", async () => {
    const game = await bootGame();
    const enemy = game.makeEnemy("sentinel", game.player.x + 200, game.player.y);
    game.enemies.push(enemy);
    game.hitEnemy(enemy, 99, "right");
    expect(enemy.alive).toBe(false);
    const before = enemy.x;
    for (let i = 0; i < 20; i++) game.updateEnemy(enemy, 1 / 60);
    expect(enemy.x).toBeGreaterThan(before);
    game.destroy();
  });
});
