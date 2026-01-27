# LinkedGrid Developer Context

## Project Overview

LinkedGrid is a **Spartan grid-based game framework** built on minimalist principles. It provides a spatial entity system for grid-based games with a focus on simplicity, performance, and correctness.

### Core Philosophy: Spartan Development Rules

See `specs/spartan-dev-rules.md` for the 5 rules, but in summary:
1. **Minimal** - Only what is necessary
2. **Explicit** - No magic, clear intent
3. **Testable** - Everything must be verifiable
4. **Visual** - Show, don't just tell
5. **Deterministic** - Same input = same output

## Architecture

### Cell-Centric Sparse Entity System (Architecture B)

The system uses **LinkedGrid** as the spatial foundation with a **sparse external entity store**.

**Key Concept:** Entities are stored primarily in cell layers (`cell.values[layer]`), with minimal metadata in a separate store.

```
GameRuntime (real-time execution)
    └─> GameManager (cross-scene coordinator)
        └─> GameState (score, lives, playerEntityId)
        └─> SceneManager (manages multiple scenes)
            └─> Scene (isolated game area)
                └─> LinkedGrid (20x20)
                    └─> LinkedCell (x, y)
                        └─> items: number[]  ← Entity IDs by layer
                └─> SpatialSystem (spawn/move/query)
                └─> EntityStore (metadata)
    └─> GameLoop (tick orchestration)
        └─> Systems[] (game logic)
            └─> TeleporterSystem, EnemyAISystem, etc.
```

### Multi-Scene Architecture

The framework supports **multiple isolated scenes** (rooms, levels, maps) with seamless transitions:

- **Scene** - Self-contained grid + spatial system + entities
- **SceneManager** - Manages multiple scenes, tracks active scene
- **GameManager** - Cross-scene coordinator, handles player movement between scenes
- **GameState** - Persistent state (score, lives, inventory)

Each scene is completely isolated with its own grid, spatial system, and entities.

## Project Structure

```
linkedgrid/
├── packages/
│   ├── grid/                    # Core LinkedGrid data structure
│   │   ├── linked-cell.ts       # Individual cell with navigation
│   │   ├── linked-grid.ts       # 2D grid of linked cells
│   │   ├── linked-cell-utils.ts # Static geometric helpers
│   │   └── interfaces.ts        # Type definitions
│   │
│   ├── spartan/                 # Spatial entity system
│   │   ├── entity-store.ts      # SparseEntityStore (id → data)
│   │   ├── spatial-system.ts    # SpatialSystem (spawn/move/queries/overlaps)
│   │   ├── scene.ts             # Scene (isolated game area)
│   │   ├── scene-manager.ts     # SceneManager (multi-scene coordinator)
│   │   ├── game-manager.ts      # GameManager (cross-scene operations)
│   │   ├── game-loop.ts         # GameLoop (tick orchestration)
│   │   ├── game-runtime.ts      # GameRuntime (real-time execution)
│   │   ├── teleporter-system.ts # TeleporterSystem (example system)
│   │   ├── types.ts             # Entity types, layers, GameSystem interface
│   │   └── test/
│   │       ├── visual-helpers.ts            # visual() helper + AAA pattern
│   │       ├── movement.visual.test.ts      # 5 core spatial tests
│   │       ├── assertions.visual.test.ts    # AAA demonstration tests
│   │       ├── scene-transition.visual.test.ts  # Multi-scene tests
│   │       ├── scene-system.test.ts         # Scene unit tests
│   │       ├── game-loop.test.ts            # GameLoop unit tests
│   │       └── game-runtime.test.ts         # GameRuntime unit tests
│   │
│   └── visual-runner/           # Ink-based terminal test runner
│       ├── cli.tsx              # Entry point
│       ├── components/
│       │   ├── App.tsx          # Main app with state machine
│       │   ├── TestSidebar.tsx  # Test selection
│       │   ├── GridRenderer.tsx # ASCII grid visualization
│       │   ├── PlaybackControls.tsx  # Step/play controls
│       │   ├── InfoBar.tsx      # Current operation display
│       │   └── AssertionPanel.tsx    # Assertion results
│       ├── lib/
│       │   ├── test-executor.ts    # Runs tests & captures snapshots
│       │   └── test-discovery.ts   # Finds *.visual.test.ts files
│       └── hooks/
│           └── usePlayback.ts      # Playback state & keyboard controls
│
├── specs/                       # Design documents
│   ├── spartan-game-rules.md   # The 10 spatial rules
│   ├── spartan-dev-rules.md    # The 5 development principles
│   ├── spartan-layer-rules.md  # 8-layer semantic specification
│   ├── spartan-scene-spec.md   # Multi-scene system design
│   └── spartan-responsibilities.md  # Component responsibility matrix
│
└── ai-temp/                     # Context for AI agents
    ├── architecture-alternatives.md  # Original architecture decision doc
    ├── game-loop-responsibilities-spec.md  # GameLoop design spec
    ├── game-runtime-spec.md          # GameRuntime design spec
    ├── teleporter-design-notes.md    # Future teleporter mechanics
    └── DEVELOPER_CONTEXT.md          # This file
```

## The 10 Spartan Spatial Rules

Critical for understanding how the spatial system works:

1. **Entities occupy one cell at a time**
2. **Entities occupy a layer on a cell** - `cell.values[layer] = entityId`
3. **Check destination before moving** - No overwrites
4. **Multiple entities per cell via different layers** - Same cell, different layers
5. **Spatial queries are first-class** - Circle, line, radius queries
6. **Clean up old cell on move** - Set old position to `undefined`
7. **Overlap detection, not collision** - React to overlap, don't prevent it
8. **Higher layer indexes are "on top"** - Visual rendering priority
9. **Overlap events propagate down** - From high to low layers
10. **LinkedCells never move** - Position is immutable

## Visual Test Runner

### Why It Exists

We needed a way to **see** spatial operations in action while also having **real assertions**. The visual runner bridges development and testing.

### Architecture: Explicit State Machine

The `App.tsx` uses a discriminated union to prevent impossible states:

```typescript
type TestRunnerState = 
  | { type: 'selecting' }  // Choosing a test
  | { type: 'loaded'; snapshot; definition; executor; ... }  // Arrange complete, ready to run
  | { type: 'running'; snapshots; result; ... }  // Animating through act phase
  | { type: 'completed'; snapshots; result; ... }  // Animation done, show assertions
```

**Key Insight:** Each state has exactly the data it needs, making invalid states impossible.

### Test Execution Flow (AAA Pattern)

1. **Select Test** → `executeArrange()` → Shows initial state (`loaded`)
2. **Press Enter** → `executeActAssert()` → Captures snapshots (`running`)
3. **Auto-play** → Animates through snapshots
4. **Complete** → Shows assertions (`completed`)
5. **Press Enter** → Restart from step 1

### Arrange-Act-Assert (AAA) Pattern

Visual tests follow the AAA pattern for clarity:

```typescript
visual('test name', {
    arrange: ({ spatial, grid, store }) => {
        // Setup: Spawn initial entities
        // Runs on load, visible before play
        // No snapshots captured (silent)
    },
    act: ({ spatial, grid, store }) => {
        // Action: Perform operations
        // Each operation captured as a snapshot
        // Animated during playback
    },
    assert: ({ spatial, grid, store, expect }) => {
        // Verify: Check results
        expect('description', () => {
            if (condition) throw new Error('message');
        });
    }
});
```

### Assertion System

**Two execution modes:**

1. **Vitest (CI/CD):** Throws errors on failure, test fails
2. **Visual Runner:** Captures assertions, displays with ✓/✗

The `expect` helper bridges both:
```typescript
expect('Player at (10, 10)', () => {
    const id = spatial.getEntityIdAt(10, 10, 1);
    if (!id) throw new Error('Not found');
});
```

Results appear in `AssertionPanel` after playback completes.

## Transaction System & Game Loop

### Unified Transaction Model

**All spatial operations are deferred until `commit()`:**

```typescript
// Stage operations (no immediate side effects)
const id = spatial.spawn('player', 5, 5, GameLayers.ACTORS);
spatial.move(5, 5, 6, 5, GameLayers.ACTORS);
spatial.remove(x, y, GameLayers.ACTORS);

// Nothing visible yet...

// Execute atomically at tick boundary
spatial.commit();
```

### Hybrid API: Coordinate-Based vs Entity-Based

**SpatialSystem provides two complementary APIs:**

**Coordinate-Based (Cell-Centric):**
```typescript
// Use when you know the cell position
spatial.move(fromX, fromY, toX, toY, layer);
spatial.remove(x, y, layer);
```

**Entity-Based (Entity-Centric):**
```typescript
// Use when you already have the entity ID
spatial.moveEntity(entityId, toX, toY);
spatial.removeEntity(entityId);

// Example: Move entities from overlap detection
for (const overlap of overlaps) {
    for (const entityId of overlap.entityIds) {
        const pos = spatial.getEntityPosition(entityId);
        if (pos) {
            spatial.moveEntity(entityId, pos.x + 1, pos.y); // Move right
        }
    }
}
```

**When to use each:**
- **Entity-based (Preferred)**: System logic, AI, overlap responses, entity-centric game logic
- **Coordinate-based**: Direct cell manipulation, convoy movement, blocking function tests, map editors

Both stage operations that execute on `commit()`.

**Best Practice:** Use entity-based API in game systems for clearer, more maintainable code. Use coordinate-based API for low-level cell operations and specialized cases like convoy movement.

**Benefits:**
- All systems see the same immutable grid state during a tick
- No temporal coupling between systems
- No ghost entities from operation conflicts
- Clear causality: stage intents → commit atomically → next tick

### Pending Operations

**Tracked internally:**
- `pendingOps: PendingOperation[]` - Queue of all staged operations
- `pendingRemovals: Set<number>` - Entity IDs staged for removal
- Operations execute in order: **removals → moves → spawns**

### Lifecycle Queries (Zombie Entity Prevention)

Systems need to avoid interacting with entities staged for removal:

```typescript
// Check if entity is alive (not pending removal)
if (spatial.isAlive(entityId)) {
    // Safe to interact
}

// Get targets, excluding pending removals
const targets = spatial.getEntityIdsInRadius(x, y, 5);
// Dead entities excluded by default

// Include "corpses" if needed
const all = spatial.getEntityIdsInRadius(x, y, 5, { 
    includePendingRemovals: true 
});
```

### Inspection & Debug APIs

```typescript
// Get pending operations (read-only)
const pending = spatial.getPendingOps();

// Get entities staged for removal
const removals = spatial.getPendingRemovals();

// Debug output
console.log(spatial.debug());
// === SpatialSystem Debug ===
// Entities: 5
// Pending ops: 3
//   - Moves: 2
//   - Removals: 1
//   - Spawns: 0
```

### Cancellation APIs

```typescript
// Cancel a pending removal (resurrection)
spatial.remove(x, y, layer);
if (healingOccurred) {
    spatial.cancelRemoval(entityId);
}

// Cancel a pending spawn
const id = spatial.spawn('enemy', x, y, layer);
if (cancelled) {
    spatial.cancelSpawn(id);
}
```

### GameLoop - Tick Orchestration

The `GameLoop` orchestrates a single game tick with a three-phase cycle:

```typescript
class GameLoop {
    tick() {
        // 1. Detect overlaps from committed state
        const overlaps = spatial.detectOverlaps();
        
        // 2. Run all systems (stage intents)
        for (const system of systems) {
            system.update({ overlaps, spatial });
        }
        
        // 3. Commit all intents atomically
        spatial.commit();
    }
}
```

**Key Design:** Overlaps are detected from the *previous tick's* committed state, naturally providing 1-tick delays for overlap-based actions (like teleporters).

### GameSystem Interface

Game logic is implemented as systems that respond to overlaps:

```typescript
interface GameSystem {
    update(context: GameContext): void;
}

interface GameContext {
    overlaps: Overlap[];      // Positions with 2+ entities
    spatial: SpatialSystem;   // For staging moves
    sceneManager?: any;       // Optional cross-scene ops
    gameManager?: any;        // Optional scene transitions
}
```

### Queued Scene Transitions

Scene transitions are **queued** and execute **after** the current tick completes:

```typescript
// In TeleporterSystem.update()
gameManager.movePlayerToScene('dungeon', 5, 5, GameLayers.ACTORS);
// Player still in current scene for rest of this tick

// After GameLoop.tick() completes
gameRuntime.tick();
  // → gameLoop.tick() runs
  // → game.executePendingTransition() runs
  // → scene transition happens NOW
```

**Why:** Prevents systems from running in "zombie scenes" after the player has left.

**Implementation:**
- `GameManager.movePlayerToScene()` - Queues the transition
- `GameManager.executePendingTransition()` - Executes queued transition
- `GameRuntime.tick()` - Calls `executePendingTransition()` after game loop

Scene transitions use the transactional system:
- Remove player from old scene (with `spatial.remove()` + `commit()`)
- Spawn player in new scene (with `spatial.spawnWithId()` + `commit()`)
- Includes pre-checks for target validity and rollback on failure

### GameRuntime - Real-Time Execution

`GameRuntime` provides a complete real-time game environment:

```typescript
const runtime = GameRuntime.new({
    initialScene: { id: 'dungeon', width: 40, height: 30 },
    systems: [
        new TeleporterSystem(gameManager),
        new EnemyAISystem(),
        new ProjectileSystem()
    ],
    tickRate: 10  // 10 ticks per second
});

runtime.start();  // Begin requestAnimationFrame loop
runtime.stop();   // Pause
runtime.save();   // Serialize entire game state
runtime.restart(); // Reset to initial state
```

**Features:**
- Fixed timestep with accumulator (consistent tick rate)
- Automatic scene transition handling at tick boundaries
- Save/load/restart capabilities
- Manual tick for testing (`runtime.tick()`)

### TeleporterSystem Example

Demonstrates overlap-based mechanics:

```typescript
class TeleporterSystem implements GameSystem {
    update(context: GameContext) {
        for (const overlap of context.overlaps) {
            if (hasPlayer(overlap) && hasTeleporter(overlap)) {
                // Trigger scene transition
                this.gameManager.movePlayerToScene(
                    destSceneId, x, y, layer
                );
            }
        }
    }
}
```

The 1-tick delay happens naturally because overlaps are detected *after* the player moves onto the pad.

## Key Design Decisions

### 1. Layer Information in Snapshots

Entities include `layer` in snapshots so `GridRenderer` can show the top entity (highest layer) when multiple entities occupy the same cell.

### 2. Capture Control in TestExecutor

`captureEnabled` flag prevents arrange operations from generating snapshots. Only the final state after arrange is captured.

### 3. State Machine vs Boolean Flags

Originally used multiple `useState` calls (`testStatus`, `testResult`, `snapshots`, etc.). This led to race conditions and impossible states. The discriminated union eliminated these bugs.

### 4. Proxy for Operation Interception

`TestExecutor` wraps `SpatialSystem` in a Proxy to intercept `spawn`, `move`, `remove` calls and capture snapshots automatically.

## Common Patterns

### Adding a New Visual Test

```typescript
// In packages/spartan/test/movement.visual.test.ts
visual('test name', {
    arrange: ({ spatial }) => {
        // Setup entities
        spatial.spawn('player', 5, 5, 1);
        spatial.commit(); // IMPORTANT: Commit in arrange
    },
    act: ({ spatial }) => {
        // Perform actions using entity-based API (preferred)
        const playerId = spatial.getEntityIdAt(5, 5, 1)!;
        spatial.moveEntity(playerId, 6, 5);
        spatial.commit(); // IMPORTANT: Commit after staging
    },
    assert: ({ spatial, expect }) => {
        // Verify with expect helper
        expect('Player at new position', () => {
            const id = spatial.getEntityIdAt(6, 5, 1);
            if (!id) throw new Error('Not found');
        });
    }
});
```

### Test Fixtures for Setup

Use `TestSpatialFixture` to simplify test setup (auto-commits):

```typescript
import { TestSpatialFixture } from './test-fixtures.js';

visual('complex setup', {
    arrange: ({ spatial, grid, store }) => {
        const fixture = new TestSpatialFixture(spatial);
        
        // Auto-commits after each operation
        const playerId = fixture.placeEntity('player', 5, 5, GameLayers.ACTORS);
        fixture.placeEntity('enemy', 10, 10, GameLayers.ACTORS);
        fixture.placeEntity('wall', 7, 7, GameLayers.WALLS);
        // No manual commit() needed
    },
    act: ({ spatial }) => {
        // Test the actual behavior
        spatial.move(5, 5, 6, 5, GameLayers.ACTORS);
        spatial.commit();
    }
});
```

### Running the Visual Runner

```bash
npm run visual
# or
npm run visual -- --clear  # Clear terminal on start
```

### Running Tests with Vitest

```bash
npm test
```

## Important Files Reference

### Core Spatial System

- **`packages/spartan/spatial-system.ts`** - Main API: 
  - **Lifecycle:** `spawn()`, `remove()` (deferred), `isAlive()`
  - **Movement (Coordinate-based):** `move(fromX, fromY, toX, toY, layer)` (deferred)
  - **Movement (Entity-based):** `moveEntity(entityId, toX, toY)` (deferred)
  - **Removal (Coordinate-based):** `remove(x, y, layer)` (deferred)
  - **Removal (Entity-based):** `removeEntity(entityId)` (deferred)
  - **Commit:** `commit()`, `clearIntents()`
  - **Queries:** `getEntityPosition()`, `getEntityIdsInCell()`, `getEntityIdsInRadius()` (with `includePendingRemovals`), `getEntityIdsInLine()`, `detectOverlaps()`
  - **Inspection:** `getPendingOps()`, `getPendingRemovals()`, `debug()`
  - **Cancellation:** `cancelRemoval()`, `cancelSpawn()`
- **`packages/spartan/entity-store.ts`** - Manages entity metadata (id → data), `createWithId()` for scene transitions
- **`packages/grid/linked-grid.ts`** - Grid with spatial navigation
- **`packages/grid/linked-cell.ts`** - Individual cell with `items[]` array
- **`packages/grid/linked-cell-utils.ts`** - Static geometric helpers

### Multi-Scene System

- **`packages/spartan/scene.ts`** - Scene (isolated grid + spatial + entities)
- **`packages/spartan/scene-manager.ts`** - SceneManager (manages multiple scenes)
- **`packages/spartan/game-manager.ts`** - GameManager (cross-scene coordinator, save/load)
  - **Queued Transitions:** `movePlayerToScene()` queues, `executePendingTransition()` executes
  - **Transaction-based:** Uses `spatial.remove()` and `spatial.spawnWithId()` with rollback
- **`packages/spartan/game-state.ts`** - GameState (lives, score, playerEntityId, global entity ID counter)

### Game Loop & Runtime

- **`packages/spartan/game-loop.ts`** - GameLoop (tick orchestration: detect → systems → commit)
- **`packages/spartan/game-runtime.ts`** - GameRuntime (real-time execution with fixed timestep)
- **`packages/spartan/teleporter-system.ts`** - TeleporterSystem (example overlap-based system)
- **`packages/spartan/types.ts`** - GameSystem, GameContext, Overlap interfaces

### Visual Test Runner

- **`packages/visual-runner/components/App.tsx`** - Main state machine, orchestrates everything
- **`packages/visual-runner/lib/test-executor.ts`** - Executes tests, captures snapshots, handles AAA phases
- **`packages/spartan/test/visual-helpers.ts`** - Defines `visual()` helper and AAA pattern types

### Test Files

- **`packages/spartan/test/movement.visual.test.ts`** - 5 core spatial operation tests (all have assertions)
- **`packages/spartan/test/assertions.visual.test.ts`** - AAA pattern demonstration tests
- **`packages/spartan/test/scene-transition.visual.test.ts`** - Multi-scene teleporter tests
- **`packages/spartan/test/scene-system.test.ts`** - Scene/SceneManager/GameManager unit tests
- **`packages/spartan/test/game-loop.test.ts`** - GameLoop unit tests (overlap detection, system execution)
- **`packages/spartan/test/game-runtime.test.ts`** - GameRuntime unit tests (save/load/restart)
- **`packages/spartan/test/transaction-consistency.test.ts`** - Unified transaction model tests (deferred ops, zombie entities, cancellation)
- **`packages/spartan/test/test-fixtures.ts`** - TestSpatialFixture helper for test setup (auto-commits)

## Responsibility Matrix (CRISP Architecture)

Each component has a single, clear responsibility with no blurred lines:

| Component | Responsibility | Does NOT Handle |
|-----------|---------------|-----------------|
| **LinkedGrid** | Grid topology, cell navigation | Entities, game logic |
| **LinkedCell** | Cell properties (values/masks/distances) | Entity behavior, movement |
| **SpatialSystem** | Entity positions, deferred operations (spawn/move/remove), lifecycle queries, overlap detection | Game logic, scenes |
| **Scene** | Isolated game area (grid + spatial + entities) | Cross-scene ops, game loop |
| **SceneManager** | Scene lifecycle, active scene tracking | Game state, player movement |
| **GameManager** | Cross-scene coordinator, save/load, queued player scene transitions | Game loop, systems |
| **GameLoop** | Tick orchestration (detect → systems → commit) | Real-time timing, scene transitions |
| **GameRuntime** | Real-time execution, fixed timestep, lifecycle, executing queued scene transitions | Game logic (that's systems) |
| **GameSystem** | Game-specific logic responding to overlaps | Spatial operations (delegates to context) |

**Key Insights:** 
- **All spatial operations are deferred** (stage via `spawn()`/`move()`/`remove()`, execute via `commit()`)
- **Lifecycle queries** prevent "zombie entity" interactions (`isAlive()`, filtered radius queries)
- **Scene transitions are queued** and execute at tick boundaries (after `commit()`)
- Overlaps are detected from committed state, enabling natural 1-tick delays

## Troubleshooting

### "Arrange operations showing as first snapshot"

Check that `captureEnabled = false` during arrange in `test-executor.ts`.

### "Tests pass but no visual feedback"

Ensure the test is using the `expect()` helper in the assert phase, not just throwing errors.

### "Grid not showing top entity on overlapping layers"

`GridRenderer.tsx` should find all entities at a position and use `.reduce()` to get the highest layer.

### "State transitions causing jank"

Check that the state machine in `App.tsx` is properly handling all transitions. Each state should have the minimum required data.

### "Scene tests showing empty grid or flickering"

Ensure `ctx.spatial` is correctly proxied to the active scene's spatial system. See `setupSceneSpatialDelegate` in `test-executor.ts`.

### "Tick count not incrementing"

`GameRuntime.tick()` should increment `_tickCount`. The internal loop also increments it.

## Future Directions

### Implemented
✓ Multi-scene system (Scene, SceneManager, GameManager)  
✓ Game loop with overlap detection  
✓ Real-time runtime with fixed timestep  
✓ Save/load/restart capabilities  
✓ GameSystem interface for modular game logic

### Potential Additions

1. **Event Bus** - For decoupled system communication (see `teleporter-design-notes.md`)
2. **Timed Actions** - Delayed events (requires event system)
3. **Input System** - Player input collection before logic phase
4. **Pathfinding** - Leverage LinkedGrid's spatial queries
5. **HTML Renderer** - Parallel to the terminal runner for web demos
6. **Network Sync** - Deterministic replay for multiplayer

## Testing Strategy

- **Unit Tests** (`*.test.ts`) - Fast, focused, run in CI
- **Visual Tests** (`*.visual.test.ts`) - Animated, verified, dual-purpose:
  - Run headless with Vitest for CI
  - Run with visual runner for development

Both use the same test code, ensuring visual demos are real tests.

## Key Takeaways for Agents

1. **Respect the Spartan rules** - Keep changes minimal and explicit
2. **The state machine is sacred** - Don't revert to boolean flags
3. **AAA pattern is mandatory** - All visual tests must separate arrange/act/assert
4. **Assertions must be visual** - Use `expect()` helper, not bare throws
5. **Layers matter** - Always consider layer ordering when rendering or querying
6. **Clean up is automatic** - SpatialSystem handles cell cleanup (Rule 6)
7. **All spatial operations are deferred** - Always `commit()` after staging `spawn()`/`move()`/`remove()`
8. **Check lifecycle before interacting** - Use `isAlive()` to avoid zombie entities
9. **Scenes are isolated** - Each scene has its own grid, spatial, and entities
10. **Scene transitions are queued** - Executed at tick boundaries, not mid-tick
11. **Systems are stateless** - Game logic in systems, state in GameContext
12. **Overlaps drive gameplay** - Use overlap detection for triggers, items, collisions
13. **Use test fixtures for setup** - `TestSpatialFixture` auto-commits for convenience
14. **Inspection APIs for debugging** - `debug()`, `getPendingOps()` show staged state

## Questions to Ask

When modifying the codebase, ask:

- Does this follow Spartan principles? (minimal, explicit, testable)
- Will this work in both Vitest and the visual runner?
- Does the state machine remain impossible to break?
- Are we maintaining backward compatibility with existing tests?
- Does this respect the 10 Spartan spatial rules?
- Is the responsibility matrix still CRISP? (no blurred lines)
- Are overlaps detected from committed state?
- Do systems only stage intents, not commit them?
- Are lifecycle queries used to prevent zombie entity interactions?
- Are scene transitions queued and executed at tick boundaries?
- Is scene isolation maintained?
- Are all spatial operations deferred until `commit()`?
- Do tests call `commit()` after staging operations?

---

**Last Updated:** 2026-01-27  
**Version:** After unified transaction model implementation (deferred spawn/move/remove, lifecycle queries, queued scene transitions) + hybrid API (entity-based convenience methods)
