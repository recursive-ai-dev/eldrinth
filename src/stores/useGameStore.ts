import { create } from "zustand";
import type { HudData, DialogueData } from "@/game/types";
import { SceneStack, type SceneId } from "@/game/core/SceneStack";

type Screen = SceneId;

interface GameState {
  scenes: readonly SceneId[];
  sessionId: number;
  hud: HudData;
  dialogue: DialogueData | null;

  // Actions
  setPaused: (paused: boolean) => void;
  setHud: (hud: HudData) => void;
  setDialogue: (dialogue: DialogueData | null) => void;

  // Derived
  startGame: () => void;
  endGame: (result: "win" | "lose") => void;
  togglePause: () => void;
  reset: () => void;
}

const initialHud: HudData = {
  hp: 6,
  maxHp: 6,
  stamina: 100,
  maxStamina: 100,
  shards: 0,
  totalShards: 9,
  objective: "Recover the Anima Shards  (0/9)",
  message: "",
  messageId: 0,
  prompt: "",
  enemies: 0,
  bossActive: false,
  bossHp: 0,
};

const initialState: Omit<GameState, "setPaused" | "setHud" | "setDialogue" | "startGame" | "endGame" | "togglePause" | "reset"> = {
  scenes: ["title"],
  sessionId: 0,
  hud: initialHud,
  dialogue: null,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setPaused: (paused) => set((state) => {
    const stack = new SceneStack(state.scenes);
    if (paused && !stack.has("pause")) stack.push("pause");
    if (!paused && stack.top() === "pause") stack.pop();
    return { scenes: stack.snapshot(), dialogue: paused ? null : state.dialogue };
  }),

  setHud: (hud) => set({ hud }),

  setDialogue: (dialogue) => set({ dialogue }),

  startGame: () => {
    set((state) => ({
      scenes: ["overworld"],
      sessionId: state.sessionId + 1,
      dialogue: null,
      hud: initialHud,
    }));
  },

  endGame: (result: "win" | "lose") => {
    set({
      scenes: [result === "win" ? "win" : "lose"],
      dialogue: null,
    });
  },

  togglePause: () => set((state) => {
    const stack = new SceneStack(state.scenes);
    if (stack.top() === "pause") stack.pop();
    else if (stack.top() === "overworld" || stack.top() === "interior") stack.push("pause");
    return { scenes: stack.snapshot() };
  }),

  reset: () => set({ ...initialState }),
}));

// Selectors for better performance with useStore
// Usage: const screen = useGameStore((state) => state.screen);
// Re-export types for convenience
export type { Screen };

export const selectScreen = (state: GameState) => state.scenes[state.scenes.length - 1];
export const selectPaused = (state: GameState) => state.scenes.includes("pause");
export const selectSessionId = (state: GameState) => state.sessionId;
export const selectHud = (state: GameState) => state.hud;
export const selectDialogue = (state: GameState) => state.dialogue;
