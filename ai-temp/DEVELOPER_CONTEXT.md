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

**Key Concept:** Entities are stored primarily in cell layers (`cell.items[layer]`), with minimal metadata in a separate store.

```
LinkedGrid (20x20)
    └─> LinkedCell (x, y)
        └─> items: number[]  ← Entity IDs by layer
        
SparseEntityStore
    └─> Map<id, EntityData>  ← Minimal entity metadata
    
SpatialSystem
    └─> Coordinates operations between grid and store
```

## Project Structure

```
linkedgrid/
├── packages/
│   ├── grid/                    # Core LinkedGrid data structure
│   │   ├── linked-cell.ts       # Individual cell with navigation
│   │   ├── linked-grid.ts       # 2D grid of linked cells
│   │   └── interfaces.ts        # Type definitions
│   │
│   ├── spartan/                 # Spatial entity system
│   │   ├── entity-store.ts      # SparseEntityStore (id → data)
│   │   ├── spatial-system.ts    # SpatialSystem (spawn/move/queries)
│   │   ├── types.ts             # Entity types & layers
│   │   └── test/
│   │       ├── visual-helpers.ts         # visual() helper + AAA pattern
│   │       ├── movement.visual.test.ts   # 5 core spatial tests
│   │       └── assertions.visual.test.ts # AAA demonstration tests
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
│   └── spartan-dev-rules.md    # The 5 development principles
│
└── ai-temp/                     # Context for AI agents
    ├── architecture-alternatives.md  # Original architecture decision doc
    └── DEVELOPER_CONTEXT.md          # This file
```

## The 10 Spartan Spatial Rules

Critical for understanding how the spatial system works:

1. **Entities occupy one cell at a time**
2. **Entities occupy a layer on a cell** - `cell.items[layer] = entityId`
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
    },
    act: ({ spatial }) => {
        // Perform actions (each creates a snapshot)
        spatial.move(5, 5, 6, 5, 1);
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

- **`packages/spartan/spatial-system.ts`** - Main API: `spawn()`, `move()`, `remove()`, spatial queries
- **`packages/spartan/entity-store.ts`** - Manages entity metadata (id → data)
- **`packages/grid/linked-grid.ts`** - Grid with spatial navigation
- **`packages/grid/linked-cell.ts`** - Individual cell with `items[]` array

### Visual Test Runner

- **`packages/visual-runner/components/App.tsx`** - Main state machine, orchestrates everything
- **`packages/visual-runner/lib/test-executor.ts`** - Executes tests, captures snapshots, handles AAA phases
- **`packages/spartan/test/visual-helpers.ts`** - Defines `visual()` helper and AAA pattern types

### Test Files

- **`packages/spartan/test/movement.visual.test.ts`** - 5 core spatial operation tests (all have assertions)
- **`packages/spartan/test/assertions.visual.test.ts`** - AAA pattern demonstration tests

## Troubleshooting

### "Arrange operations showing as first snapshot"

Check that `captureEnabled = false` during arrange in `test-executor.ts`.

### "Tests pass but no visual feedback"

Ensure the test is using the `expect()` helper in the assert phase, not just throwing errors.

### "Grid not showing top entity on overlapping layers"

`GridRenderer.tsx` should find all entities at a position and use `.reduce()` to get the highest layer.

### "State transitions causing jank"

Check that the state machine in `App.tsx` is properly handling all transitions. Each state should have the minimum required data.

## Future Directions

Based on `specs/architecture-alternatives.md`, potential additions:

1. **Event System** - React to overlaps (Rule 7)
2. **Turn System** - Deterministic tick-based gameplay
3. **Pathfinding** - Leverage LinkedGrid's spatial queries
4. **HTML Renderer** - Parallel to the terminal runner for web demos

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

## Questions to Ask

When modifying the codebase, ask:

- Does this follow Spartan principles? (minimal, explicit, testable)
- Will this work in both Vitest and the visual runner?
- Does the state machine remain impossible to break?
- Are we maintaining backward compatibility with existing tests?
- Does this respect the 10 Spartan spatial rules?

---

**Last Updated:** 2026-01-26  
**Version:** After AAA pattern implementation and assertion system
