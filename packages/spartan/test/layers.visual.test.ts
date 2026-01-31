import { visual } from './visual-helpers';
import { GameLayers } from "../core/types";

/**
 * Layer System Visual Tests
 *
 * These tests demonstrate the Spartan Framework's 8-layer architecture:
 * - Layer semantics and purpose
 * - Layer priority and rendering order
 * - Blocking behavior per layer
 * - Vision blocking
 */

// Note: Static layer occupancy tests removed - already covered by "multiple layers at same cell" in movement.visual.test.ts

// Test: Wall blocking with movement
visual('Wall blocking - players blocked by terrain and doors', {
  arrange: ({ spatial, grid }) => {
    // Create vertical wall barrier in middle (x=5)
    for (let y = 2; y <= 6; y++) {
      const cell = grid.cell(5, y);
      if (cell) cell.values[GameLayers.WALLS] = 1; // Wall terrain
    }

    // Sync masks after manually setting cell values
    spatial.syncMasks();

    // Create door entity at one spot (can be opened later)
    spatial.spawn('door', 5, 4, GameLayers.WALLS);

    // Place two players on opposite sides
    spatial.spawn('player', 2, 4, GameLayers.ACTORS); // Left side
    spatial.spawn('enemy', 8, 4, GameLayers.ACTORS); // Right side
    spatial.commit();
  },
  act: ({ spatial }) => {
    // Left player approaches wall
    const leftId = spatial.getEntityIdAt(2, 4, GameLayers.ACTORS)!;
    spatial.move(leftId, 3, 4, (cell) => spatial.isBlocked(cell, false));
    spatial.commit();

    spatial.move(leftId, 4, 4, (cell) => spatial.isBlocked(cell, false));
    spatial.commit();

    // Try to move through wall terrain (should fail)
    spatial.move(leftId, 5, 4, (cell) => spatial.isBlocked(cell, false));
    spatial.commit();

    // Right player approaches wall/door
    const rightId = spatial.getEntityIdAt(8, 4, GameLayers.ACTORS)!;
    spatial.move(rightId, 7, 4, (cell) => spatial.isBlocked(cell, false));
    spatial.commit();

    spatial.move(rightId, 6, 4, (cell) => spatial.isBlocked(cell, false));
    spatial.commit();

    // Try to move through door (should fail)
    spatial.move(rightId, 5, 4, (cell) => spatial.isBlocked(cell, false));
    spatial.commit();

    // Both blocked - pause to show
    spatial.commit();
  },
  assert: ({ spatial, expect }) => {
    expect('Left player blocked at (4, 4)', () => {
      const id = spatial.getEntityIdAt(4, 4, GameLayers.ACTORS);
      if (!id) {
        throw new Error('Left player not at expected position');
      }
    });

    expect('Right player blocked at (6, 4)', () => {
      const id = spatial.getEntityIdAt(6, 4, GameLayers.ACTORS);
      if (!id) {
        throw new Error('Right player not at expected position');
      }
    });

    expect('Wall barrier still intact', () => {
      const throughWall = spatial.getEntityIdAt(5, 4, GameLayers.ACTORS);
      if (throughWall) {
        throw new Error('Entity moved through wall');
      }
    });
  },
});

// Test: Actor blocking - show approach and collision
visual('Actor blocking - entities collide and stop', {
  arrange: ({ spatial }) => {
    spatial.spawn('player', 8, 5, GameLayers.ACTORS);
    spatial.spawn('enemy', 13, 5, GameLayers.ACTORS);
    spatial.commit();
  },
  act: ({ spatial }) => {
    // Player approaches
    let playerId = spatial.getEntityIdAt(8, 5, GameLayers.ACTORS)!;
    spatial.move(playerId, 9, 5, (cell) => spatial.isBlocked(cell, false));
    spatial.commit();

    playerId = spatial.getEntityIdAt(9, 5, GameLayers.ACTORS)!;
    spatial.move(playerId, 10, 5, (cell) => spatial.isBlocked(cell, false));
    spatial.commit();

    // Enemy approaches
    let enemyId = spatial.getEntityIdAt(13, 5, GameLayers.ACTORS)!;
    spatial.move(enemyId, 12, 5, (cell) => spatial.isBlocked(cell, false));
    spatial.commit();

    enemyId = spatial.getEntityIdAt(12, 5, GameLayers.ACTORS)!;
    spatial.move(enemyId, 11, 5, (cell) => spatial.isBlocked(cell, false));
    spatial.commit();

    // Try to move into each other (both blocked)
    playerId = spatial.getEntityIdAt(10, 5, GameLayers.ACTORS)!;
    enemyId = spatial.getEntityIdAt(11, 5, GameLayers.ACTORS)!;

    spatial.move(playerId, 11, 5, (cell) => spatial.isBlocked(cell, false)); // Blocked
    spatial.commit();

    spatial.move(enemyId, 10, 5, (cell) => spatial.isBlocked(cell, false)); // Blocked
    spatial.commit();

    // Pause to show standoff
    spatial.commit();
  },
  assert: ({ spatial, expect }) => {
    expect('Player stopped at (10, 5)', () => {
      const playerId = spatial.getEntityIdAt(10, 5, GameLayers.ACTORS);
      if (!playerId) {
        throw new Error('Player not at collision point');
      }
    });

    expect('Enemy stopped at (11, 5)', () => {
      const enemyId = spatial.getEntityIdAt(11, 5, GameLayers.ACTORS);
      if (!enemyId) {
        throw new Error('Enemy not at collision point');
      }
    });

    expect('No entity passed through', () => {
      // Verify they're adjacent, not on same cell or swapped
      const at10 = spatial.getEntityIdAt(10, 5, GameLayers.ACTORS);
      const at11 = spatial.getEntityIdAt(11, 5, GameLayers.ACTORS);
      const at10Data = spatial.getEntityData(at10!);
      const at11Data = spatial.getEntityData(at11!);

      if (at10Data?.type !== 'player' || at11Data?.type !== 'enemy') {
        throw new Error('Entities passed through each other');
      }
    });
  },
});

// Note: Empty floor blocking test removed - floors are not visually rendered, making this test impossible to follow

// Test: Collectibles don't block movement
visual('Collectibles non-blocking - player walks through items', {
  arrange: ({ spatial }) => {
    spatial.spawn('coin', 8, 5, GameLayers.COLLECTIBLES);
    spatial.spawn('player', 6, 5, GameLayers.ACTORS);
    spatial.commit();
  },
  act: ({ spatial }) => {
    // Approach collectible
    const playerId = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS)!;
    spatial.move(playerId, 7, 5, (cell) => spatial.isBlocked(cell, false));
    spatial.commit();

    // Walk onto collectible (should succeed)
    spatial.move(playerId, 8, 5, (cell) => spatial.isBlocked(cell, false));
    spatial.commit();

    // Pause to show overlap
    spatial.commit();

    // Continue walking past collectible
    spatial.move(playerId, 9, 5, (cell) => spatial.isBlocked(cell, false));
    spatial.commit();

    spatial.move(playerId, 10, 5, (cell) => spatial.isBlocked(cell, false));
    spatial.commit();
  },
  assert: ({ spatial, expect }) => {
    expect('Player walked past collectible to (10, 5)', () => {
      const playerId = spatial.getEntityIdAt(10, 5, GameLayers.ACTORS);
      if (!playerId) {
        throw new Error('Player not at expected position');
      }
    });

    expect('Collectible still exists at (8, 5)', () => {
      const coinId = spatial.getEntityIdAt(8, 5, GameLayers.COLLECTIBLES);
      if (!coinId) {
        throw new Error('Coin should still exist');
      }
    });

    expect('Player walked through without being blocked', () => {
      const atCoinCell = spatial.getEntityIdAt(8, 5, GameLayers.ACTORS);
      if (atCoinCell) {
        throw new Error('Player should have moved past the coin');
      }
    });
  },
});

// Note: Vision blocking test removed - it's a unit test concern, not visually demonstrable without a rendering system
