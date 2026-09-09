import { useEffect, useRef } from "react";
import { Game } from "@/game/engine";
import type { GameCallbacks } from "@/game/types";

export default function GameCanvas({
  callbacks,
  onReady,
}: {
  callbacks: GameCallbacks;
  onReady?: (g: Game) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const proxy: GameCallbacks = {
      onHud: (d) => cbRef.current.onHud(d),
      onDialogue: (d) => cbRef.current.onDialogue(d),
      onPause: (p) => cbRef.current.onPause(p),
      onWin: () => cbRef.current.onWin(),
      onLose: () => cbRef.current.onLose(),
    };
    const game = new Game(canvas, proxy);
    let disposed = false;
    void game.init()
      .then(() => {
        if (disposed) return;
        game.start();
        onReady?.(game);
      })
      .catch((error: unknown) => {
        if (!disposed) console.error("Game initialization error:", error);
      });
    return () => {
      disposed = true;
      game.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}
