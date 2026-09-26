import { create } from "zustand";
import type { HudData, DialogueData, JournalEntry } from "@/game/types";
import { SceneStack, type SceneId, type EndingId } from "@/game/core/SceneStack";

type Screen = SceneId;

interface GameState {
  scenes: readonly SceneId[];
  sessionId: number;
  hud: HudData;
  dialogue: DialogueData | null;
  journal: JournalEntry[];
  ending: EndingId | null;
  /** What the run added up to, assembled from the player's actual decisions. */
  epilogue: string[];

  // Actions
  setPaused: (paused: boolean) => void;
  setHud: (hud: HudData) => void;
  setDialogue: (dialogue: DialogueData | null) => void;
  setJournal: (journal: JournalEntry[]) => void;
  setInterior: (inside: boolean) => void;

  // Derived
  startGame: () => void;
  endGame: (ending: EndingId, epilogue: string[]) => void;
  togglePause: () => void;
  reset: () => void;
}

const initialHud: HudData = {
  regionName: "The Old Lands",
  hp: 6,
  maxHp: 6,
  stamina: 100,
  maxStamina: 100,
  shards: 0,
  totalShards: 9,
  objective: "Read the roads. Record what was taken.",
  message: "",
  messageId: 0,
  prompt: "",
  enemies: 0,
  bossActive: false,
  bossHp: 0,
};

const initialState: Omit<GameState, "setPaused" | "setHud" | "setDialogue" | "setJournal" | "setInterior" | "startGame" | "endGame" | "togglePause" | "reset"> = {
  scenes: ["title"],
  sessionId: 0,
  hud: initialHud,
  dialogue: null,
  journal: [],
  ending: null,
  epilogue: [],
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
  setJournal: (journal) => set({ journal }),

  setInterior: (inside: boolean) => set((state) => {
    const scenes = [...state.scenes];
    const root = inside ? "interior" : "overworld";
    if (scenes[0] === "overworld" || scenes[0] === "interior") scenes[0] = root;
    return { scenes };
  }),

  startGame: () => {
    set((state) => ({
      scenes: ["overworld"],
      sessionId: state.sessionId + 1,
      dialogue: null,
      journal: [],
      hud: initialHud,
      ending: null,
      epilogue: [],
    }));
  },

  endGame: (ending: EndingId, epilogue: string[]) => {
    set({
      scenes: ["ending"],
      ending,
      epilogue,
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
export const selectJournal = (state: GameState) => state.journal;
export const selectEnding = (state: GameState) => state.ending;
export const selectEpilogue = (state: GameState) => state.epilogue;
