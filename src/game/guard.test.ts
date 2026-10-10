import { describe, expect, it } from "vitest";
import { consumeRiposte, GUARD_COST, GUARD_WINDOW, startGuard, tickGuard, tryParry, type GuardState } from "./guard";

const player = (): GuardState => ({ x: 0, y: 0, dir: "right", stamina: 100, maxStamina: 100, staminaRegenDelay: 0, invuln: 0, dying: 0, dashing: false, attacking: false });

describe("Last Breath guard", () => {
  it("commits stamina once and cannot be spammed through cooldown", () => {
    const p = player();
    expect(startGuard(p)).toBe(true);
    expect(p.stamina).toBe(100 - GUARD_COST);
    expect(startGuard(p)).toBe(false);
    tickGuard(p, GUARD_WINDOW + 0.01);
    expect(tryParry(p, 10, 0)).toBe(false);
    expect(startGuard(p)).toBe(false);
    tickGuard(p, 1);
    expect(startGuard(p)).toBe(true);
  });

  it("requires facing the blow and gives one timed riposte on success", () => {
    const p = player();
    startGuard(p);
    expect(tryParry(p, -10, 0)).toBe(false);
    expect(tryParry(p, 0, 10)).toBe(false);
    expect(tryParry(p, 10, 5)).toBe(true);
    expect(p.stamina).toBe(94);
    expect(p.parryCount).toBe(1);
    expect(p.invuln).toBeGreaterThan(0);
    expect(tryParry(p, 10, 0)).toBe(false);
    expect(consumeRiposte(p)).toBe(2);
    expect(consumeRiposte(p)).toBe(0);
  });

  it("expires the counterstrike and never activates during another commitment", () => {
    for (const blocked of [{ dashing: true }, { attacking: true }, { dying: 1 }, { stamina: 17 }]) {
      const p = { ...player(), ...blocked };
      const before = p.stamina;
      expect(startGuard(p)).toBe(false);
      expect(p.stamina).toBe(before);
    }
    const p = player();
    startGuard(p);
    tryParry(p, 10, 0);
    tickGuard(p, 2.01);
    expect(consumeRiposte(p)).toBe(0);
  });
});
