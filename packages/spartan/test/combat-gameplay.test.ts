/**
 * Combat Gameplay Integration Tests
 *
 * Tests end-to-end combat functionality including:
 * - Melee attacks in separated mode
 * - Weapon firing in separated mode
 * - Shotgun cone attacks
 * - Weapon pickup and switching
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getAmmo } from './test-helpers';
import type { PlayerData, ProjectileData } from '../entities/entity.types';
import { SpatialSystem } from '../core/spatial-system';
import { SparseEntityStore } from '../core/entity-store';
import { LinkedGrid } from '../core/grid/linked-grid';
import { GameLoop } from '../core/game-loop';
import { GameManager } from '../core/game-manager';
import { GameState } from '../core/game-state';
import { SceneManager } from '../core/scene-manager';
import { HealthSystem } from '../systems/health.system';
import { MeleeSystem } from '../systems/melee.system';
import { PlayerWeaponSystem } from '../systems/player-weapon.system';
import { ProjectileSystem } from '../systems/projectile.system';
import { PowerupSystem } from '../systems/powerup.system';
import { GameLayers } from '../config/layers.config';
import { Direction } from '../core/grid/direction';
import { TestInputProvider } from './test-input-provider';

describe('Combat Gameplay - Separated Mode', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let healthSystem: HealthSystem;
  let meleeSystem: MeleeSystem;
  let projectileSystem: ProjectileSystem;
  let playerWeaponSystem: PlayerWeaponSystem;
  let powerupSystem: PowerupSystem;
  let inputProvider: TestInputProvider;

  beforeEach(() => {
    // Grid needs to be large enough for pistol range (15) + player position
    grid = new LinkedGrid(25, 25);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    gameLoop = new GameLoop(spatial);

    const gameState = new GameState();
    const sceneManager = new SceneManager(gameState);
    gameManager = new GameManager(gameState, sceneManager);

    healthSystem = new HealthSystem({ dyingDuration: 2 });
    inputProvider = new TestInputProvider();
    inputProvider.setPreset('separated'); // Use separated mode

    meleeSystem = new MeleeSystem(gameManager, inputProvider, healthSystem);
    projectileSystem = new ProjectileSystem(healthSystem);
    playerWeaponSystem = new PlayerWeaponSystem(
      gameManager,
      inputProvider,
      projectileSystem,
      meleeSystem,
      undefined,
      healthSystem
    );
    powerupSystem = new PowerupSystem({ healthSystem });

    gameLoop.addSystem(healthSystem);
    gameLoop.addSystem(meleeSystem);
    gameLoop.addSystem(projectileSystem);
    gameLoop.addSystem(playerWeaponSystem);
    gameLoop.addSystem(powerupSystem);
  });

  describe('Melee Combat', () => {
    it('player can melee attack using WASD aim direction + Space', () => {
      // Arrange: Player at (5,5), enemy at (6,5) - to the right
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

      // Act: Set WASD aim direction (D = right), then press Space
      inputProvider.setAimDirection(Direction.RIGHT);
      gameLoop.tick(); // Update facing direction

      inputProvider.setPrimaryAction(true);
      gameLoop.tick(); // Attack

      // Assert: Enemy took damage
      const enemyData = spatial.getEntityData(enemyId);
      expect(enemyData?.hp).toBe(75); // 100 - 25
    });

    it('melee attack uses last aim direction if WASD released', () => {
      // Arrange
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

      // Act: Set aim direction, tick, then release aim and attack
      inputProvider.setAimDirection(Direction.RIGHT);
      gameLoop.tick(); // Records facing direction

      inputProvider.setAimDirection(Direction.NONE); // Release WASD
      inputProvider.setPrimaryAction(true);
      gameLoop.tick(); // Attack should use last direction

      // Assert: Enemy took damage (attack used remembered direction)
      const enemyData = spatial.getEntityData(enemyId);
      expect(enemyData?.hp).toBe(75);
    });

    it('cannot melee without setting aim direction first', () => {
      // Arrange
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

      // Act: Press space without ever setting aim direction
      inputProvider.setPrimaryAction(true);
      gameLoop.tick();

      // Assert: Enemy didn't take damage (no aim direction)
      const enemyData = spatial.getEntityData(enemyId);
      expect(enemyData?.hp).toBe(100);
    });
  });

  describe('Weapon Combat', () => {
    it('projectile directly spawned damages enemy on collision', () => {
      // Simpler test: directly spawn a projectile and verify it damages enemy
      const enemyId = spatial.spawn('enemy', 8, 5, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
        healthState: 'alive',
        damage: 5,
        aiState: 'idle',
        team: 'enemy',
      });

      spatial.commit();

      // Spawn projectile via ProjectileSystem (free body, not grid)
      const ctx = {
        tick: 0,
        overlaps: [] as never[],
        spatial: spatial as unknown as import('../core/types').GameContext['spatial'],
        freeBody: gameLoop.freeBody,
      };
      projectileSystem.spawnProjectile(ctx, 6, 5, 10, 5, 15, {
        speed: 2,
        ownerId: 0,
      });

      // Tick: Projectile should move and hit enemy at (8,5)
      // With speed 2, projectile moves 2 cells per tick.
      // Tick 1: moves from (6,5) toward (8,5)
      // Tick 2: reaches/passes (8,5), hits enemy
      gameLoop.tick();
      gameLoop.tick();

      // Enemy should have taken damage
      const enemyData = spatial.getEntityData(enemyId);
      expect(enemyData?.hp).toBe(85); // 100 - 15
    });

    it('player can fire weapon using WASD aim direction + Shift', () => {
      // Arrange: Player at (5,5) with pistol, enemy at (8,5) - closer for quicker testing
      const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
        damage: 10,
        meleeDamage: 25,
        meleeCooldown: 3,
        meleeRange: 1,
        equippedWeapon: 'pistol',
        ammo: { pistol: 20 },
        sceneId: 'test',
        inventory: [],
        pushStrength: 1,
        team: 'player',
      });

      const enemyId = spatial.spawn('enemy', 8, 5, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
        healthState: 'alive',
        damage: 5,
        aiState: 'idle',
        team: 'enemy',
      });

      spatial.commit();
      gameManager.gameState.playerEntityId = playerId;

      // Act: Set aim direction and press secondary (Shift)
      inputProvider.setAimDirection(Direction.RIGHT);
      inputProvider.setSecondaryAction(true);
      gameLoop.tick(); // Fire weapon (tick 1) - projectile spawns at (6,5)

      // Assert: A shot was fired
      expect(playerWeaponSystem.getDebugState().shotsFiredThisTick).toBe(1);

      // Stop firing
      inputProvider.setSecondaryAction(false);

      // Find the projectile in FreeBodyStore
      let projectileId: number | undefined;
      for (const [entId] of gameLoop.freeBody.entries()) {
        const data = spatial.getEntityData(entId);
        if (data?.type === 'projectile') {
          projectileId = entId;
          break;
        }
      }
      expect(projectileId).toBeDefined();

      // Check projectile data after fire tick
      const projData = spatial.getEntityData(projectileId!);
      expect((projData as ProjectileData)?.damage).toBe(15); // Pistol damage

      // Projectile is a free body - check FreeBodyStore position
      const freePos = gameLoop.freeBody.getPosition(projectileId!);
      expect(freePos).not.toBeNull();

      // Tick to move projectile toward enemy at (8,5)
      gameLoop.tick(); // Move toward 8,5
      gameLoop.tick(); // Should hit enemy

      // Check enemy health - should have taken 15 damage
      const enemyDataAfter = spatial.getEntityData(enemyId);
      expect(enemyDataAfter?.hp).toBe(85); // 100 - 15
    });

    it('weapon consumes ammo on fire', () => {
      const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
        damage: 10,
        meleeDamage: 25,
        meleeCooldown: 3,
        meleeRange: 1,
        equippedWeapon: 'pistol',
        ammo: { pistol: 20 },
        sceneId: 'test',
        inventory: [],
        pushStrength: 1,
        team: 'player',
      });

      spatial.commit();
      gameManager.gameState.playerEntityId = playerId;

      // Fire weapon
      inputProvider.setAimDirection(Direction.RIGHT);
      inputProvider.setSecondaryAction(true);
      gameLoop.tick();

      // Check ammo decreased
      const playerData = spatial.getEntityData(playerId);
      expect(getAmmo(playerData, 'pistol')).toBe(19);
    });

    it('falls back to melee when out of ammo', () => {
      // Arrange: Player with 0 ammo, enemy adjacent
      const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
        damage: 10,
        meleeDamage: 25,
        meleeCooldown: 3,
        meleeRange: 1,
        equippedWeapon: 'pistol',
        ammo: { pistol: 0 },
        sceneId: 'test',
        inventory: [],
        pushStrength: 1,
        team: 'player',
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

      // Try to fire (should fall back to melee)
      inputProvider.setAimDirection(Direction.RIGHT);
      inputProvider.setSecondaryAction(true);
      gameLoop.tick();

      // Melee attack should have happened
      gameLoop.tick(); // Process melee

      const enemyData = spatial.getEntityData(enemyId);
      expect(enemyData?.hp).toBe(75); // 100 - 25 melee damage
    });
  });

  describe('Shotgun Cone Attack', () => {
    it('shotgun damages multiple enemies in cone', () => {
      // Arrange: Player with shotgun, multiple enemies in cone area
      const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
        damage: 10,
        meleeDamage: 25,
        meleeCooldown: 3,
        meleeRange: 1,
        equippedWeapon: 'shotgun',
        ammo: { shotgun: 10 },
        sceneId: 'test',
        inventory: [],
        pushStrength: 1,
        team: 'player',
      });

      // Enemies in cone to the right (shotgun range 4, spread PI/4)
      const enemy1Id = spatial.spawn('enemy', 7, 5, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
        healthState: 'alive',
        damage: 5,
        aiState: 'idle',
        team: 'enemy',
      });

      const enemy2Id = spatial.spawn('enemy', 8, 4, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
        healthState: 'alive',
        damage: 5,
        aiState: 'idle',
        team: 'enemy',
      });

      const enemy3Id = spatial.spawn('enemy', 8, 6, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
        healthState: 'alive',
        damage: 5,
        aiState: 'idle',
        team: 'enemy',
      });

      spatial.commit();
      gameManager.gameState.playerEntityId = playerId;

      // Fire shotgun to the right
      inputProvider.setAimDirection(Direction.RIGHT);
      inputProvider.setSecondaryAction(true);
      gameLoop.tick();

      // Assert: All enemies in cone took damage (shotgun does 30 damage)
      const enemy1Data = spatial.getEntityData(enemy1Id);
      const enemy2Data = spatial.getEntityData(enemy2Id);
      const enemy3Data = spatial.getEntityData(enemy3Id);

      expect(enemy1Data?.hp).toBe(70); // 100 - 30
      expect(enemy2Data?.hp).toBe(70);
      expect(enemy3Data?.hp).toBe(70);
    });

    it('shotgun does not spawn projectiles', () => {
      const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
        damage: 10,
        equippedWeapon: 'shotgun',
        ammo: { shotgun: 10 },
        sceneId: 'test',
        inventory: [],
        pushStrength: 1,
        team: 'player',
      });

      spatial.commit();
      gameManager.gameState.playerEntityId = playerId;

      inputProvider.setAimDirection(Direction.RIGHT);
      inputProvider.setSecondaryAction(true);
      gameLoop.tick();

      // Shotgun uses cone attack, not projectiles
      // Check that a cone attack was fired, not a projectile shot
      expect(playerWeaponSystem.getDebugState().coneAttacksThisTick).toBe(1);
      expect(playerWeaponSystem.getDebugState().shotsFiredThisTick).toBe(0);
    });
  });

  describe('Weapon Pickup', () => {
    it('player can pick up weapon and switch equipped weapon', () => {
      // Arrange: Player without weapon, weapon pickup nearby
      const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
        hp: 100,
        maxHp: 100,
        damage: 10,
        sceneId: 'test',
        inventory: [],
        pushStrength: 1,
        team: 'player',
      });

      // Weapon pickup on same tile (will be collected on spawn)
      const pickupId = spatial.spawn('weapon-pickup', 5, 5, GameLayers.COLLECTIBLES, {
        weaponType: 'machine-gun',
        ammoAmount: 50,
        collectibleType: 'powerup',
        collectibleId: 'test-weapon',
        color: '#ff6600',
      });

      spatial.commit();
      gameManager.gameState.playerEntityId = playerId;

      // Tick to process powerup collection
      gameLoop.tick();

      // Assert: Player now has the weapon
      const playerData = spatial.getEntityData(playerId) as PlayerData;
      expect(playerData.equippedWeapon).toBe('machine-gun');
      expect(playerData.ammo['machine-gun']).toBe(50);

      // Pickup should be removed
      expect(spatial.getEntityData(pickupId)).toBeUndefined();
    });
  });
});

describe('Combat Gameplay - Classic Mode', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let healthSystem: HealthSystem;
  let meleeSystem: MeleeSystem;
  let inputProvider: TestInputProvider;

  beforeEach(() => {
    grid = new LinkedGrid(15, 15);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    gameLoop = new GameLoop(spatial);

    const gameState = new GameState();
    const sceneManager = new SceneManager(gameState);
    gameManager = new GameManager(gameState, sceneManager);

    healthSystem = new HealthSystem({ dyingDuration: 2 });
    inputProvider = new TestInputProvider();
    inputProvider.setPreset('classic'); // Use classic mode (default)

    meleeSystem = new MeleeSystem(gameManager, inputProvider, healthSystem);

    gameLoop.addSystem(healthSystem);
    gameLoop.addSystem(meleeSystem);
  });

  it('movement direction sets aim direction in classic mode', () => {
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

    // In classic mode, setDirection sets both move and aim
    inputProvider.setDirection(Direction.RIGHT);
    gameLoop.tick();

    inputProvider.reset();
    inputProvider.setPrimaryAction(true);
    gameLoop.tick();

    const enemyData = spatial.getEntityData(enemyId);
    expect(enemyData?.hp).toBe(75);
  });
});

describe('Combat Gameplay - Twin-Stick Mode', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let healthSystem: HealthSystem;
  let projectileSystem: ProjectileSystem;
  let playerWeaponSystem: PlayerWeaponSystem;
  let meleeSystem: MeleeSystem;
  let inputProvider: TestInputProvider;

  beforeEach(() => {
    grid = new LinkedGrid(15, 15);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
    gameLoop = new GameLoop(spatial);

    const gameState = new GameState();
    const sceneManager = new SceneManager(gameState);
    gameManager = new GameManager(gameState, sceneManager);

    healthSystem = new HealthSystem({ dyingDuration: 2 });
    inputProvider = new TestInputProvider();
    inputProvider.setPreset('twin-stick');

    meleeSystem = new MeleeSystem(gameManager, inputProvider, healthSystem);
    projectileSystem = new ProjectileSystem(healthSystem);
    playerWeaponSystem = new PlayerWeaponSystem(
      gameManager,
      inputProvider,
      projectileSystem,
      meleeSystem,
      undefined,
      healthSystem
    );

    gameLoop.addSystem(healthSystem);
    gameLoop.addSystem(meleeSystem);
    gameLoop.addSystem(projectileSystem);
    gameLoop.addSystem(playerWeaponSystem);
  });

  it('auto-fires weapon when aiming in twin-stick mode', () => {
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      equippedWeapon: 'pistol',
      ammo: { pistol: 20 },
      sceneId: 'test',
      inventory: [],
      pushStrength: 1,
      team: 'player',
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // In twin-stick mode, just setting aim direction triggers fire
    inputProvider.setAimDirection(Direction.RIGHT);
    // No need to press secondary action - auto-fire

    gameLoop.tick();

    // A shot should be fired
    expect(playerWeaponSystem.getDebugState().shotsFiredThisTick).toBe(1);
  });

  it('can move and aim independently in twin-stick mode', () => {
    const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      equippedWeapon: 'pistol',
      ammo: { pistol: 20 },
      sceneId: 'test',
      inventory: [],
      pushStrength: 1,
      team: 'player',
    });

    spatial.commit();
    gameManager.gameState.playerEntityId = playerId;

    // Move left while aiming right
    inputProvider.setMoveDirection(Direction.LEFT);
    inputProvider.setAimDirection(Direction.RIGHT);

    expect(inputProvider.getMoveDirection()).toBe(Direction.LEFT);
    expect(inputProvider.getAimDirection()).toBe(Direction.RIGHT);
  });
});
