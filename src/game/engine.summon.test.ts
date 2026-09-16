import { describe, expect, it, vi } from "vitest";
import { Game } from "./engine";

describe("boss summon walkability and terrain collision", () => {
  function makeSummonHarness(isSolidFn: (x: number, y: number) => boolean) {
    const enemies: any[] = [];
    const bursts: any[] = [];
    const texts: any[] = [];

    const ctx = {
      world: {
        nextRandom: () => 0, // Starts pointing at angle 0 (cos=1, sin=0)
      },
      hitsSolid: vi.fn((x: number, y: number, _r: number) => isSolidFn(x, y)),
      solidAtIdx: vi.fn((idx: number) => idx === 999), // arbitrary solid idx
      tileAtPx: vi.fn((x: number, y: number) => (isSolidFn(x, y) ? 999 : 1)),
      makeEnemy: vi.fn((type: string, x: number, y: number) => ({
        type,
        x,
        y,
        r: 12,
        shootCd: 0,
      })),
      enemies,
      burst: vi.fn((x: number, y: number, color: string, count: number) => {
        bursts.push({ x, y, color, count });
      }),
      addText: vi.fn((x: number, y: number, text: string) => {
        texts.push({ x, y, text });
      }),
    };

    return { ctx, enemies, bursts, texts };
  }

  it("spawns wraith at a valid open offset when unobstructed", () => {
    // Completely open terrain
    const { ctx, enemies, bursts } = makeSummonHarness(() => false);
    const boss = { x: 100, y: 100 } as any;

    Game.prototype.summonAdd.call(ctx as any, boss);

    expect(enemies.length).toBe(1);
    expect(enemies[0].type).toBe("wraith");
    // At angle 0 and dist 60: x = 160, y = 100
    expect(enemies[0].x).toBeCloseTo(160);
    expect(enemies[0].y).toBeCloseTo(100);
    expect(bursts[0].x).toBeCloseTo(160);
    expect(bursts[0].y).toBeCloseTo(100);
  });

  it("redirects spawn away from solid wall when fixed 60px offset is blocked", () => {
    // Block x > 150 (e.g. wall to the right of boss)
    const { ctx, enemies } = makeSummonHarness((x: number) => x > 150);
    const boss = { x: 100, y: 100 } as any;

    Game.prototype.summonAdd.call(ctx as any, boss);

    expect(enemies.length).toBe(1);
    // Enemy must NOT be placed in the wall (x > 150)
    expect(enemies[0].x).toBeLessThanOrEqual(150);
    expect(ctx.hitsSolid).toHaveBeenCalled();
  });

  it("falls back to boss position if all candidate radial offsets are solid", () => {
    // Everything around the boss is solid
    const { ctx, enemies } = makeSummonHarness(() => true);
    const boss = { x: 100, y: 100 } as any;

    Game.prototype.summonAdd.call(ctx as any, boss);

    expect(enemies.length).toBe(1);
    // Falls back to boss's position (100, 100)
    expect(enemies[0].x).toBe(100);
    expect(enemies[0].y).toBe(100);
  });
});

