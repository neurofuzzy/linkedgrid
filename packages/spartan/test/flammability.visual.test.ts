import { visual } from './visual-helpers';
import { GameLayers } from '../layers/types';
import { PropagationSystem } from '../systems/propagation-system';
import { GameLoop } from '../game-loop';

visual('fire spreads through grass field', {
  arrange: ({ spatial }) => {
    // Create a field of grass
    for (let x = 3; x <= 7; x++) {
      for (let y = 3; y <= 7; y++) {
        spatial.spawn('grass', x, y, GameLayers.FLOOR, {
          flammability: 0.8, // Highly flammable
          color: '#7cba00',
        });
      }
    }

    spatial.commit();

    // Spawn fire at edge of grass field (not on grass, so it can spread TO grass)
    spatial.spawn('fire', 2, 5, GameLayers.FLOOR, {
      propagationType: 'fire',
      spreadRate: 1,
      spreadProbability: 1.0, // Base probability (will be modified by grass flammability)
      spreadLayer: GameLayers.FLOOR,
      spreadType: 'fire',
      maxDistance: 10,
      lifetime: 30,
      color: '#ff6b35',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const propagationSystem = new PropagationSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(propagationSystem);

    // Tick to spread through grass
    for (let i = 0; i < 8; i++) {
      gameLoop.tick();
      if (i % 2 === 0) spatial.pause(); // Pause every other tick for visual
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Fire spread through grass', () => {
      const fireCount = Array.from(spatial.getAllPositions()).filter(([id]) => {
        const data = spatial.getEntityData(id);
        return data?.type === 'fire';
      }).length;

      if (fireCount < 5) {
        throw new Error(`Expected fire to spread through grass, got ${fireCount} fire entities`);
      }
    });
  },
});

visual('gasoline trail burns fast', {
  arrange: ({ spatial }) => {
    // Create a trail of gasoline (horizontal line)
    for (let x = 3; x <= 8; x++) {
      spatial.spawn('gasoline', x, 5, GameLayers.COLLECTIBLES, {
        flammability: 0.95, // Extremely flammable
        color: '#d4af37',
      });
    }

    spatial.commit();

    // Spawn fire adjacent to start of trail (not on gasoline)
    spatial.spawn('fire', 2, 5, GameLayers.COLLECTIBLES, {
      propagationType: 'fire',
      spreadRate: 1,
      spreadProbability: 1.0,
      spreadLayer: GameLayers.COLLECTIBLES,
      spreadType: 'fire',
      lifetime: 20,
      color: '#ff6b35',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const propagationSystem = new PropagationSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(propagationSystem);

    // Tick to spread along gasoline trail
    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
      if (i % 2 === 0) spatial.pause();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Fire raced through gasoline trail', () => {
      const fireCount = Array.from(spatial.getAllPositions()).filter(([id]) => {
        const data = spatial.getEntityData(id);
        return data?.type === 'fire';
      }).length;

      if (fireCount < 4) {
        throw new Error(`Expected fire to spread through gasoline, got ${fireCount} fire entities`);
      }
    });
  },
});

visual('fuse burns in sequence', {
  arrange: ({ spatial }) => {
    // Create a fuse line (very predictable burning)
    for (let x = 3; x <= 7; x++) {
      spatial.spawn('fuse', x, 5, GameLayers.COLLECTIBLES, {
        flammability: 0.99, // Nearly guaranteed to ignite
        color: '#ff4500',
      });
    }

    spatial.commit();

    // Spawn fire adjacent to start of fuse (not on fuse)
    spatial.spawn('fire', 2, 5, GameLayers.COLLECTIBLES, {
      propagationType: 'fire',
      spreadRate: 1,
      spreadProbability: 1.0,
      spreadLayer: GameLayers.COLLECTIBLES,
      spreadType: 'fire',
      lifetime: 15,
      color: '#ff6b35',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const propagationSystem = new PropagationSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(propagationSystem);

    // Tick to burn along fuse
    for (let i = 0; i < 8; i++) {
      gameLoop.tick();
      if (i % 2 === 0) spatial.pause();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Fuse burned predictably', () => {
      const fireCount = Array.from(spatial.getAllPositions()).filter(([id]) => {
        const data = spatial.getEntityData(id);
        return data?.type === 'fire';
      }).length;

      if (fireCount < 3) {
        throw new Error(`Expected fuse to burn, got ${fireCount} fire entities`);
      }
    });
  },
});

visual('fire blocked by non-flammable entities', {
  arrange: ({ spatial }) => {
    // Create grass on left and right with a gap for fire
    spatial.spawn('grass', 3, 5, GameLayers.FLOOR, {
      flammability: 0.8,
      color: '#7cba00',
    });
    
    spatial.spawn('grass', 4, 5, GameLayers.FLOOR, {
      flammability: 0.8,
      color: '#7cba00',
    });
    
    spatial.spawn('grass', 6, 5, GameLayers.FLOOR, {
      flammability: 0.8,
      color: '#7cba00',
    });
    
    spatial.spawn('grass', 7, 5, GameLayers.FLOOR, {
      flammability: 0.8,
      color: '#7cba00',
    });

    // Place water in the middle (non-flammable, blocks fire)
    spatial.spawn('water', 5, 5, GameLayers.FLOOR, {
      propagationType: 'liquid',
      spreadRate: 1,
      spreadLayer: GameLayers.FLOOR,
      spreadType: 'water',
      color: '#4a90e2',
    });

    spatial.commit();

    // Spawn fire adjacent to left grass (not on grass)
    spatial.spawn('fire', 2, 5, GameLayers.FLOOR, {
      propagationType: 'fire',
      spreadRate: 1,
      spreadProbability: 1.0,
      spreadLayer: GameLayers.FLOOR,
      spreadType: 'fire',
      maxDistance: 10,
      lifetime: 20,
      color: '#ff6b35',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const propagationSystem = new PropagationSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(propagationSystem);

    // Tick multiple times - fire should not cross water
    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
      if (i % 2 === 0) spatial.pause();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Fire did not cross water barrier', () => {
      // Check that fire never reached the right grass (x=7)
      const fireAtRight = spatial.getEntityIdAt(7, 5, GameLayers.FLOOR);
      const fireData = fireAtRight ? spatial.getEntityData(fireAtRight) : null;
      
      if (fireData && fireData.type === 'fire') {
        throw new Error('Fire should not have crossed water barrier');
      }
    });

    expect('Water still present (not consumed)', () => {
      const waterEntity = spatial.getEntityIdAt(5, 5, GameLayers.FLOOR);
      const waterData = waterEntity ? spatial.getEntityData(waterEntity) : null;
      
      if (!waterData || waterData.type !== 'water') {
        throw new Error('Water should still be present');
      }
    });
  },
});

visual('mixed flammability terrain creates realistic spread', {
  arrange: ({ spatial }) => {
    // Create mixed terrain with different flammabilities
    // Grass (high flammability) in top row
    for (let x = 3; x <= 7; x++) {
      spatial.spawn('grass', x, 3, GameLayers.FLOOR, {
        flammability: 0.8,
        color: '#7cba00',
      });
    }

    // Gasoline (very high) in middle
    spatial.spawn('gasoline', 5, 4, GameLayers.COLLECTIBLES, {
      flammability: 0.95,
      color: '#d4af37',
    });

    // Fuse (nearly guaranteed) forming a path
    spatial.spawn('fuse', 4, 5, GameLayers.COLLECTIBLES, {
      flammability: 0.99,
      color: '#ff4500',
    });
    
    spatial.spawn('fuse', 5, 5, GameLayers.COLLECTIBLES, {
      flammability: 0.99,
      color: '#ff4500',
    });

    spatial.commit();

    // Start fire adjacent to gasoline (not on it)
    spatial.spawn('fire', 6, 4, GameLayers.COLLECTIBLES, {
      propagationType: 'fire',
      spreadRate: 1,
      spreadProbability: 0.8, // Lower base probability to see flammability effect
      spreadLayer: GameLayers.COLLECTIBLES,
      spreadType: 'fire',
      lifetime: 25,
      color: '#ff6b35',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const propagationSystem = new PropagationSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(propagationSystem);

    // Tick to show realistic spreading through mixed terrain
    for (let i = 0; i < 12; i++) {
      gameLoop.tick();
      if (i % 2 === 0) spatial.pause();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Fire spread through mixed terrain', () => {
      const fireCount = Array.from(spatial.getAllPositions()).filter(([id]) => {
        const data = spatial.getEntityData(id);
        return data?.type === 'fire';
      }).length;

      if (fireCount < 2) {
        throw new Error(`Expected fire to spread through terrain, got ${fireCount} fire entities`);
      }
    });
  },
});

visual('fire cannot spread without flammable materials', {
  arrange: ({ spatial }) => {
    // Place fire on empty floor (no flammable material)
    spatial.spawn('fire', 5, 5, GameLayers.FLOOR, {
      propagationType: 'fire',
      spreadRate: 1,
      spreadProbability: 1.0,
      spreadLayer: GameLayers.FLOOR,
      spreadType: 'fire',
      lifetime: 15,
      color: '#ff6b35',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const propagationSystem = new PropagationSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(propagationSystem);

    // Tick multiple times
    for (let i = 0; i < 8; i++) {
      gameLoop.tick();
      if (i % 2 === 0) spatial.pause();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Fire did not spread (no flammable materials)', () => {
      const fireCount = Array.from(spatial.getAllPositions()).filter(([id]) => {
        const data = spatial.getEntityData(id);
        return data?.type === 'fire';
      }).length;

      // Fire should remain at 1 (the original) or 0 (if it expired due to lifetime)
      if (fireCount > 1) {
        throw new Error(`Fire should not spread without flammable materials, got ${fireCount} fires`);
      }
    });
  },
});
