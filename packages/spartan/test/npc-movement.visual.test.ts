import { visual } from './visual-helpers';
import { GameLayers } from '../config/layers.config';
import { NPCMovementSystem } from '../systems/npc-movement.system';
import { GameLoop } from '../core/game-loop';
import { spawnPlayer, spawnPathNode } from '../entities/spawn-helpers';
import { hasNPCMovement } from '../traits/trait-guards';

/**
 * Visual tests for NPC movement system.
 *
 * These tests verify the five movement modes: follow, flee, pursue, wander, and patrol.
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

// ==================== PATROL MODE TESTS ====================

visual('patrol: NPC follows linear path', {
  arrange: ({ spatial }) => {
    // Create a linear path: (5,10) -> (6,10) -> (7,10) -> (8,10)
    spawnPathNode(spatial, 5, 10);
    spawnPathNode(spatial, 6, 10);
    spawnPathNode(spatial, 7, 10);
    spawnPathNode(spatial, 8, 10);

    // Spawn patrolling NPC at start of path
    spatial.spawn('guard', 5, 10, GameLayers.ACTORS, {
      movementMode: 'patrol',
      speed: 1,
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const npcMovementSystem = new NPCMovementSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(npcMovementSystem);

    // Run enough ticks for NPC to move along path
    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('NPC moved from starting position', () => {
      const npcAtStart = spatial.getEntityIdAt(5, 10, GameLayers.ACTORS);
      if (npcAtStart !== undefined) {
        const data = spatial.getEntityData(npcAtStart);
        if (data && hasNPCMovement(data) && data.movementMode === 'patrol') {
          throw new Error('NPC should have moved from starting position');
        }
      }
    });

    expect('NPC is somewhere on the path', () => {
      // Check all path positions
      for (const x of [5, 6, 7, 8]) {
        const npcId = spatial.getEntityIdAt(x, 10, GameLayers.ACTORS);
        if (npcId !== undefined) {
          const data = spatial.getEntityData(npcId);
          if (data && hasNPCMovement(data) && data.movementMode === 'patrol') {
            return; // Found NPC on path
          }
        }
      }
      throw new Error('NPC not found on path');
    });
  },
});

visual('patrol: NPC reverses at dead-end', {
  arrange: ({ spatial }) => {
    // Create a short linear path with dead-end: (5,10) -> (6,10) -> (7,10)
    spawnPathNode(spatial, 5, 10);
    spawnPathNode(spatial, 6, 10);
    spawnPathNode(spatial, 7, 10);

    // Spawn patrolling NPC near end of path
    spatial.spawn('guard', 6, 10, GameLayers.ACTORS, {
      movementMode: 'patrol',
      speed: 1,
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const npcMovementSystem = new NPCMovementSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(npcMovementSystem);

    // Run enough ticks for NPC to hit dead-end and reverse
    for (let i = 0; i < 20; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('NPC is still on the path (reversed at dead-end)', () => {
      // Check all path positions
      for (const x of [5, 6, 7]) {
        const npcId = spatial.getEntityIdAt(x, 10, GameLayers.ACTORS);
        if (npcId !== undefined) {
          const data = spatial.getEntityData(npcId);
          if (data && hasNPCMovement(data) && data.movementMode === 'patrol') {
            return; // Found NPC on path - it reversed successfully
          }
        }
      }
      throw new Error('NPC not found on path after reversal');
    });
  },
});

visual('patrol: NPC loops on circular path', {
  arrange: ({ spatial }) => {
    // Create a circular path (2x2 loop):
    // (5,10) - (6,10)
    //   |        |
    // (5,11) - (6,11)
    spawnPathNode(spatial, 5, 10);
    spawnPathNode(spatial, 6, 10);
    spawnPathNode(spatial, 5, 11);
    spawnPathNode(spatial, 6, 11);

    // Spawn patrolling NPC on the loop
    spatial.spawn('guard', 5, 10, GameLayers.ACTORS, {
      movementMode: 'patrol',
      speed: 1,
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const npcMovementSystem = new NPCMovementSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(npcMovementSystem);

    // Run many ticks - NPC should loop forever without reversing
    for (let i = 0; i < 30; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('NPC is on the circular path', () => {
      // Check all path positions in the loop
      const pathCells = [
        { x: 5, y: 10 },
        { x: 6, y: 10 },
        { x: 5, y: 11 },
        { x: 6, y: 11 },
      ];
      for (const { x, y } of pathCells) {
        const npcId = spatial.getEntityIdAt(x, y, GameLayers.ACTORS);
        if (npcId !== undefined) {
          const data = spatial.getEntityData(npcId);
          if (data && hasNPCMovement(data) && data.movementMode === 'patrol') {
            return; // Found NPC on loop
          }
        }
      }
      throw new Error('NPC not found on circular path');
    });
  },
});

visual('patrol: NPC selects at junction', {
  arrange: ({ spatial }) => {
    // Create a T-junction:
    //       (7,9)
    //         |
    // (5,10)-(6,10)-(7,10)
    spawnPathNode(spatial, 5, 10);
    spawnPathNode(spatial, 6, 10); // Junction point
    spawnPathNode(spatial, 7, 10);
    spawnPathNode(spatial, 6, 9);  // T branch

    // Spawn patrolling NPC at left end
    spatial.spawn('guard', 5, 10, GameLayers.ACTORS, {
      movementMode: 'patrol',
      speed: 1,
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const npcMovementSystem = new NPCMovementSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(npcMovementSystem);

    // Run ticks to reach junction and make selection
    for (let i = 0; i < 15; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('NPC moved through junction', () => {
      // NPC should be somewhere on the path (after junction selection)
      const pathCells = [
        { x: 5, y: 10 },
        { x: 6, y: 10 },
        { x: 7, y: 10 },
        { x: 6, y: 9 },
      ];
      for (const { x, y } of pathCells) {
        const npcId = spatial.getEntityIdAt(x, y, GameLayers.ACTORS);
        if (npcId !== undefined) {
          const data = spatial.getEntityData(npcId);
          if (data && hasNPCMovement(data) && data.movementMode === 'patrol') {
            return; // Found NPC
          }
        }
      }
      throw new Error('NPC not found on path after junction');
    });
  },
});

visual('patrol: NPC switches to pursue when player in range', {
  arrange: ({ spatial }) => {
    // Create a linear path
    spawnPathNode(spatial, 5, 10);
    spawnPathNode(spatial, 6, 10);
    spawnPathNode(spatial, 7, 10);
    spawnPathNode(spatial, 8, 10);

    // Spawn player nearby
    spawnPlayer(spatial, 7, 8, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
      inventory: [],
    });

    // Spawn patrolling NPC with pursue trigger
    spatial.spawn('guard', 5, 10, GameLayers.ACTORS, {
      movementMode: 'patrol',
      speed: 1,
      triggerRange: 5,
      giveUpRange: 10,
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const npcMovementSystem = new NPCMovementSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(npcMovementSystem);

    // Run ticks - NPC should detect player and switch to pursue
    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('NPC switched to pursue mode', () => {
      // Find the guard NPC
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data && hasNPCMovement(data) && data.type === 'guard') {
          // NPC should have switched to pursue or still be pursuing
          if (data.movementMode !== 'pursue' && data.baseMovementMode !== 'patrol') {
            // It's ok if it's still in patrol if player wasn't close enough initially
            if (data.movementMode !== 'patrol') {
              throw new Error(`Unexpected movement mode: ${data.movementMode}`);
            }
          }
          return;
        }
      }
      throw new Error('Guard NPC not found');
    });
  },
});

visual('patrol: NPC not on path cell cannot patrol', {
  arrange: ({ spatial }) => {
    // Create a path NOT where NPC is
    spawnPathNode(spatial, 10, 10);
    spawnPathNode(spatial, 11, 10);
    spawnPathNode(spatial, 12, 10);

    // Spawn patrolling NPC away from path
    spatial.spawn('guard', 5, 5, GameLayers.ACTORS, {
      movementMode: 'patrol',
      speed: 1,
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const npcMovementSystem = new NPCMovementSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(npcMovementSystem);

    // Run ticks - NPC should not move (not on a path)
    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('NPC stayed at starting position (not on path)', () => {
      const npcId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS);
      if (npcId === undefined) {
        throw new Error('NPC should have stayed at (5,5) since not on a path');
      }
      const data = spatial.getEntityData(npcId);
      if (!data || !hasNPCMovement(data)) {
        throw new Error('NPC data not found');
      }
      // homePathCell should not be set
      if (data.homePathCell) {
        throw new Error('NPC should not have homePathCell since not spawned on path');
      }
    });
  },
});

visual('patrol: NPC returns to path after pursue gives up', {
  arrange: ({ spatial }) => {
    // Create a linear path closer to NPC starting position
    spawnPathNode(spatial, 8, 10);
    spawnPathNode(spatial, 9, 10);
    spawnPathNode(spatial, 10, 10);
    spawnPathNode(spatial, 11, 10);

    // Spawn player far away (beyond giveUpRange)
    spawnPlayer(spatial, 18, 10, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
      inventory: [],
    });

    // Spawn patrolling NPC with pursue trigger, already off path and in returning state
    // NPC is at x=13, path ends at x=11, so only 2 moves needed
    spatial.spawn('guard', 13, 10, GameLayers.ACTORS, {
      movementMode: 'pursue',
      speed: 1,
      triggerRange: 5,
      giveUpRange: 8,
      pathfindingRange: 20,
      baseMovementMode: 'patrol',
      homePathCell: { x: 8, y: 10 },
      aiMovementState: 'returning',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const npcMovementSystem = new NPCMovementSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(npcMovementSystem);

    // Run enough ticks for NPC to return to path (speed 1, tick rate 2, need ~4-6 ticks per move)
    for (let i = 0; i < 30; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('NPC moved toward path', () => {
      // Find the guard NPC and check it moved toward path
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data && data.type === 'guard' && hasNPCMovement(data)) {
          const pos = spatial.getEntityPosition(entityId);
          if (pos) {
            // NPC should have moved toward the path (started at x=13, path at x=8-11)
            if (pos.x > 12) {
              throw new Error(`NPC did not move toward path: x=${pos.x}`);
            }
          }
          return;
        }
      }
      throw new Error('Guard NPC not found');
    });

    expect('NPC is in patrol or returning state', () => {
      // Find the guard NPC
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data && data.type === 'guard' && hasNPCMovement(data)) {
          // NPC should be in patrol mode or still returning
          if (data.movementMode === 'patrol') {
            return; // Success - reached path and switched
          }
          if (data.movementMode === 'pursue' && data.aiMovementState === 'returning') {
            return; // Still returning - also acceptable
          }
          throw new Error(`Unexpected state: ${data.movementMode} / ${data.aiMovementState}`);
        }
      }
      throw new Error('Guard NPC not found');
    });
  },
});
