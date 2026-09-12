import { useCallback, useEffect, useRef, useState } from "react";
import GameCanvas from "@/components/GameCanvas";
import HUD from "@/components/HUD";
import DialogueBox from "@/components/DialogueBox";
import PauseOverlay from "@/components/PauseOverlay";
import TitleScreen from "@/components/TitleScreen";
import EndScreen from "@/components/EndScreen";
import { useGameStore, selectScreen, selectPaused, selectHud, selectDialogue, selectSessionId } from "@/stores";
import type { GameCallbacks } from "@/game/types";
import type { Game } from "@/game/engine";
import type { WorldSnapshot } from "@/game/core/WorldState";
import { slotStore, type SaveSlot } from "@/game/slots";
import type { Difficulty } from "@/game/types";



export default function App() {
  const screen = useGameStore(selectScreen);
  const paused = useGameStore(selectPaused);
  const hud = useGameStore(selectHud);
  const dialogue = useGameStore(selectDialogue);
  const sessionId = useGameStore(selectSessionId);
  const { startGame, endGame, setPaused, setHud, setDialogue } = useGameStore();
  const [checkpoint, setCheckpoint] = useState<WorldSnapshot | null>(null);
  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");

  const refreshSlots = useCallback(() => { void slotStore.list().then(setSlots).catch(() => setSlots([])); }, []);
  useEffect(() => { refreshSlots(); }, [refreshSlots]);

  const start = useCallback((slot: number, selectedDifficulty: Difficulty) => {
    setCheckpoint(null);
    setActiveSlot(slot);
    setDifficulty(selectedDifficulty);
    void slotStore.remove(slot).then(refreshSlots).catch(() => undefined);
    startGame();
  }, [refreshSlots, startGame]);

  const resume = useCallback((slot: number) => {
    void slotStore.load(slot).then((saved) => {
      if (!saved) return;
      setCheckpoint(saved.world);
      setActiveSlot(slot);
      setDifficulty(saved.difficulty);
      startGame();
    });
  }, [startGame]);

  const restart = useCallback(() => {
    startGame();
  }, [startGame]);

  const saveCheckpoint = useCallback((snapshot: WorldSnapshot) => {
    setCheckpoint(snapshot);
    if (activeSlot) void slotStore.save(activeSlot, snapshot).then(refreshSlots).catch(() => undefined);
  }, [activeSlot, refreshSlots]);

  const eraseSlot = useCallback((slot: number) => {
    void slotStore.remove(slot).then(refreshSlots).catch(() => undefined);
  }, [refreshSlots]);

  const gameRef = useRef<Game | null>(null);
  const callbacks: GameCallbacks = {
    onHud: (hudData) => setHud(hudData),
    onDialogue: (dialogueData) => setDialogue(dialogueData),
    onPause: (paused) => setPaused(paused),
    onWin: () => { setCheckpoint(null); endGame("win"); },
    onLose: () => { setCheckpoint(null); endGame("lose"); },
  };

  const showGame = screen === "overworld" || screen === "pause";

  return (
    <div className="no-select relative h-screen w-screen overflow-hidden bg-black font-serif text-amber-50">
      {showGame && (
        <GameCanvas
          key={sessionId}
          callbacks={callbacks}
          initialSnapshot={checkpoint}
          onCheckpoint={saveCheckpoint}
          difficulty={difficulty}
          onReady={(g) => { gameRef.current = g; }}
        />
      )}

      {showGame && <HUD hud={hud} />}

      {showGame && dialogue && (
        <DialogueBox data={dialogue} onAdvance={() => gameRef.current?.advanceDialogue()} />
      )}

      {showGame && paused && (
        <PauseOverlay
          onResume={() => gameRef.current?.setPaused(false)}
          onRestart={restart}
        />
      )}

      {screen === "title" && <TitleScreen onStart={start} onContinue={resume} onErase={eraseSlot} slots={slots} />}
      {screen === "win" && <EndScreen variant="win" onRestart={restart} />}
      {screen === "lose" && <EndScreen variant="lose" onRestart={restart} />}
    </div>
  );
}
