import { afterEach, describe, expect, it, vi } from "vitest";
import { FixedStepLoop } from "./FixedStepLoop";

describe("FixedStepLoop", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("simulates fixed quanta and renders separately", () => {
    let frame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frame = callback;
      return 1;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const simulate = vi.fn();
    const render = vi.fn();
    const loop = new FixedStepLoop({ simulate, render }, 0.01);

    loop.start();
    frame?.(1000); // establishes the wall-clock origin
    frame?.(1025); // two 10 ms simulation ticks, then one render

    expect(simulate).toHaveBeenCalledTimes(2);
    expect(simulate).toHaveBeenNthCalledWith(1, 0.01);
    expect(render).toHaveBeenCalledTimes(2);
  });
});
