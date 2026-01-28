import { describe, it, expect } from 'vitest';
import { GameRuntime } from '../game-runtime.js';
import { TeleporterSystem } from '../teleporter-system.js';
import { GameLayers } from '../types.js';

describe('TeleporterSystem round-trip', () => {
  it('allows player to teleport back after stepping off destination pad', () => {
    // Create runtime with two connected rooms
    const runtime = GameRuntime.new({
      initialScene: { id: 'room1', width: 10, height: 10 },
      systems: [],
      tickRate: 10
    });
    
    // Create room2
    const room2 = runtime.game.sceneManager.createScene('room2', 10, 10);
    
    // Spawn player in room1
    const room1 = runtime.game.sceneManager.getActiveScene()!;
    const playerId = room1.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    runtime.game.gameState.playerEntityId = playerId;
    room1.spatial.commit();
    
    // Create teleporter in room1 at (5, 7) → room2 at (3, 3)
    const pad1Id = room1.spatial.spawn('teleporter', 5, 7, GameLayers.FLOOR, {
      destination: {
        sceneId: 'room2',
        x: 3,
        y: 3,
        layer: GameLayers.ACTORS
      }
    });
    room1.spatial.commit();
    
    // Create return teleporter in room2 at (3, 3) → room1 at (5, 7)
    const pad2Id = room2.spatial.spawn('teleporter', 3, 3, GameLayers.FLOOR, {
      destination: {
        sceneId: 'room1',
        x: 5,
        y: 7,
        layer: GameLayers.ACTORS
      }
    });
    room2.spatial.commit();
    
    // Register TeleporterSystem using double-registration pattern
    // Note: We use manual registration here because TeleporterSystem requires
    // runtime.game in its constructor, which doesn't exist until after runtime
    // is created. For systems that don't need runtime dependencies, use
    // createRuntimeWithSystems() helper instead.
    // See specs/spartan-system-registration.md for details.
    const teleporterSystem = new TeleporterSystem(runtime.game);
    (runtime as any).systems.push(teleporterSystem);        // Persistent (survives scene transitions)
    (runtime as any).gameLoop.addSystem(teleporterSystem);  // Active immediately
    
    // STEP 1: Move player onto pad1 in room1
    room1.spatial.move(5, 5, 5, 6, GameLayers.ACTORS);
    room1.spatial.commit();
    runtime.tick(); // Tick 1: player at (5,6)
    
    room1.spatial.move(5, 6, 5, 7, GameLayers.ACTORS);
    room1.spatial.commit();
    runtime.tick(); // Tick 2: player at (5,7) - overlaps with pad1
    
    // Player should now be in room2 at (3, 3)
    expect(runtime.game.sceneManager.getActiveScene()?.id).toBe('room2');
    const posAfterTeleport = runtime.game.getPlayerPosition();
    expect(posAfterTeleport?.x).toBe(3);
    expect(posAfterTeleport?.y).toBe(3);
    console.log('✓ Teleported to room2');
    
    // STEP 2: Step off the pad in room2
    runtime.tick(); // Tick 3: just landed, on pad
    room2.spatial.move(3, 3, 4, 3, GameLayers.ACTORS);
    room2.spatial.commit();
    runtime.tick(); // Tick 4: stepped off to (4,3)
    
    expect(runtime.game.sceneManager.getActiveScene()?.id).toBe('room2');
    const posAfterStepOff = runtime.game.getPlayerPosition();
    expect(posAfterStepOff?.x).toBe(4);
    expect(posAfterStepOff?.y).toBe(3);
    console.log('✓ Stepped off pad to (4,3)');
    
    // STEP 3: Step back onto the pad in room2
    room2.spatial.move(4, 3, 3, 3, GameLayers.ACTORS);
    room2.spatial.commit();
    runtime.tick(); // Tick 5: back on pad at (3,3)
    
    // Player should teleport back to room1 at (5, 7)
    expect(runtime.game.sceneManager.getActiveScene()?.id).toBe('room1');
    const posAfterReturn = runtime.game.getPlayerPosition();
    expect(posAfterReturn?.x).toBe(5);
    expect(posAfterReturn?.y).toBe(7);
    console.log('✓ Teleported back to room1!');
  });
});
