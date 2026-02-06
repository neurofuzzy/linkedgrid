/**
 * Tests for PlayerWeaponSystem.
 *
 * Tests ranged weapon mechanics:
 * - Player shooting on secondary input
 * - Ammo consumption
 * - Weapon cooldown
 * - Melee fallback when out of ammo
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getAmmo } from './test-helpers';
import { SpatialSystem } from '../core/spatial-system';
import { SparseEntityStore } from '../core/entity-store';
import { LinkedGrid } from '../core/grid/linked-grid';
import { GameLoop } from '../core/game-loop';
import { GameManager } from '../core/game-manager';
import { GameState } from '../core/game-state';
import { SceneManager } from '../core/scene-manager';
import { HealthSystem } from '../systems/health.system';
import { MeleeSystem } from '../systems/melee.system';
import { ProjectileSystem } from '../systems/projectile.system';
import { PlayerWeaponSystem } from '../systems/player-weapon.system';
import { GameLayers } from '../config/layers.config';
import { Direction } from '../core/grid/direction';
import { TestInputProvider } from './test-input-provider';

describe('PlayerWeaponSystem', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let healthSystem: HealthSystem;
  let meleeSystem: MeleeSystem;
  let projectileSystem: ProjectileSystem;
  let weaponSystem: PlayerWeaponSystem;
  let inputProvider: TestInputProvider;

  beforeEach(() => {
    grid = new LinkedGrid(20, 20);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    gameLoop = new GameLoop(spatial);

    const gameState = new GameState();
    const sceneManager = new SceneManager(gameState);
    gameManager = new GameManager(gameState, sceneManager);

    healthSystem = new HealthSystem({ dyingDuration: 2 });
    inputProvider = new TestInputProvider();
    meleeSystem = new MeleeSystem(gameManager, inputProvider, healthSystem);
    projectileSystem = new ProjectileSystem(healthSystem);
    weaponSystem = new PlayerWeaponSystem(
      gameManager,
      inputProvider,
      projectileSystem,
      meleeSystem
    );

    // Important: Add systems in correct order
    gameLoop.addSystem(healthSystem);
    gameLoop.addSystem(meleeSystem);
    gameLoop.addSystem(projectileSystem);
    gameLoop.addSystem(weaponSystem);
  });

  it('player can fire weapon on secondary input', () => {
    // Arrange: Player with weapon at (5,5)
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test',
      inventory: [],
      pushStrength: 1,
      equippedWeapon: 'pistol',
      ammo: { pistol: 10 },
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Set aiming direction
    inputProvider.setDirection(Direction.RIGHT);
    gameLoop.tick();

    // Fire weapon
    inputProvider.reset();
    inputProvider.setSecondary(true);
    gameLoop.tick();

    // Assert: A projectile was spawned on EPHEMERALS layer
    // Projectile should be at (6,5) - one cell to the right
    const allIds = spatial.getEntityIdsInCell(6, 5);
    const projectileIds = allIds.filter(id => {
      const pos = spatial.getEntityPosition(id);
      return pos && pos.layer === GameLayers.EPHEMERALS;
    });
    expect(projectileIds.length).toBeGreaterThanOrEqual(1);

    // Assert: Ammo was consumed
    const playerData = spatial.getEntityData(playerId);
    expect(getAmmo(playerData, 'pistol')).toBe(9);
  });

  it('weapon respects cooldown', () => {
    // Arrange: Player with weapon
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test',
      inventory: [],
      pushStrength: 1,
      equippedWeapon: 'pistol',
      ammo: { pistol: 10 },
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Set aiming direction
    inputProvider.setDirection(Direction.RIGHT);
    gameLoop.tick();

    // First shot
    inputProvider.reset();
    inputProvider.setSecondary(true);
    gameLoop.tick();

    let playerData = spatial.getEntityData(playerId);
    expect(getAmmo(playerData, 'pistol')).toBe(9); // First shot consumed ammo

    // Try to fire again immediately (should be on cooldown)
    gameLoop.tick();
    gameLoop.tick();

    playerData = spatial.getEntityData(playerId);
    expect(getAmmo(playerData, 'pistol')).toBe(9); // No additional ammo consumed during cooldown
  });

  it('cannot fire without ammo', () => {
    // Arrange: Player with no ammo
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test',
      inventory: [],
      pushStrength: 1,
      equippedWeapon: 'pistol',
      ammo: { pistol: 0 },
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Set aiming direction
    inputProvider.setDirection(Direction.RIGHT);
    gameLoop.tick();

    // Try to fire weapon
    inputProvider.reset();
    inputProvider.setSecondary(true);
    gameLoop.tick();

    // Assert: No projectile spawned
    const allIds = spatial.getEntityIdsInCell(6, 5);
    const projectileIds = allIds.filter(id => {
      const pos = spatial.getEntityPosition(id);
      return pos && pos.layer === GameLayers.EPHEMERALS;
    });
    expect(projectileIds.length).toBe(0);
  });

  it('unlimited ammo does not consume ammo', () => {
    // Arrange: Player with unlimited ammo
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test',
      inventory: [],
      pushStrength: 1,
      equippedWeapon: 'pistol',
      ammo: { pistol: 5 },
      unlimitedAmmo: true,
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Set aiming direction
    inputProvider.setDirection(Direction.RIGHT);
    gameLoop.tick();

    // Fire weapon
    inputProvider.reset();
    inputProvider.setSecondary(true);
    gameLoop.tick();

    // Assert: Ammo was NOT consumed
    const playerData = spatial.getEntityData(playerId);
    expect(getAmmo(playerData, 'pistol')).toBe(5);
  });

  it('falls back to melee when out of ammo', () => {
    // Arrange: Player with melee and no ammo, enemy nearby
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test',
      inventory: [],
      pushStrength: 1,
      equippedWeapon: 'pistol',
      ammo: { pistol: 0 },
      // Melee properties
      meleeDamage: 25,
      meleeCooldown: 3,
      meleeRange: 1,
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

    // Set aiming direction
    inputProvider.setDirection(Direction.RIGHT);
    gameLoop.tick();

    // Try to fire (should fall back to melee)
    inputProvider.reset();
    inputProvider.setSecondary(true);
    gameLoop.tick();

    // Run another tick for melee system to process
    gameLoop.tick();

    // Assert: Enemy took melee damage (fallback worked)
    const enemyData = spatial.getEntityData(enemyId);
    expect(enemyData?.hp).toBe(75); // 100 - 25 melee damage
  });

  it('can switch weapons', () => {
    // Arrange: Player with multiple weapons
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test',
      inventory: [],
      pushStrength: 1,
      equippedWeapon: 'pistol',
      ammo: { pistol: 10, shotgun: 5 },
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Switch to shotgun
    const result = weaponSystem.switchWeapon({ spatial } as any, playerId, 'shotgun');
    expect(result).toBe(true);

    const playerData = spatial.getEntityData(playerId);
    expect(playerData?.equippedWeapon).toBe('shotgun');
  });

  it('can add ammo', () => {
    // Arrange: Player with weapon
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test',
      inventory: [],
      pushStrength: 1,
      equippedWeapon: 'pistol',
      ammo: { pistol: 5 },
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Add ammo
    weaponSystem.addAmmo({ spatial } as any, playerId, 'pistol', 10);

    const playerData = spatial.getEntityData(playerId);
    expect(getAmmo(playerData, 'pistol')).toBe(15);
  });
});
