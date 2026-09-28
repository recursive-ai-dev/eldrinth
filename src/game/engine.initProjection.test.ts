import { beforeAll, describe, expect, it } from "vitest";
import { bootGame, installHeadlessDom, silentCallbacks } from "./headlessGame";
import type { DialogueData } from "./types";

/**
 * "Reload Region" replaces a crashed engine with a fresh one under the same
 * shell. The shell's dialogue and pause state belonged to the dead engine, so
 * a fresh engine has to state its own, or a dialogue box the new engine knows
 * nothing about stays on screen with no way to advance or close it.
 */

beforeAll(() => installHeadlessDom());

describe("engine initialization", () => {
  it("publishes that it has no dialogue open and is not paused", async () => {
    const dialogue: (DialogueData | null)[] = [];
    const pause: boolean[] = [];
    const game = await bootGame({
      ...silentCallbacks(),
      onDialogue: (data) => dialogue.push(data),
      onPause: (paused) => pause.push(paused),
    });
    expect(dialogue).toEqual([null]);
    expect(pause).toEqual([false]);
    game.destroy();
  });
});
