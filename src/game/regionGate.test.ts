import { beforeAll, describe, expect, it } from "vitest";
import { bootGame, installHeadlessDom } from "./headlessGame";
import type { Game } from "./engine";
import { TILE } from "./constants";
import { generateMap } from "./map";

/**
 * Walk-through region gates, at the fortress threshold.
 *
 * A fortress gate is one tile (32px) from the point the player arrives, and the
 * trigger radius is 43.2px, so the arrival point is *inside* the radius. An
 * unguarded check ejects a player who has merely stopped — then, having put them
 * 32px from the same gate, immediately ejects them straight back in, building a
 * fresh region and a fresh tile-chunk cache every time. The reported symptom was
 * "step out of a fortress, stop, get yanked back in".
 *
 * The geometry is symmetric in both directions, and these tests hold the player
 * still to prove it, then move them off the threshold and back to prove the gate
 * is not a one-way ratchet.
 */

beforeAll(() => installHeadlessDom());

const REGION_GATE_RADIUS = TILE * 1.35;

function centre(tileX: number, tileY: number) {
  return { x: tileX * TILE + TILE / 2, y: tileY * TILE + TILE / 2 };
}

/**
 * Run the simulation with the player held at a point.
 *
 * `changeRegion` is async — it awaits the region repository — so the loop has to
 * yield to the macrotask queue. Stepping synchronously would leave the
 * transition permanently pending and every gate looking like it never fires.
 */
async function hold(game: Game, x: number, y: number, seconds: number) {
  game.player.x = x;
  game.player.y = y;
  for (let i = 0; i < Math.ceil(seconds * 60); i++) {
    game.simulateStep(1 / 60);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** True when the player is standing inside some walk-through gate's radius. */
function onAThreshold(game: Game) {
  return game.map.exits.some(
    (exit) => !exit.requiresInteraction &&
      Math.hypot(game.player.x - (exit.x * TILE + TILE / 2), game.player.y - (exit.y * TILE + TILE / 2)) < REGION_GATE_RADIUS,
  );
}

function firstFortressGate() {
  const gate = generateMap("overworld").exits.find((exit) => exit.targetRegion.startsWith("fortress."));
  if (!gate) throw new Error("The frontier has no fortress gate");
  return gate;
}

function fortressExitGate(regionId: string) {
  const gate = generateMap(regionId).exits.find((exit) => !exit.requiresInteraction);
  if (!gate) throw new Error(`${regionId} has no way back out`);
  return gate;
}

/** A spot far enough from every gate that the threshold re-arms. */
async function stepClear(game: Game) {
  const spawn = { x: game.player.x, y: game.player.y };
  for (const offset of [TILE * 6, -TILE * 6, TILE * 6, -TILE * 6, 0]) {
    await hold(game, spawn.x + offset, spawn.y, 0.5);
    if (!onAThreshold(game)) return;
  }
  // Fall back to the middle of the region, which cannot be on a threshold.
  await hold(game, (game.map.width * TILE) / 2, (game.map.height * TILE) / 2, 0.5);
}

describe("the fortress threshold", () => {
  it("lands the player inside the trigger radius, which is the whole problem", () => {
    // Documents the geometry the fix has to cope with. If this stops being true
    // the hysteresis may be removable, but it must fail loudly if the authored
    // fortress layouts change back.
    const gate = firstFortressGate();
    const out = fortressExitGate(gate.targetRegion);
    const back = centre(out.x, out.y);
    expect(Math.hypot(gate.destination.x - back.x, gate.destination.y - back.y)).toBeLessThan(REGION_GATE_RADIUS);
  });

  it("does not pull a player who stops just outside a fortress back in", async () => {
    const game = await bootGame();
    const gate = firstFortressGate();

    await hold(game, centre(gate.x, gate.y).x, centre(gate.x, gate.y).y, 4);
    expect(game.world.regionId).toBe(gate.targetRegion);

    // Step into the room, then back to the door. The door tile is solid and the
    // arrival point is inside its radius, so leaving is "step off the threshold
    // and come back" — which is what walking through a doorway is.
    await stepClear(game);
    const out = fortressExitGate(gate.targetRegion);
    await hold(game, centre(out.x, out.y).x, centre(out.x, out.y).y, 4);
    expect(game.world.regionId).toBe("overworld");
    expect(onAThreshold(game), "the arrival point should be inside the radius").toBe(true);

    // The reported bug: stop here, 32px from the gate just used, and the old
    // check yanked the player straight back into the fortress.
    const arrival = { x: game.player.x, y: game.player.y };
    await hold(game, arrival.x, arrival.y, 8);
    expect(game.world.regionId).toBe("overworld");

    game.destroy();
  }, 60000);

  it("does not eject a player who stops just inside a fortress", async () => {
    const game = await bootGame();
    const gate = firstFortressGate();
    await hold(game, centre(gate.x, gate.y).x, centre(gate.x, gate.y).y, 4);
    expect(game.world.regionId).toBe(gate.targetRegion);

    const inside = { x: game.player.x, y: game.player.y };
    await hold(game, inside.x, inside.y, 8);
    expect(game.world.regionId).toBe(gate.targetRegion);

    game.destroy();
  }, 30000);

  it("re-arms after stepping clear, so the gate still works both ways", async () => {
    const game = await bootGame();
    const gate = firstFortressGate();

    // Inside, the way out is the fortress's own door, which sits at its own
    // coordinates in the fortress map.
    await hold(game, centre(gate.x, gate.y).x, centre(gate.x, gate.y).y, 4);
    expect(game.world.regionId).toBe(gate.targetRegion);
    const out = fortressExitGate(gate.targetRegion);
    const outside = centre(gate.x, gate.y);

    // Step off the threshold — a player cannot walk out of a door they are
    // standing in — and confirm the exit re-arms.
    await stepClear(game);
    expect(onAThreshold(game)).toBe(false);
    await hold(game, centre(out.x, out.y).x, centre(out.x, out.y).y, 4);
    expect(game.world.regionId).toBe("overworld");

    // ...and not a one-way ratchet: the frontier's fortress gate is at the world
    // position the player was just put down at, so walking back to it re-enters.
    await stepClear(game);
    expect(onAThreshold(game)).toBe(false);
    await hold(game, outside.x, outside.y, 4);
    expect(game.world.regionId).toBe(gate.targetRegion);

    game.destroy();
  }, 60000);
});
