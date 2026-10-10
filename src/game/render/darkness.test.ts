import { afterEach, describe, expect, it, vi } from "vitest";
import { drawDarkness, type RenderState } from "./renderer";

afterEach(() => vi.unstubAllGlobals());

function harness() {
  const mainComposites: string[] = [];
  const maskComposites: string[] = [];
  const dimensionWrites: number[] = [];
  const shade = {
    setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    createRadialGradient: vi.fn((..._args: number[]) => ({ addColorStop: vi.fn() })),
    set globalCompositeOperation(value: string) { maskComposites.push(value); },
  };
  let width = 0, height = 0;
  const canvas = {
    get width() { return width; }, set width(value: number) { width = value; dimensionWrites.push(value); },
    get height() { return height; }, set height(value: number) { height = value; dimensionWrites.push(value); },
    getContext: () => shade,
  };
  const createElement = vi.fn(() => canvas);
  vi.stubGlobal("document", { createElement });
  const main = {
    save: vi.fn(), restore: vi.fn(), drawImage: vi.fn(),
    set globalCompositeOperation(value: string) { mainComposites.push(value); },
  };
  const ctx = main as unknown as CanvasRenderingContext2D;
  const game = {
    map: { dark: true, lights: [{ x: 200, y: 100 }] }, player: { x: 100, y: 80 },
    cameraZoom: 2, cam: { x: 10.4, y: 20.3 }, lastShakeX: 2, lastShakeY: -3,
    cssW: 200, cssH: 100, dpr: 2,
  } as RenderState;
  return { ctx, main, shade, game, canvas, createElement, mainComposites, maskComposites, dimensionWrites };
}

describe("fortress darkness compositing", () => {
  it("punches light only out of its mask, preserving the world already on the main canvas", () => {
    const { ctx, main, shade, game, canvas, mainComposites, maskComposites } = harness();
    drawDarkness(game, ctx);
    expect(maskComposites).toContain("destination-out");
    expect(mainComposites).toEqual(["source-over"]);
    expect(main.drawImage).toHaveBeenCalledWith(canvas, 0, 0, 200, 100);
    expect(shade.createRadialGradient).toHaveBeenCalledWith(184, 114, expect.closeTo(28.8), 184, 114, 192);
    expect(shade.createRadialGradient.mock.calls[1][5]).toBe(352);
  });

  it("widens carried light when raised and restores the original radius when shuttered", () => {
    const { ctx, shade, game } = harness();
    game.lanternOn = true;
    drawDarkness(game, ctx);
    expect(shade.createRadialGradient.mock.calls[0][5]).toBe(288);
    expect(shade.createRadialGradient.mock.calls[1][5]).toBe(352);
    shade.createRadialGradient.mockClear();
    game.lanternOn = false;
    drawDarkness(game, ctx);
    expect(shade.createRadialGradient.mock.calls[0][5]).toBe(192);
  });

  it("reuses the mask, clears old holes, and resizes its backing for CSS size and DPR", () => {
    const { ctx, shade, game, canvas, createElement, dimensionWrites } = harness();
    drawDarkness(game, ctx);
    drawDarkness(game, ctx);
    expect(createElement).toHaveBeenCalledTimes(1);
    expect(dimensionWrites).toEqual([400, 200]);
    expect(shade.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, 0, 0);
    Object.assign(game, { cssW: 250, cssH: 110, dpr: 1.5 });
    drawDarkness(game, ctx);
    expect(createElement).toHaveBeenCalledTimes(1);
    expect([canvas.width, canvas.height]).toEqual([375, 165]);
    expect(shade.setTransform).toHaveBeenLastCalledWith(1.5, 0, 0, 1.5, 0, 0);
    expect(shade.clearRect).toHaveBeenCalledTimes(3);
    expect(shade.clearRect).toHaveBeenLastCalledWith(0, 0, 250, 110);
  });

  it("does not allocate or composite a darkness layer on daylight maps", () => {
    const { ctx, main, game, createElement } = harness();
    game.map.dark = false;
    drawDarkness(game, ctx);
    expect(createElement).not.toHaveBeenCalled();
    expect(main.drawImage).not.toHaveBeenCalled();
  });
});
