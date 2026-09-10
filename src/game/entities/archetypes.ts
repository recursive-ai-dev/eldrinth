import type {
  TransformComponent,
  VelocityComponent,
  HealthComponent,
  SpriteComponent,
  ColliderComponent,
  AIStateComponent,
  CombatComponent,
  DashComponent,
  StaminaComponent,
  ProjectileComponent,
  ItemComponent,
  InteractableComponent,
  KnockbackComponent,
  DeathComponent,
} from './components';

/**
 * Data-driven archetype definition.
 * Each archetype specifies which components to attach and their initial values.
 * New archetypes can be added as plain objects without touching core systems.
 */
export interface EntityArchetype {
  name: string;
  tags?: string[];
  transform?: Omit<TransformComponent, 'x' | 'y'> & { x?: number; y?: number };
  velocity?: Partial<VelocityComponent>;
  health?: Partial<HealthComponent>;
  sprite?: Partial<SpriteComponent>;
  collider?: Partial<ColliderComponent>;
  aiState?: Partial<AIStateComponent>;
  combat?: Partial<CombatComponent>;
  dash?: Partial<DashComponent>;
  stamina?: Partial<StaminaComponent>;
  projectile?: Partial<ProjectileComponent>;
  item?: Partial<ItemComponent>;
  interactable?: Partial<InteractableComponent>;
  knockback?: Partial<KnockbackComponent>;
  death?: Partial<DeathComponent>;
}

/* -------------------------------------------------------------------------- */
/*                         Built-in archetype catalogue                       */
/* -------------------------------------------------------------------------- */

/** Player archetype — the lone wayfarer. */
export const PLAYER_ARCHETYPE: EntityArchetype = {
  name: 'player',
  tags: ['player', 'actor'],
  transform: { r: 11 },
  velocity: { vx: 0, vy: 0 },
  health: { hp: 6, maxHp: 6, invuln: 0 },
  sprite: { type: 'player', dir: 'down', walkT: 0, hurtFlash: 0 },
  collider: { type: 'circle', layer: 'player' },
  combat: {
    dmg: 1,
    attackTimer: 0,
    attackCd: 0.16,
    attackDur: 0.2,
    attacking: false,
    swingHit: new Set(),
    swingDmg: 1,
  },
  dash: { dashTimer: 0, dashCd: 0.62, dashDir: 'down', dashing: false },
  stamina: { stamina: 100, maxStamina: 100, staminaRegenDelay: 0.45 },
  knockback: { kx: 0, ky: 0 },
  death: { dying: 0 },
};

/** Wraith — drifting chaser with sinusoidal bob. */
export const WRAITH_ARCHETYPE: EntityArchetype = {
  name: 'wraith',
  tags: ['enemy', 'actor'],
  transform: { r: 13 },
  velocity: { vx: 0, vy: 0 },
  health: { hp: 3, maxHp: 3, invuln: 0 },
  sprite: { type: 'wraith', hurtFlash: 0, bob: 0 },
  collider: { type: 'circle', layer: 'enemy' },
  aiState: {
    behaviorType: 'wraith',
    t: 0,
    wanderA: 0,
    targetId: null,
    telegraph: null,
    telegraphTimer: 0,
    cooldowns: {},
  },
  death: { dying: 0 },
};

/** Sentinel — fast chaser with heavy poise. */
export const SENTINEL_ARCHETYPE: EntityArchetype = {
  name: 'sentinel',
  tags: ['enemy', 'actor'],
  transform: { r: 14 },
  velocity: { vx: 0, vy: 0 },
  health: { hp: 5, maxHp: 5, invuln: 0 },
  sprite: { type: 'sentinel', hurtFlash: 0 },
  collider: { type: 'circle', layer: 'enemy' },
  aiState: {
    behaviorType: 'sentinel',
    t: 0,
    wanderA: 0,
    targetId: null,
    telegraph: null,
    telegraphTimer: 0,
    cooldowns: {},
  },
  death: { dying: 0 },
};

/** Adept — ranged caster that kites and telegraphs spells. */
export const ADEPT_ARCHETYPE: EntityArchetype = {
  name: 'adept',
  tags: ['enemy', 'actor'],
  transform: { r: 13 },
  velocity: { vx: 0, vy: 0 },
  health: { hp: 4, maxHp: 4, invuln: 0 },
  sprite: { type: 'adept', hurtFlash: 0 },
  collider: { type: 'circle', layer: 'enemy' },
  aiState: {
    behaviorType: 'adept',
    t: 0,
    wanderA: 0,
    targetId: null,
    telegraph: null,
    telegraphTimer: 0,
    cooldowns: { shootCd: 1.7 },
  },
  death: { dying: 0 },
};

/** Boss — The Unbound. Multi-phase with lunge, burst, and summon. */
export const BOSS_ARCHETYPE: EntityArchetype = {
  name: 'boss',
  tags: ['enemy', 'actor', 'boss'],
  transform: { r: 26 },
  velocity: { vx: 0, vy: 0 },
  health: { hp: 42, maxHp: 42, invuln: 0 },
  sprite: { type: 'boss', hurtFlash: 0 },
  collider: { type: 'circle', layer: 'enemy' },
  aiState: {
    behaviorType: 'boss',
    t: 0,
    wanderA: 0,
    targetId: null,
    telegraph: null,
    telegraphTimer: 0,
    cooldowns: { burstCd: 2.2, lungeCd: 3.5, summonCd: 6.5 },
  },
  death: { dying: 0 },
};

/** Generic enemy projectile. */
export const PROJECTILE_ARCHETYPE: EntityArchetype = {
  name: 'projectile',
  tags: ['projectile'],
  transform: { r: 6 },
  velocity: { vx: 0, vy: 0 },
  sprite: { type: 'projectile' },
  collider: { type: 'circle', layer: 'projectile' },
  projectile: { life: 3.2, ownerId: null },
};

/** Anima Shard — key collectible. */
export const SHARD_ARCHETYPE: EntityArchetype = {
  name: 'shard',
  tags: ['item', 'collectible'],
  transform: { r: 14 },
  sprite: { type: 'shard' },
  collider: { type: 'circle', layer: 'item' },
  item: { itemType: 'shard', taken: false, t: 0 },
};

/** Healing Potion — consumable pickup. */
export const POTION_ARCHETYPE: EntityArchetype = {
  name: 'potion',
  tags: ['item', 'collectible'],
  transform: { r: 10 },
  sprite: { type: 'potion' },
  collider: { type: 'circle', layer: 'item' },
  item: { itemType: 'potion', taken: false, t: 0 },
};

/** NPC — Orithel, the Last Watcher. */
export const NPC_ARCHETYPE: EntityArchetype = {
  name: 'npc',
  tags: ['npc', 'interactable'],
  transform: { r: 12 },
  sprite: { type: 'npc' },
  interactable: {
    type: 'npc',
    interactionDistance: 48,
    dialogueId: 'orithel',
  },
};

/** Sign — readable lore carving. */
export const SIGN_ARCHETYPE: EntityArchetype = {
  name: 'sign',
  tags: ['sign', 'interactable'],
  transform: { r: 16 },
  sprite: { type: 'sign' },
  interactable: {
    type: 'sign',
    interactionDistance: 44,
  },
};

/**
 * The complete archetype catalogue. New archetypes can be added here
 * without touching any core system.
 */
export const ARCHETYPE_CATALOGUE: Readonly<Record<string, EntityArchetype>> = {
  player: PLAYER_ARCHETYPE,
  wraith: WRAITH_ARCHETYPE,
  sentinel: SENTINEL_ARCHETYPE,
  adept: ADEPT_ARCHETYPE,
  boss: BOSS_ARCHETYPE,
  projectile: PROJECTILE_ARCHETYPE,
  shard: SHARD_ARCHETYPE,
  potion: POTION_ARCHETYPE,
  npc: NPC_ARCHETYPE,
  sign: SIGN_ARCHETYPE,
};
