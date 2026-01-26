import { describe, it, expect, beforeEach } from 'vitest';
import { LinkedGrid } from '../../grid/linked-grid';
import { SparseEntityStore } from '../entity-store';
import { SpatialSystem } from '../spatial-system';

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
            expect(() => store.setData(999, { hp: 100 })).toThrow('Entity 999 not found');
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

            expect(id).toBe(1);
            const cell = grid.cell(5, 5);
            expect(cell?.items[1]).toBe(id);
        });

        it('stores entity metadata', () => {
            const id = spatial.spawn('player', 5, 5, 1, { hp: 100 });
            const data = store.getData(id);

            expect(data?.type).toBe('player');
            expect(data?.hp).toBe(100);
        });

        it('throws on invalid coordinates', () => {
            expect(() => spatial.spawn('player', -1, 5, 1)).toThrow('Invalid coordinates');
            expect(() => spatial.spawn('player', 100, 5, 1)).toThrow('Invalid coordinates');
        });

        it('throws when layer is occupied (Rule 3)', () => {
            spatial.spawn('player', 5, 5, 1);
            expect(() => spatial.spawn('enemy', 5, 5, 1)).toThrow('Layer 1 at (5, 5) is already occupied');
        });

        it('allows multiple entities on same cell with different layers (Rule 4)', () => {
            const id1 = spatial.spawn('player', 5, 5, 1);
            const id2 = spatial.spawn('enemy', 5, 5, 2);

            const cell = grid.cell(5, 5);
            expect(cell?.items[1]).toBe(id1);
            expect(cell?.items[2]).toBe(id2);
        });
    });

    describe('move', () => {
        it('moves entity to new cell', () => {
            const id = spatial.spawn('player', 5, 5, 1);
            spatial.move(5, 5, 6, 5, 1);
            spatial.commit();
            
            const oldCell = grid.cell(5, 5);
            const newCell = grid.cell(6, 5);
            expect(oldCell?.items[1]).toBeUndefined();
            expect(newCell?.items[1]).toBe(id);
        });

        it('cleans up old cell (Rule 6)', () => {
            spatial.spawn('player', 5, 5, 1);
            spatial.move(5, 5, 6, 5, 1);
            spatial.commit();

            const oldCell = grid.cell(5, 5);
            expect(oldCell?.items[1]).toBeUndefined();
        });

        it('does not move when destination is occupied (Rule 3)', () => {
            const playerId = spatial.spawn('player', 5, 5, 1);
            spatial.spawn('enemy', 6, 5, 1);

            spatial.move(5, 5, 6, 5, 1);
            spatial.commit();

            // Player should still be at original position
            const cell = grid.cell(5, 5);
            expect(cell?.items[1]).toBe(playerId);
        });

        it('does not move for invalid coordinates', () => {
            const id = spatial.spawn('player', 5, 5, 1);
            spatial.move(5, 5, 100, 100, 1);
            spatial.commit();
            
            // Player should still be at original position
            const cell = grid.cell(5, 5);
            expect(cell?.items[1]).toBe(id);
        });

        it('does not move when no entity at source', () => {
            spatial.move(5, 5, 6, 5, 1);
            spatial.commit();
            
            // Nothing should have happened
            const cell = grid.cell(6, 5);
            expect(cell?.items[1]).toBeUndefined();
        });

        it('can move multiple times', () => {
            spatial.spawn('player', 0, 0, 1);
            
            spatial.move(0, 0, 1, 0, 1);
            spatial.commit();
            spatial.move(1, 0, 2, 0, 1);
            spatial.commit();
            spatial.move(2, 0, 3, 0, 1);
            spatial.commit();

            const cell = grid.cell(3, 0);
            expect(cell?.items[1]).toBeDefined();
        });

        it('allows adjacent entities to move in same direction (convoy)', () => {
            const id1 = spatial.spawn('unit', 5, 5, 1);
            const id2 = spatial.spawn('unit', 6, 5, 1);
            const id3 = spatial.spawn('unit', 7, 5, 1);

            // All three units move right
            spatial.move(5, 5, 6, 5, 1);
            spatial.move(6, 5, 7, 5, 1);
            spatial.move(7, 5, 8, 5, 1);
            spatial.commit();

            // All should have moved successfully
            expect(grid.cell(6, 5)?.items[1]).toBe(id1);
            expect(grid.cell(7, 5)?.items[1]).toBe(id2);
            expect(grid.cell(8, 5)?.items[1]).toBe(id3);
            
            // Old positions should be cleaned up
            expect(grid.cell(5, 5)?.items[1]).toBeUndefined();
        });

        it('detects conflicts when two entities want same destination', () => {
            const id1 = spatial.spawn('unit', 5, 5, 1);
            const id2 = spatial.spawn('unit', 5, 7, 1);

            // Both try to move to (5, 6)
            spatial.move(5, 5, 5, 6, 1);
            spatial.move(5, 7, 5, 6, 1);
            spatial.commit();

            // Neither should have moved
            expect(grid.cell(5, 5)?.items[1]).toBe(id1);
            expect(grid.cell(5, 7)?.items[1]).toBe(id2);
            expect(grid.cell(5, 6)?.items[1]).toBeUndefined();
        });
    });

    describe('remove', () => {
        it('removes entity from cell and store', () => {
            const id = spatial.spawn('player', 5, 5, 1);
            const removed = spatial.remove(5, 5, 1);

            expect(removed).toBe(true);
            
            const cell = grid.cell(5, 5);
            expect(cell?.items[1]).toBeUndefined();
            expect(store.getData(id)).toBeUndefined();
        });

        it('returns false when no entity at position', () => {
            const removed = spatial.remove(5, 5, 1);
            expect(removed).toBe(false);
        });

        it('returns false for invalid coordinates', () => {
            const removed = spatial.remove(100, 100, 1);
            expect(removed).toBe(false);
        });
    });

    describe('getEntityIdAt', () => {
        it('returns entity ID at position and layer', () => {
            const id = spatial.spawn('player', 5, 5, 1);
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
            spatial.move(5, 5, 6, 5, 1);
            spatial.commit();

            // Entity should only be in new cell
            expect(grid.cell(5, 5)?.items[1]).toBeUndefined();
            expect(grid.cell(6, 5)?.items[1]).toBe(id);
        });

        it('Rule 2: Entities occupy a layer on a cell', () => {
            const id = spatial.spawn('player', 5, 5, 1);
            const cell = grid.cell(5, 5);
            
            expect(cell?.items[1]).toBe(id);
            expect(cell?.items[0]).toBeUndefined();
            expect(cell?.items[2]).toBeUndefined();
        });

        it('Rule 3: Check destination before moving', () => {
            const playerId = spatial.spawn('player', 5, 5, 1);
            spatial.spawn('wall', 6, 5, 1);

            spatial.move(5, 5, 6, 5, 1);
            spatial.commit();
            
            // Move should not have happened
            expect(grid.cell(5, 5)?.items[1]).toBe(playerId);
        });

        it('Rule 4: Multiple entities per cell on different layers', () => {
            const player = spatial.spawn('player', 5, 5, 1);
            const item = spatial.spawn('item', 5, 5, 2);
            const effect = spatial.spawn('effect', 5, 5, 3);

            const cell = grid.cell(5, 5);
            expect(cell?.items[1]).toBe(player);
            expect(cell?.items[2]).toBe(item);
            expect(cell?.items[3]).toBe(effect);
        });

        it('Rule 6: Clean up old cell on move', () => {
            spatial.spawn('player', 5, 5, 1);
            spatial.move(5, 5, 6, 5, 1);
            spatial.commit();

            const oldCell = grid.cell(5, 5);
            expect(oldCell?.items[1]).toBeUndefined();
        });

        it('Rule 7: Overlap detection, not collision', () => {
            const player = spatial.spawn('player', 5, 5, 1);
            const projectile = spatial.spawn('projectile', 5, 5, 2);

            // Both occupy the same cell - this is overlap
            const overlapping = spatial.getEntityIdsInCell(5, 5);
            expect(overlapping).toContain(player);
            expect(overlapping).toContain(projectile);
        });
    });
});
