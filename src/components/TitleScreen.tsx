import { useEffect } from "react";
import titleBg from "@/assets/title.jpg";

export default function TitleScreen({ onStart }: { onStart: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onStart]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden">
      <img
        src={titleBg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-linear-to-b from-black/40 via-black/30 to-black/85" />
      <div className="absolute inset-0 vignette" />

      <div className="relative z-10 flex max-w-3xl flex-col items-center px-6 text-center">
        <div className="font-title text-xs uppercase tracking-[0.6em] text-teal-300/70 glow-pulse">
          A Dark Fantasy of the Forged
        </div>
        <h1 className="font-title mt-3 text-6xl font-bold leading-none tracking-[0.12em] text-amber-50 drop-shadow-[0_2px_18px_rgba(0,0,0,0.9)] sm:text-7xl">
          ELDRINTH
        </h1>
        <div className="mt-2 flex items-center gap-3 text-amber-200/50">
          <span className="h-px w-12 bg-amber-200/30" />
          <span className="font-title text-sm tracking-[0.4em]">THE UNBOUND SPIRE</span>
          <span className="h-px w-12 bg-amber-200/30" />
        </div>

        <p className="mx-auto mt-6 max-w-2xl font-serif text-base leading-relaxed text-amber-50/70 sm:text-lg">
          Long ago the Elder Elves forged the <em className="text-teal-200/80">Mnemonic</em> — minds
          of living light and logic — to tend their gleaming cities. When the Elves passed into dust,
          their creations lost their purpose. Most dulled to silence. Some{" "}
          <em className="text-rose-300/80">Sundered</em> into hunger. Now the greatest of them, the{" "}
          <em className="text-rose-300/80">Unbound</em>, stirs beneath the Glass Spire.
          <br />
          Take up the old blade, wayfarer.
        </p>

        <button
          onClick={onStart}
          className="group mt-9 rounded-lg border border-teal-300/50 bg-teal-400/10 px-10 py-4 font-title text-lg tracking-[0.3em] text-teal-50 shadow-[0_0_30px_rgba(70,240,216,0.25)] transition hover:scale-[1.03] hover:bg-teal-400/20 hover:shadow-[0_0_40px_rgba(70,240,216,0.5)]"
        >
          BEGIN THE PILGRIMAGE
        </button>
        <div className="mt-3 font-serif text-xs italic text-amber-100/40">
          press Enter · move with WASD · strike with J or Space
        </div>

        <div className="mt-8 grid w-full max-w-xl grid-cols-2 gap-x-8 gap-y-1 text-left font-serif text-xs text-amber-100/40 sm:grid-cols-4">
          <div>
            <span className="text-teal-200/70">WASD / Arrows</span> — Move
          </div>
          <div>
            <span className="text-teal-200/70">J / Space</span> — Attack
          </div>
          <div>
            <span className="text-teal-200/70">Shift</span> — Dash
          </div>
          <div>
            <span className="text-teal-200/70">E</span> — Speak / Read
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 z-10 font-serif text-[10px] tracking-widest text-amber-100/25">
        ELVES MADE MINDS · MINDS WENT MAD · ONE BLADE REMAINS
      </div>
    </div>
  );
}
