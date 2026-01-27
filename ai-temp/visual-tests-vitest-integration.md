# Visual Tests in Vitest - Implementation Summary

## Status: ✅ COMPLETE

Visual test files (`.visual.test.ts`) now run in **both** contexts:
1. **Vitest** - for CI, coverage, and fast feedback
2. **Visual Runner** - for animation and visual debugging

## What Was Done

### 1. Visual Test Function Already Supported Vitest ✅

The `visual()` function in [`packages/spartan/test/visual-helpers.ts`](packages/spartan/test/visual-helpers.ts) already had vitest registration logic (lines 53-80). It detects when vitest globals are available and automatically registers each visual test as a standard vitest test.

**No changes were needed to the visual test function itself.**

### 2. Updated Vite Config to Include Visual Tests

**File**: [`vite.config.ts`](vite.config.ts)

Added explicit include patterns for visual test files:

```typescript
test: {
    globals: true,
    environment: 'node',
    include: [
        'packages/**/test/**/*.test.ts',
        'packages/**/test/**/*.visual.test.ts',  // ← Added
    ],
    exclude: [
        '**/node_modules/**',
        '**/dist/**',
    ],
},
```

This ensures vitest picks up both regular and visual test files.

## Test Results

### Running in Vitest
```bash
npm test
```

**Output**:
```
✓ packages/spartan/test/assertions.visual.test.ts (3 tests) 6ms
✓ packages/spartan/test/layers.visual.test.ts (7 tests) 12ms
✓ packages/spartan/test/movement.visual.test.ts (6 tests) 16ms

Total: 148 tests passed (includes 16 visual tests)
```

### Running in Visual Runner
```bash
npm run visual
```

The visual runner still works for animated debugging and visual inspection.

## How It Works

### Dual Registration

When a visual test is defined:

```typescript
visual('player moves right', {
  arrange: (ctx) => {
    ctx.spatial.spawn('player', 5, 5, 5);
  },
  act: (ctx) => {
    ctx.spatial.move(5, 5, 6, 5, 5);
    ctx.spatial.commit();
  },
  assert: (ctx) => {
    const pos = ctx.spatial.getEntityPosition(1);
    ctx.expect('player moved', () => {
      assert(pos?.x === 6);
    });
  }
});
```

The `visual()` function:
1. **Registers with visual runner** - adds to `globalThis.visualTests` array
2. **Registers with vitest** - creates an `it()` test that runs all phases

### Context Differences

Both contexts use the same test code, but with slight differences:

#### Vitest Context
- Creates fresh `grid`, `store`, `spatial` for each test
- Runs `arrange → act → assert` sequentially
- Throws errors on assertion failures (standard vitest behavior)
- No snapshot capture (not needed for unit testing)

#### Visual Runner Context
- Wraps spatial system with Proxy for snapshot capture
- Displays arrange phase as initial state
- Animates act phase with frame-by-frame snapshots
- Shows assertion results in UI

## Benefits

1. **No Code Duplication**: Write once, test both ways
2. **CI Integration**: Visual tests run automatically in CI/CD
3. **Fast Feedback**: `npm test` runs visual tests quickly without visual runner
4. **Visual Debugging**: When needed, use `npm run visual` for animation
5. **Same APIs**: Both contexts use identical GameManager/Scene/SpatialSystem APIs
6. **Backward Compatible**: Existing `.test.ts` files unchanged

## Example: Scene System Test

You can now write scene tests as visual tests:

```typescript
// scene-teleport.visual.test.ts
import { visual } from './visual-helpers.js';
import { GameManager } from '../game-manager.js';
import { GameLayers } from '../types.js';

visual('player teleports between scenes', {
  arrange: (ctx) => {
    const game = new GameManager();
    const room1 = game.sceneManager.createScene('room1', 10, 10);
    const room2 = game.sceneManager.createScene('room2', 10, 10);
    
    const playerId = room1.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    game.gameState.playerEntityId = playerId;
    
    ctx.game = game;
  },
  act: (ctx) => {
    // This gets captured as a snapshot in visual runner
    ctx.game.movePlayerToScene('room2', 3, 3, GameLayers.ACTORS);
  },
  assert: (ctx) => {
    const pos = ctx.game.getPlayerPosition();
    ctx.expect('player in room2', () => {
      assert(pos?.sceneId === 'room2');
      assert(pos?.x === 3 && pos?.y === 3);
    });
  }
});
```

This test:
- ✅ Runs in `npm test` (CI-friendly, fast)
- ✅ Runs in `npm run visual` (animated, visual debugging)
- ✅ Uses same GameManager APIs as regular tests

## Verification Commands

```bash
# Run all tests including visual tests
npm test

# Run only visual tests
npm test -- visual.test.ts

# Run specific visual test file
npm test -- packages/spartan/test/movement.visual.test.ts

# Run visual runner for animated view
npm run visual
```

## Files Modified

1. [`vite.config.ts`](vite.config.ts) - Added visual test files to include pattern

**Note**: The visual test function already had vitest support, so no changes were needed there.

## Test Coverage

- **Total tests**: 148 (up from 132 before scene system)
- **Visual tests**: 16 (all now run in vitest too)
- **Regular tests**: 132
- **All passing**: ✅

## Conclusion

Visual tests now work seamlessly in both vitest and the visual runner. The same test file can be used for:
- Fast CI/CD feedback (vitest)
- Visual debugging and animation (visual runner)
- No duplication, no special handling needed

This makes the scene system fully testable in both contexts without any extra work.
