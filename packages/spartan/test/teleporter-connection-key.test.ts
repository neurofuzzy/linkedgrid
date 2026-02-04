import { describe, it, expect } from 'vitest';
import { GameRuntime, GameConfig } from '../core/game-runtime';
import { TeleporterSystem } from '../systems/teleporter.system';
import { GameLayers } from '../config/layers.config';
import type { GameSystem } from '../core/types';

/**
 * System factory for tests - only creates TeleporterSystem
 */
function createTestSystem(
  name: string,
  gameManager: unknown
): GameSystem | null {
  if (name === 'TeleporterSystem') {
    return new TeleporterSystem(
      gameManager as Parameters<typeof TeleporterSystem['prototype']['constructor']>[0]
    );
  }
  return null;
}

describe('TeleporterSystem with connectionKey', () => {
  describe('separate scenes', () => {
    it('should teleport player between two scenes using connectionKey', () => {
      const config: GameConfig = {
        initialScene: 'room1',
        systems: ['TeleporterSystem'],
        scenes: [
          {
            id: 'room1',
            width: 20,
            height: 20,
            entities: [
              {
                type: 'player',
                x: 10,
                y: 10,
                layer: GameLayers.ACTORS,
                data: { hp: 100, maxHp: 100, damage: 10 },
              },
              {
                type: 'teleporter',
                x: 15,
                y: 15,
                layer: GameLayers.FLOOR,
                data: { connectionKey: 'red', targetKey: 'red' },
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
                x: 5,
                y: 5,
                layer: GameLayers.FLOOR,
                data: { connectionKey: 'red', targetKey: 'red' },
              },
            ],
          },
        ],
      };

      const runtime = GameRuntime.fromConfig(config, createTestSystem);

      // Verify connection was registered
      const connections = runtime.game.gameState.getConnections('red');
      expect(connections).toHaveLength(2);
      expect(connections[0]).toMatchObject({ sceneId: 'room1', x: 15, y: 15 });
      expect(connections[1]).toMatchObject({ sceneId: 'room2', x: 5, y: 5 });

      // Verify player is in room1
      expect(runtime.activeScene.id).toBe('room1');
      const playerId = runtime.game.gameState.playerEntityId;
      expect(playerId).not.toBe(0);

      // Move player onto teleporter
      runtime.spatial.move(playerId, 15, 15);
      runtime.spatial.commit();
      runtime.tick();

      // Verify player teleported to room2 at the red teleporter location
      expect(runtime.activeScene.id).toBe('room2');
      const pos = runtime.game.getPlayerPosition();
      expect(pos?.sceneId).toBe('room2');
      expect(pos?.x).toBe(5);
      expect(pos?.y).toBe(5);
    });

    it('should allow round-trip teleportation using connectionKey', () => {
      const config: GameConfig = {
        initialScene: 'room1',
        systems: ['TeleporterSystem'],
        scenes: [
          {
            id: 'room1',
            width: 20,
            height: 20,
            entities: [
              {
                type: 'player',
                x: 10,
                y: 10,
                layer: GameLayers.ACTORS,
                data: { hp: 100, maxHp: 100, damage: 10 },
              },
              {
                type: 'teleporter',
                x: 15,
                y: 15,
                layer: GameLayers.FLOOR,
                data: { connectionKey: 'portal-A', targetKey: 'portal-A' },
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
                x: 5,
                y: 5,
                layer: GameLayers.FLOOR,
                data: { connectionKey: 'portal-A', targetKey: 'portal-A' },
              },
            ],
          },
        ],
      };

      const runtime = GameRuntime.fromConfig(config, createTestSystem);
      const playerId = runtime.game.gameState.playerEntityId;
      const room2 = runtime.game.sceneManager.getScene('room2')!;

      // Step 1: Teleport to room2
      runtime.spatial.move(playerId, 15, 15);
      runtime.spatial.commit();
      runtime.tick();

      expect(runtime.activeScene.id).toBe('room2');
      expect(runtime.game.getPlayerPosition()).toMatchObject({
        sceneId: 'room2',
        x: 5,
        y: 5,
      });

      // Step 2: Step off the teleporter in room2
      room2.spatial.move(playerId, 6, 5);
      room2.spatial.commit();
      runtime.tick();

      expect(runtime.activeScene.id).toBe('room2');
      expect(runtime.game.getPlayerPosition()?.x).toBe(6);

      // Step 3: Step back onto teleporter - should teleport back to room1
      room2.spatial.move(playerId, 5, 5);
      room2.spatial.commit();
      runtime.tick();

      expect(runtime.activeScene.id).toBe('room1');
      expect(runtime.game.getPlayerPosition()).toMatchObject({
        sceneId: 'room1',
        x: 15,
        y: 15,
      });
    });

    it('should support multiple connection keys for different portal pairs', () => {
      const config: GameConfig = {
        initialScene: 'hub',
        systems: ['TeleporterSystem'],
        scenes: [
          {
            id: 'hub',
            width: 20,
            height: 20,
            entities: [
              {
                type: 'player',
                x: 10,
                y: 10,
                layer: GameLayers.ACTORS,
                data: { hp: 100, maxHp: 100, damage: 10 },
              },
              {
                type: 'teleporter',
                x: 5,
                y: 5,
                layer: GameLayers.FLOOR,
                data: { connectionKey: 'red', targetKey: 'red' },
              },
              {
                type: 'teleporter',
                x: 15,
                y: 5,
                layer: GameLayers.FLOOR,
                data: { connectionKey: 'blue', targetKey: 'blue' },
              },
            ],
          },
          {
            id: 'red-room',
            width: 20,
            height: 20,
            entities: [
              {
                type: 'teleporter',
                x: 10,
                y: 10,
                layer: GameLayers.FLOOR,
                data: { connectionKey: 'red', targetKey: 'red' },
              },
            ],
          },
          {
            id: 'blue-room',
            width: 20,
            height: 20,
            entities: [
              {
                type: 'teleporter',
                x: 10,
                y: 10,
                layer: GameLayers.FLOOR,
                data: { connectionKey: 'blue', targetKey: 'blue' },
              },
            ],
          },
        ],
      };

      const runtime = GameRuntime.fromConfig(config, createTestSystem);
      const playerId = runtime.game.gameState.playerEntityId;

      // Verify both connections registered
      expect(runtime.game.gameState.getConnections('red')).toHaveLength(2);
      expect(runtime.game.gameState.getConnections('blue')).toHaveLength(2);

      // Take the red portal
      runtime.spatial.move(playerId, 5, 5);
      runtime.spatial.commit();
      runtime.tick();

      expect(runtime.activeScene.id).toBe('red-room');

      // Go back to hub
      const redRoom = runtime.game.sceneManager.getScene('red-room')!;
      redRoom.spatial.move(playerId, 9, 10);
      redRoom.spatial.commit();
      runtime.tick();
      redRoom.spatial.move(playerId, 10, 10);
      redRoom.spatial.commit();
      runtime.tick();

      expect(runtime.activeScene.id).toBe('hub');

      // Now take the blue portal
      const hub = runtime.game.sceneManager.getScene('hub')!;
      hub.spatial.move(playerId, 15, 5);
      hub.spatial.commit();
      runtime.tick();

      expect(runtime.activeScene.id).toBe('blue-room');
    });
  });

  describe('same scene', () => {
    it('should teleport player between two teleporters in the same scene', () => {
      const config: GameConfig = {
        initialScene: 'room1',
        systems: ['TeleporterSystem'],
        scenes: [
          {
            id: 'room1',
            width: 20,
            height: 20,
            entities: [
              {
                type: 'player',
                x: 10,
                y: 10,
                layer: GameLayers.ACTORS,
                data: { hp: 100, maxHp: 100, damage: 10 },
              },
              {
                type: 'teleporter',
                x: 5,
                y: 5,
                layer: GameLayers.FLOOR,
                data: { connectionKey: 'internal', targetKey: 'internal' },
              },
              {
                type: 'teleporter',
                x: 15,
                y: 15,
                layer: GameLayers.FLOOR,
                data: { connectionKey: 'internal', targetKey: 'internal' },
              },
            ],
          },
        ],
      };

      const runtime = GameRuntime.fromConfig(config, createTestSystem);
      const playerId = runtime.game.gameState.playerEntityId;

      // Verify both endpoints registered
      const connections = runtime.game.gameState.getConnections('internal');
      expect(connections).toHaveLength(2);

      // Move to first teleporter
      runtime.spatial.move(playerId, 5, 5);
      runtime.spatial.commit();
      runtime.tick();

      // Should teleport to second teleporter in same scene
      expect(runtime.activeScene.id).toBe('room1');
      const pos = runtime.game.getPlayerPosition();
      expect(pos?.x).toBe(15);
      expect(pos?.y).toBe(15);
    });

    it('should allow round-trip teleportation within same scene', () => {
      const config: GameConfig = {
        initialScene: 'room1',
        systems: ['TeleporterSystem'],
        scenes: [
          {
            id: 'room1',
            width: 20,
            height: 20,
            entities: [
              {
                type: 'player',
                x: 3,
                y: 5,
                layer: GameLayers.ACTORS,
                data: { hp: 100, maxHp: 100, damage: 10 },
              },
              {
                type: 'teleporter',
                x: 5,
                y: 5,
                layer: GameLayers.FLOOR,
                data: { connectionKey: 'warp', targetKey: 'warp' },
              },
              {
                type: 'teleporter',
                x: 15,
                y: 15,
                layer: GameLayers.FLOOR,
                data: { connectionKey: 'warp', targetKey: 'warp' },
              },
            ],
          },
        ],
      };

      const runtime = GameRuntime.fromConfig(config, createTestSystem);
      const playerId = runtime.game.gameState.playerEntityId;

      // Teleport from (5,5) to (15,15)
      runtime.spatial.move(playerId, 5, 5);
      runtime.spatial.commit();
      runtime.tick();

      expect(runtime.game.getPlayerPosition()).toMatchObject({ x: 15, y: 15 });

      // Step off
      runtime.spatial.move(playerId, 14, 15);
      runtime.spatial.commit();
      runtime.tick();

      expect(runtime.game.getPlayerPosition()?.x).toBe(14);

      // Teleport back
      runtime.spatial.move(playerId, 15, 15);
      runtime.spatial.commit();
      runtime.tick();

      expect(runtime.game.getPlayerPosition()).toMatchObject({ x: 5, y: 5 });
    });
  });

  describe('backward compatibility', () => {
    it('should still work with direct destination format', () => {
      const config: GameConfig = {
        initialScene: 'room1',
        systems: ['TeleporterSystem'],
        scenes: [
          {
            id: 'room1',
            width: 20,
            height: 20,
            entities: [
              {
                type: 'player',
                x: 10,
                y: 10,
                layer: GameLayers.ACTORS,
                data: { hp: 100, maxHp: 100, damage: 10 },
              },
              {
                type: 'teleporter',
                x: 15,
                y: 15,
                layer: GameLayers.FLOOR,
                data: {
                  targetKey: 'legacy',
                  destination: {
                    sceneId: 'room2',
                    x: 5,
                    y: 5,
                    layer: GameLayers.ACTORS,
                  },
                },
              },
            ],
          },
          {
            id: 'room2',
            width: 20,
            height: 20,
            entities: [],
          },
        ],
      };

      const runtime = GameRuntime.fromConfig(config, createTestSystem);
      const playerId = runtime.game.gameState.playerEntityId;

      // No connectionKey connections should be registered
      expect(runtime.game.gameState.getConnections('legacy')).toHaveLength(0);

      // Move onto teleporter - should use direct destination
      runtime.spatial.move(playerId, 15, 15);
      runtime.spatial.commit();
      runtime.tick();

      // Should teleport using legacy destination
      expect(runtime.activeScene.id).toBe('room2');
      expect(runtime.game.getPlayerPosition()).toMatchObject({
        sceneId: 'room2',
        x: 5,
        y: 5,
      });
    });
  });
});
