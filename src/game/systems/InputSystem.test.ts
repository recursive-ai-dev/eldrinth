import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InputSystem } from "./InputSystem";

describe("InputSystem", () => {
  let mockWindow: EventTarget;

  beforeEach(() => {
    mockWindow = new EventTarget();
    vi.stubGlobal("window", mockWindow);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createKeyboardEvent(type: "keydown" | "keyup", key: string): KeyboardEvent {
    const event = new Event(type) as KeyboardEvent;
    Object.defineProperty(event, "key", { value: key, enumerable: true });
    return event;
  }

  it("tracks held keys and queued one-shot pressed inputs", () => {
    const input = new InputSystem();
    input.bind({});

    mockWindow.dispatchEvent(createKeyboardEvent("keydown", " "));

    expect(input.has(" ")).toBe(true);
    expect(input.consumePressed(" ")).toBe(true);
    expect(input.consumePressed(" ")).toBe(false);
    expect(input.has(" ")).toBe(true);

    mockWindow.dispatchEvent(createKeyboardEvent("keyup", " "));
    expect(input.has(" ")).toBe(false);

    input.destroy();
  });

  it("clears both held keys and queued one-shot pressed inputs on blur", () => {
    const input = new InputSystem();
    const onBlur = vi.fn();
    input.bind({ onBlur });

    // Key pressed down just before focus loss (e.g., dash, attack, or pause)
    mockWindow.dispatchEvent(createKeyboardEvent("keydown", "Shift"));
    mockWindow.dispatchEvent(createKeyboardEvent("keydown", " "));

    expect(input.has("Shift")).toBe(true);
    expect(input.has(" ")).toBe(true);

    // Focus is lost
    mockWindow.dispatchEvent(new Event("blur"));

    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(input.has("Shift")).toBe(false);
    expect(input.has(" ")).toBe(false);

    // Refocusing and checking discrete inputs: nothing queued should execute
    expect(input.consumePressed("Shift")).toBe(false);
    expect(input.consumePressed(" ")).toBe(false);

    input.destroy();
  });

  it("does not turn an OS repeat into a fresh choice after dialogue clears input", () => {
    const input = new InputSystem();
    input.bind({});
    mockWindow.dispatchEvent(createKeyboardEvent("keydown", "1"));
    input.clear();
    const repeated = createKeyboardEvent("keydown", "1");
    Object.defineProperty(repeated, "repeat", { value: true });
    mockWindow.dispatchEvent(repeated);
    expect(input.consumePressed("1")).toBe(false);
    mockWindow.dispatchEvent(createKeyboardEvent("keyup", "1"));
    mockWindow.dispatchEvent(createKeyboardEvent("keydown", "1"));
    expect(input.consumePressed("1")).toBe(true);
    input.destroy();
  });

  it("invokes keydown and keyup handlers if registered", () => {
    const input = new InputSystem();
    const onKeyDown = vi.fn();
    const onKeyUp = vi.fn();
    input.bind({ onKeyDown, onKeyUp });

    const downEvent = createKeyboardEvent("keydown", "e");
    mockWindow.dispatchEvent(downEvent);
    expect(onKeyDown).toHaveBeenCalledWith(downEvent);

    const upEvent = createKeyboardEvent("keyup", "e");
    mockWindow.dispatchEvent(upEvent);
    expect(onKeyUp).toHaveBeenCalledWith(upEvent);

    input.destroy();
  });

  it("clears all state and removes listeners on destroy", () => {
    const input = new InputSystem();
    const onKeyDown = vi.fn();
    input.bind({ onKeyDown });

    mockWindow.dispatchEvent(createKeyboardEvent("keydown", "w"));
    expect(input.has("w")).toBe(true);

    input.destroy();

    expect(input.has("w")).toBe(false);
    expect(input.consumePressed("w")).toBe(false);

    mockWindow.dispatchEvent(createKeyboardEvent("keydown", "w"));
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(input.has("w")).toBe(false);
  });

  it("supports programmatic setKey for virtual and touch controls", () => {
    const input = new InputSystem();
    input.bind({});

    input.setKey("w", true);
    expect(input.has("w")).toBe(true);
    expect(input.consumePressed("w")).toBe(true);
    expect(input.consumePressed("w")).toBe(false);
    expect(input.has("w")).toBe(true);

    input.setKey("w", false);
    expect(input.has("w")).toBe(false);

    // Repeated key down doesn't re-trigger consumePressed if already held
    input.setKey("Shift", true);
    input.setKey("Shift", true);
    expect(input.consumePressed("shift")).toBe(true);
    expect(input.consumePressed("shift")).toBe(false);

    input.destroy();
  });
});

