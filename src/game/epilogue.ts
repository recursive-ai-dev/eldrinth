import type { QuestProgress } from "./quests";
import { QUESTS, TOWN_PROJECTS, townProjectComplete } from "./quests";

/**
 * The epilogue: what the run adds up to, in the player's own hand, assembled
 * from the decisions they actually made.
 *
 * The investigations resolve into one of three choices each, and every one of
 * them costs a person something — a still-conscious vessel is either folded into
 * the player's own body or put out. There is no free option, so the epilogue has
 * to name which price was paid rather than congratulating the player
 * unconditionally. Silence about it was the gap: forty pieces of authored
 * decision text fed into three static screens.
 */
export interface EpilogueInput {
  progress: QuestProgress;
  /** Distinct warden accounts recorded, out of the nine fortresses. */
  wardenAccounts: number;
  /** Town requests completed, out of the eight authored projects. */
  townProjects: number;
  deaths: number;
  shards: number;
  totalShards: number;
}

/** The choice each investigation resolves to, in one flat lookup. */
const CHOICE_FATE: Record<string, string> = {
  // The Courier Who Never Came
  release: "a child of the wagon, handed to the wayfires, warm and confused and alive",
  bind: "a child of the wagon, folded into the edge of your blade, silent",
  end: "a child of the wagon, put out by your own hand outside the hall, and the yield lost",
  // Names the Tide Kept
  remember: "forty-one names put back where they were taken from, and a coast that now knows precisely who to hate",
  mercy: "forty-one names left quiet in a sealed account, and a trick for leaving no trace that anyone could count",
  // A Borrowed Dawn
  kindle: "an astronomer still burning in your chest, keeping you upright",
  temper: "an astronomer tempered into your blade, efficient, and not a defence",
  // The Shape of the Pilgrim
  name: "a name repeated often enough that you could breathe it",
  weapon: "a dead pilgrim's way of crossing a threshold, which was never yours to take",
};

const CHOICE_PHRASE: Record<string, string> = {
  release: "You gave the child to the wayfires.",
  bind: "You gave the child to your blade.",
  end: "You ended it yourself, and took nothing.",
  remember: "You put the names back.",
  mercy: "You let the names stay quiet.",
  kindle: "You lit the astronomer inside you.",
  temper: "You folded the astronomer into your blade.",
  name: "You accepted the name Barris gave you.",
  weapon: "You used the pattern instead of taking the name.",
};

const INVESTIGATION_ORDER = ["courier", "salt", "dawn", "pilgrim"];

/** Towns and what completing its requests is later described as. */
const PROJECT_FATE: Record<string, string> = {
  "ilyarael:ledger-room": "Ilyarael's ledger room is open to whoever comes looking, which is more than it was",
  "ilyarael:wayfire-stones": "the wayfire stones at Ilyarael are cut and set where the road bends",
  "cinder-haven:kiln": "the kiln at Cinder Haven is burning through the night again",
  "cinder-haven:watch-road": "the Cinderwild watch-road is walked by people who know what they are watching for",
  "oarsmans-bight:ferry": "the ferry runs on a schedule the coast can read",
  "oarsmans-bight:names": "the salt-graves have names on them again",
  "crater-watch:path": "the crater path is marked well enough that a stranger could take it",
  "crater-watch:lens": "the lens at Crater Watch is turned on something other than the sky",
};

export function epilogueLines(input: EpilogueInput): string[] {
  const lines: string[] = [];
  const resolved = INVESTIGATION_ORDER.filter((id) => input.progress.resolutions[id]);

  if (resolved.length === 0) {
    lines.push(
      "I reached the end of this without opening a single one of his files. Orithel never once asked me to. He only kept the forms ready, in case I changed my mind, and I did not.",
      "Whatever else this run was, it was not an investigation. It was a walk, with a blade, to a place that was already waiting for me.",
    );
  } else {
    for (const id of resolved) {
      const choice = input.progress.resolutions[id];
      const quest = QUESTS.find((entry) => entry.id === id);
      const title = quest?.title ?? id;
      lines.push(
        `${title}: ${CHOICE_PHRASE[choice] ?? "I decided, and I did not write down what I decided."} It is ${CHOICE_FATE[choice] ?? "settled, and not by me"}.`,
      );
    }
    const unresolved = INVESTIGATION_ORDER.length - resolved.length;
    if (unresolved > 0) {
      lines.push(
        `${unresolved} of his ${INVESTIGATION_ORDER.length === 1 ? "file stands" : "files stand"} unopened. I will not be able to say what I would have done, and neither will he.`,
      );
    }
  }

  if (input.townProjects > 0) {
    const done = TOWN_PROJECTS.filter((project) => townProjectComplete(input.progress, project.id));
    const named = done.slice(0, 3).map((project) => PROJECT_FATE[project.id]).filter(Boolean);
    const more = done.length - named.length;
    lines.push(
      `${done.length} of the ${TOWN_PROJECTS.length} requests came back finished, and the roads are different for it: ${named.join("; ")}${more > 0 ? `, and ${more} more` : ""}.`,
    );
  }

  if (input.wardenAccounts >= 9) {
    lines.push("I know what was guarding all nine of them. That is the only thing I took out of those rooms that the Mnemonic did not already have.");
  } else if (input.wardenAccounts > 0) {
    lines.push(`I know what was guarding ${input.wardenAccounts} of the ${input.totalShards}. The other ${input.totalShards - input.wardenAccounts} are still standing in the dark, still doing the job.`);
  }

  if (input.deaths > 0) {
    lines.push(
      `The road took me ${input.deaths === 1 ? "once" : `${input.deaths} times`}. Nobody wrote that down for me; I am writing it down here.`,
    );
  }

  return lines;
}
