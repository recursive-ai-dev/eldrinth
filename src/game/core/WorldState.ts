import type { DialogueData, Dir, EnemyType, ItemType, MapData } from "../types";

export interface PlayerState {
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  staminaRegenDelay: number;
  dir: Dir;
  speed: number;
  attackTimer: number;
  attackCd: number;
  attackDur: number;
  attacking: boolean;
  swingHit: Set<number>;
  swingDmg: number;
  invuln: number;
  dashTimer: number;
  dashCd: number;
  dashDir: Dir;
  dashing: boolean;
  walkT: number;
  hurtFlash: number;
  kx: number;
  ky: number;
  dying: number;
}

export interface EnemyState {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  vx: number;
  vy: number;
  hurt: number;
  t: number;
  shootCd: number;
  lungeCd: number;
  lungeTimer: number;
  lungeVx: number;
  lungeVy: number;
  burstCd: number;
  summonCd: number;
  telegraph: "spell" | "lunge" | "burst" | null;
  telegraphTimer: number;
  wanderA: number;
  bob: number;
  alive: boolean;
  dying: number;
}

export interface ProjectileState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  dmg: number;
  color: string;
}

export interface ItemState {
  x: number;
  y: number;
  type: ItemType;
  t: number;
  taken: boolean;
}

export interface WorldSnapshot {
  version: 1;
  regionId: string;
  simulationTime: number;
  tick: number;
  player: Omit<PlayerState, "swingHit"> & { swingHit: number[] };
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  items: ItemState[];
  bossId: number | null;
  wardUnlocked: boolean;
  bossSpawned: boolean;
  shards: number;
  totalShards: number;
  message: string;
  messageId: number;
  nextEnemyId: number;
  randomState: number;
}

/**
 * The only mutable authority for saveable simulation state. Runtime services
 * (input, render, UI, audio) may observe it but do not own gameplay data.
 */
export class WorldState {
  regionId = "overworld";
  simulationTime = 0;
  tick = 0;
  map!: MapData;
  wardSet = new Set<number>();
  player!: PlayerState;
  enemies: EnemyState[] = [];
  projectiles: ProjectileState[] = [];
  items: ItemState[] = [];
  boss: EnemyState | null = null;
  wardUnlocked = false;
  bossSpawned = false;
  shards = 0;
  totalShards = 3;
  message = "";
  messageId = 0;
  nextEnemyId = 1;
  private randomState = 0x6d2b79f5;
  dialogue: DialogueData | null = null;

  /** Deterministic PRNG for every simulation-affecting random decision. */
  nextRandom(): number {
    let value = this.randomState >>> 0;
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    this.randomState = value >>> 0;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  }

  snapshot(): WorldSnapshot {
    if (!this.player) throw new Error("Cannot save an uninitialized world.");
    return {
      version: 1,
      regionId: this.regionId,
      simulationTime: this.simulationTime,
      tick: this.tick,
      player: { ...this.player, swingHit: [...this.player.swingHit] },
      enemies: this.enemies.map((enemy) => ({ ...enemy })),
      projectiles: this.projectiles.map((projectile) => ({ ...projectile })),
      items: this.items.map((item) => ({ ...item })),
      bossId: this.boss?.id ?? null,
      wardUnlocked: this.wardUnlocked,
      bossSpawned: this.bossSpawned,
      shards: this.shards,
      totalShards: this.totalShards,
      message: this.message,
      messageId: this.messageId,
      nextEnemyId: this.nextEnemyId,
      randomState: this.randomState,
    };
  }

  restore(snapshot: WorldSnapshot) {
    if (snapshot.version !== 1) throw new Error(`Unsupported world snapshot version: ${snapshot.version}`);
    this.regionId = snapshot.regionId;
    this.simulationTime = snapshot.simulationTime;
    this.tick = snapshot.tick;
    this.player = { ...snapshot.player, swingHit: new Set(snapshot.player.swingHit) };
    this.enemies = snapshot.enemies.map((enemy) => ({ ...enemy }));
    this.projectiles = snapshot.projectiles.map((projectile) => ({ ...projectile }));
    this.items = snapshot.items.map((item) => ({ ...item }));
    this.boss = snapshot.bossId === null ? null : this.enemies.find((enemy) => enemy.id === snapshot.bossId) ?? null;
    this.wardUnlocked = snapshot.wardUnlocked;
    this.bossSpawned = snapshot.bossSpawned;
    this.shards = snapshot.shards;
    this.totalShards = snapshot.totalShards;
    this.message = snapshot.message;
    this.messageId = snapshot.messageId;
    this.nextEnemyId = snapshot.nextEnemyId;
    this.randomState = snapshot.randomState;
    this.dialogue = null;
  }
}
