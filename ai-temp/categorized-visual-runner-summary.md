# Categorized Visual Runner with Scene Tests - Implementation Summary

## Status: ✅ COMPLETE

The visual runner now supports test categories with tab navigation and includes demo tests showcasing the scene system visualization.

## What Was Implemented

### 1. Scene Visual Tests ✅

**File**: `packages/spartan/test/scene-transition.visual.test.ts`

Created 3 demonstration tests showcasing scene system features:

#### Test 1: "player teleports between rooms"
- Player moves in Starting Room (10×10)
- Teleports to Treasure Room (12×12)
- Continues moving in new scene
- Demonstrates basic scene transitions with visual indicators

#### Test 2: "multi-scene world with connections"
- Creates 3 connected scenes (Entrance → Hallway → Boss Chamber)
- Uses `gameState.connections` for teleporter mapping
- Player traverses through all 3 scenes
- Demonstrates complex multi-scene navigation

#### Test 3: "scene with metadata and player tracking"
- Single scene with custom metadata (difficulty, biome)
- Uses assertions to verify player position
- Demonstrates `game.getPlayerPosition()` API
- Shows scene metadata in visual display

**All 3 tests**:
- ✅ Run in vitest (CI/coverage)
- ✅ Run in visual runner (animated)
- ✅ Show scene headers and transition indicators
- ✅ Display scene names and IDs

### 2. Category System ✅

**Files Modified**:
- `packages/visual-runner/lib/test-discovery.ts`
- `packages/visual-runner/components/App.tsx`
- `packages/visual-runner/components/CategoryTabs.tsx` (NEW)

#### Test Discovery Enhancement
Updated `TestFile` interface to include category:

```typescript
export interface TestFile {
  file: string;
  path: string;
  tests: string[];
  category: string;  // NEW
}
```

Auto-categorization based on filename:
- `movement.visual.test.ts` → "Movement"
- `layers.visual.test.ts` → "Layers"
- `assertions.visual.test.ts` → "Assertions"
- `scene-transition.visual.test.ts` → "Scenes"

#### Tab Navigation Component
Created `CategoryTabs.tsx` component:

```typescript
<CategoryTabs 
  categories={categories} 
  selectedCategory={selectedCategory} 
  onSelect={setSelectedCategory} 
/>
```

Features:
- Visual indicator showing current tab (▸ marker)
- Selected tab in cyan, others dimmed
- Clean horizontal layout

#### Keyboard Controls

**In Selection View**:
- `←` / `→` - Switch between category tabs
- `↑` / `↓` - Navigate tests within category
- `Enter` - Select test

**In Test View** (unchanged):
- `←` / `→` - Step through frames
- `↑` / `↓` - Switch tests
- `Space` / `Enter` - Play/pause
- `r` - Restart test
- `Esc` - Return to selection
- `q` - Quit

#### Category Filtering
Tests are filtered by selected category:
- Selection view shows only tests from current category
- Sidebar (when toggled with `s`) shows filtered tests
- Up/down navigation stays within category

### 3. UI Layout

**Selection View**:
```
LinkedGrid Visual Test Runner

┌─ [←→] switch tabs: ▸ Movement  Layers  Assertions  Scenes ─┐
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌─ Tests ─────────────────────────────────┐
│  ❯ player teleports between rooms       │
│    multi-scene world with connections   │
│    scene with metadata and tracking     │
│                                          │
└──────────────────────────────────────────┘
```

**Test View with Scene Transition**:
```
LinkedGrid Visual Test Runner - player teleports between rooms (1/3) [✓ PASS]

→ Scene Transition from Starting Room to Treasure Room

Scene: Treasure Room (room2)
┌────────────────────────┐
│ · · · · · · · · · · · │
│ · · · · · · · · · · · │
│ · · · P · · · · · · · │  ← Player in new scene
│ · · · · · · I · · · · │  ← Treasure visible
└────────────────────────┘

┌─ Playback Info ────────────────────┐
│ ▶ Playing   3/5   500ms interval   │
│                                     │
│ movePlayerToScene ("room2", 3, 3)  │
│ Grid: 12×12 | Scene: Treasure Room │
└─────────────────────────────────────┘
```

## Test Results

All 151 tests pass:
- ✅ 38 grid tests
- ✅ 60 spartan core tests
- ✅ 34 scene system tests
- ✅ 7 layer visual tests
- ✅ 6 movement visual tests
- ✅ **3 scene visual tests** (NEW)
- ✅ 3 assertion visual tests

## Categories Available

1. **Movement** (6 tests)
   - player moves right 3 times
   - spawn multiple entities
   - entity moves in a square
   - projectile hits enemy
   - convoy movement
   - simple movement test

2. **Layers** (7 tests)
   - multiple layers at same cell
   - layer priority
   - wall blocking
   - actor blocking
   - empty floor blocking
   - collectibles non-blocking
   - vision blocking

3. **Assertions** (3 tests)
   - AAA: entity movement
   - AAA: collision detection
   - simple movement test

4. **Scenes** (3 tests) 🆕
   - player teleports between rooms
   - multi-scene world with connections
   - scene with metadata and player tracking

## Features Demonstrated

### Scene System in Visual Runner

The new scene tests showcase:

1. **Scene Headers**
   - Display scene name and ID
   - Format: "Scene: Treasure Room (room2)"
   - Only shown when test uses scenes

2. **Scene Transitions**
   - Yellow banner on scene switches
   - Shows "from" and "to" scene names
   - Clear visual indicator

3. **Scene Metadata**
   - Grid size changes between scenes
   - Scene-specific information display
   - Player position tracking across scenes

4. **Cross-Scene Connections**
   - Teleporter network demonstration
   - Connection key mapping
   - Multi-scene world traversal

### Category Navigation

1. **Auto-categorization**
   - Based on filename patterns
   - No manual configuration needed
   - Extensible for new categories

2. **Tab Interface**
   - Clean horizontal layout
   - Visual current tab indicator
   - Keyboard-driven navigation

3. **Filtered Views**
   - Only show tests from selected category
   - Cleaner test selection
   - Easier to find specific test types

## Usage for Developers

### Running Visual Tests

```bash
# Run all tests in CI
npm test

# Run visual runner interactively
npm run visual

# In visual runner:
# - Use ← → to switch categories
# - Use ↑ ↓ to navigate tests
# - Press Enter to run a test
```

### Creating Scene Visual Tests

```typescript
import { visual } from './visual-helpers.js';
import { GameManager } from '../game-manager.js';
import { GameLayers } from '../types.js';

visual('my scene test', {
  arrange: (ctx) => {
    const game = new GameManager();
    ctx.game = game;  // Enable scene tracking
    
    const room1 = game.sceneManager.createScene('room1', 10, 10, {
      name: 'My Room'
    });
    
    game.sceneManager.setActiveScene('room1');
    const playerId = room1.spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    game.gameState.playerEntityId = playerId;
  },
  act: (ctx) => {
    const scene = ctx.game.sceneManager.getActiveScene();
    scene.spatial.move(5, 5, 6, 5, GameLayers.ACTORS);
    scene.spatial.commit();
  }
});
```

### Adding New Categories

Categories are auto-detected from filenames:

```bash
# Create new category by filename
packages/spartan/test/combat.visual.test.ts  → "Combat" category
packages/spartan/test/ai-pathfinding.visual.test.ts → "Ai Pathfinding" category
```

Or explicitly map in `test-discovery.ts`:

```typescript
if (filename.includes('combat')) category = 'Combat';
```

## Benefits

1. **Better Organization**
   - 19 visual tests now organized into 4 categories
   - Easy to find specific test types
   - Scales well as tests grow

2. **Scene Visualization**
   - Complete scene system demonstration
   - Clear transition indicators
   - Helpful for debugging multi-scene games

3. **Dual Execution**
   - Same tests run in both vitest and visual runner
   - CI coverage for visual tests
   - Interactive debugging when needed

4. **Developer Experience**
   - Intuitive tab navigation
   - Clean, uncluttered UI
   - Fast category switching

## Future Enhancements (Not Implemented)

- Search/filter tests within category
- Bookmark favorite tests
- Run all tests in category
- Custom category colors
- Category-specific settings
- Test tags/labels for cross-category organization

## Conclusion

The visual runner now provides:
- ✅ Organized test categories with tab navigation
- ✅ Scene system visualization with transitions
- ✅ Demo tests showcasing scene features
- ✅ Clean, keyboard-driven interface
- ✅ Full backward compatibility

All 151 tests pass in both vitest and visual runner contexts.
