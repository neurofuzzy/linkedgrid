/**
 * Visual tests for ProjectileSystem and TurretSystem.
 *
 * Tests:
 * - Projectile movement with parametric float paths
 * - Collision with entities and walls
 * - Piercing and bouncing behaviors
 * - Turret targeting and firing
 * - HealthSystem integration
 * - Free-body positioning (no grid cell occupancy)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getHp } from './test-helpers';
import { SpatialSystem } from '../core/spatial-system';
import { SparseEntityStore } from '../core/entity-store';
import { LinkedGrid } from '../core/grid/linked-grid';
import { GameLoop } from '../core/game-loop';
import { HealthSystem } from '../systems/health.system';
import { ProjectileSystem } from '../systems/projectile.system';
import { TurretSystem } from '../systems/turret.system';
import { GameLayers } from '../config/layers.config';
import { Direction } from '../core/grid/direction';
import { GameManager } from '../core/game-manager';
import type { GameContext } from '../core/types';

describe('ProjectileSystem', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let healthSystem: HealthSystem;
  let projectileSystem: ProjectileSystem;

  /** Helper to build a minimal GameContext for spawning projectiles before ticking */
  function makeContext(): GameContext {
    return {
      tick: 0,
      overlaps: [],
      spatial: spatial as unknown as GameContext['spatial'],
      freeBody: gameLoop.freeBody,
    };
  }

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
    // Spawn projectile at (5, 10) targeting (15, 10) via free-body
    const projectileId = projectileSystem.spawnProjectile(
      makeContext(), 5, 10, 15, 10, 10, { speed: 2 }
    );

    // Run a few ticks
    gameLoop.tick();
    gameLoop.tick();
    gameLoop.tick();

    const pos = gameLoop.freeBody.getPosition(projectileId);
    expect(pos).not.toBeNull();
    // Should have moved right (started at 5, speed 2, 3 ticks = 6 cells)
    expect(pos!.x).toBeGreaterThan(5);
  });

  it('damages entity on collision', () => {
    // Spawn target at (10, 10) on the grid
    const targetId = spatial.spawn('enemy', 10, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });
    spatial.commit();

    // Spawn projectile at (5, 10) targeting (15, 10) - will pass through (10, 10)
    projectileSystem.spawnProjectile(
      makeContext(), 5, 10, 15, 10, 25, { speed: 5 }
    );

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
    spatial.commit();

    // Spawn piercing projectile
    projectileSystem.spawnProjectile(
      makeContext(), 5, 10, 15, 10, 20, { speed: 3, piercing: true }
    );

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
    spatial.commit();

    // Spawn non-piercing projectile
    projectileSystem.spawnProjectile(
      makeContext(), 5, 10, 15, 10, 20, { speed: 3, piercing: false }
    );

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
    const projectileId = projectileSystem.spawnProjectile(
      makeContext(), 5, 10, 15, 10, 10, { speed: 1, lifetime: 3 }
    );

    // Tick 1, 2, 3 (should expire after)
    gameLoop.tick();
    gameLoop.tick();
    gameLoop.tick();
    gameLoop.tick(); // Removal happens here

    // After removal, entity is gone from store
    const data = store.getData(projectileId);
    expect(data).toBeUndefined();
  });

  it('projectile does not hit owner', () => {
    const ownerId = spatial.spawn('player', 5, 10, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      healthState: 'alive',
    });
    spatial.commit();

    // Spawn projectile from owner, on the same cell
    projectileSystem.spawnProjectile(
      makeContext(), 5, 10, 10, 10, 50, { speed: 1, ownerId }
    );

    gameLoop.tick();

    const ownerData = spatial.getEntityData(ownerId);
    expect(ownerData?.hp).toBe(100); // Not damaged
  });

  it('diagonal projectile moves at an angle', () => {
    // Spawn projectile diagonally
    const projectileId = projectileSystem.spawnProjectile(
      makeContext(), 5, 5, 15, 10, 10, { speed: 2 }
    );

    // Run a few ticks
    for (let i = 0; i < 5; i++) {
      gameLoop.tick();
    }

    const pos = gameLoop.freeBody.getPosition(projectileId);
    // Should have moved diagonally
    if (pos) {
      expect(pos.x).toBeGreaterThan(5);
      expect(pos.y).toBeGreaterThan(5);
    }
  });

  it('projectile is not on the grid (free body)', () => {
    const projectileId = projectileSystem.spawnProjectile(
      makeContext(), 5, 10, 15, 10, 10, { speed: 1 }
    );

    gameLoop.tick();

    // Projectile should NOT have a grid position
    const gridPos = spatial.getEntityPosition(projectileId);
    expect(gridPos).toBeNull();

    // But should have a float position in FreeBodyStore
    const freePos = gameLoop.freeBody.getPosition(projectileId);
    expect(freePos).not.toBeNull();
    expect(freePos!.x).toBeGreaterThan(5);
  });

  it('multiple projectiles can coexist at same position', () => {
    // Spawn two projectiles at the same position
    const id1 = projectileSystem.spawnProjectile(
      makeContext(), 5, 10, 15, 10, 10, { speed: 1 }
    );
    const id2 = projectileSystem.spawnProjectile(
      makeContext(), 5, 10, 15, 10, 10, { speed: 1 }
    );

    gameLoop.tick();

    // Both should exist and have positions
    const pos1 = gameLoop.freeBody.getPosition(id1);
    const pos2 = gameLoop.freeBody.getPosition(id2);
    expect(pos1).not.toBeNull();
    expect(pos2).not.toBeNull();
  });

  it('projectile stops at wall', () => {
    // Place wall at (10, 10)
    spatial.spawn('wall', 10, 10, GameLayers.WALLS, {});
    spatial.commit();
    spatial.syncMasks();

    const projectileId = projectileSystem.spawnProjectile(
      makeContext(), 5, 10, 15, 10, 10, { speed: 2 }
    );

    // Run several ticks -- should stop at wall
    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
    }

    // Projectile should have been removed (hit wall then impact deferred then removed)
    const data = store.getData(projectileId);
    expect(data).toBeUndefined();
  });

  it('float positions provide sub-cell precision', () => {
    // Spawn projectile at float (5.5, 10.5) targeting diagonal
    const projectileId = projectileSystem.spawnProjectile(
      makeContext(), 5.5, 10.5, 15.5, 13.5, 10, { speed: 1 }
    );

    gameLoop.tick();

    const pos = gameLoop.freeBody.getPosition(projectileId);
    expect(pos).not.toBeNull();
    // Position should be fractional (not integer-snapped)
    const hasFractional = pos!.x !== Math.round(pos!.x) || pos!.y !== Math.round(pos!.y);
    expect(hasFractional).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Spawn position tests (HARD RULE: 1 radius from cell center)
  //
  // Cell center in world-space = (cellX + 0.5, cellY + 0.5)
  // Spawn = center + 0.5 * direction_unit
  // -----------------------------------------------------------------------

  describe('spawn position (1 radius from cell center)', () => {
    const EPSILON = 1e-9;

    it('east: spawn at right edge of cell', () => {
      // Launcher at cell (5, 10), target east at (15, 10)
      const id = projectileSystem.spawnProjectile(
        makeContext(), 5, 10, 15, 10, 10, { speed: 1 }
      );
      const pos = gameLoop.freeBody.getPosition(id);
      expect(pos).not.toBeNull();
      // Center = (5.5, 10.5), direction = east, spawn = (6.0, 10.5)
      expect(pos!.x).toBeCloseTo(6.0, 5);
      expect(pos!.y).toBeCloseTo(10.5, 5);
    });

    it('west: spawn at left edge of cell', () => {
      const id = projectileSystem.spawnProjectile(
        makeContext(), 5, 10, 0, 10, 10, { speed: 1 }
      );
      const pos = gameLoop.freeBody.getPosition(id);
      expect(pos).not.toBeNull();
      // Center = (5.5, 10.5), direction = west, spawn = (5.0, 10.5)
      expect(pos!.x).toBeCloseTo(5.0, 5);
      expect(pos!.y).toBeCloseTo(10.5, 5);
    });

    it('south: spawn at bottom edge of cell', () => {
      const id = projectileSystem.spawnProjectile(
        makeContext(), 5, 10, 5, 19, 10, { speed: 1 }
      );
      const pos = gameLoop.freeBody.getPosition(id);
      expect(pos).not.toBeNull();
      // Center = (5.5, 10.5), direction = south, spawn = (5.5, 11.0)
      expect(pos!.x).toBeCloseTo(5.5, 5);
      expect(pos!.y).toBeCloseTo(11.0, 5);
    });

    it('north: spawn at top edge of cell', () => {
      const id = projectileSystem.spawnProjectile(
        makeContext(), 5, 10, 5, 0, 10, { speed: 1 }
      );
      const pos = gameLoop.freeBody.getPosition(id);
      expect(pos).not.toBeNull();
      // Center = (5.5, 10.5), direction = north, spawn = (5.5, 10.0)
      expect(pos!.x).toBeCloseTo(5.5, 5);
      expect(pos!.y).toBeCloseTo(10.0, 5);
    });

    it('northeast diagonal: spawn at ~0.5 from center', () => {
      const id = projectileSystem.spawnProjectile(
        makeContext(), 5, 10, 15, 0, 10, { speed: 1 }
      );
      const pos = gameLoop.freeBody.getPosition(id);
      expect(pos).not.toBeNull();
      // Center = (5.5, 10.5)
      // Dist from center to spawn should be exactly 0.5
      const dx = pos!.x - 5.5;
      const dy = pos!.y - 10.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeCloseTo(0.5, 5);
      // Direction should be toward (15, 0) = northeast
      expect(pos!.x).toBeGreaterThan(5.5);
      expect(pos!.y).toBeLessThan(10.5);
    });

    it('spawn distance is always exactly 0.5 from cell center', () => {
      // Test with multiple arbitrary angles
      const testCases = [
        { tx: 15, ty: 10 }, // east
        { tx: 0, ty: 10 },  // west
        { tx: 5, ty: 0 },   // north
        { tx: 5, ty: 19 },  // south
        { tx: 15, ty: 0 },  // NE
        { tx: 0, ty: 0 },   // NW
        { tx: 15, ty: 19 }, // SE
        { tx: 0, ty: 19 },  // SW
      ];

      for (const { tx, ty } of testCases) {
        const id = projectileSystem.spawnProjectile(
          makeContext(), 5, 10, tx, ty, 10, { speed: 1 }
        );
        const pos = gameLoop.freeBody.getPosition(id);
        expect(pos).not.toBeNull();
        const dx = pos!.x - 5.5; // center = (5.5, 10.5)
        const dy = pos!.y - 10.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeCloseTo(0.5, 5);
      }
    });

    it('projectile stays at spawn position on first tick (no immediate movement)', () => {
      const id = projectileSystem.spawnProjectile(
        makeContext(), 5, 10, 15, 10, 10, { speed: 2 }
      );
      const spawnPos = gameLoop.freeBody.getPosition(id);
      expect(spawnPos).not.toBeNull();
      const spawnX = spawnPos!.x;
      const spawnY = spawnPos!.y;

      // Tick 1: velocity initialized but movement skipped
      gameLoop.tick();

      const posAfterTick = gameLoop.freeBody.getPosition(id);
      expect(posAfterTick).not.toBeNull();
      expect(posAfterTick!.x).toBeCloseTo(spawnX, 5);
      expect(posAfterTick!.y).toBeCloseTo(spawnY, 5);
    });

    it('projectile begins moving on second tick', () => {
      const id = projectileSystem.spawnProjectile(
        makeContext(), 5, 10, 15, 10, 10, { speed: 2 }
      );
      const spawnPos = gameLoop.freeBody.getPosition(id);
      const spawnX = spawnPos!.x;

      gameLoop.tick(); // tick 1: init, skip movement
      gameLoop.tick(); // tick 2: actual movement

      const pos = gameLoop.freeBody.getPosition(id);
      expect(pos).not.toBeNull();
      // Speed 2 east: should have moved 2 cells from spawn
      expect(pos!.x).toBeCloseTo(spawnX + 2, 5);
    });

    it('user formula: cell (1,1) east → spawn at (2.0, 1.5)', () => {
      // Exact test case from the user's specification
      const id = projectileSystem.spawnProjectile(
        makeContext(), 1, 1, 10, 1, 10, { speed: 1 }
      );
      const pos = gameLoop.freeBody.getPosition(id);
      expect(pos).not.toBeNull();
      // cellX + cellW/2 + radius = 1.0 + 0.5 + 0.5 = 2.0
      // cellY + cellH/2 + 0 = 1.0 + 0.5 + 0 = 1.5
      expect(pos!.x).toBeCloseTo(2.0, 5);
      expect(pos!.y).toBeCloseTo(1.5, 5);
    });
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

    // First tick: turret fires, projectile spawns in FreeBodyStore
    gameLoop.tick();

    // Check that a projectile was spawned in the free body store
    expect(gameLoop.freeBody.size).toBeGreaterThan(0);
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
      (100 - (getHp(upData) ?? 100)) +
      (100 - (getHp(downData) ?? 100)) +
      (100 - (getHp(leftData) ?? 100)) +
      (100 - (getHp(rightData) ?? 100));

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

    const mockManager = {
      gameState: {
        playerEntityId: playerId,
        entityStore: store
      }
    } as unknown as GameManager;

    const testLoop = new GameLoop(spatial, mockManager);
    testLoop.addSystem(turretSystem);
    testLoop.addSystem(projectileSystem);
    testLoop.addSystem(healthSystem);

    testLoop.tick();

    const playerData = spatial.getEntityData(playerId);
    expect(playerData?.hp).toBe(100); // Not damaged
  });
});
