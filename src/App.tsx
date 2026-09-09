import { useCallback, useRef } from "react";
import GameCanvas from "@/components/GameCanvas";
import HUD from "@/components/HUD";
import DialogueBox from "@/components/DialogueBox";
import PauseOverlay from "@/components/PauseOverlay";
import TitleScreen from "@/components/TitleScreen";
import EndScreen from "@/components/EndScreen";
import { useGameStore, selectScreen, selectPaused, selectHud, selectDialogue, selectSessionId } from "@/stores";
import type { GameCallbacks } from "@/game/types";
import type { Game } from "@/game/engine";



export default function App() {
  const screen = useGameStore(selectScreen);
  const paused = useGameStore(selectPaused);
  const hud = useGameStore(selectHud);
  const dialogue = useGameStore(selectDialogue);
  const sessionId = useGameStore(selectSessionId);
  const { startGame, endGame, setPaused, setHud, setDialogue } = useGameStore();

  const start = useCallback(() => {
    startGame();
  }, [startGame]);

  const gameRef = useRef<Game | null>(null);
  const callbacks: GameCallbacks = {
    onHud: (hudData) => setHud(hudData),
    onDialogue: (dialogueData) => setDialogue(dialogueData),
    onPause: (paused) => setPaused(paused),
    onWin: () => endGame("win"),
    onLose: () => endGame("lose"),
  };

  const showGame = screen === "overworld" || screen === "pause";

  return (
    <div className="no-select relative h-screen w-screen overflow-hidden bg-black font-serif text-amber-50">
      {showGame && (
        <GameCanvas
          key={sessionId}
          callbacks={callbacks}
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
          onRestart={start}
        />
      )}

      {screen === "title" && <TitleScreen onStart={start} />}
      {screen === "win" && <EndScreen variant="win" onRestart={start} />}
      {screen === "lose" && <EndScreen variant="lose" onRestart={start} />}
    </div>
  );
}
