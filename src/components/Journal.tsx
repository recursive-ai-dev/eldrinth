import { useMemo, useState } from "react";
import { useControlKeys } from "./useControlKeys";
import Modal from "./Modal";
import type { JournalEntry } from "@/game/types";
import { FIELD_GUIDE_TOTALS, filterJournal, journalAsText, journalSummary, type JournalOrder, type JournalStatus } from "@/game/fieldGuide";
import FieldGuide from "./FieldGuide";
import SpriteIcon from "./SpriteIcon";
import "./journal.css";

type TabId = "all" | "lamplight" | "voices" | "intake" | "warden" | "town" | "investigations" | "expeditions" | "notes";

interface TabDef {
  id: TabId;
  label: string;
  filter: (e: JournalEntry) => boolean;
}

const TABS: TabDef[] = [
  { id: "all", label: "All Records", filter: () => true },
  { id: "lamplight", label: "Lamplight", filter: (e) => e.id.startsWith("lamplight:") },
  { id: "voices", label: "Voices", filter: (e) => e.id.startsWith("voice:") },
  { id: "intake", label: "Intake Cores", filter: (e) => e.id.startsWith("intake:") },
  { id: "warden", label: "Wardens", filter: (e) => e.id.startsWith("warden:") },
  { id: "town", label: "Townsfolk", filter: (e) => e.id.startsWith("town:") || (Boolean(e.source) && e.source!.includes("·") && !e.questId) },
  { id: "investigations", label: "Investigations", filter: (e) => Boolean(e.questId) },
  { id: "expeditions", label: "Expeditions", filter: (e) => e.id.startsWith("expedition:") },
  { id: "notes", label: "Observations & Notes", filter: (e) => e.id.startsWith("personal:") || e.id.startsWith("bleed:") || (!e.questId && !e.id.startsWith("intake:") && !e.id.startsWith("warden:") && !e.id.startsWith("town:") && !e.id.startsWith("expedition:") && !e.id.startsWith("voice:") && !e.id.startsWith("lamplight:")) },
];

function getEntryBadge(entry: JournalEntry): { label: string; borderCls: string; badgeCls: string } {
  if (entry.id.startsWith("lamplight:")) {
    return { label: "READ BY LAMPLIGHT", borderCls: "border-amber-200/50 bg-amber-950/20", badgeCls: "text-amber-100 border-amber-200/30 bg-amber-200/10" };
  }
  if (entry.id.startsWith("voice:")) {
    return { label: "HEARD AT THE FIRE", borderCls: "border-orange-200/40 bg-orange-950/15", badgeCls: "text-orange-100 border-orange-200/30 bg-orange-200/10" };
  }
  if (entry.id.startsWith("expedition:")) {
    return { label: entry.resolved ? "EXPEDITION COMPLETE" : "FIELD DISCOVERY", borderCls: "border-sky-300/50 bg-sky-950/20", badgeCls: "text-sky-200 border-sky-300/30 bg-sky-300/10" };
  }
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
  const key = useControlKeys();
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"records" | "guide">("records");
  const [status, setStatus] = useState<JournalStatus>("all");
  const [order, setOrder] = useState<JournalOrder>("recorded");
  const [feedback, setFeedback] = useState("");
  const summary = useMemo(() => journalSummary(entries), [entries]);

  const addNote = () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    onAddNote(trimmed);
    setNote("");
    setFeedback("Observation added to your journal.");
  };

  const availableTabs = useMemo(() => {
    return TABS.filter((t) => t.id === "all" || entries.some(t.filter));
  }, [entries]);

  // A category hides itself once it is empty, so the selected tab is always
  // resolved against the ones still on offer rather than trusted blindly.
  const activeTabDef = useMemo(
    () => availableTabs.find((t) => t.id === activeTab) ?? availableTabs[0] ?? TABS[0],
    [availableTabs, activeTab],
  );

  const displayedEntries = useMemo(() => {
    return filterJournal(entries, { query: search, status, order, category: activeTabDef.filter });
  }, [entries, activeTabDef, search, status, order]);

  const hasFilters = search.trim() !== "" || status !== "all" || activeTabDef.id !== "all";
  const resetFilters = () => { setSearch(""); setStatus("all"); setActiveTab("all"); };
  const copyRecords = async () => {
    try {
      await navigator.clipboard.writeText(journalAsText(displayedEntries));
      setFeedback(`Copied ${displayedEntries.length} ${displayedEntries.length === 1 ? "record" : "records"}.`);
    } catch {
      setFeedback("Clipboard unavailable. Use Export to keep a text copy.");
    }
  };
  const exportRecords = () => {
    let url: string | undefined;
    try {
      url = URL.createObjectURL(new Blob([journalAsText(displayedEntries)], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "eldrinth-field-journal.txt";
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); }
      setFeedback(`Exported ${displayedEntries.length} ${displayedEntries.length === 1 ? "record" : "records"}.`);
    } catch {
      setFeedback("Export unavailable. You can select and copy the journal text.");
    } finally {
      if (url) { const downloadUrl = url; window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000); }
    }
  };

  return (
    <Modal
      labelledBy="journal-heading"
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onKeyDown={(event) => {
        // Escape has to work from inside the note field too, because the close
        // button right above it advertises ESC.
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <section
        // Journal prose is real text a player may need to copy, and the note
        // field is a real text field: selection is re-enabled for this panel
        // even though the game surface around it suppresses it.
        className="journal-panel journal-workspace selectable flex max-h-[86dvh] w-[min(820px,96vw)] flex-col rounded-xl border border-amber-200/25 bg-[#14100e]/95 p-4 shadow-2xl [overscroll-behavior:contain] sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-amber-200/15 pb-3">
          <div>
            <div className="font-title text-xs tracking-[.35em] text-amber-200/75">FIELD JOURNAL</div>
            <h2 id="journal-heading" className="font-serif text-2xl text-amber-100 sm:text-3xl">{view === "records" ? "Notes, Cores & Testimonies" : "The Traveller's Field Guide"}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-amber-200/20 px-2.5 py-1 font-title text-xs tracking-widest text-amber-200/70 transition hover:border-amber-200/50 hover:text-amber-100"
          >
            ESC / {key.journal} / CLOSE
          </button>
        </div>

        <div className="journal-view-switch" role="group" aria-label="Journal views">
          <button aria-pressed={view === "records"} onClick={() => setView("records")}><SpriteIcon id="journal" size={24} />Records</button>
          <button aria-pressed={view === "guide"} onClick={() => setView("guide")}><SpriteIcon id="chart" size={24} />Field guide</button>
        </div>

        <div className="journal-summary" aria-label="Journal progress">
          <span><strong>{summary.records}</strong> {summary.records === 1 ? "record" : "records"}</span>
          <span><strong>{summary.openInvestigations}</strong> open {summary.openInvestigations === 1 ? "investigation" : "investigations"}</span>
          <span><strong>{summary.resolvedInvestigations}</strong> {summary.resolvedInvestigations === 1 ? "decision" : "decisions"}</span>
          <span><strong>{summary.completedExpeditions}/{FIELD_GUIDE_TOTALS.expeditions}</strong> expeditions</span>
          <span><strong>{summary.copiedLamplight}/{FIELD_GUIDE_TOTALS.inscriptions}</strong> inscriptions</span>
        </div>

        {view === "guide" ? <FieldGuide entries={entries} /> : <>
        {/* Tab filters */}
        {availableTabs.length > 1 && (
          <div role="group" aria-label="Journal categories" className="mb-4 flex flex-wrap gap-1.5 border-b border-amber-200/10 pb-2">
            {availableTabs.map((tab) => {
              const count = entries.filter(tab.filter).length;
              const isActive = activeTabDef.id === tab.id;
              return (
                <button
                  key={tab.id}
                  aria-pressed={isActive}
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

        <div className="mb-4 flex items-center gap-3">
          <input type="search" aria-label="Search journal" placeholder="Search names, places, and your notes…" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 rounded border border-amber-100/20 bg-black/30 px-3 py-2 text-sm text-amber-50 placeholder:text-amber-100/50" />
          <span role="status" className="shrink-0 text-xs text-amber-100/70">{displayedEntries.length} of {entries.length} records</span>
        </div>

        <div className="journal-toolbar">
          <label>Show<select aria-label="Record status" value={status} onChange={event => setStatus(event.target.value as JournalStatus)}><option value="all">All statuses</option><option value="open">Open threads</option><option value="resolved">Decisions & completions</option><option value="personal">My observations</option></select></label>
          <label>Order<select aria-label="Record order" value={order} onChange={event => setOrder(event.target.value as JournalOrder)}><option value="recorded">Record order</option><option value="reverse">Reverse record order</option><option value="title">Title A–Z</option><option value="source">Source A–Z</option></select></label>
          {hasFilters && <button onClick={resetFilters}>Clear filters</button>}
          <button className="journal-export" onClick={() => { void copyRecords(); }} disabled={!displayedEntries.length} title="Copy the records currently shown">Copy results</button>
          <button onClick={exportRecords} disabled={!displayedEntries.length} title="Download the records currently shown as plain text">Export</button>
        </div>

        {/* Content list with scrolling */}
        <div className="journal-records flex-1 space-y-4 overflow-y-auto pr-2 [overscroll-behavior:contain]">
          {displayedEntries.length === 0 ? (
            <div className="journal-empty font-serif italic">
              <p>{hasFilters ? "No records match your filters. Try another name, place, or status." : "No entries recorded yet. Explore ruins, speak with townsfolk, and investigate the Spire's fortresses to uncover the truth."}</p>
              {hasFilters ? <button onClick={resetFilters}>Show all records</button> : <button onClick={() => setView("guide")}>Explore first steps</button>}
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
                  <p className="reading-copy mt-2 font-serif text-sm leading-relaxed text-amber-50/90 whitespace-pre-line">
                    {entry.text}
                  </p>
                </article>
              );
            })
          )}
        </div>

        {/* Note entry at bottom */}
        <div className="mt-4 border-t border-amber-100/10 pt-3">
          <label htmlFor="journal-note" className="font-title text-[10px] tracking-[0.2em] text-amber-100/75">
            MY OBSERVATION
          </label>
          <div className="mt-1.5 flex gap-2">
            <textarea
              id="journal-note"
              value={note}
              aria-describedby="journal-note-count"
              maxLength={1200}
              rows={2}
              placeholder="Record a landmark, rumour, or reflection (Ctrl+Enter to write)…"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="sentences"
              enterKeyHint="enter"
              onChange={(event) => { setNote(event.target.value); setFeedback(""); }}
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
              disabled={!note.trim()}
              className="self-end rounded border border-teal-200/30 px-3 py-1.5 font-title text-xs tracking-wider text-teal-100 transition hover:bg-teal-300/10"
            >
              WRITE
            </button>
          </div>
          <div className="journal-note-meta"><span role="status" className="journal-feedback">{feedback}</span><span id="journal-note-count" className="journal-note-counter">{note.length} / 1200 characters</span></div>
        </div>
        </>}
      </section>
    </Modal>
  );
}
