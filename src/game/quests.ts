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
    lead: "A courier of mine went east with a sealed vessel and did not come back. A copy of her orders is still in Ilyarael, against the south wall, east of the Watcher. Her destination was the Cinderwild — from the central stone circle, the road northeast, to the broken shrine. I would like to know where the vessel went. And her, of course.",
    evidence: [
      { fact: "courier-orders", title: "Orders beneath the dust", text: "The orders are routine. Carry the vessel to the shrine, surrender it to the collector, do not open it, do not listen to it. Beneath the seal, in a different hand, pressed hard enough to tear the paper: ‘It has a child's voice. I have read this four times looking for the part where this is something other than what it fucking is. It isn't there. It was never going to be there.’" },
      { fact: "courier-memory", title: "The courier's last stand", text: "She never delivered it. She got as far as the shrine and could not make herself finish, so she spent herself sheltering it instead — nine hundred years of her, keeping one vessel warm. The child is still inside. Still awake. It has been awake the entire time, and it would like to know whether it is going to be allowed to stop." },
    ],
    choices: [
      { id: "release", label: "Give the child to the wayfires. (+2 health)", text: "Orithel opens the vessel with enormous gentleness. Something small says thank you, because nobody has ever explained to it what the wayfires are for. The warmth that reaches me afterward is not mine and I can feel exactly whose it is. Maximum health +2.", reward: { stat: "health", amount: 2 } },
      { id: "bind", label: "Bind the child to my blade. (+1 damage)", text: "Orithel folds it into the edge of my weapon and observes that the work will be over sooner this way, which is true. The blade cuts deeper now. It does not make any sound at all. I keep checking. Blade damage +1.", reward: { stat: "blade", amount: 1 } },
      { id: "end", label: "End it. Take nothing.", text: "I did it outside, away from the hall, and Orithel did not stop me — he only noted that the yield was lost and asked me not to make a habit of it. It stopped being awake. That is the whole of what I accomplished, and I am not sorry." },
    ],
  },
  {
    id: "salt", title: "Names the Tide Kept",
    lead: "A keeper on the coast struck a great many names off his rolls, and I would like them back. Two accounts survive. Take the south road from the Old Lands to Moonlit Coast; at the pale circle one track runs southwest to the salt graves, another northeast to the beacon. Read both before you decide anything. People judge the man too quickly.",
    evidence: [
      { fact: "salt-graves", title: "The salt graves", text: "No bodies. Only names, scraped down to the stone. The evacuation ledger says the last boat left half empty, and every passenger who did not board carries the same mark in the margin — the intake mark, though the ledger does not call it that. RECONCILED — 41. TRANSFERRED TO COLLECTION — 39. And underneath, in the same clerk's unhurried hand, a note that the remainder, being already struck from the rolls, were not counted out, and that whatever the collectors did with them on the road was not a matter the harbour was obliged to record, a person who does not exist being incapable of complaint." },
      { fact: "salt-beacon", title: "The keeper's confession", text: "His own account, signed on every page. ‘I chose. Someone had to choose and I was the one standing there. Forty went on that boat who would not have gone otherwise. I know exactly what that cost and I have never once pretended the arithmetic was clean.’ He is reasonable for eleven pages. Reasonable about the price, about the necessity, about the families. By the ninth page I had started nodding along, and that frightened me worse than the graves did." },
    ],
    choices: [
      { id: "remember", label: "Restore the rolls. (+25 stamina)", text: "Orithel puts every name back where it was taken from, and the coast learns precisely what was done and precisely how far beyond any reach the man who did it has been for nine hundred years. Knowing is not redress. They will have to make do with it, the way I do. Maximum stamina +25.", reward: { stat: "stamina", amount: 25 } },
      { id: "mercy", label: "Let the rolls stay quiet. (Dash cost −5)", text: "We seal the account in Ilyarael. The keeper's arithmetic holds, the families keep a gentler arithmetic of their own, and I come away with the small trick he used — how to step out of a record, how to be somewhere and leave nothing behind that anyone could count. Dash stamina cost −5, to a minimum of 10.", reward: { stat: "dash", amount: 5 } },
    ],
  },
  {
    id: "dawn", title: "A Borrowed Dawn",
    lead: "There is a fallen observatory northwest of the Moors' central wayfire, and its lens is of considerable interest to me. The Starfall Moors can be reached by the southeastern Cinderwild road or the eastern coastal road. The astronomer who built the thing is still operating, after a fashion, at the end of the eastern track — you will know the shell when it attacks you. Read the record first. I would rather you understood the apparatus before you broke it.",
    evidence: [
      { fact: "dawn-record", title: "The observatory's promise", text: "‘One dawn, forever’ is what the plaque says, and what the funding said. The working notes say something else. The lens was an intake prototype and he tested it on himself, deliberately, to demonstrate that the process was survivable at scale. He wrote down the moment he understood that it was not. He kept writing for a considerable time after that." },
      { fact: "warden:starfall-moors", title: "The astronomer's last watch", text: "The shell is open. He is still in it, and has been for nine hundred years, walking the eastern road and killing everyone who walked it while entirely aware of doing so. He thanks me. Then he asks whether the program went ahead anyway. I have no way to answer him, and Orithel has not offered me one." },
    ],
    choices: [
      { id: "kindle", label: "Kindle the dawn within me. (+3 health)", text: "Orithel sets what is left of the astronomer burning in my chest, where it will keep me upright a while longer. This is the second time his body has been used to demonstrate something. Maximum health +3.", reward: { stat: "health", amount: 3 } },
      { id: "temper", label: "Temper the dawn into my blade. (+1 damage)", text: "Orithel folds him into the edge of my blade and remarks that the man would have appreciated the efficiency. He is probably right about that. It is not a defence. Blade damage +1.", reward: { stat: "blade", amount: 1 } },
    ],
  },
  {
    id: "pilgrim", title: "The Shape of the Pilgrim",
    lead: "Barris has watched seven travellers arrive with my face, my scars, and no memory of the road behind them. He asks me to speak with Scribe Althea in Ilyarael, then carry her comparison to the mirrors of the Glass Reliquary north of the lake. He does not ask me to bring him an answer. He says answers are usually where people start lying.",
    evidence: [
      { fact: "pilgrim-ledger", title: "The courier cohort mark", text: "Althea lays the old courier rolls beside my wrist. The intake glyph beneath my skin is not a family crest or a sentence mark. It is a batch designation: COURIER PATTERN, RETURNABLE VESSEL. The line beneath it has been copied and crossed out so many times the parchment has gone soft as cloth." },
      { fact: "pilgrim-reflection", title: "A face repeated in glass", text: "Theon saw the pattern the instant the reliquary opened. Every mirror had held a version of me at a different age, each wearing the same intake mark and each looking toward a door it could not remember entering. Whatever built the vessels did not preserve the Courier. It preserved a route through her." },
    ],
    choices: [
      { id: "name", label: "Name the pattern. (+10 stamina)", text: "I tell Barris what the record says. He does not call me a copy. He calls me the person standing in front of him, then makes me repeat it until I believe him enough to breathe. Maximum stamina +10.", reward: { stat: "stamina", amount: 10 } },
      { id: "weapon", label: "Use the pattern. (Dash cost −4)", text: "Barris shows me how to move like someone the old wards expect to see: shoulder low, steps measured, no hesitation at a threshold. It is useful. That does not make it mine. Dash stamina cost −4, to a minimum of 10.", reward: { stat: "dash", amount: 4 } },
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
