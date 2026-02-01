import { visual } from './visual-helpers';
import { GameLayers } from '../config/layers.config';
import { spawnPlayer, spawnOscillator, spawnPressureSwitch, spawnInverter, spawnConductiveFloor, spawnBollard } from '../entities/spawn-helpers';
import { hasSignalEmitter, hasSignalReceiver, isBollard } from '../traits/trait-guards';
import { SignalSystem } from '../systems/signal.system';
import { GameManager } from '../core/game-manager';
import { GameLoop } from '../core/game-loop';

/**
 * Signal System Visual Tests
 *
 * Tests for signal propagation through conductive networks:
 * - Oscillators auto-toggle on/off
 * - Pressure switches toggle on step
 * - Inverters output opposite of input
 * - Conductive floors carry signals
 * - Bollards open/close based on signals
 */

visual('oscillator toggles on/off every 20 ticks', {
  arrange: ({ spatial }) => {
    // Spawn oscillator with period 40 (toggles every 20 ticks)
    spawnOscillator(spatial, 5, 5, GameLayers.COLLECTIBLES, {
      signalState: false,
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const signalSystem = new SignalSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(signalSystem);

    // Tick 20 times (should toggle once at tick 20)
    for (let i = 0; i < 20; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Oscillator toggled ON after 20 ticks', () => {
      const oscillatorId = spatial.getEntityIdAt(5, 5, GameLayers.COLLECTIBLES);
      if (!oscillatorId) {
        throw new Error('Oscillator not found');
      }

      const data = spatial.getEntityData(oscillatorId);
      if (!data || !hasSignalEmitter(data)) {
        throw new Error('Oscillator missing signal emitter trait');
      }

      if (!data.signalState) {
        throw new Error(`Expected signalState=true, got ${data.signalState}`);
      }
    });
  },
});

visual('pressure switch toggles when player steps on it', {
  arrange: ({ spatial }) => {
    // Spawn pressure switch
    spawnPressureSwitch(spatial, 5, 5, GameLayers.COLLECTIBLES, {
      signalState: false,
      color: '#00ffff',
    });

    // Spawn player next to switch
    const playerId = spawnPlayer(spatial, 4, 5, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      inventory: [],
      sceneId: 'test-scene',
    });

    // Store ID for Act phase
    // We can attach it to the store or deduce it, but simpler to use a known ID spawn helper
    // or just find it in Act.
    // Since Act doesn't share scope variables easily with Arrange in this helper structure unless we put it in context.
    // Actually, Arrange and Act are separate functions.
    // Let's rely on finding the player in Act.
    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const signalSystem = new SignalSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(signalSystem);

    // Find player
    const playerId = spatial.getEntityIdAt(4, 5, GameLayers.ACTORS);
    if (playerId === undefined) throw new Error("Player not found in Act");

    // Move player onto pressure switch and commit
    spatial.move(playerId, 5, 5);
    spatial.commit(); // Commit the move first
    gameLoop.tick(); // Then tick to trigger pressure switch
  },
  assert: ({ spatial, expect }) => {
    expect('Pressure switch toggled ON when stepped on', () => {
      const switchId = spatial.getEntityIdAt(5, 5, GameLayers.COLLECTIBLES);
      if (!switchId) {
        throw new Error('Pressure switch not found');
      }

      const data = spatial.getEntityData(switchId);
      if (!data || !hasSignalEmitter(data)) {
        throw new Error('Pressure switch missing signal emitter trait');
      }

      if (!data.signalState) {
        throw new Error(`Expected signalState=true, got ${data.signalState}`);
      }
    });
  },
});

visual('conductive floor carries signal from oscillator to bollard', {
  arrange: ({ spatial }) => {
    // Setup: [O] - [=] - [=] - [B]
    // Oscillator at (5,5), conductive floors at (6,5) and (7,5), bollard at (8,5)

    // Spawn oscillator (starts ON)
    spawnOscillator(spatial, 5, 5, GameLayers.COLLECTIBLES, {
      signalState: true,
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    // Spawn conductive floors
    spawnConductiveFloor(spatial, 6, 5, { color: '#808080' });
    spawnConductiveFloor(spatial, 7, 5, { color: '#808080' });

    // Spawn closed bollard on WALLS layer
    spawnBollard(spatial, 8, 5, GameLayers.WALLS, {
      receivedSignal: false,
      color: '#ff0000',
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const signalSystem = new SignalSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(signalSystem);

    // Tick to propagate signal
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Bollard opened due to signal', () => {
      // Bollard should have moved to FLOOR layer (open)
      const bollardId = spatial.getEntityIdAt(8, 5, GameLayers.FLOOR);
      if (!bollardId) {
        throw new Error('Bollard not found on FLOOR layer (should be open)');
      }

      const data = spatial.getEntityData(bollardId);
      if (!data || !hasSignalReceiver(data)) {
        throw new Error('Bollard missing signal receiver trait');
      }

      if (!data.receivedSignal) {
        throw new Error('Bollard did not receive signal');
      }
    });

    expect('Bollard not on WALLS layer', () => {
      const wallsBollard = spatial.getEntityIdAt(8, 5, GameLayers.WALLS);
      if (wallsBollard) {
        throw new Error('Bollard still on WALLS layer (should be open on FLOOR)');
      }
    });
  },
});

visual('bollard closes when signal turns off', {
  arrange: ({ spatial }) => {
    // Oscillator (OFF), conductive floor, open bollard
    spawnOscillator(spatial, 5, 5, GameLayers.COLLECTIBLES, {
      signalState: false, // OFF
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    spawnConductiveFloor(spatial, 6, 5, { color: '#808080' });

    // Spawn open bollard on FLOOR layer
    spawnBollard(spatial, 7, 5, GameLayers.FLOOR, {
      receivedSignal: false,
      color: '#ff0000',
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const signalSystem = new SignalSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(signalSystem);

    // Tick to propagate (no signal, bollard should close)
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Bollard closed (moved to WALLS layer)', () => {
      const bollardId = spatial.getEntityIdAt(7, 5, GameLayers.WALLS);
      if (!bollardId) {
        throw new Error('Bollard not found on WALLS layer (should be closed)');
      }

      const data = spatial.getEntityData(bollardId);
      if (!data || !hasSignalReceiver(data)) {
        throw new Error('Bollard missing signal receiver trait');
      }

      if (data.receivedSignal) {
        throw new Error('Bollard incorrectly received signal');
      }
    });

    expect('Bollard not on FLOOR layer', () => {
      const floorBollard = spatial.getEntityIdAt(7, 5, GameLayers.FLOOR);
      if (floorBollard) {
        throw new Error('Bollard still on FLOOR layer (should be closed on WALLS)');
      }
    });
  },
});

visual('inverter outputs opposite of input signal', {
  arrange: ({ spatial }) => {
    // Setup: [O ON] - [=] - [I] - [=] - [B]
    // Oscillator ON → Inverter receives ON → outputs OFF → Bollard closed

    // Oscillator ON
    spawnOscillator(spatial, 5, 5, GameLayers.COLLECTIBLES, {
      signalState: true,
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    spawnConductiveFloor(spatial, 6, 5, { color: '#808080' });

    // Inverter
    spawnInverter(spatial, 7, 5, GameLayers.COLLECTIBLES, {
      signalState: false,
      receivedSignal: false,
      color: '#ff00ff',
    });

    spawnConductiveFloor(spatial, 8, 5, { color: '#808080' });

    // Bollard (closed on WALLS)
    spawnBollard(spatial, 9, 5, GameLayers.WALLS, {
      receivedSignal: false,
      color: '#ff0000',
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const signalSystem = new SignalSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(signalSystem);

    // Tick to propagate signals
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Inverter received ON signal', () => {
      const inverterId = spatial.getEntityIdAt(7, 5, GameLayers.COLLECTIBLES);
      if (!inverterId) {
        throw new Error('Inverter not found');
      }

      const data = spatial.getEntityData(inverterId);
      if (!data || !hasSignalReceiver(data)) {
        throw new Error('Inverter missing signal receiver trait');
      }

      if (!data.receivedSignal) {
        throw new Error('Inverter did not receive input signal');
      }
    });

    expect('Inverter emitting OFF signal (inverted)', () => {
      const inverterId = spatial.getEntityIdAt(7, 5, GameLayers.COLLECTIBLES);
      const data = spatial.getEntityData(inverterId!);

      if (!data || !hasSignalEmitter(data)) {
        throw new Error('Inverter missing signal emitter trait');
      }

      if (data.signalState) {
        throw new Error(`Expected inverter signalState=false (inverted), got ${data.signalState}`);
      }
    });

    expect('Bollard stayed closed (inverter output is OFF)', () => {
      const bollardId = spatial.getEntityIdAt(9, 5, GameLayers.WALLS);
      if (!bollardId) {
        throw new Error('Bollard not on WALLS layer (should be closed)');
      }
    });
  },
});

visual('signal does not propagate without conductive path', {
  arrange: ({ spatial }) => {
    // Setup: [O ON] at (5,5), gap at (6,5), [B] at (7,5)
    // No conductive path → bollard should not receive signal

    spawnOscillator(spatial, 5, 5, GameLayers.COLLECTIBLES, {
      signalState: true,
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    // NO conductive floor at (6, 5) - gap in network

    spawnBollard(spatial, 7, 5, GameLayers.WALLS, {
      receivedSignal: false,
      color: '#ff0000',
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const signalSystem = new SignalSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(signalSystem);

    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Bollard did not receive signal (no conductive path)', () => {
      const bollardId = spatial.getEntityIdAt(7, 5, GameLayers.WALLS);
      if (!bollardId) {
        throw new Error('Bollard not found');
      }

      const data = spatial.getEntityData(bollardId);
      if (!data || !hasSignalReceiver(data)) {
        throw new Error('Bollard missing signal receiver trait');
      }

      if (data.receivedSignal) {
        throw new Error('Bollard incorrectly received signal despite gap');
      }
    });

    expect('Bollard stayed closed', () => {
      const wallsBollard = spatial.getEntityIdAt(7, 5, GameLayers.WALLS);
      if (!wallsBollard) {
        throw new Error('Bollard moved off WALLS layer (should stay closed)');
      }
    });
  },
});

visual('oscillator cycles on and off over time', {
  arrange: ({ spatial }) => {
    spawnOscillator(spatial, 5, 5, GameLayers.COLLECTIBLES, {
      signalState: false,
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const signalSystem = new SignalSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(signalSystem);

    // Tick 41 times to see full cycle
    for (let i = 0; i < 41; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Oscillator toggled back to ON after full cycle', () => {
      const oscillatorId = spatial.getEntityIdAt(5, 5, GameLayers.COLLECTIBLES);
      if (!oscillatorId) {
        throw new Error('Oscillator not found');
      }

      const data = spatial.getEntityData(oscillatorId);
      if (!data || !hasSignalEmitter(data)) {
        throw new Error('Oscillator missing signal emitter trait');
      }

      // After 40 ticks: 0-19 OFF, 20-39 ON, 40 toggles back to OFF, 41 is OFF
      // Wait, at tick 20 it toggles to ON, at tick 40 it toggles to OFF
      // So at tick 41, it should be OFF
      if (data.signalState) {
        throw new Error(`Expected signalState=false after 41 ticks, got ${data.signalState}`);
      }
    });
  },
});

visual('pressure switch toggles off when stepped on again', {
  arrange: ({ spatial }) => {
    // Pressure switch starts ON
    spawnPressureSwitch(spatial, 5, 5, GameLayers.COLLECTIBLES, {
      signalState: true, // Already ON
      color: '#00ffff',
    });

    spawnPlayer(spatial, 4, 5, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      inventory: [],
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

    // Find player at (4, 5)
    const playerId = spatial.getEntityIdAt(4, 5, GameLayers.ACTORS);
    if (playerId === undefined) throw new Error("Player not found");

    // Move player onto switch and commit
    spatial.move(playerId, 5, 5);
    spatial.commit();
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Pressure switch toggled OFF', () => {
      const switchId = spatial.getEntityIdAt(5, 5, GameLayers.COLLECTIBLES);
      if (!switchId) {
        throw new Error('Pressure switch not found');
      }

      const data = spatial.getEntityData(switchId);
      if (!data || !hasSignalEmitter(data)) {
        throw new Error('Pressure switch missing signal emitter trait');
      }

      if (data.signalState) {
        throw new Error(`Expected signalState=false (toggled off), got ${data.signalState}`);
      }
    });
  },
});
