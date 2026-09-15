import type { JournalEntry } from "./types";

/** The count stays legible at every step; only the sentence after it changes. */
const SHARD_NOTES: Record<number, string> = {
  3: " It was warm.",
  4: " Something let go of it.",
  5: " I did not ask what it had been.",
  6: " It was still talking when I closed my hand.",
  7: " I have stopped listening on purpose.",
  8: " One left. I have done this before.",
};

/**
 * What each shard costs in permanent maximum health. Free for the first two
 * so the HUD agrees with the prose that nothing is wrong yet; billing starts
 * where the investigations land and doubles at six, where the journal bleed
 * already begins. Thirteen across a full run.
 */
const SHARD_HARVEST_COST: Record<number, number> = {
  3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 3, 9: 3,
};

export function shardHarvestCost(count: number): number {
  return SHARD_HARVEST_COST[count] ?? 0;
}

/** The total maximum-health cost paid across the first `shards` harvests. */
export function cumulativeHarvestCost(shards: number): number {
  let total = 0;
  for (let n = 1; n <= shards; n++) total += shardHarvestCost(n);
  return total;
}

/** The price, stated in the register the quest resolutions already use. */
export function shardCostSuffix(count: number): string {
  const cost = shardHarvestCost(count);
  return cost > 0 ? ` Maximum health −${cost}.` : "";
}

/**
 * The whole stat mutation of a harvest, in one pure place: spend the cost,
 * never fall below one, and pull current health down to the new ceiling
 * without healing a wounded player.
 */
export function applyHarvestCost(maxHp: number, hp: number, count: number): { maxHp: number; hp: number } {
  const nextMax = Math.max(1, maxHp - shardHarvestCost(count));
  return { maxHp: nextMax, hp: Math.min(hp, nextMax) };
}

export function shardPickupMessage(count: number, total: number): string {
  return `Anima Shard recovered (${count}/${total}).${SHARD_NOTES[count] ?? ""}${shardCostSuffix(count)}`;
}

/** Orithel's line when the ninth shard unlocks the ward, price included. */
export function wardUnlockMessage(count: number): string {
  return `The ward gives. Nine. It was always going to be nine, and now I know who picked the number.${shardCostSuffix(count)}`;
}

/** Entries the player did not write, in the courier's hand, from the sixth shard on. */
const SHARD_BLEED: Record<number, string> = {
  6: "I have read this four times looking for the part where it is something other than what it is. It isn't there. It was never going to be there.",
  7: "It has a child's voice.",
  8: "Do not surrender it. Do not surrender it. Do not surrender it.",
};

export function shardBleedEntry(count: number): JournalEntry | null {
  const text = SHARD_BLEED[count];
  if (!text) return null;
  return { id: `bleed:${count}`, title: "My observations", text, source: "My own hand" };
}

/** Orithel's closing lines at the ward gate, once all nine shards are in hand. */
export const WARD_LINES = [
  "There you are. Nine. You have no idea how rarely it runs this cleanly, and I would like you to hear me say so.",
  "I will take them now. The Unbound has been very loud for a very long time, and it will be a kindness to everyone — itself most of all — when it stops.",
  "You have been extraordinary. I want you to understand that I mean that. I have said it before, and I have always meant it.",
];

export interface DialogueChoice {
  id: string;
  label: string;
}

/**
 * Pure construction of the ward-gate dialogue: every line the player must read
 * before the ending choice is offered. Kept separate from Game so it can be
 * unit-tested without pulling in the whole engine.
 */
export function wardDialogue(): { lines: string[]; choices: DialogueChoice[] } {
  return {
    lines: WARD_LINES.slice(),
    choices: [
      { id: "ending:surrender", label: "Give him the nine." },
      { id: "ending:refuse", label: "No." },
    ],
  };
}

/** What was actually guarding the shard, recorded after the shell stops moving. */
const FORTRESS_WARDEN_TEXT: Record<string, string> = {
  "fortress.cinderwild-shrine": "The thing in the shrine wore the courier's shape the way a coat wears a hook. It fought me the whole way down and it was never going to win, and it knew that, and it fought anyway. Whatever is in the vessel has been listening to it defend this room for nine hundred years.",
  "fortress.old-lands-archive": "The archive keeper was made to remember every name the collectors crossed out. It had arranged the pages around the shard in the order they disappeared. It did not attack until I touched the last page.",
  "fortress.old-lands-reliquary": "The glass showed me the reliquary's keeper before it showed me myself. It had been watching the door in every reflection at once. When the shell broke, all of them looked relieved.",
  "fortress.old-lands-vault": "The vault warden had Ilyarael's seal pressed into its mouth. Someone had used it to authorize the transfers, then left it here to guard the record of what that authorization bought.",
  "fortress.cinderwild-watchpost": "The warden at the watchpost had walked the same square of floor until its feet had worn the stone pale. It was still waiting for relief. Nobody had told it that the watch had ended before the people it was watching over were taken.",
  "fortress.moonlit-salt-graves": "The graves' keeper recited the names as it fought. It stopped at forty-one, then began again. The missing thirty-nine were not forgotten; they had been filed somewhere I could not reach.",
  "fortress.moonlit-beacon": "The beacon keeper had kept its lamp lit with pieces of itself. It said that was the bargain, as if a bargain made under a gun becomes clean when you say the word carefully enough.",
  "fortress.starfall-observatory": "The observatory's warden had written equations into its own casing with a nail. The last line was only a number repeated until the metal gave out. I think it was counting how long it had remained awake.",
  "fortress.starfall-watch": "The guardian's shell was empty except for the astronomer, who had built it to prove the intake was survivable. It defended the shard with the urgency of a man trying to make his own experiment come out differently.",
};

/** A fortress can preserve an existing investigation fact after moving a warden indoors. */
const FORTRESS_WARDEN_FACTS: Record<string, string> = {
  "fortress.starfall-watch": "warden:starfall-moors",
};

export function wardenFact(regionId: string): string {
  return FORTRESS_WARDEN_FACTS[regionId] ?? `warden:${regionId}`;
}

export function fortressWardenEntry(regionId: string): JournalEntry | null {
  const text = FORTRESS_WARDEN_TEXT[regionId];
  if (!text) return null;
  return { id: `warden:${regionId}`, title: "What kept the shard", text, source: "Firsthand discovery" };
}

/** The conscious individual trapped in each core, recorded when the shard is torn free. */
const FORTRESS_SHARD_INTAKES: Record<string, { id: string; title: string; text: string }> = {
  "fortress.old-lands-archive": {
    id: "intake:vaelen",
    title: "Intake Docket 1,402: Archivist Vaelen",
    text: "Docket 1,402. Vaelen, First Scribe. Cause: Unlawful duplication of classified rolls. Core function: Memory indexing and cataloguing. — Archivist Vaelen was still holding the ledger when the core tore free. His fingers were stained with gall ink that had turned to glass. He did not cry out; he only asked if the duplicates had survived the damp.",
  },
  "fortress.old-lands-reliquary": {
    id: "intake:theon",
    title: "Intake Docket 1,890: Theon the Glasswright",
    text: "Docket 1,890. Theon, Glasswright. Cause: Deficit in vessel production. Core function: Matrix resonance stabilization. — Theon's mind was spread across every mirror in the reliquary. In the moment of extraction, every reflection looked at me with the weary embarrassment of a craftsman caught by his own faulty hinge.",
  },
  "fortress.old-lands-vault": {
    id: "intake:morwyn",
    title: "Intake Docket 0,089: Castellan Morwyn",
    text: "Docket 0,089. Morwyn, Castellan. Cause: Emergency seal containment. Core function: Structural perimeter security. — The seal was fused into Castellan Morwyn's jawbone. When I pulled the shard free, the jaw cracked like dry pine, releasing a smell of nine-hundred-year-old cedar wax and stagnant breath.",
  },
  "fortress.cinderwild-shrine": {
    id: "intake:roryn",
    title: "Intake Docket 4,411: Roryn, Ward of St. Elun",
    text: "Docket 4,411. Roryn, ward of St. Elun. Cause: General replenishment cohort IV. Core function: Baseline emotional dampening. — Roryn's voice in the core was thin, like greaseproof paper vibrating in a draft. He asked whether his mother had come back to the wagon yet. When the light transferred into my chest, the cold made my ribs ache.",
  },
  "fortress.cinderwild-watchpost": {
    id: "intake:kaelen",
    title: "Intake Docket 2,104: Decurion Kaelen",
    text: "Docket 2,104. Kaelen, Decurion. Cause: Posthumous extraction from active post. Core function: Threat vector scanning. — Decurion Kaelen was still keeping watch through the arrow slits. When the core snapped out of the dais, he whispered: 'Post relieved.' He had been standing in the dark for nine centuries waiting for someone to say it.",
  },
  "fortress.moonlit-salt-graves": {
    id: "intake:maris",
    title: "Intake Docket 3,892: Maris of the Shallows",
    text: "Docket 3,892. Maris, sail-maker. Cause: Reconciled off boarding manifest. Core function: Hydrostatic sensory processing. — Maris did not fight. When I took her core, my hands smelled of salt brine and lye soap. She murmured two names over and over until the connection severed. Neither name was mine.",
  },
  "fortress.moonlit-beacon": {
    id: "intake:alden",
    title: "Intake Docket 3,901: Alden the Lamplighter",
    text: "Docket 3,901. Alden, Lamplighter. Cause: Voluntary biological lamp sustainment. Core function: Photonic amplification. — Alden's core was boiling hot. As it cooled in my palm, a flare of blind white light burned across my retinas, showing me the black sea and forty empty rowboats drifting away.",
  },
  "fortress.starfall-observatory": {
    id: "intake:selene",
    title: "Intake Docket 0,442: Selene the Reckoner",
    text: "Docket 0,442. Selene, Chief Reckoner. Cause: Specialized apparatus integration. Core function: Harmonic cycle alignment. — The core was covered in tiny scratched tallies. Selene's mind was still counting seconds: twenty-eight billion, four hundred million... then silence.",
  },
  "fortress.starfall-watch": {
    id: "intake:orren",
    title: "Intake Docket 0,001: Master Orren",
    text: "Docket 0,001. Orren, Lead Investigator. Cause: Self-administered prototype trial. Core function: Autonomous core defense. — Master Orren's core came away with a jagged iron ring still fused to it. As his consciousness unraveled, he asked one final question: 'Did the work endure?'",
  },
};

export function fortressShardIntakeEntry(regionId: string): JournalEntry | null {
  const intake = FORTRESS_SHARD_INTAKES[regionId];
  if (!intake) return null;
  return { id: intake.id, title: intake.title, text: intake.text, source: "Intake Core Recovery" };
}

