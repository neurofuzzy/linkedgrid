import { visual } from './visual-helpers';
import { GameLayers } from "../core/types";
import { FireSystem } from '../systems/fire-system';
import { GameLoop } from '../core/game-loop';

visual('fire spreads through grass field', {
  arrange: ({ spatial }) => {
    // Create a field of grass
    for (let x = 3; x <= 7; x++) {
      for (let y = 3; y <= 7; y++) {
        spatial.spawn('grass', x, y, GameLayers.FLOOR, {
          temperature: 0,
          flammable: true,
          flamePoint: 150,
          hp: 100,
          maxHp: 100,
          color: '#7cba00',
        });
      }
    }

    spatial.commit();

    // Ignite grass at (3,5) manually
    const grassId = spatial.getEntityIdAt(3, 5, GameLayers.FLOOR);
    if (grassId) {
      const data = spatial.getEntityData(grassId);
      if (data) {
        data.temperature = 200; // Above flamePoint
      }
    }

    spatial.commit();
  },
  act: ({ spatial }) => {
    const fireSystem = new FireSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(fireSystem);

    // Tick to spread through grass
    for (let i = 0; i < 8; i++) {
      gameLoop.tick();
      if (i % 2 === 0) spatial.pause(); // Visual pause between spreads
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Fire spread through grass', () => {
      // Check how many grass entities are burning (temp > flamePoint)
      const burningCount = Array.from(spatial.getAllPositions()).filter(([id]) => {
        const data = spatial.getEntityData(id);
        return data && 'temperature' in data && data.temperature >= data.flamePoint;
      }).length;

      // Should have spread to neighbors
      if (burningCount < 3) {
        throw new Error(
          `Expected fire to spread through grass, got ${burningCount} burning entities`
        );
      }
    });
  },
});

visual('gasoline trail burns fast', {
  arrange: ({ spatial }) => {
    // Create a trail of gasoline (horizontal line)
    for (let x = 3; x <= 8; x++) {
      spatial.spawn('gasoline', x, 5, GameLayers.COLLECTIBLES, {
        temperature: 0,
        flammable: true,
        flamePoint: 100, // Easy to ignite
        hp: 10,
        maxHp: 10,
        color: '#d4af37',
      });
    }

    spatial.commit();

    // Ignite start of trail
    const gasId = spatial.getEntityIdAt(3, 5, GameLayers.COLLECTIBLES);
    if (gasId) {
        const data = spatial.getEntityData(gasId);
        if (data) data.temperature = 200;
    }

    spatial.commit();
  },
  act: ({ spatial }) => {
    const fireSystem = new FireSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(fireSystem);

    // Tick to spread along gasoline trail
    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
      if (i % 2 === 0) spatial.pause();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Fire raced through gasoline trail', () => {
      // Gasoline burns fast and has low HP, so check for Ash OR Burning
      const entities = Array.from(spatial.getAllPositions());
      const ashCount = entities.filter(([id]) => {
          const d = spatial.getEntityData(id);
          return d?.type === 'ash';
      }).length;
      
      const burningCount = entities.filter(([id]) => {
        const d = spatial.getEntityData(id);
        return d && 'temperature' in d && d.temperature >= d.flamePoint;
      }).length;

      if (ashCount + burningCount < 4) {
        throw new Error(
          `Expected fire to spread through gasoline (consumed or burning), got ${ashCount + burningCount} affected entities`
        );
      }
    });
  },
});

visual('fuse burns in sequence', {
  arrange: ({ spatial }) => {
    // Create a fuse line
    for (let x = 3; x <= 7; x++) {
      spatial.spawn('fuse', x, 5, GameLayers.COLLECTIBLES, {
        temperature: 0,
        flammable: true,
        flamePoint: 120,
        hp: 15,
        maxHp: 15,
        color: '#ff4500',
      });
    }

    spatial.commit();

    // Ignite start
    const fuseId = spatial.getEntityIdAt(3, 5, GameLayers.COLLECTIBLES);
    if (fuseId) {
        const data = spatial.getEntityData(fuseId);
        if (data) data.temperature = 200;
    }

    spatial.commit();
  },
  act: ({ spatial }) => {
    const fireSystem = new FireSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(fireSystem);

    // Tick to burn along fuse
    for (let i = 0; i < 8; i++) {
      gameLoop.tick();
      if (i % 2 === 0) spatial.pause();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Fuse burned predictably', () => {
      // Check for burning or consumed entities
      const entities = Array.from(spatial.getAllPositions());
      const affectedCount = entities.filter(([id]) => {
          const d = spatial.getEntityData(id);
          return d?.type === 'ash' || (d && 'temperature' in d && d.temperature >= d.flamePoint);
      }).length;

      if (affectedCount < 3) {
        throw new Error(
          `Expected fuse to burn, got ${affectedCount} affected entities`
        );
      }
    });
  },
});

visual('fire blocked by non-flammable entities', {
  arrange: ({ spatial }) => {
    // Create flammable grass on left and right
    // Left side
    spatial.spawn('grass', 3, 5, GameLayers.FLOOR, {
        temperature: 0,
        flammable: true,
        flamePoint: 150,
        hp: 100,
        maxHp: 100,
        color: '#7cba00'
    });
    // Right side
    spatial.spawn('grass', 5, 5, GameLayers.FLOOR, {
        temperature: 0,
        flammable: true,
        flamePoint: 150,
        hp: 100,
        maxHp: 100,
        color: '#7cba00'
    });

    // Place non-flammable water in the middle
    spatial.spawn('water', 4, 5, GameLayers.FLOOR, {
      propagationType: 'liquid',
      spreadRate: 1,
      spreadLayer: GameLayers.FLOOR_EFFECTS,
      spreadType: 'water',
      color: '#4a90e2',
      // Liquid properties
      depth: 10,
      // Temperature properties (water doesn't burn)
      flammable: false,
      temperature: 20,
      flamePoint: 9999
    });

    spatial.commit();

    // Ignite left grass
    const grassId = spatial.getEntityIdAt(3, 5, GameLayers.FLOOR);
    if (grassId) {
        const data = spatial.getEntityData(grassId);
        if (data) data.temperature = 200;
    }

    spatial.commit();
  },
  act: ({ spatial }) => {
    const fireSystem = new FireSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(fireSystem);

    // Tick multiple times
    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
      if (i % 2 === 0) spatial.pause();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Fire did not cross water barrier', () => {
      // Check that right grass (5,5) is NOT burning
      const rightGrass = spatial.getEntityIdAt(5, 5, GameLayers.FLOOR);
      const data = rightGrass ? spatial.getEntityData(rightGrass) : null;

      if (data && 'temperature' in data && data.temperature >= data.flamePoint) {
        throw new Error(`Fire jumped the water! Right grass temp: ${data.temperature}`);
      }
    });
  },
});

visual('mixed flammability terrain creates realistic spread', {
  arrange: ({ spatial }) => {
    // Mixed terrain
    // Grass (high flame point)
    spatial.spawn('grass', 3, 5, GameLayers.FLOOR, {
        temperature: 0,
        flammable: true,
        flamePoint: 150,
        hp: 100,
        maxHp: 100,
        color: '#7cba00'
    });
    
    // Gasoline (low flame point) adjacent
    spatial.spawn('gasoline', 4, 5, GameLayers.COLLECTIBLES, {
        temperature: 0,
        flammable: true,
        flamePoint: 100,
        hp: 10,
        maxHp: 10,
        color: '#d4af37'
    });

    spatial.commit();

    // Ignite Grass (3,5)
    const grassId = spatial.getEntityIdAt(3, 5, GameLayers.FLOOR);
    if (grassId) {
        const data = spatial.getEntityData(grassId);
        if (data) data.temperature = 200;
    }

    spatial.commit();
  },
  act: ({ spatial }) => {
    const fireSystem = new FireSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(fireSystem);

    // Tick
    for (let i = 0; i < 12; i++) {
      gameLoop.tick();
      if (i % 2 === 0) spatial.pause();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Fire spread from grass to gasoline', () => {
      // Gasoline should be burning or consumed (ash)
      const entities = Array.from(spatial.getAllPositions());
      const affected = entities.filter(([id]) => {
          const d = spatial.getEntityData(id);
          // Check if gasoline ID or ash at (4,5)
          // Harder to check exact ID if it turned to ash.
          // Just check if any entity at (4,5) is ash or burning.
          // But wait, getAllPositions returns ALL.
          
          // Let's check specifically for gasoline entity ID if still alive
          if (d?.type === 'gasoline') {
              return d.temperature >= d.flamePoint;
          }
          return d?.type === 'ash';
      }).length;

      if (affected < 1) {
          throw new Error("Gasoline did not ignite from adjacent burning grass");
      }
    });
  },
});

visual('fire spreads through connected grass via temperature', {
  arrange: ({ spatial }) => {
    // Create a line of grass
    spatial.spawn('grass', 5, 5, GameLayers.FLOOR, {
      temperature: 200, // Already ignited
      flammable: true,
      flamePoint: 150,
      hp: 100,
      maxHp: 100,
      color: '#7cba00',
    });
    spatial.spawn('grass', 6, 5, GameLayers.FLOOR, {
      temperature: 0,
      flammable: true,
      flamePoint: 150,
      hp: 100,
      maxHp: 100,
      color: '#7cba00',
    });
    spatial.spawn('grass', 7, 5, GameLayers.FLOOR, {
      temperature: 0,
      flammable: true,
      flamePoint: 150,
      hp: 100,
      maxHp: 100,
      color: '#7cba00',
    });
    spatial.spawn('grass', 8, 5, GameLayers.FLOOR, {
      temperature: 0,
      flammable: true,
      flamePoint: 150,
      hp: 100,
      maxHp: 100,
      color: '#7cba00',
    });
    spatial.commit();
  },
  act: ({ spatial }) => {
    const fireSystem = new FireSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(fireSystem);

    // Tick to allow fire to spread
    for (let i = 0; i < 10; i++) {
      gameLoop.tick();
      if (i % 2 === 0) spatial.pause();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Fire spread to adjacent grass', () => {
      // Check that at least 2 grass tiles are burning
      const burningCount = Array.from(spatial.getAllPositions()).filter(
        ([id]) => {
          const data = spatial.getEntityData(id);
          return (
            data &&
            data.type === 'grass' &&
            'temperature' in data &&
            'flamePoint' in data &&
            data.temperature >= data.flamePoint
          );
        }
      ).length;

      if (burningCount < 2) {
        throw new Error(
          `Expected fire to spread to adjacent grass, got ${burningCount} burning grass entities`
        );
      }
    });

    expect('Fire visuals spawned on EPHEMERALS layer', () => {
      const visualCount = Array.from(spatial.getAllPositions()).filter(
        ([id]) => {
          const data = spatial.getEntityData(id);
          return data && data.type === 'fire-visual';
        }
      ).length;

      if (visualCount < 1) {
        throw new Error(
          `Expected fire visuals to be spawned, got ${visualCount}`
        );
      }
    });
  },
});

visual('fire cannot spread without flammable materials', {
  arrange: ({ spatial }) => {
    // Spawn single flammable grass surrounded by empty floor
    spatial.spawn('grass', 5, 5, GameLayers.FLOOR, {
      temperature: 0,
      flammable: true,
      flamePoint: 150,
      hp: 20,
      maxHp: 20,
      color: '#7cba00',
    });

    spatial.commit();
  },
  act: ({ spatial }) => {
    const fireSystem = new FireSystem();
    const gameLoop = new GameLoop(spatial);
    gameLoop.addSystem(fireSystem);

    // Ignite the grass
    const grassId = spatial.getEntityIdAt(5, 5, GameLayers.FLOOR);
    if (grassId) {
      const grassData = spatial.getEntityData(grassId);
      if (grassData) {
        grassData.temperature = grassData.flamePoint + 50;
      }
    }
    spatial.commit();

    // Tick multiple times
    for (let i = 0; i < 8; i++) {
      gameLoop.tick();
      if (i % 2 === 0) spatial.pause();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Fire did not spread (no flammable materials)', () => {
      // Count entities that are burning (temperature >= flamePoint)
      const burningCount = Array.from(spatial.getAllPositions()).filter(
        ([id]) => {
          const data = spatial.getEntityData(id);
          return (
            data &&
            'temperature' in data &&
            'flamePoint' in data &&
            data.temperature >= data.flamePoint
          );
        }
      ).length;

      // Only the original grass should be burning (or 0 if it burned to ash)
      if (burningCount > 1) {
        throw new Error(
          `Fire should not spread without adjacent flammable materials, got ${burningCount} burning entities`
        );
      }
    });
  },
});
