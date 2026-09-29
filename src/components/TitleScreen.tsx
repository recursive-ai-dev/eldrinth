import { useEffect, useState } from "react";
import titleBg from "@/assets/title.jpg";
import type { Difficulty } from "@/game/types";
import type { SaveSlot } from "@/game/slots";

const DIFFICULTIES: { id: Difficulty; label: string; description: string }[] = [
  { id: "story", label: "Story", description: "More health · slower, less alert foes" },
  { id: "standard", label: "Standard", description: "Intended challenge" },
  { id: "brutal", label: "Brutal", description: "Hardened, deadlier foes" },
];

const INTERACTIVE = "button, input, select, textarea, a[href], [contenteditable]";

export default function TitleScreen({
  onStart,
  onContinue,
  onErase,
  slots,
  slotsReady = true,
  busy = false,
  savingUnavailable = false,
}: {
  onStart: (slot: number, difficulty: Difficulty) => void;
  onContinue: (slot: number) => void;
  onErase: (slot: number) => void;
  slots: SaveSlot[];
  slotsReady?: boolean;
  busy?: boolean;
  savingUnavailable?: boolean;
}) {
  const enabled = slotsReady && !busy;
  const firstEmpty = slotsReady ? [1, 2, 3].find((id) => !slots.some((slot) => slot.id === id)) : undefined;
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // Auto-repeat from the key that dismissed the previous screen must not
      // start or continue a run the player never chose.
      if (e.repeat || !enabled) return;
      // A button's Enter/Space activation is the default action of keydown, so
      // an unconditional preventDefault() here cancels it. That made the slot
      // erase button unreachable by keyboard, and since the only remedy the
      // screen offers for three occupied slots is "erase a slot", a
      // keyboard-only player was locked out of starting a new run entirely.
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(INTERACTIVE)) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const existing = slots[0];
        if (existing) onContinue(existing.id);
        else if (firstEmpty) onStart(firstEmpty, difficulty);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [difficulty, enabled, firstEmpty, onContinue, onStart, slots]);

  return (
    <div className="absolute inset-0 z-40 overflow-hidden">
      <img
        src={titleBg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-linear-to-b from-black/40 via-black/30 to-black/85" />
      <div className="absolute inset-0 vignette" />

      <div data-testid="title-scroll" className="title-scroll absolute inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full flex-col items-center px-4 py-8 text-center sm:px-6">
          <div className="my-auto flex w-full max-w-3xl shrink-0 flex-col items-center">
            <div className="font-title text-xs uppercase tracking-[0.6em] text-teal-300/70 glow-pulse">
              A Dark Fantasy of the Forged
            </div>
            <h1 className="font-title mt-3 text-[clamp(2.5rem,10vw,4.5rem)] font-bold leading-none tracking-[0.12em] text-amber-50 drop-shadow-[0_2px_18px_rgba(0,0,0,0.9)]">
              ELDRINTH
            </h1>
            <div className="mt-2 flex items-center gap-3 text-amber-200/50">
              <span className="h-px w-12 bg-amber-200/30" />
              <span className="font-title text-sm tracking-[0.4em]">THE UNBOUND SPIRE</span>
              <span className="h-px w-12 bg-amber-200/30" />
            </div>

            <p className="mx-auto mt-6 max-w-2xl font-serif text-base leading-relaxed text-amber-50/70 sm:text-lg">
              Long ago the Elder Elves built the <em className="text-teal-200/80">Mnemonic</em> — a mind
              that would lose nothing — and set it to keep their cities. When the last Elf died it went on
              remembering, alone, and some of what it holds has since{" "}
              <em className="text-rose-300/80">Sundered</em> into hunger. The greatest of them, the{" "}
              <em className="text-rose-300/80">Unbound</em>, wakes beneath the last Glass Spire. Nine Anima
              Shards will quiet it, they say. Orithel keeps the hall at Ilyarael, and will tell you where to
              look.
              <br />
              Take up the old blade, wayfarer.
            </p>

            <div className="mt-8 w-full max-w-xl rounded-xl border border-amber-100/15 bg-black/35 p-4 text-left backdrop-blur-sm">
              <div className="font-title text-xs tracking-[0.25em] text-amber-100/75">PILGRIM RECORDS</div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[1, 2, 3].map((id) => {
                  const slot = slots.find((entry) => entry.id === id);
                  return slot ? (
                    <div key={id} className="flex rounded border border-teal-300/35 bg-teal-400/10 transition hover:bg-teal-400/20">
                      <button disabled={!enabled} onClick={() => onContinue(id)} className="min-w-0 flex-1 px-2 py-2 text-left">
                        <span className="block font-title text-xs tracking-wider text-teal-100">SLOT {id}</span>
                        <span className="block font-serif text-[10px] text-amber-100/75">{slot.difficulty} · {slot.shards}/9 shards</span>
                      </button>
                      <button disabled={!enabled} aria-label={`Erase slot ${id}`} onClick={() => onErase(id)} className="border-l border-teal-300/20 px-2 text-rose-200/80 hover:bg-rose-400/15 hover:text-rose-100">×</button>
                    </div>
                  ) : <div key={id} className="rounded border border-amber-100/20 px-2 py-2 font-title text-xs tracking-wider text-amber-100/70">SLOT {id}<br />{slotsReady ? "EMPTY" : "LOADING…"}</div>;
                })}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="font-title text-[10px] tracking-[0.2em] text-amber-100/75">NEW RUN DIFFICULTY</span>
                <input aria-label="Difficulty" type="range" min="0" max="2" step="1" value={DIFFICULTIES.findIndex((entry) => entry.id === difficulty)} onChange={(event) => setDifficulty(DIFFICULTIES[Number(event.target.value)].id)} className="accent-teal-300" />
                <span className="w-32 text-right font-serif text-xs text-teal-100">{DIFFICULTIES.find((entry) => entry.id === difficulty)?.label}</span>
              </div>
              <p className="mt-1 text-right font-serif text-[10px] text-amber-100/70">{DIFFICULTIES.find((entry) => entry.id === difficulty)?.description}</p>
            </div>
            <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row">
              <button
                onClick={() => firstEmpty && onStart(firstEmpty, difficulty)}
                disabled={!enabled || !firstEmpty}
                className="group rounded-lg border border-teal-300/50 bg-teal-400/10 px-10 py-4 font-title text-lg tracking-[0.3em] text-teal-50 shadow-[0_0_30px_rgba(70,240,216,0.25)] transition hover:scale-[1.03] hover:bg-teal-400/20 hover:shadow-[0_0_40px_rgba(70,240,216,0.5)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100"
              >
                BEGIN NEW PILGRIMAGE
              </button>
            </div>
            {!slotsReady && <p role="status" className="mt-2 text-sm text-amber-100/75">Reading saved records…</p>}
            {slotsReady && !firstEmpty && <div className="mt-2 font-serif text-xs italic text-amber-100/75">All records are occupied. Erase a slot to begin anew.</div>}
            <div className="mt-3 font-serif text-xs italic text-amber-100/70">
              press Enter · move with WASD · strike with J or Space
            </div>

            <div className="mt-8 grid w-full max-w-xl grid-cols-2 gap-x-8 gap-y-1 text-left font-serif text-xs text-amber-100/70 sm:grid-cols-4">
              <div>
                <span className="text-teal-200/80">WASD / Arrows</span> — Move
              </div>
              <div>
                <span className="text-teal-200/80">J / Space</span> — Attack
              </div>
              <div>
                <span className="text-teal-200/80">Shift</span> — Dash
              </div>
              <div>
                <span className="text-teal-200/80">E</span> — Speak / Read
              </div>
              <div>
                <span className="text-teal-200/80">L</span> — Field Journal
              </div>
            </div>
          </div>

          {savingUnavailable && (
            <p
              role="status"
              data-testid="title-save-warning"
              className="mt-6 max-w-lg rounded border border-amber-500/40 bg-[#1a1408]/95 px-4 py-2 text-center font-serif text-xs text-amber-100"
            >
              Saving is unavailable in this browser session. Everything
              else works, but progress will be lost when you close the page.
            </p>
          )}

          <div className="mt-6 font-serif text-[10px] tracking-widest text-amber-100/60">
            ELVES MADE MINDS · MINDS WENT MAD · ONE BLADE REMAINS
          </div>
        </div>
      </div>
    </div>
  );
}
