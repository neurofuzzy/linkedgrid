import { describe, it, expect } from 'vitest';
import { LinkedGrid } from '../core/grid/index';
import { SparseEntityStore } from '../core/entity-store';
import { SpatialSystem } from '../core/spatial-system';
import { GameLayers } from "../core/types";

describe('Transaction Consistency', () => {
  it('defers all operations until commit', () => {
    const grid = new LinkedGrid(10, 10);
    const store = new SparseEntityStore();
    const spatial = new SpatialSystem(grid, store);

    // Stage spawn operations
    const id1 = spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    const id2 = spatial.spawn('enemy', 6, 5, GameLayers.ACTORS);

    // Not visible yet
    expect(spatial.getEntityPosition(id1)).toBeNull();
    expect(spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)).toBeUndefined();

    // Commit spawns
    spatial.commit();

    // Now spawn visible, stage move
    spatial.move(id1, 6, 6);
    spatial.commit();

    // Now visible at new position
    expect(spatial.getEntityPosition(id1)).toEqual({
      x: 6,
      y: 6,
      layer: GameLayers.ACTORS,
    });
    expect(spatial.getEntityPosition(id2)).toEqual({
      x: 6,
      y: 5,
      layer: GameLayers.ACTORS,
    });
  });

  it('prevents ghost entities from move+remove conflict', () => {
    const grid = new LinkedGrid(10, 10);
    const store = new SparseEntityStore();
    const spatial = new SpatialSystem(grid, store);

    // Setup
    const id = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS);
    spatial.commit();

    // Stage conflicting operations
    spatial.move(id, 6, 5);
    spatial.removeAt(5, 5, GameLayers.ACTORS);

    // Commit
    spatial.commit();

    // Entity should be gone (not at either location)
    expect(spatial.getEntityPosition(id)).toBeNull();
    expect(spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)).toBeUndefined();
    expect(spatial.getEntityIdAt(6, 5, GameLayers.ACTORS)).toBeUndefined();
    expect(spatial.getEntityData(id)).toBeUndefined();
  });

  it('excludes pending removals from radius queries', () => {
    const grid = new LinkedGrid(10, 10);
    const store = new SparseEntityStore();
    const spatial = new SpatialSystem(grid, store);

    // Setup
    const enemy1 = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS);
    const enemy2 = spatial.spawn('enemy', 6, 5, GameLayers.ACTORS);
    spatial.commit();

    // Stage removal
    spatial.removeAt(5, 5, GameLayers.ACTORS);

    // Query should exclude pending removal
    const targets = spatial.getEntityIdsInRadius(5, 5, 2);
    expect(targets).not.toContain(enemy1);
    expect(targets).toContain(enemy2);

    // Unless explicitly included
    const all = spatial.getEntityIdsInRadius(5, 5, 2, {
      includePendingRemovals: true,
    });
    expect(all).toContain(enemy1);
    expect(all).toContain(enemy2);
  });

  it('allows cancellation of pending removal', () => {
    const grid = new LinkedGrid(10, 10);
    const store = new SparseEntityStore();
    const spatial = new SpatialSystem(grid, store);

    // Setup
    const id = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS);
    spatial.commit();

    // Stage removal
    spatial.removeAt(5, 5, GameLayers.ACTORS);
    expect(spatial.isAlive(id)).toBe(false);

    // Cancel (resurrection)
    const canceled = spatial.cancelRemoval(id);
    expect(canceled).toBe(true);
    expect(spatial.isAlive(id)).toBe(true);

    // Commit - entity still exists
    spatial.commit();
    expect(spatial.getEntityPosition(id)).toEqual({
      x: 5,
      y: 5,
      layer: GameLayers.ACTORS,
    });
  });

  it('allows cancellation of pending spawn', () => {
    const grid = new LinkedGrid(10, 10);
    const store = new SparseEntityStore();
    const spatial = new SpatialSystem(grid, store);

    // Stage spawn
    const id = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS);
    expect(spatial.getEntityPosition(id)).toBeNull(); // Not on grid yet

    // Cancel
    const canceled = spatial.cancelSpawn(id);
    expect(canceled).toBe(true);

    // Commit - entity should not appear
    spatial.commit();
    expect(spatial.getEntityPosition(id)).toBeNull();
    expect(spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)).toBeUndefined();
  });

  it('isAlive returns false for pending removals', () => {
    const grid = new LinkedGrid(10, 10);
    const store = new SparseEntityStore();
    const spatial = new SpatialSystem(grid, store);

    // Setup
    const id = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS);
    spatial.commit();

    // Entity is alive
    expect(spatial.isAlive(id)).toBe(true);

    // Stage removal
    spatial.removeAt(5, 5, GameLayers.ACTORS);

    // Entity is now "zombie" - not alive but still on grid
    expect(spatial.isAlive(id)).toBe(false);
    expect(spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)).toBe(id); // Still on grid

    // After commit, truly gone
    spatial.commit();
    expect(spatial.isAlive(id)).toBe(false);
    expect(spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)).toBeUndefined();
  });

  it('processes operations in correct order: remove -> move -> spawn', () => {
    const grid = new LinkedGrid(10, 10);
    const store = new SparseEntityStore();
    const spatial = new SpatialSystem(grid, store);

    // Setup: entity at (5, 5)
    const id1 = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS);
    spatial.commit();

    // Stage: remove at (5,5), move to (5,5), spawn at (6,6)
    spatial.removeAt(5, 5, GameLayers.ACTORS);
    const id2 = spatial.spawn('player', 6, 6, GameLayers.ACTORS);
    const id3 = spatial.spawn('item', 5, 5, GameLayers.ACTORS); // Should succeed (after removal)

    spatial.commit();

    // Verify correct execution order
    expect(spatial.getEntityPosition(id1)).toBeNull(); // Removed
    expect(spatial.getEntityPosition(id2)).toEqual({
      x: 6,
      y: 6,
      layer: GameLayers.ACTORS,
    }); // Spawned
    expect(spatial.getEntityPosition(id3)).toEqual({
      x: 5,
      y: 5,
      layer: GameLayers.ACTORS,
    }); // Spawned at cleared location
  });

  it('getPendingOps shows all staged operations', () => {
    const grid = new LinkedGrid(10, 10);
    const store = new SparseEntityStore();
    const spatial = new SpatialSystem(grid, store);

    // Stage operations
    const id1 = spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    const id2 = spatial.spawn('enemy', 6, 5, GameLayers.ACTORS);
    spatial.commit();

    // Stage more operations
    spatial.move(id1, 6, 6);
    spatial.removeAt(6, 5, GameLayers.ACTORS);
    const id3 = spatial.spawn('item', 7, 7, GameLayers.COLLECTIBLES);

    // Check pending operations
    const pending = spatial.getPendingOps();
    expect(pending.length).toBe(3);
    expect(pending[0].type).toBe('move');
    expect(pending[1].type).toBe('remove');
    expect(pending[2].type).toBe('spawn');

    // Check pending removals
    const pendingRemovals = spatial.getPendingRemovals();
    expect(pendingRemovals.size).toBe(1);
    expect(pendingRemovals.has(id2)).toBe(true);
  });

  it('clearIntents cancels all pending operations', () => {
    const grid = new LinkedGrid(10, 10);
    const store = new SparseEntityStore();
    const spatial = new SpatialSystem(grid, store);

    // Stage operations
    const id1 = spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    spatial.commit();

    spatial.move(id1, 6, 6);
    spatial.removeAt(5, 5, GameLayers.ACTORS);
    const id2 = spatial.spawn('enemy', 7, 7, GameLayers.ACTORS);

    // Verify operations are staged
    expect(spatial.getPendingOps().length).toBeGreaterThan(0);

    // Clear all
    spatial.clearIntents();

    // Nothing pending
    expect(spatial.getPendingOps().length).toBe(0);
    expect(spatial.getPendingRemovals().size).toBe(0);

    // Original entity unchanged
    expect(spatial.getEntityPosition(id1)).toEqual({
      x: 5,
      y: 5,
      layer: GameLayers.ACTORS,
    });
  });
});
