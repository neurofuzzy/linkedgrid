# Game Loop Responsibilities Specification

## Current Architecture Analysis

### LinkedGrid (`packages/grid/linked-grid.ts`)

**Responsibilities:**
- Create and manage 2D grid of LinkedCell instances
- Handle neighbor linking (normal and wrapped modes)
- Provide coordinate-based cell access: `cell(x, y)`
- Store grid topology (width, height, wrap mode)

**What it does NOT do:**
- Doesn't know about entities
- Doesn't perform complex algorithms (delegates to LinkedGridUtils)
- Doesn't handle movement or game logic

**Interface:**
- `cell(x, y): LinkedCell | null` - core access method
- `cells: LinkedCell[]` - flat array for iteration
- `width, height` - grid dimensions

---

### LinkedCellUtils (`packages/grid/linked-cell-utils.ts`)

**Responsibilities:**
- Static helper functions for geometric queries
- raycast, getLine, getCircle, fieldOfView, etc.
- Pathfinding (BFS-based: find, findPath)
- Distance propagation (setDistance for Dijkstra maps)

**What it does NOT do:**
- Doesn't know about entities (operates on cells)
- Doesn't manage state (all static, pure functions)
- Doesn't handle movement

**Interface:**
- All static methods taking LinkedCell or LinkedGrid as first param
- Pure functions that return results (cells, paths, etc.)

---

### SpatialSystem (`packages/spartan/spatial-system.ts`)

**Responsibilities:**
- Entity positioning: spawn entities at (x, y, layer)
- Two-phase movement: `move()` stages intents, `commit()` executes
- Entity lifecycle: spawn, remove
- Entity queries: getEntityIdsInCell, getEntityIdsInRadius, getEntityIdsInLine
- Track entity positions: `private positions: Map<number, {x, y, layer}>`

**What it does NOT do:**
- Doesn't know about game rules (teleporters, damage, etc.)
- Doesn't orchestrate ticks or game loops
- Doesn't detect overlaps automatically (just provides query methods)

**Interface:**
- Movement: `move()`, `commit()`, `clearIntents()`
- Spawning: `spawn()`, `remove()`
- Queries: `getEntityIdAt()`, `getEntityIdsInCell()`, `getEntityIdsInRadius()`, etc.
- Data: `getEntityData()`, `getAllEntityIds()`

---

### GameLoop (to be created)

**Proposed Responsibilities:**
- Orchestrate one game tick:
  1. Detect overlaps (from committed state)
  2. Run systems (which stage intents)
  3. Commit intents
- Manage registered systems (add, remove)
- Nothing else!

**What it should NOT do:**
- Doesn't detect overlaps itself (delegates to helper)
- Doesn't know about specific game rules
- Doesn't manage entities or grid
- Doesn't handle rendering

**Proposed Interface:**
```typescript
class GameLoop {
  constructor(spatial: SpatialSystem);
  addSystem(system: GameSystem): void;
  tick(): void;
}
```

---

## What We Already Have

### Overlap Detection Primitives

`SpatialSystem.getEntityIdsInCell(x, y)` already exists (line 407):
```typescript
getEntityIdsInCell(x: number, y: number): number[] {
  const cell = this.grid.cell(x, y);
  if (!cell) return [];
  
  const ids: number[] = [];
  for (const id of cell.values) {
    if (id !== undefined) {
      ids.push(id);
    }
  }
  return ids;
}
```

This returns ALL entities at a position across all layers - exactly what we need for overlap detection!

### Position Tracking

`SpatialSystem` already has:
- `private positions: Map<number, {x, y, layer}>` (line 70)
- Updated on spawn, move commit, and remove

We can expose this for iteration.

---

## What We Need to Add

### 1. Expose Position Iteration in SpatialSystem

**Where:** `packages/spartan/spatial-system.ts`

**What:**
```typescript
/**
 * Get all tracked entity positions.
 * Used for overlap detection and system queries.
 * 
 * @returns Iterator of [entityId, {x, y, layer}] entries
 */
getAllPositions(): IterableIterator<[number, {x: number, y: number, layer: Layer}]> {
  return this.positions.entries();
}
```

**Why:** Allows iterating positions without exposing the internal Map structure.

---

### 2. Add Overlap Detection Helper

**Where:** `packages/grid/linked-cell-utils.ts` (alongside other helpers)

**OR:** Just a standalone function in `packages/spartan/overlap-helpers.ts`?

**What:**
```typescript
/**
 * Detect overlaps in spatial system.
 * Returns positions where multiple entities exist.
 */
export function detectOverlaps(spatial: SpatialSystem): Overlap[] {
  const overlaps: Overlap[] = [];
  const checked = new Set<string>();
  
  for (const [entityId, pos] of spatial.getAllPositions()) {
    const key = `${pos.x},${pos.y}`;
    if (checked.has(key)) continue;
    checked.add(key);
    
    const entities = spatial.getEntityIdsInCell(pos.x, pos.y);
    if (entities.length > 1) {
      overlaps.push({
        position: { x: pos.x, y: pos.y },
        entityIds: entities
      });
    }
  }
  
  return overlaps;
}
```

**Question:** Should this be:
- A. In LinkedCellUtils? No - it operates on SpatialSystem, not cells
- B. A SpatialSystem method? Maybe - `spatial.detectOverlaps()`
- C. A standalone helper function? Yes - keeps SpatialSystem focused

**Recommendation:** Add as a helper function in a new file or as a method on SpatialSystem.

Actually, since it operates on SpatialSystem and uses entity concepts, it should probably be a **SpatialSystem method**.

---

### 3. GameLoop Implementation

**Where:** `packages/spartan/game-loop.ts`

**What:**
```typescript
export class GameLoop {
  private systems: GameSystem[] = [];
  
  constructor(private spatial: SpatialSystem) {}
  
  addSystem(system: GameSystem): void {
    this.systems.push(system);
  }
  
  tick(): void {
    // 1. Detect overlaps
    const overlaps = this.spatial.detectOverlaps();
    
    // 2. Run systems (they stage intents via spatial.move())
    const context: GameContext = { overlaps, spatial: this.spatial };
    for (const system of this.systems) {
      system.update(context);
    }
    
    // 3. Commit all intents
    this.spatial.commit();
  }
}
```

**Size:** ~20 lines. Minimal orchestration.

---

### 4. Type Definitions

**Where:** `packages/spartan/types.ts`

**What:**
```typescript
export interface Overlap {
  position: { x: number; y: number };
  entityIds: number[];
}

export interface GameContext {
  overlaps: Overlap[];
  spatial: SpatialSystem;
}

export interface GameSystem {
  update(context: GameContext): void;
}
```

---

## Implementation Plan (Revised)

### Phase 1: Add Overlap Detection to SpatialSystem

**File:** `packages/spartan/spatial-system.ts`

Add two methods:

```typescript
/**
 * Get all tracked entity positions.
 * Used for overlap detection and iteration.
 */
getAllPositions(): IterableIterator<[number, {x: number, y: number, layer: Layer}]> {
  return this.positions.entries();
}

/**
 * Detect all overlaps (multiple entities at same position).
 * Returns array of positions with 2+ entities across all layers.
 */
detectOverlaps(): Overlap[] {
  const overlaps: Overlap[] = [];
  const checked = new Set<string>();
  
  for (const [_, pos] of this.getAllPositions()) {
    const key = `${pos.x},${pos.y}`;
    if (checked.has(key)) continue;
    checked.add(key);
    
    const entities = this.getEntityIdsInCell(pos.x, pos.y);
    if (entities.length > 1) {
      overlaps.push({
        position: { x: pos.x, y: pos.y },
        entityIds: entities
      });
    }
  }
  
  return overlaps;
}
```

**Why here:** Uses existing SpatialSystem methods, operates on entity concepts.

**Lines added:** ~25 lines

---

### Phase 2: Add Types

**File:** `packages/spartan/types.ts`

Add interface definitions (see above).

**Lines added:** ~12 lines

---

### Phase 3: Create GameLoop

**File:** `packages/spartan/game-loop.ts`

Minimal orchestrator (see above).

**Lines added:** ~25 lines

---

### Phase 4: Create Example System (TeleporterSystem)

**File:** `packages/spartan/teleporter-system.ts`

Demonstrates how to build a system that reacts to overlaps.

**Lines added:** ~60 lines

---

### Phase 5: Update Exports

**File:** `packages/spartan/index.ts`

Export new types and classes.

**Lines added:** ~4 lines

---

### Phase 6: Add Visual Test Example

Update scene transition test to use explicit `gameLoop.tick()`.

---

## Total New Code

- SpatialSystem: +25 lines (2 methods)
- types.ts: +12 lines (3 interfaces)
- game-loop.ts: +25 lines (new file)
- teleporter-system.ts: +60 lines (new file, example)
- index.ts: +4 lines (exports)

**Total: ~126 lines** for complete game loop system

---

## Design Principles Met

1. **Spartan:** No unnecessary abstraction, no OverlapDetector class
2. **Clear boundaries:** Each component has one job
3. **Leverage existing code:** Uses `getEntityIdsInCell()`, position map
4. **Minimal additions:** Two methods, one small class
5. **Extensible:** Systems interface allows any game logic

---

## Multi-Scene Architecture

### Scene (wraps SpatialSystem)

**Responsibilities:**
- Container for one spatial area/room/level
- Owns its own LinkedGrid, SpatialSystem, EntityStore
- Scenes are **isolated** - entities in one scene don't interact with another
- Provides convenience method: `getPlayerPosition()`

**Key Insight:**
```typescript
class Scene {
  readonly grid: LinkedGrid;       // This scene's grid
  readonly spatial: SpatialSystem; // This scene's spatial system
  readonly store: EntityStore;     // This scene's entities
}
```

Each scene is **self-contained**. Operations on `scene1.spatial` don't affect `scene2.spatial`.

---

### SceneManager (manages multiple scenes)

**Responsibilities:**
- Create and delete scenes
- Track "active" scene (the one player is currently in)
- Scene lookup by ID
- Does NOT run game logic or handle ticks

**Interface:**
- `createScene(id, width, height)`
- `getScene(id)`
- `getActiveScene()`
- `setActiveScene(id)`

**What it does NOT do:**
- Doesn't run systems or game loops
- Doesn't handle player movement (delegated to GameManager)
- Doesn't orchestrate ticks

---

### GameManager (top-level coordinator)

**Responsibilities:**
- Owns GameState (global data: lives, score, inventory)
- Owns SceneManager (all scenes)
- Cross-scene operations: `movePlayerToScene()`, `getPlayerScene()`
- Save/load entire game

**What it does NOT do:**
- Doesn't run game loops or ticks
- Doesn't process overlaps or systems
- Doesn't handle per-frame/per-tick logic

---

### GameLoop (tick orchestrator)

**Responsibilities:**
- Orchestrate one tick for **a single SpatialSystem**
- Detect overlaps → run systems → commit
- That's it!

**Critical Design Decision:**

GameLoop operates on **one SpatialSystem** at a time:

```typescript
// Option A: Active scene only
const activeScene = gameManager.sceneManager.getActiveScene();
const gameLoop = new GameLoop(activeScene.spatial);

// Option B: Specific scene
const dungeon = gameManager.sceneManager.getScene('dungeon');
const dungeonLoop = new GameLoop(dungeon.spatial);

// Option C: Multiple loops for parallel processing
const loop1 = new GameLoop(scene1.spatial);
const loop2 = new GameLoop(scene2.spatial);
loop1.tick(); // Updates scene1
loop2.tick(); // Updates scene2
```

**Why one SpatialSystem at a time?**
- Most games only simulate the active scene per tick
- Other scenes are "paused" until player enters
- Explicit control over which scenes update
- Can run multiple loops if needed (boss in one room, traps in another)

---

## Complete Hierarchy

```
GameManager (top level)
├── GameState (global: lives, score, entity IDs)
└── SceneManager (manages all scenes)
    ├── Scene "dungeon"
    │   ├── LinkedGrid (20x20)
    │   ├── SpatialSystem ← operates on THIS grid
    │   └── EntityStore
    ├── Scene "town"  
    │   ├── LinkedGrid (50x50)
    │   ├── SpatialSystem ← operates on THIS grid
    │   └── EntityStore
    └── ... more scenes

GameLoop (created as needed)
└── Operates on ONE SpatialSystem at a time
```

---

## Data Flow: Player Teleports Between Rooms

```
Tick N (player in scene1):
  gameLoop1 = new GameLoop(scene1.spatial)
  gameLoop1.tick():
    1. Detect overlaps in scene1
    2. Overlap detected: player + teleporter
    3. TeleporterSystem.update() called
    4. System calls: gameManager.movePlayerToScene('scene2', x, y)
    5. GameManager:
       a. Removes player from scene1.spatial
       b. Adds player to scene2.spatial  
       c. Sets scene2 as active
    6. Commit phase (no-op, player already moved)

Tick N+1 (player now in scene2):
  gameLoop2 = new GameLoop(scene2.spatial)
  gameLoop2.tick():
    1. Detect overlaps in scene2
    2. Player detected at new position
    3. Game continues in new scene
```

**Key Insight:** `GameManager.movePlayerToScene()` bypasses the normal movement system - it directly manipulates both scenes' SpatialSystems. This is intentional for cross-scene operations.

---

## GameContext for Multi-Scene Games

When systems need scene awareness:

```typescript
interface GameContext {
  overlaps: Overlap[];
  spatial: SpatialSystem;  // The scene being ticked
  
  // Optional references for cross-scene operations
  sceneManager?: SceneManager;  // Access other scenes
  gameManager?: GameManager;    // For movePlayerToScene()
}
```

Systems can access other scenes if needed:

```typescript
class TeleporterSystem implements GameSystem {
  constructor(private gameManager: GameManager) {}
  
  update(context: GameContext) {
    // Find teleporters in current scene (context.spatial)
    const overlaps = context.overlaps;
    
    // Trigger cross-scene transition via gameManager
    this.gameManager.movePlayerToScene(targetSceneId, x, y, layer);
  }
}
```

---

## Usage Patterns

### Pattern 1: Single Active Scene (Most Games)

```typescript
const game = new GameManager();
game.sceneManager.createScene('dungeon', 20, 20);
game.sceneManager.createScene('town', 50, 50);

// Create loop for active scene
const activeScene = game.sceneManager.getActiveScene()!;
const gameLoop = new GameLoop(activeScene.spatial);

// Each turn/frame
gameLoop.tick();

// After scene transition, recreate loop for new scene
const newActive = game.sceneManager.getActiveScene()!;
const newLoop = new GameLoop(newActive.spatial);
```

### Pattern 2: Parallel Scene Simulation

```typescript
const scene1Loop = new GameLoop(scene1.spatial);
const scene2Loop = new GameLoop(scene2.spatial);

// Update both scenes simultaneously
scene1Loop.tick(); // Boss AI continues
scene2Loop.tick(); // Traps keep firing
```

### Pattern 3: Reusable Loop (future optimization)

```typescript
class GameLoop {
  setSpatialSystem(spatial: SpatialSystem) {
    this.spatial = spatial;
  }
}

// Switch scenes without creating new loop
const loop = new GameLoop(scene1.spatial);
loop.tick();

// Scene transition
loop.setSpatialSystem(scene2.spatial);
loop.tick(); // Now operating on scene2
```

---

## The Lines Are Clear

**GameManager**: "I coordinate the whole game"
- Owns GameState and SceneManager
- Handles cross-scene operations
- Save/load

**SceneManager**: "I track which scenes exist and which is active"
- Create/delete scenes
- Scene lookup
- Active scene tracking

**Scene**: "I'm one spatial area with my own grid/entities"
- Self-contained LinkedGrid + SpatialSystem + EntityStore
- Isolated from other scenes

**SpatialSystem**: "I manage entities within my scene"
- Entity positioning and movement
- Overlap detection within my grid
- Entity queries

**GameLoop**: "I run one tick for one SpatialSystem"
- Detect overlaps in this scene
- Run systems for this scene
- Commit movements in this scene

**Each has a single, clear responsibility. No blurring!**

---

## Open Questions

1. **Should detectOverlaps() filter by layer?**
   - Current: detects any overlap (player + floor item)
   - Alternative: only same-layer overlaps?
   - **Answer:** No filtering - let systems decide what overlaps matter

2. **Should GameLoop own GameManager/SceneManager reference?**
   - Current plan: Pass via context to systems that need it
   - Alternative: Pass to GameLoop constructor?
   - **Answer:** Pass via context - keeps GameLoop decoupled from multi-scene concerns

3. **Do we need system ordering/priority?**
   - Current: systems run in registration order
   - **Answer:** Not yet, add if needed

4. **Should we add input collection (step 2)?**
   - Current: placeholder in design, not implemented
   - **Answer:** Add later when actually needed

5. **Should GameLoop be reusable across scenes?**
   - Current: Create new GameLoop per scene
   - Alternative: `loop.setSpatialSystem(newSpatial)`
   - **Answer:** Start simple (create new), optimize later if needed
