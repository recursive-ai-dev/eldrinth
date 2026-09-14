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
};

export function fortressWardenEntry(regionId: string): JournalEntry | null {
  const text = FORTRESS_WARDEN_TEXT[regionId];
  if (!text) return null;
  return { id: `warden:${regionId}`, title: "What kept the shrine", text, source: "Firsthand discovery" };
}
