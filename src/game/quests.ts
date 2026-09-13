import type { JournalEntry } from "./types";

export interface QuestProgress {
  facts: string[];
  resolutions: Record<string, string>;
}

export interface QuestDefinition {
  id: string;
  title: string;
  lead: string;
  evidence: { fact: string; title: string; text: string }[];
  choices: { id: string; label: string; text: string; reward?: { stat: "health" | "stamina" | "blade" | "dash"; amount: number } }[];
}

/** Authored knowledge, not coordinates: the journal only exposes learned facts. */
export const QUESTS: QuestDefinition[] = [
  {
    id: "courier", title: "The Courier Who Never Came",
    lead: "Orithel's courier carried a sealed memory east. A copy of her orders remains inside Ilyarael, against the south wall east of the Watcher. Her last destination was the Cinderwild: from its central stone circle, take the road northeast to the broken shrine. Orithel wants to know why she never returned.",
    evidence: [
      { fact: "courier-orders", title: "Orders beneath the dust", text: "The orders call the memory a weapon, but the courier wrote in the margin: ‘It speaks with a child's voice. I will hear it before I surrender it.’ She went to the northeastern shrine in the Cinderwild." },
      { fact: "courier-memory", title: "The courier's last memory", text: "At the broken shrine I found her memory vessel. She gave her own light to shelter a newborn Mnemonic. Orithel could release it into the wayfires, or bind its strength to my blade. The choice should be mine to make." },
    ],
    choices: [
      { id: "release", label: "Release the child into the wayfires. (+2 health)", text: "Orithel opens the vessel. A small voice thanks us before it scatters among the flames. The wayfires now carry two lives, and their warmth stays with me. Maximum health +2.", reward: { stat: "health", amount: 2 } },
      { id: "bind", label: "Bind the memory to my blade. (+1 damage)", text: "Orithel binds the child's light into my weapon. The blade cuts deeper; the vessel falls silent. He asks me to remember whose strength I carry. Blade damage +1.", reward: { stat: "blade", amount: 1 } },
      { id: "end", label: "End it. Take nothing.", text: "I did it outside, away from the hall, and Orithel did not stop me — he only noted that the yield was lost and asked me not to make a habit of it. It stopped being awake. That is the whole of what I accomplished, and I am not sorry." },
    ],
  },
  {
    id: "salt", title: "Names the Tide Kept",
    lead: "A coastal keeper erased the names of those lost in an evacuation. Orithel remembers two surviving accounts. Follow the south road from the Old Lands to Moonlit Coast. At the pale circle where the roads meet, one track runs southwest to the salt graves; another runs northeast to the beacon. Compare both accounts before judging the keeper.",
    evidence: [
      { fact: "salt-graves", title: "The salt graves", text: "The graves southwest of the pale circle hold no bodies. Their ledger says the keeper sent the last boat away half empty. Beside each erased name is a mark for infection." },
      { fact: "salt-beacon", title: "The beacon keeper's confession", text: "The northeastern beacon records a different truth: the passengers stayed to tend the infected. The keeper erased their names to conceal that choice from the city. Orithel could preserve their testimony or let their families keep the gentler story." },
    ],
    choices: [
      { id: "remember", label: "Preserve the names and their testimony. (+25 stamina)", text: "Orithel restores the volunteers' names to the record. Their families may grieve anew, but their courage is no longer lost. I carry their patient resolve. Maximum stamina +25.", reward: { stat: "stamina", amount: 25 } },
      { id: "mercy", label: "Keep the families' gentler story. (Dash cost −5)", text: "We seal the testimony in Ilyarael. The dead keep their private courage; the living keep their peace. Orithel teaches me the keeper's quiet step. Dash stamina cost −5, to a minimum of 10.", reward: { stat: "dash", amount: 5 } },
    ],
  },
  {
    id: "dawn", title: "A Borrowed Dawn",
    lead: "The Starfall Moors can be reached through the southeastern Cinderwild road or the eastern coastal road. Orithel says a fallen observatory lies just northwest of the Moors' central wayfire. Its lens once sustained a guardian on the eastern road. Read the observatory record and face that guardian before deciding what its light should become.",
    evidence: [
      { fact: "dawn-record", title: "The observatory's promise", text: "The observatory promised a dawn that would never end. Its lens instead trapped the last astronomer's mind in the warden at the eastern road's end. Destroying its shell may finally free the light." },
      { fact: "warden:starfall-moors", title: "The astronomer's last watch", text: "The eastern warden has fallen. Within its shell, an unbroken lens still holds a sliver of dawn. Orithel knows how to kindle it in my body or temper it into my blade." },
    ],
    choices: [
      { id: "kindle", label: "Kindle the dawn within me. (+3 health)", text: "The astronomer's watch ends. Orithel kindles the last dawn in my chest, a warmth that will outlast the stars above the Moors. Maximum health +3.", reward: { stat: "health", amount: 3 } },
      { id: "temper", label: "Temper the dawn into my blade. (+1 damage)", text: "Orithel folds the dawn into the edge of my blade. The astronomer's light will meet the Unbound at last. Blade damage +1.", reward: { stat: "blade", amount: 1 } },
    ],
  },
];

export function learnFact(progress: QuestProgress, fact: string): boolean {
  if (progress.facts.includes(fact)) return false;
  progress.facts.push(fact);
  return true;
}

export function questKnown(progress: QuestProgress, quest: QuestDefinition): boolean {
  return progress.facts.includes(`lead:${quest.id}`) || quest.evidence.some(({ fact }) => progress.facts.includes(fact));
}

export function canResolve(progress: QuestProgress, quest: QuestDefinition): boolean {
  return !progress.resolutions[quest.id] && quest.evidence.every(({ fact }) => progress.facts.includes(fact));
}

/** Resolution is recorded before granting its reward; repeated interactions are inert. */
export function resolveQuest(progress: QuestProgress, id: string, choiceId: string) {
  const quest = QUESTS.find((entry) => entry.id === id);
  if (!quest || !canResolve(progress, quest)) return null;
  const choice = quest.choices.find((entry) => entry.id === choiceId);
  if (!choice) return null;
  progress.resolutions[id] = choiceId;
  return choice;
}

export function questJournal(progress: QuestProgress): JournalEntry[] {
  return QUESTS.filter((quest) => questKnown(progress, quest)).flatMap((quest) => {
    const entries: JournalEntry[] = [];
    if (progress.facts.includes(`lead:${quest.id}`)) entries.push({ id: `${quest.id}:lead`, title: quest.title, text: quest.lead, questId: quest.id, source: "Orithel · Ilyarael" });
    for (const clue of quest.evidence) if (progress.facts.includes(clue.fact)) entries.push({ id: clue.fact, title: clue.title, text: clue.text, questId: quest.id, source: "Firsthand discovery" });
    const choice = quest.choices.find((entry) => entry.id === progress.resolutions[quest.id]);
    if (choice) entries.push({ id: `${quest.id}:resolved`, title: "A decision made", text: choice.text, questId: quest.id, resolved: true, source: "Orithel · Ilyarael" });
    return entries;
  });
}
