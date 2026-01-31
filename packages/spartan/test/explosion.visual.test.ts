import { visual } from './visual-helpers';
import { GameLayers } from "../config/layers.config";
import { ExplosionSystem } from '../systems/explosion.system';
import { GameLoop } from '../core/game-loop';
import { spawnPlayer } from '../entities/spawn-helpers';

/**
 * Visual tests for explosion system.
 *
 * These tests create observable scenarios for visual debugging and verification.
 */

visual('barrel explodes on death', {
  arrange: ({ spatial }) => {
    // Spawn barrel
    spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
      hp: 20,
      maxHp: 20,
      explosionDamage: 30,
      explosionRadius: 4,
      triggerCondition: 'on-death',
      flammability: 0.7,
      color: '#8B4513',
    });

    // Spawn targets in various positions
    spawnPlayer(spatial, 12, 10, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    spatial.spawn('enemy', 8, 10, GameLayers.ACTORS, {
      hp: 50,
      maxHp: 50,
      damage: 5,
      aiState: 'idle',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    // Create explosion system and game loop
    const explosionSystem = new ExplosionSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(explosionSystem);

    // Damage barrel to death
    const barrelId = spatial.getEntityIdAt(10, 10, GameLayers.COLLECTIBLES)!;
    const barrelData = spatial.getEntityData(barrelId)!;
    barrelData.hp = 0;

    // Run a tick to trigger explosion
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Player took explosion damage', () => {
      const playerId = spatial.getEntityIdAt(12, 10, GameLayers.ACTORS);
      if (!playerId) throw new Error('Player not found');

      const playerData = spatial.getEntityData(playerId);
      if (!playerData || !('hp' in playerData)) {
        throw new Error('Player has no HP');
      }

      if (playerData.hp >= 100) {
        throw new Error(`Player took no damage: ${playerData.hp}`);
      }
    });

    expect('Enemy took explosion damage', () => {
      const enemyId = spatial.getEntityIdAt(8, 10, GameLayers.ACTORS);
      if (!enemyId) throw new Error('Enemy not found');

      const enemyData = spatial.getEntityData(enemyId);
      if (!enemyData || !('hp' in enemyData)) {
        throw new Error('Enemy has no HP');
      }

      if (enemyData.hp >= 50) {
        throw new Error(`Enemy took no damage: ${enemyData.hp}`);
      }
    });

    expect('Explosion visual spawned', () => {
      const visualId = spatial.getEntityIdAt(10, 10, GameLayers.EPHEMERALS);
      if (!visualId) throw new Error('No explosion visual found');

      const visualData = spatial.getEntityData(visualId);
      if (visualData?.type !== 'explosion-visual') {
        throw new Error(`Wrong type: ${visualData?.type}`);
      }
    });
  },
});

visual('wall blocks explosion damage', {
  arrange: ({ spatial }) => {

    // Spawn barrel
    spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
      hp: 1,
      maxHp: 20,
      explosionDamage: 40,
      explosionRadius: 5,
      triggerCondition: 'on-death',
      color: '#8B4513',
    });

    // Spawn wall
    spatial.spawn('wall', 11, 10, GameLayers.WALLS, {
      color: '#808080',
    });

    // Spawn player behind wall
    spawnPlayer(spatial, 12, 10, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    // Spawn player in open area (should take damage)
    spawnPlayer(spatial, 10, 12, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const explosionSystem = new ExplosionSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(explosionSystem);

    // Trigger explosion
    const barrelId = spatial.getEntityIdAt(10, 10, GameLayers.COLLECTIBLES)!;
    const barrelData = spatial.getEntityData(barrelId)!;
    barrelData.hp = 0;

    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Player behind wall is protected', () => {
      const playerId = spatial.getEntityIdAt(12, 10, GameLayers.ACTORS);
      if (!playerId) throw new Error('Protected player not found');

      const playerData = spatial.getEntityData(playerId);
      if (!playerData || !('hp' in playerData)) {
        throw new Error('Player has no HP');
      }

      if (playerData.hp !== 100) {
        throw new Error(`Player should be protected, HP: ${playerData.hp}`);
      }
    });

    expect('Player in open takes damage', () => {
      const playerId = spatial.getEntityIdAt(10, 12, GameLayers.ACTORS);
      if (!playerId) throw new Error('Exposed player not found');

      const playerData = spatial.getEntityData(playerId);
      if (!playerData || !('hp' in playerData)) {
        throw new Error('Player has no HP');
      }

      if (playerData.hp >= 100) {
        throw new Error(`Player should take damage, HP: ${playerData.hp}`);
      }
    });
  },
});

visual('destructible wall takes damage from explosion', {
  arrange: ({ spatial }) => {

    // Spawn barrel
    spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
      hp: 1,
      maxHp: 20,
      explosionDamage: 35,
      explosionRadius: 4,
      triggerCondition: 'on-death',
      color: '#8B4513',
    });

    // Spawn destructible wall
    spatial.spawn('destructible-wall', 11, 10, GameLayers.WALLS, {
      hp: 50,
      maxHp: 50,
      hardness: 20,
      color: '#8b7355',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const explosionSystem = new ExplosionSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(explosionSystem);

    // Trigger explosion
    const barrelId = spatial.getEntityIdAt(10, 10, GameLayers.COLLECTIBLES)!;
    const barrelData = spatial.getEntityData(barrelId)!;
    barrelData.hp = 0;

    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Wall took damage', () => {
      const wallId = spatial.getEntityIdAt(11, 10, GameLayers.WALLS);
      if (!wallId) throw new Error('Wall not found');

      const wallData = spatial.getEntityData(wallId);
      if (!wallData || !('hp' in wallData)) {
        throw new Error('Wall has no HP');
      }

      if (wallData.hp >= 50) {
        throw new Error(`Wall took no damage: ${wallData.hp}`);
      }

      if (wallData.hp !== 15) {
        throw new Error(`Expected 15 HP (50-35), got ${wallData.hp}`);
      }
    });
  },
});

visual('hardness blocks weak explosions', {
  arrange: ({ spatial }) => {

    // Spawn weak barrel
    spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
      hp: 1,
      maxHp: 20,
      explosionDamage: 15, // Below hardness threshold
      explosionRadius: 4,
      triggerCondition: 'on-death',
      color: '#8B4513',
    });

    // Spawn hardened wall
    spatial.spawn('destructible-wall', 11, 10, GameLayers.WALLS, {
      hp: 50,
      maxHp: 50,
      hardness: 25, // Requires 25+ damage
      color: '#8b7355',
    });

    // Spawn normal player (no hardness) in open area
    spawnPlayer(spatial, 10, 12, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const explosionSystem = new ExplosionSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(explosionSystem);

    // Trigger explosion
    const barrelId = spatial.getEntityIdAt(10, 10, GameLayers.COLLECTIBLES)!;
    const barrelData = spatial.getEntityData(barrelId)!;
    barrelData.hp = 0;

    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Hardened wall blocked damage', () => {
      const wallId = spatial.getEntityIdAt(11, 10, GameLayers.WALLS);
      if (!wallId) throw new Error('Wall not found');

      const wallData = spatial.getEntityData(wallId);
      if (!wallData || !('hp' in wallData)) {
        throw new Error('Wall has no HP');
      }

      if (wallData.hp !== 50) {
        throw new Error(`Wall should be undamaged, HP: ${wallData.hp}`);
      }
    });

    expect('Player took damage (no hardness)', () => {
      const playerId = spatial.getEntityIdAt(10, 12, GameLayers.ACTORS);
      if (!playerId) throw new Error('Player not found');

      const playerData = spatial.getEntityData(playerId);
      if (!playerData || !('hp' in playerData)) {
        throw new Error('Player has no HP');
      }

      if (playerData.hp >= 100) {
        throw new Error(`Player should take damage, HP: ${playerData.hp}`);
      }
    });
  },
});

visual('explosion ignites flammable entities', {
  arrange: ({ spatial }) => {

    // Spawn barrel
    spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
      hp: 1,
      maxHp: 20,
      explosionDamage: 20,
      explosionRadius: 4,
      triggerCondition: 'on-death',
      color: '#8B4513',
    });

    // Spawn flammable entities
    spatial.spawn('grass', 11, 10, GameLayers.FLOOR, {
      temperature: 0,
      flammable: true,
      flamePoint: 150,
      hp: 20,
      maxHp: 20,
      color: '#7cba00',
    });

    spatial.spawn('grass', 12, 10, GameLayers.FLOOR, {
      temperature: 0,
      flammable: true,
      flamePoint: 150,
      hp: 20,
      maxHp: 20,
      color: '#7cba00',
    });

    spatial.spawn('gasoline', 10, 11, GameLayers.COLLECTIBLES, {
      temperature: 0,
      flammable: true,
      flamePoint: 100,
      hp: 10,
      maxHp: 10,
      color: '#d4af37',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const explosionSystem = new ExplosionSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(explosionSystem);

    // Trigger explosion
    const barrelId = spatial.getEntityIdAt(10, 10, GameLayers.COLLECTIBLES)!;
    const barrelData = spatial.getEntityData(barrelId)!;
    barrelData.hp = 0;

    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Grass at (11, 10) is ignited (temperature raised)', () => {
      const grassId = spatial.getEntityIdAt(11, 10, GameLayers.FLOOR);
      if (!grassId) throw new Error('No grass found');

      const grassData = spatial.getEntityData(grassId);
      if (!grassData) throw new Error('No grass data');
      if (grassData.temperature < grassData.flamePoint) {
        throw new Error(`Temperature ${grassData.temperature} below flame point ${grassData.flamePoint}`);
      }
    });

    expect('Grass at (12, 10) is ignited (temperature raised)', () => {
      const grassId = spatial.getEntityIdAt(12, 10, GameLayers.FLOOR);
      if (!grassId) throw new Error('No grass found');

      const grassData = spatial.getEntityData(grassId);
      if (!grassData) throw new Error('No grass data');
      if (grassData.temperature < grassData.flamePoint) {
        throw new Error(`Temperature ${grassData.temperature} below flame point ${grassData.flamePoint}`);
      }
    });

    expect('Gasoline at (10, 11) is ignited (temperature raised)', () => {
      const gasolineId = spatial.getEntityIdAt(10, 11, GameLayers.COLLECTIBLES);
      if (!gasolineId) throw new Error('No gasoline found');

      const gasolineData = spatial.getEntityData(gasolineId);
      if (!gasolineData) throw new Error('No gasoline data');
      if (gasolineData.temperature < gasolineData.flamePoint) {
        throw new Error(`Temperature ${gasolineData.temperature} below flame point ${gasolineData.flamePoint}`);
      }
    });
  },
});

visual('chain reaction - barrel destroys adjacent barrel', {
  arrange: ({ spatial }) => {

    // Spawn first barrel
    spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
      hp: 1,
      maxHp: 20,
      explosionDamage: 30,
      explosionRadius: 3,
      triggerCondition: 'on-death',
      color: '#8B4513',
    });

    // Spawn second barrel nearby
    spatial.spawn('barrel', 12, 10, GameLayers.COLLECTIBLES, {
      hp: 25,
      maxHp: 25,
      explosionDamage: 30,
      explosionRadius: 3,
      triggerCondition: 'on-death',
      color: '#8B4513',
    });

    // Spawn distant target (only in range of second explosion)
    spawnPlayer(spatial, 14, 10, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const explosionSystem = new ExplosionSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(explosionSystem);

    // Trigger first explosion
    const barrel1Id = spatial.getEntityIdAt(10, 10, GameLayers.COLLECTIBLES)!;
    const barrel1Data = spatial.getEntityData(barrel1Id)!;
    barrel1Data.hp = 0;

    // Run multiple ticks to allow chain reaction
    gameLoop.tick();
    gameLoop.tick();
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Second barrel destroyed or heavily damaged', () => {
      const barrel2Id = spatial.getEntityIdAt(12, 10, GameLayers.COLLECTIBLES);
      
      if (barrel2Id === undefined) {
        // Barrel completely destroyed - chain reaction worked
        return;
      }

      const barrel2Data = spatial.getEntityData(barrel2Id);
      if (!barrel2Data || !('hp' in barrel2Data)) {
        throw new Error('Barrel has no HP');
      }

      if (barrel2Data.hp > 0) {
        throw new Error(`Second barrel should be destroyed or damaged, HP: ${barrel2Data.hp}`);
      }
    });

    expect('Distant player affected by chain', () => {
      const playerId = spatial.getEntityIdAt(14, 10, GameLayers.ACTORS);
      if (!playerId) throw new Error('Player not found');

      const playerData = spatial.getEntityData(playerId);
      if (!playerData || !('hp' in playerData)) {
        throw new Error('Player has no HP');
      }

      // Player should be damaged by second barrel's explosion
      if (playerData.hp >= 100) {
        throw new Error(`Player should be damaged by chain reaction, HP: ${playerData.hp}`);
      }
    });
  },
});

visual('on-fire trigger - barrel explodes when ignited', {
  arrange: ({ spatial }) => {

    // Spawn barrel with on-fire trigger
    spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
      hp: 30,
      maxHp: 30,
      explosionDamage: 35,
      explosionRadius: 4,
      triggerCondition: 'on-fire',
      temperature: 0,
      flammable: true,
      flamePoint: 200,
      color: '#8B4513',
    });

    // Spawn target
    spawnPlayer(spatial, 12, 10, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const explosionSystem = new ExplosionSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(explosionSystem);

    // Raise barrel temperature to trigger on-fire explosion
    const barrelId = spatial.getEntityIdAt(10, 10, GameLayers.COLLECTIBLES);
    if (barrelId) {
      const barrelData = spatial.getEntityData(barrelId);
      if (barrelData) {
        barrelData.temperature = barrelData.flamePoint + 50; // Ignite the barrel
      }
    }

    spatial.commit();

    // Run tick to trigger explosion
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Player damaged by fire-triggered explosion', () => {
      const playerId = spatial.getEntityIdAt(12, 10, GameLayers.ACTORS);
      if (!playerId) throw new Error('Player not found');

      const playerData = spatial.getEntityData(playerId);
      if (!playerData || !('hp' in playerData)) {
        throw new Error('Player has no HP');
      }

      if (playerData.hp >= 100) {
        throw new Error(`Player should take explosion damage, HP: ${playerData.hp}`);
      }
    });

    expect('Explosion visual spawned', () => {
      const visualId = spatial.getEntityIdAt(10, 10, GameLayers.EPHEMERALS);
      if (!visualId) throw new Error('No explosion visual found');

      const visualData = spatial.getEntityData(visualId);
      if (visualData?.type !== 'explosion-visual') {
        throw new Error(`Wrong type: ${visualData?.type}`);
      }
    });
  },
});

visual('multiple barrels in line create cascading explosions', {
  arrange: ({ spatial }) => {

    // Spawn line of barrels
    for (let i = 0; i < 5; i++) {
      spatial.spawn('barrel', 10 + i * 2, 10, GameLayers.COLLECTIBLES, {
        hp: 25,
        maxHp: 25,
        explosionDamage: 30,
        explosionRadius: 3,
        triggerCondition: 'on-death',
        color: '#8B4513',
      });
    }

    // Spawn target at far end
    spawnPlayer(spatial, 19, 10, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const explosionSystem = new ExplosionSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(explosionSystem);

    // Trigger first barrel
    const firstBarrelId = spatial.getEntityIdAt(10, 10, GameLayers.COLLECTIBLES)!;
    const firstBarrelData = spatial.getEntityData(firstBarrelId)!;
    firstBarrelData.hp = 0;

    // Run many ticks to allow full cascade
    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Chain reaction destroyed multiple barrels', () => {
      let destroyedCount = 0;
      
      for (let i = 0; i < 5; i++) {
        const barrelId = spatial.getEntityIdAt(10 + i * 2, 10, GameLayers.COLLECTIBLES);
        if (barrelId === undefined) {
          destroyedCount++;
        } else {
          const barrelData = spatial.getEntityData(barrelId);
          if (barrelData && 'hp' in barrelData && barrelData.hp <= 0) {
            destroyedCount++;
          }
        }
      }

      if (destroyedCount < 2) {
        throw new Error(`Expected multiple barrels destroyed, got ${destroyedCount}`);
      }
    });

    expect('Distant player affected', () => {
      const playerId = spatial.getEntityIdAt(19, 10, GameLayers.ACTORS);
      if (!playerId) throw new Error('Player not found');

      const playerData = spatial.getEntityData(playerId);
      if (!playerData || !('hp' in playerData)) {
        throw new Error('Player has no HP');
      }

      // Player likely damaged by cascade
      if (playerData.hp >= 100) {
        throw new Error(`Expected cascade to reach player, HP: ${playerData.hp}`);
      }
    });
  },
});
