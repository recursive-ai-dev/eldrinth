import { useEffect, useRef, useState } from "react";
import { Game } from "@/game/engine";
import type { GameCallbacks } from "@/game/types";
import type { WorldSnapshot } from "@/game/core/WorldState";
import type { Difficulty } from "@/game/types";
import { useGameStore } from "@/stores/useGameStore";

export default function GameCanvas({
  callbacks,
  onReady,
  initialSnapshot,
  onCheckpoint,
  difficulty,
  onError,
  onReturnToTitle,
}: {
  callbacks: GameCallbacks;
  onReady?: (g: Game) => void;
  initialSnapshot?: WorldSnapshot | null;
  onCheckpoint?: (snapshot: WorldSnapshot) => void;
  difficulty?: Difficulty;
  onError?: (error: unknown) => void;
  onReturnToTitle?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const [initError, setInitError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

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
        if (disposed) return;
        console.error("Game initialization error:", error);
        onError?.(error);
        const msg = error instanceof Error ? error.message : "Failed to initialize game engine.";
        setInitError(msg);
      });
    return () => {
      checkpoint();
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("visibilitychange", onVisibilityChange);
      game.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryNonce]);

  const handleRetry = () => {
    setInitError(null);
    setRetryNonce((n) => n + 1);
  };

  const handleReturnToTitle = () => {
    if (onReturnToTitle) {
      onReturnToTitle();
    } else {
      useGameStore.getState().reset();
    }
  };

  return (
    <>
      <canvas ref={ref} className="absolute inset-0 h-full w-full touch-none" />
      {initError && (
        <div
          data-testid="init-error-screen"
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-md"
        >
          <div className="max-w-md w-full rounded-xl border border-rose-500/30 bg-[#0f0c13] p-8 text-center shadow-[0_0_50px_rgba(225,29,72,0.15)]">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-rose-500/40 bg-rose-950/40 text-rose-300">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="mb-2 font-serif text-xl font-bold tracking-widest text-rose-100 uppercase">
              Initialization Failed
            </h2>
            <p className="mb-6 font-serif text-sm text-amber-100/70 leading-relaxed">
              {initError}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={handleRetry}
                className="cursor-pointer rounded border border-amber-400/40 bg-amber-500/20 px-5 py-2 font-serif text-xs uppercase tracking-widest text-amber-200 transition hover:border-amber-300 hover:bg-amber-500/30 active:scale-95"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={handleReturnToTitle}
                className="cursor-pointer rounded border border-white/20 bg-white/5 px-5 py-2 font-serif text-xs uppercase tracking-widest text-stone-300 transition hover:border-white/40 hover:bg-white/10 active:scale-95"
              >
                Return to Title
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
