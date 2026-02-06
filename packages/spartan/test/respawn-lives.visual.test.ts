/**
 * Visual tests for RespawnSystem lives tracking.
 *
 * Tests the lives system integration with GameState:
 * - Player loses life on death and respawns
 * - Game over when no lives remaining
 * - Lives tracked in GameState (single source of truth)
 * - Cross-scene respawn (player dies in scene B, respawns in scene A)
 */
import { visual } from './visual-helpers';
import { GameLayers } from '../config/layers.config';
import { spawnPlayer } from '../entities/spawn-helpers';
import { HealthSystem } from '../systems/health.system';
import { RespawnSystem } from '../systems/respawn.system';
import { GameManager } from '../core/game-manager';
import { GameLoop } from '../core/game-loop';

visual('player loses life on death and respawns', {
  arrange: ({ spatial: _spatial, store: _store, data }) => {
    // Create proper scene setup with SceneManager
    const gameManager = new GameManager();
    const scene = gameManager.sceneManager.createScene('test-scene', 10, 10);
    gameManager.sceneManager.setActiveScene('test-scene');

    // Spawn player with full health
    const playerId = scene.spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 10,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
      inventory: [],
      pushStrength: 1,
      // Set checkpoint for respawn location
      lastCheckpointSceneId: 'test-scene',
      lastCheckpointX: 2,
      lastCheckpointY: 2,
    });

    // Spawn player-start as fallback
    scene.spatial.spawn('player-start', 2, 2, GameLayers.LOGIC, {
      sceneId: 'test-scene',
    });

    scene.spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Store for act phase
    data.testSetup = { gameManager, playerId, scene };
  },
  act: ({ spatial: _spatial, data }) => {
    const { gameManager, playerId, scene } = data.testSetup;

    const healthSystem = new HealthSystem({ dyingDuration: 1 });
    const respawnSystem = new RespawnSystem(gameManager, {
      respawnDelay: 1,
      maxLives: 3,
    });

    const gameLoop = new GameLoop(scene.spatial, gameManager);
    gameLoop.addSystem(healthSystem);
    gameLoop.addSystem(respawnSystem);

    // Verify initial state
    if (gameManager.gameState.lives !== 3) {
      throw new Error(`Expected 3 lives initially, got ${gameManager.gameState.lives}`);
    }

    // Kill the player (10hp - 100 damage = dead)
    healthSystem.damage(playerId, 100);

    // Tick 1: Player enters dying state
    gameLoop.tick();

    // Tick 2: Player dies, life decremented, respawn scheduled
    gameLoop.tick();

    // Tick 3: Respawn executes
    gameLoop.tick();

    // Execute pending scene transition (for consistency)
    gameManager.executePendingTransition();

    // Store result for assertion
    data.testResult = {
      livesAfterDeath: gameManager.gameState.lives,
      respawnSystem,
      playerId,
      scene,
    };
  },
  assert: ({ expect, data }) => {
    const result = data.testResult;

    expect('Player lost one life', () => {
      if (result.livesAfterDeath !== 2) {
        throw new Error(`Expected 2 lives after death, got ${result.livesAfterDeath}`);
      }
    });

    expect('Player respawned at checkpoint', () => {
      const playerPos = result.scene.spatial.getEntityPosition(result.playerId);
      if (!playerPos) {
        throw new Error('Player not found after respawn');
      }
      if (playerPos.x !== 2 || playerPos.y !== 2) {
        throw new Error(`Expected respawn at (2,2), got (${playerPos.x},${playerPos.y})`);
      }
    });

    expect('Player is alive again', () => {
      const playerData = result.scene.spatial.getEntityData(result.playerId);
      if (!playerData) {
        throw new Error('Player data not found');
      }
      if ((playerData as unknown as { healthState: string }).healthState !== 'alive') {
        throw new Error(`Expected healthState 'alive', got ${(playerData as unknown as { healthState: string }).healthState}`);
      }
    });
  },
});

visual('game over when no lives remaining', {
  arrange: ({ spatial }) => {
    // Spawn player with low health
    spawnPlayer(spatial, 5, 5, {
      hp: 10,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    spatial.commit();
  },
  act: ({ spatial, store, data }) => {
    // Create game manager
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;

    const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
    gameManager.gameState.playerEntityId = playerId;

    let gameOverCalled = false;
    const healthSystem = new HealthSystem({ dyingDuration: 1 });
    const respawnSystem = new RespawnSystem(gameManager, {
      respawnDelay: 1,
      maxLives: 1, // Only 1 life
      onGameOver: () => {
        gameOverCalled = true;
      },
    });

    const gameLoop = new GameLoop(spatial, gameManager);
    gameLoop.addSystem(healthSystem);
    gameLoop.addSystem(respawnSystem);

    // Verify initial state
    if (gameManager.gameState.lives !== 1) {
      throw new Error(`Expected 1 life initially, got ${gameManager.gameState.lives}`);
    }

    // Kill the player
    healthSystem.damage(playerId, 100);

    // Tick 1: Player enters dying state
    gameLoop.tick();

    // Tick 2: Player dies, game over (no respawn)
    gameLoop.tick();

    // Store result for assertion
    data.testResult = {
      gameOverCalled,
      livesRemaining: gameManager.gameState.lives,
    };
  },
  assert: ({ expect, data }) => {
    const result = data.testResult;

    // Get result from spatial context and verify game over was called
    expect('Game over callback was called', () => {
      if (!result?.gameOverCalled) {
        throw new Error('Expected onGameOver to be called');
      }
    });
  },
});

visual('lives are tracked in GameState (single source of truth)', {
  arrange: ({ spatial }) => {
    // Spawn player
    spawnPlayer(spatial, 5, 5, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    spatial.commit();
  },
  act: ({ spatial, store, data }) => {
    // Create game manager
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;

    const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
    gameManager.gameState.playerEntityId = playerId;

    const respawnSystem = new RespawnSystem(gameManager, {
      respawnDelay: 1,
      maxLives: 5,
    });

    // Verify GameState is initialized
    const initialLives = gameManager.gameState.lives;
    const initialMaxLives = gameManager.gameState.maxLives;

    // getLives() should return GameState.lives
    const getLivesResult = respawnSystem.getLives();

    // addLives should modify GameState
    respawnSystem.addLives(2);
    const afterAddLives = gameManager.gameState.lives;

    // resetLives should reset to maxLives
    respawnSystem.resetLives();
    const afterReset = gameManager.gameState.lives;

    // Store results
    data.testResult = {
      initialLives,
      initialMaxLives,
      getLivesResult,
      afterAddLives,
      afterReset,
    };
  },
  assert: ({ expect, data }) => {
    const result = data.testResult;

    expect('GameState.lives initialized from maxLives config', () => {
      if (result.initialLives !== 5) {
        throw new Error(`Expected initialLives=5, got ${result.initialLives}`);
      }
      if (result.initialMaxLives !== 5) {
        throw new Error(`Expected initialMaxLives=5, got ${result.initialMaxLives}`);
      }
    });

    expect('getLives() returns GameState.lives', () => {
      if (result.getLivesResult !== 5) {
        throw new Error(`Expected getLives()=5, got ${result.getLivesResult}`);
      }
    });

    expect('addLives() modifies GameState.lives', () => {
      if (result.afterAddLives !== 7) {
        throw new Error(`Expected afterAddLives=7, got ${result.afterAddLives}`);
      }
    });

    expect('resetLives() resets to GameState.maxLives', () => {
      if (result.afterReset !== 5) {
        throw new Error(`Expected afterReset=5, got ${result.afterReset}`);
      }
    });
  },
});

visual('no checkpoint fallback: player dies in scene B, respawns at scene A player-start', {
  arrange: ({ data }) => {
    // Create multi-scene setup
    const gameManager = new GameManager();

    // Create two scenes
    gameManager.sceneManager.createScene('room1', 10, 10);
    gameManager.sceneManager.createScene('room2', 10, 10);

    // Set room1 as initial scene (this is the fallback for respawn)
    gameManager.gameState.initialSceneId = 'room1';

    // Set room2 as active (player will die here)
    gameManager.sceneManager.setActiveScene('room2');

    const room1 = gameManager.sceneManager.getScene('room1')!;
    const room2 = gameManager.sceneManager.getScene('room2')!;

    // Spawn player-start in room1 (fallback respawn location)
    room1.spatial.spawn('player-start', 4, 4, GameLayers.LOGIC, {
      sceneId: 'room1',
    });
    room1.spatial.commit();

    // Spawn player in room2 WITHOUT any checkpoint data
    const playerId = room2.spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 10,
      maxHp: 100,
      damage: 10,
      healthState: 'alive',
      sceneId: 'room2',
      inventory: [],
      pushStrength: 1,
      // NO checkpoint data - should fall back to player-start in initial scene
    });
    room2.spatial.commit();

    gameManager.gameState.playerEntityId = playerId;

    // Store for act phase
    data.testSetup = {
      gameManager,
      playerId,
      room1,
      room2,
    };
  },
  act: ({ data }) => {
    const { gameManager, playerId, room2 } = data.testSetup;

    // Create systems
    const healthSystem = new HealthSystem({ dyingDuration: 1 });
    const respawnSystem = new RespawnSystem(gameManager, {
      respawnDelay: 1,
      maxLives: 3,
    });

    // Create game loop for room2 (current scene)
    const gameLoop = new GameLoop(room2.spatial, gameManager);
    gameLoop.addSystem(healthSystem);
    gameLoop.addSystem(respawnSystem);

    // Kill the player
    healthSystem.damage(playerId, 100);

    // Tick 1: Player enters dying state
    gameLoop.tick();

    // Tick 2: Player dies, respawn scheduled
    gameLoop.tick();

    // Tick 3: Respawn executes (should go to room1's player-start)
    gameLoop.tick();

    // Execute pending scene transition
    gameManager.executePendingTransition();

    // Store results
    data.testResult = {
      activeSceneId: gameManager.sceneManager.getActiveScene()?.id,
      playerScene: gameManager.getPlayerScene()?.id,
      playerPos: gameManager.getPlayerPosition(),
      lives: gameManager.gameState.lives,
    };
  },
  assert: ({ expect, data }) => {
    const result = data.testResult;

    expect('Active scene changed to room1 (initial scene)', () => {
      if (result.activeSceneId !== 'room1') {
        throw new Error(`Expected active scene 'room1', got '${result.activeSceneId}'`);
      }
    });

    expect('Player is now in room1', () => {
      if (result.playerScene !== 'room1') {
        throw new Error(`Expected player in 'room1', got '${result.playerScene}'`);
      }
    });

    expect('Player respawned at player-start location (4,4)', () => {
      if (!result.playerPos) {
        throw new Error('Player position not found');
      }
      if (result.playerPos.x !== 4 || result.playerPos.y !== 4) {
        throw new Error(`Expected (4,4), got (${result.playerPos.x},${result.playerPos.y})`);
      }
    });

    expect('Player lost one life', () => {
      if (result.lives !== 2) {
        throw new Error(`Expected 2 lives, got ${result.lives}`);
      }
    });
  },
});

visual('cross-scene respawn: player dies in scene B, respawns in scene A', {
  arrange: ({ store: _store, data }) => {
    // We need a multi-scene setup, so we'll use GameManager directly
    const gameManager = new GameManager();

    // Create two scenes
    gameManager.sceneManager.createScene('room1', 10, 10);
    gameManager.sceneManager.createScene('room2', 10, 10);

    // Set room2 as active (player will die here)
    gameManager.sceneManager.setActiveScene('room2');

    const room1 = gameManager.sceneManager.getScene('room1')!;
    const room2 = gameManager.sceneManager.getScene('room2')!;

    // Spawn checkpoint in room1 (where player should respawn)
    room1.spatial.spawn('checkpoint', 3, 3, GameLayers.LOGIC, {
      sceneId: 'room1',
      activated: true,
    });
    room1.spatial.commit();

    // Spawn player in room2 with checkpoint data pointing to room1
    const playerId = room2.spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 10,
      maxHp: 100,
      damage: 10,
      healthState: 'alive',
      sceneId: 'room2',
      inventory: [],
      pushStrength: 1,
      // Checkpoint is in room1
      lastCheckpointSceneId: 'room1',
      lastCheckpointX: 3,
      lastCheckpointY: 3,
    });
    room2.spatial.commit();

    gameManager.gameState.playerEntityId = playerId;

    // Store for act phase
    data.testSetup = {
      gameManager,
      playerId,
      room1,
      room2,
    };
  },
  act: ({ data }) => {
    const { gameManager, playerId, room2 } = data.testSetup;

    // Create systems
    const healthSystem = new HealthSystem({ dyingDuration: 1 });
    const respawnSystem = new RespawnSystem(gameManager, {
      respawnDelay: 1,
      maxLives: 3,
    });

    // Create game loop for room2 (current scene)
    const gameLoop = new GameLoop(room2.spatial, gameManager);
    gameLoop.addSystem(healthSystem);
    gameLoop.addSystem(respawnSystem);

    // Kill the player
    healthSystem.damage(playerId, 100);

    // Tick 1: Player enters dying state
    gameLoop.tick();

    // Tick 2: Player dies, respawn scheduled
    gameLoop.tick();

    // Tick 3: Respawn executes (should transition to room1)
    gameLoop.tick();

    // Execute any pending scene transition
    gameManager.executePendingTransition();

    // Store results
    data.testResult = {
      activeSceneId: gameManager.sceneManager.getActiveScene()?.id,
      playerScene: gameManager.getPlayerScene()?.id,
      playerPos: gameManager.getPlayerPosition(),
      lives: gameManager.gameState.lives,
    };
  },
  assert: ({ expect, data }) => {
    const result = data.testResult;

    expect('Active scene changed to room1', () => {
      if (result.activeSceneId !== 'room1') {
        throw new Error(`Expected active scene 'room1', got '${result.activeSceneId}'`);
      }
    });

    expect('Player is now in room1', () => {
      if (result.playerScene !== 'room1') {
        throw new Error(`Expected player in 'room1', got '${result.playerScene}'`);
      }
    });

    expect('Player respawned at checkpoint location (3,3)', () => {
      if (!result.playerPos) {
        throw new Error('Player position not found');
      }
      if (result.playerPos.x !== 3 || result.playerPos.y !== 3) {
        throw new Error(`Expected (3,3), got (${result.playerPos.x},${result.playerPos.y})`);
      }
    });

    expect('Player lost one life', () => {
      if (result.lives !== 2) {
        throw new Error(`Expected 2 lives, got ${result.lives}`);
      }
    });
  },
});
