export default function PauseOverlay({
  onResume,
  onRestart,
}: {
  onResume: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[min(440px,90vw)] rounded-2xl border border-amber-200/20 bg-[#0c0a12]/95 p-8 text-center shadow-2xl">
        <h2 className="font-title text-3xl tracking-[0.25em] text-amber-100">PAUSED</h2>
        <p className="mt-2 font-serif text-sm italic text-amber-200/50">
          The world holds its breath.
        </p>
        <div className="mt-6 space-y-3">
          <button
            onClick={onResume}
            className="w-full rounded-lg border border-teal-300/40 bg-teal-400/10 px-4 py-3 font-title tracking-widest text-teal-100 transition hover:bg-teal-400/20"
          >
            RESUME
          </button>
          <button
            onClick={onRestart}
            className="w-full rounded-lg border border-amber-200/20 bg-white/5 px-4 py-3 font-title tracking-widest text-amber-100/80 transition hover:bg-white/10"
          >
            ABANDON &amp; RESTART
          </button>
        </div>
        <div className="mt-6 font-serif text-xs leading-relaxed text-amber-100/40">
          MOVE WASD/Arrows · ATTACK J/Space · DASH Shift · SPEAK/READ E · PAUSE Esc
        </div>
      </div>
    </div>
  );
}
