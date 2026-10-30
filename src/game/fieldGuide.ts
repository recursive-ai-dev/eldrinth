import { EXPEDITION_SITES } from "./encounters";
import { COMBAT_TOOLS, RELICS, RELIC_SLOTS, type CombatToolId, type RelicId } from "./equipment";
import { GUARD_COST, GUARD_WINDOW, RIPOSTE_DAMAGE, RIPOSTE_WINDOW } from "./guard";
import { LANTERN_RECORDS } from "./lantern";
import type { JournalEntry } from "./types";
import { WARDEN_STYLES } from "./wardens";

export type JournalStatus = "all" | "open" | "resolved" | "personal";
export type JournalOrder = "recorded" | "reverse" | "title" | "source";
export type GuideSection = "first-steps" | "combat" | "equipment" | "expeditions" | "lamplight";
export type GuideIcon = "journal" | "quest" | "lantern" | "campfire" | "chart" | "guard" | "wraith" | "sentinel" | "adept" | "waypoint" | "treasure";

export const GUIDE_SECTIONS: readonly { id: GuideSection; label: string; icon: GuideIcon }[] = [
  { id: "first-steps", label: "First steps", icon: "waypoint" },
  { id: "combat", label: "Combat", icon: "guard" },
  { id: "equipment", label: "Equipment", icon: "treasure" },
  { id: "expeditions", label: "Expeditions", icon: "chart" },
  { id: "lamplight", label: "Lamplight", icon: "lantern" },
];

export const FIELD_GUIDE_TOTALS = { expeditions: EXPEDITION_SITES.length, inscriptions: LANTERN_RECORDS.length } as const;

const REGION_NAMES: Record<string, string> = {
  overworld: "The Old Lands", cinderwild: "Cinderwild", "moonlit-coast": "Moonlit Coast", "starfall-moors": "Starfall Moors",
};

export interface GuideCard {
  id: string;
  section: GuideSection;
  title: string;
  icon: GuideIcon;
  equipmentId?: CombatToolId | RelicId;
  summary: string;
  detail?: string;
  /** Directions are opt-in; uncollected narrative accounts never enter the guide. */
  route?: string;
  status?: "To try" | "Recorded" | "Unexplored" | "Discovered" | "Complete" | "Not copied" | "Copied";
  region?: string;
}

const expeditionPrefix = (id: string) => `expedition:${id}:`;

function journalIndex(entries: readonly JournalEntry[]) {
  const resolvedQuests = new Set(entries.filter(entry => entry.questId && entry.resolved).map(entry => entry.questId!));
  const completedExpeditions = new Set(EXPEDITION_SITES.filter(site => entries.some(entry => entry.id === `${expeditionPrefix(site.id)}complete`)).map(site => site.id));
  return { resolvedQuests, completedExpeditions };
}

export function journalSummary(entries: readonly JournalEntry[]) {
  const index = journalIndex(entries);
  const quests = new Set(entries.flatMap(entry => entry.questId ? [entry.questId] : []));
  return {
    records: entries.length,
    openInvestigations: [...quests].filter(id => !index.resolvedQuests.has(id)).length,
    resolvedInvestigations: index.resolvedQuests.size,
    completedExpeditions: index.completedExpeditions.size,
    copiedLamplight: LANTERN_RECORDS.filter(record => entries.some(entry => entry.id === `lamplight:${record.id}`)).length,
    personalNotes: entries.filter(entry => entry.id.startsWith("personal:")).length,
  };
}

/** A settled investigation's evidence belongs with its decision, even though
 * only the decision entry has a persisted `resolved` flag. */
export function filterJournal(entries: readonly JournalEntry[], options: {
  query?: string;
  status?: JournalStatus;
  order?: JournalOrder;
  category?: (entry: JournalEntry) => boolean;
} = {}): JournalEntry[] {
  const index = journalIndex(entries);
  const terms = (options.query ?? "").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const result = entries.filter(entry => {
    if (options.category && !options.category(entry)) return false;
    const expedition = EXPEDITION_SITES.find(site => entry.id.startsWith(expeditionPrefix(site.id)));
    const resolved = Boolean(entry.resolved || (entry.questId && index.resolvedQuests.has(entry.questId)) || (expedition && index.completedExpeditions.has(expedition.id)));
    if (options.status === "resolved" && !resolved) return false;
    if (options.status === "open" && (resolved || (!entry.questId && !expedition))) return false;
    if (options.status === "personal" && !entry.id.startsWith("personal:")) return false;
    const haystack = `${entry.title} ${entry.text} ${entry.source ?? ""}`.toLocaleLowerCase();
    return terms.every(term => haystack.includes(term));
  });
  if (options.order === "reverse") result.reverse();
  if (options.order === "title") result.sort((a, b) => a.title.localeCompare(b.title));
  if (options.order === "source") result.sort((a, b) => (a.source ?? "").localeCompare(b.source ?? "") || a.title.localeCompare(b.title));
  return result;
}

export function journalAsText(entries: readonly JournalEntry[]): string {
  return ["ELDRINTH · Field Journal", `${entries.length} ${entries.length === 1 ? "record" : "records"}`, ...entries.map(entry => [entry.title, entry.source ? `Source: ${entry.source}` : "", entry.resolved ? "Decision / completion recorded" : "", "", entry.text].filter((line, index) => line !== "" || index === 3).join("\n"))].join("\n\n");
}

export function createFieldGuide(entries: readonly JournalEntry[]): GuideCard[] {
  const has = (predicate: (entry: JournalEntry) => boolean) => entries.some(predicate);
  const milestone = (id: string, title: string, icon: GuideIcon, summary: string, complete: boolean): GuideCard => ({ id, section: "first-steps", title, icon, summary, status: complete ? "Recorded" : "To try" });
  const cards: GuideCard[] = [
    milestone("primer", "Read the traveller's primer", "waypoint", "Follow the arrival road and press E beside the primer. Signs keep their directions in your journal.", has(entry => entry.title === "A Traveller's Primer")),
    milestone("watcher", "Begin an investigation", "quest", "Speak with Orithel in Ilyarael or ask a scout for a lead. Gather accounts before you bring a decision back to the Watcher.", has(entry => Boolean(entry.questId))),
    milestone("first-light", "Copy a hidden inscription", "lantern", "Raise your lantern with R near a scraped brass plate, then press E. The lamp uses no fuel or stamina.", has(entry => entry.id.startsWith("lamplight:"))),
    milestone("first-expedition", "Leave the main road", "chart", "Read the roadside route notices. Optional expedition sites record their discovery and reward in your journal.", has(entry => entry.id.startsWith("expedition:"))),
    milestone("first-voice", "Listen beside a wayfire", "campfire", "If you choose to carry someone, return to a wayfire and listen to their memory. Taking a vessel can permanently reduce maximum health; the choice tells you the exact cost.", has(entry => entry.id.startsWith("voice:"))),
    milestone("first-note", "Keep an observation", "journal", "Use the observation box in Records to preserve a landmark or a thought. Ctrl+Enter or Command+Enter writes the note.", has(entry => entry.id.startsWith("personal:"))),
    { id: "wraith", section: "combat", title: "Wraith", icon: "wraith", summary: "A wandering pursuer that closes directly once you approach.", detail: "Keep an escape lane behind you. Strike, create space, and avoid being surrounded; contact with a wraith hurts." },
    { id: "sentinel", section: "combat", title: "Sentinel", icon: "sentinel", summary: "A direct pursuer that holds its position when you are beyond its reach.", detail: "Draw it away from other enemies before committing to a heavy strike. Armoured wardens are elite sentinels with regional moves; read their labelled warning lanes and strike during recovery." },
    { id: "adept", section: "combat", title: "Adept", icon: "adept", summary: "A ranged caster that retreats when crowded and circles at a distance.", detail: "Watch the spell wind-up, move across the line of fire, and close after the bolt leaves. An attuned Ashstep can reflect enemy bolts during a dash." },
    { id: "last-breath", section: "combat", title: "Last Breath & riposte", icon: "guard", summary: `Face the incoming attack and press F. The guard costs ${GUARD_COST} stamina and lasts ${Math.round(GUARD_WINDOW * 1000)} milliseconds.`, detail: `A successful parry catches attacks in your forward arc and restores 12 stamina. Strike within ${RIPOSTE_WINDOW} seconds for +${RIPOSTE_DAMAGE} damage. Hazards cannot be parried; holding F does not repeat the guard.` },
    ...Object.entries(WARDEN_STYLES).map(([id, style]): GuideCard => ({ id: `warden:${id}`, section: "combat", title: style.name, icon: "sentinel", region: style.region, summary: style.summary, detail: `${style.label}: ${style.tactic} Every warning lasts at least ${Math.round(style.windup * 1000)} milliseconds. Projectile patterns have 1 base damage (2 on Brutal); physical contact remains dangerous.` })),
    ...COMBAT_TOOLS.map((tool): GuideCard => ({ id: `tool:${tool.id}`, section: "equipment", title: tool.name, icon: "treasure", equipmentId: tool.id, summary: tool.description, detail: `Base damage ${tool.damage} · Stamina ${tool.staminaCost}. Press Q to switch tools, or I to open the loadout. Earned bonuses can increase the damage shown there.` })),
    ...RELICS.map((relic): GuideCard => ({ id: `relic:${relic.id}`, section: "equipment", title: relic.name, icon: "treasure", equipmentId: relic.id, summary: relic.description, detail: `${relic.tradeoff} ${relic.source} Use I to attune up to ${RELIC_SLOTS} relics; owning one does not automatically activate its tradeoff.` })),
  ];
  for (const site of EXPEDITION_SITES) {
    const completed = has(entry => entry.id === `${expeditionPrefix(site.id)}complete`);
    const discovered = has(entry => entry.id.startsWith(expeditionPrefix(site.id)));
    cards.push({
      id: `site:${site.id}`, section: "expeditions", title: site.name, icon: "chart", region: REGION_NAMES[site.regionId],
      status: completed ? "Complete" : discovered ? "Discovered" : "Unexplored",
      summary: completed ? site.reward : ({ refuge: "An optional refuge along a forest track.", crossing: "A crossing with safe ground between hazards.", arena: "An optional combat encounter away from the main road.", vigil: "A quiet trial of movement and attention." }[site.kind]),
      route: site.route.text,
    });
  }
  for (const record of LANTERN_RECORDS) {
    const copied = has(entry => entry.id === `lamplight:${record.id}`);
    cards.push({ id: `lamp:${record.id}`, section: "lamplight", title: copied ? record.title : `${REGION_NAMES[record.regionId]} inscription`, icon: "lantern", region: REGION_NAMES[record.regionId], status: copied ? "Copied" : "Not copied", summary: copied ? "This hidden account is preserved in Records → Lamplight." : "Bring a raised lantern close to scraped brass, then press E to copy its writing.", route: record.route });
  }
  return cards;
}

/** Route text is deliberately excluded: typing cannot uncover a hidden hint. */
export function filterGuide(cards: readonly GuideCard[], query: string, section: GuideSection): GuideCard[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return cards.filter(card => {
    if (!terms.length) return card.section === section;
    const text = `${card.title} ${card.summary} ${card.detail ?? ""} ${card.region ?? ""} ${GUIDE_SECTIONS.find(candidate => candidate.id === card.section)?.label ?? ""}`.toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}
