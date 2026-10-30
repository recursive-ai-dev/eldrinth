import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InputSystem } from "./InputSystem";
import { defaultControlBindings, rebindControl, saveControlBindings } from "../controlBindings";

describe("InputSystem", () => {
  let mockWindow: EventTarget;

  beforeEach(() => {
    mockWindow = new EventTarget();
    vi.stubGlobal("window", mockWindow);
  });

  afterEach(() => {
    saveControlBindings(defaultControlBindings());
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
  it("updates bindings live and clears held state when a key is rebound", () => {
    const input = new InputSystem();
    input.bind({});
    mockWindow.dispatchEvent(createKeyboardEvent("keydown", "w"));
    saveControlBindings(rebindControl(defaultControlBindings(), "up", "z"));
    expect(input.has("w")).toBe(false);
    mockWindow.dispatchEvent(createKeyboardEvent("keydown", "z"));
    expect(input.has("w")).toBe(true);
    expect(input.consumePressed("w")).toBe(true);
    mockWindow.dispatchEvent(createKeyboardEvent("keyup", "z"));
    expect(input.has("w")).toBe(false);
    mockWindow.dispatchEvent(createKeyboardEvent("keydown", "w"));
    expect(input.has("w")).toBe(false);
    input.destroy();
  });

  it("keeps a virtual control held when the matching keyboard key is released", () => {
    const input = new InputSystem();
    input.bind({});
    input.setKey("w", true);
    mockWindow.dispatchEvent(createKeyboardEvent("keydown", "w"));
    mockWindow.dispatchEvent(createKeyboardEvent("keyup", "w"));
    expect(input.has("w")).toBe(true);
    input.setKey("w", false);
    expect(input.has("w")).toBe(false);
    input.destroy();
  });

  it("queues controller actions once and does not retrigger held buttons after a menu clears input", () => {
    let pressed = true;
    vi.stubGlobal("navigator", { getGamepads: () => [{ connected: true, mapping: "standard", axes: [0, 0], buttons: [{ pressed }] }] });
    const input = new InputSystem();
    input.pollGamepad();
    expect(input.has("j")).toBe(true);
    expect(input.consumePressed("j")).toBe(true);
    input.pollGamepad();
    expect(input.consumePressed("j")).toBe(false);
    input.clear();
    input.pollGamepad();
    expect(input.has("j")).toBe(false);
    expect(input.consumePressed("j")).toBe(false);
    pressed = false;
    input.pollGamepad();
    pressed = true;
    input.pollGamepad();
    expect(input.consumePressed("j")).toBe(true);
    input.destroy();
  });

  it("releases controller movement on disconnect without releasing keyboard movement", () => {
    let connected = true;
    vi.stubGlobal("navigator", { getGamepads: () => connected ? [{ connected, mapping: "standard", axes: [1, 0], buttons: [] }] : [] });
    const input = new InputSystem();
    input.bind({});
    input.pollGamepad();
    mockWindow.dispatchEvent(createKeyboardEvent("keydown", "d"));
    connected = false;
    input.pollGamepad();
    expect(input.has("d")).toBe(true);
    mockWindow.dispatchEvent(createKeyboardEvent("keyup", "d"));
    expect(input.has("d")).toBe(false);
    input.destroy();
  });

  it("ignores controller input while blurred and requires release after focus returns", () => {
    let pressed = false;
    vi.stubGlobal("navigator", { getGamepads: () => [{ connected: true, mapping: "standard", axes: [], buttons: [{ pressed }] }] });
    const input = new InputSystem();
    input.bind({});
    mockWindow.dispatchEvent(new Event("blur"));
    pressed = true;
    input.pollGamepad();
    expect(input.consumePressed("j")).toBe(false);
    mockWindow.dispatchEvent(new Event("focus"));
    input.pollGamepad();
    expect(input.consumePressed("j")).toBe(false);
    pressed = false;
    input.pollGamepad();
    pressed = true;
    input.pollGamepad();
    expect(input.consumePressed("j")).toBe(true);
    input.destroy();
  });

  it("suspends keyboard, touch and controller commands during manual saving", () => {
    let pressed = true;
    vi.stubGlobal("navigator", { getGamepads: () => [{ connected: true, mapping: "standard", axes: [], buttons: Array.from({ length: 10 }, (_, index) => ({ pressed: index === 9 && pressed })) }] });
    const input = new InputSystem();
    input.bind({});
    input.setSuspended(true);
    mockWindow.dispatchEvent(createKeyboardEvent("keydown", "Escape"));
    input.setKey("escape", true);
    input.pollGamepad();
    expect(input.consumePressed("escape")).toBe(false);
    input.setSuspended(false);
    input.pollGamepad();
    expect(input.consumePressed("escape")).toBe(false);
    pressed = false;
    input.pollGamepad();
    pressed = true;
    input.pollGamepad();
    expect(input.consumePressed("escape")).toBe(true);
    input.destroy();
  });

});

