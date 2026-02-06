/**
 * ObjectiveSystem Tests
 *
 * Tests for game objective tracking: collect-flag, kill-all, reach-exit.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LinkedGrid, SpatialSystem } from '../core';
import { SparseEntityStore } from '../core/entity-store';
import { GameManager } from '../core/game-manager';
import { SceneManager } from '../core/scene-manager';
import { GameLoop } from '../core/game-loop';
import { HealthSystem } from '../systems/health.system';
import { ObjectiveSystem } from '../systems/objective.system';
import { GameLayers } from '../config/layers.config';
import type { ObjectiveDefinition } from '../traits/objective.trait';

describe('ObjectiveSystem', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let healthSystem: HealthSystem;
  let objectiveSystem: ObjectiveSystem;

  function setup(objectives: Omit<ObjectiveDefinition, 'completed'>[] = []) {
    grid = new LinkedGrid(10, 10);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    gameManager = new GameManager();

    // Create a scene and set it active
    gameManager.sceneManager.createScene('test-scene', 10, 10);
    gameManager.sceneManager.setActiveScene('test-scene');

    // Override the scene's spatial with our test spatial
    const scene = gameManager.sceneManager.getActiveScene()!;
    Object.defineProperty(scene, 'spatial', { value: spatial, writable: true });

    // Set objectives
    gameManager.gameState.objectives = objectives.map((o) => ({
      ...o,
      completed: false,
    }));

    healthSystem = new HealthSystem({ dyingDuration: 1 });
    objectiveSystem = new ObjectiveSystem(gameManager, healthSystem);
    gameLoop = new GameLoop(spatial, gameManager);
    gameLoop.addSystem(healthSystem);
    gameLoop.addSystem(objectiveSystem);
  }

  function createPlayer(x: number, y: number): number {
    const id = spatial.spawn('player', x, y, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      healthState: 'alive',
      inventory: [],
    });
    spatial.commit();
    gameManager.gameState.playerEntityId = id;
    return id;
  }

  function createEnemy(x: number, y: number): number {
    const id = spatial.spawn('enemy', x, y, GameLayers.ACTORS, {
      hp: 10,
      maxHp: 10,
      damage: 5,
      healthState: 'alive',
      aiState: 'idle',
    });
    spatial.commit();
    return id;
  }

  function createFlag(x: number, y: number, objectiveId: string): number {
    const id = spatial.spawn('flag', x, y, GameLayers.COLLECTIBLES, {
      objectiveId,
      collectibleId: 'flag',
      color: '#ff0000',
    });
    spatial.commit();
    return id;
  }

  function createExit(x: number, y: number): number {
    const id = spatial.spawn('exit', x, y, GameLayers.FLOOR, {
      color: '#00ff00',
    });
    spatial.commit();
    return id;
  }

  // === Collect-Flag Objective Tests ===

  describe('collect-flag', () => {
    it('should not complete until all flags are collected', () => {
      setup([{ id: 'get-flags', type: 'collect-flag', sceneId: 'test-scene', targetId: 'red-flag' }]);
      createPlayer(1, 1);
      createFlag(3, 3, 'red-flag');
      createFlag(5, 5, 'red-flag');

      gameLoop.tick();

      expect(objectiveSystem.isObjectiveComplete('get-flags')).toBe(false);
    });

    it('should complete when all matching flags are removed', () => {
      setup([{ id: 'get-flags', type: 'collect-flag', sceneId: 'test-scene', targetId: 'red-flag' }]);
      createPlayer(1, 1);
      const flag1 = createFlag(3, 3, 'red-flag');
      const flag2 = createFlag(5, 5, 'red-flag');

      // Remove both flags (simulating collection)
      spatial.remove(flag1);
      spatial.remove(flag2);
      spatial.commit();

      gameLoop.tick();

      expect(objectiveSystem.isObjectiveComplete('get-flags')).toBe(true);
    });

    it('should not complete flags from different objectiveId', () => {
      setup([{ id: 'get-red', type: 'collect-flag', sceneId: 'test-scene', targetId: 'red-flag' }]);
      createPlayer(1, 1);
      createFlag(3, 3, 'red-flag');
      const blueFlag = createFlag(5, 5, 'blue-flag');

      // Remove only the blue flag
      spatial.remove(blueFlag);
      spatial.commit();

      gameLoop.tick();

      expect(objectiveSystem.isObjectiveComplete('get-red')).toBe(false);
    });
  });

  // === Kill-All Objective Tests ===

  describe('kill-all', () => {
    it('should not complete while enemies remain alive', () => {
      setup([{ id: 'clear', type: 'kill-all', sceneId: 'test-scene' }]);
      const playerId = createPlayer(1, 1);
      createEnemy(3, 3);
      createEnemy(5, 5);

      gameLoop.tick();

      expect(objectiveSystem.isObjectiveComplete('clear')).toBe(false);
    });

    it('should complete when all enemies are dead and removed', () => {
      setup([{ id: 'clear', type: 'kill-all', sceneId: 'test-scene' }]);
      const playerId = createPlayer(1, 1);
      const enemy1 = createEnemy(3, 3);
      const enemy2 = createEnemy(5, 5);

      // Kill both enemies
      healthSystem.damage(enemy1, 100, undefined, playerId);
      healthSystem.damage(enemy2, 100, undefined, playerId);
      gameLoop.tick(); // dying
      gameLoop.tick(); // dead + removed

      // Need one more tick for objective to check (entities removed by now)
      gameLoop.tick();

      expect(objectiveSystem.isObjectiveComplete('clear')).toBe(true);
    });

    it('should not complete if only some enemies are dead', () => {
      setup([{ id: 'clear', type: 'kill-all', sceneId: 'test-scene' }]);
      const playerId = createPlayer(1, 1);
      const enemy1 = createEnemy(3, 3);
      createEnemy(5, 5); // this one stays alive

      // Kill only first enemy
      healthSystem.damage(enemy1, 100, undefined, playerId);
      gameLoop.tick();
      gameLoop.tick();
      gameLoop.tick();

      expect(objectiveSystem.isObjectiveComplete('clear')).toBe(false);
    });
  });

  // === Reach-Exit Objective Tests ===

  describe('reach-exit', () => {
    it('should not complete when player is not on exit', () => {
      setup([{ id: 'escape', type: 'reach-exit', sceneId: 'test-scene' }]);
      createPlayer(1, 1);
      createExit(8, 8);

      gameLoop.tick();

      expect(objectiveSystem.isObjectiveComplete('escape')).toBe(false);
    });

    it('should complete when player overlaps exit', () => {
      setup([{ id: 'escape', type: 'reach-exit', sceneId: 'test-scene' }]);
      createPlayer(5, 5);
      createExit(5, 5); // same position as player

      gameLoop.tick();

      expect(objectiveSystem.isObjectiveComplete('escape')).toBe(true);
    });
  });

  // === Scene Completion Tests ===

  describe('scene completion', () => {
    it('should fire onSceneComplete when all scene objectives done', () => {
      const onSceneComplete = vi.fn();
      setup([
        { id: 'clear', type: 'kill-all', sceneId: 'test-scene' },
        { id: 'escape', type: 'reach-exit', sceneId: 'test-scene' },
      ]);

      // Swap objectiveSystem with one that has callback
      objectiveSystem = new ObjectiveSystem(gameManager, healthSystem, {
        onSceneComplete,
      });
      gameLoop = new GameLoop(spatial, gameManager);
      gameLoop.addSystem(healthSystem);
      gameLoop.addSystem(objectiveSystem);

      const playerId = createPlayer(5, 5);
      const enemyId = createEnemy(3, 3);
      createExit(5, 5); // player already on exit

      // Kill enemy
      healthSystem.damage(enemyId, 100, undefined, playerId);
      gameLoop.tick(); // dying
      gameLoop.tick(); // dead + removed

      // Now tick to check objectives - reach-exit already done, kill-all after removal
      gameLoop.tick();

      expect(onSceneComplete).toHaveBeenCalledWith('test-scene');
    });

    it('should fire onAllComplete when all objectives in game are done', () => {
      const onAllComplete = vi.fn();
      setup([{ id: 'escape', type: 'reach-exit', sceneId: 'test-scene' }]);

      objectiveSystem = new ObjectiveSystem(gameManager, healthSystem, {
        onAllComplete,
      });
      gameLoop = new GameLoop(spatial, gameManager);
      gameLoop.addSystem(healthSystem);
      gameLoop.addSystem(objectiveSystem);

      createPlayer(5, 5);
      createExit(5, 5);

      gameLoop.tick();

      expect(onAllComplete).toHaveBeenCalled();
    });
  });

  // === Query API Tests ===

  describe('query API', () => {
    it('should return correct objective status', () => {
      setup([
        { id: 'clear', type: 'kill-all', sceneId: 'test-scene' },
        { id: 'escape', type: 'reach-exit', sceneId: 'test-scene' },
      ]);
      createPlayer(5, 5);
      createExit(5, 5);

      // Before ticking - no objectives complete
      expect(objectiveSystem.getObjectiveStatus()).toEqual({
        total: 2,
        completed: 0,
        remaining: 2,
      });

      gameLoop.tick(); // reach-exit should complete (player on exit, but still enemies... wait no enemies)

      // Both should complete - no enemies means kill-all is done, player on exit
      const status = objectiveSystem.getObjectiveStatus();
      expect(status.total).toBe(2);
      expect(status.completed).toBe(2);
      expect(status.remaining).toBe(0);
    });
  });
});
