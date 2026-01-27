# Hybrid API Implementation Summary

## Overview

Added entity-based convenience methods to `SpatialSystem` while keeping the existing coordinate-based methods, creating a **hybrid API** that supports both cell-centric and entity-centric operations.

## Changes Made

### 1. New Methods in SpatialSystem

**File:** `packages/spartan/spatial-system.ts`

#### `moveEntity(entityId, toX, toY, blockFn?): boolean`
- Looks up entity's current position
- Delegates to coordinate-based `move()`
- Returns `false` if entity not on grid
- Useful when systems already have entity IDs (e.g., from overlap detection)

#### `removeEntity(entityId): boolean`
- Looks up entity's current position
- Delegates to coordinate-based `remove()`
- Returns `false` if entity not on grid
- Useful for cleaning up entities by ID

### 2. Comprehensive Tests & Migration to Preferred API

**Files Updated:**
- `packages/spartan/test/spartan.test.ts` - Unit tests
- `packages/spartan/test/movement.visual.test.ts` - Visual tests
- `packages/spartan/test/assertions.visual.test.ts` - AAA pattern tests

**Changes:**
- Migrated tests to use entity-based API as the **preferred approach**
- Unit tests demonstrate both APIs with clear test suite names
- Visual tests now use `moveEntity()` and `removeEntity()` where entity IDs are known
- Kept coordinate-based API for tests specifically verifying cell-centric behavior (e.g., convoy movement, blocking functions)

**Test Coverage:**
- Entity-based API: Works with overlap detection, position tracking, entity lifecycle
- Coordinate-based API: Edge cases, invalid coordinates, convoy movement, blocking functions

All 174 tests pass ✅

### 3. Updated Documentation

**Files Updated:**
- `ai-temp/DEVELOPER_CONTEXT.md`
- `specs/spartan-responsibilities.md`

**Added:**
- Section explaining Hybrid API
- When to use coordinate-based vs entity-based
- Examples of both approaches
- Updated API reference sections

## Design Rationale

### Why Hybrid API?

**Coordinate-Based (Cell-Centric):**
- Matches the underlying grid's cell-centric nature
- Intuitive for direct cell manipulation
- Natural for UI/input handlers
- Example: "Remove entity at (5, 5)"

**Entity-Based (Entity-Centric):**
- Matches how systems think (already have entity IDs)
- Eliminates redundant lookups in system logic
- Natural for AI and overlap-based interactions
- Example: "Move this entity" (from overlap detection)

### API Decision: Keep Both

Rejected alternatives:
1. ❌ **Replace coordinate-based with entity-based** - Would break the cell-centric abstraction
2. ❌ **Remove layer parameter from scene transitions** - Player layer isn't always fixed (e.g., Tetris-style games)

## Usage Examples

### Entity-Based (Preferred for Game Logic)
```typescript
// System logic with overlap detection
for (const overlap of overlaps) {
    for (const entityId of overlap.entityIds) {
        const pos = spatial.getEntityPosition(entityId);
        if (pos) {
            spatial.moveEntity(entityId, pos.x + 1, pos.y); // Move right
        }
    }
}
spatial.commit();

// Combat system removing dead entities
for (const deadEntityId of deadEntities) {
    spatial.removeEntity(deadEntityId);
}
spatial.commit();

// Visual tests tracking entities
const playerId = spatial.spawn('player', 5, 5, GameLayers.ACTORS);
spatial.commit();
spatial.moveEntity(playerId, 6, 5);
spatial.commit();
```

### Coordinate-Based (For Cell-Centric Operations)
```typescript
// Direct cell manipulation (map editor, cell-based UI)
spatial.move(fromX, fromY, toX, toY, layer);
spatial.remove(x, y, layer);

// Convoy movement (coordinate-synchronized movement)
spatial.move(5, 5, 6, 5, layer);
spatial.move(6, 5, 7, 5, layer);
spatial.move(7, 5, 8, 5, layer);
spatial.commit();
```

### When to Use Each

| Use Entity-Based (Preferred) | Use Coordinate-Based |
|------------------------------|---------------------|
| System logic (AI, combat, etc.) | Direct cell manipulation |
| Overlap responses | Convoy/synchronized movement |
| When you already have IDs | Blocking function testing |
| Entity lifecycle management | Map/grid editing tools |
| Game-like test scenarios | UI handlers without entity context |

## Implementation Details

Both methods:
- Are **deferred** (stage operations, execute on `commit()`)
- Update position tracking
- Follow the unified transaction model
- Are tested thoroughly

The entity-based methods are **thin wrappers** that:
1. Look up entity position via `getEntityPosition()`
2. Delegate to coordinate-based methods
3. Return boolean indicating success

## Impact

- ✅ All existing code continues to work (100% backward compatible)
- ✅ New entity-based API established as **preferred approach** for game logic
- ✅ No performance overhead (just a position lookup)
- ✅ Tests migrated to demonstrate best practices
- ✅ Visual tests now use entity-based API (clearer, more game-like)
- ✅ Documentation updated comprehensively with usage guidance

## Test Migration

**Before (coordinate-based):**
```typescript
spatial.move(5, 5, 6, 5, GameLayers.ACTORS);
spatial.commit();
spatial.move(6, 5, 7, 5, GameLayers.ACTORS);
spatial.commit();
```

**After (entity-based):**
```typescript
let playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
spatial.moveEntity(playerId, 6, 5);
spatial.commit();

playerId = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS)!;
spatial.moveEntity(playerId, 7, 5);
spatial.commit();
```

This makes tests more game-like and demonstrates the recommended approach for game systems.

## PR Feedback Response

This implementation addresses PR suggestion #2 ("Use entity ID for spatial operations") by:
- ✅ Adding entity-based methods as requested
- ✅ Keeping coordinate-based methods for cell-centric operations
- ✅ Providing the best of both worlds (hybrid approach)

PR suggestion #3 ("Simplify scene transition method signature") was rejected because:
- ❌ Player layer isn't always fixed (e.g., non-rendering layers in puzzle games)
- ❌ API consistency with `spatial.move()` is valuable
- ❌ Scene designers should control layer placement explicitly
