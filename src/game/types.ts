import type { EndingId } from "./core/SceneStack";

export type Dir = "up" | "down" | "left" | "right";
export type Difficulty = "story" | "standard" | "brutal";
export const VALID_DIFFICULTIES: readonly Difficulty[] = ["story", "standard", "brutal"] as const;

export function isDifficulty(value: unknown): value is Difficulty {
  return value === "story" || value === "standard" || value === "brutal";
}

export function normalizeDifficulty(value: unknown, fallback: Difficulty = "standard"): Difficulty {
  return isDifficulty(value) ? value : fallback;
}

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
  townId?: string;
}

export interface JournalEntry {
  id: string;
  title: string;
  text: string;
  questId?: string;
  source?: string;
  resolved?: boolean;
}

/**
 * A stable art brief for a conversation portrait. `id` is deliberately kept
 * separate from a file path: portrait art can be dropped in later without
 * changing narrative or save data.
 */
export interface NpcPortrait {
  id: string;
  /** Locked appearance direction for the reserved frame and portrait handoff. */
  description: string;
}

/** A marked road at a region boundary. Coordinates are in tiles. */
export interface RegionExit {
  x: number;
  y: number;
  targetRegion: string;
  /** Pixel position where the traveller arrives in the target region. */
  destination: Vec;
  label: string;
  /** Doorways use an explicit interaction; frontier gates remain walk-through. */
  requiresInteraction?: boolean;
}

export interface CampfireData {
  x: number;
  y: number;
  name: string;
  relic: "emberheart" | "ashstep" | "tidewell" | "starblade";
}

export interface NpcData {
  /** Pixel position. */
  x: number;
  y: number;
  id: string;
  name: string;
  /** Dialogue color. */
  color: string;
  /** Functional role — drives which interaction branch in the engine handles this NPC. */
  role: "healer" | "scout" | "merchant" | "lore";
  /** Locked visual identity and reserved conversation-portrait slot. */
  portrait?: NpcPortrait;
}

export interface TownData {
  id: string;
  name: string;
  /** Center of the safe zone in pixel coordinates. */
  x: number;
  y: number;
  /** Radius in pixels inside which enemies do not spawn and will not pursue. */
  safeRadius: number;
  /** Enterable homes and workrooms around the town square. */
  buildings: TownBuildingData[];
  /** Readable sign at the town entrance. */
  sign?: SignData;
}

export interface SettlementState {
  townId: string;
  refugees: number;
  lamps: number;
  guarded: boolean;
  closedBusinesses: number;
  completedProjects: number;
}

/** An exterior doorway which leads to a resident's small authored interior. */
export interface TownBuildingData {
  id: string;
  name: string;
  /** Door tile on the exterior map. */
  x: number;
  y: number;
  /** The material family used by this building's exterior and room dressing. */
  theme: "oldstone" | "cinder" | "coastal" | "moor";
  /** Region id for the building's interior. */
  interiorId: string;
  /** The resident found inside. */
  resident: Omit<NpcData, "x" | "y">;
}

export interface MapData {
  regionName: string;
  width: number;
  height: number;
  tiles: Uint8Array;
  wardTiles: number[];
  spawn: Vec;
  /** Named inhabitants presently rendered and interactable in this map. */
  npcs: NpcData[];
  /** Legacy single NPC slot used by Orithel in the Old Lands. */
  npc: Vec;
  signs: SignData[];
  shards: Vec[];
  enemySpawns: EnemySpawn[];
  bossCenter: Vec;
  exits: RegionExit[];
  campfires: CampfireData[];
  /** Authored settlements placed on the frontier. */
  towns: TownData[];
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
  /** Present for named NPC conversations until final portrait art is supplied. */
  portrait?: NpcPortrait;
  /** Makes an NPC's practical role clear at a glance in the dialogue panel. */
  roleLabel?: string;
}

export interface GameCallbacks {
  onHud: (d: HudData) => void;
  onDialogue: (d: DialogueData | null) => void;
  onPause: (paused: boolean) => void;
  onEnd: (ending: EndingId) => void;
  onJournal: (entries: JournalEntry[]) => void;
  onInterior: (inside: boolean) => void;
}
