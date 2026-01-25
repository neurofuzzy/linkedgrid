import { Direction } from './direction';
import type { ILinkedGrid } from './interfaces';

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
 * @typeParam T - The type of values stored in cell.values[] (typically number for game state)
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
export class LinkedCell<T> {

    /** Direct references to neighbors [UP-1, DN-1, LT-1, RT-1] (Direction enum - 1) */
    protected _neighbors: (LinkedCell<T> | null)[] = [];

    /** Typed game state values, one per layer (e.g., layer 0: terrain, layer 1: items) */
    values: T[] = [];

    /** Numeric values for distance fields, pathfinding costs, light intensity, etc. */
    distances: number[] = [];

    /** Boolean masks for collision, visibility, walkability, etc. */
    masks: boolean[] = [];

    /** Item/entity references per layer */
    items: T[] = [];

    /** Arbitrary typed data storage for custom game-specific data */
    data: Record<string, unknown> = {};

    /** BFS visited flag (used internally by pathfinding, cleaned up after) */
    protected _visited: boolean = false;

    /** BFS previous cell pointer (used internally by pathfinding, cleaned up after) */
    protected _prev: LinkedCell<T> | null = null;

    /** Grid X coordinate (0-indexed column) - set by LinkedGrid */
    x: number = -1;

    /** Grid Y coordinate (0-indexed row) - set by LinkedGrid */
    y: number = -1;

    /** Reference to parent grid - required for geometry methods - set by LinkedGrid */
    _grid: ILinkedGrid<T, LinkedCell<T>> | null = null;

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
    constructor(up: LinkedCell<T> | null = null, down: LinkedCell<T> | null = null, left: LinkedCell<T> | null = null, right: LinkedCell<T> | null = null) {
        this.setNeighbor(Direction.UP, up);
        this.setNeighbor(Direction.DN, down);
        this.setNeighbor(Direction.LT, left);
        this.setNeighbor(Direction.RT, right);
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
    setValue(layer: number, val: T) {
        this.values[layer] = val;
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
     * Set item reference at a layer.
     * 
     * @param layer - Layer index (0-based)
     * @param val - Item value to store
     * @returns this for chaining
     */
    setItem(layer: number, val: T) {
        this.items[layer] = val;
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
    move(dir: Direction, num = 1): LinkedCell<T> | null {
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
    look(matchFn: (lc: LinkedCell<T>) => boolean, dir: Direction): LinkedCell<T> | null {
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
    neighbors(): (LinkedCell<T> | null)[] {
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
    neighbor(dir: Direction): LinkedCell<T> | null {
        return this._neighbors[dir - 1];
    }

    /**
     * Set neighbor in a direction (used by LinkedGrid during initialization).
     * 
     * @param dir - Direction to set neighbor for
     * @param n - The neighbor cell (or null for edge)
     * @returns this for chaining
     */
    setNeighbor(dir: Direction, n: LinkedCell<T> | null) {
        this._neighbors[dir - 1] = n;
        return this;
    }

    /**
     * Cast a ray in a cardinal direction until blocked or max distance.
     * 
     * Simple linear ray march. Returns all cells hit (excluding origin).
     * Use cases: Bullets, lasers, line-of-sight checks.
     * 
     * @param dir - Cardinal direction to cast ray (UP, DN, LT, RT)
     * @param maxDist - Maximum distance to cast (default 10)
     * @param blockFn - Function to determine if a cell blocks the ray (default: none block)
     * @returns Object with { cells, blocked, hitCell }
     *   - cells: All cells hit by ray (in order, excluding origin)
     *   - blocked: Whether ray was blocked
     *   - hitCell: The blocking cell (or last cell if not blocked)
     * 
     * @example
     * ```typescript
     * // Cast laser beam that stops at walls
     * const ray = cell.raycast(Direction.RT, 20, c => c.values[0] === WALL);
     * ray.cells.forEach(c => {
     *   // Apply damage or visual effect
     *   c.setValue(1, HIT_MARKER);
     * });
     * if (ray.blocked) {
     *   console.log('Hit wall at', ray.hitCell?.x, ray.hitCell?.y);
     * }
     * ```
     */
    raycast(
        dir: Direction,
        maxDist = 10,
        blockFn: (lc: LinkedCell<T>) => boolean = () => false
    ): { cells: LinkedCell<T>[], blocked: boolean, hitCell: LinkedCell<T> | null } {
        const cells: LinkedCell<T>[] = [];
        let current: LinkedCell<T> | null = this.neighbor(dir);
        let blocked = false;
        let hitCell: LinkedCell<T> | null = null;

        for (let i = 0; i < maxDist; i++) {
            if (!current) break;

            if (blockFn(current)) {
                blocked = true;
                hitCell = current;
                cells.push(current);
                break;
            }
            cells.push(current);
            current = current.neighbor(dir);
        }

        return { cells, blocked, hitCell };
    }

    /**
     * Get all cells along a line to target using Bresenham's algorithm.
     * 
     * Uses Bresenham's line drawing for accurate line rasterization.
     * Works between any two cells (not limited to cardinal directions).
     * 
     * **Requires**: Grid reference (cell._grid) - only works for cells created by LinkedGrid.
     * 
     * @param target - Target cell to draw line to
     * @returns Array of cells along line (excluding origin, including target)
     * 
     * @example
     * ```typescript
     * // Draw wall between two cells
     * const start = grid.cell(0, 0);
     * const end = grid.cell(9, 9);
     * const line = start.getLine(end);
     * line.forEach(c => c.setValue(0, WALL));
     * ```
     */
    getLine(target: LinkedCell<T>): LinkedCell<T>[] {
        if (!this._grid || this.x < 0 || target.x < 0) return [];

        const cells: LinkedCell<T>[] = [];
        let x0 = this.x, y0 = this.y;
        const x1 = target.x, y1 = target.y;

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            const cell = this._grid.cell(x0, y0);
            if (cell && cell !== this) cells.push(cell);

            if (x0 === x1 && y0 === y1) break;

            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }

        return cells;
    }

    /**
     * Get all cells within a circular radius (Euclidean distance).
     * 
     * Uses Euclidean distance formula: √(dx² + dy²) ≤ radius.
     * Iterates over bounding box and tests each cell.
     * 
     * **Requires**: Grid reference (cell._grid).
     * 
     * @param radius - Radius in cells (Euclidean distance)
     * @returns Array of all cells within radius (including origin)
     * 
     * @example
     * ```typescript
     * // Create explosion effect
     * const affected = cell.getCircle(3);
     * affected.forEach(c => {
     *   c.setValue(1, EXPLOSION);
     * });
     * ```
     * 
     * @example
     * ```typescript
     * // Find enemies in range
     * const inRange = towerCell.getCircle(5);
     * const enemies = inRange.filter(c => enemyManager.anyAt(c.x, c.y));
     * ```
     */
    getCircle(radius: number): LinkedCell<T>[] {
        if (!this._grid || this.x < 0) return [];

        const cells: LinkedCell<T>[] = [];
        const r2 = radius * radius;

        const minX = Math.max(0, Math.floor(this.x - radius));
        const maxX = Math.min(this._grid.width - 1, Math.ceil(this.x + radius));
        const minY = Math.max(0, Math.floor(this.y - radius));
        const maxY = Math.min(this._grid.height - 1, Math.ceil(this.y + radius));

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const dx = x - this.x;
                const dy = y - this.y;
                if (dx * dx + dy * dy <= r2) {
                    const cell = this._grid.cell(x, y);
                    if (cell) cells.push(cell);
                }
            }
        }

        return cells;
    }

    /**
     * Compute field of view using ray-casting.
     * 
     * Casts rays in all directions to determine visible cells.
     * Uses simple ray-casting (not true shadowcasting), which is fast but may have
     * minor artifacts. Good enough for most games.
     * 
     * **Requires**: Grid reference (cell._grid).
     * 
     * @param radius - View distance in cells
     * @param blockFn - Function to determine if a cell blocks vision (default: none block)
     * @returns Array of all visible cells (including origin)
     * 
     * @example
     * ```typescript
     * // Calculate visible cells for player
     * const visible = playerCell.fieldOfView(10, c => c.values[0] === WALL);
     * 
     * // Render only visible cells
     * grid.cells.forEach(c => {
     *   c.setMask(0, visible.includes(c));
     * });
     * ```
     * 
     * @see fieldOfViewCone for directional vision
     */
    fieldOfView(
        radius: number,
        blockFn: (lc: LinkedCell<T>) => boolean = () => false
    ): LinkedCell<T>[] {
        if (!this._grid || this.x < 0) return [];

        const visible = new Set<LinkedCell<T>>();
        visible.add(this);

        // Cast rays in all directions (simple raycasting FOV)
        const numRays = Math.max(8, Math.ceil(radius * 8));

        for (let i = 0; i < numRays; i++) {
            const angle = (2 * Math.PI * i) / numRays;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);

            let x = this.x + 0.5;
            let y = this.y + 0.5;

            for (let step = 0; step < radius; step++) {
                x += dx;
                y += dy;

                const cellX = Math.floor(x);
                const cellY = Math.floor(y);

                if (cellX < 0 || cellX >= this._grid.width ||
                    cellY < 0 || cellY >= this._grid.height) break;

                const cell = this._grid.cell(cellX, cellY);
                if (!cell) break;

                visible.add(cell);

                if (blockFn(cell)) break;
            }
        }

        return Array.from(visible);
    }

    /**
     * Compute field of view within a cone (directional vision).
     * 
     * Like fieldOfView but limited to a directional cone.
     * Useful for:
     * - Stealth games where guards have limited vision arcs
     * - Flashlight/headlamp effects
     * - Enemy awareness zones
     * 
     * **Requires**: Grid reference (cell._grid).
     * 
     * @param radius - Maximum view distance
     * @param direction - Direction angle in radians (0 = right, PI/2 = down, PI = left, 3PI/2 = up)
     * @param spread - Half-angle of the cone in radians (e.g., PI/4 for 90° total cone)
     * @param blockFn - Function to determine if a cell blocks vision
     * @returns Array of visible cells within the cone (including origin)
     * 
     * @example
     * ```typescript
     * // Guard looking south with 90° cone
     * const visible = guardCell.fieldOfViewCone(
     *   8,                // 8 cells range
     *   Math.PI / 2,      // South (down)
     *   Math.PI / 4,      // 90° total cone (45° each side)
     *   c => c.values[0] === WALL
     * );
     * ```
     */
    fieldOfViewCone(
        radius: number,
        direction: number,
        spread: number,
        blockFn: (lc: LinkedCell<T>) => boolean = () => false
    ): LinkedCell<T>[] {
        if (!this._grid || this.x < 0) return [];

        const visible = new Set<LinkedCell<T>>();
        visible.add(this);

        // Normalize direction to 0-2PI
        direction = ((direction % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

        // Cast rays within the cone
        const numRays = Math.max(8, Math.ceil(radius * spread * 4));

        for (let i = 0; i <= numRays; i++) {
            // Angle within the cone: from -spread to +spread
            const offsetAngle = spread * (2 * i / numRays - 1);
            const angle = direction + offsetAngle;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);

            let x = this.x + 0.5;
            let y = this.y + 0.5;

            for (let step = 0; step < radius; step++) {
                x += dx;
                y += dy;

                const cellX = Math.floor(x);
                const cellY = Math.floor(y);

                if (cellX < 0 || cellX >= this._grid.width ||
                    cellY < 0 || cellY >= this._grid.height) break;

                const cell = this._grid.cell(cellX, cellY);
                if (!cell) break;

                visible.add(cell);

                if (blockFn(cell)) break;
            }
        }

        return Array.from(visible);
    }

    /**
     * Propagate light from this cell with intensity falloff.
     * 
     * Calculates light intensity based on distance from source.
     * Stores results in distances[layer] (additive, supports multiple light sources).
     * 
     * Uses FOV to respect walls/blocking cells.
     * 
     * **Requires**: Grid reference (cell._grid).
     * 
     * @param intensity - Starting light intensity (e.g., 1.0 for full bright)
     * @param falloff - Intensity reduction per cell distance (e.g., 0.15 means 0.15 less per cell)
     * @param distanceLayer - Layer in distances[] to store light values (default 0)
     * @param blockFn - Function to determine if a cell blocks light
     * 
     * @example
     * ```typescript
     * // Clear previous lighting
     * grid.cells.forEach(c => c.distances[0] = 0);
     * 
     * // Add multiple light sources
     * torchCell1.propagateLight(1.0, 0.1, 0, c => c.values[0] === WALL);
     * torchCell2.propagateLight(0.8, 0.15, 0, c => c.values[0] === WALL);
     * 
     * // Render with lighting
     * grid.cells.forEach(c => {
     *   const brightness = Math.min(1, c.distances[0]);
     *   renderCellWithBrightness(c, brightness);
     * });
     * ```
     */
    propagateLight(
        intensity: number,
        falloff: number,
        distanceLayer = 0,
        blockFn: (lc: LinkedCell<T>) => boolean = () => false
    ): void {
        if (!this._grid || this.x < 0) return;

        // Calculate max radius based on when intensity reaches 0
        const maxRadius = Math.ceil(intensity / falloff);

        // Get visible cells
        const visible = this.fieldOfView(maxRadius, blockFn);

        // Calculate and apply light intensity based on distance
        for (const cell of visible) {
            const dx = cell.x - this.x;
            const dy = cell.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const lightValue = Math.max(0, intensity - distance * falloff);

            // Add to existing light (allows multiple light sources)
            const existing = cell.distances[distanceLayer] ?? 0;
            cell.distances[distanceLayer] = Math.max(existing, lightValue);
        }
    }

    /**
     * Apply fog of war visibility state using mask layers.
     * 
     * Implements the classic "fog of war" pattern:
     * - Previously unseen cells: fully hidden
     * - Previously seen but not visible: dimmed/grayed
     * - Currently visible: fully visible
     * 
     * Uses two mask layers:
     * - visibleMask: Currently visible (cleared and re-set each call)
     * - revealedMask: Ever revealed (never cleared, only set)
     * 
     * **Requires**: Grid reference (cell._grid).
     * 
     * @param radius - View radius
     * @param blockFn - Function to determine if a cell blocks vision
     * @param visibleMask - Mask layer for currently visible cells (default 4)
     * @param revealedMask - Mask layer for ever-revealed cells (default 5)
     * 
     * @example
     * ```typescript
     * // Apply fog of war from player position
     * playerCell.applyFogOfWar(10, c => c.values[0] === WALL);
     * 
     * // Render with fog of war
     * grid.cells.forEach(c => {
     *   if (c.masks[4]) {
     *     renderVisible(c);        // Currently visible
     *   } else if (c.masks[5]) {
     *     renderDimmed(c);         // Previously seen
     *   } else {
     *     renderHidden(c);         // Never seen
     *   }
     * });
     * ```
     */
    applyFogOfWar(
        radius: number,
        blockFn: (lc: LinkedCell<T>) => boolean = () => false,
        visibleMask = 4,
        revealedMask = 5
    ): void {
        if (!this._grid) return;

        // Clear current visibility for all cells
        this._grid.cells.forEach((c: LinkedCell<T>) => {
            c.masks[visibleMask] = false;
        });

        // Get visible cells and mark them
        const visible = this.fieldOfView(radius, blockFn);
        for (const cell of visible) {
            cell.masks[visibleMask] = true;
            cell.masks[revealedMask] = true;
        }
    }

    /**
     * Find cells matching a predicate using BFS (breadth-first search).
     * 
     * Expands outward from this cell, respecting passable cells (passFn),
     * and collects cells matching the search criteria (matchFn).
     * 
     * Returns matches in order of distance from origin.
     * 
     * **Implementation detail**: Uses _visited flag internally, cleaned up after search.
     * 
     * @param passFn - Function to determine if a cell is passable (BFS expands through these)
     * @param matchFn - Function to determine if a cell matches search criteria
     * @param maxRange - Maximum search distance (default 10)
     * @param findLimit - Stop after finding this many matches (0 = unlimited, default 1)
     * @returns Array of {cell, dist} objects for matching cells
     * 
     * @example
     * ```typescript
     * // Find nearest 3 empty cells
     * const empties = cell.find(
     *   c => c?.values[0] !== WALL,  // Can search through non-walls
     *   c => c?.values[0] === EMPTY,  // Looking for empty cells
     *   20,                           // Max range
     *   3                             // Find 3 matches
     * );
     * ```
     * 
     * @example
     * ```typescript
     * // Find all coins within 5 cells
     * const coins = cell.find(
     *   c => c !== null,              // Search everywhere
     *   c => c?.values[1] === COIN,   // Layer 1: items
     *   5,
     *   0                             // Find all matches
     * );
     * ```
     */
    find(
        passFn: (lc: LinkedCell<T> | null) => boolean,
        matchFn: (lc: LinkedCell<T> | null) => boolean,
        maxRange = 10,
        findLimit = 1
    ): { cell: LinkedCell<T>, dist: number }[] {
        const lcs: { cell: LinkedCell<T>, dist: number }[] = [{ cell: this, dist: 0 }];

        let ns = this._neighbors;
        let nns: (LinkedCell<T> | null)[] = [];
        let d = 0;

        const matches: { cell: LinkedCell<T>, dist: number }[] = [];
        let findLimitReached = false;

        while (ns.length) {
            d++;
            for (const n of ns) {
                if (n && matchFn(n)) {
                    matches.push({ cell: n, dist: d });
                    if (findLimit > 0 && matches.length === findLimit) {
                        findLimitReached = true;
                        break;
                    }
                }
                if (n && n !== this && !n._visited && passFn(n)) {
                    nns.push(...n.neighbors());
                    n._visited = true;
                    lcs.push({ cell: n, dist: d });
                }
            }
            ns = nns.filter(n => !!n);
            nns = [];
            if (d == maxRange) break;
            if (findLimitReached) break;
        }

        lcs.forEach(n => n.cell._visited = false);

        return matches;

    }

    /**
     * Find shortest path to a target using BFS pathfinding.
     * 
     * BFS-based pathfinding (not true A*, no heuristic).
     * Expands outward from origin until finding first match, then reconstructs path.
     * 
     * Returns path from this cell to target (excluding origin, including target).
     * Returns empty array if no path found.
     * 
     * **Implementation detail**: Uses _visited and _prev flags internally, cleaned up after search.
     * 
     * @param passFn - Function to determine if a cell is passable/walkable
     * @param matchFn - Function to determine if cell is the target
     * @param maxRange - Maximum search distance (default 10)
     * @returns Array of cells forming path from origin to target (excluding origin)
     * 
     * @example
     * ```typescript
     * // Find path to player, avoiding walls
     * const playerCell = grid.cell(playerX, playerY);
     * const path = enemyCell.findPath(
     *   c => c?.values[0] !== WALL,  // Can walk through non-walls
     *   c => c === playerCell,       // Looking for player cell
     *   50                           // Max search range
     * );
     * 
     * if (path.length > 0) {
     *   enemy.moveTo(path[0].x, path[0].y);  // Move to next step
     * }
     * ```
     * 
     * @example
     * ```typescript
     * // Find path to nearest exit
     * const path = cell.findPath(
     *   c => c?.values[0] !== WALL && c?.values[0] !== LAVA,
     *   c => c?.values[0] === EXIT
     * );
     * ```
     */
    findPath(
        passFn: (lc: LinkedCell<T> | null) => boolean,
        matchFn: (lc: LinkedCell<T> | null) => boolean,
        maxRange = 10
    ): LinkedCell<T>[] {
        const allVisited: LinkedCell<T>[] = [this];
        this._visited = true;

        let frontier: LinkedCell<T>[] = [this];
        let d = 0;
        let match: LinkedCell<T> | null = null;

        while (frontier.length > 0) {
            if (d >= maxRange) break;
            d++;
            const nextFrontier: LinkedCell<T>[] = [];

            for (const current of frontier) {
                for (const neighbor of current.neighbors()) {
                    if (neighbor && !neighbor._visited && passFn(neighbor)) {
                        neighbor._visited = true;
                        neighbor._prev = current;
                        allVisited.push(neighbor);
                        nextFrontier.push(neighbor);

                        if (matchFn(neighbor)) {
                            match = neighbor;
                            break;
                        }
                    }
                }
                if (match) break;
            }
            frontier = nextFrontier;
            if (match) break;
        }

        const path: LinkedCell<T>[] = [];
        if (match) {
            let current: LinkedCell<T> | null = match;
            while (current && current !== this) {
                path.unshift(current);
                current = current._prev;
            }
        }

        allVisited.forEach(n => {
            n._prev = null;
            n._visited = false;
        });

        return path;
    }

    /**
     * Get all neighbors within a range using BFS expansion.
     * 
     * Like find() but returns all passable cells within range (no match function).
     * 
     * @param passFn - Function to determine if a cell is passable
     * @param maxRange - Maximum distance to expand (default 1)
     * @returns Array of {cell, dist} for all reachable cells within range
     * 
     * @example
     * ```typescript
     * // Get all walkable cells within 3 moves
     * const reachable = cell.getNeighborsWithinRange(
     *   c => c?.values[0] !== WALL,
     *   3
     * );
     * ```
     */
    getNeighborsWithinRange(
        passFn: (lc: LinkedCell<T> | null) => boolean,
        maxRange = 1
    ): { cell: LinkedCell<T>, dist: number }[] {
        const lcs: { cell: LinkedCell<T>, dist: number }[] = [{ cell: this, dist: 0 }];

        let ns = this._neighbors;
        let nns: (LinkedCell<T> | null)[] = [];
        let d = 0;

        while (ns.length) {
            d++;
            ns.forEach(n => {
                if (n && n !== this && !n._visited && passFn(n)) {
                    nns.push(...n.neighbors());
                    n._visited = true;
                    lcs.push({ cell: n, dist: d });
                }
            });
            ns = nns.filter(n => !!n);
            nns = [];
            if (d == maxRange) break;
        }

        lcs.forEach(n => n.cell._visited = false);

        return lcs;

    }

    /**
     * Flood-fill distance values from this cell outward (Dijkstra map).
     * 
     * Propagates distance values outward from this cell to all reachable cells.
     * Creates a "distance field" or "influence map" for AI behavior.
     * 
     * Stores results in distances[distLayer]:
     * - This cell: dist
     * - Neighbors: dist + 1
     * - Next layer: dist + 2, etc.
     * 
     * **Common pattern**: Set distance from player, enemies follow gradient toward lower distances.
     * 
     * **Implementation detail**: Uses _visited flag internally, cleaned up after operation.
     * 
     * @param passFn - Function to determine if distance can propagate through a cell
     * @param distLayer - Which distances[] layer to write to (default 0)
     * @param dist - Starting distance value (default 1, but often use 0 for origin)
     * @param doAdd - If true, adds to existing distance instead of setting (default false)
     * @param maxRange - Maximum propagation distance (default 50)
     * 
     * @example
     * ```typescript
     * // Basic distance field from player
     * playerCell.setDistance(c => c?.values[0] !== WALL, 0, 0);
     * 
     * // Enemy moves toward lower distances
     * const neighbors = enemyCell.neighbors().filter(n => n);
     * const best = neighbors.sort((a, b) => a.distances[0] - b.distances[0])[0];
     * enemy.moveTo(best.x, best.y);
     * ```
     * 
     * @example
     * ```typescript
     * // Multiple goal cells (exits)
     * exits.forEach(exit => {
     *   const cell = grid.cell(exit.x, exit.y);
     *   cell.setDistance(c => c?.values[0] !== WALL, 0, 0);
     * });
     * // Now all cells have distance to nearest exit
     * ```
     */
    setDistance(
        passFn: (lc: LinkedCell<T> | null) => boolean,
        distLayer = 0,
        dist = 1,
        doAdd = false,
        maxRange = 50
    ) {
        if (!doAdd) this.distances[distLayer] = 0;
        const currentDist = this.distances[distLayer] ?? 0;
        this.distances[distLayer] = currentDist + dist;

        const lcs: LinkedCell<T>[] = [this];

        let ns = this._neighbors;
        let nns: (LinkedCell<T> | null)[] = [];
        let d = dist;

        while (ns.length) {
            d++;
            ns.forEach(n => {
                if (n && n !== this && !n._visited && passFn(n)) {
                    nns.push(...n.neighbors());
                    n.distances[distLayer] = d;
                    n._visited = true;
                    lcs.push(n);
                }
            });
            ns = nns.filter(n => !!n);
            nns = [];
            if (d == maxRange) break;
        }

        lcs.forEach(n => n._visited = false);

    }

}
