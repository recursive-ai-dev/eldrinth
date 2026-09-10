import { describe, it, expect } from 'vitest';
import { EntityRegistry } from './EntityRegistry';
import { EntityPool } from './EntityPool';
import type { TransformComponent, HealthComponent } from './components';

describe('EntityRegistry', () => {
  it('creates entities with unique IDs', () => {
    const registry = new EntityRegistry();
    const id1 = registry.create();
    const id2 = registry.create();
    const id3 = registry.create();

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(registry.count).toBe(3);
  });

  it('destroys entities and removes components', () => {
    const registry = new EntityRegistry();
    const id = registry.create();

    registry.addComponent(id, 'transform', { x: 10, y: 20, r: 8 });
    registry.addComponent(id, 'health', { hp: 100, maxHp: 100, invuln: 0 });

    expect(registry.hasComponent(id, 'transform')).toBe(true);
    expect(registry.hasComponent(id, 'health')).toBe(true);

    registry.destroy(id);

    expect(registry.isAlive(id)).toBe(false);
    expect(registry.hasComponent(id, 'transform')).toBe(false);
    expect(registry.hasComponent(id, 'health')).toBe(false);
  });

  it('queries entities by component type', () => {
    const registry = new EntityRegistry();
    const id1 = registry.create();
    const id2 = registry.create();
    const id3 = registry.create();

    registry.addComponent(id1, 'transform', { x: 0, y: 0, r: 8 });
    registry.addComponent(id1, 'health', { hp: 100, maxHp: 100, invuln: 0 });

    registry.addComponent(id2, 'transform', { x: 10, y: 10, r: 8 });

    registry.addComponent(id3, 'transform', { x: 20, y: 20, r: 8 });
    registry.addComponent(id3, 'health', { hp: 50, maxHp: 50, invuln: 0 });

    const withHealth = registry.query<HealthComponent>('health');
    expect(withHealth).toHaveLength(2);
    expect(withHealth.map(e => e.id)).toContain(id1);
    expect(withHealth.map(e => e.id)).toContain(id3);
  });

  it('queries entities with multiple components', () => {
    const registry = new EntityRegistry();
    const id1 = registry.create();
    const id2 = registry.create();

    registry.addComponent(id1, 'transform', { x: 0, y: 0, r: 8 });
    registry.addComponent(id1, 'health', { hp: 100, maxHp: 100, invuln: 0 });

    registry.addComponent(id2, 'transform', { x: 10, y: 10, r: 8 });

    const withBoth = registry.queryAll<[TransformComponent, HealthComponent]>([
      'transform',
      'health',
    ]);

    expect(withBoth).toHaveLength(1);
    expect(withBoth[0].id).toBe(id1);
  });

  it('supports tags for grouping entities', () => {
    const registry = new EntityRegistry();
    const id1 = registry.create();
    const id2 = registry.create();
    const id3 = registry.create();

    registry.addTag(id1, 'enemy');
    registry.addTag(id2, 'enemy');
    registry.addTag(id3, 'player');

    const enemies = registry.queryTag('enemy');
    expect(enemies).toHaveLength(2);
    expect(enemies).toContain(id1);
    expect(enemies).toContain(id2);
  });

  it('provides safe references that detect destroyed entities', () => {
    const registry = new EntityRegistry();
    const id = registry.create();
    const ref = registry.getRef(id);

    expect(ref).not.toBeNull();
    expect(registry.isValid(ref!)).toBe(true);

    registry.destroy(id);
    expect(registry.isValid(ref!)).toBe(false);
  });
});

describe('EntityPool', () => {
  it('pre-allocates entities and recycles them', () => {
    const registry = new EntityRegistry();
    const pool = new EntityPool(registry, { initialSize: 3, maxSize: 5 });

    expect(pool.availableCount).toBe(3);
    expect(pool.activeCount).toBe(0);

    const id1 = pool.acquire();
    pool.acquire();

    expect(pool.availableCount).toBe(1);
    expect(pool.activeCount).toBe(2);

    pool.release(id1!);
    expect(pool.availableCount).toBe(2);
    expect(pool.activeCount).toBe(1);

    const id3 = pool.acquire();
    expect(id3).toBe(id1); // recycled
    expect(pool.availableCount).toBe(1);
    expect(pool.activeCount).toBe(2);
  });

  it('creates new entities when initial pool is exhausted', () => {
    const registry = new EntityRegistry();
    const pool = new EntityPool(registry, { initialSize: 2, maxSize: 5 });

    const id1 = pool.acquire();
    const id2 = pool.acquire();
    const id3 = pool.acquire(); // should create new

    expect(id1).not.toBeNull();
    expect(id2).not.toBeNull();
    expect(id3).not.toBeNull();
    expect(pool.activeCount).toBe(3);
  });

  it('returns null when pool is fully exhausted', () => {
    const registry = new EntityRegistry();
    const pool = new EntityPool(registry, { initialSize: 2, maxSize: 2 });

    pool.acquire();
    pool.acquire();
    const id3 = pool.acquire();

    expect(id3).toBeNull();
    expect(pool.activeCount).toBe(2);
  });
});
