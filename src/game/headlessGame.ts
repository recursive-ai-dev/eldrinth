import { Game } from "./engine";
import type { GameCallbacks } from "./types";

/**
 * Minimal browser surface for booting a real `Game` outside a browser.
 *
 * The engine only touches `window` for listeners and device pixel ratio, and
 * `document.createElement("canvas")` for the tile-chunk cache, so a stub is
 * enough to run the genuine simulation, collision, AI and combat code in
 * vitest. Sprite atlases resolve immediately because `Image` is undefined,
 * which the atlas loader already treats as "no art yet".
 */
export function installHeadlessDom(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  const noop = () => undefined;
  const ctxStub = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "canvas") return { width: 1280, height: 720 };
        if (prop === "measureText") return () => ({ width: 10 });
        if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => ({ addColorStop: noop });
        if (prop === "createPattern") return () => null;
        if (prop === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
        return noop;
      },
      set: () => true,
    },
  );
  g.HTMLCanvasElement = class {
    width = 1280;
    height = 720;
    style = {};
    getContext() {
      return ctxStub;
    }
    getBoundingClientRect() {
      return { width: 1280, height: 720, top: 0, left: 0, right: 1280, bottom: 720, x: 0, y: 0, toJSON: () => ({}) };
    }
  };
  g.window = {
    addEventListener: noop,
    removeEventListener: noop,
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 720,
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
  };
  g.document = {
    visibilityState: "visible",
    addEventListener: noop,
    removeEventListener: noop,
    createElement: () => new (g.HTMLCanvasElement as new () => object)(),
    body: { appendChild: noop },
  };
  g.devicePixelRatio = 1;
  g.requestAnimationFrame = noop;
  g.cancelAnimationFrame = noop;
}

export function makeHeadlessCanvas(): HTMLCanvasElement {
  const g = globalThis as unknown as { HTMLCanvasElement: new () => HTMLCanvasElement };
  return new g.HTMLCanvasElement();
}

export function silentCallbacks(): GameCallbacks {
  return {
    onHud: () => undefined,
    onDialogue: () => undefined,
    onPause: () => undefined,
    onEnd: () => undefined,
    onJournal: () => undefined,
    onInterior: () => undefined,
  };
}

/** Boots a fully initialized Game on the real overworld. */
export async function bootGame(cb?: GameCallbacks): Promise<Game> {
  const game = new Game(makeHeadlessCanvas(), cb ?? silentCallbacks());
  await game.init();
  return game;
}
