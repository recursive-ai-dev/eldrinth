/**
 * Component types for the entity-component system.
 * Each component is a plain data object with no behavior.
 */

export interface TransformComponent {
  x: number;
  y: number;
  r: number; // radius for collision
}

export interface VelocityComponent {
  vx: number;
  vy: number;
}

export interface HealthComponent {
  hp: number;
  maxHp: number;
  invuln: number; // invulnerability timer
}

export interface SpriteComponent {
  type: string; // archetype name for rendering
  dir?: 'up' | 'down' | 'left' | 'right';
  walkT?: number; // walk animation timer
  hurtFlash?: number; // hurt flash timer
  bob?: number; // vertical bob offset
}

export interface ColliderComponent {
  type: 'circle'; // extensible to 'rect', 'hitbox', etc.
  layer: 'player' | 'enemy' | 'projectile' | 'item' | 'static';
}

export interface AIStateComponent {
  behaviorType: string; // references archetype behavior
  t: number; // behavior timer
  wanderA: number; // wander angle
  targetId: number | null; // entity ID of target
  telegraph: string | null; // current telegraph state
  telegraphTimer: number;
  cooldowns: Record<string, number>; // named cooldowns
}

export interface CombatComponent {
  dmg: number;
  attackTimer: number;
  attackCd: number;
  attackDur: number;
  attacking: boolean;
  swingHit: Set<number>; // entity IDs hit this swing
  swingDmg: number;
}

export interface DashComponent {
  dashTimer: number;
  dashCd: number;
  dashDir: 'up' | 'down' | 'left' | 'right';
  dashing: boolean;
}

export interface StaminaComponent {
  stamina: number;
  maxStamina: number;
  staminaRegenDelay: number;
}

export interface ProjectileComponent {
  life: number;
  ownerId: number | null; // who fired this
}

export interface ItemComponent {
  itemType: string;
  taken: boolean;
  t: number; // animation timer
}

export interface InteractableComponent {
  type: 'npc' | 'sign';
  interactionDistance: number;
  dialogueId?: string;
  text?: string;
}

export interface KnockbackComponent {
  kx: number;
  ky: number;
}

export interface DeathComponent {
  dying: number; // death animation timer, 0 = alive
}

/**
 * Union of all component types for type-safe storage.
 */
export type Component =
  | TransformComponent
  | VelocityComponent
  | HealthComponent
  | SpriteComponent
  | ColliderComponent
  | AIStateComponent
  | CombatComponent
  | DashComponent
  | StaminaComponent
  | ProjectileComponent
  | ItemComponent
  | InteractableComponent
  | KnockbackComponent
  | DeathComponent;

/**
 * Component type identifiers for storage keys.
 */
export type ComponentType =
  | 'transform'
  | 'velocity'
  | 'health'
  | 'sprite'
  | 'collider'
  | 'aiState'
  | 'combat'
  | 'dash'
  | 'stamina'
  | 'projectile'
  | 'item'
  | 'interactable'
  | 'knockback'
  | 'death';
