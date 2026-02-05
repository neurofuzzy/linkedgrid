/**
 * Tests for MeleeSystem.
 *
 * Tests melee combat mechanics:
 * - Player melee attacks on action input
 * - Attack cooldown
 * - Attack range
 * - Damage application
 * - Team-based targeting
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialSystem } from '../core/spatial-system';
import { SparseEntityStore } from '../core/entity-store';
import { LinkedGrid } from '../core/grid/linked-grid';
import { GameLoop } from '../core/game-loop';
import { GameManager } from '../core/game-manager';
import { GameState } from '../core/game-state';
import { SceneManager } from '../core/scene-manager';
import { HealthSystem } from '../systems/health.system';
import { MeleeSystem } from '../systems/melee.system';
import { GameLayers } from '../config/layers.config';
import { Direction } from '../core/grid/direction';
import { TestInputProvider } from './test-input-provider';

describe('MeleeSystem', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let healthSystem: HealthSystem;
  let meleeSystem: MeleeSystem;
  let inputProvider: TestInputProvider;

  beforeEach(() => {
    grid = new LinkedGrid(10, 10);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    gameLoop = new GameLoop(spatial);

    const gameState = new GameState();
    const sceneManager = new SceneManager(gameState);
    gameManager = new GameManager(gameState, sceneManager);

    healthSystem = new HealthSystem({ dyingDuration: 2 });
    inputProvider = new TestInputProvider();
    meleeSystem = new MeleeSystem(gameManager, inputProvider, healthSystem);

    gameLoop.addSystem(healthSystem);
    gameLoop.addSystem(meleeSystem);
  });

  it('player melee attack deals damage to adjacent enemy', () => {
    // Arrange: Player with melee at (5,5), enemy at (6,5)
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      meleeDamage: 25,
      meleeCooldown: 3,
      meleeRange: 1,
      sceneId: 'test',
      inventory: [],
      pushStrength: 1,
    });

    const enemyId = spatial.spawn('enemy', 6, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      damage: 5,
      aiState: 'idle',
      team: 'enemy',
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Act: Move right to set facing, then press action
    inputProvider.setDirection(Direction.RIGHT);
    gameLoop.tick(); // Set facing direction

    inputProvider.reset();
    inputProvider.setAction(true);
    gameLoop.tick(); // Attack

    // Assert: Enemy took damage
    const enemyData = spatial.getEntityData(enemyId);
    expect(enemyData?.hp).toBe(75); // 100 - 25
  });

  it('melee attack respects cooldown', () => {
    // Arrange: Player with melee at (5,5), enemy at (6,5)
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      meleeDamage: 25,
      meleeCooldown: 3, // 3 tick cooldown
      meleeRange: 1,
      sceneId: 'test',
      inventory: [],
      pushStrength: 1,
    });

    const enemyId = spatial.spawn('enemy', 6, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      damage: 5,
      aiState: 'idle',
      team: 'enemy',
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Set facing direction
    inputProvider.setDirection(Direction.RIGHT);
    gameLoop.tick();

    // First attack
    inputProvider.reset();
    inputProvider.setAction(true);
    gameLoop.tick();

    let enemyData = spatial.getEntityData(enemyId);
    expect(enemyData?.hp).toBe(75); // First attack hit

    // Try to attack again immediately (should be on cooldown)
    gameLoop.tick();
    gameLoop.tick();

    enemyData = spatial.getEntityData(enemyId);
    expect(enemyData?.hp).toBe(75); // No additional damage during cooldown

    // Wait for cooldown to expire
    gameLoop.tick(); // Tick 5 (cooldown of 3 expired)

    inputProvider.reset();
    inputProvider.setAction(true);
    gameLoop.tick();

    enemyData = spatial.getEntityData(enemyId);
    expect(enemyData?.hp).toBe(50); // Second attack hit
  });

  it('melee attack does not hit same team', () => {
    // Arrange: Player with melee at (5,5), ally at (6,5)
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      meleeDamage: 25,
      meleeCooldown: 3,
      meleeRange: 1,
      sceneId: 'test',
      inventory: [],
      pushStrength: 1,
      team: 'player',
    });

    const allyId = spatial.spawn('enemy', 6, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      damage: 5,
      aiState: 'idle',
      team: 'player', // Same team as player
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Set facing direction
    inputProvider.setDirection(Direction.RIGHT);
    gameLoop.tick();

    // Attack
    inputProvider.reset();
    inputProvider.setAction(true);
    gameLoop.tick();

    // Assert: Ally was NOT damaged
    const allyData = spatial.getEntityData(allyId);
    expect(allyData?.hp).toBe(100);
  });

  it('melee attack stops at walls', () => {
    // Arrange: Player with range 2, wall in the way, enemy behind wall
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      meleeDamage: 25,
      meleeCooldown: 3,
      meleeRange: 2, // Range 2
      sceneId: 'test',
      inventory: [],
      pushStrength: 1,
    });

    // Wall at (6,5) - directly in front
    spatial.spawn('wall', 6, 5, GameLayers.WALLS, {});

    // Enemy behind wall at (7,5)
    const enemyId = spatial.spawn('enemy', 7, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      damage: 5,
      aiState: 'idle',
      team: 'enemy',
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Set facing direction
    inputProvider.setDirection(Direction.RIGHT);
    gameLoop.tick();

    // Attack
    inputProvider.reset();
    inputProvider.setAction(true);
    gameLoop.tick();

    // Assert: Enemy behind wall was NOT damaged
    const enemyData = spatial.getEntityData(enemyId);
    expect(enemyData?.hp).toBe(100);
  });

  it('melee attack with range 2 hits enemies at distance 2', () => {
    // Arrange: Player with range 2, enemy at distance 2
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      meleeDamage: 25,
      meleeCooldown: 3,
      meleeRange: 2, // Range 2
      sceneId: 'test',
      inventory: [],
      pushStrength: 1,
    });

    // Enemy at (7,5) - 2 cells away
    const enemyId = spatial.spawn('enemy', 7, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      damage: 5,
      aiState: 'idle',
      team: 'enemy',
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Set facing direction
    inputProvider.setDirection(Direction.RIGHT);
    gameLoop.tick();

    // Attack
    inputProvider.reset();
    inputProvider.setAction(true);
    gameLoop.tick();

    // Assert: Enemy at range 2 was damaged
    const enemyData = spatial.getEntityData(enemyId);
    expect(enemyData?.hp).toBe(75);
  });

  it('no attack without action input', () => {
    // Arrange: Player with melee at (5,5), enemy at (6,5)
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      meleeDamage: 25,
      meleeCooldown: 3,
      meleeRange: 1,
      sceneId: 'test',
      inventory: [],
      pushStrength: 1,
    });

    const enemyId = spatial.spawn('enemy', 6, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      damage: 5,
      aiState: 'idle',
      team: 'enemy',
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Move without attacking
    inputProvider.setDirection(Direction.RIGHT);
    gameLoop.tick();

    // Assert: Enemy NOT damaged
    const enemyData = spatial.getEntityData(enemyId);
    expect(enemyData?.hp).toBe(100);
  });
});
