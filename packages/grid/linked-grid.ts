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
    width: number;
    
    /** Grid height (number of rows) */
    height: number;
    
    /** 2D array for coordinate-based access: grid[y][x] */
    grid: LinkedCell[][] = [];
    
    /** Flat array of all cells for iteration */
    cells: LinkedCell[] = [];

    /** Whether edges wrap around (toroidal/Pac-Man style) */
    private _wrap: boolean = false;

    /**
     * Create a new LinkedGrid.
     * 
     * Creates all cells, assigns coordinates, sets grid references, and links neighbors.
     * 
     * @param width - Number of columns (default 3)
     * @param height - Number of rows (default 3)
     * @param wrap - Enable toroidal wrapping (default false)
     * @param defaultValue - Initial value for layer 0 of all cells (default 0)
     */
    constructor(width = 3, height = 3, wrap = false, defaultValue: number = 0) {

        this.width = width;
        this.height = height;
        this._wrap = wrap;
        this.grid = [];
        this.cells = [];

        for (let j = 0; j < height; j++) {

            const row: LinkedCell[] = [];
            this.grid.push(row);

            for (let i = 0; i < width; i++) {

                const cell = new LinkedCell();
                cell.x = i;
                cell.y = j;
                cell._grid = this;
                // Initialize layer 0 to default value
                cell.values[0] = defaultValue;
                this.cells.push(cell);
                row.push(cell);

            }

        }

        this._linkNeighbors();

    }

    /**
     * Enable or disable edge wrapping (toroidal grid).
     * 
     * When enabled, moving off one edge wraps to the opposite side (Pac-Man style).
     * When disabled, edge cells have null neighbors at boundaries.
     * 
     * Re-links all neighbors after changing wrap mode.
     * 
     * @param wrap - Whether to enable wrapping
     * @returns this for chaining
     * 
     * @example
     * ```typescript
     * grid.setWrap(true);
     * const topLeft = grid.cell(0, 0);
     * const wrapped = topLeft.move(Direction.UP); // Wraps to bottom
     * ```
     */
    setWrap(wrap: boolean) {
        this._wrap = wrap;
        this._linkNeighbors();
        return this;
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
        const { width, height } = this;

        for (let j = 0; j < height; j++) {
            for (let i = 0; i < width; i++) {
                const cell = this.grid[j][i];

                if (this._wrap) {
                    // Toroidal wrapping
                    cell.setNeighbor(Direction.UP, this.grid[(j - 1 + height) % height][i]);
                    cell.setNeighbor(Direction.DN, this.grid[(j + 1) % height][i]);
                    cell.setNeighbor(Direction.LT, this.grid[j][(i - 1 + width) % width]);
                    cell.setNeighbor(Direction.RT, this.grid[j][(i + 1) % width]);
                } else {
                    // Normal edges (null at boundaries)
                    cell.setNeighbor(Direction.UP, j > 0 ? this.grid[j - 1][i] : null);
                    cell.setNeighbor(Direction.DN, j < height - 1 ? this.grid[j + 1][i] : null);
                    cell.setNeighbor(Direction.LT, i > 0 ? this.grid[j][i - 1] : null);
                    cell.setNeighbor(Direction.RT, i < width - 1 ? this.grid[j][i + 1] : null);
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
        if (x >= this.width || y >= this.height) return null;
        return this.grid[y][x];
    }

    /**
     * Set cell at coordinates (advanced usage).
     * 
     * Replaces the cell at the given position. The new cell should have its neighbors
     * properly linked. This is rarely needed - use for custom cell implementations.
     * 
     * @param x - Column index
     * @param y - Row index
     * @param n - New cell to place at position
     * @returns true if coordinates are valid, false otherwise
     */
    setCell(x: number, y: number, n: LinkedCell): boolean {
        if (x < 0 || y < 0) return false;
        if (x >= this.width || y >= this.height) return false;
        this.grid[y][x] = n;
        return true;
    }

    /**
     * Get coordinates for a cell.
     * 
     * Cells created by LinkedGrid always have valid x,y coordinates.
     * 
     * @param cell - The cell to find coordinates for
     * @returns {x, y} coordinates, or null if cell has invalid coordinates
     */
    getCellCoordinates(cell: LinkedCell): { x: number, y: number } | null {
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
