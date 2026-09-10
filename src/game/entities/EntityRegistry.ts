import type { Component, ComponentType } from './components';

/**
 * Unique entity identifier. Stable across entity lifetime.
 * Generation counter prevents stale references to destroyed entities.
 */
export type EntityId = number;

/**
 * Safe reference that detects if an entity was destroyed and recreated.
 * The generation counter increments on each ID reuse.
 */
export interface EntityRef {
  id: EntityId;
  generation: number;
}

/**
 * Lightweight entity-component registry.
 * Provides stable IDs, component storage, and queries.
 */
export class EntityRegistry {
  private nextId: EntityId = 1;
  private generations = new Map<EntityId, number>();
  private components = new Map<ComponentType, Map<EntityId, Component>>();
  private tags = new Map<string, Set<EntityId>>();
  private alive = new Set<EntityId>();

  /**
   * Create a new entity with a unique ID.
   */
  create(): EntityId {
    const id = this.nextId++;
    this.generations.set(id, 0);
    this.alive.add(id);
    return id;
  }

  /**
   * Destroy an entity and remove all its components.
   */
  destroy(id: EntityId): void {
    if (!this.alive.has(id)) return;

    this.alive.delete(id);

    // Remove all components
    for (const store of this.components.values()) {
      store.delete(id);
    }

    // Remove from all tags
    for (const tagSet of this.tags.values()) {
      tagSet.delete(id);
    }

    // Increment generation for ID reuse detection
    const gen = this.generations.get(id) ?? 0;
    this.generations.set(id, gen + 1);
  }

  /**
   * Check if an entity is alive.
   */
  isAlive(id: EntityId): boolean {
    return this.alive.has(id);
  }

  /**
   * Get a safe reference to an entity.
   */
  getRef(id: EntityId): EntityRef | null {
    if (!this.alive.has(id)) return null;
    return { id, generation: this.generations.get(id) ?? 0 };
  }

  /**
   * Check if a reference is still valid (entity alive and not recreated).
   */
  isValid(ref: EntityRef): boolean {
    return this.alive.has(ref.id) && (this.generations.get(ref.id) ?? -1) === ref.generation;
  }

  /**
   * Add a component to an entity.
   */
  addComponent<T extends Component>(id: EntityId, type: ComponentType, component: T): void {
    if (!this.alive.has(id)) return;

    if (!this.components.has(type)) {
      this.components.set(type, new Map());
    }

    this.components.get(type)!.set(id, component);
  }

  /**
   * Get a component from an entity.
   */
  getComponent<T extends Component>(id: EntityId, type: ComponentType): T | undefined {
    return this.components.get(type)?.get(id) as T | undefined;
  }

  /**
   * Remove a component from an entity.
   */
  removeComponent(id: EntityId, type: ComponentType): void {
    this.components.get(type)?.delete(id);
  }

  /**
   * Check if an entity has a component.
   */
  hasComponent(id: EntityId, type: ComponentType): boolean {
    return this.components.get(type)?.has(id) ?? false;
  }

  /**
   * Add a tag to an entity (for grouping/queries).
   */
  addTag(id: EntityId, tag: string): void {
    if (!this.alive.has(id)) return;

    if (!this.tags.has(tag)) {
      this.tags.set(tag, new Set());
    }

    this.tags.get(tag)!.add(id);
  }

  /**
   * Remove a tag from an entity.
   */
  removeTag(id: EntityId, tag: string): void {
    this.tags.get(tag)?.delete(id);
  }

  /**
   * Check if an entity has a tag.
   */
  hasTag(id: EntityId, tag: string): boolean {
    return this.tags.get(tag)?.has(id) ?? false;
  }

  /**
   * Query all entities that have a specific component.
   */
  query<T extends Component>(type: ComponentType): Array<{ id: EntityId; component: T }> {
    const store = this.components.get(type);
    if (!store) return [];

    const result: Array<{ id: EntityId; component: T }> = [];
    for (const [id, component] of store) {
      if (this.alive.has(id)) {
        result.push({ id, component: component as T });
      }
    }

    return result;
  }

  /**
   * Query all entities that have multiple components.
   */
  queryAll<T extends Component[]>(
    types: ComponentType[]
  ): Array<{ id: EntityId; components: T }> {
    if (types.length === 0) return [];

    // Start with the smallest set for efficiency
    let smallest: Map<EntityId, Component> | undefined;
    let smallestSize = Infinity;

    for (const type of types) {
      const store = this.components.get(type);
      if (!store) return []; // If any component is missing, result is empty

      if (store.size < smallestSize) {
        smallest = store;
        smallestSize = store.size;
      }
    }

    if (!smallest) return [];

    const result: Array<{ id: EntityId; components: T }> = [];

    for (const id of smallest.keys()) {
      if (!this.alive.has(id)) continue;

      // Check if entity has all required components
      let hasAll = true;
      const components: Component[] = [];

      for (const type of types) {
        const component = this.components.get(type)?.get(id);
        if (!component) {
          hasAll = false;
          break;
        }
        components.push(component);
      }

      if (hasAll) {
        result.push({ id, components: components as unknown as T });
      }
    }

    return result;
  }

  /**
   * Query all entities with a specific tag.
   */
  queryTag(tag: string): EntityId[] {
    const tagSet = this.tags.get(tag);
    if (!tagSet) return [];

    return Array.from(tagSet).filter(id => this.alive.has(id));
  }

  /**
   * Get total number of alive entities.
   */
  get count(): number {
    return this.alive.size;
  }

  /**
   * Iterate over all alive entities.
   */
  forEach(callback: (id: EntityId) => void): void {
    for (const id of this.alive) {
      callback(id);
    }
  }

  /**
   * Clear all entities and components.
   */
  clear(): void {
    this.alive.clear();
    for (const store of this.components.values()) {
      store.clear();
    }
    for (const tagSet of this.tags.values()) {
      tagSet.clear();
    }
  }
}
