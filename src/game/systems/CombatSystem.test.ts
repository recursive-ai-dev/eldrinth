import { describe, expect, it } from "vitest";
import { CombatSystem } from "./CombatSystem";

describe("CombatSystem projectiles", () => {
  it("removes a projectile when solid collision consumes it", () => {
    const system = new CombatSystem();
    const projectiles = [{ x: 0, y: 0, vx: 10, vy: 0, r: 2, life: 1, dmg: 1, color: "white" }];

    system.processProjectiles(
      projectiles,
      { x: 100, y: 100, r: 10, dying: 0, invuln: 0, dashing: false },
      0.1,
      () => true,
      () => undefined,
      () => undefined,
    );

    expect(projectiles).toHaveLength(0);
  });

  it("keeps a projectile when solid collision does not consume it", () => {
    const system = new CombatSystem();
    const projectiles = [{ x: 0, y: 0, vx: 10, vy: 0, r: 2, life: 1, dmg: 1, color: "white" }];

    system.processProjectiles(
      projectiles,
      { x: 100, y: 100, r: 10, dying: 0, invuln: 0, dashing: false },
      0.1,
      () => false,
      () => undefined,
      () => undefined,
    );

    expect(projectiles).toHaveLength(1);
  });
});
