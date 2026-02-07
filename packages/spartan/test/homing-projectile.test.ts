/**
 * Tests for Homing Projectiles.
 *
 * Tests homing projectile mechanics:
 * - Projectile tracks moving target
 * - Projectile continues straight when target dies
 * - homingStrength controls turn rate
 * - Homing with piercing behavior
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialSystem } from '../core/spatial-system';
import { SparseEntityStore } from '../core/entity-store';
import { LinkedGrid } from '../core/grid/linked-grid';
import { GameLoop } from '../core/game-loop';
import { GameManager } from '../core/game-manager';
import { GameState } from '../core/game-state';
import { SceneManager } from '../core/scene-manager';
import { HealthSystem } from '../systems/health.system';
import { ProjectileSystem } from '../systems/projectile.system';
import { GameLayers } from '../config/layers.config';
import type { GameContext } from '../core/types';

describe('Homing Projectiles', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let healthSystem: HealthSystem;
  let projectileSystem: ProjectileSystem;

  /** Helper to build a minimal GameContext for spawning projectiles before ticking */
  function makeContext(): GameContext {
    return {
      tick: 0,
      overlaps: [],
      spatial: spatial as unknown as GameContext['spatial'],
      freeBody: gameLoop.freeBody,
    };
  }

  beforeEach(() => {
    grid = new LinkedGrid(20, 20);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    gameLoop = new GameLoop(spatial);

    const gameState = new GameState();
    const sceneManager = new SceneManager(gameState);
    gameManager = new GameManager(gameState, sceneManager);

    healthSystem = new HealthSystem({ dyingDuration: 0 });
    projectileSystem = new ProjectileSystem(healthSystem);

    gameLoop.addSystem(projectileSystem);
    gameLoop.addSystem(healthSystem);
  });

  it('homing projectile tracks a moving target', () => {
    // Arrange: target at (10, 5), projectile aimed at (10, 5) with homing
    const targetId = spatial.spawn('enemy', 10, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      team: 'enemy',
    });
    spatial.commit();

    const projId = projectileSystem.spawnProjectile(
      makeContext(), 0, 5, 10, 5, 25, {
      speed: 2,
      lifetime: 50,
      homing: true,
      homingStrength: 1.0,
      homingTargetId: targetId,
    }
    );

    // Act: advance 1 tick so velocity initializes and projectile moves
    gameLoop.tick();

    // Now move the target to a new position
    spatial.move(targetId, 10, 10);
    spatial.commit();

    // Advance another tick -- homing should recalculate velocity toward (10, 10)
    gameLoop.tick();

    const projData = store.getData(projId);

    // Projectile should still be alive and have updated targetY toward 10
    if (projData) {
      expect(projData.targetY).toBe(10);
    }
  });

  it('homing projectile hits a target', () => {
    // Arrange: stationary target at (8, 5), projectile with homing
    const targetId = spatial.spawn('enemy', 8, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      team: 'enemy',
    });
    spatial.commit();

    projectileSystem.spawnProjectile(
      makeContext(), 0, 5, 8, 5, 50, {
      speed: 2,
      lifetime: 50,
      homing: true,
      homingStrength: 1.0,
      homingTargetId: targetId,
    }
    );

    // Act: advance several ticks until projectile reaches target
    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
    }

    // Assert: target should have taken damage
    const targetData = store.getData(targetId);
    expect(targetData).toBeDefined();
    if (targetData && 'hp' in targetData) {
      expect(targetData.hp).toBeLessThan(100);
    }
  });

  it('homing projectile continues straight when target dies', () => {
    // Arrange: fragile target at (5, 5)
    const targetId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 1,
      maxHp: 1,
      healthState: 'alive',
      team: 'enemy',
    });
    spatial.commit();

    const projId = projectileSystem.spawnProjectile(
      makeContext(), 0, 5, 5, 5, 50, {
      speed: 1,
      lifetime: 50,
      homing: true,
      homingStrength: 1.0,
      homingTargetId: targetId,
      piercing: true,
      maxPierces: 5,
    }
    );

    // Act: advance until projectile kills the target and passes through
    // With speed 1, it takes 5 ticks to reach the target, plus system delay
    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
    }

    // Assert: target should be dead (removed since dyingDuration=0) and projectile should no longer be homing.
    const targetData = store.getData(targetId);
    expect(targetData).toBeUndefined();

    const projData = store.getData(projId);
    expect(projData?.homingTargetId).toBeUndefined();

  });

  it('partial homingStrength blends toward target', () => {
    // Arrange: target at (15, 15), projectile aimed at (15, 0) with partial homing
    const targetId = spatial.spawn('enemy', 15, 15, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      team: 'enemy',
    });
    spatial.commit();

    const projId = projectileSystem.spawnProjectile(
      makeContext(), 0, 0, 15, 0, 25, {
      speed: 1,
      lifetime: 50,
      homing: true,
      homingStrength: 0.5,
      homingTargetId: targetId,
    }
    );

    // Act: advance a few ticks
    for (let i = 0; i < 3; i++) {
      gameLoop.tick();
    }

    // Assert: projectile target should have partially shifted toward (15, 15)
    const projData = store.getData(projId);
    if (projData && 'targetY' in projData) {
      // With strength 0.5, targetY should be between 0 and 15 (partially adjusted)
      const targetY = projData.targetY as number;
      expect(targetY).toBeGreaterThan(0);
      expect(targetY).toBeLessThanOrEqual(15);
    }
  });

  it('non-homing projectile ignores homing fields when homing is false', () => {
    // Arrange: projectile with homingTargetId but homing=false
    const targetId = spatial.spawn('enemy', 10, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      team: 'enemy',
    });
    spatial.commit();

    const projId = projectileSystem.spawnProjectile(
      makeContext(), 0, 5, 19, 5, 25, {
      speed: 2,
      lifetime: 50,
      homing: false,
      homingTargetId: targetId,
    }
    );

    // Act
    gameLoop.tick();

    // Assert: target should not have changed (projectile aimed at (19,5) not (10,10))
    const projData = store.getData(projId);
    if (projData && 'targetY' in projData) {
      expect(projData.targetY).toBe(5);
    }
  });
});
