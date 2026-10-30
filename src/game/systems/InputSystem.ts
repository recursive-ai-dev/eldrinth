import { CONTROL_CHANGE_EVENT, CONTROL_STORAGE_KEY, currentControlBindings, mapKeyboardKey, reloadControlBindings, type ControlBindings } from "../controlBindings";
import { gamepadKeys } from "../gamepad";

export type InputHandler = (event: KeyboardEvent) => void;
export type InputBlurHandler = () => void;

export class InputSystem {
  public readonly keys = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly keyboard = new Map<string, string>();
  private readonly virtual = new Set<string>();
  private readonly controller = new Set<string>();
  private previousGamepad = new Set<string>();
  private bindings: ControlBindings = currentControlBindings();
  private blurred = false;
  private suspended = false;
  private baselineGamepad = false;

  private keydownHandler: InputHandler | null = null;
  private keyupHandler: InputHandler | null = null;
  private blurHandler: InputBlurHandler | null = null;

  bind(handlers: {
    onKeyDown?: InputHandler;
    onKeyUp?: InputHandler;
    onBlur?: InputBlurHandler;
  }) {
    this.keydownHandler = handlers.onKeyDown ?? null;
    this.keyupHandler = handlers.onKeyUp ?? null;
    this.blurHandler = handlers.onBlur ?? null;
    this.bindings = currentControlBindings();
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("focus", this.handleFocus);
    window.addEventListener(CONTROL_CHANGE_EVENT, this.handleBindingsChange);
    window.addEventListener("storage", this.handleStorage);
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
    window.removeEventListener("focus", this.handleFocus);
    window.removeEventListener(CONTROL_CHANGE_EVENT, this.handleBindingsChange);
    window.removeEventListener("storage", this.handleStorage);
    this.clear();
    this.previousGamepad.clear();
    this.keydownHandler = null;
    this.keyupHandler = null;
    this.blurHandler = null;
  }

  clear() {
    this.keys.clear();
    this.pressed.clear();
    this.keyboard.clear();
    this.virtual.clear();
    this.controller.clear();
    // Keep the physical controller baseline: opening a menu must not make a
    // held button into a fresh action on the next simulation tick.
  }

  /** Hold all command sources while a UI operation must keep the world paused. */
  setSuspended(suspended: boolean) {
    this.suspended = suspended;
    this.clear();
    if (!suspended) this.baselineGamepad = true;
  }

  has(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  /** Returns a discrete input exactly once; consume it during a simulation tick. */
  consumePressed(key: string): boolean {
    return this.pressed.delete(key.toLowerCase());
  }

  private refreshKey(key: string, discrete = false) {
    const down = this.virtual.has(key) || this.controller.has(key) || [...this.keyboard.values()].includes(key);
    if (down) {
      if (discrete && !this.keys.has(key)) this.pressed.add(key);
      this.keys.add(key);
    } else this.keys.delete(key);
  }

  /** Virtual controls already send canonical commands, independent of bindings. */
  setKey(key: string, isDown: boolean) {
    if (this.suspended) return;
    const k = key.toLowerCase();
    if (isDown) this.virtual.add(k);
    else this.virtual.delete(k);
    this.refreshKey(k, isDown);
  }

  /** Poll on simulation ticks, keeping commands deterministic and edge-triggered. */
  pollGamepad() {
    if (this.suspended || this.blurred || (typeof document !== "undefined" && document.visibilityState === "hidden")) return;
    let next = new Set<string>();
    try {
      const pads = globalThis.navigator?.getGamepads?.();
      const pad = pads ? Array.from(pads).find(candidate => candidate?.connected && candidate.mapping === "standard") : null;
      next = gamepadKeys(pad);
    } catch { /* Disabled Gamepad API leaves keyboard and touch usable. */ }
    if (this.baselineGamepad) {
      this.previousGamepad = next;
      this.baselineGamepad = false;
      return;
    }
    for (const key of this.previousGamepad) if (!next.has(key)) {
      this.controller.delete(key);
      this.refreshKey(key);
    }
    for (const key of next) if (!this.previousGamepad.has(key)) {
      this.controller.add(key);
      this.refreshKey(key, true);
    }
    this.previousGamepad = next;
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    const physical = event.key.toLowerCase();
    const target = event.target as HTMLElement | null;
    // Native editing and button activation belong to the UI, not the game.
    if (this.suspended || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || target?.isContentEditable ||
        target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    if ([" ", "enter", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(physical) &&
        target?.closest?.('button, a[href], [role="button"], [role="tab"]')) return;
    const key = mapKeyboardKey(physical, this.bindings);
    if (key) {
      this.keyboard.set(physical, key);
      // OS repeats after a dialogue clear must not become fresh choices.
      this.refreshKey(key, !event.repeat);
    }
    this.keydownHandler?.(event);
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    const physical = event.key.toLowerCase();
    const canonical = this.keyboard.get(physical);
    this.keyboard.delete(physical);
    if (canonical) this.refreshKey(canonical);
    this.keyupHandler?.(event);
  };

  private handleBindingsChange = () => {
    this.bindings = currentControlBindings();
    this.clear();
  };
  private handleStorage = (event: StorageEvent) => {
    if (event.key !== CONTROL_STORAGE_KEY && event.key !== null) return;
    reloadControlBindings();
    this.handleBindingsChange();
  };
  private handleFocus = () => {
    this.blurred = false;
    this.baselineGamepad = true;
  };
  private handleBlur = () => {
    this.blurred = true;
    this.clear();
    this.blurHandler?.();
  };
}
