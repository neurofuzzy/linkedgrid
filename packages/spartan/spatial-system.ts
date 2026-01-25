import { LinkedGrid } from '../grid/linked-grid';
import { SparseEntityStore } from './entity-store';
import type { EntityData, Layer } from './types';

/**
 * SpatialSystem - Spatial operations for the Spartan framework.
 * 
 * Architecture B: Cell-centric operations where cells are the primary
 * storage for entity positions via cell.items[layer].
 * 
 * Core principles:
 * - Entities occupy one cell at a time (Rule 1)
 * - Entities occupy a layer on a cell (Rule 2)
 * - Check destination before moving (Rule 3)
 * - Multiple entities per cell via different layers (Rule 4)
 * - Spatial queries are first-class (Rule 5)
 * - Clean up old cell on move (Rule 6)
 * - Overlap detection, not collision (Rule 7)
 * 
 * @example
 * ```typescript
 * const grid = new LinkedGrid(20, 20);
 * const store = new SparseEntityStore();
 * const spatial = new SpatialSystem(grid, store);
 * 
 * // Spawn player at (10, 10) on layer 1
 * const playerId = spatial.spawn('player', 10, 10, 1, { hp: 100 });
 * 
 * // Move player right
 * const moved = spatial.move(10, 10, 11, 10, 1);
 * 
 * // Query entities in radius
 * const nearby = spatial.getEntityIdsInRadius(11, 10, 3);
 * ```
 */
export class SpatialSystem {
    /**
     * Create a new SpatialSystem.
     * 
     * @param grid - The LinkedGrid for spatial operations
     * @param store - The SparseEntityStore for entity metadata
     */
    constructor(
        private grid: LinkedGrid,
        private store: SparseEntityStore
    ) {}

    /**
     * Spawn a new entity at a position and layer.
     * 
     * Creates entity metadata in store and writes ID to cell.items[layer].
     * 
     * @param type - Entity type identifier
     * @param x - X coordinate (column)
     * @param y - Y coordinate (row)
     * @param layer - Layer index to occupy
     * @param props - Optional additional entity properties
     * @returns The newly created entity ID
     * @throws Error if coordinates are invalid or layer is occupied
     * 
     * @example
     * ```typescript
     * const player = spatial.spawn('player', 5, 5, 1, { hp: 100 });
     * const enemy = spatial.spawn('enemy', 10, 10, 2, { hp: 50 });
     * ```
     */
    spawn(type: string, x: number, y: number, layer: Layer, props?: Record<string, unknown>): number {
        const cell = this.grid.cell(x, y);
        if (!cell) {
            throw new Error(`Invalid coordinates: (${x}, ${y})`);
        }

        // Rule 3: Check if destination layer is occupied
        if (cell.items[layer] !== undefined) {
            throw new Error(`Layer ${layer} at (${x}, ${y}) is already occupied by entity ${cell.items[layer]}`);
        }

        // Create entity in store
        const entityId = this.store.createId(type, props);

        // Write to cell layer (Rule 2: entities occupy a layer)
        cell.items[layer] = entityId;

        return entityId;
    }

    /**
     * Move an entity from one cell to another on the same layer.
     * 
     * Validates destination is unoccupied, then atomically updates both cells.
     * 
     * @param fromX - Source X coordinate
     * @param fromY - Source Y coordinate
     * @param toX - Destination X coordinate
     * @param toY - Destination Y coordinate
     * @param layer - Layer the entity occupies
     * @returns true if move succeeded, false if destination occupied or invalid
     * 
     * @example
     * ```typescript
     * // Move entity right by one cell
     * if (spatial.move(5, 5, 6, 5, 1)) {
     *   console.log('Moved successfully');
     * } else {
     *   console.log('Move blocked');
     * }
     * ```
     */
    move(fromX: number, fromY: number, toX: number, toY: number, layer: Layer): boolean {
        const fromCell = this.grid.cell(fromX, fromY);
        const toCell = this.grid.cell(toX, toY);

        if (!fromCell || !toCell) {
            return false; // Invalid coordinates
        }

        const entityId = fromCell.items[layer];
        if (entityId === undefined) {
            return false; // No entity at source
        }

        // Rule 3: Check if destination is occupied
        if (toCell.items[layer] !== undefined) {
            return false; // Destination occupied
        }

        // Atomic move
        toCell.items[layer] = entityId;
        
        // Rule 6: Clean up old cell
        fromCell.items[layer] = undefined;

        return true;
    }

    /**
     * Remove an entity from a cell and destroy its data.
     * 
     * Cleans up both the cell layer and the entity store.
     * 
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param layer - Layer the entity occupies
     * @returns true if entity was removed, false if not found
     * 
     * @example
     * ```typescript
     * // Remove entity (e.g., projectile hit)
     * spatial.remove(10, 10, 3);
     * ```
     */
    remove(x: number, y: number, layer: Layer): boolean {
        const cell = this.grid.cell(x, y);
        if (!cell) {
            return false;
        }

        const entityId = cell.items[layer];
        if (entityId === undefined) {
            return false;
        }

        // Clean up cell
        cell.items[layer] = undefined;

        // Remove from store
        this.store.remove(entityId);

        return true;
    }

    /**
     * Get entity ID at a specific position and layer.
     * 
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param layer - Layer to check
     * @returns Entity ID if present, undefined otherwise
     * 
     * @example
     * ```typescript
     * const entityId = spatial.getEntityIdAt(5, 5, 1);
     * if (entityId !== undefined) {
     *   console.log(`Found entity ${entityId}`);
     * }
     * ```
     */
    getEntityIdAt(x: number, y: number, layer: Layer): number | undefined {
        const cell = this.grid.cell(x, y);
        return cell?.items[layer];
    }

    /**
     * Get all entity IDs in a cell across all layers.
     * 
     * Rule 7: This enables overlap detection - multiple entities can
     * occupy the same cell on different layers.
     * 
     * @param x - X coordinate
     * @param y - Y coordinate
     * @returns Array of entity IDs (may be empty)
     * 
     * @example
     * ```typescript
     * // Detect overlaps for area damage
     * const entities = spatial.getEntityIdsInCell(5, 5);
     * for (const id of entities) {
     *   const data = spatial.getEntityData(id);
     *   if (data.type === 'player' || data.type === 'enemy') {
     *     applyDamage(id, 10);
     *   }
     * }
     * ```
     */
    getEntityIdsInCell(x: number, y: number): number[] {
        const cell = this.grid.cell(x, y);
        if (!cell) {
            return [];
        }

        const ids: number[] = [];
        for (const id of cell.items) {
            if (id !== undefined) {
                ids.push(id);
            }
        }
        return ids;
    }

    /**
     * Get all entity IDs within a circular radius (Euclidean distance).
     * 
     * Rule 5: Spatial queries for area effects, vision, etc.
     * 
     * @param x - Center X coordinate
     * @param y - Center Y coordinate
     * @param radius - Radius in cells
     * @returns Array of entity IDs within radius
     * 
     * @example
     * ```typescript
     * // Find enemies near player
     * const nearby = spatial.getEntityIdsInRadius(playerX, playerY, 5);
     * for (const id of nearby) {
     *   const data = spatial.getEntityData(id);
     *   if (data.type === 'enemy') {
     *     console.log(`Enemy ${id} nearby!`);
     *   }
     * }
     * ```
     */
    getEntityIdsInRadius(x: number, y: number, radius: number): number[] {
        const cell = this.grid.cell(x, y);
        if (!cell) {
            return [];
        }

        const cells = cell.getCircle(radius);
        const ids: number[] = [];
        
        for (const c of cells) {
            for (const id of c.items) {
                if (id !== undefined) {
                    ids.push(id);
                }
            }
        }

        return ids;
    }

    /**
     * Get all entity IDs along a line between two points.
     * 
     * Uses Bresenham's line algorithm. Useful for line-of-sight,
     * projectile paths, etc.
     * 
     * @param x0 - Start X coordinate
     * @param y0 - Start Y coordinate
     * @param x1 - End X coordinate
     * @param y1 - End Y coordinate
     * @returns Array of entity IDs along the line
     * 
     * @example
     * ```typescript
     * // Check if shot is blocked
     * const entitiesInLine = spatial.getEntityIdsInLine(
     *   shooterX, shooterY,
     *   targetX, targetY
     * );
     * 
     * for (const id of entitiesInLine) {
     *   const data = spatial.getEntityData(id);
     *   if (data.type === 'wall') {
     *     console.log('Shot blocked by wall');
     *     break;
     *   }
     * }
     * ```
     */
    getEntityIdsInLine(x0: number, y0: number, x1: number, y1: number): number[] {
        const cells = this.grid.getLine(x0, y0, x1, y1);
        const ids: number[] = [];

        for (const cell of cells) {
            for (const id of cell.items) {
                if (id !== undefined) {
                    ids.push(id);
                }
            }
        }

        return ids;
    }

    /**
     * Get full entity data by ID.
     * 
     * Convenience method that delegates to the store.
     * 
     * @param id - Entity ID
     * @returns Entity data, or undefined if not found
     * 
     * @example
     * ```typescript
     * const data = spatial.getEntityData(playerId);
     * if (data) {
     *   console.log(`${data.type} at position`);
     * }
     * ```
     */
    getEntityData(id: number): EntityData | undefined {
        return this.store.getData(id);
    }

    /**
     * Get the grid used by this spatial system.
     * 
     * @returns The LinkedGrid instance
     */
    getGrid(): LinkedGrid {
        return this.grid;
    }

    /**
     * Get the entity store used by this spatial system.
     * 
     * @returns The SparseEntityStore instance
     */
    getStore(): SparseEntityStore {
        return this.store;
    }
}
