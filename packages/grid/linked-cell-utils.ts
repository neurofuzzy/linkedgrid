import { Direction } from './direction';
import { LinkedCell } from './linked-cell';
import type { ILinkedGrid } from './interfaces';

/**
 * LinkedCellUtils - Static class for complex geometry, pathfinding, and lighting
 * algorithms related to LinkedCell.
 * 
 * These methods were moved from LinkedCell to reduce its size and separate concerns.
 */
export class LinkedCellUtils {

    /**
     * Cast a ray in a cardinal direction until blocked or max distance.
     */
    static raycast(
        cell: LinkedCell,
        dir: Direction,
        maxDist = 10,
        blockFn: (lc: LinkedCell) => boolean = () => false
    ): { cells: LinkedCell[], blocked: boolean, hitCell: LinkedCell | null } {
        const cells: LinkedCell[] = [];
        let current: LinkedCell | null = cell.neighbor(dir);
        let blocked = false;
        let hitCell: LinkedCell | null = null;

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
     */
    static getLine(cell: LinkedCell, target: LinkedCell): LinkedCell[] {
        if (!cell.grid || cell.x < 0 || target.x < 0) return [];

        const cells: LinkedCell[] = [];
        let x0 = cell.x, y0 = cell.y;
        const x1 = target.x, y1 = target.y;

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        const grid = cell.grid;

        while (true) {
            const currentCell = grid.cell(x0, y0);
            if (currentCell && currentCell !== cell) cells.push(currentCell);

            if (x0 === x1 && y0 === y1) break;

            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }

        return cells;
    }

    /**
     * Get all cells within a circular radius (Euclidean distance).
     */
    static getCircle(cell: LinkedCell, radius: number): LinkedCell[] {
        if (!cell.grid || cell.x < 0) return [];

        const cells: LinkedCell[] = [];
        const grid = cell.grid;
        const r2 = radius * radius;

        const minX = Math.max(0, Math.floor(cell.x - radius));
        const maxX = Math.min(grid.width - 1, Math.ceil(cell.x + radius));
        const minY = Math.max(0, Math.floor(cell.y - radius));
        const maxY = Math.min(grid.height - 1, Math.ceil(cell.y + radius));

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const dx = x - cell.x;
                const dy = y - cell.y;
                if (dx * dx + dy * dy <= r2) {
                    const currentCell = grid.cell(x, y);
                    if (currentCell) cells.push(currentCell);
                }
            }
        }

        return cells;
    }

    /**
     * Compute field of view using ray-casting.
     */
    static fieldOfView(
        cell: LinkedCell,
        radius: number,
        blockFn: (lc: LinkedCell) => boolean = () => false
    ): LinkedCell[] {
        if (!cell.grid || cell.x < 0) return [];

        const visible = new Set<LinkedCell>();
        const grid = cell.grid;
        visible.add(cell);

        // Cast rays in all directions (simple raycasting FOV)
        const numRays = Math.max(8, Math.ceil(radius * 8));

        for (let i = 0; i < numRays; i++) {
            const angle = (2 * Math.PI * i) / numRays;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);

            let x = cell.x + 0.5;
            let y = cell.y + 0.5;

            for (let step = 0; step < radius; step++) {
                x += dx;
                y += dy;

                const cellX = Math.floor(x);
                const cellY = Math.floor(y);

                if (cellX < 0 || cellX >= grid.width ||
                    cellY < 0 || cellY >= grid.height) break;

                const currentCell = grid.cell(cellX, cellY);
                if (!currentCell) break;

                visible.add(currentCell);

                if (blockFn(currentCell)) break;
            }
        }

        return Array.from(visible);
    }

    /**
     * Compute field of view within a cone (directional vision).
     */
    static fieldOfViewCone(
        cell: LinkedCell,
        radius: number,
        direction: number,
        spread: number,
        blockFn: (lc: LinkedCell) => boolean = () => false
    ): LinkedCell[] {
        if (!cell.grid || cell.x < 0) return [];

        const visible = new Set<LinkedCell>();
        const grid = cell.grid;
        visible.add(cell);

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

            let x = cell.x + 0.5;
            let y = cell.y + 0.5;

            for (let step = 0; step < radius; step++) {
                x += dx;
                y += dy;

                const cellX = Math.floor(x);
                const cellY = Math.floor(y);

                if (cellX < 0 || cellX >= grid.width ||
                    cellY < 0 || cellY >= grid.height) break;

                const currentCell = grid.cell(cellX, cellY);
                if (!currentCell) break;

                visible.add(currentCell);

                if (blockFn(currentCell)) break;
            }
        }

        return Array.from(visible);
    }

    /**
     * Propagate light from this cell with intensity falloff.
     */
    static propagateLight(
        cell: LinkedCell,
        intensity: number,
        falloff: number,
        distanceLayer = 0,
        blockFn: (lc: LinkedCell) => boolean = () => false
    ): void {
        if (!cell.grid || cell.x < 0) return;

        // Calculate max radius based on when intensity reaches 0
        const maxRadius = Math.ceil(intensity / falloff);

        // Get visible cells
        const visible = LinkedCellUtils.fieldOfView(cell, maxRadius, blockFn);

        // Calculate and apply light intensity based on distance
        for (const visibleCell of visible) {
            const dx = visibleCell.x - cell.x;
            const dy = visibleCell.y - cell.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const lightValue = Math.max(0, intensity - distance * falloff);

            // Add to existing light (allows multiple light sources)
            const existing = visibleCell.distances[distanceLayer] ?? 0;
            visibleCell.distances[distanceLayer] = Math.max(existing, lightValue);
        }
    }

    /**
     * Apply fog of war visibility state using mask layers.
     */
    static applyFogOfWar(
        cell: LinkedCell,
        radius: number,
        blockFn: (lc: LinkedCell) => boolean = () => false,
        visibleMask = 4,
        revealedMask = 5
    ): void {
        if (!cell.grid) return;

        // Clear current visibility for all cells
        cell.grid.cells.forEach((c: LinkedCell) => {
            c.masks[visibleMask] = false;
        });

        // Get visible cells and mark them
        const visible = LinkedCellUtils.fieldOfView(cell, radius, blockFn);
        for (const visibleCell of visible) {
            visibleCell.masks[visibleMask] = true;
            visibleCell.masks[revealedMask] = true;
        }
    }

    /**
     * Find cells matching a predicate using BFS (breadth-first search).
     */
    static find(
        cell: LinkedCell,
        passFn: (lc: LinkedCell | null) => boolean,
        matchFn: (lc: LinkedCell | null) => boolean,
        maxRange = 10,
        findLimit = 1
    ): { cell: LinkedCell, dist: number }[] {
        const visited = new WeakSet<LinkedCell>();
        const lcs: { cell: LinkedCell, dist: number }[] = [{ cell, dist: 0 }];

        let ns = cell.neighbors();
        let nns: (LinkedCell | null)[] = [];
        let d = 0;

        const matches: { cell: LinkedCell, dist: number }[] = [];
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
                if (n && n !== cell && !visited.has(n) && passFn(n)) {
                    nns.push(...n.neighbors());
                    visited.add(n);
                    lcs.push({ cell: n, dist: d });
                }
            }
            ns = nns.filter(n => !!n);
            nns = [];
            if (d == maxRange) break;
            if (findLimitReached) break;
        }

        return matches;
    }

    /**
     * Find shortest path to a target using BFS pathfinding.
     */
    static findPath(
        cell: LinkedCell,
        passFn: (lc: LinkedCell | null) => boolean,
        matchFn: (lc: LinkedCell | null) => boolean,
        maxRange = 10
    ): LinkedCell[] {
        const visited = new WeakSet<LinkedCell>();
        const prev = new WeakMap<LinkedCell, LinkedCell>();
        visited.add(cell);

        let frontier: LinkedCell[] = [cell];
        let d = 0;
        let match: LinkedCell | null = null;

        while (frontier.length > 0) {
            if (d >= maxRange) break;
            d++;
            const nextFrontier: LinkedCell[] = [];

            for (const current of frontier) {
                for (const neighbor of current.neighbors()) {
                    if (neighbor && !visited.has(neighbor) && passFn(neighbor)) {
                        visited.add(neighbor);
                        prev.set(neighbor, current);
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

        const path: LinkedCell[] = [];
        if (match) {
            let current: LinkedCell | null = match;
            while (current && current !== cell) {
                path.unshift(current);
                current = prev.get(current) ?? null;
            }
        }

        return path;
    }

    /**
     * Get all neighbors within a range using BFS expansion.
     */
    static getNeighborsWithinRange(
        cell: LinkedCell,
        passFn: (lc: LinkedCell | null) => boolean,
        maxRange = 1
    ): { cell: LinkedCell, dist: number }[] {
        const visited = new WeakSet<LinkedCell>();
        const lcs: { cell: LinkedCell, dist: number }[] = [{ cell, dist: 0 }];

        let ns = cell.neighbors();
        let nns: (LinkedCell | null)[] = [];
        let d = 0;

        while (ns.length) {
            d++;
            ns.forEach(n => {
                if (n && n !== cell && !visited.has(n) && passFn(n)) {
                    nns.push(...n.neighbors());
                    visited.add(n);
                    lcs.push({ cell: n, dist: d });
                }
            });
            ns = nns.filter(n => !!n);
            nns = [];
            if (d == maxRange) break;
        }

        return lcs;
    }

    /**
     * Flood-fill distance values from this cell outward (Dijkstra map).
     */
    static setDistance(
        cell: LinkedCell,
        passFn: (lc: LinkedCell | null) => boolean,
        distLayer = 0,
        dist = 1,
        doAdd = false,
        maxRange = 50
    ) {
        const visited = new WeakSet<LinkedCell>();
        
        if (!doAdd) cell.distances[distLayer] = 0;
        const currentDist = cell.distances[distLayer] ?? 0;
        cell.distances[distLayer] = currentDist + dist;

        let ns = cell.neighbors();
        let nns: (LinkedCell | null)[] = [];
        let d = dist;

        while (ns.length) {
            d++;
            ns.forEach(n => {
                if (n && n !== cell && !visited.has(n) && passFn(n)) {
                    nns.push(...n.neighbors());
                    n.distances[distLayer] = d;
                    visited.add(n);
                }
            });
            ns = nns.filter(n => !!n);
            nns = [];
            if (d == maxRange) break;
        }
    }
}
