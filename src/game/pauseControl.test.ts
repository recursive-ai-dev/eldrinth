import { beforeAll, describe, expect, it } from "vitest";
import { bootGame, installHeadlessDom, silentCallbacks } from "./headlessGame";
import type { GameCallbacks } from "./types";

describe("pause authority", () => {
  beforeAll(() => installHeadlessDom());

  /**
   * The overlay is driven by `onPause`, and the simulation by `engine.paused`.
   * Both have to move together or the world keeps running behind a pause
   * screen — which is what the touch pause button used to do, because it wrote
   * only the UI store and never reached the engine.
   */
  it("stops the simulation and announces the pause through one call", async () => {
    const pauses: boolean[] = [];
    const cb: GameCallbacks = { ...silentCallbacks(), onPause: (paused) => pauses.push(paused) };
    const game = await bootGame(cb);

    const before = game.world.simulationTime;
    for (let i = 0; i < 60; i++) game.simulateStep(1 / 60);
    expect(game.world.simulationTime - before).toBeCloseTo(1, 5);

    game.togglePause();
    expect(game.paused).toBe(true);
    expect(pauses).toEqual([true]);

    const pausedAt = game.world.simulationTime;
    for (let i = 0; i < 60; i++) game.simulateStep(1 / 60);
    expect(game.world.simulationTime).toBe(pausedAt);

    game.togglePause();
    expect(game.paused).toBe(false);
    expect(pauses).toEqual([true, false]);

    for (let i = 0; i < 60; i++) game.simulateStep(1 / 60);
    expect(game.world.simulationTime - pausedAt).toBeCloseTo(1, 5);
    game.destroy();
  });

  it("drops held keys when pausing so movement does not resume on its own", async () => {
    const game = await bootGame();
    game.input.setKey("d", true);
    game.setPaused(true);
    expect(game.input.has("d")).toBe(false);
    game.destroy();
  });

  it("holds the journal open without advancing the world", async () => {
    const game = await bootGame();
    game.setJournalOpen(true);
    const before = game.world.simulationTime;
    for (let i = 0; i < 30; i++) game.simulateStep(1 / 60);
    expect(game.world.simulationTime).toBe(before);
    game.destroy();
  });
});
