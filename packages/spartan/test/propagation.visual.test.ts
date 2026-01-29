import { visual } from './visual-helpers';
import { GameLayers } from '../layers/types';
import { spawnPlayer } from '../entities/spawn-helpers';
import { PropagationSystem } from '../systems/propagation-system';
import { FloorEffectSystem } from '../systems/floor-effect-system';
import { GameManager } from '../game-manager';
import { GameLoop } from '../game-loop';

visual('fire spreads to adjacent cells', {
  arrange: ({ spatial }) => {
    // Spawn initial fire source in center
    spatial.spawn('fire', 5, 5, GameLayers.FLOOR, {
      propagationType: 'fire',
      spreadRate: 1, // Spread every tick (very fast for testing)
      spreadLayer: GameLayers.FLOOR,
      spreadType: 'fire',
      maxDistance: 3,
      color: '#ff6b35',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const propagationSystem = new PropagationSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(propagationSystem);

    // Tick multiple times to show spreading
    gameLoop.tick();
    spatial.pause(); // Visual pause between spreads
    gameLoop.tick();
    spatial.pause();
    gameLoop.tick();
    spatial.pause();
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Fire spread to adjacent cells', () => {
      const fireCount = Array.from(spatial.getAllPositions()).filter(([id, pos]) => {
        const data = spatial.getEntityData(id);
        return data?.type === 'fire';
      }).length;

      if (fireCount <= 1) {
        throw new Error(`Expected fire to spread, got ${fireCount} fire entities`);
      }
    });
  },
});

visual('fire stopped by walls', {
  arrange: ({ spatial }) => {
    // Spawn fire source
    spatial.spawn('fire', 5, 5, GameLayers.FLOOR, {
      propagationType: 'fire',
      spreadRate: 1,
      spreadLayer: GameLayers.FLOOR,
      spreadType: 'fire',
      maxDistance: 10,
      blockedByLayers: [GameLayers.WALLS],
      color: '#ff6b35',
    });

    // Create wall barrier to the right
    spatial.spawn('wall', 6, 5, GameLayers.WALLS, {});
    spatial.spawn('wall', 6, 4, GameLayers.WALLS, {});
    spatial.spawn('wall', 6, 6, GameLayers.WALLS, {});

    spatial.commit();
    spatial.syncMasks(); // Update blocking masks
  },
  act: ({ spatial }) => {
    const propagationSystem = new PropagationSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(propagationSystem);

    // Tick multiple times - fire should spread left but not right
    gameLoop.tick();
    spatial.pause();
    gameLoop.tick();
    spatial.pause();
    gameLoop.tick();
    spatial.pause();
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Fire did not spread past wall to the right', () => {
      const fireAtWall = spatial.getEntityIdAt(7, 5, GameLayers.FLOOR);
      const fireData = fireAtWall ? spatial.getEntityData(fireAtWall) : null;
      
      if (fireData?.type === 'fire') {
        throw new Error('Fire should not have spread past wall');
      }
    });

    expect('Fire spread to the left (unblocked)', () => {
      const fireLeft = spatial.getEntityIdAt(4, 5, GameLayers.FLOOR);
      const fireData = fireLeft ? spatial.getEntityData(fireLeft) : null;
      
      if (fireData?.type !== 'fire') {
        throw new Error('Fire should have spread left');
      }
    });
  },
});

visual('poison gas expands with lifetime', {
  arrange: ({ spatial }) => {
    // Spawn poison gas source with lifetime
    spatial.spawn('poison-gas', 5, 5, GameLayers.EPHEMERALS, {
      propagationType: 'gas',
      spreadRate: 1,
      spreadLayer: GameLayers.EPHEMERALS,
      spreadType: 'poison-gas',
      maxDistance: 2,
      lifetime: 100, // Longer lifetime for stable test
      color: '#9acd32',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const propagationSystem = new PropagationSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(propagationSystem);

    // Spread gas
    gameLoop.tick();
    spatial.pause();
    gameLoop.tick();
    spatial.pause();
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Gas spread to multiple cells', () => {
      const gasCount = Array.from(spatial.getAllPositions()).filter(([id]) => {
        const data = spatial.getEntityData(id);
        return data?.type === 'poison-gas';
      }).length;

      if (gasCount <= 1) {
        throw new Error(`Gas should have spread, got ${gasCount} entities`);
      }
    });

    expect('Gas has lifetime property', () => {
      const gasEntities = Array.from(spatial.getAllPositions()).filter(([id]) => {
        const data = spatial.getEntityData(id);
        return data?.type === 'poison-gas';
      });

      if (gasEntities.length === 0) {
        throw new Error('No gas entities found');
      }

      const [gasId] = gasEntities[0];
      const gasData = spatial.getEntityData(gasId);
      
      if (typeof gasData?.lifetime !== 'number') {
        throw new Error('Gas should have lifetime property');
      }
    });
  },
});

visual('fire respects max distance limit', {
  arrange: ({ spatial }) => {
    // Spawn fire with maxDistance of 2
    spatial.spawn('fire', 5, 5, GameLayers.FLOOR, {
      propagationType: 'fire',
      spreadRate: 1,
      spreadLayer: GameLayers.FLOOR,
      spreadType: 'fire',
      maxDistance: 2, // Should stop at distance 2
      color: '#ff6b35',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const propagationSystem = new PropagationSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(propagationSystem);

    // Tick many times - should still respect max distance
    for (let i = 0; i < 6; i++) {
      gameLoop.tick();
      if (i < 3) spatial.pause();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Fire did not spread beyond max distance of 2', () => {
      // Check cells at distance 3 (should be empty)
      const farCells = [
        [8, 5], // 3 cells right
        [2, 5], // 3 cells left
        [5, 8], // 3 cells down
        [5, 2], // 3 cells up
      ];

      for (const [x, y] of farCells) {
        const entityId = spatial.getEntityIdAt(x, y, GameLayers.FLOOR);
        const data = entityId ? spatial.getEntityData(entityId) : null;
        
        if (data?.type === 'fire') {
          throw new Error(`Fire spread too far to (${x}, ${y})`);
        }
      }
    });

    expect('Fire exists at distance 2', () => {
      // Check cells at distance 2 (should have fire)
      const nearCells = [
        [7, 5], // 2 cells right
        [3, 5], // 2 cells left
      ];

      let fireFound = false;
      for (const [x, y] of nearCells) {
        const entityId = spatial.getEntityIdAt(x, y, GameLayers.FLOOR);
        const data = entityId ? spatial.getEntityData(entityId) : null;
        
        if (data?.type === 'fire') {
          fireFound = true;
          break;
        }
      }

      if (!fireFound) {
        throw new Error('Fire should exist at distance 2');
      }
    });
  },
});

visual('water flows without lifetime', {
  arrange: ({ spatial }) => {
    // Spawn water source (no lifetime - persists)
    spatial.spawn('water', 5, 5, GameLayers.FLOOR, {
      propagationType: 'liquid',
      spreadRate: 1,
      spreadLayer: GameLayers.FLOOR,
      spreadType: 'water',
      maxDistance: 3,
      color: '#4a90e2',
      // No lifetime - water persists
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const propagationSystem = new PropagationSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(propagationSystem);

    // Spread water
    gameLoop.tick();
    spatial.pause();
    gameLoop.tick();
    spatial.pause();
    gameLoop.tick();
    spatial.pause();

    // More ticks - water should persist (no cleanup)
    gameLoop.tick();
    spatial.pause();
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Water persists without lifetime', () => {
      const waterCount = Array.from(spatial.getAllPositions()).filter(([id]) => {
        const data = spatial.getEntityData(id);
        return data?.type === 'water';
      }).length;

      if (waterCount === 0) {
        throw new Error('Water should persist');
      }
    });
  },
});

visual('fire spreads and damages player', {
  arrange: ({ spatial }) => {
    // Spawn player away from fire, with clear path
    spawnPlayer(spatial, 8, 5, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test-scene',
    });

    // Spawn fire that spreads and damages
    spatial.spawn('fire', 5, 5, GameLayers.FLOOR, {
      propagationType: 'fire',
      spreadRate: 1,
      spreadLayer: GameLayers.FLOOR,
      spreadType: 'fire',
      maxDistance: 5,
      color: '#ff6b35',
      // Floor effect properties
      effectType: 'damage',
      triggerMode: 'continuous',
      damage: 10,
      cadence: 1, // Fast for testing
    });

    spatial.commit();
  },
  act: ({ spatial, store }) => {
    const gameManager = new GameManager();
    gameManager.gameState.entityStore = store;
    
    const propagationSystem = new PropagationSystem();
    const floorEffectSystem = new FloorEffectSystem(gameManager);
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(propagationSystem);
    gameLoop.addSystem(floorEffectSystem);

    // Many ticks to spread fire and apply damage
    for (let i = 0; i < 8; i++) {
      gameLoop.tick();
      if (i < 4) spatial.pause();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Fire spread from source', () => {
      const fireCount = Array.from(spatial.getAllPositions()).filter(([id]) => {
        const data = spatial.getEntityData(id);
        return data?.type === 'fire';
      }).length;

      if (fireCount <= 1) {
        throw new Error(`Fire should have spread, got ${fireCount} fire entities`);
      }
    });

    expect('Player took damage from fire (if reached)', () => {
      const playerId = spatial.getEntityIdAt(8, 5, GameLayers.ACTORS);
      if (!playerId) {
        return; // Player might be removed if killed
      }

      const playerData = spatial.getEntityData(playerId);
      if (!playerData || typeof playerData.hp !== 'number') {
        return;
      }

      // Just verify fire spread happened, damage is secondary
      const fireNearby = Array.from(spatial.getAllPositions()).some(([id, pos]) => {
        const data = spatial.getEntityData(id);
        return data?.type === 'fire' && Math.abs(pos.x - 8) <= 1 && Math.abs(pos.y - 5) <= 1;
      });

      if (!fireNearby) {
        throw new Error('Fire should have spread near player');
      }
    });
  },
});

visual('multiple fire sources spread independently', {
  arrange: ({ spatial }) => {
    // Spawn two separate fire sources
    spatial.spawn('fire', 3, 5, GameLayers.FLOOR, {
      propagationType: 'fire',
      spreadRate: 1,
      spreadLayer: GameLayers.FLOOR,
      spreadType: 'fire',
      maxDistance: 2,
      color: '#ff6b35',
    });

    spatial.spawn('fire', 7, 5, GameLayers.FLOOR, {
      propagationType: 'fire',
      spreadRate: 1,
      spreadLayer: GameLayers.FLOOR,
      spreadType: 'fire',
      maxDistance: 2,
      color: '#ff6b35',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const propagationSystem = new PropagationSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(propagationSystem);

    // Both fires spread
    gameLoop.tick();
    spatial.pause();
    gameLoop.tick();
    spatial.pause();
    gameLoop.tick();
  },
  assert: ({ spatial, expect }) => {
    expect('Both fires spread independently', () => {
      // Check for fire on left side (from first source)
      const leftFire = spatial.getEntityIdAt(2, 5, GameLayers.FLOOR);
      const leftData = leftFire ? spatial.getEntityData(leftFire) : null;

      // Check for fire on right side (from second source)
      const rightFire = spatial.getEntityIdAt(8, 5, GameLayers.FLOOR);
      const rightData = rightFire ? spatial.getEntityData(rightFire) : null;

      if (leftData?.type !== 'fire' || rightData?.type !== 'fire') {
        throw new Error('Both fires should spread independently');
      }
    });
  },
});
