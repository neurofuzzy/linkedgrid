/**
 * Visual tests for ProjectileSystem and TurretSystem.
 *
 * Tests:
 * - Projectile movement along Bresenham paths
 * - Collision with entities and walls
 * - Piercing and bouncing behaviors
 * - Turret targeting and firing
 * - HealthSystem integration
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialSystem } from '../core/spatial-system';
import { SparseEntityStore } from '../core/entity-store';
import { LinkedGrid } from '../core/grid/linked-grid';
import { GameLoop } from '../core/game-loop';
import { HealthSystem } from '../systems/health.system';
import { ProjectileSystem } from '../systems/projectile.system';
import { TurretSystem } from '../systems/turret.system';
import { GameLayers } from '../config/layers.config';
import { Direction } from '../core/grid/direction';

describe('ProjectileSystem', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let healthSystem: HealthSystem;
  let projectileSystem: ProjectileSystem;

  beforeEach(() => {
    grid = new LinkedGrid(20, 20);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    gameLoop = new GameLoop(spatial);
    healthSystem = new HealthSystem();
    projectileSystem = new ProjectileSystem(healthSystem);
    gameLoop.addSystem(projectileSystem);
    gameLoop.addSystem(healthSystem);
  });

  it('moves projectile toward target', () => {
    // Spawn projectile at (5, 10) targeting (15, 10)
    const projectileId = spatial.spawn('projectile', 5, 10, GameLayers.EPHEMERALS, {
      targetX: 15,
      targetY: 10,
      damage: 10,
      speed: 2,
    });
    spatial.commit();

    // Run a few ticks
    gameLoop.tick();
    gameLoop.tick();
    gameLoop.tick();

    const pos = spatial.getEntityPosition(projectileId);
    expect(pos).not.toBeNull();
    // Should have moved right (started at 5, speed 2, 3 ticks = 6 cells)
    expect(pos!.x).toBeGreaterThan(5);
  });

  it('damages entity on collision', () => {
    // Spawn target at (10, 10)
    const targetId = spatial.spawn('enemy', 10, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });

    // Spawn projectile at (5, 10) targeting (15, 10) - will pass through (10, 10)
    spatial.spawn('projectile', 5, 10, GameLayers.EPHEMERALS, {
      targetX: 15,
      targetY: 10,
      damage: 25,
      speed: 5, // Fast enough to reach target in 1 tick
    });
    spatial.commit();

    // Run until projectile reaches target
    for (let i = 0; i < 3; i++) {
      gameLoop.tick();
    }

    const targetData = spatial.getEntityData(targetId);
    expect(targetData?.hp).toBe(75); // 100 - 25 = 75
  });

  it('piercing projectile hits multiple targets', () => {
    // Spawn two targets in a line
    const target1Id = spatial.spawn('enemy', 8, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });
    const target2Id = spatial.spawn('enemy', 12, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });

    // Spawn piercing projectile
    spatial.spawn('projectile', 5, 10, GameLayers.EPHEMERALS, {
      targetX: 15,
      targetY: 10,
      damage: 20,
      speed: 3,
      piercing: true,
    });
    spatial.commit();

    // Run until projectile passes through both
    for (let i = 0; i < 5; i++) {
      gameLoop.tick();
    }

    const target1Data = spatial.getEntityData(target1Id);
    const target2Data = spatial.getEntityData(target2Id);
    expect(target1Data?.hp).toBe(80); // Hit by piercing projectile
    expect(target2Data?.hp).toBe(80); // Also hit
  });

  it('non-piercing projectile stops on first hit', () => {
    // Spawn two targets in a line
    const target1Id = spatial.spawn('enemy', 8, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });
    const target2Id = spatial.spawn('enemy', 12, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });

    // Spawn non-piercing projectile
    spatial.spawn('projectile', 5, 10, GameLayers.EPHEMERALS, {
      targetX: 15,
      targetY: 10,
      damage: 20,
      speed: 3,
      piercing: false,
    });
    spatial.commit();

    // Run until projectile would have passed through both
    for (let i = 0; i < 5; i++) {
      gameLoop.tick();
    }

    const target1Data = spatial.getEntityData(target1Id);
    const target2Data = spatial.getEntityData(target2Id);
    expect(target1Data?.hp).toBe(80); // Hit
    expect(target2Data?.hp).toBe(100); // Not hit (projectile stopped)
  });

  it('projectile expires after lifetime', () => {
    const projectileId = spatial.spawn('projectile', 5, 10, GameLayers.EPHEMERALS, {
      targetX: 15,
      targetY: 10,
      damage: 10,
      speed: 1,
      lifetime: 3, // Very short lifetime
    });
    spatial.commit();

    // Tick 1, 2, 3 (should expire after)
    gameLoop.tick();
    gameLoop.tick();
    gameLoop.tick();
    gameLoop.tick(); // Removal happens here

    expect(spatial.isAlive(projectileId)).toBe(false);
  });

  it('projectile does not hit owner', () => {
    const ownerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });

    // Spawn projectile from owner, targeting same position
    spatial.spawn('projectile', 5, 10, GameLayers.EPHEMERALS, {
      targetX: 5,
      targetY: 10,
      damage: 50,
      speed: 1,
      ownerId: ownerId,
    });
    spatial.commit();

    gameLoop.tick();

    const ownerData = spatial.getEntityData(ownerId);
    expect(ownerData?.hp).toBe(100); // Not damaged
  });

  it('diagonal projectile follows Bresenham path', () => {
    // Spawn projectile diagonally
    const projectileId = spatial.spawn('projectile', 5, 5, GameLayers.EPHEMERALS, {
      targetX: 15,
      targetY: 10,
      damage: 10,
      speed: 2,
    });
    spatial.commit();

    // Run a few ticks
    for (let i = 0; i < 5; i++) {
      gameLoop.tick();
    }

    const pos = spatial.getEntityPosition(projectileId);
    // Should have moved diagonally
    if (pos) {
      expect(pos.x).toBeGreaterThan(5);
      expect(pos.y).toBeGreaterThan(5);
    }
  });
});

describe('TurretSystem', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let healthSystem: HealthSystem;
  let projectileSystem: ProjectileSystem;
  let turretSystem: TurretSystem;

  beforeEach(() => {
    grid = new LinkedGrid(20, 20);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    gameLoop = new GameLoop(spatial);
    healthSystem = new HealthSystem();
    projectileSystem = new ProjectileSystem(healthSystem);
    turretSystem = new TurretSystem(healthSystem, projectileSystem);
    gameLoop.addSystem(turretSystem);
    gameLoop.addSystem(projectileSystem);
    gameLoop.addSystem(healthSystem);
  });

  it('fixed turret fires ray in direction', () => {
    // Spawn target in line of fire
    const targetId = spatial.spawn('enemy', 15, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });

    // Spawn fixed ray turret
    spatial.spawn('turret', 5, 10, GameLayers.ACTORS, {
      weaponType: 'ray',
      targeting: 'fixed',
      fixedDirection: Direction.RIGHT,
      cooldown: 1,
      range: 15,
      rayDamage: 30,
    });
    spatial.commit();

    gameLoop.tick();

    const targetData = spatial.getEntityData(targetId);
    expect(targetData?.hp).toBe(70); // 100 - 30 = 70
  });

  it('turret respects cooldown', () => {
    const targetId = spatial.spawn('enemy', 15, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });

    spatial.spawn('turret', 5, 10, GameLayers.ACTORS, {
      weaponType: 'ray',
      targeting: 'fixed',
      fixedDirection: Direction.RIGHT,
      cooldown: 3, // Fire every 3 ticks
      range: 15,
      rayDamage: 10,
    });
    spatial.commit();

    // Tick 1: fires
    gameLoop.tick();
    let data = spatial.getEntityData(targetId);
    expect(data?.hp).toBe(90);

    // Tick 2, 3: on cooldown
    gameLoop.tick();
    gameLoop.tick();
    data = spatial.getEntityData(targetId);
    expect(data?.hp).toBe(90); // No additional damage

    // Tick 4: fires again
    gameLoop.tick();
    data = spatial.getEntityData(targetId);
    expect(data?.hp).toBe(80);
  });

  it('turret spawns projectile at target', () => {
    // Spawn target
    spatial.spawn('enemy', 15, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      team: 'enemy',
    });

    // Spawn projectile turret
    spatial.spawn('turret', 5, 10, GameLayers.ACTORS, {
      weaponType: 'projectile',
      targeting: 'nearest',
      cooldown: 1,
      range: 15,
      projectileDamage: 20,
      projectileSpeed: 2,
      team: 'player', // Different team so it targets the enemy
    });
    spatial.commit();

    // First tick: turret fires, projectile spawns
    gameLoop.tick();

    // Check that a projectile was spawned
    let projectileFound = false;
    for (const [entityId] of spatial.getAllPositions()) {
      const data = spatial.getEntityData(entityId);
      if (data?.type === 'projectile') {
        projectileFound = true;
        break;
      }
    }
    expect(projectileFound).toBe(true);
  });

  it('turret does not fire when target out of range', () => {
    // Spawn target far away
    const targetId = spatial.spawn('enemy', 18, 18, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });

    // Spawn turret with short range
    spatial.spawn('turret', 5, 10, GameLayers.ACTORS, {
      weaponType: 'ray',
      targeting: 'nearest',
      cooldown: 1,
      range: 5, // Only 5 cells
      rayDamage: 30,
    });
    spatial.commit();

    gameLoop.tick();

    const targetData = spatial.getEntityData(targetId);
    expect(targetData?.hp).toBe(100); // Not damaged (out of range)
  });

  it('turret does not target same team', () => {
    // Spawn ally on same team
    const allyId = spatial.spawn('ally', 10, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
      team: 'player',
    });

    // Spawn turret on player team
    spatial.spawn('turret', 5, 10, GameLayers.ACTORS, {
      weaponType: 'ray',
      targeting: 'nearest',
      cooldown: 1,
      range: 10,
      rayDamage: 30,
      team: 'player',
    });
    spatial.commit();

    gameLoop.tick();

    const allyData = spatial.getEntityData(allyId);
    expect(allyData?.hp).toBe(100); // Not damaged (same team)
  });

  it('piercing ray hits multiple targets', () => {
    // Spawn two targets in a line
    const target1Id = spatial.spawn('enemy', 8, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });
    const target2Id = spatial.spawn('enemy', 12, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });

    // Spawn piercing ray turret
    spatial.spawn('turret', 5, 10, GameLayers.ACTORS, {
      weaponType: 'ray',
      targeting: 'fixed',
      fixedDirection: Direction.RIGHT,
      cooldown: 1,
      range: 15,
      rayDamage: 25,
      rayPiercing: true,
    });
    spatial.commit();

    gameLoop.tick();

    const target1Data = spatial.getEntityData(target1Id);
    const target2Data = spatial.getEntityData(target2Id);
    expect(target1Data?.hp).toBe(75); // Hit
    expect(target2Data?.hp).toBe(75); // Also hit (piercing)
  });

  it('cardinal mode auto-detects open directions', () => {
    // Create walls on 3 sides of turret (left, up, down blocked)
    spatial.spawn('wall', 9, 10, GameLayers.WALLS, {});
    spatial.spawn('wall', 10, 9, GameLayers.WALLS, {});
    spatial.spawn('wall', 10, 11, GameLayers.WALLS, {});

    // Spawn target to the right
    const targetId = spatial.spawn('enemy', 15, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });

    // Spawn cardinal turret - should only fire right (only open direction)
    spatial.spawn('turret', 10, 10, GameLayers.ACTORS, {
      weaponType: 'ray',
      targeting: 'cardinal',
      cooldown: 1,
      range: 10,
      rayDamage: 20,
    });
    spatial.commit();

    // Sync masks so walls block
    spatial.syncMasks();

    gameLoop.tick();

    // Target should be hit (turret fires right)
    const targetData = spatial.getEntityData(targetId);
    expect(targetData?.hp).toBe(80);
  });

  it('cardinal mode cycles through directions', () => {
    // No walls - all 4 directions open
    // Spawn targets in all 4 directions
    const targetUp = spatial.spawn('enemy', 10, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });
    const targetDown = spatial.spawn('enemy', 10, 15, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });
    const targetLeft = spatial.spawn('enemy', 5, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });
    const targetRight = spatial.spawn('enemy', 15, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });

    // Spawn cardinal turret in center
    spatial.spawn('turret', 10, 10, GameLayers.ACTORS, {
      weaponType: 'ray',
      targeting: 'cardinal',
      cooldown: 1,
      range: 10,
      rayDamage: 10,
    });
    spatial.commit();

    // Fire 4 times to hit all directions
    gameLoop.tick(); // First direction
    gameLoop.tick(); // Second direction
    gameLoop.tick(); // Third direction
    gameLoop.tick(); // Fourth direction

    // At least one target should be hit (cycling through directions)
    const upData = spatial.getEntityData(targetUp);
    const downData = spatial.getEntityData(targetDown);
    const leftData = spatial.getEntityData(targetLeft);
    const rightData = spatial.getEntityData(targetRight);

    const totalDamage =
      (100 - (upData?.hp ?? 100)) +
      (100 - (downData?.hp ?? 100)) +
      (100 - (leftData?.hp ?? 100)) +
      (100 - (rightData?.hp ?? 100));

    // Should have fired 4 times, 10 damage each = 40 total damage distributed
    expect(totalDamage).toBe(40);
  });

  it('ray visual spawns on fire', () => {
    // Spawn fixed ray turret
    spatial.spawn('turret', 5, 10, GameLayers.ACTORS, {
      weaponType: 'ray',
      targeting: 'fixed',
      fixedDirection: Direction.RIGHT,
      cooldown: 1,
      range: 10,
      rayDamage: 10,
    });
    spatial.commit();

    gameLoop.tick();

    // Check for ray-effect entities
    let rayEffectCount = 0;
    for (const [entityId] of spatial.getAllPositions()) {
      const data = spatial.getEntityData(entityId);
      if (data?.type === 'ray-effect') {
        rayEffectCount++;
      }
    }

    expect(rayEffectCount).toBeGreaterThan(0);
  });
  it('turret does not fire through walls', () => {
    // Spawn target behind wall
    const targetId = spatial.spawn('enemy', 15, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });

    // Spawn wall in between
    spatial.spawn('wall', 10, 10, GameLayers.WALLS, {});

    // Spawn turret
    spatial.spawn('turret', 5, 10, GameLayers.ACTORS, {
      weaponType: 'ray',
      targeting: 'nearest',
      cooldown: 1,
      range: 15,
      rayDamage: 30,
    });
    spatial.commit();
    spatial.syncMasks(); // Ensure wall blocks visibility

    gameLoop.tick();

    const targetData = spatial.getEntityData(targetId);
    expect(targetData?.hp).toBe(100); // Not damaged
  });
  it('turret targeting player does not fire through walls', () => {
    // Spawn player behind wall
    const playerId = spatial.spawn('player', 15, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });

    // Spawn wall in between
    spatial.spawn('wall', 10, 10, GameLayers.WALLS, {});

    // Spawn turret targeting player
    spatial.spawn('turret', 5, 10, GameLayers.ACTORS, {
      weaponType: 'ray',
      targeting: 'player',
      cooldown: 1,
      range: 15,
      rayDamage: 30,
    });
    spatial.commit();
    spatial.syncMasks(); // Ensure wall blocks visibility

    // Mock game manager with player ID for the context (needed for player targeting)
    // We need to set up the context essentially.
    // In these tests, we usually rely on spatial... but findTarget accesses context.gameManager.gameState.playerEntityId
    // We need to ensure the GameLoop allows providing this context or mock it.
    // The current test setup instantiates GameLoop(spatial), and context.gameManager is missing.
    // We need to provide a gameManager or mock it to GameLoop.

    // However, looking at GameLoop.tick():
    // const context: GameContext = { ..., gameManager: this.gameManager ... }
    // If gameManager is undefined, context.gameManager is undefined.
    // TurretSystem.onTick calls context.gameManager?.gameState?.playerEntityId.

    // We must rebuild the game loop with a mock manager for this test.
    const mockManager = {
      gameState: {
        playerEntityId: playerId,
        entityStore: store
      }
    } as any;

    const testLoop = new GameLoop(spatial, mockManager);
    testLoop.addSystem(turretSystem);
    testLoop.addSystem(projectileSystem);
    testLoop.addSystem(healthSystem);

    testLoop.tick();

    const playerData = spatial.getEntityData(playerId);
    expect(playerData?.hp).toBe(100); // Not damaged
  });
});
