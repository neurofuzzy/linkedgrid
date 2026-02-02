import { visual } from './visual-helpers';
import { GameLayers } from '../config/layers.config';
import { spawnPlayer, spawnOscillator, spawnPressureSwitch, spawnInverter, spawnConductiveFloor, spawnGate, spawnTransceiver } from '../entities/spawn-helpers';
import { hasSignalEmitter, hasSignalReceiver, isGate, hasConductive } from '../traits/trait-guards';
import { SignalSystem } from '../systems/signal.system';
import { GateSystem } from '../systems/gate.system';
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
 * - Gates open/close based on signals
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
    gameLoop.addSystem(new GateSystem(gameManager));

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
    gameLoop.addSystem(new GateSystem(gameManager));

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

visual('conductive floor carries signal from oscillator to gate', {
  arrange: ({ spatial }) => {
    // Setup: [O] - [=] - [=] - [B]
    // Oscillator at (5,5), conductive floors at (6,5) and (7,5), gate at (8,5)

    // Spawn oscillator (starts ON)
    spawnOscillator(spatial, 5, 5, GameLayers.COLLECTIBLES, {
      signalState: true,
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    // Spawn conductive floors
    spawnConductiveFloor(spatial, 6, 5, { color: '#808080' });
    spawnConductiveFloor(spatial, 7, 5, { color: '#808080' });

    // Spawn closed gate on WALLS layer
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
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(signalSystem);
    gameLoop.addSystem(new GateSystem(gameManager));

    // Tick 1: Signal propagates, gate receives and becomes pending
    gameLoop.tick();
    // Tick 2: Gate acts on pending signal (1-tick delay for receivers)
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Gate opened due to signal', () => {
      // Gate should have moved to FLOOR layer (open)
      const gateId = spatial.getEntityIdAt(8, 5, GameLayers.FLOOR);
      if (!gateId) {
        throw new Error('Gate not found on FLOOR layer (should be open)');
      }

      const data = spatial.getEntityData(gateId);
      if (!data || !hasSignalReceiver(data)) {
        throw new Error('Gate missing signal receiver trait');
      }

      if (!data.receivedSignal) {
        throw new Error('Gate did not receive signal');
      }
    });

    expect('Gate not on WALLS layer', () => {
      const wallsGate = spatial.getEntityIdAt(8, 5, GameLayers.WALLS);
      if (wallsGate) {
        throw new Error('Gate still on WALLS layer (should be open on FLOOR)');
      }
    });
  },
});

visual('gate closes when signal turns off', {
  arrange: ({ spatial }) => {
    // Oscillator (OFF), conductive floor, open gate
    spawnOscillator(spatial, 5, 5, GameLayers.COLLECTIBLES, {
      signalState: false, // OFF
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    spawnConductiveFloor(spatial, 6, 5, { color: '#808080' });

    // Spawn open gate on FLOOR layer
    spawnGate(spatial, 7, 5, GameLayers.FLOOR, {
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
    gameLoop.addSystem(new GateSystem(gameManager));

    // Tick to propagate (no signal, gate should close)
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Gate closed (moved to WALLS layer)', () => {
      const gateId = spatial.getEntityIdAt(7, 5, GameLayers.WALLS);
      if (!gateId) {
        throw new Error('Gate not found on WALLS layer (should be closed)');
      }

      const data = spatial.getEntityData(gateId);
      if (!data || !hasSignalReceiver(data)) {
        throw new Error('Gate missing signal receiver trait');
      }

      if (data.receivedSignal) {
        throw new Error('Gate incorrectly received signal');
      }
    });

    expect('Gate not on FLOOR layer', () => {
      const floorGate = spatial.getEntityIdAt(7, 5, GameLayers.FLOOR);
      if (floorGate) {
        throw new Error('Gate still on FLOOR layer (should be closed on WALLS)');
      }
    });
  },
});

visual('inverter outputs opposite of input signal', {
  arrange: ({ spatial }) => {
    // Setup: [O ON] - [=] - [I] - [=] - [B]
    // Oscillator ON → Inverter receives ON → outputs OFF → Gate closed
    //
    // With 1-tick delay for inverters:
    // Tick 1: Signal propagates, inverter gets pendingSignal=true
    // Tick 2: Inverter applies pending, receivedSignal=true, signalState=false, emits
    // Gate receives pendingSignal=false from inverter output

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

    // Gate (closed on WALLS)
    spawnGate(spatial, 9, 5, GameLayers.WALLS, {
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
    gameLoop.addSystem(new GateSystem(gameManager));

    // Tick 1: Signal propagates, inverter gets pendingSignal
    gameLoop.tick();
    // Tick 2: Inverter applies pending, emits inverted signal
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

    expect('Gate stayed closed (inverter output is OFF)', () => {
      const gateId = spatial.getEntityIdAt(9, 5, GameLayers.WALLS);
      if (!gateId) {
        throw new Error('Gate not on WALLS layer (should be closed)');
      }
    });
  },
});

visual('inverter emits when not receiving signal', {
  arrange: ({ spatial }) => {
    // Setup: [O OFF] - [=] - [I] - [=] - [B]
    // Oscillator OFF → Inverter NOT receiving → outputs ON → Gate opens
    //
    // With 1-tick delay and state correction:
    // Tick 1: Oscillator OFF (no change), inverter state mismatch detected, queues emission
    // Tick 2: Inverter emits ON, conductor powered, gate gets pendingSignal
    // Tick 3: Gate applies pending, opens

    // Oscillator OFF
    spawnOscillator(spatial, 5, 5, GameLayers.COLLECTIBLES, {
      signalState: false, // OFF - inverter should emit
      oscillatorPeriod: 1000, // Long period so it stays off
      color: '#ffff00',
    });

    spawnConductiveFloor(spatial, 6, 5, { color: '#808080' });

    // Inverter (should emit since not receiving)
    spawnInverter(spatial, 7, 5, GameLayers.COLLECTIBLES, {
      signalState: false,
      receivedSignal: false,
      color: '#ff00ff',
    });

    spawnConductiveFloor(spatial, 8, 5, { color: '#808080' });

    // Gate (closed on WALLS)
    spawnGate(spatial, 9, 5, GameLayers.WALLS, {
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
    gameLoop.addSystem(new GateSystem(gameManager));

    // Tick 1: Inverter detects state mismatch, corrects, queues emission
    gameLoop.tick();
    // Tick 2: Inverter emits ON, gate gets pendingSignal
    gameLoop.tick();
    // Tick 3: Gate applies pending signal and opens
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Inverter NOT receiving signal', () => {
      const inverterId = spatial.getEntityIdAt(7, 5, GameLayers.COLLECTIBLES);
      const data = spatial.getEntityData(inverterId!);
      if (data && hasSignalReceiver(data) && data.receivedSignal) {
        throw new Error('Inverter should NOT have received signal');
      }
    });

    expect('Inverter emitting ON signal (inverted from OFF input)', () => {
      const inverterId = spatial.getEntityIdAt(7, 5, GameLayers.COLLECTIBLES);
      const data = spatial.getEntityData(inverterId!);

      if (!data || !hasSignalEmitter(data)) {
        throw new Error('Inverter missing signal emitter trait');
      }

      if (!data.signalState) {
        throw new Error(`Expected inverter signalState=true (inverted), got ${data.signalState}`);
      }
    });

    expect('Downstream conductor is powered', () => {
      const conductorId = spatial.getEntityIdAt(8, 5, GameLayers.FLOOR);
      const data = spatial.getEntityData(conductorId!);
      if (!data || !hasConductive(data)) {
        throw new Error('Conductor not found');
      }
      if (!data.receivedSignal) {
        throw new Error('Conductor did not receive signal from inverter');
      }
    });

    expect('Gate opened (inverter output is ON)', () => {
      const gateId = spatial.getEntityIdAt(9, 5, GameLayers.FLOOR);
      if (!gateId) {
        throw new Error('Gate not on FLOOR layer (should be open)');
      }
    });
  },
});

visual('signal does not propagate without conductive path', {
  arrange: ({ spatial }) => {
    // Setup: [O ON] at (5,5), gap at (6,5), [B] at (7,5)
    // No conductive path → gate should not receive signal

    spawnOscillator(spatial, 5, 5, GameLayers.COLLECTIBLES, {
      signalState: true,
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    // NO conductive floor at (6, 5) - gap in network

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
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(signalSystem);
    gameLoop.addSystem(new GateSystem(gameManager));

    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Gate did not receive signal (no conductive path)', () => {
      const gateId = spatial.getEntityIdAt(7, 5, GameLayers.WALLS);
      if (!gateId) {
        throw new Error('Gate not found');
      }

      const data = spatial.getEntityData(gateId);
      if (!data || !hasSignalReceiver(data)) {
        throw new Error('Gate missing signal receiver trait');
      }

      if (data.receivedSignal) {
        throw new Error('Gate incorrectly received signal despite gap');
      }
    });

    expect('Gate stayed closed', () => {
      const wallsGate = spatial.getEntityIdAt(7, 5, GameLayers.WALLS);
      if (!wallsGate) {
        throw new Error('Gate moved off WALLS layer (should stay closed)');
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
    gameLoop.addSystem(new GateSystem(gameManager));

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
    gameLoop.addSystem(new GateSystem(gameManager));

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

// Transceiver Tests

visual('transceiver broadcasts signal to same channel', {
  arrange: ({ spatial }) => {
    // Setup: [OSC ON] - [TX-A:ch1] ... gap ... [TX-B:ch1] - [BOLLARD]
    // Signal should hop wirelessly from TX-A to TX-B
    spawnOscillator(spatial, 2, 5, GameLayers.COLLECTIBLES, {
      signalState: true,
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    spawnConductiveFloor(spatial, 3, 5, { color: '#808080' });

    // Transceiver A on channel 'test-1'
    spawnTransceiver(spatial, 4, 5, GameLayers.COLLECTIBLES, 'test-1', {
      signalState: false,
      color: '#00ff88',
    });

    // Gap - no conductive path

    // Transceiver B on same channel 'test-1'
    spawnTransceiver(spatial, 7, 5, GameLayers.COLLECTIBLES, 'test-1', {
      signalState: false,
      color: '#00ff88',
    });

    spawnConductiveFloor(spatial, 8, 5, { color: '#808080' });

    spawnGate(spatial, 9, 5, GameLayers.WALLS, {
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
    gameLoop.addSystem(new GateSystem(gameManager));

    // Tick 1: Signal propagates to TX-A, TX-A broadcasts to channel
    gameLoop.tick();
    // Tick 2: TX-B receives channel broadcast, propagates to gate
    gameLoop.tick();
    // Tick 3: Gate acts on pending signal
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Remote transceiver received channel signal', () => {
      const txBId = spatial.getEntityIdAt(7, 5, GameLayers.COLLECTIBLES);
      if (!txBId) {
        throw new Error('Transceiver B not found');
      }

      const data = spatial.getEntityData(txBId);
      if (!data || !hasSignalReceiver(data)) {
        throw new Error('Transceiver B missing signal receiver trait');
      }

      if (!data.receivedSignal) {
        throw new Error('Transceiver B did not receive channel broadcast');
      }
    });

    expect('Gate opened via transceiver relay', () => {
      const gateId = spatial.getEntityIdAt(9, 5, GameLayers.FLOOR);
      if (!gateId) {
        throw new Error('Gate not found on FLOOR layer (should be open)');
      }
    });
  },
});

visual('transceivers on different channels do not interfere', {
  arrange: ({ spatial }) => {
    // TX-A on channel 'alpha', TX-B on channel 'beta' - no cross-talk
    spawnOscillator(spatial, 2, 5, GameLayers.COLLECTIBLES, {
      signalState: true,
      oscillatorPeriod: 40,
      color: '#ffff00',
    });

    spawnConductiveFloor(spatial, 3, 5, { color: '#808080' });

    // Transceiver A on channel 'alpha'
    spawnTransceiver(spatial, 4, 5, GameLayers.COLLECTIBLES, 'alpha', {
      signalState: false,
      color: '#00ff88',
    });

    // Transceiver B on DIFFERENT channel 'beta'
    spawnTransceiver(spatial, 7, 5, GameLayers.COLLECTIBLES, 'beta', {
      signalState: false,
      color: '#ff8800',
    });

    spawnConductiveFloor(spatial, 8, 5, { color: '#808080' });

    spawnGate(spatial, 9, 5, GameLayers.WALLS, {
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
    gameLoop.addSystem(new GateSystem(gameManager));

    // Multiple ticks to ensure no delayed propagation
    gameLoop.tick();
    gameLoop.tick();
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Transceiver B did not receive signal (different channel)', () => {
      const txBId = spatial.getEntityIdAt(7, 5, GameLayers.COLLECTIBLES);
      const data = spatial.getEntityData(txBId!);
      if (data && hasSignalReceiver(data) && data.receivedSignal) {
        throw new Error('Transceiver B incorrectly received signal from different channel');
      }
    });

    expect('Gate stayed closed (no signal path)', () => {
      const gateId = spatial.getEntityIdAt(9, 5, GameLayers.WALLS);
      if (!gateId) {
        throw new Error('Gate not on WALLS layer (should be closed)');
      }
    });
  },
});

visual('gates in series open with 1-tick delay each (cascading)', {
  arrange: ({ spatial }) => {
    // Setup: [OSC ON] - [=] - [GATE1] - [=] - [GATE2] - [=] - [GATE3]
    // Gates should open sequentially, one per tick after the signal reaches them

    spawnOscillator(spatial, 0, 5, GameLayers.COLLECTIBLES, {
      signalState: true,
      oscillatorPeriod: 1000, // Long period so it stays on
      color: '#ffff00',
    });

    spawnConductiveFloor(spatial, 1, 5, { color: '#808080' });

    // Gate 1
    spawnGate(spatial, 2, 5, GameLayers.WALLS, {
      receivedSignal: false,
      color: '#ff0000',
    });

    spawnConductiveFloor(spatial, 3, 5, { color: '#808080' });

    // Gate 2
    spawnGate(spatial, 4, 5, GameLayers.WALLS, {
      receivedSignal: false,
      color: '#00ff00',
    });

    spawnConductiveFloor(spatial, 5, 5, { color: '#808080' });

    // Gate 3
    spawnGate(spatial, 6, 5, GameLayers.WALLS, {
      receivedSignal: false,
      color: '#0000ff',
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    const signalSystem = new SignalSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(signalSystem);
    gameLoop.addSystem(new GateSystem(gameManager));

    // Tick 1: Signal propagates to Gate1 (pending)
    gameLoop.tick();
    // Tick 2: Gate1 opens (but signal propagation already done for this tick)
    gameLoop.tick();
    // Tick 3: Signal propagates through open Gate1 to Gate2 (receives) -> Gate2 Opens!
    // AND Gate2 acts as source -> propagates to Gate3 (pending)
    gameLoop.tick();

    // Total 3 ticks:
    // T1: G1 Pending
    // T2: G1 Open, G2 Pending
    // T3: G2 Open, G3 Pending
    // Stop here - Gate3 should have pendingSignal but not be open yet
  },
  assert: ({ spatial, expect }) => {
    expect('Gate1 opened (after tick 2)', () => {
      const gateId = spatial.getEntityIdAt(2, 5, GameLayers.FLOOR);
      if (!gateId) {
        throw new Error('Gate1 not on FLOOR layer (should be open)');
      }
    });

    expect('Gate2 opened (after tick 4)', () => {
      const gateId = spatial.getEntityIdAt(4, 5, GameLayers.FLOOR);
      if (!gateId) {
        throw new Error('Gate2 not on FLOOR layer (should be open)');
      }
    });

    expect('Gate3 still closed (needs tick 6)', () => {
      const gateId = spatial.getEntityIdAt(6, 5, GameLayers.WALLS);
      if (!gateId) {
        throw new Error('Gate3 should still be on WALLS layer (closed)');
      }
    });
  },
});
