import { applyHarvestCost } from "./escalation";
import type { JournalEntry } from "./types";

export const SHARD_INTERACT_RADIUS = 44;

export interface AnimaVoice {
  id: string;
  name: string;
  arrival: string;
  memory: string;
}

/** A person gets to be more than the reason the institution took them. */
export const ANIMA_VOICES: readonly AnimaVoice[] = [
  { id: "fortress.old-lands-archive", name: "Vaelen", arrival: "A voice asks whether you have dry paper. Then, more carefully: ‘My name is Vaelen. Does that still go on the first line?’", memory: "‘My sister never returned a book. She left pears on the step instead. Bad pears, usually. I entered them all as returned.’ Vaelen waits while the fire settles. ‘I would like that in the record. Somewhere they cannot correct it.’" },
  { id: "fortress.old-lands-reliquary", name: "Theon", arrival: "Every reflection turns toward you. ‘Theon,’ says the man in the glass. ‘Before you read the number. Theon.’", memory: "‘I made a blue cup with a crooked handle. My daughter said it fitted her thumb. Every year I offered to fix it. Every year she said no.’ Theon asks you to turn your hands toward the light. ‘I think she was right.’" },
  { id: "fortress.old-lands-vault", name: "Morwyn", arrival: "The seal holds a man's mouth shut. You hear him anyway. ‘Morwyn. I authorised this room. That is not the only thing I was.’", memory: "‘I kept bees before I kept the seal. You cannot order a bee to come home. You leave a place worth returning to.’ Morwyn is quiet for a long time. ‘I knew that. There is no version of this where I did not know.’" },
  { id: "fortress.cinderwild-shrine", name: "Roryn", arrival: "The small light moves when you breathe. ‘I'm Roryn. Are you the person who takes us outside?’", memory: "‘There was a dog by the bakery. Nobody owned him, so I did. I called him Thursday because that was the day.’ Roryn asks what day it is. You tell him you do not know. ‘That's all right. He answered to anything.’" },
  { id: "fortress.cinderwild-watchpost", name: "Kaelen", arrival: "A soldier counts your footsteps. ‘Decurion Kaelen. No. Just Kaelen, if the watch is over.’", memory: "‘My boots squeaked in the rain. The whole company knew when I was coming. I spent my first pay on a quieter pair.’ Kaelen listens to the fire. ‘I cannot remember anybody's face. I remember them laughing when it rained.’" },
  { id: "fortress.moonlit-salt-graves", name: "Maris", arrival: "The vessel smells of soap and salt. ‘Maris,’ says the voice. ‘If you are making another list, spell it right this time.’", memory: "‘Two stitches for the seam. One for the person who will have to mend it after you.’ Maris moves your fingers through the pattern. ‘My mother taught me that. She said good work leaves room for another pair of hands.’" },
  { id: "fortress.moonlit-beacon", name: "Alden", arrival: "The light is painfully warm. ‘Alden. I used to light the lamps. Please let me say that before you ask what kept them burning.’", memory: "‘There was one lamp nobody needed. End of the lane, beside an empty house. I lit it every evening because someone had planted flowers underneath.’ Alden asks if flowers still open in the dark. You say some do. He asks you to describe one." },
  { id: "fortress.starfall-observatory", name: "Selene", arrival: "The core is counting. It stops long enough to say, ‘Selene. If you move me, please tell me when we have arrived.’", memory: "You tell Selene you have arrived. ‘Then I can stop counting until we leave.’ The fire snaps. For a while she says nothing. ‘I once slept through an eclipse. Best sleep of my life. I told everyone it was clouded over.’" },
  { id: "fortress.starfall-watch", name: "Orren", arrival: "A man inside the iron ring asks if his work endured. Then he hears himself. ‘I am Orren. You need not answer the other question.’", memory: "‘I used to whistle while I worked. After the third complaint, I learned to whistle quietly. I thought that made me considerate.’ Orren tries to remember the tune. ‘I would like to tell you something small and have it be enough. It isn't. I know.’" },
];

export function animaVoice(regionId: string): AnimaVoice | undefined {
  return ANIMA_VOICES.find((voice) => voice.id === regionId);
}

export function carriedVoices(harvested: Iterable<string>): AnimaVoice[] {
  const ids = new Set(harvested);
  return ANIMA_VOICES.filter((voice) => ids.has(voice.id));
}

export function harvestDialogue(regionId: string, count: number, maxHp: number) {
  const voice = animaVoice(regionId);
  if (!voice) return null;
  const nextMax = applyHarvestCost(maxHp, maxHp, count).maxHp;
  const cost = maxHp - nextMax;
  return {
    voice,
    lines: [voice.arrival, `Carrying ${voice.name} will ${cost > 0 ? `permanently reduce your maximum health by ${cost}: ${maxHp} → ${nextMax}` : `leave your maximum health at ${maxHp}; there is no health cost for this taking`}. You can leave the vessel here and return. If you take it, the person inside comes with you.`],
    choices: [
      { id: `harvest:${regionId}`, label: `Carry ${voice.name}${cost > 0 ? ` (maximum health −${cost})` : " (no health cost)"}` },
      { id: "leave", label: "Leave the vessel here." },
    ],
  };
}

export function voiceJournalEntry(regionId: string): JournalEntry | null {
  const voice = animaVoice(regionId);
  return voice ? { id: `voice:${voice.id}`, title: `${voice.name} · Beside the fire`, text: voice.memory, source: "Names in the Fire" } : null;
}
