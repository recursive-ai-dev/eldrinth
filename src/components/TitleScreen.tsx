import { useEffect, useRef, useState } from "react";
import titleBg from "@/assets/title.jpg";
import type { Difficulty } from "@/game/types";
import type { SaveSlot } from "@/game/slots";
import AnimaSigil from "./AnimaSigil";

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
  onExport,
  onImport,
  slots,
  slotsReady = true,
  busy = false,
  savingUnavailable = false,
}: {
  onStart: (slot: number, difficulty: Difficulty) => void;
  onContinue: (slot: number) => void;
  onErase: (slot: number) => void;
  onExport?: (slot: number) => void;
  onImport?: (slot: number, file: File) => void;
  slots: SaveSlot[];
  slotsReady?: boolean;
  busy?: boolean;
  savingUnavailable?: boolean;
}) {
  const enabled = slotsReady && !busy;
  const firstEmpty = slotsReady ? [1, 2, 3].find((id) => !slots.some((slot) => slot.id === id)) : undefined;
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [eraseConfirm, setEraseConfirm] = useState<number | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const importSlot = useRef<number | null>(null);
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
    <div className="title-world absolute inset-0 z-40 overflow-hidden">
      <img
        src={titleBg}
        alt=""
        className="title-landscape absolute inset-0 h-full w-full object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-linear-to-b from-black/40 via-black/30 to-black/85" />
      <div className="absolute inset-0 vignette" />
      <AnimaSigil className="title-sigil absolute text-amber-100/35" />
      <div aria-hidden="true" className="title-rule" />

      <div data-testid="title-scroll" className="title-scroll absolute inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full flex-col items-center px-4 py-8 text-center sm:px-6">
          <div className="my-auto flex w-full max-w-3xl shrink-0 flex-col items-center">
            <div className="mb-5 flex items-center gap-3 font-title text-[10px] tracking-[.25em] text-amber-100/75"><span className="h-px w-8 bg-amber-100/30" />THE LIVING FRONTIER · 1.4<span className="h-px w-8 bg-amber-100/30" /></div>
            <div className="font-title text-xs uppercase tracking-[0.6em] text-teal-300/70 glow-pulse">
              Nine people. One body. Your decision.
            </div>
            <h1 className="font-title mt-3 text-[clamp(2.5rem,10vw,4.5rem)] font-bold leading-none tracking-[0.12em] text-amber-50 drop-shadow-[0_2px_18px_rgba(0,0,0,0.9)]">
              ELDRINTH
            </h1>
            <div className="mt-2 flex items-center gap-3 text-amber-200/50">
              <span className="h-px w-12 bg-amber-200/30" />
              <span className="font-title text-sm tracking-[0.4em]">THE UNBOUND SPIRE</span>
              <span className="h-px w-12 bg-amber-200/30" />
            </div>

            <p className="mx-auto mt-6 max-w-xl font-serif text-base leading-relaxed text-amber-50/85 sm:text-lg">
              Beneath the last Glass Spire, a mind built to remember everything wakes alone.
              Nine Anima Shards will quiet it, they say. Each one is a person still inside.
              Take up the old blade, wayfarer. Orithel waits in Ilyarael.
            </p>
            <p className="mt-3 font-serif text-sm italic text-teal-100/75">The world calls them shards. Learn their names.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-1 border-y border-amber-100/15 py-2.5 font-title text-[9px] tracking-[.17em] text-amber-100/65"><span>READ THE ROADS</span><span>HOLD YOUR GROUND</span><span>LISTEN AT THE FIRE</span></div>

            <div className="mt-8 w-full max-w-xl rounded-xl border border-amber-100/15 bg-black/35 p-4 text-left backdrop-blur-sm">
              <div className="font-title text-xs tracking-[0.25em] text-amber-100/75">PILGRIM RECORDS</div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[1, 2, 3].map((id) => {
                  const slot = slots.find((entry) => entry.id === id);
                  return slot ? (
                    <div key={id} className="flex flex-col rounded border border-teal-300/35 bg-teal-400/10 transition hover:bg-teal-400/20">
                      <button disabled={!enabled} onClick={() => onContinue(id)} className="min-w-0 flex-1 px-2 py-2 text-left">
                        <span className="block font-title text-xs tracking-wider text-teal-100">SLOT {id}</span>
                        <span className="block font-serif text-[10px] text-amber-100/75">{slot.difficulty} · {slot.shards}/9 shards</span>
                        <time dateTime={new Date(slot.updatedAt).toISOString()} className="mt-1 block text-[10px] text-amber-100/60">{new Date(slot.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {new Date(slot.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                      </button>
                      <div className="flex flex-wrap border-t border-teal-300/20 text-[10px]">
                        {onExport && <button disabled={!enabled} aria-label={`Export slot ${id}`} onClick={() => onExport(id)} className="flex-1 px-2 py-2 text-teal-100 hover:bg-teal-400/15 disabled:opacity-40">Export</button>}
                        <button disabled={!enabled} aria-label={`Erase slot ${id}`} onClick={() => setEraseConfirm(id)} className="flex-1 px-2 py-2 text-rose-200/80 hover:bg-rose-400/15 hover:text-rose-100 disabled:opacity-40">Erase</button>
                      </div>
                      {eraseConfirm === id && <div className="border-t border-rose-300/25 p-2 text-[11px] text-rose-100">
                        <p>Erase this pilgrimage permanently? Export it first to keep a backup.</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button disabled={!enabled} onClick={() => { setEraseConfirm(null); onErase(id); }} className="rounded border border-rose-300/40 px-2 py-1">Confirm erase</button>
                          <button onClick={() => setEraseConfirm(null)} className="rounded border border-amber-100/30 px-2 py-1">Cancel</button>
                        </div>
                      </div>}
                    </div>
                  ) : <div key={id} className="flex flex-col rounded border border-amber-100/20 px-2 py-2 font-title text-xs tracking-wider text-amber-100/70">SLOT {id}<br />{slotsReady ? "EMPTY" : "LOADING…"}
                    {onImport && <button disabled={!enabled || savingUnavailable} aria-label={`Import backup into slot ${id}`} onClick={() => { importSlot.current = id; importInput.current?.click(); }} className="mt-2 rounded border border-amber-100/25 px-1 py-2 font-serif text-[11px] tracking-normal hover:bg-amber-100/10 disabled:opacity-40">Import backup</button>}
                  </div>;
                })}
              </div>
              {onImport && <input ref={importInput} type="file" accept=".json,application/json" className="hidden" aria-label="Pilgrimage backup file" onChange={event => {
                const file = event.target.files?.[0];
                const id = importSlot.current;
                event.target.value = "";
                importSlot.current = null;
                if (file && id !== null && enabled && !savingUnavailable) onImport(id, file);
              }} />}
              {(onExport || onImport) && <p className="mt-3 font-serif text-[11px] leading-relaxed text-amber-100/70">Export a record to carry it between the browser and desktop or keep a backup. Import fills an empty slot; existing pilgrimages are preserved.</p>}
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
              <div><span className="text-teal-200/80">Q</span> — Switch Weapon</div>
              <div><span className="text-teal-200/80">I / Esc</span> — Equipment</div>
              <div><span className="text-teal-200/80">F</span> — Timed Parry</div>
              <div><span className="text-teal-200/80">R</span> — Lantern</div>
              <div><span className="text-teal-200/80">M</span> — Local Atlas</div>
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
            THEY WERE PEOPLE BEFORE THEY WERE USEFUL
          </div>
        </div>
      </div>
    </div>
  );
}
