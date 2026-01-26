import { LinkedGrid } from './linked-grid';
import { LinkedCell } from './linked-cell';

/**
 * LinkedGridUtils - Static utility methods for LinkedGrid visualization and debugging.
 * 
 * These methods are separated from LinkedGrid to keep the core class minimal.
 */
export class LinkedGridUtils {

    /**
     * Get all cells along a line between two coordinates using Bresenham's algorithm.
     * 
     * Uses Bresenham's line drawing algorithm for accurate line rasterization.
     * Returns cells in order from start to end (including both endpoints).
     * 
     * @param grid - The grid to operate on
     * @param x0 - Start X coordinate
     * @param y0 - Start Y coordinate
     * @param x1 - End X coordinate
     * @param y1 - End Y coordinate
     * @returns Array of cells along the line (in order)
     * 
     * @example
     * ```typescript
     * // Draw a wall between two points
     * const line = LinkedGridUtils.getLine(grid, 0, 0, 9, 9);
     * line.forEach(cell => cell.setValue(0, WALL));
     * ```
     */
    static getLine(grid: LinkedGrid, x0: number, y0: number, x1: number, y1: number): LinkedCell[] {
        const cells: LinkedCell[] = [];

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            const cell = grid.cell(x0, y0);
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
     * @param grid - The grid to print
     * @param layer - Which values layer to print (default 0)
     * @returns String representation of the grid
     * 
     * @example
     * ```typescript
     * console.log(LinkedGridUtils.print(grid, 0));
     * // Output:
     * // 00|01|02
     * // 10|11|12
     * // 20|21|22
     * ```
     */
    static print(grid: LinkedGrid, layer = 0): string {
        return grid.grid.map(
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
     * @param grid - The grid to print
     * @param layer - Which distances layer to print (default 0)
     * @returns String representation of the distance field
     * 
     * @example
     * ```typescript
     * // After setting distances from player
     * playerCell.setDistance(c => c?.values[0] !== WALL, 0);
     * console.log(LinkedGridUtils.printDistances(grid, 0));
     * ```
     */
    static printDistances(grid: LinkedGrid, layer = 0): string {
        return grid.grid.map(
            row => row.map(
                cell => cell.distances[layer] === undefined ? "--" : `${cell.distances[layer]}`.padStart(2, "0")
            ).join("|")
        ).join("\n");
    }
}
