import { visual } from './visual-helpers.js';
import { GameManager } from '../game-manager.js';
import { GameLayers } from '../types.js';

visual('player teleports between rooms', {
  arrange: (ctx) => {
    const game = new GameManager();
    ctx.game = game;
    
    const room1 = game.sceneManager.createScene('room1', 10, 10, {
      name: 'Starting Room'
    });
    const room2 = game.sceneManager.createScene('room2', 12, 12, {
      name: 'Treasure Room'
    });
    
    game.sceneManager.setActiveScene('room1');
    const playerId = room1.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    game.gameState.playerEntityId = playerId;
    
    // Add some walls in room1
    room1.grid.cell(4, 5).setValue(GameLayers.WALLS, 1);
    room1.grid.cell(6, 5).setValue(GameLayers.WALLS, 1);
    
    // Add teleporter pad in room1 (where player will step after walking)
    room1.spatial.spawn('teleporter', 5, 7, GameLayers.FLOOR);
    
    // Add treasure in room2
    room2.spatial.spawn('item', 6, 6, GameLayers.COLLECTIBLES);
    
    // Add teleporter pad in room2 (destination)
    room2.spatial.spawn('teleporter', 3, 3, GameLayers.FLOOR);
    
    // Commit all spawned entities
    room1.spatial.commit();
    room2.spatial.commit();
  },
  act: (ctx) => {
    const game = ctx.game;
    if (!game) {
      throw new Error('Game manager not found in context - arrange phase may have failed');
    }
    
    // Use ctx.spatial which is wrapped by the test executor
    // Beginning: Explore room1
    ctx.spatial.move(5, 5, 4, 5, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    ctx.spatial.move(4, 5, 5, 5, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    // Walk toward teleporter
    ctx.spatial.move(5, 5, 5, 6, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    // Pause before teleporting
    ctx.spatial.commit();
    
    // Step onto teleporter
    ctx.spatial.move(5, 6, 5, 7, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    // Teleport to room2 (ctx.spatial will auto-update to new scene via proxy)
    game.movePlayerToScene('room2', 3, 3, GameLayers.ACTORS);
    
    // Middle: Arrive in room2, pause to see new environment
    ctx.spatial.commit();
    ctx.spatial.commit();
    
    // Explore room2
    ctx.spatial.move(3, 3, 4, 3, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    ctx.spatial.move(4, 3, 5, 3, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    // Walk toward treasure
    ctx.spatial.move(5, 3, 5, 4, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    ctx.spatial.move(5, 4, 5, 5, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    // End: Reach treasure area
    ctx.spatial.move(5, 5, 6, 6, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    // Final pause to see the treasure
    ctx.spatial.commit();
  }
});

visual('multi-scene world with connections', {
  arrange: (ctx) => {
    const game = new GameManager();
    ctx.game = game;
    
    // Create three connected rooms
    const entrance = game.sceneManager.createScene('entrance', 8, 8, {
      name: 'Dungeon Entrance'
    });
    const hallway = game.sceneManager.createScene('hallway', 15, 6, {
      name: 'Long Hallway'
    });
    const boss = game.sceneManager.createScene('boss', 12, 12, {
      name: 'Boss Chamber'
    });
    
    // Setup connections
    game.gameState.addConnection('entrance-to-hallway', 'hallway', 0, 3, GameLayers.ACTORS);
    game.gameState.addConnection('hallway-to-boss', 'boss', 6, 0, GameLayers.ACTORS);
    
    // Add teleporter pads at connection points
    entrance.spatial.spawn('teleporter', 4, 6, GameLayers.FLOOR); // Exit from entrance
    hallway.spatial.spawn('teleporter', 0, 3, GameLayers.FLOOR);  // Entry to hallway
    hallway.spatial.spawn('teleporter', 14, 3, GameLayers.FLOOR); // Exit from hallway
    boss.spatial.spawn('teleporter', 6, 0, GameLayers.FLOOR);     // Entry to boss room
    
    // Spawn player in entrance
    game.sceneManager.setActiveScene('entrance');
    const playerId = entrance.spatial.spawn('player', 4, 4, GameLayers.ACTORS);
    game.gameState.playerEntityId = playerId;
    
    // Add enemy in hallway
    hallway.spatial.spawn('enemy', 7, 3, GameLayers.ACTORS);
    
    // Add boss in boss chamber
    boss.spatial.spawn('enemy', 6, 6, GameLayers.ACTORS);
    
    // Commit all spawned entities
    entrance.spatial.commit();
    hallway.spatial.commit();
    boss.spatial.commit();
  },
  act: (ctx) => {
    const game = ctx.game;
    if (!game) {
      throw new Error('Game manager not found in context - arrange phase may have failed');
    }
    
    // Use ctx.spatial which is wrapped by the test executor
    // Beginning: Explore entrance
    ctx.spatial.move(4, 4, 3, 4, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    ctx.spatial.move(3, 4, 4, 4, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    // Move toward exit teleporter
    ctx.spatial.move(4, 4, 4, 5, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    ctx.spatial.move(4, 5, 4, 6, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    // Pause before teleporting
    ctx.spatial.commit();
    
    // Teleport to hallway (ctx.spatial will auto-update via proxy)
    const hallwayEntry = game.gameState.getConnections('entrance-to-hallway')[0];
    game.movePlayerToScene(hallwayEntry.sceneId, hallwayEntry.x, hallwayEntry.y, hallwayEntry.layer);
    
    // Middle: Walk through hallway (long sequence)
    ctx.spatial.commit(); // Pause to see new scene
    
    ctx.spatial.move(0, 3, 1, 3, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    ctx.spatial.move(1, 3, 2, 3, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    ctx.spatial.move(2, 3, 3, 3, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    ctx.spatial.move(3, 3, 4, 3, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    ctx.spatial.move(4, 3, 5, 3, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    // Pause before reaching exit
    ctx.spatial.commit();
    
    // Continue to exit
    ctx.spatial.move(5, 3, 6, 3, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    // Teleport to boss chamber (ctx.spatial will auto-update via proxy)
    const bossEntry = game.gameState.getConnections('hallway-to-boss')[0];
    game.movePlayerToScene(bossEntry.sceneId, bossEntry.x, bossEntry.y, bossEntry.layer);
    
    // End: Approach boss
    ctx.spatial.commit(); // Pause to see boss room
    ctx.spatial.commit();
    
    ctx.spatial.move(6, 0, 6, 1, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    ctx.spatial.move(6, 1, 6, 2, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    ctx.spatial.move(6, 2, 6, 3, GameLayers.ACTORS);
    ctx.spatial.commit();
    
    // Final dramatic pause before boss
    ctx.spatial.commit();
  }
});

// Note: "scene with metadata and player tracking" test removed - it's a unit test concern, not visually demonstrable
