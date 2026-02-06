/**
 * ObjectiveSystem Tests
 *
 * Tests for game objective tracking: collect-flag, kill-all, reach-exit.
 * Includes integration tests for flag pickup via CollectionSystem and
 * exit activation gating.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LinkedGrid, SpatialSystem } from '../core';
import { SparseEntityStore } from '../core/entity-store';
import { GameManager } from '../core/game-manager';
import { SceneManager } from '../core/scene-manager';
import { GameLoop } from '../core/game-loop';
import { HealthSystem } from '../systems/health.system';
import { ObjectiveSystem } from '../systems/objective.system';
import { CollectionSystem } from '../systems/collection.system';
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

    // Share entity store between spatial system and gameManager
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (gameManager.gameState as any).entityStore = store;

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

    it('should complete when player overlaps exit (no prerequisites)', () => {
      setup([{ id: 'escape', type: 'reach-exit', sceneId: 'test-scene' }]);
      createPlayer(5, 5);
      createExit(5, 5); // same position as player

      gameLoop.tick();

      expect(objectiveSystem.isObjectiveComplete('escape')).toBe(true);
    });

    it('should NOT complete when player is on exit but prerequisites unmet', () => {
      setup([
        { id: 'get-flags', type: 'collect-flag', sceneId: 'test-scene', targetId: 'red-flag' },
        { id: 'escape', type: 'reach-exit', sceneId: 'test-scene' },
      ]);
      createPlayer(5, 5);
      createExit(5, 5); // player already on exit
      createFlag(8, 8, 'red-flag'); // flag not collected

      gameLoop.tick();

      // reach-exit should NOT complete because collect-flag is not done
      expect(objectiveSystem.isObjectiveComplete('get-flags')).toBe(false);
      expect(objectiveSystem.isObjectiveComplete('escape')).toBe(false);
    });

    it('should set exit activated=true when prerequisites are met', () => {
      setup([
        { id: 'get-flags', type: 'collect-flag', sceneId: 'test-scene', targetId: 'red-flag' },
        { id: 'escape', type: 'reach-exit', sceneId: 'test-scene' },
      ]);
      createPlayer(1, 1);
      const exitId = createExit(9, 9);
      const flagId = createFlag(5, 5, 'red-flag');

      // Before collecting flag, exit should not be activated
      gameLoop.tick();
      let exitData = spatial.getEntityData(exitId);
      expect(exitData?.activated).toBeFalsy();

      // Collect flag (simulate by removing)
      spatial.remove(flagId);
      spatial.commit();
      gameLoop.tick();

      // Exit should now be activated
      exitData = spatial.getEntityData(exitId);
      expect(exitData?.activated).toBe(true);
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

    it('isExitActive should return false when prerequisites unmet', () => {
      setup([
        { id: 'get-flags', type: 'collect-flag', sceneId: 'test-scene', targetId: 'red-flag' },
        { id: 'escape', type: 'reach-exit', sceneId: 'test-scene' },
      ]);
      createPlayer(1, 1);
      createFlag(5, 5, 'red-flag');

      expect(objectiveSystem.isExitActive('test-scene')).toBe(false);
    });

    it('isExitActive should return true when prerequisites met', () => {
      setup([
        { id: 'get-flags', type: 'collect-flag', sceneId: 'test-scene', targetId: 'red-flag' },
        { id: 'escape', type: 'reach-exit', sceneId: 'test-scene' },
      ]);
      createPlayer(1, 1);
      const flagId = createFlag(5, 5, 'red-flag');

      // Collect flag
      spatial.remove(flagId);
      spatial.commit();
      gameLoop.tick();

      expect(objectiveSystem.isExitActive('test-scene')).toBe(true);
    });
  });

  // === Integration: Flag Pickup via CollectionSystem ===

  describe('integration: flag pickup + exit gating', () => {
    let collectionSystem: CollectionSystem;

    function setupIntegration(objectives: Omit<ObjectiveDefinition, 'completed'>[] = []) {
      grid = new LinkedGrid(10, 10);
      store = new SparseEntityStore();
      spatial = new SpatialSystem(grid, store);
      gameManager = new GameManager();

      // Share entity store between spatial system and gameManager
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (gameManager.gameState as any).entityStore = store;

      gameManager.sceneManager.createScene('test-scene', 10, 10);
      gameManager.sceneManager.setActiveScene('test-scene');

      const scene = gameManager.sceneManager.getActiveScene()!;
      Object.defineProperty(scene, 'spatial', { value: spatial, writable: true });

      gameManager.gameState.objectives = objectives.map((o) => ({
        ...o,
        completed: false,
      }));

      healthSystem = new HealthSystem({ dyingDuration: 1 });
      collectionSystem = new CollectionSystem(gameManager);
      objectiveSystem = new ObjectiveSystem(gameManager, healthSystem);
      gameLoop = new GameLoop(spatial, gameManager);
      gameLoop.addSystem(healthSystem);
      gameLoop.addSystem(collectionSystem);
      gameLoop.addSystem(objectiveSystem);
    }

    it('should collect flags via CollectionSystem (isCollectible fix)', () => {
      setupIntegration([
        { id: 'get-flags', type: 'collect-flag', sceneId: 'test-scene', targetId: 'red-flag' },
      ]);

      // Player and flag at same position
      const playerId = createPlayer(5, 5);
      createFlag(5, 5, 'red-flag');

      // Tick: overlap detected, CollectionSystem picks up flag
      gameLoop.tick();

      // Flag should be added to player inventory
      const playerData = spatial.getEntityData(playerId);
      expect(playerData?.inventory).toContain('flag');

      // After commit removes the flag, next tick should detect objective complete
      gameLoop.tick();
      expect(objectiveSystem.isObjectiveComplete('get-flags')).toBe(true);
    });

    it('full flow: player walks to inactive exit, picks up flag, returns to active exit', () => {
      const onObjectiveComplete = vi.fn();
      const onSceneComplete = vi.fn();

      setupIntegration([
        { id: 'get-flags', type: 'collect-flag', sceneId: 'test-scene', targetId: 'red-flag' },
        { id: 'escape', type: 'reach-exit', sceneId: 'test-scene' },
      ]);

      // Re-create with callbacks
      objectiveSystem = new ObjectiveSystem(gameManager, healthSystem, {
        onObjectiveComplete,
        onSceneComplete,
      });
      gameLoop = new GameLoop(spatial, gameManager);
      gameLoop.addSystem(healthSystem);
      gameLoop.addSystem(collectionSystem);
      gameLoop.addSystem(objectiveSystem);

      // Layout: player at (1,1), exit at (3,1), flag at (5,1)
      const playerId = createPlayer(1, 1);
      const exitId = createExit(3, 1);
      createFlag(5, 1, 'red-flag');

      // Step 1: Move player to exit (3,1)
      spatial.move(playerId, 3, 1);
      spatial.commit();
      gameLoop.tick();

      // Exit should be inactive, reach-exit NOT complete
      let exitData = spatial.getEntityData(exitId);
      expect(exitData?.activated).toBeFalsy();
      expect(objectiveSystem.isObjectiveComplete('escape')).toBe(false);

      // Step 2: Move player past exit to flag (5,1)
      spatial.move(playerId, 5, 1);
      spatial.commit();
      gameLoop.tick();

      // Player should pick up flag (overlap detected)
      const playerData = spatial.getEntityData(playerId);
      expect(playerData?.inventory).toContain('flag');

      // Step 3: Tick again so flag removal is committed and objective checks
      gameLoop.tick();
      expect(objectiveSystem.isObjectiveComplete('get-flags')).toBe(true);
      expect(onObjectiveComplete).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'get-flags', completed: true })
      );

      // Exit should now be activated
      exitData = spatial.getEntityData(exitId);
      expect(exitData?.activated).toBe(true);

      // Step 4: Move player back to exit (3,1)
      spatial.move(playerId, 3, 1);
      spatial.commit();
      gameLoop.tick();

      // reach-exit should now complete (prerequisites met + player on exit)
      expect(objectiveSystem.isObjectiveComplete('escape')).toBe(true);
      expect(onSceneComplete).toHaveBeenCalledWith('test-scene');
    });
  });
});
