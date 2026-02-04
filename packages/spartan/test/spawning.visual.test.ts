/**
 * Visual tests for SpawningSystem.
 *
 * Tests:
 * - Spawner activation via player proximity
 * - Spawner activation via sleep-wake zones
 * - Spawn limit enforcement
 * - Cooldown between spawns
 * - Cardinal direction cycling
 * - Adjacent spawner grouping
 * - Dead source rejection
 * - Duplicate spawn prevention
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialSystem } from '../core/spatial-system';
import { SparseEntityStore } from '../core/entity-store';
import { LinkedGrid } from '../core/grid/linked-grid';
import { GameLoop } from '../core/game-loop';
import { SpawningSystem } from '../systems/spawning.system';
import { GameLayers } from '../config/layers.config';

describe('SpawningSystem', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let spawningSystem: SpawningSystem;
  let mockManager: any;

  beforeEach(() => {
    grid = new LinkedGrid(20, 20);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);

    // Create mock game manager
    mockManager = {
      gameState: {
        playerEntityId: -1, // Will be set when player is spawned
        entityStore: store,
      },
    };

    gameLoop = new GameLoop(spatial, mockManager);
    spawningSystem = new SpawningSystem(mockManager);
    gameLoop.addSystem(spawningSystem);
  });

  describe('Activation via player proximity', () => {
    it('spawns when player is within range', () => {
      // Spawn player at (5, 10)
      const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });
      mockManager.gameState.playerEntityId = playerId;

      // Spawn spawner at (10, 10) with activation range 8
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 3,
        cooldown: 5,
        activationRange: 8,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false, // Disable LOS for simplicity
        color: '#ff00ff',
      });
      spatial.commit();

      // Player is 5 cells away, within range 8
      gameLoop.tick();

      // Check that an enemy was spawned adjacent to spawner
      let enemyFound = false;
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          enemyFound = true;
          const pos = spatial.getEntityPosition(entityId);
          // Should be adjacent to spawner (10, 10)
          expect(pos).not.toBeNull();
          const dx = Math.abs(pos!.x - 10);
          const dy = Math.abs(pos!.y - 10);
          expect(dx + dy).toBe(1); // Cardinal adjacent
          break;
        }
      }
      expect(enemyFound).toBe(true);
    });

    it('does not spawn when player is out of range', () => {
      // Spawn player far away at (0, 0)
      const playerId = spatial.spawn('player', 0, 0, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });
      mockManager.gameState.playerEntityId = playerId;

      // Spawn spawner at (15, 15) with activation range 5
      spatial.spawn('spawner', 15, 15, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 3,
        cooldown: 1,
        activationRange: 5,
        spawnLayer: GameLayers.ACTORS,
        color: '#ff00ff',
      });
      spatial.commit();

      // Player is ~30 cells away (Manhattan), way out of range 5
      gameLoop.tick();

      // Check that no enemy was spawned
      let enemyCount = 0;
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          enemyCount++;
        }
      }
      expect(enemyCount).toBe(0);
    });

    it('respects line of sight requirement', () => {
      // Spawn player at (5, 10)
      const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });
      mockManager.gameState.playerEntityId = playerId;

      // Spawn wall between player and spawner
      spatial.spawn('wall', 7, 10, GameLayers.WALLS, {});

      // Spawn spawner at (10, 10) with LOS required
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 3,
        cooldown: 1,
        activationRange: 8,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: true,
        color: '#ff00ff',
      });
      spatial.commit();
      spatial.syncMasks(); // Ensure wall blocks

      gameLoop.tick();

      // Check that no enemy was spawned (LOS blocked)
      let enemyCount = 0;
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          enemyCount++;
        }
      }
      expect(enemyCount).toBe(0);
    });
  });

  describe('Activation via sleep-wake zone', () => {
    it('spawns when on active sleep-wake zone', () => {
      // Spawn sleep-wake entity at spawner location with active signal
      spatial.spawn('sleep-wake', 10, 10, GameLayers.LOGIC, {
        receiverType: 'sleep-wake',
        conductiveType: 'sleep-wake',
        receivedSignal: true, // Active!
        color: '#9900ff',
      });

      // Spawn spawner at same location with no proximity activation
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 3,
        cooldown: 5,
        activationRange: 0, // No proximity activation
        spawnLayer: GameLayers.ACTORS,
        color: '#ff00ff',
      });
      spatial.commit();

      gameLoop.tick();

      // Check that an enemy was spawned
      let enemyFound = false;
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          enemyFound = true;
          break;
        }
      }
      expect(enemyFound).toBe(true);
    });

    it('does not spawn when sleep-wake zone is inactive', () => {
      // Spawn sleep-wake entity with inactive signal
      spatial.spawn('sleep-wake', 10, 10, GameLayers.LOGIC, {
        receiverType: 'sleep-wake',
        conductiveType: 'sleep-wake',
        receivedSignal: false, // Inactive
        color: '#9900ff',
      });

      // Spawn spawner with no proximity activation
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 3,
        cooldown: 1,
        activationRange: 0,
        spawnLayer: GameLayers.ACTORS,
        color: '#ff00ff',
      });
      spatial.commit();

      gameLoop.tick();

      // Check that no enemy was spawned
      let enemyCount = 0;
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          enemyCount++;
        }
      }
      expect(enemyCount).toBe(0);
    });
  });

  describe('Spawn limits', () => {
    it('respects spawn limit', () => {
      // Spawn player in range
      const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });
      mockManager.gameState.playerEntityId = playerId;

      // Spawn spawner with limit of 2
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 2,
        cooldown: 1, // Fast cooldown
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
      });
      spatial.commit();

      // Run many ticks
      for (let i = 0; i < 10; i++) {
        gameLoop.tick();
      }

      // Count enemies
      let enemyCount = 0;
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          enemyCount++;
        }
      }
      expect(enemyCount).toBe(2); // Should not exceed limit
    });

    it('can spawn more after spawned entities die', () => {
      // Spawn player in range
      const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });
      mockManager.gameState.playerEntityId = playerId;

      // Spawn spawner with limit of 1
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 1,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
      });
      spatial.commit();

      // First spawn
      gameLoop.tick();

      // Find and kill the enemy
      let enemyId: number | null = null;
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          enemyId = entityId;
          break;
        }
      }
      expect(enemyId).not.toBeNull();

      spatial.remove(enemyId!);
      spatial.commit();

      // Run more ticks - should be able to spawn again
      gameLoop.tick();
      gameLoop.tick();

      // Count enemies (should have spawned a new one)
      let enemyCount = 0;
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          enemyCount++;
        }
      }
      expect(enemyCount).toBe(1);
    });
  });

  describe('Cooldown', () => {
    it('respects cooldown between spawns', () => {
      // Spawn player in range
      const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });
      mockManager.gameState.playerEntityId = playerId;

      // Spawn spawner with cooldown of 5
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 10, // High limit
        cooldown: 5,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
      });
      spatial.commit();

      // Run 3 ticks
      gameLoop.tick(); // Tick 1: spawns
      gameLoop.tick(); // Tick 2: on cooldown
      gameLoop.tick(); // Tick 3: on cooldown

      // Count enemies - should only be 1
      let enemyCount = 0;
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          enemyCount++;
        }
      }
      expect(enemyCount).toBe(1);

      // Run more ticks to pass cooldown
      gameLoop.tick(); // Tick 4
      gameLoop.tick(); // Tick 5: cooldown over
      gameLoop.tick(); // Tick 6: spawns again

      // Count enemies again
      enemyCount = 0;
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          enemyCount++;
        }
      }
      expect(enemyCount).toBe(2);
    });
  });

  describe('Cardinal direction cycling', () => {
    it('cycles through cardinal directions when spawning', () => {
      // Spawn player in range
      const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });
      mockManager.gameState.playerEntityId = playerId;

      // Spawn spawner with high limit and low cooldown
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 4,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
      });
      spatial.commit();

      // Run 4 ticks to spawn 4 enemies
      for (let i = 0; i < 4; i++) {
        gameLoop.tick();
      }

      // Collect enemy positions
      const enemyPositions: Array<{ x: number; y: number }> = [];
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          const pos = spatial.getEntityPosition(entityId);
          if (pos) {
            enemyPositions.push({ x: pos.x, y: pos.y });
          }
        }
      }

      // Should have 4 enemies in 4 different adjacent cells
      expect(enemyPositions.length).toBe(4);

      // Check all are adjacent to (10, 10)
      for (const pos of enemyPositions) {
        const dx = Math.abs(pos.x - 10);
        const dy = Math.abs(pos.y - 10);
        expect(dx + dy).toBe(1);
      }

      // Check all positions are unique
      const uniqueKeys = new Set(enemyPositions.map((p) => `${p.x},${p.y}`));
      expect(uniqueKeys.size).toBe(4);
    });

    it('skips blocked adjacent cells', () => {
      // Spawn player in range
      const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });
      mockManager.gameState.playerEntityId = playerId;

      // Block 3 adjacent cells with walls
      spatial.spawn('wall', 10, 9, GameLayers.WALLS, {}); // UP
      spatial.spawn('wall', 11, 10, GameLayers.WALLS, {}); // RIGHT
      spatial.spawn('wall', 10, 11, GameLayers.WALLS, {}); // DOWN

      // Spawn spawner
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 2,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
      });
      spatial.commit();
      spatial.syncMasks();

      // Run ticks
      gameLoop.tick();
      gameLoop.tick();

      // All enemies should be at (9, 10) - the only open cell
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          const pos = spatial.getEntityPosition(entityId);
          expect(pos?.x).toBe(9); // LEFT is only open direction
          expect(pos?.y).toBe(10);
        }
      }
    });
  });

  describe('Adjacent spawner grouping', () => {
    it('groups adjacent spawners and shares spawn limit', () => {
      // Spawn player in range
      const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });
      mockManager.gameState.playerEntityId = playerId;

      // Spawn two adjacent spawners with limit 2 each
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 2,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
      });
      spatial.spawn('spawner', 11, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 2,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
      });
      spatial.commit();

      // Run many ticks
      for (let i = 0; i < 10; i++) {
        gameLoop.tick();
      }

      // Count enemies - should be 2 (shared limit from first spawner)
      let enemyCount = 0;
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          enemyCount++;
        }
      }
      expect(enemyCount).toBe(2);
    });

    it('groups share cooldown', () => {
      // Spawn player in range
      const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });
      mockManager.gameState.playerEntityId = playerId;

      // Spawn two adjacent spawners with long cooldown
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 10,
        cooldown: 5, // Long cooldown
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
      });
      spatial.spawn('spawner', 11, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 10,
        cooldown: 5,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
      });
      spatial.commit();

      // Run 3 ticks
      gameLoop.tick(); // Spawns 1
      gameLoop.tick(); // Cooldown
      gameLoop.tick(); // Cooldown

      // Should only have 1 enemy (shared cooldown)
      let enemyCount = 0;
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          enemyCount++;
        }
      }
      expect(enemyCount).toBe(1);
    });

    it('aggregates adjacent cells from all group members', () => {
      // Spawn player in range
      const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });
      mockManager.gameState.playerEntityId = playerId;

      // Spawn two adjacent spawners
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 8, // High limit
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
      });
      spatial.spawn('spawner', 11, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 8,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
      });
      spatial.commit();

      // Run enough ticks to fill all adjacent cells
      for (let i = 0; i < 10; i++) {
        gameLoop.tick();
      }

      // Count unique positions where enemies spawned
      const enemyPositions = new Set<string>();
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          const pos = spatial.getEntityPosition(entityId);
          if (pos) {
            enemyPositions.add(`${pos.x},${pos.y}`);
          }
        }
      }

      // Should have used cells from both spawners' adjacencies
      // Spawner 1 (10,10): (9,10), (10,9), (10,11)
      // Spawner 2 (11,10): (12,10), (11,9), (11,11)
      // Shared: none (they're adjacent to each other)
      // Total unique: 6 positions available
      expect(enemyPositions.size).toBeGreaterThan(2);
    });

    it('L-shaped group never spawns on top of spawners', () => {
      // Spawn player in range
      const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });
      mockManager.gameState.playerEntityId = playerId;

      // Create L-shaped group of 3 spawners:
      // (10,10) - (11,10)
      //    |
      // (10,11)
      const spawner1Id = spatial.spawn('spawner', 10, 10, GameLayers.WALLS, {
        spawnType: 'enemy',
        spawnLimit: 10,
        cooldown: 1,
        activationRange: 15,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff0000',
      });
      const spawner2Id = spatial.spawn('spawner', 11, 10, GameLayers.WALLS, {
        spawnType: 'enemy',
        spawnLimit: 10,
        cooldown: 1,
        activationRange: 15,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff0000',
      });
      const spawner3Id = spatial.spawn('spawner', 10, 11, GameLayers.WALLS, {
        spawnType: 'enemy',
        spawnLimit: 10,
        cooldown: 1,
        activationRange: 15,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff0000',
      });
      spatial.commit();
      spatial.syncMasks();

      const spawnerPositions = new Set(['10,10', '11,10', '10,11']);

      // Run many ticks
      for (let i = 0; i < 15; i++) {
        gameLoop.tick();
      }

      // Collect enemy positions
      const enemyPositions: Array<{ x: number; y: number }> = [];
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          const pos = spatial.getEntityPosition(entityId);
          if (pos) {
            enemyPositions.push({ x: pos.x, y: pos.y });
          }
        }
      }

      // No enemy should be on a spawner position
      for (const pos of enemyPositions) {
        const key = `${pos.x},${pos.y}`;
        expect(spawnerPositions.has(key)).toBe(false);
      }

      // Should have spawned multiple enemies
      expect(enemyPositions.length).toBeGreaterThan(0);

      // All enemies should be adjacent to at least one spawner
      // Valid positions: (10,9), (9,10), (11,9), (12,10), (11,11), (10,12), (9,11)
      for (const pos of enemyPositions) {
        const adjacentToSpawner = [
          [10, 10], [11, 10], [10, 11]
        ].some(([sx, sy]) => {
          const dx = Math.abs(pos.x - sx);
          const dy = Math.abs(pos.y - sy);
          return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
        });
        expect(adjacentToSpawner).toBe(true);
      }
    });
  });

  describe('Dead source rejection', () => {
    it('does not spawn if spawner is dead', () => {
      // Spawn player in range
      const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });
      mockManager.gameState.playerEntityId = playerId;

      // Spawn spawner
      const spawnerId = spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 3,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
      });
      spatial.commit();

      // First tick - should spawn
      gameLoop.tick();

      // Kill the spawner
      spatial.remove(spawnerId);
      spatial.commit();

      // Run more ticks
      gameLoop.tick();
      gameLoop.tick();

      // Should still only have 1 enemy (no more spawning)
      let enemyCount = 0;
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          enemyCount++;
        }
      }
      expect(enemyCount).toBe(1);
    });
  });

  describe('Duplicate spawn prevention', () => {
    it('prevents multiple spawns on same cell+layer+tick', () => {
      // This is implicitly tested by the grouping tests,
      // but let's verify explicitly with a single spawner
      
      // Spawn player in range
      const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });
      mockManager.gameState.playerEntityId = playerId;

      // Block all but one adjacent cell
      spatial.spawn('wall', 10, 9, GameLayers.WALLS, {}); // UP
      spatial.spawn('wall', 11, 10, GameLayers.WALLS, {}); // RIGHT
      spatial.spawn('wall', 10, 11, GameLayers.WALLS, {}); // DOWN

      // Spawn spawner with high limit
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 5,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
      });
      spatial.commit();
      spatial.syncMasks();

      // First tick
      gameLoop.tick();

      // Should only spawn 1 enemy (cell is then blocked by actor)
      let enemyCount = 0;
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          enemyCount++;
        }
      }
      expect(enemyCount).toBe(1);
    });
  });

  describe('Spawn props', () => {
    it('passes spawn props to spawned entities', () => {
      // Spawn player in range
      const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
      });
      mockManager.gameState.playerEntityId = playerId;

      // Spawn spawner with custom spawn props
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 1,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
        spawnProps: {
          hp: 50,
          maxHp: 50,
          customField: 'test-value',
        },
      });
      spatial.commit();

      gameLoop.tick();

      // Find spawned enemy and check props
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          expect(data.hp).toBe(50);
          expect(data.maxHp).toBe(50);
          expect((data as any).customField).toBe('test-value');
          break;
        }
      }
    });
  });
});
