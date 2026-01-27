import { LinkedCell, LinkedGrid } from '../grid';
import { SparseEntityStore } from './entity-store';
import type { EntityData, Layer } from './types';

/**
 * SpatialSystem - Spatial operations for the Spartan framework.
 * 
 * Architecture B: Cell-centric operations where cells are the primary
 * storage for entity positions via cell.values[layer].
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
 * Movement system:
 * - Uses two-phase commit for atomic movement resolution
 * - Call move() to record movement intents
 * - Call commit() to execute all pending moves
 * - Allows adjacent entities to move together without blocking
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
 * // Record movement intent and execute
 * spatial.move(10, 10, 11, 10, 1);
 * spatial.commit();
 * 
 * // Query entities in radius
 * const nearby = spatial.getEntityIdsInRadius(11, 10, 3);
 * ```
 * 
 * @example
 * ```typescript
 * // Convoy movement - adjacent entities move together
 * spatial.spawn('unit', 5, 5, 1);
 * spatial.spawn('unit', 6, 5, 1);
 * spatial.spawn('unit', 7, 5, 1);
 * 
 * // All units move right simultaneously
 * spatial.move(5, 5, 6, 5, 1);
 * spatial.move(6, 5, 7, 5, 1);
 * spatial.move(7, 5, 8, 5, 1);
 * spatial.commit(); // All three move successfully
 * ```
 */
export class SpatialSystem {
    /** Pending movement intents to be resolved on commit */
    private pendingMoves: Array<{
        entityId: number;
        fromX: number;
        fromY: number;
        toX: number;
        toY: number;
        layer: Layer;
        blockFn?: (cell: LinkedCell | null) => boolean;
    }> = [];

    /** Entity position tracking: entity ID → {x, y, layer} */
    private positions: Map<number, {x: number, y: number, layer: Layer}> = new Map();

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
     * Creates entity metadata in store and writes ID to cell.values[layer].
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
        if (cell.getValue(layer) !== undefined) {
            throw new Error(`Layer ${layer} at (${x}, ${y}) is already occupied by entity ${cell.getValue(layer)}`);
        }

        // Create entity in store
        const entityId = this.store.createId(type, props);

        // Write to cell layer (Rule 2: entities occupy a layer)
        cell.setValue(layer, entityId);

        // Track entity position
        this.positions.set(entityId, { x, y, layer });

        return entityId;
    }

    /**
     * Record an intent to move an entity from one cell to another on the same layer.
     * 
     * The move is not executed immediately - call commit() to resolve all pending
     * movements atomically. This allows adjacent entities to move in the same
     * direction without blocking each other.
     * 
     * @param fromX - Source X coordinate
     * @param fromY - Source Y coordinate
     * @param toX - Destination X coordinate
     * @param toY - Destination Y coordinate
     * @param layer - Layer the entity occupies
     * @param blockFn - Optional function to check if destination is blocked
     * 
     * @example
     * ```typescript
     * // Record movement intents for a convoy
     * spatial.move(5, 5, 6, 5, 1);
     * spatial.move(6, 5, 7, 5, 1);
     * spatial.move(7, 5, 8, 5, 1);
     * 
     * // Execute all moves atomically
     * spatial.commit();
     * ```
     * 
     * @example
     * ```typescript
     * // Use blocking function for collision detection
     * import { isBlocked } from './layer-utils';
     * const emptyFloorsBlock = true;
     * spatial.move(5, 5, 6, 5, GameLayers.ACTORS, 
     *   (cell) => isBlocked(cell, emptyFloorsBlock)
     * );
     * spatial.commit();
     * ```
     */
    move(
        fromX: number, 
        fromY: number, 
        toX: number, 
        toY: number, 
        layer: Layer,
        blockFn?: (cell: LinkedCell | null) => boolean
    ): void {
        const fromCell = this.grid.cell(fromX, fromY);
        const toCell = this.grid.cell(toX, toY);

        // Validate coordinates are in bounds
        if (!fromCell || !toCell) {
            return; // Invalid coordinates - silently ignore
        }

        const entityId = fromCell.getValue(layer);
        if (entityId === undefined) {
            return; // No entity at source - silently ignore
        }

        // Record the intent
        this.pendingMoves.push({
            entityId,
            fromX,
            fromY,
            toX,
            toY,
            layer,
            blockFn
        });
    }

    /**
     * Execute all pending movement intents using two-phase commit logic.
     * 
     * Phase 1 - Validation:
     * - Build set of cells being vacated by moves
     * - Check each move's destination is empty OR being vacated
     * - Detect conflicts (two entities want same destination)
     * 
     * Phase 2 - Execution:
     * - Apply all valid moves atomically
     * - Clear pending moves array
     * 
     * This allows convoys of adjacent entities to move together without
     * order-dependent blocking.
     * 
     * @example
     * ```typescript
     * // Move a convoy of units right
     * spatial.move(5, 5, 6, 5, 1);
     * spatial.move(6, 5, 7, 5, 1);
     * spatial.move(7, 5, 8, 5, 1);
     * spatial.commit(); // All three move successfully
     * ```
     */
    commit(): void {
        if (this.pendingMoves.length === 0) {
            return;
        }

        // Phase 1: Validation
        const sources = new Set<string>();
        const destinations = new Map<string, number[]>(); // Map destination to list of entity indices trying to move there
        const validMoves: boolean[] = [];

        // Build set of cells being vacated
        for (const move of this.pendingMoves) {
            const key = `${move.fromX},${move.fromY},${move.layer}`;
            sources.add(key);
        }

        // Collect all destination requests
        for (let i = 0; i < this.pendingMoves.length; i++) {
            const move = this.pendingMoves[i];
            const destKey = `${move.toX},${move.toY},${move.layer}`;
            
            if (!destinations.has(destKey)) {
                destinations.set(destKey, []);
            }
            destinations.get(destKey)!.push(i);
        }

        // Validate each move
        for (let i = 0; i < this.pendingMoves.length; i++) {
            const move = this.pendingMoves[i];
            const destKey = `${move.toX},${move.toY},${move.layer}`;
            const toCell = this.grid.cell(move.toX, move.toY);

            if (!toCell) {
                validMoves.push(false);
                continue;
            }

            // Check custom blocking function if provided
            if (move.blockFn && move.blockFn(toCell)) {
                validMoves.push(false);
                continue;
            }

            // Check if destination is occupied
            const isOccupied = toCell.getValue(move.layer) !== undefined;
            const isBeingVacated = sources.has(destKey);
            
            // Check for conflicts (multiple entities want same destination)
            const requestsForThisDest = destinations.get(destKey) || [];
            const hasConflict = requestsForThisDest.length > 1;

            if (hasConflict || (isOccupied && !isBeingVacated)) {
                validMoves.push(false);
            } else {
                validMoves.push(true);
            }
        }

        // Phase 2: Execution
        // First, clear all source cells for VALID moves
        for (let i = 0; i < this.pendingMoves.length; i++) {
            if (validMoves[i]) {
                const move = this.pendingMoves[i];
                const fromCell = this.grid.cell(move.fromX, move.fromY);
                if (fromCell) {
                    fromCell.clearValue(move.layer);
                }
            }
        }

        // Then, write all entities to their destinations for VALID moves
        for (let i = 0; i < this.pendingMoves.length; i++) {
            if (validMoves[i]) {
                const move = this.pendingMoves[i];
                const toCell = this.grid.cell(move.toX, move.toY);
                if (toCell) {
                    toCell.setValue(move.layer, move.entityId);
                    // Update position tracking
                    this.positions.set(move.entityId, {
                        x: move.toX,
                        y: move.toY,
                        layer: move.layer
                    });
                }
            }
        }

        // Clear pending moves
        this.pendingMoves = [];
    }

    /**
     * Clear all pending movement intents without executing them.
     * 
     * Useful for canceling movements or resetting state in tests.
     * 
     * @example
     * ```typescript
     * spatial.move(5, 5, 6, 5, 1);
     * spatial.clearIntents(); // Movement is canceled
     * ```
     */
    clearIntents(): void {
        this.pendingMoves = [];
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

        const entityId = cell.getValue(layer);
        if (entityId === undefined) {
            return false;
        }

        // Clean up cell
        cell.clearValue(layer);

        // Remove from store
        this.store.remove(entityId);

        // Remove position tracking
        this.positions.delete(entityId);

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
        return cell?.getValue(layer);
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
        for (const id of cell.values) {
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
            for (const id of c.values) {
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
            for (const id of cell.values) {
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
     * Get the grid position of an entity by ID.
     * 
     * Returns null if entity is not currently on the grid.
     * Entities can exist in the store without grid positions
     * (e.g., during animations, transitions, or as UI elements).
     * 
     * @param id - Entity ID
     * @returns Position with x, y, and layer, or null if not on grid
     * 
     * @example
     * ```typescript
     * const pos = spatial.getEntityPosition(playerId);
     * if (pos) {
     *   console.log(`Player at (${pos.x}, ${pos.y}) on layer ${pos.layer}`);
     * }
     * ```
     */
    getEntityPosition(id: number): {x: number, y: number, layer: Layer} | null {
        return this.positions.get(id) ?? null;
    }

    /**
     * Get all tracked entity positions.
     * 
     * Used for overlap detection and iteration over all entities.
     * Returns an iterator of [entityId, {x, y, layer}] entries.
     * 
     * @returns Iterator of entity positions
     * 
     * @example
     * ```typescript
     * for (const [entityId, pos] of spatial.getAllPositions()) {
     *   console.log(`Entity ${entityId} at (${pos.x}, ${pos.y})`);
     * }
     * ```
     */
    getAllPositions(): IterableIterator<[number, {x: number, y: number, layer: Layer}]> {
        return this.positions.entries();
    }

    /**
     * Detect all overlaps (multiple entities at same position).
     * 
     * Returns positions with 2+ entities across all layers.
     * Used by game loop for overlap-based mechanics (items, triggers, etc.).
     * 
     * @returns Array of overlaps
     * 
     * @example
     * ```typescript
     * const overlaps = spatial.detectOverlaps();
     * for (const overlap of overlaps) {
     *   console.log(`${overlap.entityIds.length} entities at (${overlap.position.x}, ${overlap.position.y})`);
     * }
     * ```
     */
    detectOverlaps(): Array<{position: {x: number, y: number}, entityIds: number[]}> {
        const overlaps: Array<{position: {x: number, y: number}, entityIds: number[]}> = [];
        const checked = new Set<string>();
        
        for (const [_, pos] of this.getAllPositions()) {
            const key = `${pos.x},${pos.y}`;
            if (checked.has(key)) continue;
            checked.add(key);
            
            const entities = this.getEntityIdsInCell(pos.x, pos.y);
            if (entities.length > 1) {
                overlaps.push({
                    position: { x: pos.x, y: pos.y },
                    entityIds: entities
                });
            }
        }
        
        return overlaps;
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
