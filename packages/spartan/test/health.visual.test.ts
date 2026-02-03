/**
 * Visual tests for HealthSystem.
 *
 * Tests the intent-based damage/healing system:
 * - Damage processing with armor/shields
 * - Death state transitions (alive → dying → dead)
 * - Entity removal after death
 * - Shield regeneration
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialSystem } from '../core/spatial-system';
import { SparseEntityStore } from '../core/entity-store';
import { LinkedGrid } from '../core/grid/linked-grid';
import { GameLoop } from '../core/game-loop';
import { HealthSystem } from '../systems/health.system';
import { GameLayers } from '../config/layers.config';

describe('HealthSystem', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let healthSystem: HealthSystem;

  beforeEach(() => {
    grid = new LinkedGrid(10, 10);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    gameLoop = new GameLoop(spatial);
    healthSystem = new HealthSystem({ dyingDuration: 2 });
    gameLoop.addSystem(healthSystem);
  });

  it('damage: reduces HP correctly', () => {
    const entityId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });
    spatial.commit();

    healthSystem.damage(entityId, 25);
    gameLoop.tick();

    const data = spatial.getEntityData(entityId);
    expect(data?.hp).toBe(75);
  });

  it('damage: armor reduces damage (minimum 1)', () => {
    const entityId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      armor: 10,
    });
    spatial.commit();

    // 5 damage - 10 armor = 1 minimum
    healthSystem.damage(entityId, 5);
    gameLoop.tick();

    const data = spatial.getEntityData(entityId);
    expect(data?.hp).toBe(99); // Only 1 damage taken
  });

  it('damage: shield absorbs damage first', () => {
    const entityId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      shield: 30,
      maxShield: 30,
    });
    spatial.commit();

    // 50 damage: 30 absorbed by shield, 20 to HP
    healthSystem.damage(entityId, 50);
    gameLoop.tick();

    const data = spatial.getEntityData(entityId);
    expect(data?.shield).toBe(0);
    expect(data?.hp).toBe(80);
  });

  it('heal: restores HP up to maxHp', () => {
    const entityId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 50,
      maxHp: 100,
      healthState: 'alive',
    });
    spatial.commit();

    healthSystem.heal(entityId, 30);
    gameLoop.tick();

    const data = spatial.getEntityData(entityId);
    expect(data?.hp).toBe(80);
  });

  it('heal: does not exceed maxHp', () => {
    const entityId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 90,
      maxHp: 100,
      healthState: 'alive',
    });
    spatial.commit();

    healthSystem.heal(entityId, 50);
    gameLoop.tick();

    const data = spatial.getEntityData(entityId);
    expect(data?.hp).toBe(100);
  });

  it('death: entity transitions alive → dying → removed', () => {
    const entityId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 10,
      maxHp: 100,
      healthState: 'alive',
    });
    spatial.commit();

    // Fatal damage - damage applied and dyingTicks decremented in same tick
    healthSystem.damage(entityId, 100);
    gameLoop.tick();

    // Should be dying (dyingTicks was set to 2, then decremented to 1)
    let data = spatial.getEntityData(entityId);
    expect(data?.healthState).toBe('dying');
    expect((data as { dyingTicks?: number }).dyingTicks).toBe(1);
    expect(spatial.isAlive(entityId)).toBe(true);

    // Tick 2 of dying → dead → removed (all in one tick)
    // When dyingTicks reaches 0, it transitions to dead and is removed
    gameLoop.tick();
    
    // Entity should now be removed
    expect(spatial.isAlive(entityId)).toBe(false);
  });

  it('death: dead entities are removed from spatial', () => {
    const entityId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 10,
      maxHp: 100,
      healthState: 'alive',
    });
    spatial.commit();

    // Fatal damage
    healthSystem.damage(entityId, 100);

    // Tick through dying and dead states
    gameLoop.tick(); // → dying
    gameLoop.tick(); // dyingTicks: 1
    gameLoop.tick(); // → dead
    gameLoop.tick(); // → removed

    // Entity should be gone
    expect(spatial.isAlive(entityId)).toBe(false);
    expect(spatial.getEntityPosition(entityId)).toBeNull();
  });

  it('shield regen: regenerates after delay', () => {
    const entityId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      shield: 50,
      maxShield: 50,
      shieldRegenRate: 5,
      shieldRegenDelay: 2,
    });
    spatial.commit();

    // Take shield damage
    healthSystem.damage(entityId, 20);
    gameLoop.tick(); // tick 1: damage applied, shield = 30

    let data = spatial.getEntityData(entityId);
    expect(data?.shield).toBe(30);

    // Regen delay not met yet
    gameLoop.tick(); // tick 2
    data = spatial.getEntityData(entityId);
    expect(data?.shield).toBe(30); // No regen yet

    // Delay met, should start regenerating
    gameLoop.tick(); // tick 3
    data = spatial.getEntityData(entityId);
    expect(data?.shield).toBe(35); // Regenerated 5

    gameLoop.tick(); // tick 4
    data = spatial.getEntityData(entityId);
    expect(data?.shield).toBe(40); // Regenerated 5 more
  });

  it('resistance: reduces damage by percentage', () => {
    const entityId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      resistance: 0.5, // 50% damage reduction
    });
    spatial.commit();

    healthSystem.damage(entityId, 40);
    gameLoop.tick();

    const data = spatial.getEntityData(entityId);
    expect(data?.hp).toBe(80); // 40 * 0.5 = 20 damage
  });

  it('no damage to dying entities', () => {
    // Use longer dying duration so we can test damage during dying state
    const longDyingSystem = new HealthSystem({ dyingDuration: 5 });
    const testLoop = new GameLoop(spatial);
    testLoop.addSystem(longDyingSystem);

    const entityId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 10,
      maxHp: 100,
      healthState: 'alive',
    });
    spatial.commit();

    // Kill entity
    longDyingSystem.damage(entityId, 100);
    testLoop.tick();

    // Entity should be dying with HP at 0
    let data = spatial.getEntityData(entityId);
    expect(data?.healthState).toBe('dying');
    expect(data?.hp).toBeLessThanOrEqual(0);

    // Try to damage while dying - should have no effect
    longDyingSystem.damage(entityId, 50);
    testLoop.tick();

    // Entity should still be dying (no new damage applied)
    data = spatial.getEntityData(entityId);
    expect(data?.healthState).toBe('dying');
    expect(spatial.isAlive(entityId)).toBe(true);
  });
});
