import { describe, expect, it } from "vitest";
import { gamepadKeys } from "./gamepad";

function pad(pressed: number[] = [], axes = [0, 0], mapping: GamepadMappingType = "standard") {
  return { connected: true, mapping, axes, buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: pressed.includes(index), touched: false, value: pressed.includes(index) ? 1 : 0 })) };
}

describe("standard controller mapping", () => {
  it("provides movement from the stick and D-pad with a drift deadzone", () => {
    expect([...gamepadKeys(pad([], [0.2, -0.25]))]).toEqual([]);
    expect([...gamepadKeys(pad([], [-0.8, 0.9]))]).toEqual(["s", "a"]);
    expect([...gamepadKeys(pad([12, 15]))]).toEqual(["w", "d"]);
  });
  it("maps face buttons, shoulders and Start to canonical commands", () => {
    expect([...gamepadKeys(pad([0, 1, 2, 3, 4, 5, 9]))]).toEqual(["j", "shift", "e", "r", "f", "q", "escape"]);
  });
  it("does not guess unfamiliar mappings or disconnected devices", () => {
    expect(gamepadKeys(pad([0], [1, 1], "")).size).toBe(0);
    expect(gamepadKeys({ ...pad([0]), connected: false }).size).toBe(0);
    expect(gamepadKeys(null).size).toBe(0);
  });
});
