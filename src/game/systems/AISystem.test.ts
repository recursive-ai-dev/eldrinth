import { describe, expect, it, vi } from "vitest";
import { AISystem, type EnemyLike } from "./AISystem";

function enemy(type: EnemyLike["type"]): EnemyLike {
  return {
    id: 1,
    type,
    x: 0,
    y: 0,
    r: type === "boss" ? 26 : 13,
    hp: type === "boss" ? 42 : 4,
    maxHp: type === "boss" ? 42 : 4,
    speed: type === "boss" ? 46 : 70,
    dmg: 1,
    vx: 0,
    vy: 0,
    hurt: 0,
    t: 0,
    shootCd: type === "adept" ? 0 : 1,
    lungeCd: type === "boss" ? 0 : 4,
    lungeTimer: 0,
    lungeVx: 0,
    lungeVy: 0,
    burstCd: type === "boss" ? 10 : 4,
    summonCd: 10,
    telegraph: null,
    telegraphTimer: 0,
    wanderA: 0,
    bob: 0,
    alive: true,
    dying: 0,
  };
}

function context(onShoot = vi.fn(), onText = vi.fn()) {
  return {
    player: { x: 100, y: 0, r: 11, dying: 0, invuln: 0, dashing: false },
    onShoot,
    onBossBurst: vi.fn(),
    onSummonAdd: vi.fn(),
    onDamagePlayer: vi.fn(),
    onText,
    onShake: vi.fn(),
  };
}

describe("AISystem attack telegraphs", () => {
  it("delays adept fire until the spell telegraph expires", () => {
    const ai = new AISystem();
    const adept = enemy("adept");
    const onShoot = vi.fn();
    const ctx = context(onShoot);

    ai.updateEnemy(adept, 0.016, ctx);
    expect(adept.telegraph).toBe("spell");
    expect(onShoot).not.toHaveBeenCalled();

    ai.updateEnemy(adept, 0.45, ctx);
    expect(adept.telegraph).toBeNull();
    expect(onShoot).toHaveBeenCalledOnce();
  });

  it("delays boss lunge until the warning expires", () => {
    const ai = new AISystem();
    const boss = enemy("boss");
    const onText = vi.fn();
    const ctx = context(vi.fn(), onText);

    ai.updateEnemy(boss, 0.016, ctx);
    expect(boss.telegraph).toBe("lunge");
    expect(boss.lungeTimer).toBe(0);

    ai.updateEnemy(boss, 0.65, ctx);
    expect(boss.telegraph).toBeNull();
    expect(boss.lungeTimer).toBe(0.5);
    expect(onText).toHaveBeenCalledOnce();
  });
});
