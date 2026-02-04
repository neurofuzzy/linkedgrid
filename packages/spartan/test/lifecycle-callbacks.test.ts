/**
 * Tests for Entity Lifecycle Callbacks.
 *
 * Tests:
 * - onSpawn callback is invoked when entities are spawned
 * - onRemove callback is invoked when entities are removed
 * - Ephemeral entities skip callbacks
 * - Unsubscribe function removes callback
 * - Multiple callbacks are all invoked
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpatialSystem } from '../core/spatial-system';
import { SparseEntityStore } from '../core/entity-store';
import { LinkedGrid } from '../core/grid/linked-grid';
import { GameLayers } from '../config/layers.config';
import type { EntityLifecycleEvent } from '../core/types';

describe('Entity Lifecycle Callbacks', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;

  beforeEach(() => {
    grid = new LinkedGrid(10, 10);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
  });

  describe('onSpawn', () => {
    it('invokes callback when entity is spawned', () => {
      const callback = vi.fn();
      spatial.onSpawn(callback);

      spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, { hp: 50 });
      spatial.commit();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'enemy',
          x: 5,
          y: 5,
          layer: GameLayers.ACTORS,
        })
      );
    });

    it('includes entityId in callback event', () => {
      const callback = vi.fn();
      spatial.onSpawn(callback);

      const entityId = spatial.spawn('player', 3, 3, GameLayers.ACTORS);
      spatial.commit();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId,
        })
      );
    });

    it('invokes multiple callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      spatial.onSpawn(callback1);
      spatial.onSpawn(callback2);

      spatial.spawn('enemy', 5, 5, GameLayers.ACTORS);
      spatial.commit();

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('does not invoke callback for ephemeral entities', () => {
      const callback = vi.fn();
      spatial.onSpawn(callback);

      spatial.spawn('projectile', 5, 5, GameLayers.EPHEMERALS, {
        ephemeral: true,
        targetX: 10,
        targetY: 5,
      });
      spatial.commit();

      expect(callback).not.toHaveBeenCalled();
    });

    it('unsubscribe removes callback', () => {
      const callback = vi.fn();
      const unsubscribe = spatial.onSpawn(callback);

      // First spawn - callback should be called
      spatial.spawn('enemy', 5, 5, GameLayers.ACTORS);
      spatial.commit();
      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Second spawn - callback should NOT be called
      spatial.spawn('enemy', 6, 5, GameLayers.ACTORS);
      spatial.commit();
      expect(callback).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('onRemove', () => {
    it('invokes callback when entity is removed', () => {
      const callback = vi.fn();
      spatial.onRemove(callback);

      const entityId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS, { hp: 50 });
      spatial.commit();

      spatial.remove(entityId);
      spatial.commit();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId,
          type: 'enemy',
          x: 5,
          y: 5,
          layer: GameLayers.ACTORS,
        })
      );
    });

    it('invokes callback when removeAt is used', () => {
      const callback = vi.fn();
      spatial.onRemove(callback);

      const entityId = spatial.spawn('wall', 5, 5, GameLayers.WALLS);
      spatial.commit();

      spatial.removeAt(5, 5, GameLayers.WALLS);
      spatial.commit();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId,
          type: 'wall',
        })
      );
    });

    it('does not invoke callback for ephemeral entities', () => {
      const callback = vi.fn();
      spatial.onRemove(callback);

      const entityId = spatial.spawn('ray-effect', 5, 5, GameLayers.EPHEMERALS, {
        ephemeral: true,
        lifetime: 2,
      });
      spatial.commit();

      spatial.remove(entityId);
      spatial.commit();

      expect(callback).not.toHaveBeenCalled();
    });

    it('unsubscribe removes callback', () => {
      const callback = vi.fn();
      const unsubscribe = spatial.onRemove(callback);

      // First remove - callback should be called
      const id1 = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS);
      spatial.commit();
      spatial.remove(id1);
      spatial.commit();
      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Second remove - callback should NOT be called
      const id2 = spatial.spawn('enemy', 6, 5, GameLayers.ACTORS);
      spatial.commit();
      spatial.remove(id2);
      spatial.commit();
      expect(callback).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('callback timing', () => {
    it('invokes callbacks after state is consistent', () => {
      const spawnEvents: EntityLifecycleEvent[] = [];
      spatial.onSpawn((event) => {
        // At callback time, entity should be on the grid
        const pos = spatial.getEntityPosition(event.entityId);
        expect(pos).not.toBeNull();
        spawnEvents.push(event);
      });

      spatial.spawn('enemy', 5, 5, GameLayers.ACTORS);
      spatial.commit();

      expect(spawnEvents.length).toBe(1);
    });

    it('invokes remove callbacks after entity is removed from grid', () => {
      const removeEvents: EntityLifecycleEvent[] = [];
      spatial.onRemove((event) => {
        // At callback time, entity should NOT be on the grid
        const pos = spatial.getEntityPosition(event.entityId);
        expect(pos).toBeNull();
        removeEvents.push(event);
      });

      const entityId = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS);
      spatial.commit();

      spatial.remove(entityId);
      spatial.commit();

      expect(removeEvents.length).toBe(1);
    });
  });

  describe('batch operations', () => {
    it('invokes callbacks for all spawns in a batch', () => {
      const callback = vi.fn();
      spatial.onSpawn(callback);

      spatial.spawn('enemy', 5, 5, GameLayers.ACTORS);
      spatial.spawn('enemy', 6, 5, GameLayers.ACTORS);
      spatial.spawn('enemy', 7, 5, GameLayers.ACTORS);
      spatial.commit();

      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('invokes callbacks for all removals in a batch', () => {
      const callback = vi.fn();
      spatial.onRemove(callback);

      const id1 = spatial.spawn('enemy', 5, 5, GameLayers.ACTORS);
      const id2 = spatial.spawn('enemy', 6, 5, GameLayers.ACTORS);
      const id3 = spatial.spawn('enemy', 7, 5, GameLayers.ACTORS);
      spatial.commit();

      spatial.remove(id1);
      spatial.remove(id2);
      spatial.remove(id3);
      spatial.commit();

      expect(callback).toHaveBeenCalledTimes(3);
    });
  });
});
