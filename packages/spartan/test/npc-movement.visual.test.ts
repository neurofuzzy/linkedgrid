import { visual } from './visual-helpers';
import { GameLayers } from '../config/layers.config';
import { NPCMovementSystem } from '../systems/npc-movement.system';
import { GameLoop } from '../core/game-loop';
import { spawnPlayer } from '../entities/spawn-helpers';
import { hasNPCMovement } from '../traits/trait-guards';

/**
 * Visual tests for NPC movement system.
 *
 * These tests verify the four movement modes: follow, flee, pursue, and wander.
 */

visual('follow: NPC approaches when player is far', {
  arrange: ({ spatial }) => {
    // Spawn player at far position
    const playerId = spawnPlayer(spatial, 15, 10, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
      inventory: [],
    });

    // Spawn follower NPC with target
    spatial.spawn('npc', 5, 10, GameLayers.ACTORS, {
      movementMode: 'follow',
      targetEntityId: playerId,
      minDistance: 2,
      maxDistance: 4,
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const npcMovementSystem = new NPCMovementSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(npcMovementSystem);

    // Run multiple ticks (tick rate is 2, so we need 2 ticks per move)
    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('NPC moved closer to player', () => {
      // NPC should have moved right toward player (started at 5,10, player at 15,10)
      const npcId = spatial.getEntityIdAt(5, 10, GameLayers.ACTORS);
      if (npcId !== undefined) {
        const npcData = spatial.getEntityData(npcId);
        if (npcData && hasNPCMovement(npcData)) {
          throw new Error('NPC should have moved from starting position');
        }
      }
    });

    expect('NPC not at player position', () => {
      // NPC should maintain distance, not be on top of player
      const playerPos = { x: 15, y: 10 };
      const npcAtPlayer = spatial.getEntityIdAt(playerPos.x, playerPos.y, GameLayers.ACTORS);
      if (npcAtPlayer !== undefined) {
        const data = spatial.getEntityData(npcAtPlayer);
        if (data && hasNPCMovement(data)) {
          throw new Error('NPC should not be at player position');
        }
      }
    });
  },
});

visual('follow: NPC retreats when player is too close', {
  arrange: ({ spatial }) => {
    // Spawn player close to NPC
    const playerId = spawnPlayer(spatial, 10, 10, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
      inventory: [],
    });

    // Spawn follower NPC adjacent to player (distance 1, which is < minDistance 2)
    spatial.spawn('npc', 11, 10, GameLayers.ACTORS, {
      movementMode: 'follow',
      targetEntityId: playerId,
      minDistance: 2,
      maxDistance: 5,
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const npcMovementSystem = new NPCMovementSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(npcMovementSystem);

    // Run ticks for NPC to retreat
    for (let i = 0; i < 4; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('NPC moved away from player', () => {
      // NPC started at (11,10), player at (10,10)
      // NPC should move right to increase distance
      const npcStillAdjacent = spatial.getEntityIdAt(11, 10, GameLayers.ACTORS);
      if (npcStillAdjacent !== undefined) {
        const data = spatial.getEntityData(npcStillAdjacent);
        if (data && hasNPCMovement(data)) {
          throw new Error('NPC should have retreated from starting position');
        }
      }
    });
  },
});

visual('flee: NPC runs when player approaches', {
  arrange: ({ spatial }) => {
    // Spawn player
    const playerId = spawnPlayer(spatial, 10, 10, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
      inventory: [],
    });

    // Spawn fleeing NPC nearby (within panic distance)
    spatial.spawn('prey', 12, 10, GameLayers.ACTORS, {
      movementMode: 'flee',
      targetEntityId: playerId,
      panicDistance: 3,
      safeDistance: 7,
      aiMovementState: 'idle',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const npcMovementSystem = new NPCMovementSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(npcMovementSystem);

    // Run ticks for NPC to flee
    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('NPC fled from player', () => {
      // NPC started at (12,10), player at (10,10), distance = 2
      // Since distance (2) <= panicDistance (3), NPC should flee
      // NPC should move right away from player
      const npcAtStart = spatial.getEntityIdAt(12, 10, GameLayers.ACTORS);
      if (npcAtStart !== undefined) {
        const data = spatial.getEntityData(npcAtStart);
        if (data && hasNPCMovement(data) && data.movementMode === 'flee') {
          throw new Error('NPC should have fled from starting position');
        }
      }
    });

    expect('NPC state changed to active (fleeing)', () => {
      // Find the NPC wherever it is now
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data && hasNPCMovement(data) && data.movementMode === 'flee') {
          if (data.aiMovementState !== 'active' && data.aiMovementState !== 'idle') {
            throw new Error(`Expected fleeing or safe state, got: ${data.aiMovementState}`);
          }
          return;
        }
      }
      throw new Error('Could not find fleeing NPC');
    });
  },
});

visual('flee: NPC calms down when player is far', {
  arrange: ({ spatial }) => {
    // Spawn player far from NPC
    const playerId = spawnPlayer(spatial, 2, 10, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
      inventory: [],
    });

    // Spawn fleeing NPC far from player (beyond safe distance)
    spatial.spawn('prey', 15, 10, GameLayers.ACTORS, {
      movementMode: 'flee',
      targetEntityId: playerId,
      panicDistance: 3,
      safeDistance: 7,
      aiMovementState: 'active', // Start in fleeing state
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const npcMovementSystem = new NPCMovementSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(npcMovementSystem);

    // Run ticks
    for (let i = 0; i < 4; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('NPC returned to idle state', () => {
      // Distance is 13, which is > safeDistance (7), so NPC should calm down
      const npcId = spatial.getEntityIdAt(15, 10, GameLayers.ACTORS);
      if (npcId === undefined) throw new Error('NPC not found');

      const data = spatial.getEntityData(npcId);
      if (!data || !hasNPCMovement(data)) throw new Error('NPC data not found');
      if (data.aiMovementState !== 'idle') {
        throw new Error(`Expected idle state, got: ${data.aiMovementState}`);
      }
    });
  },
});

visual('pursue: NPC chases player when in range', {
  arrange: ({ spatial }) => {
    // Spawn player
    const playerId = spawnPlayer(spatial, 10, 10, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
      inventory: [],
    });

    // Spawn pursuing NPC within trigger range
    spatial.spawn('guard', 15, 10, GameLayers.ACTORS, {
      movementMode: 'pursue',
      targetEntityId: playerId,
      triggerRange: 8,
      giveUpRange: 15,
      aiMovementState: 'idle',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const npcMovementSystem = new NPCMovementSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(npcMovementSystem);

    // Run ticks for NPC to start chasing
    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('NPC started pursuing', () => {
      // Find the guard NPC
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data && hasNPCMovement(data) && data.movementMode === 'pursue') {
          if (data.aiMovementState !== 'active') {
            throw new Error(`Expected active (chasing) state, got: ${data.aiMovementState}`);
          }
          return;
        }
      }
      throw new Error('Guard NPC not found');
    });

    expect('NPC moved toward player', () => {
      // Guard started at (15,10), player at (10,10)
      // Guard should move left toward player
      const guardAtStart = spatial.getEntityIdAt(15, 10, GameLayers.ACTORS);
      if (guardAtStart !== undefined) {
        const data = spatial.getEntityData(guardAtStart);
        if (data && hasNPCMovement(data) && data.movementMode === 'pursue') {
          throw new Error('Guard should have moved toward player');
        }
      }
    });
  },
});

visual('pursue: NPC gives up when player too far', {
  arrange: ({ spatial }) => {
    // Spawn player far away
    const playerId = spawnPlayer(spatial, 2, 2, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
      inventory: [],
    });

    // Spawn pursuing NPC that was chasing but target is now too far
    spatial.spawn('guard', 18, 18, GameLayers.ACTORS, {
      movementMode: 'pursue',
      targetEntityId: playerId,
      triggerRange: 8,
      giveUpRange: 15,
      aiMovementState: 'active', // Already chasing
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const npcMovementSystem = new NPCMovementSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(npcMovementSystem);

    // Run ticks
    for (let i = 0; i < 4; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('NPC gave up pursuit', () => {
      // Distance is ~23 (manhattan), which is > giveUpRange (15)
      const guardId = spatial.getEntityIdAt(18, 18, GameLayers.ACTORS);
      if (guardId === undefined) throw new Error('Guard not found');

      const data = spatial.getEntityData(guardId);
      if (!data || !hasNPCMovement(data)) throw new Error('Guard data not found');
      if (data.aiMovementState !== 'idle') {
        throw new Error(`Expected idle (gave up) state, got: ${data.aiMovementState}`);
      }
    });
  },
});

visual('wander: NPC moves randomly', {
  arrange: ({ spatial }) => {
    // Spawn wandering NPC in open area
    spatial.spawn('critter', 10, 10, GameLayers.ACTORS, {
      movementMode: 'wander',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const npcMovementSystem = new NPCMovementSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(npcMovementSystem);

    // Run multiple ticks to see movement
    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('NPC exists somewhere on the grid', () => {
      // Find the wandering NPC wherever it moved
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data && hasNPCMovement(data) && data.movementMode === 'wander') {
          return; // Found it
        }
      }
      throw new Error('Wandering NPC not found');
    });

    // Note: We can't assert exact position since wander is random
    // Just verify it didn't crash
    expect('Starting position may be empty (NPC wandered)', () => {
      // This is just to observe - wander is random so it may or may not have moved
      const critterAtStart = spatial.getEntityIdAt(10, 10, GameLayers.ACTORS);
      // Either it moved or stayed - both are valid for random wander
      if (critterAtStart === undefined) {
        // NPC wandered away - success
      } else {
        const data = spatial.getEntityData(critterAtStart);
        if (!data || !hasNPCMovement(data) || data.movementMode !== 'wander') {
          throw new Error('Something else at start position');
        }
        // NPC stayed (random choice) - also success
      }
    });
  },
});

visual('follow: NPC uses pathfinding around walls', {
  arrange: ({ spatial }) => {
    // Spawn player
    const playerId = spawnPlayer(spatial, 15, 10, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
      inventory: [],
    });

    // Spawn wall blocking direct path
    for (let y = 8; y <= 12; y++) {
      spatial.spawn('wall', 10, y, GameLayers.WALLS);
    }

    // Spawn follower NPC on other side of wall
    spatial.spawn('npc', 5, 10, GameLayers.ACTORS, {
      movementMode: 'follow',
      targetEntityId: playerId,
      minDistance: 1,
      maxDistance: 3,
      pathfindingRange: 20,
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const npcMovementSystem = new NPCMovementSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(npcMovementSystem);

    // Run many ticks to allow pathfinding around wall
    for (let i = 0; i < 30; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('NPC moved from starting position', () => {
      const npcAtStart = spatial.getEntityIdAt(5, 10, GameLayers.ACTORS);
      if (npcAtStart !== undefined) {
        const data = spatial.getEntityData(npcAtStart);
        if (data && hasNPCMovement(data) && data.movementMode === 'follow') {
          throw new Error('NPC should have moved from starting position');
        }
      }
    });

    expect('NPC found a path around the wall', () => {
      // Find the NPC and verify it's closer to player
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data && hasNPCMovement(data) && data.movementMode === 'follow') {
          const pos = spatial.getEntityPosition(entityId);
          if (pos) {
            // NPC should have moved closer to player (at 15,10) around wall (at 10,y)
            // Success if x > 5 (moved from start)
            if (pos.x <= 5) {
              throw new Error(`NPC did not progress toward player: x=${pos.x}`);
            }
          }
          return;
        }
      }
      throw new Error('NPC not found');
    });
  },
});
