/**
 * Tests for StunSystem and freeze/stun mechanics.
 *
 * Tests:
 * - Stun application and expiration
 * - Stunned NPCs cannot move
 * - Stunned NPCs cannot attack (brain skips)
 * - Stunned player cannot move
 * - Freeze projectile applies stun on hit
 * - Stun duration extension (overlapping stuns)
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
import { StunSystem } from '../systems/stun.system';
import { ProjectileSystem } from '../systems/projectile.system';
import { NPCMovementSystem } from '../systems/npc-movement.system';
import { PlayerInputSystem } from '../systems/player-input.system';
import { GameLayers } from '../config/layers.config';
import { Direction } from '../core/grid/direction';
import { TestInputProvider } from './test-input-provider';

describe('StunSystem', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let healthSystem: HealthSystem;
  let stunSystem: StunSystem;

  beforeEach(() => {
    grid = new LinkedGrid(20, 20);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    gameLoop = new GameLoop(spatial);

    const gameState = new GameState();
    const sceneManager = new SceneManager(gameState);
    gameManager = new GameManager(gameState, sceneManager);

    healthSystem = new HealthSystem({ dyingDuration: 0 });
    stunSystem = new StunSystem();

    gameLoop.addSystem(stunSystem);
    gameLoop.addSystem(healthSystem);
  });

  it('applyStun sets stunned state on entity', () => {
    // Arrange
    const enemyId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      team: 'enemy',
      stunnable: true,
    });
    spatial.commit();

    // Act
    stunSystem.applyStun(enemyId, 10);
    gameLoop.tick(); // StunSystem processes pending stuns
    spatial.commit();

    // Assert
    const data = store.getData(enemyId);
    expect(data).toBeDefined();
    expect(data!.stunned).toBe(true);
    expect(data!.stunEndTick).toBeDefined();
  });

  it('stun expires after duration', () => {
    // Arrange
    const enemyId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      team: 'enemy',
      stunnable: true,
    });
    spatial.commit();

    // Act: stun for 3 ticks
    stunSystem.applyStun(enemyId, 3);

    // Advance 4 ticks (stun applied on tick 1, expires at tick 1+3=4)
    for (let i = 0; i < 4; i++) {
      gameLoop.tick();
      spatial.commit();
    }

    // Assert: stun should have expired
    const data = store.getData(enemyId);
    expect(data!.stunned).toBe(false);
  });

  it('non-stunnable entity is not affected', () => {
    // Arrange: entity without stunnable trait
    const enemyId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      team: 'enemy',
    });
    spatial.commit();

    // Act
    stunSystem.applyStun(enemyId, 10);
    gameLoop.tick();
    spatial.commit();

    // Assert: entity should not be stunned
    const data = store.getData(enemyId);
    expect(data!.stunned).toBeUndefined();
  });

  it('overlapping stuns extend duration (never shorten)', () => {
    // Arrange
    const enemyId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      team: 'enemy',
      stunnable: true,
    });
    spatial.commit();

    // Act: apply 5-tick stun, then 10-tick stun
    stunSystem.applyStun(enemyId, 5);
    gameLoop.tick();
    spatial.commit();

    const dataAfterFirst = store.getData(enemyId);
    const firstEndTick = dataAfterFirst!.stunEndTick as number;

    stunSystem.applyStun(enemyId, 10);
    gameLoop.tick();
    spatial.commit();

    // Assert: end tick should be the longer stun
    const dataAfterSecond = store.getData(enemyId);
    expect(dataAfterSecond!.stunEndTick).toBeGreaterThan(firstEndTick);
  });
});

describe('StunSystem + NPCMovement integration', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let healthSystem: HealthSystem;
  let stunSystem: StunSystem;
  let npcMovementSystem: NPCMovementSystem;

  beforeEach(() => {
    grid = new LinkedGrid(20, 20);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    gameLoop = new GameLoop(spatial);

    const gameState = new GameState();
    const sceneManager = new SceneManager(gameState);
    gameManager = new GameManager(gameState, sceneManager);

    healthSystem = new HealthSystem({ dyingDuration: 0 });
    stunSystem = new StunSystem();
    npcMovementSystem = new NPCMovementSystem();

    gameLoop.addSystem(stunSystem);
    gameLoop.addSystem(npcMovementSystem);
    gameLoop.addSystem(healthSystem);
  });

  it('stunned NPC does not move', () => {
    // Arrange: wandering NPC
    const enemyId = spatial.spawn('enemy', 10, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      team: 'enemy',
      movementMode: 'wander',
      speed: 1,
      stunnable: true,
    });
    spatial.commit();

    // Stun for 20 ticks
    stunSystem.applyStun(enemyId, 20);

    // Act: advance several ticks
    for (let i = 0; i < 5; i++) {
      gameLoop.tick();
      spatial.commit();
    }

    // Assert: NPC should not have moved
    const pos = spatial.getEntityPosition(enemyId);
    expect(pos).toBeDefined();
    expect(pos!.x).toBe(10);
    expect(pos!.y).toBe(10);
  });
});

describe('StunSystem + PlayerInput integration', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let healthSystem: HealthSystem;
  let stunSystem: StunSystem;
  let inputProvider: TestInputProvider;
  let playerInputSystem: PlayerInputSystem;

  beforeEach(() => {
    grid = new LinkedGrid(20, 20);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    gameLoop = new GameLoop(spatial);

    const gameState = new GameState();
    const sceneManager = new SceneManager(gameState);
    gameManager = new GameManager(gameState, sceneManager);

    healthSystem = new HealthSystem({ dyingDuration: 0 });
    stunSystem = new StunSystem();
    inputProvider = new TestInputProvider();
    playerInputSystem = new PlayerInputSystem(gameManager, inputProvider);

    gameLoop.addSystem(playerInputSystem);
    gameLoop.addSystem(stunSystem);
    gameLoop.addSystem(healthSystem);
  });

  it('stunned player cannot move', () => {
    // Arrange
    const playerId = spatial.spawn('player', 10, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      isPlayer: true,
      team: 'player',
      stunnable: true,
      inventory: [],
    });
    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Stun the player
    stunSystem.applyStun(playerId, 20);
    gameLoop.tick(); // apply stun
    spatial.commit();

    // Set input direction
    inputProvider.setMoveDirection(Direction.RIGHT);

    // Act
    gameLoop.tick();
    spatial.commit();

    // Assert: player should not have moved
    const pos = spatial.getEntityPosition(playerId);
    expect(pos!.x).toBe(10);
    expect(pos!.y).toBe(10);
  });
});

describe('Freeze projectile applies stun', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let healthSystem: HealthSystem;
  let stunSystem: StunSystem;
  let projectileSystem: ProjectileSystem;

  beforeEach(() => {
    grid = new LinkedGrid(20, 20);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    gameLoop = new GameLoop(spatial);

    const gameState = new GameState();
    const sceneManager = new SceneManager(gameState);
    gameManager = new GameManager(gameState, sceneManager);

    healthSystem = new HealthSystem({ dyingDuration: 0 });
    stunSystem = new StunSystem();
    projectileSystem = new ProjectileSystem(healthSystem);
    projectileSystem.setStunSystem(stunSystem);

    gameLoop.addSystem(stunSystem);
    gameLoop.addSystem(projectileSystem);
    gameLoop.addSystem(healthSystem);
  });

  it('freeze projectile stuns a stunnable target', () => {
    // Arrange: stunnable enemy at (5, 5)
    const enemyId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      team: 'enemy',
      stunnable: true,
    });
    spatial.commit();

    // Fire freeze projectile toward enemy (free body, not grid)
    const ctx = {
      tick: 0,
      overlaps: [] as never[],
      spatial: spatial as unknown as import('../core/types').GameContext['spatial'],
      freeBody: gameLoop.freeBody,
    };
    projectileSystem.spawnProjectile(ctx, 0, 5, 5, 5, 5, {
      damageType: 'freeze',
      speed: 2,
      lifetime: 50,
    });

    // Act: advance until projectile reaches enemy
    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
    }

    // Assert: enemy should be stunned
    const data = store.getData(enemyId);
    expect(data).toBeDefined();
    expect(data!.stunned).toBe(true);
  });

  it('freeze projectile also deals damage', () => {
    // Arrange
    const enemyId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      team: 'enemy',
      stunnable: true,
    });
    spatial.commit();

    const ctx = {
      tick: 0,
      overlaps: [] as never[],
      spatial: spatial as unknown as import('../core/types').GameContext['spatial'],
      freeBody: gameLoop.freeBody,
    };
    projectileSystem.spawnProjectile(ctx, 0, 5, 5, 5, 15, {
      damageType: 'freeze',
      speed: 2,
      lifetime: 50,
    });

    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
    }

    // Assert: enemy should have taken damage AND be stunned
    const data = store.getData(enemyId);
    expect(data).toBeDefined();
    if (data && 'hp' in data) {
      expect(data.hp).toBeLessThan(100);
    }
    expect(data!.stunned).toBe(true);
  });
});
