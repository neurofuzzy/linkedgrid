# linkedgrid

A linked-cell grid data structure for tile-based 2D games with pathfinding, distance fields, and spatial queries.

## Features

### Core Grid (`packages/grid/`)
- **LinkedGrid**: 2D grid with O(1) neighbor navigation
- **LinkedCell**: Cells with direct references to UP, DOWN, LEFT, RIGHT neighbors
- **Pathfinding**: BFS pathfinding with customizable predicates
- **Raycasting**: Cast rays in cardinal directions with blocking detection
- **Field of View**: Ray-casting FOV with vision blocking
- **Spatial Queries**: Line drawing (Bresenham), circular radius, distance fields
- **Distance Fields**: Dijkstra maps for AI and influence systems

### Spartan Framework (`packages/spartan/`)
Cell-centric game framework (Architecture B) built on LinkedGrid:
- **SparseEntityStore**: Minimal entity metadata storage
- **SpatialSystem**: Spatial-first entity operations (spawn, move, queries)
- **Layer-based occupation**: Multiple entities per cell on different layers
- **Overlap detection**: No collision, only overlap events
- **Spatial queries**: Radius, line-of-sight, area effects

## Installation

```bash
npm install linkedgrid
```

## Quick Start

### Grid Usage

```typescript
import { LinkedGrid, Direction } from 'linkedgrid';

// Create a 20x20 grid
const grid = new LinkedGrid(20, 20);

// Access cells
const cell = grid.cell(10, 10);

// Navigate via neighbor links (O(1))
const rightCell = cell.move(Direction.RT);
const upTwoCell = cell.move(Direction.UP, 2);

// Pathfinding
const path = cell.findPath(
  c => c?.values[0] !== WALL,  // Can pass through
  c => c === targetCell         // Destination
);

// Field of view
const visible = cell.fieldOfView(10, c => c.values[0] === WALL);

// Raycasting
const ray = cell.raycast(Direction.RT, 10, c => c.values[0] === WALL);
```

### Spartan Framework Usage

```typescript
import { LinkedGrid } from 'linkedgrid';
import { SparseEntityStore, SpatialSystem } from 'linkedgrid/spartan';

// Setup
const grid = new LinkedGrid(20, 20);
const store = new SparseEntityStore();
const spatial = new SpatialSystem(grid, store);

// Spawn entities
const player = spatial.spawn('player', 10, 10, 1, { hp: 100 });
const enemy = spatial.spawn('enemy', 15, 10, 2, { hp: 50 });

// Move entities
if (spatial.move(10, 10, 11, 10, 1)) {
  console.log('Player moved');
}

// Spatial queries
const nearby = spatial.getEntityIdsInRadius(11, 10, 5);
const inLine = spatial.getEntityIdsInLine(11, 10, 15, 10);

// Overlap detection
const overlapping = spatial.getEntityIdsInCell(11, 10);
for (const id of overlapping) {
  const data = spatial.getEntityData(id);
  console.log(`Entity ${id} type: ${data.type}`);
}
```

## Spartan Framework Rules

The Spartan framework follows these core principles:

1. Entities can only occupy one cell at a time
2. Entities occupy a layer on a cell
3. Check destination before moving
4. Multiple entities per cell on different layers
5. Spatial queries are first-class operations
6. Clean up old cell when entity moves
7. Overlap detection, not collision
8. Higher layer indexes are "on top of" lower ones
9. Overlap events propagate down layer indexes
10. LinkedCells never move (immutable positions)

## Architecture

See [specs/architecture-alternatives.md](specs/architecture-alternatives.md) for detailed architecture documentation.

The Spartan framework implements **Architecture B** (Cell-Centric):
- Entities stored primarily in cell layers
- Minimal external metadata storage
- Spatial operations are O(1) or O(cells in query)
- Scales well for spatial games

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Visual test runner (opens in browser)
npm run dev

# Build
npm run build

# Lint
npm run lint
```

## Visual Test Runner

The spartan visual test runner lets you see and step through test execution:

```bash
npm run dev
# Opens http://localhost:5183/dev/visual-runner.html
```

**Features:**
- Click any test to run it
- Step through operations one at a time
- Auto-play with configurable interval
- See grid state changes visually

**Writing Visual Tests:**

```typescript
import { visual } from './visual-helpers';

visual('player moves right 3 times', ({ spatial }) => {
  spatial.spawn('player', 5, 5, 1, { hp: 100 });
  spatial.move(5, 5, 6, 5, 1);
  spatial.move(6, 5, 7, 5, 1);
  spatial.move(7, 5, 8, 5, 1);
});
```

Visual tests also run as normal Vitest tests in CI.

## License

MIT

