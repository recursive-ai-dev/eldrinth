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

export function shardPickupMessage(count: number, total: number): string {
  return `Anima Shard recovered (${count}/${total}).${SHARD_NOTES[count] ?? ""}`;
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
