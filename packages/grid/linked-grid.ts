import { Direction } from './direction';
import { LinkedCell } from './linked-cell';
import { LinkedGridUtils } from './linked-grid-utils';

/**
 * LinkedGrid - A 2D grid where each cell has direct references to its neighbors.
 *
 * This is the main container class that creates and manages a grid of LinkedCell instances.
 * Each cell stores direct references to its UP, DOWN, LEFT, RIGHT neighbors for O(1) navigation.
 *
 * All values are constrained to numbers for simplicity.
 *
 * @example
 * ```typescript
 * // Create a 10x10 grid for a tile-based game
 * const grid = new LinkedGrid(10, 10);
 *
 * // Access cells
 * const cell = grid.cell(5, 5);
 *
 * // Set terrain values
 * cell.setValue(0, WALL);
 *
 * // Navigate via neighbor links
 * const rightCell = cell.move(Direction.RT);
 * ```
 *
 * @example
 * ```typescript
 * // Create a wrapped grid (Pac-Man style)
 * const grid = new LinkedGrid(20, 20, true);
 * // Moving off right edge wraps to left edge
 * ```
 *
 * @example
 * ```typescript
 * // Create a grid with custom default value
 * const grid = new LinkedGrid(10, 10, false, -1);
 * // All cells start with values[0] = -1
 * ```
 */
export class LinkedGrid {
  /** Grid width (number of columns) */
  private _width: number;

  get width(): number {
    return this._width;
  }

  /** Grid height (number of rows) */
  private _height: number;

  get height(): number {
    return this._height;
  }

  /** 2D array for coordinate-based access: grid[y][x] */
  private _grid: LinkedCell[][] = [];

  get grid(): LinkedCell[][] {
    return this._grid;
  }

  /** Flat array of all cells for iteration */
  private _cells: LinkedCell[] = [];

  get cells(): LinkedCell[] {
    return this._cells;
  }

  /** Whether edges wrap around (toroidal/Pac-Man style) */
  private _wrap: boolean = false;

  /**
   * Create a new LinkedGrid.
   *
   * Creates all cells, assigns coordinates, sets grid references, and links neighbors.
   *
   * @param {number} width - Number of columns (default 3)
   * @param {number} height - Number of rows (default 3)
   * @param {boolean} wrap - Enable toroidal wrapping (default false)
   * @returns {LinkedGrid} - The new LinkedGrid instance
   *
   * @example
   * ```typescript
   * const grid = new LinkedGrid(10, 10);
   * ```
   * @param wrap - Enable toroidal wrapping (default false)
   */
  constructor(width: number = 3, height: number = 3, wrap: boolean = false) {
    this._width = width;
    this._height = height;
    this._wrap = wrap;
    this._grid = [];
    this._cells = [];

    for (let j = 0; j < height; j++) {
      const row: LinkedCell[] = [];
      this._grid.push(row);

      for (let i = 0; i < width; i++) {
        const cell = new LinkedCell(this, i, j);
        this._cells.push(cell);
        row.push(cell);
      }
    }

    this._linkNeighbors();
  }

  /** Get current wrap mode */
  get wrap(): boolean {
    return this._wrap;
  }

  /**
   * Link all cells to their neighbors.
   * Called during construction and when wrap mode changes.
   *
   * In wrap mode: Uses modulo arithmetic for toroidal topology.
   * In normal mode: Sets null for out-of-bounds neighbors.
   */
  private _linkNeighbors() {
    const { _width: width, _height: height } = this;

    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const cell = this._grid[j][i];

        if (this._wrap) {
          // Toroidal wrapping
          cell.setNeighbor(
            Direction.UP,
            this._grid[(j - 1 + height) % height][i]
          );
          cell.setNeighbor(Direction.DN, this._grid[(j + 1) % height][i]);
          cell.setNeighbor(
            Direction.LT,
            this._grid[j][(i - 1 + width) % width]
          );
          cell.setNeighbor(Direction.RT, this._grid[j][(i + 1) % width]);
        } else {
          // Normal edges (null at boundaries)
          cell.setNeighbor(Direction.UP, j > 0 ? this._grid[j - 1][i] : null);
          cell.setNeighbor(
            Direction.DN,
            j < height - 1 ? this._grid[j + 1][i] : null
          );
          cell.setNeighbor(Direction.LT, i > 0 ? this._grid[j][i - 1] : null);
          cell.setNeighbor(
            Direction.RT,
            i < width - 1 ? this._grid[j][i + 1] : null
          );
        }
      }
    }
  }

  /**
   * Get cell at coordinates.
   *
   * @param x - Column index (0-based)
   * @param y - Row index (0-based)
   * @returns The cell at (x, y), or null if out of bounds
   *
   * @example
   * ```typescript
   * const center = grid.cell(5, 5);
   * if (center) {
   *   center.setValue(0, WALL);
   * }
   * ```
   */
  cell(x: number, y: number): LinkedCell | null {
    if (x < 0 || y < 0) return null;
    if (x >= this._width || y >= this._height) return null;
    return this._grid[y][x];
  }

  /**
   * Get coordinates for a cell.
   *
   * Cells created by LinkedGrid always have valid x,y coordinates.
   *
   * @param cell - The cell to find coordinates for
   * @returns {x, y} coordinates, or null if cell has invalid coordinates
   */
  getCellCoordinates(cell: LinkedCell): { x: number; y: number } | null {
    if (cell.x >= 0 && cell.y >= 0) {
      return { x: cell.x, y: cell.y };
    }
    return null;
  }

  /**
   * Get all cells along a line between two coordinates using Bresenham's algorithm.
   *
   * Convenience wrapper for LinkedGridUtils.getLine().
   *
   * @param x0 - Start X coordinate
   * @param y0 - Start Y coordinate
   * @param x1 - End X coordinate
   * @param y1 - End Y coordinate
   * @returns Array of cells along the line (in order)
   *
   * @example
   * ```typescript
   * // Draw a wall between two points
   * const line = grid.getLine(0, 0, 9, 9);
   * line.forEach(cell => cell.setValue(0, WALL));
   * ```
   */
  getLine(x0: number, y0: number, x1: number, y1: number): LinkedCell[] {
    return LinkedGridUtils.getLine(this, x0, y0, x1, y1);
  }
}
