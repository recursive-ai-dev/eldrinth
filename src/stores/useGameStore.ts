import { create } from "zustand";
import { Game } from "@/game/engine";
import type { HudData, DialogueData } from "@/game/types";

type Screen = "title" | "play" | "win" | "lose";

interface GameState {
  screen: Screen;
  paused: boolean;
  gameInstance: Game | null;
  hud: HudData;
  dialogue: DialogueData | null;

  // Actions
  setScreen: (screen: Screen) => void;
  setPaused: (paused: boolean) => void;
  setGameInstance: (instance: Game | null) => void;
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
  totalShards: 3,
  objective: "Recover the Anima Shards  (0/3)",
  message: "",
  messageId: 0,
  prompt: "",
  enemies: 0,
  bossActive: false,
  bossHp: 0,
};

const initialState: Omit<GameState, "setScreen" | "setPaused" | "setGameInstance" | "setHud" | "setDialogue" | "startGame" | "endGame" | "togglePause" | "reset"> = {
  screen: "title",
  paused: false,
  gameInstance: null,
  hud: initialHud,
  dialogue: null,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setScreen: (screen) => set({ screen, paused: false, dialogue: null }),

  setPaused: (paused) => set({ paused }),

  setGameInstance: (gameInstance) => set({ gameInstance }),

  setHud: (hud) => set({ hud }),

  setDialogue: (dialogue) => set({ dialogue }),

  startGame: () => {
    set({
      screen: "play",
      paused: false,
      dialogue: null,
      hud: initialHud,
    });
  },

  endGame: (result: "win" | "lose") => {
    set({
      screen: result === "win" ? "win" : "lose",
      paused: false,
      dialogue: null,
    });
  },

  togglePause: () => set((state) => ({ paused: !state.paused })),

  reset: () => set({ ...initialState, screen: "title" }),
}));

// Selectors for better performance with useStore
// Usage: const screen = useGameStore((state) => state.screen);
// Re-export types for convenience
export type { Screen };
export { Game };

export const selectScreen = (state: GameState) => state.screen;
export const selectPaused = (state: GameState) => state.paused;
export const selectGameInstance = (state: GameState) => state.gameInstance;
export const selectHud = (state: GameState) => state.hud;
export const selectDialogue = (state: GameState) => state.dialogue;
