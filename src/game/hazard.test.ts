import { describe, expect, it } from "vitest";
import { T } from "./constants";
import { hazardDamageAt } from "./hazard";

describe("hazardDamageAt", () => {
  it("harms a player standing on embers", () => {
    expect(hazardDamageAt(T.EMBERS, 0)).toBe(1);
  });

  it("does not harm on ordinary floor", () => {
    expect(hazardDamageAt(T.RFLOOR, 0)).toBe(0);
    expect(hazardDamageAt(T.GRASS, 0)).toBe(0);
  });

  it("does not stack with existing invulnerability", () => {
    expect(hazardDamageAt(T.EMBERS, 0.4)).toBe(0);
  });
});
