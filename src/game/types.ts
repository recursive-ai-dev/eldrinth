export type Dir = "up" | "down" | "left" | "right";

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
}

export interface SignData {
  x: number;
  y: number;
  text: string;
}

export interface MapData {
  width: number;
  height: number;
  tiles: Uint8Array;
  solid: Uint8Array;
  wardTiles: number[];
  spawn: Vec;
  npc: Vec;
  signs: SignData[];
  shards: Vec[];
  enemySpawns: EnemySpawn[];
  bossCenter: Vec;
}

export interface HudData {
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
}

export interface GameCallbacks {
  onHud: (d: HudData) => void;
  onDialogue: (d: DialogueData | null) => void;
  onPause: (paused: boolean) => void;
  onWin: () => void;
  onLose: () => void;
}
