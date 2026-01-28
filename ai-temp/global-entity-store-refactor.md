# Global Entity Store Refactor

## Summary

Refactored the Spartan framework to use a **global entity store** instead of per-scene entity stores. This makes cross-scene state management much cleaner and enables entities to persist state across scene transitions naturally.

## Key Changes

### 1. GameState (packages/spartan/game-state.ts)
- **Added**: Global `entityStore: SparseEntityStore` 
- **Added**: Constructor to initialize entity store with ID generator
- **Updated**: `serialize()` to include all entities from global store
- **Updated**: `deserialize()` to restore entities to global store

### 2. Scene (packages/spartan/scene.ts)
- **Removed**: Per-scene `store: SparseEntityStore`
- **Updated**: Constructor to use `gameState.entityStore` (global)
- **Updated**: `serialize()` to only save grid/spatial data (entities are global)
- **Updated**: `deserialize()` to skip entity restoration (comes from GameState)

### 3. SceneManager (packages/spartan/scene-manager.ts)
- **Updated**: `deleteScene()` to remove entities by `sceneId` from global store
- No longer calls `scene.store.clear()` (doesn't exist anymore)

### 4. GameManager (packages/spartan/game-manager.ts)
- **Updated**: `_movePlayerToSceneImmediate()` to:
  - Use global `gameState.entityStore` instead of `scene.store`
  - Update player's `sceneId` property when moving between scenes
- **Updated**: `load()` to use `GameState.deserialize()` for proper entity restoration

### 5. TeleporterSystem (packages/spartan/teleporter-system.ts)
- **Removed**: `Map<entityId, TeleporterState>` state tracking
- **Removed**: `resetStates()` method (no longer needed)
- **Updated**: State now stored directly on entity props (`entity.teleporterState`)
- **Updated**: Uses global entity store to access entities across scenes
- **Simplified**: No more fragile cross-scene state management

### 6. Scene Loader (dev/scene-loader.ts)
- **Updated**: Adds `sceneId` property to all spawned entities

### 7. Test Fixtures (packages/spartan/test/test-fixtures.ts)
- **Updated**: `TestSpatialFixture` now accepts optional `sceneId` parameter
- Automatically adds `sceneId` to entity props when spawning

### 8. Tests
- **Updated**: All test files to use `gameState.entityStore` instead of `scene.store`
- **Updated**: Entity spawns in key tests to include `sceneId` property

## Benefits

### 1. **Single Source of Truth**
All entity data lives in one place (`GameState.entityStore`). No more wondering which scene an entity belongs to.

### 2. **Natural Cross-Scene State**
Systems like `TeleporterSystem` can now:
- Store state directly on entity props
- Access entities in any scene via global store
- No manual state management or "reset" methods

### 3. **Entity Lifecycle Clarity**
- Entities have a `sceneId` property indicating which scene they belong to
- Moving between scenes = updating `sceneId`
- "Inactive" entities can exist without explicit "bench" concept
- Dead NPCs, collected keys, etc. persist naturally

### 4. **Cleaner Save/Load**
- Single serialization point for all entities
- No per-scene entity duplication
- Easier to reason about saved state

### 5. **Simpler System Code**
Example - TeleporterSystem before:
```typescript
private states = new Map<number, TeleporterState>();

resetStates(): void {
    this.states.clear(); // Dangerous! Breaks round-trip
}

updateTeleporterStates(spatial, playerId) {
    for (const [id, state] of this.states) {
        // Complex logic to handle cross-scene pads
    }
}
```

After:
```typescript
// State lives on entity!
entity.teleporterState = 'inactive';

// Just iterate global entities
for (const id of gameState.entityStore.getAllIds()) {
    const entity = gameState.entityStore.getData(id);
    if (entity.type === 'teleporter' && entity.teleporterState === 'inactive') {
        // ...
    }
}
```

## Architecture Pattern

### Entity Properties
All entities should include:
```typescript
{
  id: number,           // Globally unique (from GameState)
  type: string,         // Entity type
  sceneId: string,      // Which scene this entity belongs to
  // ... game-specific properties
}
```

### Creating Entities
```typescript
// In scene setup / JSON loader
scene.spatial.spawn('player', x, y, layer, {
  sceneId: scene.id,  // Always include!
  hp: 100,
  // ... other props
});
```

### Moving Entities Between Scenes
```typescript
// GameManager handles this automatically now
gameManager.movePlayerToScene(targetSceneId, x, y, layer);
// Updates player.sceneId internally
```

### Accessing Entities Cross-Scene
```typescript
// From any system
const entity = gameManager.gameState.entityStore.getData(entityId);
if (entity.sceneId === 'room2') {
  // This entity is in room2
}
```

## Migration Notes

If updating existing code:

1. **Replace `scene.store.getData(id)`** with `gameState.entityStore.getData(id)`
2. **Add `sceneId` to all entity spawns**
3. **Remove system state maps** - use entity props instead
4. **Update serialization** - entities come from GameState now
5. **Test cross-scene functionality** - especially teleporters, scene transitions

## Test Results

All 175 tests pass after refactor, including:
- ✅ Scene serialization/deserialization
- ✅ Scene manager operations
- ✅ Player migration between scenes
- ✅ Save/load complete game state
- ✅ Teleporter round-trip (key test!)
- ✅ All existing spatial/layer/movement tests

## Related Documentation

- `specs/spartan-responsibilities.md` - Spartan architecture overview
- `specs/spartan-system-registration.md` - How systems persist across scenes
- `packages/spartan/game-state.ts` - Global game state implementation
- `packages/spartan/entity-store.ts` - Entity storage implementation
