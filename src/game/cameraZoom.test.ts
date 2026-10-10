import { beforeAll, describe, expect, it, vi } from "vitest";
import { bootGame, installHeadlessDom } from "./headlessGame";
import { renderGame } from "./render/renderer";

beforeAll(() => installHeadlessDom());

describe("camera zoom", () => {
  it("starts closer and changes the world viewport without scaling the canvas or HUD", async () => {
    const game = await bootGame();
    expect(game.getCameraZoom()).toBe(1.5);
    expect(game.viewW).toBeCloseTo(1280 / 1.5);
    const backing = [game.canvas.width, game.canvas.height];
    game.setCameraZoom(2);
    expect(game.viewW).toBe(640);
    expect(game.viewH).toBe(360);
    expect([game.canvas.width, game.canvas.height]).toEqual(backing);
    expect(game.player.x - game.cam.x).toBeCloseTo(game.viewW / 2);
    expect(game.player.y - game.cam.y).toBeCloseTo(game.viewH / 2);
    game.resize();
    expect(game.viewW).toBe(640);
    game.destroy();
  });

  it("clamps and rounds preferences while ignoring non-finite values", async () => {
    const game = await bootGame();
    game.setCameraZoom(100);
    expect(game.getCameraZoom()).toBe(2);
    game.setCameraZoom(-100);
    expect(game.getCameraZoom()).toBe(1);
    game.setCameraZoom(1.6);
    expect(game.getCameraZoom()).toBe(1.5);
    game.setCameraZoom(Number.NaN);
    expect(game.getCameraZoom()).toBe(1.5);
    game.destroy();
  });

  it("renders the world and dungeon light circles with the selected scale", async () => {
    const game = await bootGame();
    game.setCameraZoom(2);
    game.map.dark = true;
    const scale = vi.fn();
    const gradient = vi.fn((..._args: number[]) => ({ addColorStop: () => undefined }));
    const original = game.ctx;
    game.ctx = new Proxy(original, {
      get(target, key) {
        if (key === "scale") return scale;
        if (key === "createRadialGradient") return gradient;
        return Reflect.get(target, key);
      },
    });
    // Darkness now punches a detached mask instead of erasing the world. Watch
    // its gradients as well as the main canvas's world transform.
    const create = document.createElement.bind(document);
    const allocate = vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const canvas = create(tagName) as HTMLCanvasElement;
      if (tagName === "canvas") canvas.getContext = (() => game.ctx) as unknown as typeof canvas.getContext;
      return canvas;
    });
    try {
      renderGame(game);
      expect(scale).toHaveBeenCalledWith(2, 2);
      expect(gradient.mock.calls.some((args) => args[5] === 96 * 2)).toBe(true);
    } finally {
      allocate.mockRestore();
      game.destroy();
    }
  });

  it.each([[1920, 1080], [3840, 2160]])("keeps a stationary %i×%i camera warm at the widest selectable zoom", async (width, height) => {
    const game = await bootGame();
    game.canvas.getBoundingClientRect = () => ({ x: 0, y: 0, width, height, top: 0, right: width, bottom: height, left: 0, toJSON: () => ({}) });
    game.player.x = 3200;
    game.player.y = 2240;
    game.setCameraZoom(1);
    renderGame(game);
    const allocate = vi.spyOn(document, "createElement");
    try {
      for (let frame = 0; frame < 3; frame++) renderGame(game);
      expect(allocate).not.toHaveBeenCalled();
    } finally {
      allocate.mockRestore();
      game.destroy();
    }
  });
});
