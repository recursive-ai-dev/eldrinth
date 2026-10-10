import { describe, expect, it } from "vitest";
import { createFieldGuide, filterGuide, filterJournal, journalAsText, journalSummary } from "./fieldGuide";
import { EXPEDITION_SITES } from "./encounters";
import { LANTERN_RECORDS } from "./lantern";
import { COMBAT_TOOLS, RELICS } from "./equipment";
import type { JournalEntry } from "./types";

const entry = (id: string, properties: Partial<JournalEntry> = {}): JournalEntry => ({ id, title: id, text: "A record from the road.", ...properties });

describe("journal status and progress", () => {
  const entries = [
    entry("open:lead", { questId: "open" }),
    entry("open:clue", { questId: "open" }),
    entry("settled:lead", { questId: "settled" }),
    entry("settled:resolved", { questId: "settled", resolved: true }),
    entry("expedition:uncounted-hollow:found"),
    entry("expedition:drowned-court:guard:9"),
    entry("expedition:drowned-court:complete", { resolved: true }),
    entry("personal:1"),
    entry("lamplight:arrival-rubbing"),
    entry("lamplight:unknown-future-record"),
  ];

  it("counts distinct investigations and authored discoveries instead of evidence rows", () => {
    expect(journalSummary(entries)).toEqual({ records: 10, openInvestigations: 1, resolvedInvestigations: 1, completedExpeditions: 1, copiedLamplight: 1, personalNotes: 1 });
  });

  it("removes a settled investigation and completed expedition's evidence from open threads", () => {
    expect(filterJournal(entries, { status: "open" }).map(item => item.id)).toEqual(["open:lead", "open:clue", "expedition:uncounted-hollow:found"]);
    expect(filterJournal(entries, { status: "resolved" }).map(item => item.id)).toEqual(["settled:lead", "settled:resolved", "expedition:drowned-court:guard:9", "expedition:drowned-court:complete"]);
    expect(filterJournal(entries, { status: "personal" }).map(item => item.id)).toEqual(["personal:1"]);
  });

  it("uses the full journal to determine status before a category hides the decision", () => {
    const evidenceOnly = (item: JournalEntry) => item.id.endsWith(":lead");
    expect(filterJournal(entries, { category: evidenceOnly, status: "resolved" }).map(item => item.id)).toEqual(["settled:lead"]);
  });

  it("combines case-insensitive search terms across title, source, and prose", () => {
    const records = [entry("a", { title: "North watch", source: "Coast", text: "The road is quiet." }), entry("b", { title: "South road" })];
    expect(filterJournal(records, { query: "  ROAD north COAST " }).map(item => item.id)).toEqual(["a"]);
    expect(filterJournal(records, { query: "missing" })).toEqual([]);
  });

  it("supports stable presentation orders without mutating saved records", () => {
    const records = [entry("b", { title: "Bee", source: "Cinderwild" }), entry("a", { title: "Ash", source: "Old Lands" }), entry("c", { title: "Cup", source: "Cinderwild" })];
    expect(filterJournal(records, { order: "title" }).map(item => item.id)).toEqual(["a", "b", "c"]);
    expect(filterJournal(records, { order: "source" }).map(item => item.id)).toEqual(["b", "c", "a"]);
    expect(filterJournal(records, { order: "reverse" }).map(item => item.id)).toEqual(["c", "a", "b"]);
    expect(records.map(item => item.id)).toEqual(["b", "a", "c"]);
  });

  it("exports exactly the selected text, with sources and readable paragraph breaks", () => {
    const text = journalAsText([entry("hidden-id", { title: "My observations", source: "The Old Lands", text: "A cup.\nA path.", resolved: true })]);
    expect(text).toContain("1 record\n\nMy observations\nSource: The Old Lands\nDecision / completion recorded\n\nA cup.\nA path.");
    expect(text).not.toContain("hidden-id");
    expect(journalAsText([])).toContain("0 records");
  });
});

describe("traveller's field guide", () => {
  it("starts with six optional milestones and no inferred discoveries", () => {
    const cards = createFieldGuide([]);
    const milestones = cards.filter(card => card.section === "first-steps");
    expect(milestones).toHaveLength(6);
    expect(milestones.every(card => card.status === "To try")).toBe(true);
    expect(cards.filter(card => card.section === "expeditions").every(card => card.status === "Unexplored")).toBe(true);
    expect(cards.filter(card => card.section === "lamplight").every(card => card.status === "Not copied")).toBe(true);
  });

  it("tracks journal evidence without needing a new save format", () => {
    const cards = createFieldGuide([
      entry("overworld:1:1", { title: "A Traveller's Primer" }), entry("quest:lead", { questId: "q" }),
      entry("lamplight:arrival-rubbing"), entry("expedition:uncounted-hollow:complete", { resolved: true }),
      entry("voice:someone"), entry("personal:1"),
    ]);
    expect(cards.filter(card => card.section === "first-steps").every(card => card.status === "Recorded")).toBe(true);
    expect(cards.find(card => card.id === "site:uncounted-hollow")?.status).toBe("Complete");
    expect(cards.find(card => card.id === "lamp:arrival-rubbing")?.status).toBe("Copied");
  });

  it("distinguishes discovery from completion and ignores similarly prefixed IDs", () => {
    const cards = createFieldGuide([entry("expedition:drowned-court:guard:42"), entry("expedition:uncounted-hollow-future:complete")]);
    expect(cards.find(card => card.id === "site:drowned-court")?.status).toBe("Discovered");
    expect(cards.find(card => card.id === "site:uncounted-hollow")?.status).toBe("Unexplored");
  });

  it("does not expose hidden narrative prose or boss identities in the reference", () => {
    const cards = createFieldGuide([]);
    const allCopy = JSON.stringify(cards);
    for (const record of LANTERN_RECORDS) {
      expect(allCopy).not.toContain(record.text);
      expect(cards.find(card => card.id === `lamp:${record.id}`)?.title).not.toBe(record.title);
    }
    for (const site of EXPEDITION_SITES) expect(allCopy).not.toContain(site.record);
    expect(cards.filter(card => card.section === "combat").map(card => card.id)).toEqual(["wraith", "sentinel", "adept", "last-breath"]);
  });

  it("takes tool and relic descriptions from the rules used by gameplay", () => {
    const cards = createFieldGuide([]);
    for (const tool of COMBAT_TOOLS) {
      const card = cards.find(candidate => candidate.id === `tool:${tool.id}`);
      expect(card?.summary).toBe(tool.description);
      expect(card?.detail).toContain(`Stamina ${tool.staminaCost}`);
    }
    for (const relic of RELICS) {
      const card = cards.find(candidate => candidate.id === `relic:${relic.id}`);
      expect(card?.summary).toBe(relic.description);
      expect(card?.detail).toContain(relic.tradeoff);
    }
  });

  it("searches across sections while leaving unrequested route hints hidden", () => {
    const cards = createFieldGuide([]);
    expect(filterGuide(cards, "", "combat")).toHaveLength(4);
    expect(filterGuide(cards, "GRAVEHAMMER", "combat").map(card => card.id)).toEqual(["tool:gravehammer"]);
    expect(filterGuide(cards, "   ", "equipment")).toHaveLength(COMBAT_TOOLS.length + RELICS.length);
    expect(filterGuide(cards, "twin slag stacks", "expeditions")).toEqual([]);
  });
});
