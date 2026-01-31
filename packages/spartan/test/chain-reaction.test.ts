import { describe, it, expect, beforeEach } from 'vitest';
import { ChainReactionSystem } from '../systems/chain-reaction-system';
import { GameLayers } from '../layers/types';
import { createRuntimeWithSystems } from './test-helpers';

describe('ChainReactionSystem', () => {
  let context: any;
  let system: ChainReactionSystem;
  let runtime: any;

  beforeEach(() => {
    system = new ChainReactionSystem();
    runtime = createRuntimeWithSystems({
      initialScene: { id: 'test', width: 20, height: 20 },
      systems: [system]
    });
    context = {
      spatial: runtime.spatial,
      gameManager: runtime.game,
      sceneManager: runtime.game.sceneManager,
      overlaps: []
    };
  });

  it('should spread chain reaction to neighbors', () => {
    // Arrange
    const sourceId = context.spatial.spawn('chain-link', 10, 10, GameLayers.FLOOR, {
      propagationType: 'chain',
      spreadRate: 1,
      spreadLayer: GameLayers.FLOOR,
      spreadType: 'chain-link',
      color: '#fff'
    });
    context.spatial.commit();

    // Act - Tick 1 (Wait for spread rate)
    system.update(context);
    context.spatial.commit();
    
    // Act - Tick 2 (Should spread)
    system.update(context);
    context.spatial.commit();

    // Assert
    // getEntityIdsInRadius(10, 10, 1) includes center (dist 0) and neighbors (dist 1)
    const neighbors = context.spatial.getEntityIdsInRadius(10, 10, 1);
    // Source + 4 neighbors = 5
    expect(neighbors.length).toBe(5);
  });

  it('should respect maxDistance', () => {
    // Arrange
    const sourceId = context.spatial.spawn('chain-link', 10, 10, GameLayers.FLOOR, {
      propagationType: 'chain',
      spreadRate: 1,
      spreadLayer: GameLayers.FLOOR,
      spreadType: 'chain-link',
      maxDistance: 1,
      color: '#fff'
    });
    context.spatial.commit();

    // Act - Run enough ticks to spread beyond distance 1
    // Tick 1: Wait
    // Tick 2: Spread to dist 1
    // Tick 3: Wait
    // Tick 4: Spread to dist 2 (should be blocked)
    for (let i = 0; i < 10; i++) {
      system.update(context);
      context.spatial.commit();
    }

    // Assert
    // Should only have source + immediate neighbors (dist 1)
    // 1 (source) + 4 (neighbors) = 5
    // Neighbors of neighbors (dist 2) should NOT exist.
    let count = 0;
    for (const [id] of context.spatial.getAllPositions()) {
      count++;
    }
    expect(count).toBe(5);
  });
});
