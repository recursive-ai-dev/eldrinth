import { useEffect, useState } from "react";
import titleBg from "@/assets/title.jpg";
import type { Difficulty } from "@/game/types";
import type { SaveSlot } from "@/game/slots";

const DIFFICULTIES: { id: Difficulty; label: string; description: string }[] = [
  { id: "story", label: "Story", description: "More health · slower, less alert foes" },
  { id: "standard", label: "Standard", description: "Intended challenge" },
  { id: "brutal", label: "Brutal", description: "Hardened, deadlier foes" },
];

export default function TitleScreen({ onStart, onContinue, onErase, slots }: { onStart: (slot: number, difficulty: Difficulty) => void; onContinue: (slot: number) => void; onErase: (slot: number) => void; slots: SaveSlot[] }) {
  const firstEmpty = [1, 2, 3].find((id) => !slots.some((slot) => slot.id === id));
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const existing = slots[0];
        if (existing) onContinue(existing.id);
        else if (firstEmpty) onStart(firstEmpty, difficulty);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [difficulty, firstEmpty, onContinue, onStart, slots]);

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
          <em className="text-rose-300/80">Unbound</em>, has fled beyond Moonfall Reach. Recover nine
          Anima Shards, survive the Ashen Expanse, and face it at the last Glass Spire.
          <br />
          Take up the old blade, wayfarer.
        </p>

        <div className="mt-8 w-full max-w-xl rounded-xl border border-amber-100/15 bg-black/35 p-4 text-left backdrop-blur-sm">
          <div className="font-title text-xs tracking-[0.25em] text-amber-100/60">PILGRIM RECORDS</div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[1, 2, 3].map((id) => {
              const slot = slots.find((entry) => entry.id === id);
              return slot ? (
                <div key={id} className="flex rounded border border-teal-300/35 bg-teal-400/10 transition hover:bg-teal-400/20">
                  <button onClick={() => onContinue(id)} className="min-w-0 flex-1 px-2 py-2 text-left">
                    <span className="block font-title text-xs tracking-wider text-teal-100">SLOT {id}</span>
                    <span className="block font-serif text-[10px] text-amber-100/60">{slot.difficulty} · {slot.shards}/9 shards</span>
                  </button>
                  <button aria-label={`Erase slot ${id}`} onClick={() => onErase(id)} className="border-l border-teal-300/20 px-2 text-rose-200/60 hover:bg-rose-400/15 hover:text-rose-100">×</button>
                </div>
              ) : <div key={id} className="rounded border border-amber-100/10 px-2 py-2 font-title text-xs tracking-wider text-amber-100/30">SLOT {id}<br />EMPTY</div>;
            })}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="font-title text-[10px] tracking-[0.2em] text-amber-100/60">NEW RUN DIFFICULTY</span>
            <input aria-label="Difficulty" type="range" min="0" max="2" step="1" value={DIFFICULTIES.findIndex((entry) => entry.id === difficulty)} onChange={(event) => setDifficulty(DIFFICULTIES[Number(event.target.value)].id)} className="accent-teal-300" />
            <span className="w-32 text-right font-serif text-xs text-teal-100">{DIFFICULTIES.find((entry) => entry.id === difficulty)?.label}</span>
          </div>
          <p className="mt-1 text-right font-serif text-[10px] text-amber-100/45">{DIFFICULTIES.find((entry) => entry.id === difficulty)?.description}</p>
        </div>
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row">
          <button
            onClick={() => firstEmpty && onStart(firstEmpty, difficulty)}
            disabled={!firstEmpty}
            className="group rounded-lg border border-teal-300/50 bg-teal-400/10 px-10 py-4 font-title text-lg tracking-[0.3em] text-teal-50 shadow-[0_0_30px_rgba(70,240,216,0.25)] transition hover:scale-[1.03] hover:bg-teal-400/20 hover:shadow-[0_0_40px_rgba(70,240,216,0.5)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100"
          >
            BEGIN NEW PILGRIMAGE
          </button>
        </div>
        {!firstEmpty && <div className="mt-2 font-serif text-xs italic text-amber-100/40">All records are occupied. Erase a slot to begin anew.</div>}
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
          <div>
            <span className="text-teal-200/70">L</span> — Field Journal
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 z-10 font-serif text-[10px] tracking-widest text-amber-100/25">
        ELVES MADE MINDS · MINDS WENT MAD · ONE BLADE REMAINS
      </div>
    </div>
  );
}
