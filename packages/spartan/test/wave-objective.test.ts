/**
 * Tests for wave-clear objective type in ObjectiveSystem.
 *
 * Tests:
 * - wave-clear objective completes when all waves spawned and enemies cleared
 * - wave-clear objective respects score threshold
 * - wave-clear objective stays incomplete while waves are still active
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialSystem } from '../core/spatial-system';
import { SparseEntityStore } from '../core/entity-store';
import { LinkedGrid } from '../core/grid/linked-grid';
import { GameLoop } from '../core/game-loop';
import { GameState } from '../core/game-state';
import { GameManager } from '../core/game-manager';
import { SpawningSystem } from '../systems/spawning.system';
import { HealthSystem } from '../systems/health.system';
import { ObjectiveSystem } from '../systems/objective.system';
import { GameLayers } from '../config/layers.config';

describe('Wave-Clear Objective', () => {
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let spawningSystem: SpawningSystem;
  let healthSystem: HealthSystem;
  let objectiveSystem: ObjectiveSystem;

  beforeEach(() => {
    gameManager = new GameManager(new GameState());
    const scene = gameManager.sceneManager.createScene('arena', 20, 20);
    gameManager.sceneManager.setActiveScene('arena');
    spatial = scene.spatial;

    healthSystem = new HealthSystem();
    spawningSystem = new SpawningSystem();
    objectiveSystem = new ObjectiveSystem(gameManager, healthSystem);
    objectiveSystem.setSpawningSystem(spawningSystem);

    gameLoop = new GameLoop(spatial, gameManager);
    gameLoop.addSystem(spawningSystem);
    gameLoop.addSystem(healthSystem);
    gameLoop.addSystem(objectiveSystem);
  });

  function countEnemies(): number {
    let count = 0;
    for (const [entityId] of spatial.getAllPositions()) {
      const data = spatial.getEntityData(entityId);
      if (data?.type === 'enemy') count++;
    }
    return count;
  }

  function removeAllEnemies(): void {
    for (const [entityId] of spatial.getAllPositions()) {
      const data = spatial.getEntityData(entityId);
      if (data?.type === 'enemy') {
        spatial.remove(entityId);
      }
    }
    spatial.commit();
  }

  it('completes wave-clear when all waves done and enemies cleared', () => {
    // Arrange
    gameManager.gameState.objectives = [
      { id: 'waves', type: 'wave-clear', sceneId: 'arena', completed: false },
    ];

    const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, sceneId: 'arena',
    });
    gameManager.gameState.playerEntityId = playerId;

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

    // Wave spawns
    gameLoop.tick();
    expect(countEnemies()).toBe(2);
    expect(objectiveSystem.isObjectiveComplete('waves')).toBe(false);

    // Kill all enemies
    removeAllEnemies();
    gameLoop.tick(); // cleanup runs, wave-clear checks

    // Objective should be complete
    expect(objectiveSystem.isObjectiveComplete('waves')).toBe(true);
  });

  it('stays incomplete while enemies are alive', () => {
    // Arrange
    gameManager.gameState.objectives = [
      { id: 'waves', type: 'wave-clear', sceneId: 'arena', completed: false },
    ];

    const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, sceneId: 'arena',
    });
    gameManager.gameState.playerEntityId = playerId;

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

    // Wave spawns
    gameLoop.tick();
    expect(countEnemies()).toBe(2);

    // Tick without killing enemies
    gameLoop.tick();
    gameLoop.tick();

    // Objective should still be incomplete
    expect(objectiveSystem.isObjectiveComplete('waves')).toBe(false);
  });

  it('stays incomplete while waves are still pending', () => {
    // Arrange: 3 total waves with slow cooldown
    gameManager.gameState.objectives = [
      { id: 'waves', type: 'wave-clear', sceneId: 'arena', completed: false },
    ];

    const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, sceneId: 'arena',
    });
    gameManager.gameState.playerEntityId = playerId;

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
      totalWaves: 3,
      waveCooldown: 1,
    });
    spatial.commit();

    // Wave 1
    gameLoop.tick();
    removeAllEnemies();
    gameLoop.tick(); // cleanup + wave 2

    // Still not complete (wave 3 not spawned yet)
    expect(objectiveSystem.isObjectiveComplete('waves')).toBe(false);
  });

  it('respects score threshold', () => {
    // Arrange: wave-clear with score threshold of 100
    gameManager.gameState.objectives = [
      { id: 'waves', type: 'wave-clear', sceneId: 'arena', completed: false, scoreThreshold: 100 },
    ];
    gameManager.gameState.score = 50; // Below threshold

    const playerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, sceneId: 'arena',
    });
    gameManager.gameState.playerEntityId = playerId;

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
    });
    spatial.commit();

    gameLoop.tick();
    removeAllEnemies();
    gameLoop.tick();

    // Waves cleared but score too low
    expect(spawningSystem.areAllWavesCleared()).toBe(true);
    expect(objectiveSystem.isObjectiveComplete('waves')).toBe(false);

    // Now meet threshold
    gameManager.gameState.score = 100;
    gameLoop.tick();
    expect(objectiveSystem.isObjectiveComplete('waves')).toBe(true);
  });
});
