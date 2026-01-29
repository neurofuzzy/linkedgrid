import { describe, it, expect } from 'vitest';
import { GameRuntime } from '../game-runtime.js';
import { GameLayers } from '../layers/types.js';

describe('GameRuntime', () => {
  it('should create and initialize game', () => {
    const runtime = GameRuntime.new({
      initialScene: { id: 'test', width: 10, height: 10 },
      systems: [],
      tickRate: 10,
    });

    expect(runtime.game).toBeDefined();
    expect(runtime.activeScene.id).toBe('test');
    expect(runtime.isRunning).toBe(false);
    expect(runtime.tickCount).toBe(0);
  });

  it('should execute manual ticks', () => {
    const runtime = GameRuntime.new({
      initialScene: { id: 'test', width: 10, height: 10 },
      systems: [],
    });

    const playerId = runtime.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    runtime.spatial.commit();
    runtime.spatial.move(playerId, 6, 5);

    runtime.tick();

    const pos = runtime.spatial.getEntityPosition(playerId);
    expect(pos?.x).toBe(6);
    expect(pos?.y).toBe(5);
  });

  it('should save and load game state', () => {
    const runtime1 = GameRuntime.new({
      initialScene: { id: 'level1', width: 10, height: 10 },
      systems: [],
    });

    const playerId = runtime1.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    runtime1.spatial.commit();
    runtime1.game.gameState.playerEntityId = playerId;
    runtime1.game.gameState.score = 1000;
    runtime1.game.gameState.lives = 3;

    // Execute some ticks
    runtime1.tick();
    runtime1.tick();

    const saveData = runtime1.save();

    // Verify save data
    expect(saveData.gameState.score).toBe(1000);
    expect(saveData.tickCount).toBe(2);

    // Load into new runtime
    const runtime2 = GameRuntime.load(saveData, []);

    expect(runtime2.game.gameState.score).toBe(1000);
    expect(runtime2.game.gameState.lives).toBe(3);
    expect(runtime2.game.gameState.playerEntityId).toBe(playerId);
    expect(runtime2.tickCount).toBe(2);

    // Verify player position preserved
    const pos = runtime2.spatial.getEntityPosition(playerId);
    expect(pos).toEqual({ x: 5, y: 5, layer: GameLayers.ACTORS });
  });

  it('should restart game to initial state', () => {
    const runtime = GameRuntime.new({
      initialScene: { id: 'test', width: 10, height: 10 },
      systems: [],
    });

    // Spawn entities and run ticks
    runtime.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    runtime.spatial.spawn('enemy', 7, 7, GameLayers.ACTORS);
    runtime.spatial.commit();
    runtime.tick();
    runtime.tick();

    expect(runtime.tickCount).toBe(2);

    // Restart
    runtime.restart();

    // Verify reset
    expect(runtime.tickCount).toBe(0);
    expect(runtime.isRunning).toBe(false);

    // Verify grid is empty
    const positions = Array.from(runtime.spatial.getAllPositions());
    expect(positions.length).toBe(0);
  });

  it('should handle scene transitions', () => {
    const runtime = GameRuntime.new({
      initialScene: { id: 'room1', width: 10, height: 10 },
      systems: [],
    });

    // Create second scene
    runtime.game.sceneManager.createScene('room2', 15, 15);

    // Spawn player in room1
    const room1 = runtime.game.sceneManager.getScene('room1')!;
    const playerId = room1.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    room1.spatial.commit();
    runtime.game.gameState.playerEntityId = playerId;

    expect(runtime.activeScene.id).toBe('room1');

    // Move player to room2
    runtime.game.movePlayerToScene('room2', 7, 7, GameLayers.ACTORS);
    runtime.tick(); // This should detect scene change and reinit loop

    expect(runtime.activeScene.id).toBe('room2');

    // Verify player in new scene
    const pos = runtime.game.getPlayerPosition();
    expect(pos?.sceneId).toBe('room2');
    expect(pos?.x).toBe(7);
    expect(pos?.y).toBe(7);
  });

  it('should provide convenient spatial access', () => {
    const runtime = GameRuntime.new({
      initialScene: { id: 'test', width: 10, height: 10 },
      systems: [],
    });

    // Should access active scene's spatial
    const playerId = runtime.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    runtime.spatial.commit();

    const pos = runtime.spatial.getEntityPosition(playerId);
    expect(pos).toEqual({ x: 5, y: 5, layer: GameLayers.ACTORS });
  });
});
