import { type DialogueData, type Difficulty, type Dir, type EnemyType, type ItemType, type JournalEntry, type MapData, normalizeDifficulty } from "../types";
import type { QuestProgress } from "../quests";
import { cumulativeHarvestCost, fortressShardIntakeEntry } from "../escalation";
import { FORTRESS_LAYOUTS } from "../fortressLayouts";
import { normalizeCombatTool, normalizeEquippedRelics, type CombatToolId, type RelicId } from "../equipment";

export interface RegionSnapshot {
  enemies: EnemyState[];
  items: ItemState[];
  bossId: number | null;
  bossSpawned: boolean;
}

export interface WayfireCheckpoint {
  regionId: string;
  x: number;
  y: number;
  name: string;
}

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
  relics: string[];
  dashCostDiscount: number;
  attackBonus: number;
  /** Optional in v4 checkpoints written before equipment became selectable. */
  equippedRelics?: RelicId[];
  combatTool?: CombatToolId;
  attackWindup?: number;
  guardTimer?: number;
  guardCooldown?: number;
  riposteTimer?: number;
  parryCount?: number;
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
  elite?: boolean;
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
  /** A bolt turned back by Ashstep. */
  friendly?: boolean;
}

export interface ItemState {
  x: number;
  y: number;
  type: ItemType;
  t: number;
  taken: boolean;
}

export interface WorldSnapshot {
  version: 1 | 2 | 3 | 4;
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
  /** Optional so pre-slot checkpoints remain loadable. */
  difficulty?: Difficulty;
  journal?: JournalEntry[];
  quests?: QuestProgress;
  regions?: Record<string, RegionSnapshot>;
  checkpoint?: WayfireCheckpoint | null;
  /**
   * Region ids whose shard has already been taken. Optional because v4 saves
   * predate it; those are recovered from intake and regional records on restore.
   */
  harvestedShards?: string[];
  /** Optional: pre-v1.0 saves did not count deaths. */
  deaths?: number;
  /** Surveyed landmarks, grouped by region; older saves begin with an empty atlas. */
  atlasDiscoveries?: Record<string, string[]>;
}

/** Counts cannot identify vessels in a game that permits any collection order. */
export function restoreHarvestedShards(snapshot: WorldSnapshot): Set<string> {
  if (snapshot.harvestedShards) return new Set(snapshot.harvestedShards);
  const ids = Object.keys(FORTRESS_LAYOUTS);
  if (!Number.isInteger(snapshot.shards) || snapshot.shards < 0 || snapshot.shards > ids.length) {
    throw new Error("This save has an invalid shard count. The original record has been left untouched.");
  }
  if (snapshot.shards === ids.length) return new Set(ids);
  const harvested = new Set<string>();
  for (const id of ids) {
    const intake = fortressShardIntakeEntry(id);
    const items = snapshot.regionId === id ? snapshot.items : snapshot.regions?.[id]?.items;
    if ((intake && snapshot.journal?.some((entry) => entry.id === intake.id)) ||
        (items && !items.some((item) => item.type === "shard" && !item.taken))) {
      harvested.add(id);
    }
  }
  if (harvested.size !== snapshot.shards) {
    throw new Error("This older save does not identify all harvested shards reliably, so it cannot be resumed safely. The original record has been left untouched.");
  }
  return harvested;
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
  totalShards = 9;
  /**
   * Region ids whose Anima Shard has already been taken. Each fortress holds
   * exactly one shard, so this is the authority on which vessels are emptied:
   * `shards` is the count, this is the identity. It has to be persisted because
   * dying inside a fortress discards that region's saved state, which
   * otherwise re-seeds the shard and lets the count be farmed past nine.
   */
  harvestedShards = new Set<string>();
  deaths = 0;
  atlasDiscoveries: Record<string, string[]> = {};
  message = "";
  messageId = 0;
  nextEnemyId = 1;
  private randomState = 0x6d2b79f5;
  dialogue: DialogueData | null = null;
  difficulty: Difficulty = "standard";
  journal: JournalEntry[] = [];
  quests: QuestProgress = { facts: [], resolutions: {} };
  regions: Record<string, RegionSnapshot> = {};
  checkpoint: WayfireCheckpoint | null = null;

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
      version: 4,
      regionId: this.regionId,
      simulationTime: this.simulationTime,
      tick: this.tick,
      player: { ...this.player, relics: [...this.player.relics], equippedRelics: normalizeEquippedRelics(this.player.equippedRelics, this.player.relics), combatTool: normalizeCombatTool(this.player.combatTool), swingHit: [...this.player.swingHit] },
      enemies: this.enemies.map((enemy) => ({ ...enemy })),
      projectiles: this.projectiles.map((projectile) => ({ ...projectile })),
      items: this.items.map((item) => ({ ...item })),
      bossId: this.boss?.id ?? null,
      wardUnlocked: this.wardUnlocked,
      bossSpawned: this.bossSpawned,
      shards: this.shards,
      totalShards: this.totalShards,
      harvestedShards: [...this.harvestedShards],
      deaths: this.deaths,
      atlasDiscoveries: structuredClone(this.atlasDiscoveries),
      message: this.message,
      messageId: this.messageId,
      nextEnemyId: this.nextEnemyId,
      randomState: this.randomState,
      difficulty: this.difficulty,
      journal: this.journal.map((entry) => ({ ...entry })),
      quests: structuredClone(this.quests),
      regions: structuredClone(this.regions),
      checkpoint: this.checkpoint ? { ...this.checkpoint } : null,
    };
  }

  restore(snapshot: WorldSnapshot) {
    if (snapshot.version !== 1 && snapshot.version !== 2 && snapshot.version !== 3 && snapshot.version !== 4)
      throw new Error(`Unsupported world snapshot version: ${String(snapshot.version)}`);
    // Resolve compatibility before mutating any live state.
    const harvested = restoreHarvestedShards(snapshot);
    const legacySave = snapshot.version === 1;
    const preRewriteSave = snapshot.version <= 2;
    // Pre-inversion saves (v3 and earlier) banked +1 maxHp per shard already
    // taken; the new rule bills per shard still remaining. Left alone, a
    // carried save's maxHp would be floored at 1 by the new harvest costs
    // instead of landing on the fresh-rules target. This delta lands every
    // shard count exactly on that target without touching quest/relic
    // bonuses, which are folded into the same maxHp field as a separate,
    // untracked addend.
    const needsHarvestCostMigration = snapshot.version <= 3;
    this.regionId = snapshot.regionId;
    this.simulationTime = snapshot.simulationTime;
    this.tick = snapshot.tick;
    this.player = { ...snapshot.player, relics: [...(snapshot.player.relics ?? [])], dashCostDiscount: snapshot.player.dashCostDiscount ?? 0, attackBonus: snapshot.player.attackBonus ?? 0, swingHit: new Set(snapshot.player.swingHit) };
    this.player.equippedRelics = normalizeEquippedRelics(snapshot.player.equippedRelics, this.player.relics);
    this.player.combatTool = normalizeCombatTool(snapshot.player.combatTool);
    this.player.attackWindup = Math.max(0, snapshot.player.attackWindup ?? 0);
    // Restoring a checkpoint cannot bank an active parry or a pending riposte.
    this.player.guardTimer = 0;
    this.player.guardCooldown = 0;
    this.player.riposteTimer = 0;
    this.player.parryCount = Math.max(0, Math.floor(snapshot.player.parryCount ?? 0));
    this.enemies = snapshot.enemies.map((enemy) => ({ ...enemy }));
    this.projectiles = snapshot.projectiles.map((projectile) => ({ ...projectile }));
    this.items = snapshot.items.map((item) => ({ ...item }));
    this.wardUnlocked = snapshot.wardUnlocked;
    this.bossSpawned = snapshot.bossSpawned;
    this.shards = snapshot.shards;
    this.totalShards = snapshot.totalShards;
    this.harvestedShards = harvested;
    this.deaths = Math.max(0, snapshot.deaths ?? 0);
    this.atlasDiscoveries = {};
    if (snapshot.atlasDiscoveries && typeof snapshot.atlasDiscoveries === "object" && !Array.isArray(snapshot.atlasDiscoveries)) {
      for (const [region, ids] of Object.entries(snapshot.atlasDiscoveries).slice(0, 128)) {
        if (region === "__proto__" || region === "constructor" || region === "prototype" || !Array.isArray(ids)) continue;
        this.atlasDiscoveries[region] = [...new Set(ids.filter((id): id is string => typeof id === "string" && id.startsWith(`${region}:`) && id.length < 240))].slice(0, 512);
      }
    }
    this.message = snapshot.message;
    this.messageId = snapshot.messageId;
    this.nextEnemyId = snapshot.nextEnemyId;
    this.randomState = snapshot.randomState;
    this.difficulty = normalizeDifficulty(snapshot.difficulty, "standard");
    this.journal = snapshot.journal?.map((entry) => ({ ...entry })) ?? [];
    // Pre-rewrite saves (v2 and earlier) carry sign-copied and Orithel-briefing
    // entries written against the old canon, and nothing ever re-resolves them.
    // Personal notes (the player's own hand) and shard-bleed entries (new,
    // post-rewrite content) are kept; every other narrative entry is dropped.
    if (preRewriteSave) {
      this.journal = this.journal.filter((entry) => entry.id.startsWith("personal:") || entry.id.startsWith("bleed:"));
    }
    this.quests = structuredClone(snapshot.quests ?? { facts: [], resolutions: {} });
    this.regions = structuredClone(snapshot.regions ?? {});
    this.checkpoint = snapshot.checkpoint ? { ...snapshot.checkpoint } : null;
    if (needsHarvestCostMigration) {
      this.player.maxHp += 12 - snapshot.shards - cumulativeHarvestCost(snapshot.shards);
      this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    }
    // The harvest rule floors maxHp at 1, so the migration above must too.
    // Without the floor a corrupt or hand-edited save lands on maxHp <= 0 and
    // the player walks around alive at 0/0 until the next hit.
    this.player.maxHp = Math.max(1, this.player.maxHp);
    this.player.hp = Math.min(Math.max(0, this.player.hp), this.player.maxHp);
    if (legacySave) this.migrateLegacyPopulation();
    this.boss = snapshot.bossId === null ? null : this.enemies.find((enemy) => enemy.id === snapshot.bossId) ?? null;
    this.dialogue = null;
  }

  /** Version 1 had dense ambient populations; keep old expeditions playable after rebalancing. */
  private migrateLegacyPopulation() {
    const migrate = (enemies: EnemyState[], regionId: string) => {
      const cap = regionId === "overworld" ? 13 : 7;
      const special = enemies.filter((enemy) => enemy.elite || enemy.type === "boss");
      const ordinary = enemies.filter((enemy) => !enemy.elite && enemy.type !== "boss");
      const allowedOrdinary = Math.max(0, cap - special.length);
      const stride = Math.max(1, Math.ceil(ordinary.length / Math.max(1, allowedOrdinary)));
      const thinned = ordinary.filter((_, index) => index % stride === 0).slice(0, allowedOrdinary);
      const result = [...thinned, ...special];
      if (this.difficulty === "story") {
        for (const enemy of result) enemy.speed *= 0.74;
      }
      return result;
    };

    this.enemies = migrate(this.enemies, this.regionId);
    for (const [regionId, region] of Object.entries(this.regions)) {
      region.enemies = migrate(region.enemies, regionId);
    }
    if (this.difficulty === "story") {
      this.player.maxHp += 2;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
    }
  }
}
