/**
 * Tests for Range Sensor entity and SignalSystem integration.
 *
 * Range sensors emit ON when the player is within range (+ optional LOS),
 * and emit OFF when the player leaves range or LOS is broken.
 *
 * Tests:
 * - Activates when player is within range
 * - Deactivates when player leaves range
 * - Respects LOS requirement (blocked by walls)
 * - Works without LOS requirement
 * - Propagates signal through conductive network
 * - Multiple range sensors operate independently
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialSystem } from '../core/spatial-system';
import { SparseEntityStore } from '../core/entity-store';
import { LinkedGrid } from '../core/grid/linked-grid';
import { GameLoop } from '../core/game-loop';
import { GameState } from '../core/game-state';
import { GameManager } from '../core/game-manager';
import { SignalSystem } from '../systems/signal.system';
import { GateSystem } from '../systems/gate.system';
import { GameLayers } from '../config/layers.config';

describe('Range Sensor', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let signalSystem: SignalSystem;

  beforeEach(() => {
    grid = new LinkedGrid(20, 20);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);

    gameManager = new GameManager(
      new GameState(),
    );
    // Override internal scene reference for testing
    const scene = gameManager.sceneManager.createScene('test', 20, 20);
    gameManager.sceneManager.setActiveScene('test');
    // Use the scene's spatial system
    spatial = scene.spatial;

    signalSystem = new SignalSystem(gameManager);
    gameLoop = new GameLoop(spatial, gameManager);
    gameLoop.addSystem(signalSystem);
  });

  it('activates when player is within range', () => {
    // Arrange: player at (5,10), range sensor at (8,10) with range 5
    const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, sceneId: 'test',
    });
    gameManager.gameState.playerEntityId = playerId;

    const sensorId = spatial.spawn('range-sensor', 8, 10, GameLayers.COLLECTIBLES, {
      signalType: 'range-sensor',
      signalState: false,
      sensorRange: 5,
      requiresLOS: false,
      color: '#00ffaa',
    });
    spatial.commit();

    // Act
    gameLoop.tick();

    // Assert: sensor should be ON (player is 3 cells away, within range 5)
    const sensorData = spatial.getEntityData(sensorId);
    expect(sensorData?.signalState).toBe(true);
  });

  it('deactivates when player leaves range', () => {
    // Arrange: player at (5,10), sensor at (8,10), range 3
    const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, sceneId: 'test',
    });
    gameManager.gameState.playerEntityId = playerId;

    const sensorId = spatial.spawn('range-sensor', 8, 10, GameLayers.COLLECTIBLES, {
      signalType: 'range-sensor',
      signalState: false,
      sensorRange: 3,
      requiresLOS: false,
      color: '#00ffaa',
    });
    spatial.commit();

    // Act: player is 3 cells away, exactly at edge of range
    gameLoop.tick();
    const sensorOn = spatial.getEntityData(sensorId);
    expect(sensorOn?.signalState).toBe(true);

    // Move player far away
    spatial.move(playerId, 1, 1);
    spatial.commit();
    gameLoop.tick();

    // Assert: sensor should be OFF
    const sensorOff = spatial.getEntityData(sensorId);
    expect(sensorOff?.signalState).toBe(false);
  });

  it('does not activate when player is out of range', () => {
    // Arrange: player far from sensor
    const playerId = spatial.spawn('player', 1, 1, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, sceneId: 'test',
    });
    gameManager.gameState.playerEntityId = playerId;

    const sensorId = spatial.spawn('range-sensor', 15, 15, GameLayers.COLLECTIBLES, {
      signalType: 'range-sensor',
      signalState: false,
      sensorRange: 5,
      requiresLOS: false,
      color: '#00ffaa',
    });
    spatial.commit();

    // Act
    gameLoop.tick();

    // Assert: sensor stays OFF (player is 28 cells away, way out of range 5)
    const sensorData = spatial.getEntityData(sensorId);
    expect(sensorData?.signalState).toBe(false);
  });

  it('respects LOS requirement - blocked by wall', () => {
    // Arrange: player at (5,10), sensor at (8,10), wall at (6,10)
    const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, sceneId: 'test',
    });
    gameManager.gameState.playerEntityId = playerId;

    spatial.spawn('wall', 6, 10, GameLayers.WALLS, {});

    const sensorId = spatial.spawn('range-sensor', 8, 10, GameLayers.COLLECTIBLES, {
      signalType: 'range-sensor',
      signalState: false,
      sensorRange: 5,
      requiresLOS: true, // Requires LOS
      color: '#00ffaa',
    });
    spatial.commit();
    spatial.syncMasks();

    // Act
    gameLoop.tick();

    // Assert: sensor stays OFF (wall blocks LOS)
    const sensorData = spatial.getEntityData(sensorId);
    expect(sensorData?.signalState).toBe(false);
  });

  it('activates with LOS when path is clear', () => {
    // Arrange: player at (5,10), sensor at (8,10), no obstacles
    const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, sceneId: 'test',
    });
    gameManager.gameState.playerEntityId = playerId;

    const sensorId = spatial.spawn('range-sensor', 8, 10, GameLayers.COLLECTIBLES, {
      signalType: 'range-sensor',
      signalState: false,
      sensorRange: 5,
      requiresLOS: true,
      color: '#00ffaa',
    });
    spatial.commit();

    // Act
    gameLoop.tick();

    // Assert: sensor is ON (clear LOS, within range)
    const sensorData = spatial.getEntityData(sensorId);
    expect(sensorData?.signalState).toBe(true);
  });

  it('propagates signal to open a gate', () => {
    // Arrange: player near sensor, sensor connected to gate via conductive floor
    const playerId = spatial.spawn('player', 3, 10, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, sceneId: 'test',
    });
    gameManager.gameState.playerEntityId = playerId;

    // Range sensor at (5,10)
    spatial.spawn('range-sensor', 5, 10, GameLayers.COLLECTIBLES, {
      signalType: 'range-sensor',
      signalState: false,
      sensorRange: 5,
      requiresLOS: false,
      color: '#00ffaa',
    });

    // Conductive floor path from (6,10) to (9,10)
    for (let x = 6; x <= 9; x++) {
      spatial.spawn('conductive-floor', x, 10, GameLayers.FLOOR, {
        conductiveType: 'floor',
        receiverType: 'floor',
        receivedSignal: false,
        color: '#808080',
      });
    }

    // Gate at (10,10) on WALLS layer (closed)
    const gateId = spatial.spawn('gate-closed', 10, 10, GameLayers.WALLS, {
      receiverType: 'gate',
      receivedSignal: false,
      color: '#ff0000',
    });
    spatial.commit();

    // Add gate system
    const gateSystem = new GateSystem(gameManager);
    gameLoop.addSystem(gateSystem);

    // Act: tick to activate sensor and propagate signal
    gameLoop.tick(); // Sensor activates, signal propagates instantly to conductors, gate gets pending
    gameLoop.tick(); // Gate applies pending signal

    // Assert: gate should have received the signal
    const gateData = spatial.getEntityData(gateId);
    expect(gateData?.receivedSignal).toBe(true);
  });

  it('multiple range sensors operate independently', () => {
    // Arrange: player near sensor1 but far from sensor2
    const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, sceneId: 'test',
    });
    gameManager.gameState.playerEntityId = playerId;

    const sensor1Id = spatial.spawn('range-sensor', 7, 10, GameLayers.COLLECTIBLES, {
      signalType: 'range-sensor',
      signalState: false,
      sensorRange: 3,
      requiresLOS: false,
      color: '#00ffaa',
    });

    const sensor2Id = spatial.spawn('range-sensor', 15, 15, GameLayers.COLLECTIBLES, {
      signalType: 'range-sensor',
      signalState: false,
      sensorRange: 3,
      requiresLOS: false,
      color: '#00ffaa',
    });
    spatial.commit();

    // Act
    gameLoop.tick();

    // Assert: sensor1 ON (player 2 cells away), sensor2 OFF (player far away)
    const s1 = spatial.getEntityData(sensor1Id);
    const s2 = spatial.getEntityData(sensor2Id);
    expect(s1?.signalState).toBe(true);
    expect(s2?.signalState).toBe(false);
  });
});
