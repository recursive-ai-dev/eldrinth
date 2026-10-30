import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultControlBindings, mapKeyboardKey, normalizeControlBindings, rebindControl, saveControlBindings, currentControlBindings, readControlBindings, CONTROL_CHANGE_EVENT } from "./controlBindings";

afterEach(() => { saveControlBindings(defaultControlBindings()); vi.unstubAllGlobals(); });

describe("keyboard bindings", () => {
  it("maps a replacement to the engine command and retires the old primary key", () => {
    const bindings = rebindControl(defaultControlBindings(), "attack", "K");
    expect(mapKeyboardKey("k", bindings)).toBe("j");
    expect(mapKeyboardKey("j", bindings)).toBeNull();
    expect(mapKeyboardKey(" ", bindings)).toBe(" ");
  });
  it("exchanges conflicting actions without stranding either action", () => {
    const bindings = rebindControl(defaultControlBindings(), "up", "s");
    expect(bindings.up).toBe("s");
    expect(bindings.down).toBe("w");
    expect(mapKeyboardKey("s", bindings)).toBe("w");
    expect(mapKeyboardKey("w", bindings)).toBe("s");
  });
  it("preserves journal and atlas commands when their physical keys move", () => {
    const bindings = rebindControl(defaultControlBindings(), "journal", "m");
    expect(mapKeyboardKey("m", bindings)).toBe("l");
    expect(mapKeyboardKey("l", bindings)).toBe("m");
  });
  it.each(["Escape", "Enter", " ", "Tab", "1", "p", "F11", "Control", "ArrowUp"])("keeps %s available for fixed UI controls", key => {
    expect(() => rebindControl(defaultControlBindings(), "attack", key)).toThrow();
  });
  it("rejects incomplete and duplicate persisted sets together", () => {
    expect(normalizeControlBindings({ up: "z" })).toEqual(defaultControlBindings());
    expect(normalizeControlBindings({ ...defaultControlBindings(), up: "s" })).toEqual(defaultControlBindings());
  });
  it("applies changes for this session even if storage rejects the write", () => {
    const target = new EventTarget();
    const changed = vi.fn();
    target.addEventListener(CONTROL_CHANGE_EVENT, changed);
    vi.stubGlobal("window", target);
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => { throw new Error("blocked"); } });
    const bindings = rebindControl(defaultControlBindings(), "attack", "k");
    expect(saveControlBindings(bindings)).toBe(false);
    expect(currentControlBindings()).toEqual(bindings);
    expect(changed).toHaveBeenCalledOnce();
  });
  it("reads persisted controls and tolerates corrupted JSON", () => {
    const bindings = rebindControl(defaultControlBindings(), "up", "z");
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(bindings) });
    expect(readControlBindings()).toEqual(bindings);
    vi.stubGlobal("localStorage", { getItem: () => "{" });
    expect(readControlBindings()).toEqual(defaultControlBindings());
  });
});
