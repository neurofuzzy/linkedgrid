import { describe, it, expect } from 'vitest';
import { LinkedGrid } from '../../grid/index.js';
import { SparseEntityStore } from '../entity-store.js';
import { SpatialSystem } from '../spatial-system.js';
import { GameLoop } from '../game-loop.js';
import type { GameSystem, GameContext } from '../types.js';

describe('GameLoop', () => {
  it('should detect overlaps and run systems', () => {
    const grid = new LinkedGrid(10, 10);
    const store = new SparseEntityStore();
    const spatial = new SpatialSystem(grid, store);
    const gameLoop = new GameLoop(spatial);

    // Spawn two entities at same position (different layers)
    spatial.spawn('player', 5, 5, 1);
    spatial.spawn('item', 5, 5, 2);
    spatial.commit();

    let detectedOverlap = false;
    const testSystem: GameSystem = {
      update: (context: GameContext) => {
        if (context.overlaps.length > 0) {
          detectedOverlap = true;
          expect(context.overlaps[0].entityIds.length).toBe(2);
          expect(context.overlaps[0].position).toEqual({ x: 5, y: 5 });
        }
      },
    };

    gameLoop.addSystem(testSystem);
    gameLoop.tick();

    expect(detectedOverlap).toBe(true);
  });

  it('should commit intents after systems run', () => {
    const grid = new LinkedGrid(10, 10);
    const store = new SparseEntityStore();
    const spatial = new SpatialSystem(grid, store);
    const gameLoop = new GameLoop(spatial);

    const playerId = spatial.spawn('player', 5, 5, 1);
    spatial.commit();

    const moveSystem: GameSystem = {
      update: (context: GameContext) => {
        // Stage movement
        context.spatial.move(playerId, 6, 5);
      },
    };

    gameLoop.addSystem(moveSystem);
    gameLoop.tick();

    // Movement should be committed
    const pos = spatial.getEntityPosition(playerId);
    expect(pos).toEqual({ x: 6, y: 5, layer: 1 });
  });

  it('should run multiple systems in order', () => {
    const grid = new LinkedGrid(10, 10);
    const store = new SparseEntityStore();
    const spatial = new SpatialSystem(grid, store);
    const gameLoop = new GameLoop(spatial);

    const executionOrder: number[] = [];

    const system1: GameSystem = {
      update: () => {
        executionOrder.push(1);
      },
    };
    const system2: GameSystem = {
      update: () => {
        executionOrder.push(2);
      },
    };
    const system3: GameSystem = {
      update: () => {
        executionOrder.push(3);
      },
    };

    gameLoop.addSystem(system1);
    gameLoop.addSystem(system2);
    gameLoop.addSystem(system3);
    gameLoop.tick();

    expect(executionOrder).toEqual([1, 2, 3]);
  });

  it('should detect no overlaps when entities are separate', () => {
    const grid = new LinkedGrid(10, 10);
    const store = new SparseEntityStore();
    const spatial = new SpatialSystem(grid, store);
    const gameLoop = new GameLoop(spatial);

    spatial.spawn('player', 5, 5, 1);
    spatial.spawn('enemy', 7, 7, 1);
    spatial.commit();

    let detectedOverlaps = false;
    const testSystem: GameSystem = {
      update: (context: GameContext) => {
        if (context.overlaps.length > 0) {
          detectedOverlaps = true;
        }
      },
    };

    gameLoop.addSystem(testSystem);
    gameLoop.tick();

    expect(detectedOverlaps).toBe(false);
  });
});
