import { visual } from './visual-helpers';
import { GameLayers } from '../config/layers.config';
import { spawnEnemy, spawnOscillator, spawnSleepWake, spawnConductiveFloor } from '../entities/spawn-helpers';
import { hasAI } from '../traits/trait-guards';
import { SignalSystem } from '../systems/signal.system';
import { GameManager } from '../core/game-manager';
import { GameLoop } from '../core/game-loop';

/**
 * Sleep-Wake Zone Tests
 *
 * Tests for signal-controlled NPC activation:
 * - Sleep-wake entities toggle NPC active state
 * - Signal ON → NPCs awake (active)
 * - Signal OFF → NPCs asleep (inactive)
 * - Signals propagate through sleep-wake zones
 */

visual('sleep-wake entity activates NPC when powered', {
  arrange: ({ spatial }) => {
    // Create sleep-wake zone
    spawnSleepWake(spatial, 5, 5, { color: '#9900ff' });

    // Create oscillator to power it
    spawnOscillator(spatial, 4, 5, GameLayers.LOGIC, {
      signalState: true,
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    // Spawn enemy on the sleep-wake cell (starts inactive)
    spawnEnemy(spatial, 5, 5, {
      hp: 50,
      maxHp: 50,
      damage: 5,
      aiState: 'idle',
      aiActive: false, // Start asleep
      sceneId: 'test-scene',
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const signalSystem = new SignalSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(signalSystem);

    // Run one tick to propagate signal and wake NPC
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('NPC becomes active when zone powered', () => {
      const enemyId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS);
      if (!enemyId) throw new Error('Enemy not found');

      const data = spatial.getEntityData(enemyId);
      if (!data || !hasAI(data)) {
        throw new Error('Enemy missing AI trait');
      }

      if (!data.aiActive) {
        throw new Error('Enemy should be active (awake)');
      }
    });
  },
});

visual('sleep-wake entity deactivates NPC when unpowered', {
  arrange: ({ spatial }) => {
    // Create sleep-wake zone
    spawnSleepWake(spatial, 5, 5, { color: '#9900ff' });

    // Create oscillator (starts OFF)
    spawnOscillator(spatial, 4, 5, GameLayers.LOGIC, {
      signalState: false,
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    // Spawn enemy on the sleep-wake cell (starts active)
    spawnEnemy(spatial, 5, 5, {
      hp: 50,
      maxHp: 50,
      damage: 5,
      aiState: 'idle',
      aiActive: true, // Start awake
      sceneId: 'test-scene',
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const signalSystem = new SignalSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(signalSystem);

    // Run one tick to propagate (no signal) and sleep NPC
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('NPC becomes inactive when zone unpowered', () => {
      const enemyId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS);
      if (!enemyId) throw new Error('Enemy not found');

      const data = spatial.getEntityData(enemyId);
      if (!data || !hasAI(data)) {
        throw new Error('Enemy missing AI trait');
      }

      if (data.aiActive !== false) {
        throw new Error('Enemy should be inactive (asleep)');
      }
    });
  },
});

visual('sleep-wake zones propagate signals through contiguous areas', {
  arrange: ({ spatial }) => {
    // Create a painted zone (3x3 area)
    for (let x = 4; x <= 6; x++) {
      for (let y = 4; y <= 6; y++) {
        spawnSleepWake(spatial, x, y, { color: '#9900ff' });
      }
    }

    // Create oscillator at corner
    spawnOscillator(spatial, 3, 4, GameLayers.LOGIC, {
      signalState: true,
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    // Spawn enemies throughout the zone
    spawnEnemy(spatial, 4, 4, {
      hp: 50,
      maxHp: 50,
      damage: 5,
      aiState: 'idle',
      aiActive: false,
      sceneId: 'test-scene',
    });

    spawnEnemy(spatial, 5, 5, {
      hp: 50,
      maxHp: 50,
      damage: 5,
      aiState: 'idle',
      aiActive: false,
      sceneId: 'test-scene',
    });

    spawnEnemy(spatial, 6, 6, {
      hp: 50,
      maxHp: 50,
      damage: 5,
      aiState: 'idle',
      aiActive: false,
      sceneId: 'test-scene',
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const signalSystem = new SignalSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(signalSystem);

    // Run one tick to propagate signal through zone
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('All NPCs in zone become active', () => {
      const enemy1Id = spatial.getEntityIdAt(4, 4, GameLayers.ACTORS);
      const enemy2Id = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS);
      const enemy3Id = spatial.getEntityIdAt(6, 6, GameLayers.ACTORS);

      if (!enemy1Id || !enemy2Id || !enemy3Id) {
        throw new Error('Not all enemies found');
      }

      const data1 = spatial.getEntityData(enemy1Id);
      const data2 = spatial.getEntityData(enemy2Id);
      const data3 = spatial.getEntityData(enemy3Id);

      if (!data1 || !hasAI(data1) || !data2 || !hasAI(data2) || !data3 || !hasAI(data3)) {
        throw new Error('Enemies missing AI trait');
      }

      if (!data1.aiActive || !data2.aiActive || !data3.aiActive) {
        throw new Error('All enemies should be active (awake)');
      }
    });
  },
});

visual('sleep-wake zones with FLOOR layer signal source', {
  arrange: ({ spatial }) => {
    // Create oscillator on FLOOR layer (visible)
    spawnOscillator(spatial, 3, 5, GameLayers.COLLECTIBLES, {
      signalState: true,
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    // Conductive floor to bridge layers
    spawnConductiveFloor(spatial, 4, 5, { color: '#808080' });

    // Sleep-wake zone on LOGIC layer
    spawnSleepWake(spatial, 5, 5, { color: '#9900ff' });
    spawnSleepWake(spatial, 6, 5, { color: '#9900ff' });

    // Spawn enemy in the zone
    spawnEnemy(spatial, 6, 5, {
      hp: 50,
      maxHp: 50,
      damage: 5,
      aiState: 'idle',
      aiActive: false,
      sceneId: 'test-scene',
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const signalSystem = new SignalSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(signalSystem);

    // Run one tick to propagate signal from FLOOR to LOGIC layer
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('NPC wakes from FLOOR layer signal', () => {
      const enemyId = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS);
      if (!enemyId) throw new Error('Enemy not found');

      const data = spatial.getEntityData(enemyId);
      if (!data || !hasAI(data)) {
        throw new Error('Enemy missing AI trait');
      }

      if (!data.aiActive) {
        throw new Error('Enemy should be active from FLOOR layer signal');
      }
    });
  },
});

visual('sleep-wake zone only affects NPCs on same cell', {
  arrange: ({ spatial }) => {
    // Create two sleep-wake entities
    spawnSleepWake(spatial, 5, 5, { color: '#9900ff' });
    spawnSleepWake(spatial, 6, 5, { color: '#9900ff' });

    // Power only the first one
    spawnOscillator(spatial, 4, 5, GameLayers.LOGIC, {
      signalState: true,
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    // Spawn enemy on first cell
    spawnEnemy(spatial, 5, 5, {
      hp: 50,
      maxHp: 50,
      damage: 5,
      aiState: 'idle',
      aiActive: false,
      sceneId: 'test-scene',
    });

    // Spawn enemy on second cell
    spawnEnemy(spatial, 6, 5, {
      hp: 50,
      maxHp: 50,
      damage: 5,
      aiState: 'idle',
      aiActive: false,
      sceneId: 'test-scene',
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const signalSystem = new SignalSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(signalSystem);

    // Run one tick - signal propagates to both zones
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Both NPCs wake when zone propagates signal', () => {
      const enemy1Id = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS);
      const enemy2Id = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS);

      if (!enemy1Id || !enemy2Id) {
        throw new Error('Enemies not found');
      }

      const data1 = spatial.getEntityData(enemy1Id);
      const data2 = spatial.getEntityData(enemy2Id);

      if (!data1 || !hasAI(data1) || !data2 || !hasAI(data2)) {
        throw new Error('Enemies missing AI trait');
      }

      // Both should be awake since signal propagates through sleep-wake zones
      if (!data1.aiActive || !data2.aiActive) {
        throw new Error('Both enemies should be active');
      }
    });
  },
});
