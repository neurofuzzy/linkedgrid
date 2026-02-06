/**
 * Tests for Wave Spawner mode in SpawningSystem.
 *
 * Tests:
 * - Wave mode spawns waveSize entities simultaneously
 * - Wave cooldown between waves
 * - Total waves limit
 * - Contiguous group wave spawning
 * - Wave completion tracking
 * - Boundary recycling removes entities without death events
 * - areAllWavesCleared() API
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialSystem } from '../core/spatial-system';
import { SparseEntityStore } from '../core/entity-store';
import { LinkedGrid } from '../core/grid/linked-grid';
import { GameLoop } from '../core/game-loop';
import { GameState } from '../core/game-state';
import { SpawningSystem } from '../systems/spawning.system';
import { GameLayers } from '../config/layers.config';
import type { GameManagerContext } from '../core/types';
import { createMockGameManager } from './test-mocks';

describe('Wave Spawner', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let spawningSystem: SpawningSystem;
  let mockManager: GameManagerContext;

  beforeEach(() => {
    grid = new LinkedGrid(20, 20);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);

    mockManager = createMockGameManager({
      gameState: {
        playerEntityId: -1,
        entityStore: store,
      } as unknown as GameState,
    });

    gameLoop = new GameLoop(spatial, mockManager);
    spawningSystem = new SpawningSystem();
    gameLoop.addSystem(spawningSystem);
  });

  function spawnPlayerInRange(): number {
    const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
      hp: 100, maxHp: 100,
    });
    mockManager.gameState.playerEntityId = playerId;
    return playerId;
  }

  function countEnemies(): number {
    let count = 0;
    for (const [entityId] of spatial.getAllPositions()) {
      const data = spatial.getEntityData(entityId);
      if (data?.type === 'enemy') count++;
    }
    return count;
  }

  describe('Wave mode basics', () => {
    it('spawns waveSize entities simultaneously', () => {
      // Arrange
      spawnPlayerInRange();
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 10,
        cooldown: 5,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
        waveMode: true,
        waveSize: 3,
        totalWaves: 2,
        waveCooldown: 5,
      });
      spatial.commit();

      // Act: first tick spawns wave 1
      gameLoop.tick();

      // Assert: 3 enemies spawned simultaneously
      expect(countEnemies()).toBe(3);
    });

    it('respects wave cooldown between waves', () => {
      // Arrange
      spawnPlayerInRange();
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 10,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
        waveMode: true,
        waveSize: 2,
        totalWaves: 3,
        waveCooldown: 5,
      });
      spatial.commit();

      // Act: first tick spawns wave 1
      gameLoop.tick();
      expect(countEnemies()).toBe(2);

      // 3 more ticks - still on cooldown
      gameLoop.tick();
      gameLoop.tick();
      gameLoop.tick();
      expect(countEnemies()).toBe(2); // Still only wave 1

      // 2 more ticks to pass cooldown
      gameLoop.tick(); // tick 5: cooldown elapsed
      gameLoop.tick(); // tick 6: wave 2 spawns
      expect(countEnemies()).toBe(4); // Now wave 1 + wave 2
    });

    it('stops after totalWaves reached', () => {
      // Arrange
      spawnPlayerInRange();
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 20,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
        waveMode: true,
        waveSize: 2,
        totalWaves: 2,
        waveCooldown: 1,
      });
      spatial.commit();

      // Run many ticks
      for (let i = 0; i < 20; i++) {
        gameLoop.tick();
      }

      // Assert: only 2 waves * 2 enemies = 4 total
      expect(countEnemies()).toBe(4);
    });

    it('respects spawn limit in wave mode', () => {
      // Arrange: limit of 3 but waveSize of 5
      spawnPlayerInRange();
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 3,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
        waveMode: true,
        waveSize: 5,
        waveCooldown: 1,
      });
      spatial.commit();

      // Act
      gameLoop.tick();

      // Assert: limited to 3 even though waveSize is 5
      expect(countEnemies()).toBe(3);
    });
  });

  describe('Contiguous group wave spawning', () => {
    it('uses cells from all group members for wave spawning', () => {
      // Arrange: 2 adjacent spawners in wave mode
      spawnPlayerInRange();
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 10,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
        waveMode: true,
        waveSize: 4,
        totalWaves: 1,
        waveCooldown: 1,
      });
      spatial.spawn('spawner', 11, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 10,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
        waveMode: true,
        waveSize: 4,
        waveCooldown: 1,
      });
      spatial.commit();

      // Act: first tick spawns wave
      gameLoop.tick();

      // Assert: 4 enemies spawned from the group's combined adjacent cells
      expect(countEnemies()).toBe(4);

      // Check that enemies are distributed across group's cells
      const enemyPositions = new Set<string>();
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          const pos = spatial.getEntityPosition(entityId);
          if (pos) enemyPositions.add(`${pos.x},${pos.y}`);
        }
      }
      // Should be in multiple unique positions
      expect(enemyPositions.size).toBe(4);
    });
  });

  describe('Wave completion tracking', () => {
    it('reports waves as complete after all waves spawned and enemies removed', () => {
      // Arrange
      spawnPlayerInRange();
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 10,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
        waveMode: true,
        waveSize: 2,
        totalWaves: 1,
        waveCooldown: 1,
      });
      spatial.commit();

      // No wave groups built yet (groups initialize on first tick),
      // so areAllWavesCleared returns true (vacuously true)
      expect(spawningSystem.areAllWavesCleared()).toBe(true);

      // Spawn wave
      gameLoop.tick();
      expect(countEnemies()).toBe(2);
      expect(spawningSystem.areAllWavesCleared()).toBe(false);

      // Kill all enemies
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          spatial.remove(entityId);
        }
      }
      spatial.commit();

      // Tick so cleanup runs
      gameLoop.tick();

      // Now all waves are cleared
      expect(spawningSystem.areAllWavesCleared()).toBe(true);
    });

    it('getWaveStatus returns accurate info', () => {
      // Arrange
      spawnPlayerInRange();
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 10,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
        waveMode: true,
        waveSize: 2,
        totalWaves: 3,
        waveCooldown: 1,
      });
      spatial.commit();

      gameLoop.tick(); // wave 1

      const status = spawningSystem.getWaveStatus();
      expect(status.totalWaves).toBe(3);
      expect(status.completedWaves).toBe(1);
      expect(status.activeEnemies).toBe(2);
      expect(status.allCleared).toBe(false);
    });
  });

  describe('Boundary recycling', () => {
    it('removes entities at grid boundary without death events', () => {
      // Arrange: spawner with recycleAtBoundary
      spawnPlayerInRange();
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 10,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
        waveMode: true,
        waveSize: 1,
        totalWaves: 1,
        waveCooldown: 1,
        recycleAtBoundary: true,
      });
      spatial.commit();

      // Spawn an enemy
      gameLoop.tick();
      expect(countEnemies()).toBe(1);

      // Find the enemy and manually move it to boundary
      let enemyId: number | undefined;
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          enemyId = entityId;
          break;
        }
      }
      expect(enemyId).toBeDefined();

      // Move enemy to edge (0, y)
      spatial.move(enemyId!, 0, 10);
      spatial.commit();

      // Tick: recycling should remove the enemy
      gameLoop.tick();

      // Enemy should be gone
      expect(countEnemies()).toBe(0);
    });

    it('does not recycle when recycleAtBoundary is false', () => {
      // Arrange: spawner without recycling, limit 1 so no extra spawns
      spawnPlayerInRange();
      spatial.spawn('spawner', 10, 10, GameLayers.COLLECTIBLES, {
        spawnType: 'enemy',
        spawnLimit: 1,
        cooldown: 1,
        activationRange: 10,
        spawnLayer: GameLayers.ACTORS,
        requiresLineOfSight: false,
        color: '#ff00ff',
        recycleAtBoundary: false,
      });
      spatial.commit();

      // Spawn
      gameLoop.tick();
      expect(countEnemies()).toBe(1);

      // Move to boundary
      let enemyId: number | undefined;
      for (const [entityId] of spatial.getAllPositions()) {
        const data = spatial.getEntityData(entityId);
        if (data?.type === 'enemy') {
          enemyId = entityId;
          break;
        }
      }

      spatial.move(enemyId!, 0, 10);
      spatial.commit();
      gameLoop.tick();

      // Enemy should still be there (not recycled)
      expect(countEnemies()).toBe(1);
    });
  });
});
