export type InputHandler = (event: KeyboardEvent) => void;
export type InputBlurHandler = () => void;

export class InputSystem {
  public readonly keys = new Set<string>();

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
    this.keydownHandler = null;
    this.keyupHandler = null;
    this.blurHandler = null;
  }

  clear() {
    this.keys.clear();
  }

  has(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    this.keys.add(event.key.toLowerCase());
    this.keydownHandler?.(event);
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.key.toLowerCase());
    this.keyupHandler?.(event);
  };

  private handleBlur = () => {
    this.keys.clear();
    this.blurHandler?.();
  };
}
