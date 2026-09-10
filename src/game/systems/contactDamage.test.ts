import { describe, expect, it } from "vitest";
import { contactDamageFor } from "./contactDamage";

describe("contactDamageFor", () => {
  it("returns damage when vulnerable circles overlap", () => {
    expect(
      contactDamageFor(
        { x: 100, y: 100, r: 11, dying: 0, invuln: 0, dashing: false },
        { x: 108, y: 100, r: 13, dmg: 2 },
      ),
    ).toBe(2);
  });

  it("returns null when the player is invulnerable, dashing, or defeated", () => {
    const source = { x: 100, y: 100, r: 13, dmg: 1 };
    const base = { x: 100, y: 100, r: 11, dying: 0, invuln: 0, dashing: false };

    expect(contactDamageFor({ ...base, invuln: 0.2 }, source)).toBeNull();
    expect(contactDamageFor({ ...base, dashing: true }, source)).toBeNull();
    expect(contactDamageFor({ ...base, dying: 1 }, source)).toBeNull();
  });

  it("returns null outside contact range and honors the boss margin", () => {
    const player = { x: 100, y: 100, r: 11, dying: 0, invuln: 0, dashing: false };
    const boss = { x: 100, y: 134, r: 26, dmg: 2 };

    expect(contactDamageFor(player, boss)).toBe(2);
    expect(contactDamageFor(player, boss, 4)).toBeNull();
  });
});
