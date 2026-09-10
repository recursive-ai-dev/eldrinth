import { EntityRegistry, type EntityId } from './EntityRegistry';
import { EntityPool } from './EntityPool';
import type { EntityArchetype } from './archetypes';
import { ARCHETYPE_CATALOGUE } from './archetypes';
import type { Component, ComponentType } from './components';

/**
 * Component type keys in the same order as the archetype fields.
 */
const COMPONENT_KEYS: ComponentType[] = [
  'transform',
  'velocity',
  'health',
  'sprite',
  'collider',
  'aiState',
  'combat',
  'dash',
  'stamina',
  'projectile',
  'item',
  'interactable',
  'knockback',
  'death',
];

/**
 * Creates entities from archetype definitions.
 * Handles spawning, despawning, and pooling.
 */
export class EntityFactory {
  private readonly registry: EntityRegistry;
  private readonly projectilePool: EntityPool;

  constructor(registry: EntityRegistry) {
    this.registry = registry;
    this.projectilePool = new EntityPool(registry, {
      initialSize: 32,
      maxSize: 128,
    });
  }

  /**
   * Spawn an entity from an archetype name (looks up catalogue).
   */
  spawn(
    archetypeName: string,
    x: number,
    y: number,
    overrides?: Partial<Record<ComponentType, Partial<Component>>>
  ): EntityId {
    const archetype = ARCHETYPE_CATALOGUE[archetypeName];
    if (!archetype) {
      throw new Error(`Unknown archetype: ${archetypeName}`);
    }
    return this.spawnFromArchetype(archetype, x, y, overrides);
  }

  /**
   * Spawn an entity from an archetype definition directly.
   */
  spawnFromArchetype(
    archetype: EntityArchetype,
    x: number,
    y: number,
    overrides?: Partial<Record<ComponentType, Partial<Component>>>
  ): EntityId {
    const id = this.registry.create();

    // Attach all components defined in the archetype
    for (const key of COMPONENT_KEYS) {
      const base = archetype[key as keyof EntityArchetype] as Record<string, unknown> | undefined;
      if (base !== undefined) {
        const component = { ...base } as unknown as Component;
        // Set position for transform components
        if (key === 'transform') {
          (component as { x: number; y: number }).x = x;
          (component as { x: number; y: number }).y = y;
        }
        // Deep-clone Sets to avoid shared references
        if ('swingHit' in base && base.swingHit instanceof Set) {
          (component as { swingHit: Set<number> }).swingHit = new Set();
        }
        // Deep-clone cooldown records
        if ('cooldowns' in base && typeof base.cooldowns === 'object' && base.cooldowns !== null) {
          (component as { cooldowns: Record<string, number> }).cooldowns = {
            ...(base.cooldowns as Record<string, number>),
          };
        }
        this.registry.addComponent(id, key, component);
      }
    }

    // Apply overrides
    if (overrides) {
      for (const [key, override] of Object.entries(overrides) as Array<[ComponentType, Partial<Component>]>) {
        const existing = this.registry.getComponent(id, key);
        if (existing) {
          this.registry.addComponent(id, key, { ...existing, ...override } as Component);
        } else if (override) {
          this.registry.addComponent(id, key, override as Component);
        }
      }
    }

    // Attach tags
    if (archetype.tags) {
      for (const tag of archetype.tags) {
        this.registry.addTag(id, tag);
      }
    }

    return id;
  }

  /**
   * Spawn a projectile using the object pool.
   */
  spawnProjectile(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    _dmg: number,
    ownerId: EntityId | null = null,
    overrides?: Partial<Record<ComponentType, Partial<Component>>>
  ): EntityId | null {
    const id = this.projectilePool.acquire();
    if (id === null) return null;

    // Attach projectile components
    this.registry.addComponent(id, 'transform', { x, y, r: 6 });
    this.registry.addComponent(id, 'velocity', { vx, vy });
    this.registry.addComponent(id, 'sprite', { type: 'projectile' });
    this.registry.addComponent(id, 'collider', { type: 'circle', layer: 'projectile' });
    this.registry.addComponent(id, 'projectile', { life, ownerId });

    // Apply overrides
    if (overrides) {
      for (const [key, override] of Object.entries(overrides) as Array<[ComponentType, Partial<Component>]>) {
        const existing = this.registry.getComponent(id, key);
        if (existing) {
          this.registry.addComponent(id, key, { ...existing, ...override } as Component);
        }
      }
    }

    this.registry.addTag(id, 'projectile');

    return id;
  }

  /**
   * Despawn an entity. If it was pooled, returns it to the pool.
   */
  despawn(id: EntityId): void {
    if (this.projectilePool.isInUse(id)) {
      // Clear all components before returning to pool
      for (const key of COMPONENT_KEYS) {
        this.registry.removeComponent(id, key);
      }
      this.registry.removeTag(id, 'projectile');
      this.projectilePool.release(id);
    } else {
      this.registry.destroy(id);
    }
  }

  /**
   * Get pool statistics.
   */
  get poolStats() {
    return {
      projectiles: {
        active: this.projectilePool.activeCount,
        available: this.projectilePool.availableCount,
        capacity: this.projectilePool.capacity,
      },
    };
  }
}
