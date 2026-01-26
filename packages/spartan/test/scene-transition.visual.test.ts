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
    
    // Add treasure in room2
    room2.spatial.spawn('item', 6, 6, GameLayers.ITEMS);
  },
  act: (ctx) => {
    const game = ctx.game;
    if (!game) {
      throw new Error('Game manager not found in context - arrange phase may have failed');
    }
    
    // Walk in room1
    const scene1 = game.sceneManager.getActiveScene();
    scene1!.spatial.move(5, 5, 5, 6, GameLayers.ACTORS);
    scene1!.spatial.commit();
    
    // Walk again
    scene1!.spatial.move(5, 6, 5, 7, GameLayers.ACTORS);
    scene1!.spatial.commit();
    
    // Teleport to room2
    game.movePlayerToScene('room2', 3, 3, GameLayers.ACTORS);
    
    // Walk in room2
    const scene2 = game.sceneManager.getActiveScene();
    scene2!.spatial.move(3, 3, 4, 3, GameLayers.ACTORS);
    scene2!.spatial.commit();
    
    // Walk toward treasure
    scene2!.spatial.move(4, 3, 5, 3, GameLayers.ACTORS);
    scene2!.spatial.commit();
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
    
    // Spawn player in entrance
    game.sceneManager.setActiveScene('entrance');
    const playerId = entrance.spatial.spawn('player', 4, 4, GameLayers.ACTORS);
    game.gameState.playerEntityId = playerId;
    
    // Add enemy in hallway
    hallway.spatial.spawn('enemy', 7, 3, GameLayers.ACTORS);
    
    // Add boss in boss chamber
    boss.spatial.spawn('enemy', 6, 6, GameLayers.ACTORS);
  },
  act: (ctx) => {
    const game = ctx.game;
    if (!game) {
      throw new Error('Game manager not found in context - arrange phase may have failed');
    }
    
    // Move through entrance
    const entrance = game.sceneManager.getScene('entrance');
    entrance!.spatial.move(4, 4, 4, 5, GameLayers.ACTORS);
    entrance!.spatial.commit();
    
    entrance!.spatial.move(4, 5, 4, 6, GameLayers.ACTORS);
    entrance!.spatial.commit();
    
    // Teleport to hallway via connection
    const hallwayEntry = game.gameState.getConnections('entrance-to-hallway')[0];
    game.movePlayerToScene(hallwayEntry.sceneId, hallwayEntry.x, hallwayEntry.y, hallwayEntry.layer);
    
    // Walk through hallway
    const hallway = game.sceneManager.getActiveScene();
    hallway!.spatial.move(0, 3, 1, 3, GameLayers.ACTORS);
    hallway!.spatial.commit();
    
    hallway!.spatial.move(1, 3, 2, 3, GameLayers.ACTORS);
    hallway!.spatial.commit();
    
    // Teleport to boss chamber
    const bossEntry = game.gameState.getConnections('hallway-to-boss')[0];
    game.movePlayerToScene(bossEntry.sceneId, bossEntry.x, bossEntry.y, bossEntry.layer);
    
    // Approach boss
    const bossRoom = game.sceneManager.getActiveScene();
    bossRoom!.spatial.move(6, 0, 6, 1, GameLayers.ACTORS);
    bossRoom!.spatial.commit();
  }
});

visual('scene with metadata and player tracking', {
  arrange: (ctx) => {
    const game = new GameManager();
    ctx.game = game;
    
    const scene = game.sceneManager.createScene('test-scene', 10, 10, {
      name: 'Test Arena',
      difficulty: 'hard',
      biome: 'volcanic'
    });
    
    game.sceneManager.setActiveScene('test-scene');
    const playerId = scene.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    game.gameState.playerEntityId = playerId;
    
    // Add some entities
    scene.spatial.spawn('enemy', 3, 3, GameLayers.ACTORS);
    scene.spatial.spawn('item', 7, 7, GameLayers.ITEMS);
  },
  act: (ctx) => {
    const game = ctx.game;
    if (!game) {
      throw new Error('Game manager not found in context - arrange phase may have failed');
    }
    const scene = game.sceneManager.getActiveScene();
    
    // Player moves
    scene!.spatial.move(5, 5, 6, 5, GameLayers.ACTORS);
    scene!.spatial.commit();
    
    scene!.spatial.move(6, 5, 7, 5, GameLayers.ACTORS);
    scene!.spatial.commit();
  },
  assert: (ctx) => {
    const game = ctx.game;
    if (!game) {
      throw new Error('Game manager not found in context - arrange phase may have failed');
    }
    const playerPos = game.getPlayerPosition();
    
    ctx.expect('player in correct scene', () => {
      if (playerPos?.sceneId !== 'test-scene') {
        throw new Error(`Expected player in test-scene, got ${playerPos?.sceneId}`);
      }
    });
    
    ctx.expect('player at expected position', () => {
      if (playerPos?.x !== 7 || playerPos?.y !== 5) {
        throw new Error(`Expected player at (7,5), got (${playerPos?.x},${playerPos?.y})`);
      }
    });
  }
});
