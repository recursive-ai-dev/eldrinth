import { useMemo, useState } from "react";
import type { JournalEntry } from "@/game/types";

type TabId = "all" | "intake" | "warden" | "town" | "investigations" | "notes";

interface TabDef {
  id: TabId;
  label: string;
  filter: (e: JournalEntry) => boolean;
}

const TABS: TabDef[] = [
  { id: "all", label: "All Records", filter: () => true },
  { id: "intake", label: "Intake Cores", filter: (e) => e.id.startsWith("intake:") },
  { id: "warden", label: "Wardens", filter: (e) => e.id.startsWith("warden:") },
  { id: "town", label: "Townsfolk", filter: (e) => e.id.startsWith("town:") || (Boolean(e.source) && e.source!.includes("·") && !e.questId) },
  { id: "investigations", label: "Investigations", filter: (e) => Boolean(e.questId) },
  { id: "notes", label: "Observations & Notes", filter: (e) => e.id.startsWith("personal:") || e.id.startsWith("bleed:") || (!e.questId && !e.id.startsWith("intake:") && !e.id.startsWith("warden:") && !e.id.startsWith("town:")) },
];

function getEntryBadge(entry: JournalEntry): { label: string; borderCls: string; badgeCls: string } {
  if (entry.id.startsWith("intake:")) {
    return { label: "CORE DOCKET", borderCls: "border-teal-400/60 bg-teal-950/25", badgeCls: "text-teal-300 border-teal-400/40 bg-teal-400/10" };
  }
  if (entry.id.startsWith("warden:")) {
    return { label: "WARDEN RECORD", borderCls: "border-rose-400/50 bg-rose-950/25", badgeCls: "text-rose-300 border-rose-400/40 bg-rose-400/10" };
  }
  if (entry.resolved) {
    return { label: "DECISION RECORDED", borderCls: "border-amber-400/60 bg-amber-950/25", badgeCls: "text-amber-300 border-amber-400/40 bg-amber-400/10" };
  }
  if (entry.questId) {
    return { label: "INVESTIGATION", borderCls: "border-teal-300/40 bg-black/20", badgeCls: "text-teal-200 border-teal-300/30 bg-teal-300/10" };
  }
  if (entry.id.startsWith("town:") || (entry.source && entry.source.includes("·"))) {
    return { label: "TESTIMONY", borderCls: "border-amber-300/45 bg-black/20", badgeCls: "text-amber-200 border-amber-300/30 bg-amber-300/10" };
  }
  if (entry.id.startsWith("personal:")) {
    return { label: "OBSERVATION", borderCls: "border-amber-200/35 bg-black/20", badgeCls: "text-amber-100/70 border-amber-200/20 bg-amber-200/5" };
  }
  return { label: "FIELD NOTE", borderCls: "border-amber-100/25 bg-black/15", badgeCls: "text-amber-100/60 border-amber-100/20 bg-amber-100/5" };
}

export default function Journal({
  entries,
  onClose,
  onAddNote,
}: {
  entries: JournalEntry[];
  onClose: () => void;
  onAddNote: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("all");

  const addNote = () => {
    if (!note.trim()) return;
    onAddNote(note);
    setNote("");
  };

  const availableTabs = useMemo(() => {
    return TABS.filter((t) => t.id === "all" || entries.some(t.filter));
  }, [entries]);

  const activeFilter = useMemo(() => {
    const found = TABS.find((t) => t.id === activeTab);
    return found ? found.filter : () => true;
  }, [activeTab]);

  const displayedEntries = useMemo(() => {
    return entries.filter(activeFilter);
  }, [entries, activeFilter]);

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        className="flex max-h-[86vh] w-[min(820px,96vw)] flex-col rounded-xl border border-amber-200/25 bg-[#14100e]/95 p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-baseline justify-between border-b border-amber-200/15 pb-3">
          <div>
            <div className="font-title text-xs tracking-[.35em] text-amber-200/60">FIELD JOURNAL</div>
            <h2 className="font-serif text-3xl text-amber-100">Notes, Cores & Testimonies</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-amber-200/20 px-2.5 py-1 font-title text-xs tracking-widest text-amber-200/70 transition hover:border-amber-200/50 hover:text-amber-100"
          >
            ESC / L / CLOSE
          </button>
        </div>

        {/* Tab filters */}
        {availableTabs.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-1.5 border-b border-amber-200/10 pb-2">
            {availableTabs.map((tab) => {
              const count = entries.filter(tab.filter).length;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-md border px-2.5 py-1 font-title text-[11px] tracking-wider transition ${
                    isActive
                      ? "border-teal-300/60 bg-teal-400/15 text-teal-100"
                      : "border-amber-100/15 bg-black/20 text-amber-100/60 hover:border-amber-100/35 hover:text-amber-100"
                  }`}
                >
                  {tab.label} <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Content list with scrolling */}
        <div className="flex-1 space-y-4 overflow-y-auto pr-2">
          {displayedEntries.length === 0 ? (
            <div className="py-8 text-center font-serif italic text-amber-100/50">
              No entries recorded in this category yet. Explore ruins, speak with townsfolk, and investigate the Spire's fortresses to uncover the truth.
            </div>
          ) : (
            displayedEntries.map((entry) => {
              const badge = getEntryBadge(entry);
              return (
                <article
                  key={entry.id}
                  className={`rounded-lg border-l-3 p-4 pl-4 transition ${badge.borderCls}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`rounded border px-1.5 py-0.5 font-title text-[9px] tracking-widest ${badge.badgeCls}`}>
                        {badge.label}
                      </span>
                      <h3 className="font-title text-sm tracking-wide text-teal-50">{entry.title}</h3>
                    </div>
                    {entry.source && (
                      <span className="font-title text-[10px] tracking-wider text-amber-100/40">
                        {entry.source}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-serif text-sm leading-relaxed text-amber-50/90 whitespace-pre-line">
                    {entry.text}
                  </p>
                </article>
              );
            })
          )}
        </div>

        {/* Note entry at bottom */}
        <div className="mt-4 border-t border-amber-100/10 pt-3">
          <label htmlFor="journal-note" className="font-title text-[10px] tracking-[0.2em] text-amber-100/55">
            MY OBSERVATION
          </label>
          <div className="mt-1.5 flex gap-2">
            <textarea
              id="journal-note"
              value={note}
              maxLength={1200}
              rows={2}
              placeholder="Record a landmark, rumour, or reflection (Ctrl+Enter to write)…"
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  addNote();
                }
              }}
              className="min-w-0 flex-1 resize-none rounded border border-amber-100/15 bg-black/40 px-3 py-1.5 font-serif text-sm text-amber-50 outline-none placeholder:text-amber-100/30 focus:border-teal-200/40"
            />
            <button
              onClick={addNote}
              className="self-end rounded border border-teal-200/30 px-3 py-1.5 font-title text-xs tracking-wider text-teal-100 transition hover:bg-teal-300/10"
            >
              WRITE
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
