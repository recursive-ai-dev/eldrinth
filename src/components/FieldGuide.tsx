import { useMemo, useState } from "react";
import { createFieldGuide, filterGuide, GUIDE_SECTIONS, type GuideSection } from "@/game/fieldGuide";
import type { JournalEntry } from "@/game/types";
import EquipmentIcon from "./EquipmentIcon";
import SpriteIcon from "./SpriteIcon";

export default function FieldGuide({ entries }: { entries: JournalEntry[] }) {
  const [section, setSection] = useState<GuideSection>("first-steps");
  const [query, setQuery] = useState("");
  const cards = useMemo(() => createFieldGuide(entries), [entries]);
  const visible = useMemo(() => filterGuide(cards, query, section), [cards, query, section]);
  const milestones = cards.filter(card => card.section === "first-steps");
  const recorded = milestones.filter(card => card.status === "Recorded").length;
  return <div className="field-guide">
    <p className="guide-intro">A traveller's reference. First steps follow your saved records; route hints open only when you choose them.</p>
    <div className="guide-sections" role="group" aria-label="Field guide sections">
      {GUIDE_SECTIONS.map(item => <button key={item.id} aria-pressed={section === item.id && !query.trim()} onClick={() => { setSection(item.id); setQuery(""); }}><SpriteIcon id={item.icon} size={24} />{item.label}</button>)}
    </div>
    <div className="guide-search">
      <input aria-label="Search field guide" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search tactics, relics, or regions…" />
      <span role="status">{visible.length} {visible.length === 1 ? "entry" : "entries"}{query.trim() ? " across all sections" : ""}</span>
    </div>
    {!query.trim() && section === "first-steps" && <div className="guide-milestones"><label htmlFor="guide-progress">{recorded} of {milestones.length} first steps recorded</label><progress id="guide-progress" value={recorded} max={milestones.length} /><span>Optional suggestions; there is no required order.</span></div>}
    <div className="guide-cards">
      {visible.map(card => <article key={card.id} className="guide-card" data-complete={card.status === "Complete" || card.status === "Recorded" || card.status === "Copied"}>
        <div className="guide-card-heading">
          {card.equipmentId ? <EquipmentIcon id={card.equipmentId} size={40} /> : <SpriteIcon id={card.icon} size={40} />}
          <div><div className="guide-eyebrow">{card.region ?? GUIDE_SECTIONS.find(item => item.id === card.section)?.label}</div><h3>{card.title}</h3></div>
          {card.status && <span className="guide-status">{card.status}</span>}
        </div>
        <p className="reading-copy">{card.summary}</p>
        {card.detail && <p className="reading-copy guide-detail">{card.detail}</p>}
        {card.route && <details className="guide-route"><summary>Route hint</summary><p className="reading-copy">{card.route}</p></details>}
      </article>)}
    </div>
    {visible.length === 0 && <div className="journal-empty"><p>No guide entries match that search.</p><button onClick={() => setQuery("")}>Clear guide search</button></div>}
  </div>;
}
