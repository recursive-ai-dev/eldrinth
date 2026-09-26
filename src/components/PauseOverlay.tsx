import { useEffect, useState } from "react";
import Modal from "./Modal";

export default function PauseOverlay({
  onResume,
  onRestart,
}: {
  onResume: () => void;
  onRestart: () => void;
}) {
  // Abandoning a pilgrimage is unrecoverable, so the destructive button asks
  // once before it fires. The step also decays back to the menu on its own so
  // a pause screen left open does not stay armed.
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 6000);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  return (
    <Modal
      labelledBy="pause-heading"
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="w-[min(440px,90vw)] max-h-[90dvh] overflow-y-auto rounded-2xl border border-amber-200/20 bg-[#0c0a12]/95 p-8 text-center shadow-2xl">
        <h2 id="pause-heading" className="font-title text-3xl tracking-[0.25em] text-amber-100">PAUSED</h2>
        <p className="mt-2 font-serif text-sm italic text-amber-200/75">
          The world holds its breath.
        </p>
        <div className="mt-6 space-y-3">
          <button
            onClick={onResume}
            className="w-full rounded-lg border border-teal-300/40 bg-teal-400/10 px-4 py-3 font-title tracking-widest text-teal-100 transition hover:bg-teal-400/20"
          >
            RESUME
          </button>
          {confirming ? (
            <>
              <p
                data-testid="abandon-warning"
                className="rounded-lg border border-rose-400/30 bg-rose-950/25 px-3 py-2 font-serif text-xs leading-relaxed text-rose-100/80"
              >
                This pilgrimage ends here and a new one begins from the arrival road.
                Your slot keeps whatever was last written to it.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirming(false)}
                  className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-3 font-title tracking-widest text-amber-100/80 transition hover:bg-white/10"
                >
                  KEEP PLAYING
                </button>
                <button
                  data-testid="abandon-confirm"
                  onClick={onRestart}
                  className="flex-1 rounded-lg border border-rose-400/50 bg-rose-500/15 px-4 py-3 font-title tracking-widest text-rose-100 transition hover:bg-rose-500/25"
                >
                  ABANDON
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="w-full rounded-lg border border-amber-200/20 bg-white/5 px-4 py-3 font-title tracking-widest text-amber-100/80 transition hover:bg-white/10"
            >
              ABANDON &amp; RESTART
            </button>
          )}
        </div>
        <div className="mt-6 font-serif text-xs leading-relaxed text-amber-100/75">
          MOVE WASD/Arrows · ATTACK J/Space · DASH Shift · SPEAK/READ E · PAUSE Esc
        </div>
      </div>
    </Modal>
  );
}
