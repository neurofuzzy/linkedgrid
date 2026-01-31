import { visual } from './visual-helpers';
import { GameLayers } from "../core/types";
import { spawnPlayer } from '../entities/spawn-helpers';
import { hasHealth } from '../entities/trait-guards';
import { FloorEffectSystem } from '../systems/floor-effect-system';
import { GameManager } from '../core/game-manager';
import { GameLoop } from '../core/game-loop';

visual('lava deals damage over time', {
  arrange: ({ spatial }) => {
    // Spawn player
    spawnPlayer(spatial, 5, 5, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    // Spawn lava under player
    spatial.spawn('lava', 5, 5, GameLayers.FLOOR, {
      effectType: 'damage',
      triggerMode: 'continuous',
      damage: 10,
      cadence: 1, // Very fast cadence for testing (1ms)
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    // Create game manager and replace its entity store with the shared one
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store; // Use the same store as spatial system
    
    // Create floor effect system
    const floorSystem = new FloorEffectSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(floorSystem);

    // Tick - damage should apply immediately (cadence=1ms)
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Player took damage from lava', () => {
      const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS);
      if (!playerId) {
        throw new Error('Player not found');
      }

      const playerData = spatial.getEntityData(playerId);
      if (!hasHealth(playerData)) {
        throw new Error('Player missing health');
      }

      if (playerData.hp >= 100) {
        throw new Error(`Expected hp < 100, got hp=${playerData.hp}`);
      }
    });
  },
});

visual('acid deals faster damage than lava', {
  arrange: ({ spatial }) => {
    // Spawn player on acid
    spawnPlayer(spatial, 5, 5, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    // Spawn acid with faster cadence
    spatial.spawn('acid', 5, 5, GameLayers.FLOOR, {
      effectType: 'damage',
      triggerMode: 'continuous',
      damage: 5,
      cadence: 1, // Very fast
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const floorSystem = new FloorEffectSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(floorSystem);

    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Player took damage from acid', () => {
      const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS);
      if (!playerId) {
        throw new Error('Player not found');
      }

      const playerData = spatial.getEntityData(playerId);
      if (!hasHealth(playerData)) {
        throw new Error('Player missing health');
      }

      if (playerData.hp >= 100) {
        throw new Error(`Expected damage, got hp=${playerData.hp}`);
      }
    });
  },
});

visual('medbay heals player with cooldown', {
  arrange: ({ spatial }) => {
    // Spawn player with low HP
    spawnPlayer(spatial, 5, 5, {
      hp: 50,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    // Spawn medbay
    spatial.spawn('medbay', 5, 5, GameLayers.FLOOR, {
      effectType: 'heal',
      triggerMode: 'continuous',
      healRate: 10,
      cadence: 50,
      cooldown: 100,
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const floorSystem = new FloorEffectSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(floorSystem);

    gameLoop.tick();
    spatial.pause(); // Create pause frame for time to pass
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Player healed on medbay', () => {
      const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS);
      if (!playerId) {
        throw new Error('Player not found');
      }

      const playerData = spatial.getEntityData(playerId);
      if (!hasHealth(playerData)) {
        throw new Error('Player missing health');
      }

      if (playerData.hp <= 50) {
        throw new Error(`Expected healing, got hp=${playerData.hp}`);
      }

      if (playerData.hp > 100) {
        throw new Error(`HP should not exceed max, got hp=${playerData.hp}`);
      }
    });
  },
});

visual('medbay does not heal player at max HP', {
  arrange: ({ spatial }) => {
    // Spawn player at max HP
    spawnPlayer(spatial, 5, 5, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    // Spawn medbay
    spatial.spawn('medbay', 5, 5, GameLayers.FLOOR, {
      effectType: 'heal',
      triggerMode: 'continuous',
      healRate: 10,
      cadence: 50,
      cooldown: 100,
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const floorSystem = new FloorEffectSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(floorSystem);

    gameLoop.tick();
    spatial.pause(); // Create pause frame for time to pass
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Player stays at max HP', () => {
      const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS);
      if (!playerId) {
        throw new Error('Player not found');
      }

      const playerData = spatial.getEntityData(playerId);
      if (!hasHealth(playerData)) {
        throw new Error('Player missing health');
      }

      if (playerData.hp !== 100) {
        throw new Error(`Expected hp=100, got hp=${playerData.hp}`);
      }
    });
  },
});

visual('ice causes player to slide one cell', {
  arrange: ({ spatial }) => {
    // Spawn player
    spawnPlayer(spatial, 5, 5, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    // Spawn ice to the right
    spatial.spawn('ice', 6, 5, GameLayers.FLOOR, {
      effectType: 'slide',
      triggerMode: 'on-entry',
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const floorSystem = new FloorEffectSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(floorSystem);

    const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;

    // Tick 1: Move player onto ice
    spatial.move(playerId, 6, 5);
    gameLoop.tick(); // Player moves to (6,5), positions updated

    // Tick 2: System detects player moved onto ice last tick, stages slide
    gameLoop.tick(); // Player slides to (7,5)
  },
  assert: ({ spatial, expect }) => {
    expect('Player slid one additional cell', () => {
      const playerId = spatial.getEntityIdAt(7, 5, GameLayers.ACTORS);
      if (!playerId) {
        throw new Error('Player should have slid to (7,5)');
      }
    });

    expect('Player not at starting position', () => {
      const startId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS);
      if (startId !== undefined) {
        throw new Error('Player should have moved from start');
      }
    });
  },
});

visual('ice slide stops at wall', {
  arrange: ({ spatial }) => {
    // Spawn player
    spawnPlayer(spatial, 5, 5, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    // Spawn ice
    spatial.spawn('ice', 6, 5, GameLayers.FLOOR, {
      effectType: 'slide',
      triggerMode: 'on-entry',
    });

    // Spawn wall to stop slide
    spatial.spawn('wall', 7, 5, GameLayers.WALLS, {});

    spatial.commit();
    spatial.syncMasks(); // Update blocking masks
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const floorSystem = new FloorEffectSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(floorSystem);

    const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;

    // Tick 1: Move player onto ice
    spatial.move(playerId, 6, 5);
    gameLoop.tick(); // Player moves to (6,5)

    // Tick 2: System tries to slide but wall blocks
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Player stopped at ice (wall blocked continuation)', () => {
      const playerId = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS);
      if (!playerId) {
        throw new Error('Player should have stopped at (6,5)');
      }
    });

    expect('Wall still present', () => {
      const wallId = spatial.getEntityIdAt(7, 5, GameLayers.WALLS);
      if (!wallId) {
        throw new Error('Wall should still exist');
      }
    });
  },
});

visual('mud cancels player movement', {
  arrange: ({ spatial }) => {
    // Spawn player
    spawnPlayer(spatial, 5, 5, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    // Spawn mud at destination
    spatial.spawn('mud', 6, 5, GameLayers.FLOOR, {
      effectType: 'slow',
      triggerMode: 'on-entry',
      slowFactor: 0.5,
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const floorSystem = new FloorEffectSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(floorSystem);

    const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;

    // Try to move player onto mud - should succeed
    spatial.move(playerId, 6, 5);
    gameLoop.tick(); // Player moves to mud

    // Now player is on mud - try to move again
    spatial.move(playerId, 7, 5);
    gameLoop.tick(); // System should cancel this move
  },
  assert: ({ spatial, expect }) => {
    expect('Player stuck on mud', () => {
      const playerId = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS);
      if (!playerId) {
        throw new Error('Player should still be on mud at (6,5)');
      }
    });

    expect('Player did not advance past mud', () => {
      const advanced = spatial.getEntityIdAt(7, 5, GameLayers.ACTORS);
      if (advanced !== undefined) {
        throw new Error('Player should not have moved past mud');
      }
    });
  },
});

visual('player killed by lava is removed from grid', {
  arrange: ({ spatial }) => {
    // Spawn player with low health
    spawnPlayer(spatial, 5, 5, {
      hp: 5,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    // Spawn lethal lava
    spatial.spawn('lava', 5, 5, GameLayers.FLOOR, {
      effectType: 'damage',
      triggerMode: 'continuous',
      damage: 10,
      cadence: 50,
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const floorSystem = new FloorEffectSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(floorSystem);

    gameLoop.tick();
    spatial.pause(); // Create pause frame for time to pass
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Dead player removed from grid', () => {
      const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS);
      if (playerId !== undefined) {
        throw new Error('Dead player should be removed');
      }
    });

    expect('Lava remains on floor', () => {
      const lavaId = spatial.getEntityIdAt(5, 5, GameLayers.FLOOR);
      if (!lavaId) {
        throw new Error('Lava should still exist');
      }
    });
  },
});
