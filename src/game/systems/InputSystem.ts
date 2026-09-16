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

  private handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (!this.keys.has(key)) this.pressed.add(key);
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
