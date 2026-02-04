import { describe, it, expect, vi } from 'vitest';
import { GameRuntime, type GameConfig, type SystemFactory } from '../core/game-runtime';
import { GameLayers } from '../config/layers.config';
import type { GameSystem } from '../core/types';

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

describe('GameRuntime.fromConfig', () => {
  // Mock system factory that returns null (no systems)
  const nullSystemFactory: SystemFactory = () => null;

  it('should create all scenes from config', () => {
    const config: GameConfig = {
      initialScene: 'room1',
      systems: [],
      scenes: [
        { id: 'room1', width: 20, height: 20, entities: [] },
        { id: 'room2', width: 30, height: 30, entities: [] },
      ],
    };

    const runtime = GameRuntime.fromConfig(config, nullSystemFactory);

    expect(runtime.game.sceneManager.getScene('room1')).toBeDefined();
    expect(runtime.game.sceneManager.getScene('room2')).toBeDefined();
    expect(runtime.activeScene.id).toBe('room1');
  });

  it('should spawn entities in scenes', () => {
    const config: GameConfig = {
      initialScene: 'room1',
      systems: [],
      scenes: [
        {
          id: 'room1',
          width: 20,
          height: 20,
          entities: [
            { type: 'player', x: 5, y: 5, layer: GameLayers.ACTORS, data: { hp: 100, maxHp: 100, damage: 10 } },
            { type: 'wall', x: 10, y: 10, layer: GameLayers.WALLS },
          ],
        },
      ],
    };

    const runtime = GameRuntime.fromConfig(config, nullSystemFactory);
    const spatial = runtime.spatial;

    // Verify player spawned
    const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS);
    expect(playerId).toBeDefined();
    const playerData = spatial.getEntityData(playerId!);
    expect(playerData?.type).toBe('player');

    // Verify wall spawned
    const wallId = spatial.getEntityIdAt(10, 10, GameLayers.WALLS);
    expect(wallId).toBeDefined();
  });

  it('should register scene connections for teleporters with connectionKey', () => {
    const config: GameConfig = {
      initialScene: 'room1',
      systems: [],
      scenes: [
        {
          id: 'room1',
          width: 20,
          height: 20,
          entities: [
            {
              type: 'teleporter',
              x: 5,
              y: 5,
              layer: GameLayers.FLOOR,
              data: { connectionKey: 'red', targetKey: 'red', sceneId: 'room1' },
            },
          ],
        },
        {
          id: 'room2',
          width: 20,
          height: 20,
          entities: [
            {
              type: 'teleporter',
              x: 10,
              y: 10,
              layer: GameLayers.FLOOR,
              data: { connectionKey: 'red', targetKey: 'red', sceneId: 'room2' },
            },
          ],
        },
      ],
    };

    const runtime = GameRuntime.fromConfig(config, nullSystemFactory);
    const connections = runtime.game.gameState.getConnections('red');

    expect(connections).toHaveLength(2);
    expect(connections[0]).toMatchObject({ sceneId: 'room1', x: 5, y: 5 });
    expect(connections[1]).toMatchObject({ sceneId: 'room2', x: 10, y: 10 });
  });

  it('should warn about orphaned connections', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn');

    const config: GameConfig = {
      initialScene: 'room1',
      systems: [],
      scenes: [
        {
          id: 'room1',
          width: 20,
          height: 20,
          entities: [
            {
              type: 'teleporter',
              x: 5,
              y: 5,
              layer: GameLayers.FLOOR,
              data: { connectionKey: 'blue', targetKey: 'blue', sceneId: 'room1' },
            },
          ],
        },
      ],
    };

    GameRuntime.fromConfig(config, nullSystemFactory);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Connection "blue" has only 1 endpoint')
    );

    consoleWarnSpy.mockRestore();
  });

  it('should set player entity ID from initial scene', () => {
    const config: GameConfig = {
      initialScene: 'room1',
      systems: [],
      scenes: [
        {
          id: 'room1',
          width: 20,
          height: 20,
          entities: [
            { type: 'player', x: 5, y: 5, layer: GameLayers.ACTORS, data: { hp: 100, maxHp: 100, damage: 10 } },
          ],
        },
      ],
    };

    const runtime = GameRuntime.fromConfig(config, nullSystemFactory);

    expect(runtime.game.gameState.playerEntityId).not.toBe(0);

    const playerPos = runtime.game.getPlayerPosition();
    expect(playerPos?.x).toBe(5);
    expect(playerPos?.y).toBe(5);
  });

  it('should call system factory for configured systems', () => {
    const mockFactory = vi.fn<SystemFactory>().mockReturnValue(null);

    const config: GameConfig = {
      initialScene: 'room1',
      systems: ['TestSystem', 'AnotherSystem'],
      scenes: [{ id: 'room1', width: 10, height: 10, entities: [] }],
    };

    GameRuntime.fromConfig(config, mockFactory);

    expect(mockFactory).toHaveBeenCalledTimes(2);
    expect(mockFactory).toHaveBeenCalledWith('TestSystem', expect.anything(), expect.any(Map));
    expect(mockFactory).toHaveBeenCalledWith('AnotherSystem', expect.anything(), expect.any(Map));
  });

  it('should skip comment/section objects in entities array', () => {
    const config: GameConfig = {
      initialScene: 'room1',
      systems: [],
      scenes: [
        {
          id: 'room1',
          width: 20,
          height: 20,
          entities: [
            // Comment object (no type)
            { comment: 'Section: Walls' } as unknown as { type: string; x: number; y: number; layer: number },
            { type: 'wall', x: 5, y: 5, layer: GameLayers.WALLS },
          ],
        },
      ],
    };

    // Should not throw
    const runtime = GameRuntime.fromConfig(config, nullSystemFactory);
    const wallId = runtime.spatial.getEntityIdAt(5, 5, GameLayers.WALLS);
    expect(wallId).toBeDefined();
  });

  it('should handle legacy props field with error and fallback', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');

    const config: GameConfig = {
      initialScene: 'room1',
      systems: [],
      scenes: [
        {
          id: 'room1',
          width: 20,
          height: 20,
          entities: [
            {
              type: 'wall',
              x: 5,
              y: 5,
              layer: GameLayers.WALLS,
              props: { color: '#ff0000' }, // Legacy field
            } as unknown as { type: string; x: number; y: number; layer: number; data?: Record<string, unknown> },
          ],
        },
      ],
    };

    const runtime = GameRuntime.fromConfig(config, nullSystemFactory);

    // Should log error
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('SCHEMA ERROR'));

    // Should still spawn entity with fallback
    const wallId = runtime.spatial.getEntityIdAt(5, 5, GameLayers.WALLS);
    expect(wallId).toBeDefined();
    const wallData = runtime.spatial.getEntityData(wallId!);
    expect(wallData?.color).toBe('#ff0000');

    consoleErrorSpy.mockRestore();
  });
});
