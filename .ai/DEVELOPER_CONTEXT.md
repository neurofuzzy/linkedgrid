# LinkedGrid Developer Context

## Project Overview

LinkedGrid is a **Spartan grid-based game framework** built on minimalist principles. It provides a spatial entity system for grid-based games with a focus on simplicity, performance, and correctness.

### Core Philosophy: Spartan Development Rules

See `specs/spartan-dev-rules.md` for full details:
1. **Minimal** - Only what is necessary
2. **Explicit** - No magic, clear intent
3. **Testable** - Everything must be verifiable
4. **Visual** - Show, don't just tell
5. **Deterministic** - Same input = same output

## Architecture

### Cell-Centric Sparse Entity System

```
GameRuntime (real-time execution)
    └─> GameManager (cross-scene coordinator)
        ├─> GameState (global: score, lives, playerEntityId)
        │   └─> EntityStore (entity metadata by ID)
        └─> SceneManager (multi-scene bookkeeping)
            └─> Scene (isolated game area)
                ├─> LinkedGrid (topology + cells)
                ├─> SpatialSystem (positions + deferred ops)
                └─> EntityStore (scene entities)
    └─> GameLoop (tick: detect → systems → commit)
        └─> Systems[] (game logic)
```

**Key Concepts:**
- **Entities** live in `cell.values[layer]` as IDs
- **Metadata** stored separately in EntityStore
- **Operations** staged → validated → committed
- **Scenes** are isolated (own grid/spatial/entities)

## Entity Trait System

**Philosophy:** Entities are dumb data, systems are smart logic.

```typescript
// Entity (pure data)
type EntityData = { id: number; type: string; [key: string]: unknown; };

// Trait (interface)
interface HasHealth { health: number; maxHealth: number; }

// Entity Type (composition)
type PlayerData = EntityData & HasHealth & HasInventory;

// Type Guard (runtime check)
function hasHealth(e: EntityData): e is EntityData & HasHealth {
    return typeof e.health === 'number';
}

// System Usage
class DamageSystem implements GameSystem {
    update({ overlaps, spatial }: GameContext) {
        for (const overlap of overlaps) {
            const entity = spatial.getEntityData(overlap.entityIds[0]);
            if (hasHealth(entity)) {
                // TypeScript knows entity.health exists
            }
        }
    }
}
```

**Organization:** `packages/spartan/entities/`
- `traits.ts` - Trait interfaces
- `entity-types.ts` - Composed entity types
- `trait-guards.ts` - Runtime type predicates
- `spawn-helpers.ts` - Type-safe factories

**Built-in Traits:** HasHealth, CanDealDamage, HasAI, HasInventory, IsLockable, IsCollectible, HasColor, HasSceneLocation, HasTeleportTarget, HasFloorEffect, HasPropagation, HasTemperature, HasExplosion

## Reactive Intent-Based Architecture

**Core Pattern:** Dumb inputs → Smart systems → Commit validates

```
1. PlayerInputSystem → stages move (no validation)
2. DoorSystem → sees intent, unlocks door if key present
3. spatial.commit() → validates move, executes if valid
```

**Why Reactive?**
- Input systems don't know game rules
- Game systems react to actual player actions
- Natural, event-driven behavior
- Systems only run when relevant

**Example Flow:**
```typescript
// PlayerInputSystem (dumb)
spatial.move(pos.x, pos.y, newX, newY, GameLayers.ACTORS);
// No validation, always stages

// DoorSystem (reactive)
const pendingOps = spatial.getPendingOps();
for (const op of pendingOps) {
  if (op.type === 'move' && op.entityId === playerId) {
    const destCell = spatial.grid.cell(op.toX, op.toY);
    if (hasDoorAt(destCell) && playerHasKey()) {
      spatial.remove(destCell.x, destCell.y, GameLayers.WALLS);
      // Door removed → BLOCKING mask cleared
    }
  }
}

// spatial.commit() (validator)
if (!isBeingVacated && this.isBlocked(toCell)) {
  continue; // Skip blocked moves
}
```

**System Order Matters:**
1. PlayerInputSystem (stages intents)
2. DoorSystem, CollectionSystem (react to intents)
3. TeleporterSystem (reacts to overlaps)
4. commit() validates and executes

## Transaction System

**All spatial operations are deferred:**

```typescript
spatial.spawn('player', 5, 5, GameLayers.ACTORS);
spatial.move(5, 5, 6, 5, GameLayers.ACTORS);
spatial.remove(x, y, layer);
// Nothing happens yet...

spatial.commit(); // Execute atomically
```

**Benefits:**
- Systems see immutable grid state during tick
- No ghost entities from conflicts
- Clear causality: stage → validate → commit

**Lifecycle Queries:**
```typescript
spatial.isAlive(entityId)  // Not pending removal?
spatial.getPendingOps()    // Inspect staged operations
spatial.getPendingRemovals() // Entities staged for removal
```

**GameLoop Tick:**
```typescript
tick() {
    const overlaps = spatial.detectOverlaps();
    for (const system of systems) {
        system.update({ overlaps, spatial });
    }
    spatial.commit();
}
```

**Intent Lifecycle:**

See detailed documentation in `packages/spartan/spatial-system.ts` for the two-phase operation model (Intent Staging → Commit) and critical timing implications for same-tick queries.

**Queue Lifecycle Patterns:**

See `specs/queue-lifecycle-patterns.md` for correct patterns when implementing deferred operations in systems. Key rule: clear queues immediately after consuming them to avoid state leakage across ticks.

## Multi-Scene Architecture

**Scenes are isolated:** Each has own grid, spatial, entities.

**Scene Transitions:**
- Queued during tick: `gameManager.movePlayerToScene(sceneId, x, y, layer)`
- Executed after tick: `gameRuntime.tick()` calls `executePendingTransition()`
- Transactional: Uses `remove()` + `spawnWithId()` + `commit()` with rollback

**Why Queued?** Prevents systems from running in "zombie scenes" after player leaves.

## Visual Testing

See `specs/visual-test-timing-guide.md` for complete timing best practices and patterns.

**AAA Pattern:**
```typescript
visual('test name', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 5, 5, GameLayers.ACTORS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        spatial.move(5, 5, 6, 5, GameLayers.ACTORS);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        expect('Player moved', () => {
            if (!spatial.getEntityIdAt(6, 5, GameLayers.ACTORS)) {
                throw new Error('Not found');
            }
        });
    }
});
```

**Dual execution:**
- Vitest (CI) - Throws on failure
- Visual runner - Shows animated grid + assertions

## The 10 Spartan Spatial Rules

See `specs/spartan-game-rules.md` for details:

1. Entities occupy one cell at a time
2. Entities occupy a layer on a cell
3. Check destination before moving
4. Multiple entities per cell via layers
5. Spatial queries are first-class
6. Clean up old cell on move
7. Overlap detection, not collision prevention
8. Higher layers render on top
9. Overlap events propagate by layer
10. LinkedCells never move

## Layer System

See `specs/spartan-layer-rules.md` for full specification.

**9 Semantic Layers:**
```typescript
const GameLayers = {
    FLOOR: 1,          // Terrain, floor tiles
    FLOOR_EFFECTS: 2,  // Effects on floor (ash, burn marks)
    LOGIC: 3,          // AI paths, zones and entities (non-rendering)
    COLLECTIBLES: 4,   // Pickups, items
    WALLS: 5,          // Static obstacles, closed doors
    ACTORS: 6,         // Players, enemies
    EPHEMERALS: 7,     // Temporary effects (fire visuals, particles)
    TEST: 8            // Text overlays
};
```

**Layer 0** is reserved for empty cells.

**Cell Masks:** `CellMasks.BLOCKING` and `CellMasks.VISION_BLOCKING` are automatically managed by SpatialSystem.

### Adding an Entity Type

1. Define trait in `entities/traits.ts` (if needed)
2. Define type in `entities/entity-types.ts`
3. Add guard in `traits/trait-guards.ts`
4. Add spawn helper in `entities/spawn-helpers.ts`
5. Use in systems with type guards

### Testing with Headless Input

```typescript
const config = {
  scenes: [...],
  systems: ['DoorSystem'],
  input: { type: 'headless' }
};

const runtime = loader.load(config);
const input = runtime.inputManager as HeadlessInputManager;

input.setDirection(Direction.RIGHT);
runtime.gameLoop.tick();
input.clearInput();
```

## Responsibility Matrix

See `specs/spartan-responsibilities.md` for complete matrix.

**Quick Reference:**
- **LinkedGrid** - Topology, cell navigation
- **LinkedCell** - Value storage per layer
- **SpatialSystem** - Positions, deferred ops, validation
- **Scene** - Isolated game area container
- **SceneManager** - Multi-scene bookkeeping
- **GameManager** - Cross-scene coordinator
- **GameLoop** - Tick orchestration
- **GameRuntime** - Real-time execution
- **PlayerInputSystem** - Input → movement intents
- **GameSystem** - Game logic responding to overlaps/intents

## Key Takeaways

1. **Entities are dumb** - Just data with traits
2. **Systems are smart** - All logic in systems
3. **Operations are deferred** - Stage → validate → commit
4. **Scenes are isolated** - No cross-scene awareness
5. **Transitions are queued** - Execute at tick boundaries
6. **Input systems are dumb** - No validation, just intents
7. **Game systems are reactive** - Inspect pending ops
8. **Validation in commit** - SpatialSystem gates execution
9. **System order matters** - Input → reactive → commit
10. **Traits enable type safety** - Use guards in systems
11. **Test with visual runner** - AAA pattern, dual execution
12. **Configure via JSON** - Input, systems, scenes
13. **Fire is temperature-based** - Fire is a state, not an entity

## Questions to Ask

When modifying code:
- Does this follow Spartan principles? (minimal, explicit, testable)
- Are entities kept dumb with logic in systems?
- Should this be a trait, entity type, or system?
- Are operations staged then committed?
- Is system execution order correct?
- Are pending operations used for reactive behavior?
- Is input configured via JSON?
- Will this work in both Vitest and visual runner?

## Important Files

**Specs:**
- `specs/spartan-dev-rules.md` - 5 development principles
- `specs/spartan-game-rules.md` - 10 spatial rules
- `specs/spartan-layer-rules.md` - 8-layer specification
- `specs/spartan-responsibilities.md` - Component responsibility matrix
- `specs/visual-test-timing-guide.md` - Visual test best practices and timing patterns
- `specs/queue-lifecycle-patterns.md` - Correct patterns for deferred operations

## Troubleshooting

**"TypeError: setEntityData is not a function"**
→ Use `gameManager.gameState.entityStore.setData(id, data)` not `spatial.setEntityData()`

**"Systems not running in order"**
→ PlayerInputSystem must be registered BEFORE reactive systems in SceneLoader

**"Door won't unlock"**
→ Check: 1) System order, 2) DoorSystem inspecting pending ops, 3) Masks being updated

**"Test passes but no visual"**
→ Use `expect()` helper in assert phase, not bare throws

**"Ghost entities"**
→ Use `isAlive()` checks or `getPendingRemovals()` to filter zombies

---

**Last Updated:** 2026-02-05  
**Version:** Phase 1.5 - TypeScript strict mode, normalized entity types
