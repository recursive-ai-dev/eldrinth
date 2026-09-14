import type { EndingId } from "./core/SceneStack";

export type Dir = "up" | "down" | "left" | "right";
export type Difficulty = "story" | "standard" | "brutal";

export type EnemyType = "wraith" | "sentinel" | "adept" | "boss";
export type ItemType = "shard" | "potion";

export interface Vec {
  x: number;
  y: number;
}

export interface EnemySpawn {
  x: number;
  y: number;
  type: EnemyType;
  elite?: boolean;
}

export interface SignData {
  x: number;
  y: number;
  text: string;
  title?: string;
  fact?: string;
}

export interface JournalEntry {
  id: string;
  title: string;
  text: string;
  questId?: string;
  source?: string;
  resolved?: boolean;
}

/** A marked road at a region boundary. Coordinates are in tiles. */
export interface RegionExit {
  x: number;
  y: number;
  targetRegion: string;
  /** Pixel position where the traveller arrives in the target region. */
  destination: Vec;
  label: string;
}

export interface CampfireData {
  x: number;
  y: number;
  name: string;
  relic: "emberheart" | "ashstep" | "tidewell" | "starblade";
}

export interface MapData {
  regionName: string;
  width: number;
  height: number;
  tiles: Uint8Array;
  wardTiles: number[];
  spawn: Vec;
  npc: Vec;
  signs: SignData[];
  shards: Vec[];
  enemySpawns: EnemySpawn[];
  bossCenter: Vec;
  exits: RegionExit[];
  campfires: CampfireData[];
  /** Interiors render under a darkness overlay punched by light sources. */
  dark: boolean;
  /** Dying here discards the region's retained inhabitants. */
  resetOnDeath: boolean;
  /** Light sources that are not rest points. Pixel coordinates. */
  lights: Vec[];
}

export interface HudData {
  regionName: string;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  shards: number;
  totalShards: number;
  objective: string;
  message: string;
  messageId: number;
  prompt: string;
  enemies: number;
  bossActive: boolean;
  bossHp: number;
}

export interface DialogueData {
  speaker: string;
  text: string;
  index: number;
  total: number;
  color: string;
  choices?: { id: string; label: string }[];
}

export interface GameCallbacks {
  onHud: (d: HudData) => void;
  onDialogue: (d: DialogueData | null) => void;
  onPause: (paused: boolean) => void;
  onEnd: (ending: EndingId) => void;
  onJournal: (entries: JournalEntry[]) => void;
  onInterior: (inside: boolean) => void;
}
