import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "./useGameStore";

describe("ending state", () => {
  beforeEach(() => { useGameStore.getState().reset(); });

  it("records each ending and shows the ending scene", () => {
    for (const ending of ["silence", "refusal", "spent"] as const) {
      useGameStore.getState().startGame();
      useGameStore.getState().endGame(ending, [`${ending} happened`]);

      const state = useGameStore.getState();
      expect(state.scenes).toEqual(["ending"]);
      expect(state.ending).toBe(ending);
      expect(state.epilogue).toEqual([`${ending} happened`]);
      expect(state.dialogue).toBeNull();
    }
  });

  it("clears the previous ending and epilogue when a new run starts", () => {
    useGameStore.getState().endGame("silence", ["something"]);
    useGameStore.getState().startGame();

    expect(useGameStore.getState().ending).toBeNull();
    expect(useGameStore.getState().epilogue).toEqual([]);
    expect(useGameStore.getState().scenes).toEqual(["overworld"]);
  });
});
