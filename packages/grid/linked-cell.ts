import { Direction } from './direction';
import type { ILinkedGrid } from './interfaces';
import { LinkedCellUtils } from './linked-cell-utils';

/**
 * LinkedCell - A grid cell with direct references to its neighbors.
 * 
 * Each cell stores:
 * - Direct references to UP, DOWN, LEFT, RIGHT neighbors (O(1) navigation)
 * - Multiple data layers (values, distances, masks, items, data)
 * - Grid coordinates (x, y)
 * - Reference to parent grid (for geometry algorithms)
 * 
 * The cell provides:
 * - Navigation methods (move, neighbor, look)
 * - Geometry algorithms (raycast, getLine, getCircle, fieldOfView)
 * - Pathfinding (find, findPath, setDistance)
 * - Lighting (propagateLight, applyFogOfWar)
 * 
 * All values are constrained to numbers for simplicity.
 * 
 * @example
 * ```typescript
 * // Navigation
 * const cell = grid.cell(5, 5);
 * const right = cell.move(Direction.RT);
 * const twoUp = cell.move(Direction.UP, 2);
 * 
 * // Raycasting
 * const ray = cell.raycast(Direction.RT, 10, c => c.values[0] === WALL);
 * 
 * // Pathfinding
 * const path = cell.findPath(
 *   c => c?.values[0] !== WALL,  // passFn
 *   c => c === targetCell         // matchFn
 * );
 * ```
 */
export class LinkedCell {

    /** Direct references to neighbors [UP-1, DN-1, LT-1, RT-1] (Direction enum - 1) */
    _neighbors: (LinkedCell | null)[] = [];

    /** Numeric game state values, one per layer (e.g., layer 0: terrain, layer 1: items) */
    _values: (number | undefined)[] = [];

    get values(): (number | undefined)[] {
        return this._values;
    }

    /** Numeric values for distance fields, pathfinding costs, light intensity, etc. */
    distances: number[] = [];

    /** Boolean masks for collision, visibility, walkability, etc. */
    masks: boolean[] = [];

    /** BFS visited flag (used internally by pathfinding, cleaned up after) */
    _visited: boolean = false;

    /** BFS previous cell pointer (used internally by pathfinding, cleaned up after) */
    _prev: LinkedCell | null = null;

    /** Grid X coordinate (0-indexed column) - set by LinkedGrid */
    x: number = -1;

    /** Grid Y coordinate (0-indexed row) - set by LinkedGrid */
    y: number = -1;

    /** Reference to parent grid - required for geometry methods - set by LinkedGrid */
    _grid: ILinkedGrid | null = null;

    /**
     * Create a new LinkedCell.
     * 
     * Typically cells are created by LinkedGrid, not manually.
     * If creating manually, you must set neighbors yourself.
     * 
     * @param up - Cell above (or null for edge)
     * @param down - Cell below (or null for edge)
     * @param left - Cell to the left (or null for edge)
     * @param right - Cell to the right (or null for edge)
     */
    constructor(up: LinkedCell | null = null, down: LinkedCell | null = null, left: LinkedCell | null = null, right: LinkedCell | null = null) {
        this.setNeighbor(Direction.UP, up);
        this.setNeighbor(Direction.DN, down);
        this.setNeighbor(Direction.LT, left);
        this.setNeighbor(Direction.RT, right);
    }

    /**
     * Get value at a layer.
     * 
     * @param layer - Layer index (0-based)
     * @returns Value at layer
     * 
     * @example
     * ```typescript
     * const value = cell.getValue(0);
     * ```
     */
    getValue(layer: number): (number | undefined) {
        return this.values[layer];
    }

    /**
     * Set value at a layer.
     * 
     * @param layer - Layer index (0-based)
     * @param val - Value to store
     * @returns this for chaining
     * 
     * @example
     * ```typescript
     * cell.setValue(0, WALL)
     *     .setValue(1, COIN)
     *     .setMask(0, false);  // Not walkable
     * ```
     */
    setValue(layer: number, val: (number | undefined)) {
        this.values[layer] = val;
        return this;
    }

    /**
     * Clear value at a layer.
     * 
     * @param layer - Layer index (0-based)
     * @returns this for chaining
     * 
     * @example
     * ```typescript
     * cell.clearValue(0);
     * ```
     */
    clearValue(layer: number) {
        this.values[layer] = undefined;
        return this;
    }

    /**
     * Clear all values.
     */
    clearValues() {
        this._values = [];
        return this;
    }

    /**
     * Set boolean mask at a layer.
     * 
     * @param layer - Layer index (0-based)
     * @param val - Boolean value
     * @returns this for chaining
     */
    setMask(layer: number, val: boolean) {
        this.masks[layer] = val;
        return this;
    }

    /**
     * Move N steps in a direction via neighbor links.
     * 
     * This is the core navigation method - O(n) where n is number of steps.
     * Returns null if path goes off grid edge (or wraps if grid has wrapping enabled).
     * 
     * @param dir - Direction to move (UP, DN, LT, RT)
     * @param num - Number of steps to take (default 1)
     * @returns The destination cell, or null if off grid
     * 
     * @example
     * ```typescript
     * const cell = grid.cell(5, 5);
     * const right3 = cell.move(Direction.RT, 3);  // Cell at (8, 5)
     * const up = cell.move(Direction.UP);          // Cell at (5, 4)
     * ```
     */
    move(dir: Direction, num = 1): LinkedCell | null {
        let lc = this._neighbors[dir - 1];
        while (--num && lc?._neighbors[dir - 1]) {
            lc = lc._neighbors[dir - 1];
        }
        return lc;
    }

    /**
     * Find first cell in a direction matching a predicate.
     * 
     * Walks in the given direction until matchFn returns true or grid edge is reached.
     * 
     * @param matchFn - Predicate function to test cells
     * @param dir - Direction to search
     * @returns First matching cell, or null if none found
     * 
     * @example
     * ```typescript
     * // Find first wall to the right
     * const wall = cell.look(c => c.values[0] === WALL, Direction.RT);
     * 
     * // Find first empty cell upward
     * const empty = cell.look(c => c.values[0] === EMPTY, Direction.UP);
     * ```
     */
    look(matchFn: (lc: LinkedCell) => boolean, dir: Direction): LinkedCell | null {
        let lc = this._neighbors[dir - 1];
        while (lc && !matchFn(lc)) {
            lc = lc._neighbors[dir - 1];
        }
        return lc;
    }

    /**
     * Get all 4 neighbors as an array.
     * 
     * @returns Array of [UP, DN, LT, RT] neighbors (null for edges)
     * 
     * @example
     * ```typescript
     * const neighbors = cell.neighbors();
     * const validNeighbors = neighbors.filter(n => n !== null);
     * ```
     */
    neighbors(): (LinkedCell | null)[] {
        return this._neighbors;
    }

    /**
     * Get neighbor in a specific direction.
     * 
     * @param dir - Direction (UP, DN, LT, RT)
     * @returns Neighbor cell, or null if at grid edge (or wrapped if grid has wrapping)
     * 
     * @example
     * ```typescript
     * const above = cell.neighbor(Direction.UP);
     * if (above) {
     *   console.log('Cell above exists');
     * }
     * ```
     */
    neighbor(dir: Direction): LinkedCell | null {
        return this._neighbors[dir - 1];
    }

    /**
     * Set neighbor in a direction (used by LinkedGrid during initialization).
     * 
     * @param dir - Direction to set neighbor for
     * @param n - The neighbor cell (or null for edge)
     * @returns this for chaining
     */
    setNeighbor(dir: Direction, n: LinkedCell | null) {
        this._neighbors[dir - 1] = n;
        return this;
    }

    /**
    /**
     * Cast a ray in a cardinal direction until blocked or max distance.
     */
    raycast(
        dir: Direction,
        maxDist = 10,
        blockFn: (lc: LinkedCell) => boolean = () => false
    ): { cells: LinkedCell[], blocked: boolean, hitCell: LinkedCell | null } {
        return LinkedCellUtils.raycast(this, dir, maxDist, blockFn);
    }

    /**
     * Get all cells along a line to target using Bresenham's algorithm.
     */
    getLine(target: LinkedCell): LinkedCell[] {
        return LinkedCellUtils.getLine(this, target);
    }

    /**
     * Get all cells within a circular radius (Euclidean distance).
     */
    getCircle(radius: number): LinkedCell[] {
        return LinkedCellUtils.getCircle(this, radius);
    }

    /**
     * Compute field of view using ray-casting.
     */
    fieldOfView(
        radius: number,
        blockFn: (lc: LinkedCell) => boolean = () => false
    ): LinkedCell[] {
        return LinkedCellUtils.fieldOfView(this, radius, blockFn);
    }

    /**
     * Compute field of view within a cone (directional vision).
     */
    fieldOfViewCone(
        radius: number,
        direction: number,
        spread: number,
        blockFn: (lc: LinkedCell) => boolean = () => false
    ): LinkedCell[] {
        return LinkedCellUtils.fieldOfViewCone(this, radius, direction, spread, blockFn);
    }

    /**
     * Propagate light from this cell with intensity falloff.
     */
    propagateLight(
        intensity: number,
        falloff: number,
        distanceLayer = 0,
        blockFn: (lc: LinkedCell) => boolean = () => false
    ): void {
        LinkedCellUtils.propagateLight(this, intensity, falloff, distanceLayer, blockFn);
    }

    /**
     * Apply fog of war visibility state using mask layers.
     */
    applyFogOfWar(
        radius: number,
        blockFn: (lc: LinkedCell) => boolean = () => false,
        visibleMask = 4,
        revealedMask = 5
    ): void {
        LinkedCellUtils.applyFogOfWar(this, radius, blockFn, visibleMask, revealedMask);
    }

    /**
     * Find cells matching a predicate using BFS (breadth-first search).
     */
    find(
        passFn: (lc: LinkedCell | null) => boolean,
        matchFn: (lc: LinkedCell | null) => boolean,
        maxRange = 10,
        findLimit = 1
    ): { cell: LinkedCell, dist: number }[] {
        return LinkedCellUtils.find(this, passFn, matchFn, maxRange, findLimit);
    }

    /**
     * Find shortest path to a target using BFS pathfinding.
     */
    findPath(
        passFn: (lc: LinkedCell | null) => boolean,
        matchFn: (lc: LinkedCell | null) => boolean,
        maxRange = 10
    ): LinkedCell[] {
        return LinkedCellUtils.findPath(this, passFn, matchFn, maxRange);
    }

    /**
     * Get all neighbors within a range using BFS expansion.
     */
    getNeighborsWithinRange(
        passFn: (lc: LinkedCell | null) => boolean,
        maxRange = 1
    ): { cell: LinkedCell, dist: number }[] {
        return LinkedCellUtils.getNeighborsWithinRange(this, passFn, maxRange);
    }

    /**
     * Flood-fill distance values from this cell outward (Dijkstra map).
     */
    setDistance(
        passFn: (lc: LinkedCell | null) => boolean,
        distLayer = 0,
        dist = 1,
        doAdd = false,
        maxRange = 50
    ) {
        LinkedCellUtils.setDistance(this, passFn, distLayer, dist, doAdd, maxRange);
    }
}
