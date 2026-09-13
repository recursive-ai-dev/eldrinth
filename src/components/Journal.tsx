import { useState } from "react";
import type { JournalEntry } from "@/game/types";

export default function Journal({ entries, onClose, onAddNote }: { entries: JournalEntry[]; onClose: () => void; onAddNote: (note: string) => void }) {
  const [note, setNote] = useState("");
  const addNote = () => {
    if (!note.trim()) return;
    onAddNote(note);
    setNote("");
  };
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-5 backdrop-blur-sm" onClick={onClose}>
      <section className="max-h-[82vh] w-[min(760px,94vw)] overflow-y-auto rounded-xl border border-amber-200/25 bg-[#17120f]/95 p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-baseline justify-between border-b border-amber-200/15 pb-3">
          <div><div className="font-title text-xs tracking-[.35em] text-amber-200/60">FIELD JOURNAL</div><h2 className="font-serif text-3xl text-amber-100">Notes & Rumours</h2></div>
          <button onClick={onClose} className="font-title text-xs tracking-widest text-amber-200/70 hover:text-amber-100">L / CLOSE</button>
        </div>
        <div className="mb-6 rounded-lg border border-amber-100/10 bg-black/15 p-3">
          <label htmlFor="journal-note" className="font-title text-[10px] tracking-[0.2em] text-amber-100/55">MY OBSERVATION</label>
          <div className="mt-2 flex gap-2">
            <textarea
              id="journal-note"
              value={note}
              maxLength={1200}
              rows={2}
              placeholder="A landmark, rumour, or route worth remembering…"
              onChange={(event) => setNote(event.target.value)}
              className="min-w-0 flex-1 resize-none rounded border border-amber-100/15 bg-black/30 px-3 py-2 font-serif text-sm text-amber-50 outline-none placeholder:text-amber-100/30 focus:border-teal-200/40"
            />
            <button onClick={addNote} className="self-end rounded border border-teal-200/30 px-3 py-2 font-title text-xs tracking-wider text-teal-100 hover:bg-teal-300/10">WRITE</button>
          </div>
        </div>
        {entries.length === 0 ? <p className="font-serif italic text-amber-100/60">Blank pages. Read carvings, letters, and wayfarers’ notes to record what the world tells you.</p> :
          <div className="space-y-5">{entries.map((entry) => <article key={entry.id} className={`border-l-2 pl-4 ${entry.resolved ? "border-amber-300/55" : "border-teal-300/35"}`}><div className="flex flex-wrap items-baseline justify-between gap-x-3"><h3 className="font-title text-sm tracking-wider text-teal-100">{entry.title}</h3>{entry.source && <span className="font-title text-[9px] tracking-wider text-amber-100/40">{entry.source}</span>}</div><p className="mt-1 font-serif leading-relaxed text-amber-50/85">{entry.text}</p></article>)}</div>}
      </section>
    </div>
  );
}
