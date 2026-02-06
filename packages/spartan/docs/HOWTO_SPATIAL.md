# Working with Spatial Queries and Updates

The `SpatialSystem` is your primary interface for interacting with the game world. It handles entity positioning, movement, collision detection, and spatial queries.

## Key Concept: Deferred Execution

Updates (move, spawn, remove) are **staged** immediately but **executed** only when `commit()` is called (automatically at the end of every tick).

- **Reads are immediate**: `getPosition()`, `getEntityData()` return the current committed state.
- **Writes are deferred**: `move()`, `spawn()`, `remove()` queue intents for the next commit.

## Reading the World

### Check Entity State

```typescript
const pos = spatial.getPosition(entityId);    // { x, y, layer } or null
const data = spatial.getEntityData(entityId);  // EntityData or undefined
const alive = spatial.isAlive(entityId);       // false if pending removal
```

### Point Queries

```typescript
// Specific layer check
const actorId = spatial.getEntityIdAt(x, y, GameLayers.ACTORS);

// Get all entities in a cell (all layers)
const allIds = spatial.getEntityIdsInCell(x, y);
```

### Area Queries

```typescript
// Circular radius (Euclidean distance)
const nearbyIds = spatial.getEntityIdsInRadius(x, y, 3.5);

// Line of sight (Bresenham line)
const lineIds = spatial.getEntityIdsInLine(startX, startY, endX, endY);
```

### Validation Queries

```typescript
spatial.isBlocked(cell);       // Walls or actors present?
spatial.blocksVision(cell);    // Walls present?
spatial.isWalkable(cell);      // Not blocked?
```

## Modifying the World

### Moving Entities

```typescript
// Stage a move (validated during commit)
spatial.move(entityId, newX, newY);

// Move by entity ID (looks up current position)
spatial.moveEntity(entityId, newX, newY);
```

### Spawning and Removing

```typescript
// Spawn: returns ID immediately, entity appears after commit
const id = spatial.spawn('enemy', x, y, GameLayers.ACTORS, {
  hp: 100, maxHp: 100, healthState: 'alive', team: 'enemy',
});

// Remove: marks as "not alive" immediately, removed from grid after commit
spatial.remove(entityId);

// Remove by position
spatial.removeAt(x, y, GameLayers.WALLS);
```

### Inspecting Pending Operations

```typescript
const pendingOps = spatial.getPendingOps();
for (const op of pendingOps) {
  if (op.type === 'move' && op.entityId === playerId) {
    // React to player's movement intent
    const destCell = spatial.getGrid().cell(op.toX!, op.toY!);
  }
}

const pendingRemovals = spatial.getPendingRemovals();
// Set of entity IDs staged for removal
```

## Common Patterns

### Handling Overlaps (Collision)

Overlaps are detected at the start of each tick and passed via `GameContext`:

```typescript
class MySystem extends BaseReactiveSystem {
  update({ overlaps, spatial }: GameContext) {
    for (const { entityIds, position } of overlaps) {
      const player = entityIds.find(id => isPlayer(spatial.getEntityData(id)));
      const coin = entityIds.find(id => isCoin(spatial.getEntityData(id)));

      if (player && coin) {
        // Collect the coin
        spatial.remove(coin);
      }
    }
  }
}
```

### Checking Line of Sight

```typescript
function canSee(spatial: SpatialSystem, fromId: number, toId: number): boolean {
  const start = spatial.getPosition(fromId);
  const end = spatial.getPosition(toId);
  if (!start || !end) return false;

  const startCell = spatial.getGrid().cell(start.x, start.y);
  if (!startCell) return false;

  const lineOfSight = startCell.raycast(
    /* direction calculated from start to end */,
    Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)),
    (cell) => spatial.blocksVision(cell)
  );

  // Check if end position is reached without obstruction
  return lineOfSight.some(c => c.x === end.x && c.y === end.y);
}
```

## Advanced Patterns

### Two-Phase Updates (Simulation Logic)

When entities affect their neighbors (fire spread, liquid flow), updates must be order-independent to prevent scanning bias.

1. **Calculate Phase**: Determine all changes based on *current* state. Store deltas in a temporary Map.
2. **Apply Phase**: Iterate through the Map and apply changes.

```typescript
// Phase 1: Calculate
const tempChanges = new Map<number, number>();
for (const [id, pos] of spatial.getAllPositions()) {
  const entity = spatial.getEntityData(id);
  if (!hasTemperature(entity)) continue;
  // Calculate temperature delta from neighbors
  tempChanges.set(id, delta);
}

// Phase 2: Apply
for (const [id, delta] of tempChanges) {
  const entity = spatial.getEntityData(id);
  if (entity && hasTemperature(entity)) {
    entity.temperature += delta;
  }
}
```

### Entity Transformation (Changing Layers)

To move an entity between layers (e.g., opening a door from WALLS to FLOOR), remove and respawn with the same ID:

```typescript
if (shouldOpen) {
  const oldData = spatial.getEntityData(entityId);
  spatial.getStore().remove(entityId);
  spatial.remove(entityId);

  spatial.spawnWithId(
    entityId,
    'door-open',
    x, y,
    GameLayers.FLOOR,  // Non-blocking layer
    { ...oldData, isOpen: true }
  );
}
```

### Graph Algorithms (Flood Fill)

Use the grid for signal propagation, pathfinding, or area effects:

```typescript
const queue = [{ x: startX, y: startY }];
const visited = new Set<string>();

while (queue.length > 0) {
  const { x, y } = queue.shift()!;
  const cell = spatial.getGrid().cell(x, y);
  if (!cell) continue;

  const key = `${x},${y}`;
  if (visited.has(key)) continue;
  visited.add(key);

  // Process cell...

  // Check 4-directional neighbors
  for (const dir of [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]) {
    const neighbor = cell.neighbor(dir);
    if (neighbor && !visited.has(`${neighbor.x},${neighbor.y}`)) {
      queue.push({ x: neighbor.x, y: neighbor.y });
    }
  }
}
```

### Visual Effects Lifecycle

Spawn ephemeral entities with a lifetime:

```typescript
spatial.spawn('explosion-visual', x, y, GameLayers.EPHEMERALS, {
  spawnTick: currentTick,
  lifetime: 5,
  color: '#ff4400',
});

// In cleanup phase of your system:
if (currentTick - entity.spawnTick > entity.lifetime) {
  spatial.remove(entityId);
}
```

### Advanced Field of View

For area effects blocked by walls (explosions, lighting):

```typescript
import { LinkedCellUtils } from '../core/grid/linked-cell-utils';

const center = spatial.getGrid().cell(x, y);
const visibleCells = LinkedCellUtils.fieldOfView(
  center,
  radius,
  (cell) => spatial.blocksVision(cell)
);
```

For cone-shaped effects (shotgun blast):

```typescript
const coneCells = center.fieldOfViewCone(
  Direction.UP,  // direction
  90,            // angle in degrees
  5,             // range
  (cell) => spatial.blocksVision(cell)
);
```

## API Quick Reference

### Lifecycle (deferred)
| Method | Returns | Description |
| :--- | :--- | :--- |
| `spawn(type, x, y, layer, data?)` | `number` | Stage spawn, returns entity ID |
| `spawnWithId(id, type, x, y, layer, data?)` | `boolean` | Stage spawn with specific ID |
| `remove(entityId)` | `void` | Stage removal |
| `removeAt(x, y, layer)` | `boolean` | Stage removal by position |
| `commit()` | `void` | Execute all staged operations |

### Queries (immediate)
| Method | Returns | Description |
| :--- | :--- | :--- |
| `getEntityData(id)` | `EntityData?` | Get entity metadata |
| `getPosition(id)` | `{x,y,layer}?` | Get entity position |
| `getEntityIdAt(x, y, layer)` | `number?` | Entity at cell+layer |
| `getEntityIdsInCell(x, y)` | `number[]` | All entities at cell |
| `getEntityIdsInRadius(x, y, r)` | `number[]` | Entities within radius |
| `getEntityIdsInLine(x1, y1, x2, y2)` | `number[]` | Entities along line |
| `isAlive(id)` | `boolean` | Not pending removal? |
| `isBlocked(cell)` | `boolean` | Has blocking entity? |
| `blocksVision(cell)` | `boolean` | Blocks line of sight? |

### Inspection
| Method | Returns | Description |
| :--- | :--- | :--- |
| `getPendingOps()` | `PendingOperation[]` | All staged intents |
| `getPendingRemovals()` | `Set<number>` | Entity IDs pending removal |
| `getAllPositions()` | `Iterator` | All tracked positions |

## See Also

- [REFERENCE.md](./REFERENCE.md) -- Full framework reference
- [core/spatial-system.ts](../core/spatial-system.ts) -- SpatialSystem implementation
- [core/grid/linked-cell.ts](../core/grid/linked-cell.ts) -- LinkedCell with algorithms
- [core/grid/linked-cell-utils.ts](../core/grid/linked-cell-utils.ts) -- Utility algorithms
- [specs/visual-test-timing-guide.md](../../../specs/visual-test-timing-guide.md) -- Timing patterns
