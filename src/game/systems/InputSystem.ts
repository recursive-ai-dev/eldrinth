export type InputHandler = (event: KeyboardEvent) => void;
export type InputBlurHandler = () => void;

export class InputSystem {
  public readonly keys = new Set<string>();
  private readonly pressed = new Set<string>();

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

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
    this.keys.clear();
    this.pressed.clear();
    this.keydownHandler = null;
    this.keyupHandler = null;
    this.blurHandler = null;
  }

  clear() {
    this.keys.clear();
    this.pressed.clear();
  }

  has(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  /** Returns a discrete input exactly once; consume it during a simulation tick. */
  consumePressed(key: string): boolean {
    return this.pressed.delete(key.toLowerCase());
  }

  /** Programmatically set key down or up (useful for touch, virtual controls, or pointer simulation). */
  setKey(key: string, isDown: boolean) {
    const k = key.toLowerCase();
    if (isDown) {
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
    } else {
      this.keys.delete(k);
    }
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    const target = event.target as HTMLElement | null;
    // Native editing and button activation belong to the UI, not the game.
    if (event.defaultPrevented || target?.isContentEditable ||
        target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    if ([" ", "enter", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key) &&
        target?.closest?.('button, a[href], [role="button"], [role="tab"]')) return;
    // Opening/advancing dialogue clears held state. An OS repeat after that
    // clear must not become a fresh attack, guard, or irreversible choice.
    if (!event.repeat && !this.keys.has(key)) this.pressed.add(key);
    this.keys.add(key);
    this.keydownHandler?.(event);
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    this.keys.delete(key);
    this.keyupHandler?.(event);
  };

  private handleBlur = () => {
    this.clear();
    this.blurHandler?.();
  };
}
