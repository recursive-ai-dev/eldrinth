import { beforeAll, describe, expect, it, vi } from "vitest";
import { WARDEN_STYLES, wardenAttackDirections, wardenStyleForRegion } from "./wardens";
import { AISystem, type AIContext, type EnemyLike } from "./systems/AISystem";
import { FORTRESS_LAYOUTS } from "./fortressLayouts";
import { generateMap } from "./map";
import { bootGame, installHeadlessDom } from "./headlessGame";
import { WorldState } from "./core/WorldState";
import type { RegionExit } from "./types";
import { renderGame } from "./render/renderer";

function warden(): EnemyLike {
  return { id: 1, type: "sentinel", elite: true, x: 0, y: 0, r: 13, hp: 9, maxHp: 9, speed: 100, dmg: 2,
    vx: 0, vy: 0, hurt: 0, t: 0, shootCd: 0, lungeCd: 0, lungeTimer: 0, lungeVx: 0, lungeVy: 0,
    burstCd: 2.4, summonCd: 8, telegraph: null, telegraphTimer: 0, wanderA: 0, bob: 0, alive: true, dying: 0 };
}

function context(regionId: string): AIContext {
  return { regionId, player: { x: 150, y: 0, r: 11, dying: 0, invuln: 0, dashing: false }, onShoot: vi.fn(),
    onBossBurst: vi.fn(), onSummonAdd: vi.fn(), onDamagePlayer: vi.fn() };
}

describe("regional warden rules", () => {
  it("assigns a regional style to all nine existing fortress wardens", () => {
    expect(Object.keys(FORTRESS_LAYOUTS)).toHaveLength(9);
    for (const id of Object.keys(FORTRESS_LAYOUTS)) {
      expect(wardenStyleForRegion(id)).not.toBeNull();
      const map = generateMap(id);
      expect(map.enemySpawns.filter(enemy => enemy.elite)).toHaveLength(1);
    }
    expect(wardenStyleForRegion("interior.ilyarael-a")).toBeNull();
    expect(wardenStyleForRegion("unknown-future-region")).toBeNull();
  });

  for (const [id, style] of Object.entries(WARDEN_STYLES)) {
    const regionId = id === "old-lands" ? "overworld" : id;
    it(`${id} waits for its full warning and grants a recovery window`, () => {
      const ai = new AISystem();
      const enemy = warden();
      const ctx = context(regionId);
      ai.updateEnemy(enemy, 1 / 60, ctx);
      expect(enemy.telegraph).toBe(style.telegraph);
      expect(enemy.telegraphTimer).toBe(style.windup);
      expect(ctx.onShoot).not.toHaveBeenCalled();
      expect(enemy.vx).toBe(0);
      ai.updateEnemy(enemy, style.windup - 0.01, ctx);
      expect(enemy.telegraph).toBe(style.telegraph);
      expect(ctx.onShoot).not.toHaveBeenCalled();
      ai.updateEnemy(enemy, 0.02, ctx);
      expect(enemy.telegraph).toBeNull();
      expect(enemy.shootCd).toBe(style.cooldown);
      if (style.pattern === "charge") {
        expect(enemy.lungeTimer).toBe(0.4);
        ai.updateEnemy(enemy, 0.4, ctx);
      }
      expect(enemy.lungeCd).toBeGreaterThan(0.6);
      ai.updateEnemy(enemy, 0.1, ctx);
      expect(enemy.telegraph).toBeNull();
      expect(enemy.vx).toBe(0);
    });

    it(`${id} cancels its pending attack inside a settlement's safe area`, () => {
      const ai = new AISystem();
      const enemy = warden();
      const ctx = context(regionId);
      ai.updateEnemy(enemy, 1 / 60, ctx);
      ctx.engagementMultiplier = 0;
      ai.updateEnemy(enemy, 2, ctx);
      expect(enemy.telegraph).toBeNull();
      expect(enemy.lungeTimer).toBe(0);
      expect(enemy.vx).toBe(0);
      expect(ctx.onShoot).not.toHaveBeenCalled();
      expect(ctx.onDamagePlayer).not.toHaveBeenCalled();
    });

    if (style.pattern !== "charge") {
      it(`${id} fires exactly along its locked warning lanes after the target moves`, () => {
        const ai = new AISystem();
        const enemy = warden();
        const ctx = context(regionId);
        ai.updateEnemy(enemy, 1 / 60, ctx);
        ctx.player.x = 0;
        ctx.player.y = 150;
        ai.updateEnemy(enemy, style.windup, ctx);
        const directions = wardenAttackDirections(style, 1, 0);
        expect(ctx.onShoot).toHaveBeenCalledTimes(directions.length);
        for (const direction of directions) {
          expect(ctx.onShoot).toHaveBeenCalledWith(0, 0, direction.x, direction.y, style.speed, 1, style.color);
        }
        ai.updateEnemy(enemy, 0.65, ctx);
        expect(ctx.onShoot).toHaveBeenCalledTimes(directions.length);
      });
    }
  }

  it("commits the charge direction, then stops for recovery without following the player", () => {
    const ai = new AISystem();
    const enemy = warden();
    const ctx = context("fortress.old-lands-vault");
    ai.updateEnemy(enemy, 1 / 60, ctx);
    ctx.player.x = 0;
    ctx.player.y = 150;
    ai.updateEnemy(enemy, 0.85, ctx);
    ai.updateEnemy(enemy, 0.1, ctx);
    expect(enemy.vx).toBe(270);
    expect(enemy.vy).toBe(0);
    ai.updateEnemy(enemy, 0.4, ctx);
    expect(enemy.vx).toBe(0);
    expect(enemy.lungeCd).toBe(0.7);
    expect(ctx.onShoot).not.toHaveBeenCalled();
  });

  it("orbits only the astral warden while ordinary sentinels retain their pursuit", () => {
    const ai = new AISystem();
    const astral = warden();
    astral.shootCd = 2;
    const ordinary = { ...astral, elite: false };
    const ctx = context("starfall-moors");
    ai.updateEnemy(astral, 0.1, ctx);
    ai.updateEnemy(ordinary, 0.1, ctx);
    expect(astral.vx).toBe(0);
    expect(astral.vy).toBe(70);
    expect(ordinary.vx).toBe(100);
    expect(ordinary.vy).toBe(0);
  });

  it("retains dash immunity and contact damage during a charge", () => {
    const ai = new AISystem();
    const enemy = warden();
    enemy.lungeTimer = 0.4;
    enemy.lungeVx = 1;
    const ctx = context("overworld");
    ctx.player.x = 5;
    ctx.player.dashing = true;
    ai.updateEnemy(enemy, 0.01, ctx);
    expect(ctx.onDamagePlayer).not.toHaveBeenCalled();
    ctx.player.dashing = false;
    ai.updateEnemy(enemy, 0.01, ctx);
    expect(ctx.onDamagePlayer).toHaveBeenCalledWith(2, 0, 0);
  });

  it("the ring and cross leave real gaps, and every projectile direction is a unit vector", () => {
    for (const style of Object.values(WARDEN_STYLES)) {
      for (const direction of wardenAttackDirections(style, 0.6, 0.8)) expect(Math.hypot(direction.x, direction.y)).toBeCloseTo(1);
    }
    expect(wardenAttackDirections(WARDEN_STYLES.cinderwild, 1, 0)).toHaveLength(8);
    expect(wardenAttackDirections(WARDEN_STYLES["moonlit-coast"], 1, 0)).toHaveLength(3);
    expect(wardenAttackDirections(WARDEN_STYLES["starfall-moors"], 1, 0)).toHaveLength(4);
  });
});

describe("warden save compatibility", () => {
  beforeAll(() => installHeadlessDom());

  it("continues a checkpointed wind-up with identical aim, timing and attacks", async () => {
    const game = await bootGame();
    try {
      const gate = game.map.exits.find(exit => exit.targetRegion === "fortress.old-lands-archive")!;
      await (game as unknown as { changeRegion: (exit: RegionExit) => Promise<void> }).changeRegion(gate);
      const enemy = game.enemies.find(enemy => enemy.elite)!;
      expect(enemy).toBeDefined();
      const ai = new AISystem();
      const ctx = context(game.world.regionId);
      ctx.player.x = enemy.x + 150;
      ctx.player.y = enemy.y;
      enemy.shootCd = 0;
      ai.updateEnemy(enemy, 1 / 60, ctx);
      const restored = new WorldState();
      restored.restore(JSON.parse(JSON.stringify(game.saveWorld())));
      const copied = restored.enemies.find(saved => saved.id === enemy.id)!;
      expect(copied.telegraph).toBe("lunge");
      expect(copied.lungeVx).toBe(1);
      for (let i = 0; i < 90; i++) {
        ai.updateEnemy(enemy, 1 / 60, ctx);
        ai.updateEnemy(copied, 1 / 60, ctx);
      }
      expect(copied).toEqual(enemy);
    } finally { game.destroy(); }
  });

  it("renders each regional warning label and the exact locked attack lanes", async () => {
    const game = await bootGame();
    const fillText = vi.fn();
    const lineTo = vi.fn();
    const noop = () => undefined;
    game.ctx = new Proxy({ fillText, lineTo }, {
      get: (target, key) => {
        if (key === "fillText") return target.fillText;
        if (key === "lineTo") return target.lineTo;
        if (key === "measureText") return () => ({ width: 80 });
        if (key === "createRadialGradient" || key === "createLinearGradient") return () => ({ addColorStop: noop });
        return noop;
      },
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    try {
      const enemy = game.makeEnemy("sentinel", game.player.x + 80, game.player.y);
      enemy.elite = true;
      enemy.lungeVx = 1;
      enemy.lungeVy = 0;
      game.enemies = [enemy];
      for (const [id, style] of Object.entries(WARDEN_STYLES)) {
        game.world.regionId = id === "old-lands" ? "overworld" : id;
        enemy.telegraph = style.telegraph;
        fillText.mockClear();
        lineTo.mockClear();
        renderGame(game);
        expect(fillText).toHaveBeenCalledWith(style.label, enemy.x, enemy.y - enemy.r - 21);
        const length = style.pattern === "charge" ? style.speed * 0.4 : 120;
        for (const direction of wardenAttackDirections(style, 1, 0)) {
          expect(lineTo).toHaveBeenCalledWith(enemy.x + direction.x * length, enemy.y + direction.y * length);
        }
      }
    } finally { game.destroy(); }
  });
});
