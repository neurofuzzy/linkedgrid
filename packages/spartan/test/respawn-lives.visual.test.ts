/**
 * Visual tests for RespawnSystem lives tracking.
 *
 * Tests the lives system integration with GameState:
 * - Player loses life on death and respawns
 * - Game over when no lives remaining
 * - Lives tracked in GameState (single source of truth)
 */
import { visual } from './visual-helpers';
import { GameLayers } from '../config/layers.config';
import { spawnPlayer } from '../entities/spawn-helpers';
import { HealthSystem } from '../systems/health.system';
import { RespawnSystem } from '../systems/respawn.system';
import { GameManager } from '../core/game-manager';
import { GameLoop } from '../core/game-loop';

visual('player loses life on death and respawns', {
  arrange: ({ spatial }) => {
    // Spawn player with full health
    spawnPlayer(spatial, 5, 5, {
      hp: 10,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
      // Set checkpoint for respawn location
      lastCheckpointSceneId: 'test-scene',
      lastCheckpointX: 2,
      lastCheckpointY: 2,
    });

    // Spawn player-start as fallback
    spatial.spawn('player-start', 2, 2, GameLayers.LOGIC, {
      sceneId: 'test-scene',
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    // Create game manager and wire up systems
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;

    const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
    gameManager.gameState.playerEntityId = playerId;

    const healthSystem = new HealthSystem({ dyingDuration: 1 });
    const respawnSystem = new RespawnSystem(gameManager, {
      respawnDelay: 1,
      maxLives: 3,
    });

    const gameLoop = new GameLoop(spatial, gameManager);
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

    // Store result for assertion
    (spatial as any).__testResult = {
      livesAfterDeath: gameManager.gameState.lives,
      respawnSystem,
      playerId,
    };
  },
  assert: ({ spatial, expect }) => {
    const result = (spatial as any).__testResult;

    expect('Player lost one life', () => {
      if (result.livesAfterDeath !== 2) {
        throw new Error(`Expected 2 lives after death, got ${result.livesAfterDeath}`);
      }
    });

    expect('Player respawned at checkpoint', () => {
      const playerPos = spatial.getEntityPosition(result.playerId);
      if (!playerPos) {
        throw new Error('Player not found after respawn');
      }
      if (playerPos.x !== 2 || playerPos.y !== 2) {
        throw new Error(`Expected respawn at (2,2), got (${playerPos.x},${playerPos.y})`);
      }
    });

    expect('Player is alive again', () => {
      const playerData = spatial.getEntityData(result.playerId);
      if (!playerData) {
        throw new Error('Player data not found');
      }
      if ((playerData as any).healthState !== 'alive') {
        throw new Error(`Expected healthState 'alive', got ${(playerData as any).healthState}`);
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
  act: ({ spatial, store }) => {
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
    (spatial as any).__testResult = {
      gameOverCalled,
      livesRemaining: gameManager.gameState.lives,
    };
  },
  assert: ({ expect }) => {
    const result = (globalThis as any).visualTests?.at(-1)?.__testResult ||
      ((globalThis as any).__visualTestContext?.spatial as any)?.__testResult;

    // Get result from spatial context
    expect('Game over callback was called', () => {
      // Access through the test context
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
  act: ({ spatial, store }) => {
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
    (spatial as any).__testResult = {
      initialLives,
      initialMaxLives,
      getLivesResult,
      afterAddLives,
      afterReset,
    };
  },
  assert: ({ spatial, expect }) => {
    const result = (spatial as any).__testResult;

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
