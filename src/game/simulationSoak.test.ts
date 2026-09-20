import { beforeAll, describe, expect, it } from "vitest";
import { bootGame, installHeadlessDom } from "./headlessGame";

/**
 * Deterministic random-input soak.
 *
 * Drives the real simulation — movement, collision, AI, combat, dialogue,
 * region transitions, death and respawn — with a seeded input stream while
 * periodically dropping the pilgrim on a gate so the run walks the continent.
 * It asserts the invariants that a game must never break rather than any
 * particular outcome: nothing throws, no coordinate goes non-finite, nobody
 * escapes the map, and no effect list grows without bound.
 */
describe("simulation soak", () => {
  beforeAll(() => installHeadlessDom());

  it("survives 9000 frames of random input across every region", { timeout: 120000 }, async () => {
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    const game = await bootGame();
    const keys = ["w", "a", "s", "d", " ", "j", "shift", "e", "enter"];
    const problems: string[] = [];
    const visited = new Set<string>();
    const DT = 1 / 60;

    const check = (label: string) => {
      const p = game.player;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) problems.push(`${label}: player position went non-finite (${p.x},${p.y})`);
      if (p.x < -200 || p.y < -200 || p.x > game.map.width * 32 + 200 || p.y > game.map.height * 32 + 200) {
        problems.push(`${label}: player left the map at ${p.x.toFixed(0)},${p.y.toFixed(0)}`);
      }
      for (const e of game.enemies) {
        if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.hp)) {
          problems.push(`${label}: ${e.type} went non-finite (${e.x},${e.y}, hp ${e.hp})`);
        }
      }
      if (game.particles.length > 4000) problems.push(`${label}: particle list grew to ${game.particles.length}`);
      if (game.texts.length > 500) problems.push(`${label}: floating-text list grew to ${game.texts.length}`);
      if (game.projectiles.length > 500) problems.push(`${label}: projectile list grew to ${game.projectiles.length}`);
    };

    for (let frame = 0; frame < 9000; frame++) {
      // Region transitions are async; yield so the pending load can settle.
      if (frame % 2 === 0) for (let i = 0; i < 6; i++) await Promise.resolve();

      if (frame % 6 === 0) {
        for (const key of keys) if (rnd() < 0.25) game.input.setKey(key, rnd() < 0.5);
      }

      game.simulateStep(DT);
      if (game.dialogue && rnd() < 0.3) {
        const choices = game.dialogue.choices;
        if (choices?.length) game.chooseDialogue(choices[Math.floor(rnd() * choices.length)].id);
        else game.advanceDialogue();
      }

      visited.add(game.world.regionId);
      check(`frame ${frame}`);

      // Drop the pilgrim on a gate every few seconds so the run leaves the
      // starting region instead of milling around one map.
      if (frame % 200 === 199) {
        const exits = game.map.exits;
        if (exits.length) {
          const exit = exits[Math.floor(rnd() * exits.length)];
          game.player.x = exit.x * 32 + 16;
          game.player.y = exit.y * 32 + 16;
        }
      }
      if (problems.length > 10) break;
    }

    game.destroy();
    expect(problems).toEqual([]);
    // The soak should actually get somewhere, or it proves nothing.
    expect(visited.size).toBeGreaterThan(4);
  });
});
