import { visual } from './visual-helpers';
import { GameLayers } from '../config/layers.config';
import { spawnOscillator, spawnPathNode, spawnGate, spawnConductiveFloor } from '../entities/spawn-helpers';
import { isGate, hasSignalReceiver } from '../traits/trait-guards';
import { SignalSystem } from '../systems/signal.system';
import { GateSystem } from '../systems/gate.system';
import { GameManager } from '../core/game-manager';
import { GameLoop } from '../core/game-loop';

/**
 * Path Node Signal Propagation Tests
 *
 * Tests for signal propagation through path nodes on LOGIC layer:
 * - Path nodes conduct signals on LOGIC layer
 * - Mixed FLOOR + LOGIC conduction
 * - Path nodes can power receivers on other layers
 */

visual('path nodes conduct signals on LOGIC layer', {
  arrange: ({ spatial }) => {
    // Create a signal network on LOGIC layer using path nodes
    spawnOscillator(spatial, 3, 5, GameLayers.LOGIC, {
      signalState: true,
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    // Chain of path nodes
    spawnPathNode(spatial, 4, 5, { color: '#888888' });
    spawnPathNode(spatial, 5, 5, { color: '#888888' });
    spawnPathNode(spatial, 6, 5, { color: '#888888' });

    // Gate controlled by path network
    spawnGate(spatial, 7, 5, GameLayers.WALLS, {
      receivedSignal: false,
      color: '#ff0000',
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

    // Run two ticks: tick 1 sets pendingSignal, tick 2 opens gate
    gameLoop.tick();
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Path nodes receive signal', () => {
      const pathNode1 = spatial.getEntityIdAt(4, 5, GameLayers.LOGIC);
      if (!pathNode1) throw new Error('Path node 1 not found');

      const data1 = spatial.getEntityData(pathNode1);
      if (!data1 || !hasSignalReceiver(data1)) {
        throw new Error('Path node missing signal receiver trait');
      }

      if (!data1.receivedSignal) {
        throw new Error('Path node 1 should have received signal');
      }

      const pathNode2 = spatial.getEntityIdAt(6, 5, GameLayers.LOGIC);
      if (!pathNode2) throw new Error('Path node 2 not found');

      const data2 = spatial.getEntityData(pathNode2);
      if (!data2 || !hasSignalReceiver(data2)) {
        throw new Error('Path node 2 missing signal receiver trait');
      }

      if (!data2.receivedSignal) {
        throw new Error('Path node 2 should have received signal');
      }
    });

    expect('Gate opens from LOGIC layer signal', () => {
      // Gate should be open (on FLOOR layer)
      const gateId = spatial.getEntityIdAt(7, 5, GameLayers.FLOOR);
      if (!gateId) {
        throw new Error('Gate not found on FLOOR layer (should be open)');
      }

      const data = spatial.getEntityData(gateId);
      if (!data || !isGate(data)) {
        throw new Error('Gate missing gate trait');
      }

      if (data.type !== 'gate-open') {
        throw new Error(`Expected gate-open, got ${data.type}`);
      }
    });
  },
});

visual('mixed FLOOR and LOGIC layer signal propagation', {
  arrange: ({ spatial }) => {
    // Create a mixed network: FLOOR → LOGIC → FLOOR
    spawnOscillator(spatial, 3, 5, GameLayers.COLLECTIBLES, {
      signalState: true,
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    // Conductive floor on FLOOR layer
    spawnConductiveFloor(spatial, 4, 5, { color: '#808080' });

    // Path node on LOGIC layer (same cell, different layer)
    spawnPathNode(spatial, 4, 5, { color: '#888888' });

    // More path nodes on LOGIC layer
    spawnPathNode(spatial, 5, 5, { color: '#888888' });
    spawnPathNode(spatial, 6, 5, { color: '#888888' });

    // Back to FLOOR layer
    spawnConductiveFloor(spatial, 7, 5, { color: '#808080' });

    // Gate at the end
    spawnGate(spatial, 8, 5, GameLayers.WALLS, {
      receivedSignal: false,
      color: '#ff0000',
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

    // Run two ticks: tick 1 sets pendingSignal, tick 2 opens gate
    gameLoop.tick();
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Signal propagates through mixed layers', () => {
      // Check conductive floor received signal
      const floorId = spatial.getEntityIdAt(4, 5, GameLayers.FLOOR);
      if (!floorId) throw new Error('Conductive floor not found');

      const floorData = spatial.getEntityData(floorId);
      if (!floorData || !hasSignalReceiver(floorData)) {
        throw new Error('Floor missing signal receiver trait');
      }

      if (!floorData.receivedSignal) {
        throw new Error('Conductive floor should have received signal');
      }

      // Check path node received signal
      const pathNodeId = spatial.getEntityIdAt(5, 5, GameLayers.LOGIC);
      if (!pathNodeId) throw new Error('Path node not found');

      const pathData = spatial.getEntityData(pathNodeId);
      if (!pathData || !hasSignalReceiver(pathData)) {
        throw new Error('Path node missing signal receiver trait');
      }

      if (!pathData.receivedSignal) {
        throw new Error('Path node should have received signal');
      }
    });

    expect('Gate opens from mixed layer signal', () => {
      // Gate should be open (on FLOOR layer)
      const gateId = spatial.getEntityIdAt(8, 5, GameLayers.FLOOR);
      if (!gateId) {
        throw new Error('Gate not found on FLOOR layer (should be open)');
      }

      const data = spatial.getEntityData(gateId);
      if (!data || !isGate(data)) {
        throw new Error('Gate missing gate trait');
      }

      if (data.type !== 'gate-open') {
        throw new Error(`Expected gate-open, got ${data.type}`);
      }
    });
  },
});

visual('path nodes enable invisible signal networks', {
  arrange: ({ spatial }) => {
    // Create an invisible network that bridges two visible areas
    // Visible area 1
    spawnOscillator(spatial, 2, 5, GameLayers.COLLECTIBLES, {
      signalState: true,
      oscillatorPeriod: 40,
      color: '#ffff00',
    });
    spawnConductiveFloor(spatial, 3, 5, { color: '#808080' });

    // Invisible bridge on LOGIC layer
    spawnPathNode(spatial, 4, 5, { color: '#888888' });
    spawnPathNode(spatial, 5, 5, { color: '#888888' });
    spawnPathNode(spatial, 6, 5, { color: '#888888' });

    // Visible area 2
    spawnConductiveFloor(spatial, 7, 5, { color: '#808080' });
    spawnGate(spatial, 8, 5, GameLayers.WALLS, {
      receivedSignal: false,
      color: '#ff0000',
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

    // Run two ticks: tick 1 sets pendingSignal, tick 2 opens gate
    gameLoop.tick();
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Signal bridges invisible gap', () => {
      // Gate should open even though visible connection appears broken
      const gateId = spatial.getEntityIdAt(8, 5, GameLayers.FLOOR);
      if (!gateId) {
        throw new Error('Gate not found on FLOOR layer (should be open)');
      }

      const data = spatial.getEntityData(gateId);
      if (!data || !isGate(data)) {
        throw new Error('Gate missing gate trait');
      }

      if (data.type !== 'gate-open') {
        throw new Error(`Expected gate-open, got ${data.type}`);
      }
    });
  },
});
