/**
 * Tests for RespawnSystem.
 *
 * Tests respawn mechanics:
 * - Checkpoint activation
 * - Player respawn at checkpoint
 * - Default respawn at player-start
 * - Life tracking
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpatialSystem } from '../core/spatial-system';
import { GameLoop } from '../core/game-loop';
import { GameManager } from '../core/game-manager';
import { HealthSystem } from '../systems/health.system';
import { RespawnSystem } from '../systems/respawn.system';
import { isPlayer, hasHealth } from '../traits/trait-guards';
import { GameLayers } from '../config/layers.config';

describe('RespawnSystem', () => {
  // let grid: LinkedGrid;
  // let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let healthSystem: HealthSystem;
  let respawnSystem: RespawnSystem;

  beforeEach(() => {
    // Create GameManager (it creates its own GameState and SceneManager)
    gameManager = new GameManager();

    // Create a scene for testing
    gameManager.sceneManager.createScene('test-scene', 10, 10);
    gameManager.sceneManager.setActiveScene('test-scene');

    // Get the scene's spatial system
    const scene = gameManager.sceneManager.getScene('test-scene')!;
    spatial = scene.spatial;
    // grid = scene.grid;
    // store = gameManager.gameState.entityStore;

    // Pass gameManager to GameLoop so context.gameManager is available
    gameLoop = new GameLoop(spatial, gameManager);

    healthSystem = new HealthSystem({ dyingDuration: 2 });
    respawnSystem = new RespawnSystem(gameManager, {
      respawnDelay: 1,
      maxLives: 3,
    });

    gameLoop.addSystem(healthSystem);
    gameLoop.addSystem(respawnSystem);
  });

  it('activates checkpoint when player overlaps', () => {
    // Arrange: Player at (5,5), checkpoint at (5,5)
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      damage: 10,
      sceneId: 'test-scene',
      inventory: [],
      pushStrength: 1,
    });

    const checkpointId = spatial.spawn('checkpoint', 5, 5, GameLayers.FLOOR, {
      activated: false,
      sceneId: 'test-scene',
      color: '#00ff00',
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Act: Run system
    gameLoop.tick();

    // Assert: Checkpoint is activated
    const checkpointData = spatial.getEntityData(checkpointId);
    expect(checkpointData?.activated).toBe(true);

    // Assert: Player has checkpoint tracked
    const playerData = spatial.getEntityData(playerId);
    // Use type assertion to PlayerData since we spawned it as 'player'
    // or assume EntityData access via index signature is checked
    // Better: use isPlayer guard if available, or just assert specific properties exist
    // Since we updated PlayerData type, we can cast to PlayerData safely if we know it is one.
    // Or we can rely on BaseEntityData index signature + specific check
    // But since we updated PlayerData, let's use isPlayer guard.
    if (playerData && isPlayer(playerData)) {
      expect(playerData.lastCheckpointId).toBe(checkpointId);
    } else {
      throw new Error('Player data not found or invalid type');
    }
  });

  it('respawns player at checkpoint after death', () => {
    // Arrange: Player at (2,2) with checkpoint data
    const playerId = spatial.spawn('player', 2, 2, GameLayers.ACTORS, {
      hp: 10,
      maxHp: 100,
      healthState: 'alive',
      damage: 10,
      sceneId: 'test-scene',
      inventory: [],
      pushStrength: 1,
      // Checkpoint data directly on player
      lastCheckpointId: 999,
      lastCheckpointSceneId: 'test-scene',
      lastCheckpointX: 8,
      lastCheckpointY: 8,
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Verify checkpoint data is on player
    const preData = spatial.getEntityData(playerId);
    if (preData && isPlayer(preData)) {
      expect(preData.lastCheckpointSceneId).toBe('test-scene');
    } else {
      throw new Error('Player data not found');
    }

    // Kill the player
    healthSystem.damage(playerId, 100);
    gameLoop.tick(); // tick 1: dying, dyingTicks 2 -> 1

    // Verify player is dying
    let midData = spatial.getEntityData(playerId);
    if (midData && hasHealth(midData)) {
      expect(midData.healthState).toBe('dying');
    } else {
      throw new Error('Player data likely removed or invalid');
    }

    gameLoop.tick(); // tick 2: dying, dyingTicks 1 -> dead, respawn scheduled

    // Verify player is dead
    midData = spatial.getEntityData(playerId);
    // Note: player may be removed by HealthSystem by now

    gameLoop.tick(); // tick 3: respawn executes

    // Assert: Player respawned at checkpoint location
    const newPos = spatial.getEntityPosition(playerId);
    expect(newPos?.x).toBe(8);
    expect(newPos?.y).toBe(8);

    // Assert: Player is alive again
    const playerData = spatial.getEntityData(playerId);
    if (playerData && hasHealth(playerData)) {
      expect(playerData.healthState).toBe('alive');
      expect(playerData.hp).toBe(100); // Full health
    } else {
      throw new Error('Player not found or missing health after respawn');
    }
  });

  it('respawns at player-start if no checkpoint', () => {
    // Arrange: Player at (2,2), player-start at (1,1)
    const playerId = spatial.spawn('player', 2, 2, GameLayers.ACTORS, {
      hp: 10,
      maxHp: 100,
      healthState: 'alive',
      damage: 10,
      sceneId: 'test-scene',
      inventory: [],
      pushStrength: 1,
    });

    spatial.spawn('player-start', 1, 1, GameLayers.FLOOR, {
      sceneId: 'test-scene',
      color: '#0000ff',
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Kill the player
    healthSystem.damage(playerId, 100);
    gameLoop.tick(); // tick 1: dying, dyingTicks 2 -> 1
    gameLoop.tick(); // tick 2: dying, dyingTicks 1 -> dead, respawn scheduled for tick 3
    gameLoop.tick(); // tick 3: respawn executes

    // Assert: Player respawned at player-start
    const newPos = spatial.getEntityPosition(playerId);
    expect(newPos?.x).toBe(1);
    expect(newPos?.y).toBe(1);
  });

  it('decrements lives on death', () => {
    // Arrange: Player with 3 lives
    const playerId = spatial.spawn('player', 2, 2, GameLayers.ACTORS, {
      hp: 10,
      maxHp: 100,
      healthState: 'alive',
      damage: 10,
      sceneId: 'test-scene',
      inventory: [],
      pushStrength: 1,
      lastCheckpointSceneId: 'test-scene',
      lastCheckpointX: 5,
      lastCheckpointY: 5,
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Verify initial lives in GameState
    expect(gameManager.gameState.lives).toBe(3);
    expect(respawnSystem.getLives()).toBe(3);

    // Kill the player
    healthSystem.damage(playerId, 100);
    gameLoop.tick(); // tick 1: dying, dyingTicks 2 -> 1
    gameLoop.tick(); // tick 2: dying, dyingTicks 1 -> dead, lives decremented

    // Verify lives decremented in GameState
    expect(gameManager.gameState.lives).toBe(2);
    expect(respawnSystem.getLives()).toBe(2);
  });

  it('calls onGameOver when no lives remaining', () => {
    const onGameOver = vi.fn();
    const testRespawnSystem = new RespawnSystem(gameManager, {
      respawnDelay: 2,
      maxLives: 1,
      onGameOver,
    });

    // Replace the respawn system
    gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(healthSystem);
    gameLoop.addSystem(testRespawnSystem);

    // Arrange: Player with 1 life
    const playerId = spatial.spawn('player', 2, 2, GameLayers.ACTORS, {
      hp: 10,
      maxHp: 100,
      healthState: 'alive',
      damage: 10,
      sceneId: 'test-scene',
      inventory: [],
      pushStrength: 1,
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Kill the player
    healthSystem.damage(playerId, 100);
    gameLoop.tick(); // tick 1: dying, dyingTicks 2 -> 1
    gameLoop.tick(); // tick 2: dying, dyingTicks 1 -> dead, game over

    expect(onGameOver).toHaveBeenCalled();
    // Verify lives is 0 in both GameState and via getLives()
    expect(gameManager.gameState.lives).toBe(0);
    expect(testRespawnSystem.getLives()).toBe(0);
  });

  it('does not activate already activated checkpoints', () => {
    // Arrange: Player at (5,5), already activated checkpoint at (5,5)
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      damage: 10,
      sceneId: 'test-scene',
      inventory: [],
      pushStrength: 1,
    });

    spatial.spawn('checkpoint', 5, 5, GameLayers.FLOOR, {
      activated: true, // Already activated
      sceneId: 'test-scene',
      color: '#00ff00',
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Get initial debug state
    const initialState = respawnSystem.getDebugState();
    const initialActivations = initialState.checkpointsActivated as number;

    // Act: Run system
    gameLoop.tick();

    // Assert: No new activation counted
    const newState = respawnSystem.getDebugState();
    expect(newState.checkpointsActivated).toBe(initialActivations);
  });
});
