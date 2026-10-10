import { beforeAll, describe, expect, it } from "vitest";
import { installHeadlessDom, makeHeadlessCanvas, silentCallbacks } from "./headlessGame";
import { Game } from "./engine";
import { generateMap } from "./map";
import { RegionRepository, type RegionSource, type WorldRegion } from "./regions";

/**
 * Dying in a reset-on-death region (a fortress) with the wayfire elsewhere
 * schedules the fortress state for discard, then respawns through an async
 * region load. An autosave landing inside that load used to consume the
 * discard flag, so when the transition finished it stored the half-cleared
 * fortress after all and the reset silently never happened.
 */

beforeAll(() => installHeadlessDom());

const FORTRESS = "fortress.old-lands-archive";

/** Loads any region immediately, except the overworld, which waits for `open()`. */
function gatedSource() {
  let open!: () => void;
  const gate = new Promise<void>((resolve) => { open = resolve; });
  const source: RegionSource = {
    async load(regionId): Promise<WorldRegion> {
      if (regionId === "overworld") await gate;
      return { id: regionId, map: generateMap(regionId) };
    },
  };
  return { source, open };
}

describe("respawning out of a reset-on-death region", () => {
  it("still discards the region when an autosave lands mid-transition", async () => {
    const { source, open } = gatedSource();
    const game = new Game(makeHeadlessCanvas(), silentCallbacks(), new RegionRepository(source));
    game.world.regionId = FORTRESS;
    await game.init();
    expect(game.map.resetOnDeath).toBe(true);

    const overworld = generateMap("overworld");
    game.world.checkpoint = { regionId: "overworld", x: overworld.spawn.x, y: overworld.spawn.y, name: "the arrival road" };
    // Leave the fortress visibly half-cleared.
    game.enemies[0].hp = 1;

    game.player.dying = 0.001;
    game.simulateStep(1 / 60);
    // The respawn is now waiting on the overworld load.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(game.world.regionId).toBe(FORTRESS);
    expect(game.regionTransition).not.toBeNull();

    const autosave = game.saveWorld();
    expect(autosave.regions?.[FORTRESS]).toBeUndefined();

    open();
    for (let i = 0; i < 10 && game.world.regionId !== "overworld"; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(game.world.regionId).toBe("overworld");
    expect(game.regionTransition).toBeNull();
    expect(game.world.regions[FORTRESS]).toBeUndefined();
    expect(game.saveWorld().regions?.[FORTRESS]).toBeUndefined();
    game.destroy();
  });

  it("reports a failed respawn load so the shell protects the last good save", async () => {
    const source: RegionSource = {
      async load(regionId) {
        if (regionId === "overworld") throw new Error("Destination worker failed");
        return { id: regionId, map: generateMap(regionId) };
      },
    };
    const failures: unknown[] = [];
    const game = new Game(makeHeadlessCanvas(), { ...silentCallbacks(), onFatal: error => { failures.push(error); } }, new RegionRepository(source));
    game.world.regionId = FORTRESS;
    await game.init();
    const map = generateMap("overworld");
    game.world.checkpoint = { regionId: "overworld", ...map.spawn, name: "arrival" };
    game.player.dying = 0.001;
    game.simulateStep(1 / 60);
    await game.regionTransition;
    expect(failures).toHaveLength(1);
    expect((failures[0] as Error).message).toBe("Destination worker failed");
    game.destroy();
  });
});
