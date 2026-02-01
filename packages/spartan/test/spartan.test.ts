import { describe, it, expect, beforeEach } from 'vitest';
import { LinkedGrid } from '../core/grid/linked-grid';
import { SparseEntityStore } from '../core/entity-store';
import { SpatialSystem } from '../core/spatial-system';

describe('SparseEntityStore', () => {
  let store: SparseEntityStore;

  beforeEach(() => {
    store = new SparseEntityStore();
  });

  describe('createId', () => {
    it('creates entity with auto-incrementing ID', () => {
      const id1 = store.createId('player');
      const id2 = store.createId('enemy');

      expect(id1).toBe(1);
      expect(id2).toBe(2);
    });

    it('stores entity type', () => {
      const id = store.createId('player');
      const data = store.getData(id);

      expect(data?.type).toBe('player');
      expect(data?.id).toBe(id);
    });

    it('stores additional properties', () => {
      const id = store.createId('player', { hp: 100, damage: 10 });
      const data = store.getData(id);

      expect(data?.hp).toBe(100);
      expect(data?.damage).toBe(10);
    });
  });

  describe('getData', () => {
    it('returns entity data by ID', () => {
      const id = store.createId('enemy', { hp: 50 });
      const data = store.getData(id);

      expect(data).toBeDefined();
      expect(data?.id).toBe(id);
      expect(data?.type).toBe('enemy');
      expect(data?.hp).toBe(50);
    });

    it('returns undefined for non-existent ID', () => {
      const data = store.getData(999);
      expect(data).toBeUndefined();
    });
  });

  describe('setData', () => {
    it('updates existing entity data', () => {
      const id = store.createId('player', { hp: 100 });
      store.setData(id, { hp: 90 });

      const data = store.getData(id);
      expect(data?.hp).toBe(90);
    });

    it('merges new properties', () => {
      const id = store.createId('player', { hp: 100 });
      store.setData(id, { score: 500 });

      const data = store.getData(id);
      expect(data?.hp).toBe(100);
      expect(data?.score).toBe(500);
    });

    it('throws for non-existent entity', () => {
      expect(() => store.setData(999, { hp: 100 })).toThrow(
        'Entity 999 not found'
      );
    });
  });

  describe('remove', () => {
    it('removes entity data', () => {
      const id = store.createId('enemy');
      const removed = store.remove(id);

      expect(removed).toBe(true);
      expect(store.getData(id)).toBeUndefined();
    });

    it('returns false for non-existent entity', () => {
      const removed = store.remove(999);
      expect(removed).toBe(false);
    });
  });

  describe('getAllIds', () => {
    it('returns all entity IDs', () => {
      const id1 = store.createId('player');
      const id2 = store.createId('enemy');
      const id3 = store.createId('item');

      const ids = store.getAllIds();
      expect(ids).toContain(id1);
      expect(ids).toContain(id2);
      expect(ids).toContain(id3);
      expect(ids.length).toBe(3);
    });

    it('returns empty array when no entities', () => {
      const ids = store.getAllIds();
      expect(ids).toEqual([]);
    });
  });

  describe('size', () => {
    it('returns count of entities', () => {
      expect(store.size).toBe(0);

      store.createId('player');
      expect(store.size).toBe(1);

      store.createId('enemy');
      expect(store.size).toBe(2);
    });
  });

  describe('clear', () => {
    it('removes all entities and resets ID counter', () => {
      store.createId('player');
      store.createId('enemy');
      expect(store.size).toBe(2);

      store.clear();
      expect(store.size).toBe(0);

      const newId = store.createId('item');
      expect(newId).toBe(1); // ID counter reset
    });
  });
});

describe('SpatialSystem', () => {
  let grid: LinkedGrid;
  let store: SparseEntityStore;
  let spatial: SpatialSystem;

  beforeEach(() => {
    grid = new LinkedGrid(10, 10);
    store = new SparseEntityStore();
    spatial = new SpatialSystem(grid, store);
  });

  describe('spawn', () => {
    it('creates entity and places in cell', () => {
      const id = spatial.spawn('player', 5, 5, 1);
      spatial.commit(); // Commit deferred spawn

      expect(id).toBe(1);
      const cell = grid.cell(5, 5);
      expect(cell?.getValue(1)).toBe(id);
    });

    it('stores entity metadata', () => {
      const id = spatial.spawn('player', 5, 5, 1, { hp: 100 });
      const data = store.getData(id);

      expect(data?.type).toBe('player');
      expect(data?.hp).toBe(100);
    });

    it('does not place entity at invalid coordinates', () => {
      // Spawn stages operation but doesn't validate coordinates yet
      const id1 = spatial.spawn('player', -1, 5, 1);
      const id2 = spatial.spawn('player', 100, 5, 1);
      spatial.commit(); // Validation happens at commit

      // Entities created but not placed (invalid coordinates)
      expect(spatial.getEntityPosition(id1)).toBeNull();
      expect(spatial.getEntityPosition(id2)).toBeNull();
    });

    it('does not place entity when layer is occupied (Rule 3)', () => {
      const id1 = spatial.spawn('player', 5, 5, 1);
      spatial.commit(); // Commit first spawn

      const id2 = spatial.spawn('enemy', 5, 5, 1); // Same position/layer
      spatial.commit(); // Validation happens at commit

      // First entity placed, second not placed (occupied)
      expect(spatial.getEntityPosition(id1)).toEqual({ x: 5, y: 5, layer: 1 });
      expect(spatial.getEntityPosition(id2)).toBeNull(); // Not placed
    });

    it('allows multiple entities on same cell with different layers (Rule 4)', () => {
      const id1 = spatial.spawn('player', 5, 5, 1);
      const id2 = spatial.spawn('enemy', 5, 5, 2);
      spatial.commit(); // Commit spawns

      const cell = grid.cell(5, 5);
      expect(cell?.getValue(1)).toBe(id1);
      expect(cell?.getValue(2)).toBe(id2);
    });
  });

  describe('move (coordinate-based API)', () => {
    it('moves entity to new cell', () => {
      const id = spatial.spawn('player', 5, 5, 1);
      spatial.commit();
      spatial.move(id, 6, 5);
      spatial.commit();

      const oldCell = grid.cell(5, 5);
      const newCell = grid.cell(6, 5);
      expect(oldCell?.getValue(1)).toBeUndefined();
      expect(newCell?.getValue(1)).toBe(id);
    });

    it('cleans up old cell (Rule 6)', () => {
      const id = spatial.spawn('player', 5, 5, 1);
      spatial.commit();
      spatial.move(id, 6, 5);
      spatial.commit();

      const oldCell = grid.cell(5, 5);
      expect(oldCell?.getValue(1)).toBeUndefined();
    });

    it('does not move when destination is occupied (Rule 3)', () => {
      const playerId = spatial.spawn('player', 5, 5, 1);
      spatial.spawn('enemy', 6, 5, 1);
      spatial.commit();

      spatial.move(playerId, 6, 5);
      spatial.commit();

      // Player should still be at original position
      const cell = grid.cell(5, 5);
      expect(cell?.getValue(1)).toBe(playerId);
    });

    it('does not move for invalid coordinates', () => {
      const id = spatial.spawn('player', 5, 5, 1);
      spatial.commit();
      spatial.move(id, 100, 100);
      spatial.commit();

      // Player should still be at original position
      const cell = grid.cell(5, 5);
      expect(cell?.getValue(1)).toBe(id);
    });

    it('does not move when no entity at source', () => {
      // Try to move a non-existent entity
      spatial.move(0, 6, 5);
      spatial.commit();

      // Nothing should have happened
      const cell = grid.cell(6, 5);
      expect(cell?.getValue(1)).toBeUndefined();
    });

    it('can move multiple times', () => {
      const id = spatial.spawn('player', 0, 0, 1);
      spatial.commit();

      spatial.move(id, 1, 0);
      spatial.commit();
      spatial.move(id, 2, 0);
      spatial.commit();
      spatial.move(id, 3, 0);
      spatial.commit();

      const cell = grid.cell(3, 0);
      expect(cell?.getValue(1)).toBe(id);
    });

    it('allows adjacent entities to move in same direction (convoy)', () => {
      const id1 = spatial.spawn('unit', 5, 5, 1);
      const id2 = spatial.spawn('unit', 6, 5, 1);
      const id3 = spatial.spawn('unit', 7, 5, 1);
      spatial.commit();

      // All three units move right (entity-based API)
      spatial.move(id1, 6, 5);
      spatial.move(id2, 7, 5);
      spatial.move(id3, 8, 5);
      spatial.commit();

      // All should have moved successfully
      expect(grid.cell(6, 5)?.getValue(1)).toBe(id1);
      expect(grid.cell(7, 5)?.getValue(1)).toBe(id2);
      expect(grid.cell(8, 5)?.getValue(1)).toBe(id3);

      // Old positions should be cleaned up
      expect(grid.cell(5, 5)?.getValue(1)).toBeUndefined();
    });

    it('detects conflicts when two entities want same destination', () => {
      const id1 = spatial.spawn('unit', 5, 5, 1);
      const id2 = spatial.spawn('unit', 5, 7, 1);
      spatial.commit();

      // Both try to move to (5, 6)
      spatial.move(id1, 5, 6);
      spatial.move(id2, 5, 6);
      spatial.commit();

      // Neither should have moved
      expect(grid.cell(5, 5)?.getValue(1)).toBe(id1);
      expect(grid.cell(5, 7)?.getValue(1)).toBe(id2);
      expect(grid.cell(5, 6)?.getValue(1)).toBeUndefined();
    });
  });

  describe('remove (coordinate-based API)', () => {
    it('removes entity from cell and store', () => {
      const id = spatial.spawn('player', 5, 5, 1);
      spatial.commit();

      const removed = spatial.remove(id);
      expect(removed).toBe(true);
      spatial.commit();

      const cell = grid.cell(5, 5);
      expect(cell?.getValue(1)).toBeUndefined();
      expect(store.getData(id)).toBeUndefined();
    });

    it('returns false when no entity at position', () => {
      const removed = spatial.removeAt(5, 5, 1);
      expect(removed).toBe(false);
    });

    it('returns false for invalid coordinates', () => {
      const removed = spatial.removeAt(100, 100, 1);
      expect(removed).toBe(false);
    });
  });

  describe('Entity-based API edge cases', () => {
    describe('move', () => {
      it('silently ignores move for non-existent entity', () => {
        spatial.move(999, 6, 5);
        spatial.commit();
        
        // Nothing should have moved (entity doesn't exist)
        const cell = grid.cell(6, 5);
        expect(cell?.getValue(1)).toBeUndefined();
      });

      it('works with overlap detection results', () => {
        const id1 = spatial.spawn('unit', 5, 5, 1);
        const id2 = spatial.spawn('item', 5, 5, 2);
        spatial.commit();

        const overlaps = spatial.detectOverlaps();
        expect(overlaps.length).toBe(1);

        // Move all entities in overlap (demonstrates entity-based API with overlaps)
        for (const entityId of overlaps[0].entityIds) {
          spatial.move(entityId, 6, 5);
        }
        spatial.commit();

        // Both should have moved
        const newCell = grid.cell(6, 5);
        expect(newCell?.getValue(1)).toBe(id1);
        expect(newCell?.getValue(2)).toBe(id2);
      });
    });

    describe('removeEntity', () => {
      it('returns false when entity not on grid', () => {
        const removed = spatial.remove(999);
        expect(removed).toBe(false);
      });

      it('works for cleaning up dead entities by ID', () => {
        const ids = [
          spatial.spawn('enemy', 5, 5, 1),
          spatial.spawn('enemy', 6, 5, 1),
          spatial.spawn('enemy', 7, 5, 1),
        ];
        spatial.commit();

        // Remove all enemies by ID (demonstrates entity-based cleanup)
        for (const id of ids) {
          spatial.remove(id);
        }
        spatial.commit();

        // All should be gone
        expect(grid.cell(5, 5)?.getValue(1)).toBeUndefined();
        expect(grid.cell(6, 5)?.getValue(1)).toBeUndefined();
        expect(grid.cell(7, 5)?.getValue(1)).toBeUndefined();
      });
    });
  });

  describe('getEntityIdAt', () => {
    it('returns entity ID at position and layer', () => {
      const id = spatial.spawn('player', 5, 5, 1);
      spatial.commit(); // Commit spawn
      const found = spatial.getEntityIdAt(5, 5, 1);
      expect(found).toBe(id);
    });

    it('returns undefined when no entity', () => {
      const found = spatial.getEntityIdAt(5, 5, 1);
      expect(found).toBeUndefined();
    });

    it('returns undefined for invalid coordinates', () => {
      const found = spatial.getEntityIdAt(100, 100, 1);
      expect(found).toBeUndefined();
    });
  });

  describe('getEntityIdsInCell', () => {
    it('returns all entity IDs in cell (Rule 7: overlap detection)', () => {
      const id1 = spatial.spawn('player', 5, 5, 1);
      const id2 = spatial.spawn('item', 5, 5, 2);
      const id3 = spatial.spawn('projectile', 5, 5, 3);
      spatial.commit(); // Commit spawns

      const ids = spatial.getEntityIdsInCell(5, 5);
      expect(ids).toContain(id1);
      expect(ids).toContain(id2);
      expect(ids).toContain(id3);
      expect(ids.length).toBe(3);
    });

    it('returns empty array when no entities', () => {
      const ids = spatial.getEntityIdsInCell(5, 5);
      expect(ids).toEqual([]);
    });

    it('returns empty array for invalid coordinates', () => {
      const ids = spatial.getEntityIdsInCell(100, 100);
      expect(ids).toEqual([]);
    });
  });

  describe('getEntityIdsInRadius', () => {
    it('finds entities within circular radius (Rule 5: spatial queries)', () => {
      const id1 = spatial.spawn('player', 5, 5, 1);
      const id2 = spatial.spawn('enemy', 6, 5, 1); // Distance 1
      const id3 = spatial.spawn('enemy', 7, 5, 1); // Distance 2
      const id4 = spatial.spawn('enemy', 9, 5, 1); // Distance 4 (outside radius 3)
      spatial.commit(); // Commit spawns

      const ids = spatial.getEntityIdsInRadius(5, 5, 3);

      expect(ids).toContain(id1);
      expect(ids).toContain(id2);
      expect(ids).toContain(id3);
      expect(ids).not.toContain(id4);
    });

    it('returns empty array when no entities in radius', () => {
      spatial.spawn('player', 0, 0, 1);
      const ids = spatial.getEntityIdsInRadius(9, 9, 2);
      expect(ids).toEqual([]);
    });

    it('returns empty array for invalid coordinates', () => {
      const ids = spatial.getEntityIdsInRadius(100, 100, 5);
      expect(ids).toEqual([]);
    });
  });

  describe('getEntityIdsInLine', () => {
    it('finds entities along a line (Rule 5: line-of-sight)', () => {
      const playerId = spatial.spawn('player', 0, 0, 1);
      const id1 = spatial.spawn('enemy', 2, 0, 1);
      const id2 = spatial.spawn('enemy', 4, 0, 1);
      spatial.spawn('enemy', 0, 4, 1); // Not in line
      spatial.commit(); // Commit spawns

      const ids = spatial.getEntityIdsInLine(0, 0, 5, 0);

      expect(ids).toContain(playerId); // Line includes start point
      expect(ids).toContain(id1);
      expect(ids).toContain(id2);
      expect(ids.length).toBe(3);
    });

    it('returns empty array when no entities on line', () => {
      spatial.spawn('player', 0, 0, 1);
      const ids = spatial.getEntityIdsInLine(5, 5, 9, 9);
      expect(ids).toEqual([]);
    });
  });

  describe('getEntityData', () => {
    it('returns entity metadata', () => {
      const id = spatial.spawn('player', 5, 5, 1, { hp: 100 });
      const data = spatial.getEntityData(id);

      expect(data?.type).toBe('player');
      expect(data?.hp).toBe(100);
    });

    it('returns undefined for non-existent entity', () => {
      const data = spatial.getEntityData(999);
      expect(data).toBeUndefined();
    });
  });

  describe('getEntityPosition', () => {
    it('returns position after spawn', () => {
      const id = spatial.spawn('player', 5, 5, 1);
      spatial.commit(); // Commit deferred spawn
      const pos = spatial.getEntityPosition(id);

      expect(pos).not.toBeNull();
      expect(pos?.x).toBe(5);
      expect(pos?.y).toBe(5);
      expect(pos?.layer).toBe(1);
    });

    it('updates position after move', () => {
      const id = spatial.spawn('player', 5, 5, 1);
      spatial.commit(); // Commit initial spawn
      spatial.move(id, 7, 8);
      spatial.commit();

      const pos = spatial.getEntityPosition(id);
      expect(pos?.x).toBe(7);
      expect(pos?.y).toBe(8);
      expect(pos?.layer).toBe(1);
    });

    it('updates position after multiple moves', () => {
      const id = spatial.spawn('player', 0, 0, 1);
      spatial.commit(); // Commit initial spawn

      spatial.move(id, 1, 0);
      spatial.commit();
      let pos = spatial.getEntityPosition(id);
      expect(pos?.x).toBe(1);
      expect(pos?.y).toBe(0);

      spatial.move(id, 1, 1);
      spatial.commit();
      pos = spatial.getEntityPosition(id);
      expect(pos?.x).toBe(1);
      expect(pos?.y).toBe(1);

      spatial.move(id, 2, 2);
      spatial.commit();
      pos = spatial.getEntityPosition(id);
      expect(pos?.x).toBe(2);
      expect(pos?.y).toBe(2);
    });

    it('does not update position when move fails', () => {
      const id = spatial.spawn('player', 5, 5, 1);
      spatial.spawn('wall', 6, 5, 1);
      spatial.commit(); // Commit spawns

      spatial.move(id, 6, 5);
      spatial.commit();

      const pos = spatial.getEntityPosition(id);
      expect(pos?.x).toBe(5);
      expect(pos?.y).toBe(5);
    });

    it('returns null after entity is removed', () => {
      const id = spatial.spawn('player', 5, 5, 1);
      spatial.removeAt(5, 5, 1);

      const pos = spatial.getEntityPosition(id);
      expect(pos).toBeNull();
    });

    it('returns null for non-existent entity', () => {
      const pos = spatial.getEntityPosition(999);
      expect(pos).toBeNull();
    });

    it('tracks multiple entities independently', () => {
      const id1 = spatial.spawn('player', 5, 5, 1);
      const id2 = spatial.spawn('enemy', 7, 8, 2);
      const id3 = spatial.spawn('item', 1, 2, 3);
      spatial.commit(); // Commit all spawns

      const pos1 = spatial.getEntityPosition(id1);
      const pos2 = spatial.getEntityPosition(id2);
      const pos3 = spatial.getEntityPosition(id3);

      expect(pos1).toEqual({ x: 5, y: 5, layer: 1 });
      expect(pos2).toEqual({ x: 7, y: 8, layer: 2 });
      expect(pos3).toEqual({ x: 1, y: 2, layer: 3 });
    });

    it('handles convoy movements correctly', () => {
      const id1 = spatial.spawn('unit', 5, 5, 1);
      const id2 = spatial.spawn('unit', 6, 5, 1);
      const id3 = spatial.spawn('unit', 7, 5, 1);
      spatial.commit(); // Commit spawns

      spatial.move(id1, 6, 5);
      spatial.move(id2, 7, 5);
      spatial.move(id3, 8, 5);
      spatial.commit();

      expect(spatial.getEntityPosition(id1)).toEqual({ x: 6, y: 5, layer: 1 });
      expect(spatial.getEntityPosition(id2)).toEqual({ x: 7, y: 5, layer: 1 });
      expect(spatial.getEntityPosition(id3)).toEqual({ x: 8, y: 5, layer: 1 });
    });

    it('maintains position when move conflicts', () => {
      const id1 = spatial.spawn('unit', 5, 5, 1);
      const id2 = spatial.spawn('unit', 5, 7, 1);

      // Both try to move to same destination
      spatial.move(id1, 5, 6);
      spatial.move(id2, 5, 6);
      spatial.commit();

      // Neither should have moved
      expect(spatial.getEntityPosition(id1)).toEqual({ x: 5, y: 5, layer: 1 });
      expect(spatial.getEntityPosition(id2)).toEqual({ x: 5, y: 7, layer: 1 });
    });
  });

  describe('getGrid and getStore', () => {
    it('returns grid instance', () => {
      expect(spatial.getGrid()).toBe(grid);
    });

    it('returns store instance', () => {
      expect(spatial.getStore()).toBe(store);
    });
  });

  describe('Spartan rules integration', () => {
    it('Rule 1: Entities can only occupy one cell at a time', () => {
      const id = spatial.spawn('player', 5, 5, 1);
      spatial.commit(); // Commit spawn
      spatial.move(id, 6, 5);
      spatial.commit();

      // Entity should only be in new cell
      expect(grid.cell(5, 5)?.getValue(1)).toBeUndefined();
      expect(grid.cell(6, 5)?.getValue(1)).toBe(id);
    });

    it('Rule 2: Entities occupy a layer on a cell', () => {
      const id = spatial.spawn('player', 5, 5, 1);
      spatial.commit(); // Commit spawn
      const cell = grid.cell(5, 5);

      expect(cell?.getValue(1)).toBe(id);
      expect(cell?.getValue(0)).toBeUndefined();
      expect(cell?.getValue(2)).toBeUndefined();
    });

    it('Rule 3: Check destination before moving', () => {
      const playerId = spatial.spawn('player', 5, 5, 1);
      spatial.spawn('wall', 6, 5, 1);
      spatial.commit(); // Commit spawns

      spatial.move(playerId, 6, 5);
      spatial.commit();

      // Move should not have happened
      expect(grid.cell(5, 5)?.getValue(1)).toBe(playerId);
    });

    it('Rule 4: Multiple entities per cell on different layers', () => {
      const player = spatial.spawn('player', 5, 5, 1);
      const item = spatial.spawn('item', 5, 5, 2);
      const effect = spatial.spawn('effect', 5, 5, 3);
      spatial.commit(); // Commit spawns

      const cell = grid.cell(5, 5);
      expect(cell?.getValue(1)).toBe(player);
      expect(cell?.getValue(2)).toBe(item);
      expect(cell?.getValue(3)).toBe(effect);
    });

    it('Rule 6: Clean up old cell on move', () => {
      const id = spatial.spawn('player', 5, 5, 1);
      spatial.commit(); // Commit spawn
      spatial.move(id, 6, 5);
      spatial.commit();

      const oldCell = grid.cell(5, 5);
      expect(oldCell?.getValue(1)).toBeUndefined();
    });

    it('Rule 7: Overlap detection, not collision', () => {
      const player = spatial.spawn('player', 5, 5, 1);
      const projectile = spatial.spawn('projectile', 5, 5, 2);
      spatial.commit(); // Commit spawns

      // Both occupy the same cell - this is overlap
      const overlapping = spatial.getEntityIdsInCell(5, 5);
      expect(overlapping).toContain(player);
      expect(overlapping).toContain(projectile);
    });
  });
});
