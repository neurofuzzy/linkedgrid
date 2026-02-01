# Working with Spatial Queries & Updates

The `SpatialSystem` is your primary interface for interacting with the game world. It handles entity positioning, movement, collision detection, and spatial queries.

## Key Concept: Deferred Execution

Updates (move, spawn, remove) are **staged** immediately but **executed** only when `commit()` is called (automatically at the end of every tick).
*   **Reads are immediate**: `getPosition()` returns the current state.
*   **Writes are deferred**: `move()` queues a change for the next frame.

## Reading the World

### Check Entity State
```typescript
const pos = spatial.getPosition(entityId); // { x, y, layer } or null
const data = spatial.getEntityData(entityId); // { type, ...traits }
const alive = spatial.isAlive(entityId); // False if pending removal
```

### Point Queries
```typescript
// Specific layer check
const actorId = spatial.getEntityIdAt(x, y, GameLayers.ACTORS);

// Get all entities in a cell (useful for overlaps)
const allIds = spatial.getEntityIdsInCell(x, y);
```

### Area Queries
```typescript
// Circular radius (Euclidean distance)
const nearbyIds = spatial.getEntityIdsInRadius(x, y, 3.5);

// Line of sight (Bresenham line)
const lineIds = spatial.getEntityIdsInLine(startX, startY, endX, endY);
```

## Modifying the World

### Moving Entities
```typescript
// Queues a move operation.
// Automatically checks bounds.
// Collisions are resolved during commit().
spatial.move(entityId, newX, newY); 

// Optional: Custom blocking logic
spatial.move(entityId, newX, newY, (cell) => {
    return cell.hasMask(CellMasks.LAVA); // Block if lava
});
```

### Spawning & Removing
```typescript
// Spawning
// Returns ID immediately, but entity appears on grid next tick.
const id = spatial.spawn('enemy', x, y, GameLayers.ACTORS, { hp: 100 });

// Removing
// Marks as "not alive" immediately, removed from grid next tick.
spatial.remove(entityId);
```

## Common Patterns

### Handling Overlaps (Collision)
Use `detectOverlaps()` in a reactive system to handle entities sharing a cell.
```typescript
// In your system's update loop
const overlaps = spatial.detectOverlaps();
for (const { entityIds } of overlaps) {
    // Check if Player and Gold are in the same cell
    // ... logic ...
}
```

### checking Line of Sight
```typescript
function canSee(spatial, fromId, toId) {
    const start = spatial.getPosition(fromId);
    const end = spatial.getPosition(toId);
    if (!start || !end) return false;

    const line = spatial.getEntityIdsInLine(start.x, start.y, end.x, end.y);
    // Check if any entity in the line is a wall
    return !line.some(id => spatial.getEntityData(id).type === 'wall');
}
```

## Advanced Patterns

### Two-Phase Updates (Simulation Logic)
When entities affect their neighbors (e.g., fluid flow, fire spreading), updates must be order-independent to prevent "scanning bias" (where top-left entities update before bottom-right ones).

1.  **Calculate Phase**: Determine all changes based on *current* state. Store deltas in a temporary Map.
2.  **Apply Phase**: Iterate through the Map and apply changes to the actual entities.

```typescript
// Example: Liquid Flow
const depthDeltas = new Map<number, number>();

// Phase 1: Calculate Flow
for (const id of liquidEntities) {
    const myDepth = spatial.getEntityData(id).depth;
    // ... calculate flow to neighbors ...
    depthDeltas.set(id, delta);
}

// Phase 2: Apply
for (const [id, delta] of depthDeltas) {
    const data = spatial.getEntityData(id);
    if (data) data.depth += delta;
}
```

### Entity Transformation (Changing Layers/Types)
To change an entity's fundamental properties (like moving a "closed door" from `WALLS` to `FLOOR` to open it), you must remove and respawn it. Use `spawnWithId` to preserve its identity.

```typescript
// Example: Opening a Door (Bollard)
if (shouldOpen) {
    // 1. Remove from Store (so ID is free) & Spatial (so grid is clear)
    spatial.getStore().remove(entityId);
    spatial.remove(entityId); 
    
    // 2. Respawn with SAME ID on NEW Layer
    spatial.spawnWithId(
        entityId, 
        'door-open', 
        x, y, 
        GameLayers.FLOOR, // Moved to non-blocking layer
        { ...oldProps, isOpen: true }
    );
}
```

### Graph Algorithms (Flood Fill)
You can use the grid for graph traversals like signal propagation or pathfinding.

```typescript
// Example: Signal Flood Fill
const queue = [{x: startX, y: startY}];
const visited = new Set<string>();

while (queue.length > 0) {
    const {x, y} = queue.shift();
    const cell = spatial.getGrid().cell(x, y);
    
    // Process neighbors
    const neighbors = [cell.neighbor(Direction.UP), ...];
    for (const n of neighbors) {
        if (n && isConductive(n) && !visited.has(n.key)) {
            visited.add(n.key);
            queue.push({x: n.x, y: n.y});
        }
    }
}
```

### Visual Effects Lifecycle
Spawning "ephemeral" entities for visual feedback (explosions, particles).
```typescript
// Spawn with a spawnTick or lifetime property
spatial.spawn('explosion-visual', x, y, GameLayers.EPHEMERALS, {
    spawnTick: this.currentTick,
    lifetime: 5
});

// In your system's cleanup phase
if (currentTick - entity.spawnTick > entity.lifetime) {
    spatial.remove(entityId);
}
```

### Advanced Field of View
For area effects blocked by walls (explosions, lighting), use `LinkedCellUtils`.
```typescript
import { LinkedCellUtils } from '../core/grid/linked-cell-utils';

const center = spatial.getGrid().cell(x, y);
const visibleCells = LinkedCellUtils.fieldOfView(
    center, 
    radius, 
    (cell) => spatial.isBlocked(cell) // Blocking predicate
);
```

## API Reference

| Method | Description |
| :--- | :--- |
| `getPosition(id)` | Get x, y, layer of an entity. |
| `getEntityData(id)` | Get the raw data object for an entity. |
| `getEntityIdAt(x, y, layer)` | Get ID at specific coordinate/layer. |
| `getEntityIdsInRadius(...)` | Get IDs within a circular area. |
| `isBlocked(cell)` | Check if a cell has a wall/obstacle. |
| `move(id, x, y)` | Stage a movement. |
| `spawn(...)` | Stage a creation. |
| `remove(id)` | Stage a deletion. |
