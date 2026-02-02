import { visual } from './visual-helpers';
import { GameLayers } from '../config/layers.config';
import { spawnPlayer, spawnPressureSwitch, spawnConductiveFloor, spawnGate } from '../entities/spawn-helpers';
import { hasSignalEmitter, isGate } from '../traits/trait-guards';
import { SignalSystem } from '../systems/signal.system';
import { GateSystem } from '../systems/gate.system';
import { GameManager } from '../core/game-manager';
import { GameLoop } from '../core/game-loop';

/**
 * Pressure Switch Mode Tests
 *
 * Tests for the 4 pressure switch activation modes:
 * - toggle: Flips state on each step
 * - hold: ON while pressed, OFF when released
 * - latch: OFF → ON on first press, stays ON forever
 * - inverted-latch: ON → OFF on first press, stays OFF forever
 */

visual('pressure switch mode: toggle', {
  arrange: ({ spatial }) => {
    // Spawn toggle mode pressure switch (default)
    spawnPressureSwitch(spatial, 5, 5, GameLayers.COLLECTIBLES, {
      signalState: false,
      switchMode: 'toggle',
      color: '#00ffff',
    });

    // Spawn player
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

    // Find player
    const playerId = spatial.getEntityIdAt(4, 5, GameLayers.ACTORS);
    if (playerId === undefined) throw new Error('Player not found');

    // Step 1: Move player onto switch
    spatial.move(playerId, 5, 5);
    spatial.commit();
    gameLoop.tick();

    // Step 2: Move player off switch
    spatial.move(playerId, 4, 5);
    spatial.commit();
    gameLoop.tick();

    // Step 3: Move player back onto switch
    spatial.move(playerId, 5, 5);
    spatial.commit();
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Switch toggled OFF after second press', () => {
      const switchId = spatial.getEntityIdAt(5, 5, GameLayers.COLLECTIBLES);
      if (!switchId) throw new Error('Switch not found');

      const data = spatial.getEntityData(switchId);
      if (!data || !hasSignalEmitter(data)) {
        throw new Error('Switch missing signal emitter trait');
      }

      // First step ON, second step OFF
      if (data.signalState) {
        throw new Error(`Expected signalState=false, got ${data.signalState}`);
      }
    });
  },
});

visual('pressure switch mode: hold', {
  arrange: ({ spatial }) => {
    // Spawn hold mode pressure switch
    spawnPressureSwitch(spatial, 5, 5, GameLayers.COLLECTIBLES, {
      signalState: false,
      switchMode: 'hold',
      color: '#00ffff',
    });

    // Spawn player
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

    // Find player
    const playerId = spatial.getEntityIdAt(4, 5, GameLayers.ACTORS);
    if (playerId === undefined) throw new Error('Player not found');

    // Step 1: Move player onto switch
    spatial.move(playerId, 5, 5);
    spatial.commit();
    gameLoop.tick();

    // Step 2: Stay on switch
    gameLoop.tick();

    // Step 3: Move player off switch
    spatial.move(playerId, 4, 5);
    spatial.commit();
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Switch OFF when released', () => {
      const switchId = spatial.getEntityIdAt(5, 5, GameLayers.COLLECTIBLES);
      if (!switchId) throw new Error('Switch not found');

      const data = spatial.getEntityData(switchId);
      if (!data || !hasSignalEmitter(data)) {
        throw new Error('Switch missing signal emitter trait');
      }

      // Should be OFF after stepping off
      if (data.signalState) {
        throw new Error(`Expected signalState=false, got ${data.signalState}`);
      }
    });
  },
});

visual('pressure switch mode: latch', {
  arrange: ({ spatial }) => {
    // Spawn latch mode pressure switch
    spawnPressureSwitch(spatial, 5, 5, GameLayers.COLLECTIBLES, {
      signalState: false,
      switchMode: 'latch',
      color: '#00ffff',
    });

    // Spawn player
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

    // Find player
    const playerId = spatial.getEntityIdAt(4, 5, GameLayers.ACTORS);
    if (playerId === undefined) throw new Error('Player not found');

    // Step 1: Move player onto switch
    spatial.move(playerId, 5, 5);
    spatial.commit();
    gameLoop.tick();

    // Step 2: Move player off switch
    spatial.move(playerId, 4, 5);
    spatial.commit();
    gameLoop.tick();

    // Step 3: Move back onto switch
    spatial.move(playerId, 5, 5);
    spatial.commit();
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Switch stays ON after first press', () => {
      const switchId = spatial.getEntityIdAt(5, 5, GameLayers.COLLECTIBLES);
      if (!switchId) throw new Error('Switch not found');

      const data = spatial.getEntityData(switchId);
      if (!data || !hasSignalEmitter(data)) {
        throw new Error('Switch missing signal emitter trait');
      }

      // Should stay ON even after stepping off and back on
      if (!data.signalState) {
        throw new Error(`Expected signalState=true, got ${data.signalState}`);
      }
    });
  },
});

visual('pressure switch mode: inverted-latch', {
  arrange: ({ spatial }) => {
    // Spawn inverted-latch mode pressure switch (starts ON)
    spawnPressureSwitch(spatial, 5, 5, GameLayers.COLLECTIBLES, {
      signalState: true, // Starts ON
      switchMode: 'inverted-latch',
      color: '#00ffff',
    });

    // Connect to gate to verify signal
    spawnConductiveFloor(spatial, 6, 5);
    spawnGate(spatial, 7, 5, GameLayers.WALLS, {
      receivedSignal: false,
      color: '#ff0000',
    });

    // Spawn player
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
    const gateSystem = new GateSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(signalSystem);
    gameLoop.addSystem(gateSystem);

    // Find player
    const playerId = spatial.getEntityIdAt(4, 5, GameLayers.ACTORS);
    if (playerId === undefined) throw new Error('Player not found');

    // Initial tick to propagate signal
    gameLoop.tick();

    // Step 1: Move player onto switch
    spatial.move(playerId, 5, 5);
    spatial.commit();
    gameLoop.tick();

    // Step 2: Move player off switch
    spatial.move(playerId, 4, 5);
    spatial.commit();
    gameLoop.tick();

    // Step 3: Move back onto switch
    spatial.move(playerId, 5, 5);
    spatial.commit();
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Switch stays OFF after first press', () => {
      const switchId = spatial.getEntityIdAt(5, 5, GameLayers.COLLECTIBLES);
      if (!switchId) throw new Error('Switch not found');

      const data = spatial.getEntityData(switchId);
      if (!data || !hasSignalEmitter(data)) {
        throw new Error('Switch missing signal emitter trait');
      }

      // Should stay OFF even after stepping off and back on
      if (data.signalState) {
        throw new Error(`Expected signalState=false, got ${data.signalState}`);
      }
    });

    expect('Gate closed when switch turns OFF', () => {
      // Gate should be closed (on WALLS layer)
      const gateId = spatial.getEntityIdAt(7, 5, GameLayers.WALLS);
      if (!gateId) {
        throw new Error('Gate not found on WALLS layer (should be closed)');
      }

      const data = spatial.getEntityData(gateId);
      if (!data || !isGate(data)) {
        throw new Error('Gate missing gate trait');
      }

      if (data.type !== 'gate-closed') {
        throw new Error(`Expected gate-closed, got ${data.type}`);
      }
    });
  },
});
