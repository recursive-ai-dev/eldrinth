import { useCallback, useEffect, useRef } from "react";
import GameCanvas from "@/components/GameCanvas";
import HUD from "@/components/HUD";
import DialogueBox from "@/components/DialogueBox";
import PauseOverlay from "@/components/PauseOverlay";
import TitleScreen from "@/components/TitleScreen";
import EndScreen from "@/components/EndScreen";
import { useGameStore, selectScreen, selectPaused, selectHud, selectDialogue, selectGameInstance, Game } from "@/stores";
import type { GameCallbacks } from "@/game/types";



export default function App() {
  const screen = useGameStore(selectScreen);
  const paused = useGameStore(selectPaused);
  const hud = useGameStore(selectHud);
  const dialogue = useGameStore(selectDialogue);
  const gameInstance = useGameStore(selectGameInstance);
  
  const { startGame, endGame, setPaused, setHud, setDialogue, setGameInstance, reset } = useGameStore();

  const start = useCallback(() => {
    reset();
    startGame();
  }, [reset, startGame]);

  const gameRef = useRef<Game | null>(null);
  useEffect(() => {
    if (gameInstance) {
      gameRef.current = gameInstance;
    }
  }, [gameInstance]);

  const callbacks: GameCallbacks = {
    onHud: (hudData) => setHud(hudData),
    onDialogue: (dialogueData) => setDialogue(dialogueData),
    onPause: (paused) => setPaused(paused),
    onWin: () => endGame("win"),
    onLose: () => endGame("lose"),
  };

  const showGame = screen !== "title";

  return (
    <div className="no-select relative h-screen w-screen overflow-hidden bg-black font-serif text-amber-50">
      {showGame && (
        <GameCanvas
          callbacks={callbacks}
          onReady={(g) => setGameInstance(g)}
        />
      )}

      {screen === "play" && <HUD hud={hud} />}

      {screen === "play" && dialogue && (
        <DialogueBox data={dialogue} onAdvance={() => gameRef.current?.advanceDialogue()} />
      )}

      {screen === "play" && paused && (
        <PauseOverlay
          onResume={() => gameRef.current?.setPaused(false)}
          onRestart={start}
        />
      )}

      {screen === "title" && <TitleScreen onStart={start} />}
      {screen === "win" && <EndScreen variant="win" onRestart={start} />}
      {screen === "lose" && <EndScreen variant="lose" onRestart={start} />}
    </div>
  );
}
