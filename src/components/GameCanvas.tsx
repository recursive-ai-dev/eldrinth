import { useEffect, useRef } from "react";
import { Game } from "@/game/engine";
import type { GameCallbacks } from "@/game/types";
import type { WorldSnapshot } from "@/game/core/WorldState";
import type { Difficulty } from "@/game/types";

export default function GameCanvas({
  callbacks,
  onReady,
  initialSnapshot,
  onCheckpoint,
  difficulty,
}: {
  callbacks: GameCallbacks;
  onReady?: (g: Game) => void;
  initialSnapshot?: WorldSnapshot | null;
  onCheckpoint?: (snapshot: WorldSnapshot) => void;
  difficulty?: Difficulty;
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
      onEnd: (ending) => cbRef.current.onEnd(ending),
      onJournal: (entries) => cbRef.current.onJournal(entries),
      onInterior: (inside) => cbRef.current.onInterior(inside),
    };
    const game = new Game(canvas, proxy, undefined, { difficulty });
    // Acquire the saved region before restoring its local entities. This keeps
    // a checkpoint in any of the connected maps loadable after a refresh.
    if (initialSnapshot) game.world.regionId = initialSnapshot.regionId;
    let disposed = false;
    const checkpoint = () => {
      if (!disposed && game.initialized && !game.ended) onCheckpoint?.(game.saveWorld());
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") checkpoint();
    };
    const interval = window.setInterval(checkpoint, 10_000);
    window.addEventListener("visibilitychange", onVisibilityChange);
    void game.init()
      .then(() => {
        if (disposed) return;
        if (initialSnapshot) game.loadWorld(initialSnapshot);
        game.start();
        onReady?.(game);
      })
      .catch((error: unknown) => {
        if (!disposed) console.error("Game initialization error:", error);
      });
    return () => {
      checkpoint();
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("visibilitychange", onVisibilityChange);
      game.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}
