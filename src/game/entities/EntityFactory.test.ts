import { describe, it, expect, beforeEach } from 'vitest';
import { EntityRegistry } from './EntityRegistry';
import { EntityFactory } from './EntityFactory';
import { WRAITH_ARCHETYPE } from './archetypes';
import type { TransformComponent, HealthComponent, AIStateComponent } from './components';

describe('EntityFactory', () => {
  let registry: EntityRegistry;
  let factory: EntityFactory;

  beforeEach(() => {
    registry = new EntityRegistry();
    factory = new EntityFactory(registry);
  });

  it('spawns entities from archetype names', () => {
    const id = factory.spawn('wraith', 100, 200);

    expect(id).not.toBeNull();
    expect(registry.isAlive(id)).toBe(true);
    expect(registry.hasTag(id, 'enemy')).toBe(true);
    expect(registry.hasTag(id, 'actor')).toBe(true);
  });

  it('attaches components from archetypes', () => {
    const id = factory.spawn('wraith', 100, 200);

    const transform = registry.getComponent<TransformComponent>(id, 'transform');
    const health = registry.getComponent<HealthComponent>(id, 'health');
    const ai = registry.getComponent<AIStateComponent>(id, 'aiState');

    expect(transform).toBeDefined();
    expect(transform?.x).toBe(100);
    expect(transform?.y).toBe(200);
    expect(transform?.r).toBe(13); // wraith radius

    expect(health).toBeDefined();
    expect(health?.hp).toBe(3);
    expect(health?.maxHp).toBe(3);

    expect(ai).toBeDefined();
    expect(ai?.behaviorType).toBe('wraith');
  });

  it('spawns entities from archetype objects', () => {
    const id = factory.spawnFromArchetype(WRAITH_ARCHETYPE, 50, 75);

    expect(registry.isAlive(id)).toBe(true);
    const transform = registry.getComponent<TransformComponent>(id, 'transform');
    expect(transform?.x).toBe(50);
    expect(transform?.y).toBe(75);
  });

  it('applies component overrides', () => {
    const id = factory.spawn('wraith', 100, 200, {
      health: { hp: 10, maxHp: 10 },
    });

    const health = registry.getComponent<HealthComponent>(id, 'health');
    expect(health?.hp).toBe(10);
    expect(health?.maxHp).toBe(10);
  });

  it('spawns boss with correct multi-phase cooldowns', () => {
    const id = factory.spawn('boss', 500, 500);

    const ai = registry.getComponent<AIStateComponent>(id, 'aiState');
    expect(ai?.behaviorType).toBe('boss');
    expect(ai?.cooldowns.burstCd).toBe(2.2);
    expect(ai?.cooldowns.lungeCd).toBe(3.5);
    expect(ai?.cooldowns.summonCd).toBe(6.5);

    expect(registry.hasTag(id, 'boss')).toBe(true);
  });

  it('spawns projectiles using the pool', () => {
    const id1 = factory.spawnProjectile(100, 100, 50, 0, 2.0, 1, null);
    const id2 = factory.spawnProjectile(200, 200, 0, 50, 2.0, 1, null);

    expect(id1).not.toBeNull();
    expect(id2).not.toBeNull();
    expect(registry.isAlive(id1!)).toBe(true);
    expect(registry.isAlive(id2!)).toBe(true);

    const stats = factory.poolStats;
    expect(stats.projectiles.active).toBe(2);
  });

  it('despawns entities and returns projectiles to pool', () => {
    const enemyId = factory.spawn('wraith', 100, 200);
    const projId = factory.spawnProjectile(100, 100, 50, 0, 2.0, 1, null);

    expect(registry.isAlive(enemyId)).toBe(true);
    expect(registry.isAlive(projId!)).toBe(true);

    factory.despawn(enemyId);
    expect(registry.isAlive(enemyId)).toBe(false);

    factory.despawn(projId!);
    // Pooled entities remain alive in registry but are released back to pool
    expect(factory.poolStats.projectiles.active).toBe(0);
    expect(factory.poolStats.projectiles.available).toBeGreaterThan(0);
  });

  it('queries all enemies by tag', () => {
    factory.spawn('wraith', 100, 100);
    factory.spawn('wraith', 200, 200);
    factory.spawn('sentinel', 300, 300);
    factory.spawn('player', 50, 50);

    const enemies = registry.queryTag('enemy');
    expect(enemies).toHaveLength(3);
  });

  it('queries entities with health and transform components', () => {
    factory.spawn('wraith', 100, 100);
    factory.spawn('wraith', 200, 200);
    factory.spawnProjectile(300, 300, 10, 0, 2.0, 1, null);

    const withHealthAndTransform = registry.queryAll<[HealthComponent, TransformComponent]>([
      'health',
      'transform',
    ]);

    // Only wraiths have both health and transform (projectiles don't have health)
    expect(withHealthAndTransform).toHaveLength(2);
  });

  it('throws error for unknown archetype', () => {
    expect(() => factory.spawn('unknown_enemy', 100, 100)).toThrow('Unknown archetype: unknown_enemy');
  });
});
