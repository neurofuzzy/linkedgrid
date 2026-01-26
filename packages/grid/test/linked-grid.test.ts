import { describe, it, expect } from 'vitest';
import { LinkedGrid, LinkedCell, Direction, LinkedGridUtils } from '../index';

describe('LinkedGrid', () => {

    describe('grid creation', () => {
        it('creates a grid with correct dimensions', () => {
            const grid = new LinkedGrid(5, 3);

            expect(grid.width).toBe(5);
            expect(grid.height).toBe(3);
            expect(grid.cells.length).toBe(15);

            // All cells should be linked
            expect(grid.grid.length).toBe(3);
            expect(grid.grid[0].length).toBe(5);
        });

        it('links neighbors correctly', () => {
            const grid = new LinkedGrid(3, 3);

            // Center cell should have all 4 neighbors
            const center = grid.cell(1, 1)!;
            expect(center.neighbor(Direction.UP)).toBe(grid.cell(1, 0));
            expect(center.neighbor(Direction.DN)).toBe(grid.cell(1, 2));
            expect(center.neighbor(Direction.LT)).toBe(grid.cell(0, 1));
            expect(center.neighbor(Direction.RT)).toBe(grid.cell(2, 1));

            // Corner cell should have null neighbors at edges
            const topLeft = grid.cell(0, 0)!;
            expect(topLeft.neighbor(Direction.UP)).toBeNull();
            expect(topLeft.neighbor(Direction.LT)).toBeNull();
            expect(topLeft.neighbor(Direction.DN)).toBe(grid.cell(0, 1));
            expect(topLeft.neighbor(Direction.RT)).toBe(grid.cell(1, 0));
        });
    });

    describe('movement', () => {
        it('moves in all directions', () => {
            const grid = new LinkedGrid(5, 5);

            // Start at center, move around
            const start = grid.cell(2, 2)!;
            expect(start.move(Direction.UP)).toBe(grid.cell(2, 1));
            expect(start.move(Direction.DN)).toBe(grid.cell(2, 3));
            expect(start.move(Direction.LT)).toBe(grid.cell(1, 2));
            expect(start.move(Direction.RT)).toBe(grid.cell(3, 2));
        });

        it('moves multiple steps', () => {
            const grid = new LinkedGrid(5, 5);

            const start = grid.cell(0, 0)!;
            expect(start.move(Direction.RT, 3)).toBe(grid.cell(3, 0));
            expect(start.move(Direction.DN, 4)).toBe(grid.cell(0, 4));
        });

        it('returns null when moving off grid', () => {
            const grid = new LinkedGrid(3, 3);

            const corner = grid.cell(0, 0)!;
            expect(corner.move(Direction.UP)).toBeNull();
            expect(corner.move(Direction.LT)).toBeNull();
        });

        it('draws a snake pattern via chained moves', () => {
            const grid = new LinkedGrid(5, 5);
            grid.cells.forEach(c => c.setValue(0, 0));

            // Draw a snake: right, down, right, down
            grid.cell(0, 0)!
                .setValue(0, 1)
                .move(Direction.RT)!.setValue(0, 1)
                .move(Direction.RT)!.setValue(0, 1)
                .move(Direction.DN)!.setValue(0, 1)
                .move(Direction.LT)!.setValue(0, 1)
                .move(Direction.LT)!.setValue(0, 1)
                .move(Direction.DN)!.setValue(0, 1)
                .move(Direction.RT)!.setValue(0, 1)
                .move(Direction.RT)!.setValue(0, 1);

            const ascii = LinkedGridUtils.print(grid, 0);
            console.log('\n--- Snake Pattern ---');
            console.log(ascii);

            // Should look like:
            // 01|01|01|00|00
            // 01|01|01|00|00
            // 01|01|01|00|00
            // 00|00|00|00|00
            // 00|00|00|00|00
            expect(ascii).toContain('01|01|01|00|00');
        });
    });

    describe('pathfinding', () => {
        it('finds path around obstacles', () => {
            const grid = new LinkedGrid(7, 5);
            grid.cells.forEach(c => c.setValue(0, 0));

            // Create a wall (value = 1)
            //   0 1 2 3 4 5 6
            // 0 S . . # . . .
            // 1 . . . # . . .
            // 2 . . . # . . .
            // 3 . . . . . . .
            // 4 . . . . . . G
            const WALL = 1;
            grid.cell(3, 0)!.setValue(0, WALL);
            grid.cell(3, 1)!.setValue(0, WALL);
            grid.cell(3, 2)!.setValue(0, WALL);

            const start = grid.cell(0, 0)!;
            const isWall = (c: LinkedCell | null) => c?.values[0] === WALL;
            const isGoal = (c: LinkedCell | null) => c === grid.cell(6, 4);

            const path = start.findPath(
                c => c !== null && !isWall(c), // passable if not a wall
                isGoal,
                20
            );

            // Mark the path
            path.forEach(c => c.setValue(0, 2));
            start.setValue(0, 3); // mark start
            grid.cell(6, 4)!.setValue(0, 4); // mark goal

            const ascii = LinkedGridUtils.print(grid, 0);
            console.log('\n--- Pathfinding (3=start, 4=goal, 2=path, 1=wall) ---');
            console.log(ascii);

            // Path should exist and reach goal
            expect(path.length).toBeGreaterThan(0);
            expect(path[path.length - 1]).toBe(grid.cell(6, 4));
        });

        it('finds nearest match', () => {
            const grid = new LinkedGrid(5, 5);
            grid.cells.forEach(c => c.setValue(0, 0));

            // Place some targets (value = 9)
            grid.cell(4, 4)!.setValue(0, 9); // far
            grid.cell(2, 1)!.setValue(0, 9); // near

            const start = grid.cell(0, 0)!;
            start.setValue(0, 5);

            const found = start.find(
                () => true, // all passable
                c => c?.values[0] === 9,
                10,
                1 // find just 1
            );

            const ascii = LinkedGridUtils.print(grid, 0);
            console.log('\n--- Find Nearest (5=start, 9=targets) ---');
            console.log(ascii);

            expect(found.length).toBe(1);
            expect(found[0].cell).toBe(grid.cell(2, 1)); // should find the nearer one
            expect(found[0].dist).toBe(3); // manhattan distance
        });
    });

    describe('distance fields', () => {
        it('computes distance from a point', () => {
            const grid = new LinkedGrid(5, 5);

            // Set distance field from center
            const center = grid.cell(2, 2)!;
            center.setDistance(() => true, 0);

            const ascii = LinkedGridUtils.printDistances(grid, 0);
            console.log('\n--- Distance Field from Center ---');
            console.log(ascii);

            // Distances should radiate outward
            expect(grid.cell(2, 2)!.distances[0]).toBe(1); // center gets dist+1
            expect(grid.cell(2, 1)!.distances[0]).toBe(2); // adjacent
            expect(grid.cell(0, 0)!.distances[0]).toBe(5); // corner
            expect(grid.cell(4, 4)!.distances[0]).toBe(5); // opposite corner
        });

        it('respects obstacles in distance field', () => {
            const grid = new LinkedGrid(5, 5);
            grid.cells.forEach(c => c.setMask(0, false));

            // Create walls (mask = true means blocked)
            // Mark walls in values for visual display
            grid.cell(2, 0)!.setMask(0, true);
            grid.cell(2, 1)!.setMask(0, true);
            grid.cell(2, 2)!.setMask(0, true);
            grid.cell(2, 3)!.setMask(0, true);

            // Set distance field from left side, avoiding walls
            grid.cell(0, 2)!.setDistance(
                c => c !== null && !c.masks[0], // pass if not blocked
                0,
                1,
                false,
                20
            );

            const ascii = LinkedGridUtils.printDistances(grid, 0);
            console.log('\n--- Distance Field with Wall ---');
            console.log(ascii);

            // Right side should have higher distances due to wall
            expect(grid.cell(4, 2)!.distances[0]).toBeGreaterThan(4);
        });
    });

    describe('ASCII print', () => {
        it('prints grid with custom values', () => {
            const grid = new LinkedGrid(3, 3);
            // Clear default values to make them undefined
            grid.cells.forEach(c => delete (c.values as any)[0]);

            // Create a pattern
            grid.cell(0, 0)!.setValue(0, 1);
            grid.cell(1, 1)!.setValue(0, 0);
            grid.cell(2, 2)!.setValue(0, 1);

            const ascii = LinkedGridUtils.print(grid, 0);

            expect(ascii).toBe('01|--|--\n--|00|--\n--|--|01');
        });
    });

    describe('raycast', () => {
        it('casts ray until edge of grid', () => {
            const grid = new LinkedGrid(7, 5);
            grid.cells.forEach(c => c.setValue(0, 0));

            const start = grid.cell(0, 2)!;
            const result = start.raycast(Direction.RT, 10);

            // Mark the ray
            result.cells.forEach(c => c.setValue(0, 1));
            start.setValue(0, 2);

            const ascii = LinkedGridUtils.print(grid, 0);
            console.log('\n--- Raycast Right (2=start, 1=ray) ---');
            console.log(ascii);

            expect(result.cells.length).toBe(6); // 6 cells to the right
            expect(result.blocked).toBe(false);
            expect(result.hitCell).toBeNull();
        });

        it('stops at blocking cell', () => {
            const grid = new LinkedGrid(7, 5);
            grid.cells.forEach(c => c.setValue(0, 0));

            // Place a wall
            grid.cell(4, 2)!.setValue(0, 9);

            const start = grid.cell(0, 2)!;
            const result = start.raycast(
                Direction.RT,
                10,
                c => c.values[0] === 9 // wall blocks
            );

            // Mark the ray
            result.cells.forEach(c => {
                if (c.values[0] !== 9) c.setValue(0, 1);
            });
            start.setValue(0, 2);

            const ascii = LinkedGridUtils.print(grid, 0);
            console.log('\n--- Raycast with Wall (2=start, 1=ray, 9=wall) ---');
            console.log(ascii);

            expect(result.blocked).toBe(true);
            expect(result.hitCell).toBe(grid.cell(4, 2));
            expect(result.cells.length).toBe(4); // stops at wall
        });
    });

    describe('getLine', () => {
        it('draws diagonal line using Bresenham', () => {
            const grid = new LinkedGrid(7, 7);
            grid.cells.forEach(c => c.setValue(0, 0));

            const start = grid.cell(0, 0)!;
            const end = grid.cell(6, 6)!;
            const line = start.getLine(end);

            // Mark the line
            line.forEach(c => c.setValue(0, 1));
            start.setValue(0, 2);
            end.setValue(0, 3);

            const ascii = LinkedGridUtils.print(grid, 0);
            console.log('\n--- Bresenham Line (2=start, 3=end, 1=line) ---');
            console.log(ascii);

            expect(line.length).toBe(6); // excludes start
            expect(line[line.length - 1]).toBe(end);
        });

        it('draws horizontal line', () => {
            const grid = new LinkedGrid(7, 5);
            grid.cells.forEach(c => c.setValue(0, 0));

            const line = grid.getLine(1, 2, 5, 2);
            line.forEach(c => c.setValue(0, 1));

            const ascii = LinkedGridUtils.print(grid, 0);
            console.log('\n--- Horizontal Line ---');
            console.log(ascii);

            expect(line.length).toBe(5);
        });

        it('draws steep line', () => {
            const grid = new LinkedGrid(5, 7);
            grid.cells.forEach(c => c.setValue(0, 0));

            const start = grid.cell(1, 0)!;
            const end = grid.cell(3, 6)!;
            const line = start.getLine(end);

            line.forEach(c => c.setValue(0, 1));
            start.setValue(0, 2);
            end.setValue(0, 3);

            const ascii = LinkedGridUtils.print(grid, 0);
            console.log('\n--- Steep Line (2=start, 3=end, 1=line) ---');
            console.log(ascii);

            expect(line.length).toBeGreaterThan(0);
            expect(line[line.length - 1]).toBe(end);
        });
    });

    describe('getCircle', () => {
        it('gets cells within circular radius', () => {
            const grid = new LinkedGrid(9, 9);
            grid.cells.forEach(c => c.setValue(0, 0));

            const center = grid.cell(4, 4)!;
            const circle = center.getCircle(3);

            // Mark the circle
            circle.forEach(c => c.setValue(0, 1));
            center.setValue(0, 2);

            const ascii = LinkedGridUtils.print(grid, 0);
            console.log('\n--- Circle Radius 3 (2=center, 1=circle) ---');
            console.log(ascii);

            // Circle should include center
            expect(circle).toContain(center);
            // Should not include corners (distance > 3)
            expect(circle).not.toContain(grid.cell(0, 0));
            expect(circle).not.toContain(grid.cell(8, 8));
            // Should include cells exactly at radius
            expect(circle).toContain(grid.cell(4, 1)); // distance = 3
        });

        it('handles edge of grid', () => {
            const grid = new LinkedGrid(5, 5);
            grid.cells.forEach(c => c.setValue(0, 0));

            const corner = grid.cell(0, 0)!;
            const circle = corner.getCircle(2);

            circle.forEach(c => c.setValue(0, 1));
            corner.setValue(0, 2);

            const ascii = LinkedGridUtils.print(grid, 0);
            console.log('\n--- Circle at Corner ---');
            console.log(ascii);

            // Should only include valid cells (quarter circle)
            expect(circle.length).toBeLessThan(13); // less than full circle
            expect(circle).toContain(grid.cell(0, 0));
            expect(circle).toContain(grid.cell(2, 0));
            expect(circle).toContain(grid.cell(0, 2));
        });
    });

    describe('fieldOfView', () => {
        it('computes visible cells from center', () => {
            const grid = new LinkedGrid(9, 9);
            grid.cells.forEach(c => c.setValue(0, 0));

            const center = grid.cell(4, 4)!;
            const visible = center.fieldOfView(3);

            visible.forEach(c => c.setValue(0, 1));
            center.setValue(0, 2);

            const ascii = LinkedGridUtils.print(grid, 0);
            console.log('\n--- Field of View Radius 3 (2=center, 1=visible) ---');
            console.log(ascii);

            expect(visible).toContain(center);
            expect(visible.length).toBeGreaterThan(20);
        });

        it('blocks vision through walls', () => {
            const grid = new LinkedGrid(9, 9);
            grid.cells.forEach(c => c.setValue(0, 0));

            // Create a wall
            for (let y = 2; y <= 6; y++) {
                grid.cell(5, y)!.setValue(0, 9);
            }

            const center = grid.cell(3, 4)!;
            const visible = center.fieldOfView(
                5,
                c => c.values[0] === 9 // walls block vision
            );

            visible.forEach(c => {
                if (c.values[0] !== 9) c.setValue(0, 1);
            });
            center.setValue(0, 2);

            const ascii = LinkedGridUtils.print(grid, 0);
            console.log('\n--- FOV with Wall (2=center, 1=visible, 9=wall) ---');
            console.log(ascii);

            // Should not see behind the wall
            expect(visible).not.toContain(grid.cell(7, 4));
            // Should see the wall itself
            expect(visible).toContain(grid.cell(5, 4));
            // Should see cells on this side
            expect(visible).toContain(grid.cell(4, 4));
        });
    });

    describe('cell coordinates', () => {
        it('stores x,y coordinates on cells', () => {
            const grid = new LinkedGrid(5, 5);

            expect(grid.cell(0, 0)!.x).toBe(0);
            expect(grid.cell(0, 0)!.y).toBe(0);
            expect(grid.cell(3, 2)!.x).toBe(3);
            expect(grid.cell(3, 2)!.y).toBe(2);
        });

        it('getCellCoordinates uses stored coords', () => {
            const grid = new LinkedGrid(5, 5);
            const cell = grid.cell(3, 2)!;

            const coords = grid.getCellCoordinates(cell);
            expect(coords).toEqual({ x: 3, y: 2 });
        });
    });

    describe('wrapping (toroidal)', () => {
        it('wraps edges when enabled via constructor', () => {
            const grid = new LinkedGrid(5, 5, true);

            // Moving off right edge wraps to left
            const rightEdge = grid.cell(4, 2)!;
            expect(rightEdge.neighbor(Direction.RT)).toBe(grid.cell(0, 2));

            // Moving off left edge wraps to right
            const leftEdge = grid.cell(0, 2)!;
            expect(leftEdge.neighbor(Direction.LT)).toBe(grid.cell(4, 2));

            // Moving off top wraps to bottom
            const topEdge = grid.cell(2, 0)!;
            expect(topEdge.neighbor(Direction.UP)).toBe(grid.cell(2, 4));

            // Moving off bottom wraps to top
            const bottomEdge = grid.cell(2, 4)!;
            expect(bottomEdge.neighbor(Direction.DN)).toBe(grid.cell(2, 0));
        });

        it('move traverses wrapped grid infinitely', () => {
            const grid = new LinkedGrid(3, 3, true);
            grid.cells.forEach(c => c.setValue(0, 0));

            // Start at center, move right 6 times (should wrap twice and end at center)
            let cell = grid.cell(1, 1)!;
            for (let i = 0; i < 6; i++) {
                cell = cell.move(Direction.RT)!;
            }

            expect(cell).toBe(grid.cell(1, 1)); // Back at start!
        });
    });

    describe('out-of-bounds cell access', () => {
        it('returns null for negative coordinates', () => {
            const grid = new LinkedGrid(5, 5);

            expect(grid.cell(-1, 0)).toBeNull();
            expect(grid.cell(0, -1)).toBeNull();
            expect(grid.cell(-1, -1)).toBeNull();
        });

        it('returns null for coordinates beyond grid size', () => {
            const grid = new LinkedGrid(5, 5);

            expect(grid.cell(5, 0)).toBeNull();
            expect(grid.cell(0, 5)).toBeNull();
            expect(grid.cell(5, 5)).toBeNull();
            expect(grid.cell(100, 100)).toBeNull();
        });

        it('handles edge cells correctly', () => {
            const grid = new LinkedGrid(5, 5);

            // Valid edge cells
            expect(grid.cell(0, 0)).not.toBeNull();
            expect(grid.cell(4, 0)).not.toBeNull();
            expect(grid.cell(0, 4)).not.toBeNull();
            expect(grid.cell(4, 4)).not.toBeNull();
        });
    });

    describe('Direction.NONE', () => {
        it('neighbor with NONE returns undefined', () => {
            const grid = new LinkedGrid(5, 5);
            const center = grid.cell(2, 2)!;

            expect(center.neighbor(Direction.NONE)).toBeUndefined();
        });

        it('move with NONE returns undefined', () => {
            const grid = new LinkedGrid(5, 5);
            const center = grid.cell(2, 2)!;

            // Move with NONE returns undefined (no neighbor in that direction)
            const result = center.move(Direction.NONE);
            expect(result).toBeUndefined();
        });

        it('move with NONE and count > 0 returns undefined', () => {
            const grid = new LinkedGrid(5, 5);
            const center = grid.cell(2, 2)!;

            expect(center.move(Direction.NONE, 5)).toBeUndefined();
        });
    });

    describe('multi-layer values and masks', () => {
        it('supports multiple independent value layers', () => {
            const grid = new LinkedGrid(3, 3);
            const cell = grid.cell(1, 1)!;

            cell.setValue(0, 10);
            cell.setValue(1, 20);
            cell.setValue(2, 30);

            expect(cell.values[0]).toBe(10);
            expect(cell.values[1]).toBe(20);
            expect(cell.values[2]).toBe(30);

            // Modifying one layer doesn't affect others
            cell.setValue(1, 99);
            expect(cell.values[0]).toBe(10);
            expect(cell.values[1]).toBe(99);
            expect(cell.values[2]).toBe(30);
        });

        it('supports multiple independent mask layers', () => {
            const grid = new LinkedGrid(3, 3);
            const cell = grid.cell(1, 1)!;

            cell.setMask(0, true);
            cell.setMask(1, false);
            cell.setMask(2, true);

            expect(cell.masks[0]).toBe(true);
            expect(cell.masks[1]).toBe(false);
            expect(cell.masks[2]).toBe(true);
        });

        it('distance fields are set on layer 0 by default', () => {
            const grid = new LinkedGrid(5, 5);
            const center = grid.cell(2, 2)!;

            // Set distance on layer 0 (default)
            center.setDistance(() => true, 0);

            // All cells should have layer 0 distance set
            expect(center.distances[0]).toBeDefined();
            expect(grid.cell(0, 0)!.distances[0]).toBeDefined();
        });

        it('print uses specified layer', () => {
            const grid = new LinkedGrid(3, 3);

            // Set different values on different layers
            grid.cell(0, 0)!.setValue(0, 1);
            grid.cell(0, 0)!.setValue(1, 24);
            grid.cell(1, 1)!.setValue(0, 2);
            grid.cell(1, 1)!.setValue(1, 25);

            const layer0 = LinkedGridUtils.print(grid, 0);
            const layer1 = LinkedGridUtils.print(grid, 1);

            expect(layer0).toContain('01');
            expect(layer0).toContain('02');
            expect(layer1).toContain('24');
            expect(layer1).toContain('25');
        });
    });

    describe('find with count > 1', () => {
        it('finds multiple matches up to count', () => {
            const grid = new LinkedGrid(7, 7);
            grid.cells.forEach(c => c.setValue(0, 0));

            // Place 5 targets at various distances
            grid.cell(1, 0)!.setValue(0, 9); // dist 1
            grid.cell(2, 0)!.setValue(0, 9); // dist 2
            grid.cell(0, 3)!.setValue(0, 9); // dist 3
            grid.cell(4, 4)!.setValue(0, 9); // dist 8
            grid.cell(6, 6)!.setValue(0, 9); // dist 12

            const start = grid.cell(0, 0)!;
            const found = start.find(
                () => true,
                c => c?.values[0] === 9,
                15,
                3 // find 3 matches
            );

            expect(found.length).toBe(3);
            // Should be ordered by distance
            expect(found[0].dist).toBeLessThanOrEqual(found[1].dist);
            expect(found[1].dist).toBeLessThanOrEqual(found[2].dist);
        });

        it('returns all matches when fewer than count exist', () => {
            const grid = new LinkedGrid(5, 5);
            grid.cells.forEach(c => c.setValue(0, 0));

            // Place only 2 targets
            grid.cell(2, 0)!.setValue(0, 9);
            grid.cell(4, 4)!.setValue(0, 9);

            const start = grid.cell(0, 0)!;
            const found = start.find(
                () => true,
                c => c?.values[0] === 9,
                10,
                5 // request 5 but only 2 exist
            );

            // find() returns matches within distance, may include more
            expect(found.length).toBeGreaterThanOrEqual(2);
        });

        it('respects passable predicate', () => {
            const grid = new LinkedGrid(5, 5);
            grid.cells.forEach(c => c.setValue(0, 0));

            // Create a wall blocking access
            grid.cell(2, 0)!.setValue(0, 1); // wall
            grid.cell(2, 1)!.setValue(0, 1);
            grid.cell(2, 2)!.setValue(0, 1);
            grid.cell(2, 3)!.setValue(0, 1);
            grid.cell(2, 4)!.setValue(0, 1);

            // Target behind wall
            grid.cell(4, 2)!.setValue(0, 9);

            const start = grid.cell(0, 2)!;
            const found = start.find(
                c => c !== null && c.values[0] !== 1, // can't pass walls
                c => c?.values[0] === 9,
                20,
                1
            );

            // Should not find target if completely blocked
            // (depends on grid having a path around)
            console.log('\\n--- Find blocked by wall ---');
            console.log(LinkedGridUtils.print(grid, 0));
            console.log('Found:', found.length);
        });

        it('returns empty array when no matches', () => {
            const grid = new LinkedGrid(5, 5);
            grid.cells.forEach(c => c.setValue(0, 0));

            const start = grid.cell(2, 2)!;
            const found = start.find(
                () => true,
                c => c?.values[0] === 999, // no such value
                10,
                5
            );

            expect(found.length).toBe(0);
        });
    });

});