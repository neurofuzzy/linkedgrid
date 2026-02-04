import { describe, it, expect } from 'vitest';
import { LinkedGrid } from '../core/grid/index';
import { SparseEntityStore } from '../core/entity-store';
import { SpatialSystem } from '../core/spatial-system';
import { GameLoop } from '../core/game-loop';
import type { GameSystem, GameContext, ExecutionPhase } from '../core/types';

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

  describe('execution phase sorting', () => {
    /**
     * Helper to create a system with a specific execution phase.
     */
    function createPhasedSystem(
      phase: ExecutionPhase,
      name: string,
      onUpdate: () => void
    ): GameSystem {
      return {
        executionPhase: phase,
        update: onUpdate,
      };
    }

    it('should sort systems by execution phase', () => {
      const grid = new LinkedGrid(10, 10);
      const store = new SparseEntityStore();
      const spatial = new SpatialSystem(grid, store);
      const gameLoop = new GameLoop(spatial);

      const executionOrder: string[] = [];

      // Add systems in reverse order (post-commit first, input last)
      gameLoop.addSystem(createPhasedSystem('post-commit', 'collection', () => {
        executionOrder.push('post-commit');
      }));
      gameLoop.addSystem(createPhasedSystem('main', 'fire', () => {
        executionOrder.push('main');
      }));
      gameLoop.addSystem(createPhasedSystem('pre-commit', 'door', () => {
        executionOrder.push('pre-commit');
      }));
      gameLoop.addSystem(createPhasedSystem('input', 'playerInput', () => {
        executionOrder.push('input');
      }));

      gameLoop.tick();

      // Should run in phase order despite registration order
      expect(executionOrder).toEqual(['input', 'pre-commit', 'main', 'post-commit']);
    });

    it('should preserve order within the same phase (stable sort)', () => {
      const grid = new LinkedGrid(10, 10);
      const store = new SparseEntityStore();
      const spatial = new SpatialSystem(grid, store);
      const gameLoop = new GameLoop(spatial);

      const executionOrder: string[] = [];

      // Add multiple systems in the same phase
      gameLoop.addSystem(createPhasedSystem('main', 'fire', () => {
        executionOrder.push('fire');
      }));
      gameLoop.addSystem(createPhasedSystem('main', 'explosion', () => {
        executionOrder.push('explosion');
      }));
      gameLoop.addSystem(createPhasedSystem('main', 'poison', () => {
        executionOrder.push('poison');
      }));

      gameLoop.tick();

      // Should maintain registration order within phase
      expect(executionOrder).toEqual(['fire', 'explosion', 'poison']);
    });

    it('should default systems without executionPhase to main', () => {
      const grid = new LinkedGrid(10, 10);
      const store = new SparseEntityStore();
      const spatial = new SpatialSystem(grid, store);
      const gameLoop = new GameLoop(spatial);

      const executionOrder: string[] = [];

      // System without executionPhase (legacy/anonymous)
      const legacySystem: GameSystem = {
        update: () => {
          executionOrder.push('legacy');
        },
      };

      gameLoop.addSystem(createPhasedSystem('input', 'input', () => {
        executionOrder.push('input');
      }));
      gameLoop.addSystem(legacySystem);
      gameLoop.addSystem(createPhasedSystem('post-commit', 'post', () => {
        executionOrder.push('post-commit');
      }));

      gameLoop.tick();

      // Legacy system should run in 'main' phase
      expect(executionOrder).toEqual(['input', 'legacy', 'post-commit']);
    });

    it('should sort systems when using registerSystems()', () => {
      const grid = new LinkedGrid(10, 10);
      const store = new SparseEntityStore();
      const spatial = new SpatialSystem(grid, store);
      const gameLoop = new GameLoop(spatial);

      const executionOrder: string[] = [];

      // Register all systems at once in wrong order
      gameLoop.registerSystems([
        createPhasedSystem('post-commit', 'teleporter', () => {
          executionOrder.push('post-commit');
        }),
        createPhasedSystem('input', 'playerInput', () => {
          executionOrder.push('input');
        }),
        createPhasedSystem('pre-commit', 'push', () => {
          executionOrder.push('pre-commit');
        }),
        createPhasedSystem('main', 'fire', () => {
          executionOrder.push('main');
        }),
      ]);

      gameLoop.tick();

      expect(executionOrder).toEqual(['input', 'pre-commit', 'main', 'post-commit']);
    });
  });
});
