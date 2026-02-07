/**
 * Tests for NPCBrainSystem - autonomous NPC combat AI.
 *
 * Tests:
 * - NPC with brain + melee attacks adjacent player
 * - NPC with brain + ranged weapon fires projectile at player
 * - NPC switches to retreating posture when HP is low
 * - NPC reverts to idle when no threats in range
 * - NPC targets nearest opposing-team entity (team-aware)
 * - NPC with preferRanged uses ranged over melee
 * - Two NPCs on different teams fight each other
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialSystem } from '../core/spatial-system';
import { SparseEntityStore } from '../core/entity-store';
import { LinkedGrid } from '../core/grid/linked-grid';
import { GameLoop } from '../core/game-loop';
import { GameState } from '../core/game-state';
import { GameManager } from '../core/game-manager';
import { NPCBrainSystem } from '../systems/npc-brain.system';
import { MeleeSystem } from '../systems/melee.system';
import { HealthSystem } from '../systems/health.system';
import { ProjectileSystem } from '../systems/projectile.system';
import { GameLayers } from '../config/layers.config';
import { TestInputProvider } from './test-input-provider';

describe('NPCBrainSystem', () => {
  let spatial: SpatialSystem;
  let gameLoop: GameLoop;
  let gameManager: GameManager;
  let healthSystem: HealthSystem;
  let projectileSystem: ProjectileSystem;
  let meleeSystem: MeleeSystem;
  let brainSystem: NPCBrainSystem;

  beforeEach(() => {
    gameManager = new GameManager(new GameState());
    const scene = gameManager.sceneManager.createScene('test', 20, 20);
    gameManager.sceneManager.setActiveScene('test');
    spatial = scene.spatial;

    healthSystem = new HealthSystem();
    projectileSystem = new ProjectileSystem(healthSystem);
    brainSystem = new NPCBrainSystem(projectileSystem);

    const inputProvider = new TestInputProvider();
    meleeSystem = new MeleeSystem(gameManager, inputProvider, healthSystem);

    gameLoop = new GameLoop(spatial, gameManager);
    // Brain runs first, then melee processes directions, then health, then projectiles
    gameLoop.addSystem(brainSystem);
    gameLoop.addSystem(meleeSystem);
    gameLoop.addSystem(projectileSystem);
    gameLoop.addSystem(healthSystem);
  });

  it('NPC with brain + melee attacks adjacent player', () => {
    // Arrange: enemy NPC at (10,10), player at (11,10) -- adjacent
    const playerId = spatial.spawn('player', 11, 10, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, sceneId: 'test', team: 'player',
    });
    gameManager.gameState.playerEntityId = playerId;

    spatial.spawn('enemy', 10, 10, GameLayers.ACTORS, {
      hp: 50, maxHp: 50, healthState: 'alive', damage: 10,
      team: 'enemy',
      // Brain config
      threatRange: 8, attackRange: 1, posture: 'aggressive',
      // Melee config
      meleeDamage: 15, meleeCooldown: 3, meleeRange: 1,
      // Movement config
      movementMode: 'wander', speed: 2,
    });
    spatial.commit();

    // Act: tick so brain detects player and sets meleeDirection
    gameLoop.tick();

    // Assert: player should have taken melee damage (100 - 15 = 85)
    const playerData = spatial.getEntityData(playerId);
    expect(playerData?.hp).toBe(85);
  });

  it('NPC with brain + ranged weapon fires projectile at player', () => {
    // Arrange: enemy at (5,10), player at (10,10) -- 5 cells apart
    const playerId = spatial.spawn('player', 10, 10, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, sceneId: 'test', team: 'player',
    });
    gameManager.gameState.playerEntityId = playerId;

    spatial.spawn('enemy', 5, 10, GameLayers.ACTORS, {
      hp: 50, maxHp: 50, healthState: 'alive', damage: 10,
      team: 'enemy',
      // Brain config
      threatRange: 10, attackRange: 8, posture: 'aggressive', preferRanged: true,
      // Weapon config
      equippedWeapon: 'pistol', ammo: { pistol: 10 },
      // Movement config
      movementMode: 'wander', speed: 2,
    });
    spatial.commit();

    // Act: tick so brain spawns a projectile
    gameLoop.tick();

    // Assert: a projectile should exist in FreeBodyStore (free body, not on grid)
    let projectileFound = false;
    for (const [eid] of gameLoop.freeBody.entries()) {
      const data = spatial.getEntityData(eid);
      if (data?.type === 'projectile') {
        projectileFound = true;
        break;
      }
    }
    expect(projectileFound).toBe(true);
  });

  it('NPC switches to retreating when HP is low', () => {
    // Arrange: enemy at (10,10) with low HP, player at (12,10)
    const playerId = spatial.spawn('player', 12, 10, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, sceneId: 'test', team: 'player',
    });
    gameManager.gameState.playerEntityId = playerId;

    const enemyId = spatial.spawn('enemy', 10, 10, GameLayers.ACTORS, {
      hp: 10, maxHp: 100, healthState: 'alive', damage: 10,
      team: 'enemy',
      // Brain config: retreat at 25% HP (currently at 10% HP)
      threatRange: 8, attackRange: 1, posture: 'aggressive',
      retreatHealthPct: 0.25,
      // Movement config
      movementMode: 'wander', speed: 2,
    });
    spatial.commit();

    // Act
    gameLoop.tick();

    // Assert: brain should have set posture to retreating
    const enemyData = spatial.getEntityData(enemyId);
    expect(enemyData?.posture).toBe('retreating');
    expect(enemyData?.brainState).toBe('retreating');
  });

  it('NPC reverts to idle when no threats in range', () => {
    // Arrange: enemy at (10,10), player far away at (1,1)
    const playerId = spatial.spawn('player', 1, 1, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, sceneId: 'test', team: 'player',
    });
    gameManager.gameState.playerEntityId = playerId;

    const enemyId = spatial.spawn('enemy', 10, 10, GameLayers.ACTORS, {
      hp: 50, maxHp: 50, healthState: 'alive', damage: 10,
      team: 'enemy',
      // Brain config: small threat range
      threatRange: 5, attackRange: 1, posture: 'aggressive',
      // Movement config
      movementMode: 'wander', speed: 2,
    });
    spatial.commit();

    // Act
    gameLoop.tick();

    // Assert: no threat found, should be idle
    const enemyData = spatial.getEntityData(enemyId);
    expect(enemyData?.brainState).toBe('idle');
    expect(enemyData?.posture).toBe('idle');
  });

  it('NPC targets nearest opposing-team entity', () => {
    // Arrange: enemy at (10,10), two players at (12,10) and (15,10)
    const player1Id = spatial.spawn('player', 12, 10, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, sceneId: 'test', team: 'player',
    });
    gameManager.gameState.playerEntityId = player1Id;

    // A second player-team entity (ally)
    spatial.spawn('enemy', 15, 10, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, healthState: 'alive', damage: 10,
      team: 'player', // Same team as player
    });

    const enemyId = spatial.spawn('enemy', 10, 10, GameLayers.ACTORS, {
      hp: 50, maxHp: 50, healthState: 'alive', damage: 10,
      team: 'enemy',
      threatRange: 10, attackRange: 1, posture: 'aggressive',
      meleeDamage: 15, meleeCooldown: 3, meleeRange: 1,
      movementMode: 'wander', speed: 2,
    });
    spatial.commit();

    // Act
    gameLoop.tick();

    // Assert: NPC should target the nearest player-team entity (player1 at distance 2)
    const enemyData = spatial.getEntityData(enemyId);
    expect(enemyData?.currentTargetId).toBe(player1Id);
  });

  it('NPC with preferRanged uses ranged over melee when both available', () => {
    // Arrange: enemy at (10,10), player adjacent at (11,10)
    // Enemy has both melee and ranged, with preferRanged = true
    const playerId = spatial.spawn('player', 11, 10, GameLayers.ACTORS, {
      hp: 100, maxHp: 100, sceneId: 'test', team: 'player',
    });
    gameManager.gameState.playerEntityId = playerId;

    const enemyId = spatial.spawn('enemy', 10, 10, GameLayers.ACTORS, {
      hp: 50, maxHp: 50, healthState: 'alive', damage: 10,
      team: 'enemy',
      threatRange: 8, attackRange: 5, posture: 'aggressive',
      preferRanged: true,
      // Melee config
      meleeDamage: 20, meleeCooldown: 3, meleeRange: 1,
      // Weapon config
      equippedWeapon: 'pistol', ammo: { pistol: 10 },
      // Movement
      movementMode: 'wander', speed: 2,
    });
    spatial.commit();

    // Act: tick 1 spawns projectile (skips movement on spawn tick)
    gameLoop.tick();

    // Ammo should be consumed on tick 1 (NPC fired)
    const enemyData = spatial.getEntityData(enemyId);
    const ammo = enemyData?.ammo as Record<string, number> | undefined;
    expect(ammo?.pistol).toBe(9);

    // tick 2: projectile moves and hits player
    gameLoop.tick();

    // Assert: should spawn projectile instead of meleeing
    // Pistol does 15 damage, NOT melee (20).
    const playerData = spatial.getEntityData(playerId);
    expect(playerData?.hp).toBe(85); // Pistol hit (15 damage), not melee (20)
  });

  it('two NPCs on different teams fight each other', () => {
    // Arrange: no player, just two enemy NPCs on different teams adjacent
    const npc1Id = spatial.spawn('enemy', 10, 10, GameLayers.ACTORS, {
      hp: 50, maxHp: 50, healthState: 'alive', damage: 10,
      team: 'player', // Team A
      threatRange: 8, attackRange: 1, posture: 'aggressive',
      meleeDamage: 10, meleeCooldown: 3, meleeRange: 1,
      movementMode: 'wander', speed: 2,
    });

    const npc2Id = spatial.spawn('enemy', 11, 10, GameLayers.ACTORS, {
      hp: 50, maxHp: 50, healthState: 'alive', damage: 10,
      team: 'enemy', // Team B
      threatRange: 8, attackRange: 1, posture: 'aggressive',
      meleeDamage: 10, meleeCooldown: 3, meleeRange: 1,
      movementMode: 'wander', speed: 2,
    });
    spatial.commit();

    // Act: tick -- both should melee each other
    gameLoop.tick();

    // Assert: both should take damage
    const npc1Data = spatial.getEntityData(npc1Id);
    const npc2Data = spatial.getEntityData(npc2Id);
    expect(npc1Data?.hp).toBe(40); // 50 - 10
    expect(npc2Data?.hp).toBe(40); // 50 - 10
  });
});
