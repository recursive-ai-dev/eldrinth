import { EntityRegistry, type EntityId } from './EntityRegistry';

/**
 * Configuration for an entity pool.
 * Pre-allocates entity IDs and recycles them to avoid GC pressure.
 */
export interface PoolConfig {
  initialSize: number;
  maxSize: number;
}

/**
 * Object pool for frequently created/destroyed entities.
 * Reduces garbage collection pressure for projectiles, particles, etc.
 */
export class EntityPool {
  private readonly available: EntityId[] = [];
  private readonly inUse = new Set<EntityId>();
  private readonly registry: EntityRegistry;
  private readonly maxSize: number;

  constructor(
    registry: EntityRegistry,
    config: PoolConfig = { initialSize: 32, maxSize: 128 }
  ) {
    this.registry = registry;
    this.maxSize = config.maxSize;

    // Pre-allocate initial pool
    for (let i = 0; i < config.initialSize; i++) {
      const id = registry.create();
      this.available.push(id);
    }
  }

  /**
   * Acquire an entity from the pool.
   * Returns null if pool is exhausted.
   */
  acquire(): EntityId | null {
    let id: EntityId | null = null;

    if (this.available.length > 0) {
      id = this.available.pop()!;
    } else if (this.inUse.size < this.maxSize) {
      // Pool exhausted but under max, create new
      id = this.registry.create();
    } else {
      // Pool fully exhausted
      return null;
    }

    this.inUse.add(id);
    return id;
  }

  /**
   * Release an entity back to the pool.
   * The caller should clear all components before releasing.
   */
  release(id: EntityId): void {
    if (!this.inUse.has(id)) return;

    this.inUse.delete(id);
    this.available.push(id);
  }

  /**
   * Check if an entity is currently in use from this pool.
   */
  isInUse(id: EntityId): boolean {
    return this.inUse.has(id);
  }

  /**
   * Get the number of entities currently in use.
   */
  get activeCount(): number {
    return this.inUse.size;
  }

  /**
   * Get the number of entities available in the pool.
   */
  get availableCount(): number {
    return this.available.length;
  }

  /**
   * Get total pool capacity.
   */
  get capacity(): number {
    return this.maxSize;
  }
}
