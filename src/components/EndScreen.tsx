import { useEffect } from "react";
import endingBg from "@/assets/ending.jpg";

export default function EndScreen({
  variant,
  onRestart,
}: {
  variant: "win" | "lose";
  onRestart: () => void;
}) {
  const win = variant === "win";
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onRestart();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onRestart]);
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden">
      <img
        src={endingBg}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover ${win ? "opacity-80" : "opacity-25 grayscale"}`}
      />
      <div
        className={`absolute inset-0 ${win ? "bg-linear-to-b from-amber-950/30 via-black/30 to-black/80" : "bg-black/85"}`}
      />
      <div className="absolute inset-0 vignette" />

      <div className="relative z-10 flex max-w-2xl flex-col items-center px-6 text-center">
        <h1
          className={`font-title text-5xl font-bold tracking-[0.15em] drop-shadow-[0_2px_18px_rgba(0,0,0,0.9)] sm:text-6xl ${
            win ? "text-amber-50" : "text-rose-200"
          }`}
        >
          {win ? "THE SPIRE FALLS SILENT" : "YOUR LIGHT FADES"}
        </h1>

        <p className="mt-6 max-w-xl font-serif text-base leading-relaxed text-amber-50/75 sm:text-lg">
          {win
            ? "The Unbound's long dreaming ends. The shards of its mind scatter into the dawn like fireflies, and at last it is at peace. Eldrinth stirs beneath a sun it had forgotten. The Mnemonic whisper your name into the quiet — and remember."
            : "The Sundered close over you, and the old light gutters out. The Spire's hunger goes on. Somewhere, a shard waits to be gathered again..."}
        </p>

        <button
          onClick={onRestart}
          className={`mt-9 rounded-lg border px-10 py-4 font-title text-lg tracking-[0.3em] transition hover:scale-[1.03] ${
            win
              ? "border-amber-300/50 bg-amber-400/10 text-amber-50 hover:bg-amber-400/20"
              : "border-rose-300/50 bg-rose-400/10 text-rose-50 hover:bg-rose-400/20"
          }`}
        >
          {win ? "WALK AGAIN" : "RISE AGAIN"}
        </button>
      </div>
    </div>
  );
}
