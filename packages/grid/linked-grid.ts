import { Direction } from './direction';
import { LinkedCell } from './linked-cell';

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
     * Fast path uses cell.x and cell.y if set (standard case).
     * Falls back to searching the grid for cells not created by LinkedGrid.
     * 
     * @param cell - The cell to find coordinates for
     * @returns {x, y} coordinates, or null if cell not found in grid
     */
    getCellCoordinates(cell: LinkedCell): { x: number, y: number } | null {
        // Fast path: use stored coordinates
        if (cell.x >= 0 && cell.y >= 0) {
            return { x: cell.x, y: cell.y };
        }
        // Fallback: search (for cells not created by LinkedGrid)
        for (let j = 0; j < this.height; j++) {
            for (let i = 0; i < this.width; i++) {
                if (this.grid[j][i] === cell) return { x: i, y: j };
            }
        }
        return null;
    }

    /**
     * Get all cells along a line between two coordinates using Bresenham's algorithm.
     * 
     * Uses Bresenham's line drawing algorithm for accurate line rasterization.
     * Returns cells in order from start to end (including both endpoints).
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
        const cells: LinkedCell[] = [];

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            const cell = this.cell(x0, y0);
            if (cell) cells.push(cell);

            if (x0 === x1 && y0 === y1) break;

            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }

        return cells;
    }

    /**
     * Print values layer as ASCII grid for debugging.
     * 
     * Formats cell.values[layer] as a 2D text grid with pipes as separators.
     * Undefined values display as "--".
     * 
     * @param layer - Which values layer to print (default 0)
     * @returns String representation of the grid
     * 
     * @example
     * ```typescript
     * console.log(grid.print(0));
     * // Output:
     * // 00|01|02
     * // 10|11|12
     * // 20|21|22
     * ```
     */
    print(layer = 0) {
        return this.grid.map(
            row => row.map(
                cell => cell.values[layer] === undefined ? "--" : `${cell.values[layer]}`.padStart(2, "0")
            ).join("|")
        ).join("\n");
    }

    /**
     * Print distances layer as ASCII grid for debugging pathfinding.
     * 
     * Formats cell.distances[layer] as a 2D text grid.
     * Useful for visualizing distance fields and influence maps.
     * 
     * @param layer - Which distances layer to print (default 0)
     * @returns String representation of the distance field
     * 
     * @example
     * ```typescript
     * // After setting distances from player
     * playerCell.setDistance(c => c?.values[0] !== WALL, 0);
     * console.log(grid.printDistances(0));
     * ```
     */
    printDistances(layer = 0) {
        return this.grid.map(
            row => row.map(
                cell => cell.distances[layer] === undefined ? "--" : `${cell.distances[layer]}`.padStart(2, "0")
            ).join("|")
        ).join("\n");
    }

    /**
     * Scroll the entire grid in a direction, shifting all cell values.
     * 
     * **Wrap mode**: Values wrap to opposite edge (Pac-Man style scrolling).
     * **Normal mode**: New edge cells are filled via `fillFn` callback.
     * 
     * Use cases: Endless runners, space shooters, procedural terrain generation.
     * 
     * @param dir - Direction to scroll (UP moves content up, new row appears at bottom)
     * @param fillFn - Called for each new cell when not wrapping. Receives (x, y, cell) and returns value for that cell.
     * @param layer - Which values layer to scroll (default 0)
     * @returns this for chaining
     * 
     * @example
     * ```typescript
     * // Endless runner: scroll world up, generate new terrain at bottom
     * grid.scroll(Direction.UP, (x, y, cell) => {
     *   return Math.random() < 0.3 ? OBSTACLE : EMPTY;
     * });
     * ```
     * 
     * @example
     * ```typescript
     * // Wrapping mode: values rotate around
     * const wrappedGrid = new LinkedGrid(10, 10, true);
     * wrappedGrid.scroll(Direction.LT);  // All values shift left, wrap to right
     * ```
     */
    scroll(
        dir: Direction,
        fillFn?: (x: number, y: number, cell: LinkedCell) => number,
        layer = 0
    ) {
        const { width, height } = this;

        if (this._wrap) {
            // Wrapping mode: just rotate the values
            if (dir === Direction.UP) {
                // Save top row, shift everything up, put top row at bottom
                const topRow = this.grid[0].map(c => c.values[layer]);
                for (let y = 0; y < height - 1; y++) {
                    for (let x = 0; x < width; x++) {
                        this.grid[y][x].values[layer] = this.grid[y + 1][x].values[layer];
                    }
                }
                for (let x = 0; x < width; x++) {
                    this.grid[height - 1][x].values[layer] = topRow[x];
                }
            } else if (dir === Direction.DN) {
                // Save bottom row, shift everything down, put bottom row at top
                const bottomRow = this.grid[height - 1].map(c => c.values[layer]);
                for (let y = height - 1; y > 0; y--) {
                    for (let x = 0; x < width; x++) {
                        this.grid[y][x].values[layer] = this.grid[y - 1][x].values[layer];
                    }
                }
                for (let x = 0; x < width; x++) {
                    this.grid[0][x].values[layer] = bottomRow[x];
                }
            } else if (dir === Direction.LT) {
                // Save left column, shift everything left, put left column at right
                const leftCol = this.grid.map(row => row[0].values[layer]);
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width - 1; x++) {
                        this.grid[y][x].values[layer] = this.grid[y][x + 1].values[layer];
                    }
                }
                for (let y = 0; y < height; y++) {
                    this.grid[y][width - 1].values[layer] = leftCol[y];
                }
            } else if (dir === Direction.RT) {
                // Save right column, shift everything right, put right column at left
                const rightCol = this.grid.map(row => row[width - 1].values[layer]);
                for (let y = 0; y < height; y++) {
                    for (let x = width - 1; x > 0; x--) {
                        this.grid[y][x].values[layer] = this.grid[y][x - 1].values[layer];
                    }
                }
                for (let y = 0; y < height; y++) {
                    this.grid[y][0].values[layer] = rightCol[y];
                }
            }
        } else {
            // Non-wrapping mode: shift values and fill new edge with callback
            if (dir === Direction.UP) {
                // Shift everything up, fill bottom row
                for (let y = 0; y < height - 1; y++) {
                    for (let x = 0; x < width; x++) {
                        this.grid[y][x].values[layer] = this.grid[y + 1][x].values[layer];
                    }
                }
                for (let x = 0; x < width; x++) {
                    const cell = this.grid[height - 1][x];
                    cell.values[layer] = fillFn ? fillFn(x, height - 1, cell) : 0;
                }
            } else if (dir === Direction.DN) {
                // Shift everything down, fill top row
                for (let y = height - 1; y > 0; y--) {
                    for (let x = 0; x < width; x++) {
                        this.grid[y][x].values[layer] = this.grid[y - 1][x].values[layer];
                    }
                }
                for (let x = 0; x < width; x++) {
                    const cell = this.grid[0][x];
                    cell.values[layer] = fillFn ? fillFn(x, 0, cell) : 0;
                }
            } else if (dir === Direction.LT) {
                // Shift everything left, fill right column
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width - 1; x++) {
                        this.grid[y][x].values[layer] = this.grid[y][x + 1].values[layer];
                    }
                }
                for (let y = 0; y < height; y++) {
                    const cell = this.grid[y][width - 1];
                    cell.values[layer] = fillFn ? fillFn(width - 1, y, cell) : 0;
                }
            } else if (dir === Direction.RT) {
                // Shift everything right, fill left column
                for (let y = 0; y < height; y++) {
                    for (let x = width - 1; x > 0; x--) {
                        this.grid[y][x].values[layer] = this.grid[y][x - 1].values[layer];
                    }
                }
                for (let y = 0; y < height; y++) {
                    const cell = this.grid[y][0];
                    cell.values[layer] = fillFn ? fillFn(0, y, cell) : 0;
                }
            }
        }

        return this;
    }



    /**
     * Quick collision check - returns true if cell contains any of the given types.
     * 
     * Checks if the cell at (x, y) has a value matching any in the `types` array.
     * Out-of-bounds coordinates are treated as collision by default.
     * 
     * @param x - X coordinate to check
     * @param y - Y coordinate to check
     * @param types - Array of values that count as collision
     * @param layer - Which values layer to check (default 0)
     * @param treatOobAsCollision - Return true for out-of-bounds coords (default true)
     * @returns true if cell contains a collision value or is out of bounds
     * 
     * @example
     * ```typescript
     * // Check if player can move to position
     * const blocked = grid.checkCollision(newX, newY, [WALL, WATER, LAVA]);
     * if (!blocked) {
     *   player.moveTo(newX, newY);
     * }
     * ```
     */
    checkCollision(x: number, y: number, types: number[], layer = 0, treatOobAsCollision = true): boolean {
        const cell = this.cell(x, y);
        if (!cell) return treatOobAsCollision;
        return types.includes(cell.values[layer]);
    }

    /**
     * Check collision for a move from current position in a direction.
     * 
     * Convenience method that calculates destination based on direction,
     * then checks if that cell contains any collision types.
     * 
     * @param x - Starting X coordinate
     * @param y - Starting Y coordinate
     * @param dir - Direction to move
     * @param types - Array of values that count as collision
     * @param layer - Which values layer to check (default 0)
     * @returns true if destination cell contains collision type or is out of bounds
     * 
     * @example
     * ```typescript
     * // Check if entity can move in a direction
     * if (!grid.checkMoveCollision(entity.x, entity.y, Direction.RT, [WALL])) {
     *   entity.move(Direction.RT);
     * }
     * ```
     */
    checkMoveCollision(x: number, y: number, dir: Direction, types: number[], layer = 0): boolean {
        let destX = x, destY = y;
        switch (dir) {
            case Direction.UP: destY--; break;
            case Direction.DN: destY++; break;
            case Direction.LT: destX--; break;
            case Direction.RT: destX++; break;
        }
        return this.checkCollision(destX, destY, types, layer);
    }

}
