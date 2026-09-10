import { describe, expect, it } from "vitest";
import { steerVelocity, steerXY, steeringWeight } from "./steering";

describe("steering", () => {
  it("advances velocity by the configured frame fraction", () => {
    expect(steeringWeight(1 / 60, 12)).toBeCloseTo(0.2, 10);
    expect(steerVelocity(0, 100, 1 / 60, 12)).toBeCloseTo(20, 10);
  });

  it("snaps to the desired velocity when the simulation step is large", () => {
    expect(steerVelocity(10, 100, 1, 12)).toBe(100);
  });

  it("steers both axes without overshooting", () => {
    const velocity = { vx: -40, vy: 30 };
    steerXY(velocity, { x: 80, y: -30 }, 1 / 120, 12);

    expect(velocity.vx).toBeCloseTo(-28, 10);
    expect(velocity.vy).toBeCloseTo(24, 10);
  });
});
