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

## Input System Integration

Input is configured via JSON, not hardcoded:

```json
{
  "scenes": [...],
  "systems": ["DoorSystem", "CollectionSystem"],
  "input": {
    "type": "keyboard",
    "options": { "directionMode": "continuous" }
  }
}
```

**Input Types:**
- `keyboard` - DOM events (WASD, arrows)
- `headless` - Programmatic (for tests)
- `none` - No input (AI-only games)

**PlayerInputSystem** is auto-created by SceneLoader and registered FIRST (before other systems) for correct execution order.

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
    COLLECTIBLES: 4,   // Pickups, items
    WALLS: 5,          // Static obstacles, closed doors
    ACTORS: 6,         // Players, enemies
    EPHEMERALS: 7,     // Temporary effects (fire visuals, particles)
    DEBUG: 8           // Debug overlays
};
```

**Layer 0** is reserved for empty cells.

**Cell Masks:** `CellMasks.BLOCKING` and `CellMasks.VISION_BLOCKING` are automatically managed by SpatialSystem.

## Project Structure

```
linkedgrid/
├── packages/
│   ├── grid/              # LinkedGrid + LinkedCell
│   ├── spartan/           # Spatial entity system
│   │   ├── entities/      # Traits, types, guards, spawn helpers
│   │   ├── systems/       # PlayerInputSystem, DoorSystem, etc.
│   │   ├── input/         # InputManager, HeadlessInputManager
│   │   └── test/          # Visual tests + unit tests
│   └── visual-runner/     # Terminal test UI
├── specs/                 # Design documents
├── dev/                   # Playground demos + scene loader
└── .ai/                   # AI agent context
```

## Key APIs

### SpatialSystem
```typescript
// Lifecycle (deferred)
spawn(type, x, y, layer, data?) → entityId
remove(x, y, layer)
isAlive(entityId) → boolean

// Movement (deferred)
move(fromX, fromY, toX, toY, layer, blockFn?)
moveEntity(entityId, toX, toY, blockFn?)

// Validation
isBlocked(cell) → boolean
isWalkable(cell) → boolean
blocksVision(cell) → boolean

// Commit
commit() // Validate and execute all operations
clearIntents()

// Queries
getEntityPosition(id) → {x, y, layer}
getEntityIdsInCell(x, y, layer) → number[]
getEntityIdsInRadius(x, y, radius) → number[]
detectOverlaps() → Overlap[]

// Inspection
getPendingOps() → PendingOperation[]
getPendingRemovals() → Set<number>
debug() → string
getDebugState() → object // System-specific debug info
```

### GameSystem Interface
```typescript
interface GameSystem {
    update(context: GameContext): void;
}

interface GameContext {
    overlaps: Overlap[];
    spatial: SpatialSystem;
    sceneManager?: SceneManager;
    gameManager?: GameManager;
}
```

## Common Patterns

### Adding a System

```typescript
class MySystem implements GameSystem {
    private myQueue: Array<{x: number, y: number}> = [];
    
    constructor(private gameManager: GameManager) {}
    
    update({ overlaps, spatial }: GameContext) {
        // React to overlaps or inspect pending ops
        const pendingOps = spatial.getPendingOps();
        
        // Stage operations (no immediate effect)
        spatial.move(x, y, x2, y2, layer);
        spatial.remove(x, y, layer);
        
        // Update entity data via global store
        this.gameManager.gameState.entityStore.setData(id, { health: 50 });
    }
    
    // Optional: Expose internal state for debugging
    getDebugState() {
        return {
            queueSize: this.myQueue.length,
            queueContents: [...this.myQueue],
        };
    }
}
```

**Register in JSON:**
```json
{
  "systems": ["MySystem"],
  "input": { "type": "keyboard" }
}
```

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

## Fire System

The fire system enables realistic fire spread based on temperature mechanics. **Fire is a state, not an entity.**

### Core Concept

Fire is implemented as a temperature-based state system. Entities with temperature ≥ their flame point are "on fire" and spread heat to adjacent entities.

### HasTemperature Trait

```typescript
interface HasTemperature {
  temperature: number;   // Current temperature
  flammable: boolean;    // Can this entity catch fire?
  flamePoint: number;    // Temperature at which entity ignites
}
```

### Fire Mechanics

1. **Fire is a state** - Entities with `temperature >= flamePoint` are burning
2. **Fire spreads via temperature** - Burning entities raise adjacent entity temperatures
3. **Fire deals damage** - Burning entities lose HP over time
4. **Ash spawning** - Non-explosive entities spawn ash when burned out
5. **Visual effects** - Fire visuals spawned on `EPHEMERALS` layer

### FireSystem Processing Phases

```typescript
update(context: GameContext) {
  1. detectIgnitions()      // Find entities at/above flame point
  2. spreadFire()           // Raise adjacent entity temperatures
  3. applyFireDamage()      // Reduce HP of burning entities
  4. cleanupBurnedEntities() // Spawn ash, remove entities at 0 HP
  5. applyTemperatureDecay() // Cool down non-burning entities
}
```

### Constants

```typescript
FIRE_DAMAGE_RATE = 5;           // HP lost per damage tick
FIRE_DAMAGE_CADENCE = 2;        // Ticks between damage applications
TEMPERATURE_INCREASE = 50;      // Temperature added to neighbors per tick
TEMPERATURE_DECAY = 10;         // Temperature lost per tick when not near fire
```

### Common Temperature Values

| Material | Flame Point | HP | Layer | Usage |
|----------|------------|-----|-------|-------|
| Grass | 150 | 100 | FLOOR | Burns slowly, spreads steadily |
| Gasoline | 100 | 10 | COLLECTIBLES | Ignites easily, burns fast |
| Fuse | 120 | 15 | COLLECTIBLES | Predictable burning |
| Barrel | 200 | 20 | COLLECTIBLES | Hard to ignite, explosive |

### Example Usage

```typescript
// Create flammable grass
spatial.spawn('grass', 5, 5, GameLayers.FLOOR, {
  temperature: 0,        // Starts cool
  flammable: true,
  flamePoint: 150,
  hp: 100,
  maxHp: 100,
  color: '#7cba00'
});

// Ignite via explosion or direct temperature manipulation
const grassData = spatial.getEntityData(grassId);
grassData.temperature = 200;  // Above flame point → ignites

// FireSystem will:
// 1. Detect ignition (temp >= 150)
// 2. Spawn fire-visual on EPHEMERALS layer
// 3. Spread +50 temp to adjacent entities per tick
// 4. Apply 5 HP damage every 2 ticks
// 5. When HP = 0, spawn ash and remove grass
```

### Integration with Explosion System

The `ExplosionSystem` ignites flammable entities by raising their temperature:

```typescript
// In ExplosionSystem.applyExplosionEffects()
if (hasTemperature(entityData) && entityData.flammable) {
  entityData.temperature = entityData.flamePoint + 50; // Ensure ignition
}
```

### Layer Organization

- **FLOOR layer** - Flammable terrain (grass, wood floors)
- **FLOOR_EFFECTS layer** - Ash from burned entities
- **COLLECTIBLES layer** - Flammable items (gasoline, fuses, barrels)
- **EPHEMERALS layer** - Fire visual effects (managed by FireSystem)

### Fire Spread Algorithm

Fire spreads to 4-directional neighbors (UP, DOWN, LEFT, RIGHT):

```typescript
// For each burning entity
for (const burningEntity of burningEntities) {
  // Check all 4 neighbors
  for (const neighbor of [UP, DOWN, LEFT, RIGHT]) {
    // Check multiple layers (FLOOR, COLLECTIBLES, WALLS, ACTORS)
    for (const layer of layers) {
      const entity = getEntityAt(neighbor.x, neighbor.y, layer);
      if (hasTemperature(entity)) {
        entity.temperature += 50; // Raise temperature
      }
    }
  }
}
```

### Key Differences from Old System

**Old (Propagation-based):**
- Fire was an entity with `HasPropagation` trait
- Spread by spawning new fire entities
- Probability-based spreading
- Fire entities had lifetime and burned out

**New (Temperature-based):**
- Fire is a state (`temperature >= flamePoint`)
- Spreads by raising adjacent temperatures
- Deterministic spreading (always +50 per tick per neighbor)
- Burning entities lose HP and spawn ash when consumed

### Implementation Notes

- `FireSystem` tracks burning entities in private map
- Visual effects (`fire-visual`) are ephemeral and managed automatically
- Temperature decay prevents entities from staying hot forever
- Explosive entities (with `HasExplosion`) are left at HP=0 for `ExplosionSystem` to handle
- Fire only spreads to entities with `HasTemperature` trait

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

**Core:**
- `packages/spartan/spatial-system.ts` - Main API
- `packages/spartan/game-loop.ts` - Tick orchestration
- `packages/spartan/game-manager.ts` - Cross-scene coordinator
- `packages/spartan/types.ts` - Core interfaces

**Entities:**
- `packages/spartan/entities/traits.ts` - Trait interfaces
- `packages/spartan/traits/trait-guards.ts` - Type guards

**Systems:**
- `packages/spartan/systems/player-input-system.ts` - Input translation
- `packages/spartan/systems/door-system.ts` - Reactive door unlocking
- `packages/spartan/systems/collection-system.ts` - Item collection
- `packages/spartan/systems/teleporter-system.ts` - Scene transitions
- `packages/spartan/systems/propagation-system.ts` - Spatial spreading effects (water, gas, chain reactions)
- `packages/spartan/systems/fire-system.ts` - Temperature-based fire spread and burning
- `packages/spartan/systems/explosion-system.ts` - Explosion triggers, damage, and ignition
- `packages/spartan/systems/floor-effect-system.ts` - Damage/healing over time

**Testing:**
- `packages/spartan/test/visual-helpers.ts` - visual() helper
- `packages/spartan/test/movement.visual.test.ts` - Core spatial tests

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

**Last Updated:** 2026-01-28  
**Version:** Temperature-based fire system with explosion integration
