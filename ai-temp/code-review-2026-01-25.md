This is a well-architected foundation for a 2D grid-based game framework. Here's my detailed review:

## Strong Design Choices

**1. Linked Neighbor Architecture**
The direct neighbor references (`_neighbors` array) are brilliant for grid-based games. O(1) navigation is genuinely valuable for pathfinding, raycasting, and movement logic. This is much better than coordinate math for many use cases.

**2. Two-Phase Movement Commit**
The `move()` + `commit()` pattern in `SpatialSystem` elegantly solves the convoy problem. Being able to move adjacent entities simultaneously without order-dependent blocking is a real challenge that you've solved cleanly.

**3. Layer-Based Entity Storage**
Using `cell.items[layer]` for entity positions is simple and effective. The constraint that entities occupy exactly one cell on one layer keeps the mental model clean.

**4. Separation of Concerns**
- `LinkedGrid`: Pure spatial structure
- `LinkedCell`: Navigation + geometry algorithms  
- `SpatialSystem`: Entity lifecycle + movement logic
- `SparseEntityStore`: Metadata storage

This separation is well thought out.

## Areas for Improvement

### 1. **Type Safety Issues**

```typescript
// LinkedCell allows arbitrary indexing but values should be bounded
cell.items[999] = entityId; // No protection against this

// Missing validation
cell.values[-1] = 5; // Negative indices aren't caught
```

**Suggestion**: Add layer validation or use a fixed number of layers:
```typescript
private static readonly MAX_LAYERS = 16;

setItem(layer: number, val: number) {
    if (layer < 0 || layer >= LinkedCell.MAX_LAYERS) {
        throw new Error(`Layer must be 0-${LinkedCell.MAX_LAYERS-1}`);
    }
    this.items[layer] = val;
    return this;
}
```

### 2. **SpatialSystem Responsibility Creep**

The `SpatialSystem` is doing entity spawning, movement, AND spatial queries. Consider splitting:

```typescript
// Option A: Separate movement system
class MovementSystem {
    private pendingMoves = [];
    move(fromX, fromY, toX, toY, layer) { }
    commit() { }
}

// Option B: Keep it, but make the boundary clearer
// Current design is acceptable for a simple framework
```

### 3. **Missing Grid Coordinate Validation**

```typescript
spawn(type: string, x: number, y: number, layer: Layer, props?) {
    const cell = this.grid.cell(x, y);
    if (!cell) {
        throw new Error(`Invalid coordinates: (${x}, ${y})`);
    }
    // What if x or y are floats? Negative?
}
```

**Suggestion**: Add explicit bounds checking:
```typescript
private validateCoords(x: number, y: number): void {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
        throw new Error(`Coordinates must be integers: (${x}, ${y})`);
    }
    if (x < 0 || y < 0 || x >= this.grid.width || y >= this.grid.height) {
        throw new Error(`Coordinates out of bounds: (${x}, ${y})`);
    }
}
```

### 4. **LinkedCell's Many Responsibilities**

`LinkedCell` has 15+ methods spanning navigation, geometry, pathfinding, and lighting. While the delegation to `LinkedCellUtils` helps, the surface area is large.

**Not necessarily wrong**, but consider if users need all these on every cell, or if they should import utilities explicitly:

```typescript
// Current: cell.fieldOfView(radius, blockFn)
// Alternative: FOV.compute(cell, radius, blockFn)
```

The current approach is more convenient for game code, so this might be a feature, not a bug.

### 5. **Memory Cleanup in BFS Algorithms**

```typescript
// In LinkedCellUtils pathfinding code (not shown but implied):
cell._visited = true;
cell._prev = prevCell;

// Are these ALWAYS cleaned up if pathfinding fails early?
```

Make sure all BFS/pathfinding methods clean up `_visited` and `_prev` flags even on early returns or exceptions.

### 6. **Silent Failures in Movement**

```typescript
move(fromX, fromY, toX, toY, layer): void {
    // ...
    if (!fromCell || !toCell) {
        return; // Silent failure
    }
    
    if (entityId === undefined) {
        return; // Silent failure
    }
}
```

**Question**: Should these be silent? Consider returning success/failure:

```typescript
move(...): boolean {
    if (!fromCell || !toCell) {
        return false;
    }
    // ...
    return true;
}
```

Or at minimum, add an optional callback/event system for debugging.

### 7. **No Entity Position Tracking**

```typescript
// How do I find where an entity is located?
const playerId = spatial.spawn('player', 5, 5, 1);

// Later... where is the player now?
// Have to scan the grid or track externally
```

**Suggestion**: Either:
- Store position in `EntityData`
- Add a reverse lookup map in `SpatialSystem`
- Document that users should track this themselves

### 8. **Wrapping Mode Edge Case**

```typescript
setWrap(wrap: boolean) {
    this._wrap = wrap;
    this._linkNeighbors(); // Re-links EVERYTHING
    return this;
}
```

This is expensive. If you change wrap mode mid-game with thousands of cells, you're re-linking all neighbors. Consider if this is intended behavior or if wrap should be immutable after construction.

## Missing Features to Consider

### 1. **Entity Position Query**
```typescript
// Add to SpatialSystem
getEntityPosition(id: number): {x: number, y: number, layer: Layer} | null {
    // Requires either storing position in EntityData or scanning grid
}
```

### 2. **Entity Movement History**
For debugging or replays:
```typescript
// Track where entities have been
private moveHistory: Array<{entityId, from, to, tick}> = [];
```

### 3. **Collision Callbacks**
```typescript
// When commit() detects conflicts, allow custom resolution
onMoveConflict?: (moves: PendingMove[]) => PendingMove[]
```

### 4. **Batch Operations**
```typescript
// Spawn many entities at once
spawnBatch(entities: Array<{type, x, y, layer, props}>): number[]
```

## Documentation Praise

Your JSDoc comments are **excellent**. The examples are clear, the architecture explanations (Rules 1-7) are helpful, and the `@example` blocks show real use cases.

## Overall Assessment

**Grade: A-**

This is production-ready for a small-to-medium game framework. The core abstractions are sound, the two-phase movement commit is clever, and the linked neighbor pattern is well-executed.

**Main improvements:**
1. Add layer bounds validation
2. Consider position tracking for entities
3. Decide on silent vs. explicit error handling
4. Ensure BFS cleanup is bulletproof
5. Add integration tests for convoy movement edge cases

**Use this if:**
- Building roguelikes, tactics games, tower defense
- Need efficient spatial queries
- Want convoy/formation movement
- Grid size < 1000x1000

**Don't use this if:**
- Continuous/pixel-perfect movement required
- Need massive grids (memory overhead of neighbor links)
- Entities need to be in multiple cells simultaneously

Great work! This is a solid foundation.