/**
 * @brief Single node in the LinkedGrid graph with neighbor connections.
 */
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
 * const right = cell.move(Direction.RIGHT);
 * const twoUp = cell.move(Direction.UP, 2);
 *
 * // Raycasting
 * const ray = cell.raycast(Direction.RIGHT, 10, c => c.values[0] === WALL);
 *
 * // Pathfinding
 * const path = cell.findPath(
 *   c => c?.values[0] !== WALL,  // passFn
 *   c => c === targetCell         // matchFn
 * );
 * ```
 */
export class LinkedCell {
  /** Maximum number of layers (8-layer system: 0-7) */
  private static readonly MAX_LAYERS = 8;

  /** Direct references to neighbors [UP-1, DN-1, LT-1, RT-1] (Direction enum - 1) */
  private _neighbors: (LinkedCell | null)[] = [];

  /** Numeric game state values, one per layer (e.g., layer 0: terrain, layer 1: items) */
  private _values: (number | undefined)[] = [];

  get values(): (number | undefined)[] {
    return this._values;
  }

  /** Numeric values for distance fields, pathfinding costs, light intensity, etc. */
  private _distances: number[] = [];
  get distances(): number[] {
    return this._distances;
  }

  /** Boolean masks for collision, visibility, walkability, etc. */
  private _masks: boolean[] = [];
  get masks(): boolean[] {
    return this._masks;
  }

  /** Grid X coordinate (0-indexed column) - set by LinkedGrid */
  private _x: number = -1;

  get x(): number {
    return this._x;
  }

  /** Grid Y coordinate (0-indexed row) - set by LinkedGrid */
  private _y: number = -1;

  get y(): number {
    return this._y;
  }

  /** Reference to parent grid - required for geometry methods */
  private _grid: ILinkedGrid;

  get grid(): ILinkedGrid {
    return this._grid;
  }

  /**
   * Create a new LinkedCell.
   *
   * Typically cells are created by LinkedGrid, not manually.
   * If creating manually, you must set neighbors yourself.
   *
   * @param {ILinkedGrid} _grid- Reference to parent grid
   * @returns {LinkedCell} - The new LinkedCell instance
   *
   * @example
   * ```typescript
   * const cell = new LinkedCell(grid);
   * ```
   */
  constructor(_grid: ILinkedGrid, x: number, y: number) {
    this._grid = _grid;
    this._x = x;
    this._y = y;
  }

  /**
   * Get value at a layer.
   *
   * @param {number} layer - Layer index (0-based)
   * @returns {(number | undefined)} Value at layer
   * @throws {RangeError} If layer index is out of bounds (0-7)
   *
   * @example
   * ```typescript
   * const value = cell.getValue(0);
   * ```
   */
  getValue(layer: number): number | undefined {
    if (layer < 0 || layer >= LinkedCell.MAX_LAYERS) {
      throw new RangeError(
        `Layer index ${layer} out of bounds (0-${LinkedCell.MAX_LAYERS - 1})`
      );
    }
    return this.values[layer];
  }

  /**
   * Set value at a layer.
   *
   * @param {number} layer - Layer index (0-based)
   * @param {(number | undefined)} val - Value to store
   * @returns this for chaining
   * @throws {RangeError} If layer index is out of bounds (0-7)
   *
   * @example
   * ```typescript
   * cell.setValue(0, WALL)
   *     .setValue(1, COIN)
   *     .setMask(0, false);  // Not walkable
   * ```
   */
  setValue(layer: number, val: number | undefined) {
    if (layer < 0 || layer >= LinkedCell.MAX_LAYERS) {
      throw new RangeError(
        `Layer index ${layer} out of bounds (0-${LinkedCell.MAX_LAYERS - 1})`
      );
    }
    this._values[layer] = val;
    return this;
  }

  /**
   * Clear value at a layer.
   *
   * @param {number} layer - Layer index (0-based)
   * @returns this for chaining
   * @throws {RangeError} If layer index is out of bounds (0-7)
   *
   * @example
   * ```typescript
   * cell.clearValue(0);
   * ```
   */
  clearValue(layer: number) {
    if (layer < 0 || layer >= LinkedCell.MAX_LAYERS) {
      throw new RangeError(
        `Layer index ${layer} out of bounds (0-${LinkedCell.MAX_LAYERS - 1})`
      );
    }
    this._values[layer] = undefined;
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
   * Get mask at a layer.
   *
   * @param {number} layer - Layer index (0-based)
   * @returns {boolean} Mask at layer
   * @throws {RangeError} If layer index is out of bounds (0-7)
   *
   * @example
   * ```typescript
   * const mask = cell.getMask(0);
   * ```
   */
  getMask(layer: number): boolean {
    if (layer < 0 || layer >= LinkedCell.MAX_LAYERS) {
      throw new RangeError(
        `Layer index ${layer} out of bounds (0-${LinkedCell.MAX_LAYERS - 1})`
      );
    }
    return this._masks[layer];
  }

  /**
   * Set boolean mask at a layer.
   *
   * @param {number} layer - Layer index (0-based)
   * @param {boolean} val - Boolean value
   * @returns this for chaining
   * @throws {RangeError} If layer index is out of bounds (0-7)
   */
  setMask(layer: number, val: boolean) {
    if (layer < 0 || layer >= LinkedCell.MAX_LAYERS) {
      throw new RangeError(
        `Layer index ${layer} out of bounds (0-${LinkedCell.MAX_LAYERS - 1})`
      );
    }
    this._masks[layer] = val;
    return this;
  }

  /**
   * Get distance at a layer.
   *
   * @param {number} layer - Layer index (0-based)
   * @returns {number} Distance at layer
   * @throws {RangeError} If layer index is out of bounds (0-7)
   *
   * @example
   * ```typescript
   * const distance = cell.getDistance(0);
   * ```
   */
  getDistance(layer: number): number {
    if (layer < 0 || layer >= LinkedCell.MAX_LAYERS) {
      throw new RangeError(
        `Layer index ${layer} out of bounds (0-${LinkedCell.MAX_LAYERS - 1})`
      );
    }
    return this._distances[layer];
  }

  /**
   * Move N steps in a direction via neighbor links.
   *
   * This is the core navigation method - O(n) where n is number of steps.
   * Returns null if path goes off grid edge (or wraps if grid has wrapping enabled).
   *
   * @param {Direction} dir - Direction to move (UP, DN, LT, RT)
   * @param {number} num - Number of steps to take (default 1)
   * @returns {LinkedCell | null} The destination cell, or null if off grid
   *
   * @example
   * ```typescript
   * const cell = grid.cell(5, 5);
   * const right3 = cell.move(Direction.RIGHT, 3);  // Cell at (8, 5)
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
   * @param {(lc: LinkedCell) => boolean} matchFn - Predicate function to test cells
   * @param {Direction} dir - Direction to search
   * @returns First matching cell, or null if none found
   *
   * @example
   * ```typescript
   * // Find first wall to the right
   * const wall = cell.look(c => c.values[0] === WALL, Direction.RIGHT);
   *
   * // Find first empty cell upward
   * const empty = cell.look(c => c.values[0] === EMPTY, Direction.UP);
   * ```
   */
  look(
    matchFn: (lc: LinkedCell) => boolean,
    dir: Direction
  ): LinkedCell | null {
    let lc = this._neighbors[dir - 1];
    while (lc && !matchFn(lc)) {
      lc = lc._neighbors[dir - 1];
    }
    return lc;
  }

  /**
   * Get all 4 neighbors as an array.
   *
   * @returns {LinkedCell[]} Array of [UP, DN, LT, RT] neighbors (null for edges)
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
   * @param {Direction} dir - Direction (UP, DN, LT, RT)
   * @returns {LinkedCell | null} Neighbor cell, or null if at grid edge (or wrapped if grid has wrapping)
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
   * @param {Direction} dir - Direction to set neighbor for
   * @param {LinkedCell | null} n - The neighbor cell (or null for edge)
   * @returns this for chaining
   */
  setNeighbor(dir: Direction, n: LinkedCell | null) {
    this._neighbors[dir - 1] = n;
    return this;
  }

  /**
    /**
     * Cast a ray in a cardinal direction until blocked or max distance.
     * 
     * @param {Direction} dir - Direction to cast ray
     * @param {number} maxDist - Maximum distance to cast ray
     * @param {(lc: LinkedCell) => boolean} blockFn - Function to check if cell is blocked
     * @returns {LinkedCell[]} Array of cells along the ray
     * @returns {boolean} True if ray was blocked
     * @returns {LinkedCell | null} Cell that was hit
     */
  raycast(
    dir: Direction,
    maxDist = 10,
    blockFn: (lc: LinkedCell) => boolean = () => false
  ): { cells: LinkedCell[]; blocked: boolean; hitCell: LinkedCell | null } {
    return LinkedCellUtils.raycast(this, dir, maxDist, blockFn);
  }

  /**
   * Get all cells along a line to target using Bresenham's algorithm.
   *
   * @param {LinkedCell} target - Target cell
   * @returns {LinkedCell[]} Array of cells along the line
   */
  getLine(target: LinkedCell): LinkedCell[] {
    return LinkedCellUtils.getLine(this, target);
  }

  /**
   * Get all cells within a circular radius (Euclidean distance).
   *
   * @param {number} radius - Radius of circle
   * @returns {LinkedCell[]} Array of cells within the circle
   */
  getCircle(radius: number): LinkedCell[] {
    return LinkedCellUtils.getCircle(this, radius);
  }

  /**
   * Compute field of view using ray-casting.
   *
   * @param {number} radius - Radius of field of view
   * @param {(lc: LinkedCell) => boolean} blockFn - Function to check if cell is blocked
   * @returns {LinkedCell[]} Array of cells within the field of view
   */
  fieldOfView(
    radius: number,
    blockFn: (lc: LinkedCell) => boolean = () => false
  ): LinkedCell[] {
    return LinkedCellUtils.fieldOfView(this, radius, blockFn);
  }

  /**
   * Compute field of view within a cone (directional vision).
   *
   * @param {number} radius - Radius of field of view
   * @param {number} direction - Direction of field of view
   * @param {number} spread - Spread of field of view
   * @param {(lc: LinkedCell) => boolean} blockFn - Function to check if cell is blocked
   * @returns {LinkedCell[]} Array of cells within the field of view
   */
  fieldOfViewCone(
    radius: number,
    direction: number,
    spread: number,
    blockFn: (lc: LinkedCell) => boolean = () => false
  ): LinkedCell[] {
    return LinkedCellUtils.fieldOfViewCone(
      this,
      radius,
      direction,
      spread,
      blockFn
    );
  }

  /**
   * Propagate light from this cell with intensity falloff.
   *
   * @param {number} intensity - Intensity of light
   * @param {number} falloff - Falloff of light
   * @param {number} distanceLayer - Layer to store distance
   * @param {(lc: LinkedCell) => boolean} blockFn - Function to check if cell is blocked
   * @returns {void}
   */
  propagateLight(
    intensity: number,
    falloff: number,
    distanceLayer = 0,
    blockFn: (lc: LinkedCell) => boolean = () => false
  ): void {
    LinkedCellUtils.propagateLight(
      this,
      intensity,
      falloff,
      distanceLayer,
      blockFn
    );
  }

  /**
   * Apply fog of war visibility state using mask layers.
   *
   * @param {number} radius - Radius of fog of war
   * @param {(lc: LinkedCell) => boolean} blockFn - Function to check if cell is blocked
   * @param {number} visibleMask - Layer to store visible cells
   * @param {number} revealedMask - Layer to store revealed cells
   * @returns {void}
   */
  applyFogOfWar(
    radius: number,
    blockFn: (lc: LinkedCell) => boolean = () => false,
    visibleMask = 4,
    revealedMask = 5
  ): void {
    LinkedCellUtils.applyFogOfWar(
      this,
      radius,
      blockFn,
      visibleMask,
      revealedMask
    );
  }

  /**
   * Find cells matching a predicate using BFS (breadth-first search).
   *
   * @param {(lc: LinkedCell | null) => boolean} passFn - Function to check if cell is passable
   * @param {(lc: LinkedCell | null) => boolean} matchFn - Function to check if cell matches
   * @param {number} maxRange - Maximum range to search
   * @param {number} findLimit - Maximum number of cells to find
   * @returns {LinkedCell[]} Array of cells found
   */
  find(
    passFn: (lc: LinkedCell | null) => boolean,
    matchFn: (lc: LinkedCell | null) => boolean,
    maxRange = 10,
    findLimit = 1
  ): { cell: LinkedCell; dist: number }[] {
    return LinkedCellUtils.find(this, passFn, matchFn, maxRange, findLimit);
  }

  /**
   * Find shortest path to a target using BFS pathfinding.
   *
   * @param {(lc: LinkedCell | null) => boolean} passFn - Function to check if cell is passable
   * @param {(lc: LinkedCell | null) => boolean} matchFn - Function to check if cell matches
   * @param {number} maxRange - Maximum range to search
   * @returns {LinkedCell[]} Array of cells found
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
   *
   * @param {(lc: LinkedCell | null) => boolean} passFn - Function to check if cell is passable
   * @param {number} maxRange - Maximum range to search
   * @returns {LinkedCell[]} Array of cells found
   */
  getNeighborsWithinRange(
    passFn: (lc: LinkedCell | null) => boolean,
    maxRange = 1
  ): { cell: LinkedCell; dist: number }[] {
    return LinkedCellUtils.getNeighborsWithinRange(this, passFn, maxRange);
  }

  /**
   * Flood-fill distance values from this cell outward (Dijkstra map).
   *
   * @param {(lc: LinkedCell | null) => boolean} passFn - Function to check if cell is passable
   * @param {number} distLayer - Layer to store distance
   * @param {number} dist - Distance to add
   * @param {boolean} doAdd - Whether to add distance or set it
   * @param {number} maxRange - Maximum range to search
   * @returns {void}
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
