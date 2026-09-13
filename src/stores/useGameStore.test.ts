import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "./useGameStore";

describe("ending state", () => {
  beforeEach(() => { useGameStore.getState().reset(); });

  it("records each ending and shows the ending scene", () => {
    for (const ending of ["silence", "refusal", "spent"] as const) {
      useGameStore.getState().startGame();
      useGameStore.getState().endGame(ending);

      const state = useGameStore.getState();
      expect(state.scenes).toEqual(["ending"]);
      expect(state.ending).toBe(ending);
      expect(state.dialogue).toBeNull();
    }
  });

  it("clears the previous ending when a new run starts", () => {
    useGameStore.getState().endGame("silence");
    useGameStore.getState().startGame();

    expect(useGameStore.getState().ending).toBeNull();
    expect(useGameStore.getState().scenes).toEqual(["overworld"]);
  });
});
