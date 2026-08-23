import { useCallback, useRef, useState } from "react";
import GameCanvas from "@/components/GameCanvas";
import HUD from "@/components/HUD";
import DialogueBox from "@/components/DialogueBox";
import PauseOverlay from "@/components/PauseOverlay";
import TitleScreen from "@/components/TitleScreen";
import EndScreen from "@/components/EndScreen";
import type { Game } from "@/game/engine";
import type { GameCallbacks, HudData, DialogueData } from "@/game/types";

type Screen = "title" | "play" | "win" | "lose";

const initialHud: HudData = {
  hp: 6,
  maxHp: 6,
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

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState<HudData>(initialHud);
  const [dialogue, setDialogue] = useState<DialogueData | null>(null);
  const [runKey, setRunKey] = useState(0);
  const gameRef = useRef<Game | null>(null);

  const start = useCallback(() => {
    setPaused(false);
    setDialogue(null);
    setHud(initialHud);
    setRunKey((k) => k + 1);
    setScreen("play");
  }, []);

  const callbacks: GameCallbacks = {
    onHud: setHud,
    onDialogue: setDialogue,
    onPause: setPaused,
    onWin: () => setScreen("win"),
    onLose: () => setScreen("lose"),
  };

  const showGame = screen !== "title";

  return (
    <div className="no-select relative h-screen w-screen overflow-hidden bg-black font-serif text-amber-50">
      {showGame && (
        <GameCanvas
          key={runKey}
          callbacks={callbacks}
          onReady={(g) => (gameRef.current = g)}
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
