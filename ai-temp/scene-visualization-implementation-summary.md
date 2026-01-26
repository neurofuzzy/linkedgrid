# Scene Visualization in Visual Runner - Implementation Summary

## Status: ✅ COMPLETE

The visual runner now displays scene information and handles multi-scene tests, showing one scene at a time with clear scene transition indicators.

## What Was Implemented

### 1. Extended Snapshot Interface ✅

**Files Modified**:
- `packages/visual-runner/lib/types.ts`
- `packages/visual-runner/lib/test-executor.ts`

Added optional scene fields to Snapshot interface:
```typescript
export interface Snapshot {
  operation: string;
  args: unknown[];
  result: unknown;
  
  // Scene information (optional for backward compatibility)
  sceneId?: string;
  sceneName?: string;
  
  entities: Array<{...}>;
  grid: { w: number; h: number };
}
```

**Backward compatible** - existing tests without scenes still work.

### 2. Extended VisualTestContext ✅

**Files Modified**:
- `packages/spartan/test/visual-helpers.ts`
- `packages/visual-runner/lib/test-executor.ts`

Added optional game/scene fields to context:
```typescript
export interface VisualTestContext {
    grid: LinkedGrid;
    spatial: SpatialSystem;
    store: SparseEntityStore;
    expect: (description: string, fn: () => void) => void;
    assertions?: AssertionResult[];
    
    // NEW: Optional scene system support
    game?: any;  // GameManager
    scene?: any; // Scene
}
```

Tests can now assign `ctx.game` or `ctx.scene` for scene tracking.

### 3. Scene Information Capture ✅

**File Modified**: `packages/visual-runner/lib/test-executor.ts`

#### Global Context Tracking
Stores test context in `globalThis.__currentTestContext` so snapshot capture can access scene information:

```typescript
// In executeArrange and executeActAssert
(globalThis as any).__currentTestContext = ctx;
```

#### Scene Detection in Snapshots
Updated `captureSnapshot` to detect and include scene information:

```typescript
private captureSnapshot(...): void {
  // ... collect entities ...
  
  // Detect scene from context
  const testCtx = (globalThis as any).__currentTestContext;
  if (testCtx?.game) {
    const activeScene = testCtx.game.sceneManager?.getActiveScene();
    if (activeScene) {
      sceneId = activeScene.id;
      sceneName = activeScene.metadata?.name;
    }
  } else if (testCtx?.scene) {
    sceneId = testCtx.scene.id;
    sceneName = testCtx.scene.metadata?.name;
  }
  
  this.snapshots.push({
    // ... existing fields ...
    sceneId,
    sceneName
  });
}
```

#### GameManager Wrapping
Captures scene transitions automatically:

```typescript
private setupGameManagerWrapping(ctx: VisualTestContext): void {
  if (ctx.game?.movePlayerToScene) {
    const originalMove = ctx.game.movePlayerToScene.bind(ctx.game);
    ctx.game.movePlayerToScene = (...args: any[]) => {
      const result = originalMove(...args);
      
      // Capture snapshot after scene transition
      const activeScene = ctx.game.sceneManager?.getActiveScene();
      if (activeScene && this.captureEnabled) {
        this.captureSnapshot(
          activeScene.spatial, 
          'movePlayerToScene', 
          args, 
          result
        );
      }
      
      return result;
    };
  }
}
```

### 4. Scene Header in GridRenderer ✅

**File Modified**: `packages/visual-runner/components/GridRenderer.tsx`

Added scene header above grid display:

```typescript
{snapshot?.sceneId && (
  <Box marginBottom={1}>
    <Text bold color="cyan">Scene: </Text>
    <Text color="white">
      {snapshot.sceneName || snapshot.sceneId}
      {snapshot.sceneName && snapshot.sceneName !== snapshot.sceneId && (
        <Text dimColor> ({snapshot.sceneId})</Text>
      )}
    </Text>
  </Box>
)}
```

**Display format**: `Scene: Dark Dungeon (dungeon)`

### 5. Scene Info in InfoPanel ✅

**File Modified**: `packages/visual-runner/components/InfoPanel.tsx`

Added scene metadata to the info panel:

```typescript
{snapshot && (
  <Box marginTop={1}>
    <Text dimColor>Grid: </Text>
    <Text>{snapshot.grid.w}×{snapshot.grid.h}</Text>
    
    {snapshot.sceneId && (
      <>
        <Text dimColor> | Scene: </Text>
        <Text>{snapshot.sceneName || snapshot.sceneId}</Text>
      </>
    )}
  </Box>
)}
```

**Display format**: `Grid: 20×20 | Scene: Dark Dungeon`

### 6. Scene Transition Indicator ✅

**Files Modified**:
- `packages/visual-runner/components/GridRenderer.tsx`
- `packages/visual-runner/components/App.tsx`

#### GridRenderer
Detects scene changes and displays transition banner:

```typescript
const sceneChanged = previousSnapshot && 
                     snapshot?.sceneId && 
                     previousSnapshot.sceneId !== snapshot.sceneId;

{sceneChanged && (
  <Box marginBottom={1} borderStyle="single" borderColor="yellow" paddingX={1}>
    <Text color="yellow" bold>→ Scene Transition</Text>
    <Text dimColor> from </Text>
    <Text>{previousSnapshot.sceneName || previousSnapshot.sceneId}</Text>
    <Text dimColor> to </Text>
    <Text color="yellow">{snapshot.sceneName || snapshot.sceneId}</Text>
  </Box>
)}
```

#### App.tsx
Passes previous snapshot for transition detection:

```typescript
const previousSnapshot = currentIndex > 0 ? snapshots[currentIndex - 1] : null;

<GridRenderer snapshot={snapshot} previousSnapshot={previousSnapshot} />
```

## Usage Examples

### Single-Scene Test

```typescript
visual('player moves in dungeon', {
  arrange: (ctx) => {
    const game = new GameManager();
    const scene = game.sceneManager.createScene('dungeon', 20, 20, {
      name: 'Dark Dungeon'
    });
    
    ctx.scene = scene;  // Assign for scene metadata capture
    ctx.spatial = scene.spatial;
    ctx.grid = scene.grid;
    
    scene.spatial.spawn('player', 10, 10, 5);
  },
  act: (ctx) => {
    ctx.spatial.move(10, 10, 11, 10, 5);
    ctx.spatial.commit();
  }
});
```

**Visual display**:
```
Scene: Dark Dungeon (dungeon)
┌─────────────────────┐
│ · · · · · · · · · · │
│ · · · · · · · · · · │
│ · · · · P · · · · · │  ← Player visible
└─────────────────────┘

Grid: 20×20 | Scene: Dark Dungeon
```

### Multi-Scene Test with Transitions

```typescript
visual('player teleports between rooms', {
  arrange: (ctx) => {
    const game = new GameManager();
    ctx.game = game;  // Assign for scene tracking
    
    const room1 = game.sceneManager.createScene('room1', 10, 10, {
      name: 'Starting Room'
    });
    const room2 = game.sceneManager.createScene('room2', 15, 15, {
      name: 'Treasure Room'
    });
    
    const playerId = room1.spatial.spawn('player', 5, 5, 5);
    game.gameState.playerEntityId = playerId;
  },
  act: (ctx) => {
    // Walk in room1
    ctx.game.sceneManager.getActiveScene().spatial.move(5, 5, 6, 5, 5);
    ctx.game.sceneManager.getActiveScene().spatial.commit();
    
    // Teleport to room2
    ctx.game.movePlayerToScene('room2', 7, 7, 5);
    
    // Walk in room2
    ctx.game.sceneManager.getActiveScene().spatial.move(7, 7, 8, 7, 5);
    ctx.game.sceneManager.getActiveScene().spatial.commit();
  }
});
```

**Visual display sequence**:

**Frame 1**: Starting Room
```
Scene: Starting Room (room1)
┌──────────────┐
│ · · · · · · │
│ · · P · · · │  ← Player in room1
└──────────────┘
Grid: 10×10 | Scene: Starting Room
```

**Frame 2**: Player moves in room1
```
Scene: Starting Room (room1)
┌──────────────┐
│ · · · · · · │
│ · · · P · · │  ← Moved right
└──────────────┘
```

**Frame 3**: Scene transition
```
→ Scene Transition from Starting Room to Treasure Room

Scene: Treasure Room (room2)
┌────────────────────┐
│ · · · · · · · · · │
│ · · · · · · · P · │  ← Player now in room2
└────────────────────┘
Grid: 15×15 | Scene: Treasure Room
```

**Frame 4**: Player moves in room2
```
Scene: Treasure Room (room2)
┌────────────────────┐
│ · · · · · · · · · │
│ · · · · · · · · P │  ← Moved right in room2
└────────────────────┘
```

## Backward Compatibility

✅ **Fully backward compatible**:
- Existing tests without scene support work unchanged
- Scene fields are optional in all interfaces
- Tests that don't assign `ctx.game` or `ctx.scene` show no scene info
- No breaking changes to existing visual tests

## Test Results

All 148 tests pass:
- 38 grid tests
- 60 spartan core tests
- 34 scene system tests
- 16 visual tests (run in both vitest and visual runner)

## Design Decisions

1. **Single scene display**: Only one scene visible at a time (per user requirement)
2. **Global context tracking**: Uses `globalThis.__currentTestContext` to pass scene info to snapshot capture without modifying proxy signatures
3. **Automatic scene detection**: Detects scene from either `ctx.game` (multi-scene) or `ctx.scene` (single-scene)
4. **GameManager wrapping**: Automatically captures snapshots on `movePlayerToScene` calls
5. **Optional fields**: All scene fields are optional for backward compatibility

## Files Modified

1. `packages/visual-runner/lib/types.ts` - Added scene fields to Snapshot
2. `packages/visual-runner/lib/test-executor.ts` - Scene capture and GameManager wrapping
3. `packages/spartan/test/visual-helpers.ts` - Extended VisualTestContext
4. `packages/visual-runner/components/GridRenderer.tsx` - Scene header and transition indicator
5. `packages/visual-runner/components/InfoPanel.tsx` - Scene metadata display
6. `packages/visual-runner/components/App.tsx` - Pass previousSnapshot for transitions

## Benefits

1. **Scene visibility**: Clear indication of which scene is being displayed
2. **Transition tracking**: Scene switches are highlighted with yellow banner
3. **Metadata display**: Scene names and IDs shown in UI
4. **Automatic capture**: Scene transitions captured automatically via GameManager wrapping
5. **Single-scene focus**: Only one scene displayed at a time (cleaner UI)
6. **Backward compatible**: Existing tests continue to work without modification

## Future Enhancements (Not Implemented)

- Scene size changes visualization (grid resize on transition)
- Scene history navigation (jump to specific scenes)
- Scene metadata inspection panel (show all scene properties)
- Multi-scene preview (thumbnail view of all scenes)
- Scene diff visualization (highlight changes between scenes)

## Conclusion

The visual runner now fully supports scene system visualization with:
- ✅ Scene information display
- ✅ Scene transition indicators
- ✅ Single-scene-at-a-time display
- ✅ Full backward compatibility
- ✅ All tests passing

Visual tests using the scene system now have rich visualization support in the visual runner while still running correctly in vitest for CI/CD.
