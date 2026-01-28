# Spartan Architecture Responsibilities

## Responsibility Matrix

| Component | Primary Job | Owns | Operates On | Lifecycle | Dependencies |
|-----------|-------------|------|-------------|-----------|--------------|
| **LinkedGrid** | Topology | Cells, neighbor links | 2D coordinate space | Created once per scene | None |
| **LinkedCell** | Storage | values[], masks[], distances[] | Self (one cell) | Lives with grid | Grid reference |
| **SpatialSystem** | Entity positioning | Position map, pending ops queue, pending removals set | Entities in one grid | Lives with scene | Grid + Store |
| **Scene** | Scene container | Grid + Spatial + Store | One game area | Created by SceneManager | GameState (for IDs) |
| **SceneManager** | Multi-scene bookkeeping | Scene map, active ID | All scenes | Lives with GameManager | GameState |
| **GameManager** | Top-level coordinator | GameState + SceneManager + pending transition | Cross-scene operations | Root object | None |
| **GameLoop** | Tick orchestration | Systems list | ONE SpatialSystem | Created per scene | SpatialSystem |
| **GameRuntime** | Real-time execution | GameManager + GameLoop + timer | Active scene | Root object | GameManager |

---

## Component Responsibilities (Detailed)

### LinkedGrid
**One Job:** Provide 2D grid topology and cell access

**Owns:**
- Array of LinkedCell instances
- Grid dimensions (width, height)
- Wrap mode (toroidal or bounded)

**Provides:**
- `cell(x, y)` - O(1) coordinate access
- `cells` - flat array for iteration
- Neighbor linking logic

**Does NOT:**
- Know about entities
- Handle movement
- Run game logic
- Care about layers (cells do that)

**Boundary Test:** Could you use LinkedGrid for terrain/tiles without entities? **YES** ✓

---

### LinkedCell
**One Job:** Store multiple values at one grid position

**Owns:**
- `values[]` - one value per layer (typically entity IDs)
- `masks[]` - boolean flags per layer (visibility, etc.)
- `distances[]` - numeric data per layer (distance maps, lighting)

**Provides:**
- `getValue(layer)` / `setValue(layer, value)`
- `getMask(layer)` / `setMask(layer, value)`
- `getDistance(layer)` / `setDistance(layer, value)`
- Neighbor references (UP, DOWN, LEFT, RIGHT)

**Does NOT:**
- Know what the values represent (entities? tiles? terrain?)
- Handle movement logic
- Validate game rules

**Boundary Test:** Could you use LinkedCell for lighting without entities? **YES** ✓

---

### SpatialSystem
**One Job:** Manage entity positions and deferred spatial operations within ONE grid

**Owns:**
- `positions: Map<entityId, {x, y, layer}>` - position tracking
- `pendingOps: PendingOperation[]` - queue of all staged operations (spawn/move/remove)
- `pendingRemovals: Set<entityId>` - entities staged for removal
- Reference to grid and store

**Provides:**
- **Lifecycle:** `spawn()` (deferred), `remove()` (deferred), `isAlive()` (checks pending removals)
- **Movement (Coordinate-based):** `move(fromX, fromY, toX, toY, layer)` - stage move by cell position
- **Movement (Entity-based):** `moveEntity(entityId, toX, toY)` - stage move by entity ID
- **Removal (Coordinate-based):** `remove(x, y, layer)` - stage removal by cell position
- **Removal (Entity-based):** `removeEntity(entityId)` - stage removal by entity ID
- **Commit:** `commit()` (validate and execute all staged operations)
- **Validation:** `isBlocked()`, `blocksVision()`, `isWalkable()` - cell state queries
- **Mask Management:** `updateCellMasks()`, `syncMasks()` - automatic BLOCKING/VISION_BLOCKING mask updates
- **Queries:** `getEntityPosition()`, `getEntityIdsInCell()`, `getEntityIdsInRadius()` (with `includePendingRemovals` option), `getEntityIdsInLine()`
- **Overlap:** `detectOverlaps()` - find cells with 2+ entities
- **Iteration:** `getAllPositions()` - all tracked positions
- **Inspection:** `getPendingOps()`, `getPendingRemovals()`, `debug()` - for debugging/visualization
- **Cancellation:** `cancelRemoval()`, `cancelSpawn()` - undo staged operations
- **Scene Transitions:** `spawnWithId()` - spawn with pre-determined ID (for player migration)

**Does NOT:**
- Know about scenes (just operates on its grid)
- Know about game rules (teleporters, damage, etc.)
- Handle input
- Run game loops
- Know about other spatial systems
- Pre-validate operations (validation happens in commit)

**Boundary Test:** Could you have two SpatialSystems operating on different grids independently? **YES** ✓

**Key Insights:** 
- Each scene has its own SpatialSystem. They don't talk to each other.
- **All operations are deferred** - nothing happens until `commit()`
- **Validation happens in commit** - moves are checked for blocking, occupancy, conflicts during execution
- **Lifecycle queries** prevent interaction with "zombie entities" (pending removals)
- **Pending operations are inspectable** - systems can react to intents via `getPendingOps()`
- **Hybrid API** - Provides both coordinate-based (cell-centric) and entity-based (entity-centric) operations for flexibility
- **Automatic mask management** - BLOCKING and VISION_BLOCKING masks updated on spawn/move/remove

---

### Scene
**One Job:** Container for one spatial game area

**Owns:**
- LinkedGrid (for this scene)
- SpatialSystem (for this scene)
- EntityStore (for this scene)
- Scene metadata (name, music, etc.)
- Scene ID (string)

**Provides:**
- `getPlayerPosition()` - convenience wrapper
- `serialize()` / `deserialize()` - save/load

**Does NOT:**
- Run game ticks
- Handle scene transitions
- Know about other scenes
- Manage game state (lives, score, etc.)

**Boundary Test:** Could a scene exist in isolation without knowing about other scenes? **YES** ✓

**Key Insight:** Scenes are hermetically sealed. Entity in scene A cannot interact with entity in scene B without explicit cross-scene operation.

---

### SceneManager
**One Job:** Bookkeeping for multiple scenes

**Owns:**
- `scenes: Map<sceneId, Scene>` - all scenes
- `activeSceneId: string | null` - which scene is active
- Reference to GameState

**Provides:**
- `createScene()` - factory for scenes
- `getScene(id)` - lookup
- `getActiveScene()` - current scene
- `setActiveScene(id)` - switch active
- `deleteScene(id)` - cleanup
- `getAllSceneIds()` - list all

**Does NOT:**
- Run game ticks
- Move entities
- Handle player movement
- Execute scene transitions (delegates to GameManager)
- Know about game loops

**Boundary Test:** Could you create/delete/switch scenes without running any game logic? **YES** ✓

**Key Insight:** Pure bookkeeping. Like a filing cabinet for scenes.

---

### GameManager
**One Job:** Top-level coordinator for cross-scene operations

**Owns:**
- GameState (global: lives, score, player ID, etc.)
- SceneManager (all scenes)
- `pendingSceneTransition` - queued scene transition

**Provides:**
- **Player Tracking:** `getPlayerScene()`, `getPlayerPosition()` (with sceneId)
- **Cross-Scene Transfer:** `movePlayerToScene()` - queues transition for end of tick
- **Transition Execution:** `executePendingTransition()` - executes queued transition (called by GameRuntime)
- **Save/Load:** `save()`, `load()` - entire game state

**Does NOT:**
- Run game ticks
- Detect overlaps
- Execute systems
- Handle timing or frames
- Know about GameLoop or GameRuntime

**Boundary Test:** Could you use GameManager without any game loop, just as state container? **YES** ✓

**Key Insights:** 
- Manages data and cross-scene operations, but doesn't drive execution
- **Scene transitions are queued**, not executed immediately
- Uses transactional spatial operations (`remove()` + `spawnWithId()` + `commit()`) with rollback on failure

---

### PlayerInputSystem
**One Job:** Translate input into movement intents (dumb translator)

**Owns:**
- Reference to InputManager
- Reference to GameManager (for player ID)
- Debug stats

**Provides:**
- `update(context)` - reads input and stages move intents
  1. Get input direction from InputManager
  2. Calculate target position
  3. Stage move via `spatial.move()` (NO VALIDATION)

**Does NOT:**
- Validate moves (that's SpatialSystem.commit())
- Know about doors, enemies, or game rules
- Check if cells are walkable
- Handle collision logic

**Boundary Test:** Could you replace PlayerInputSystem with an AIInputSystem? **YES** ✓

**Key Insights:** 
- **Dumb by design** - just translates input to intents
- **No validation** - always stages moves, even if blocked
- **Registered first** - must run before reactive systems
- Validation happens in `commit()`, not here

---

### GameLoop
**One Job:** Execute one game tick for ONE spatial system

**Owns:**
- `systems: GameSystem[]` - registered systems (in execution order)
- Reference to ONE SpatialSystem

**Provides:**
- `addSystem(system)` - register systems
- `tick()` - execute one game tick:
  1. Detect overlaps in this spatial system
  2. Run all systems in order (they stage intents and react)
  3. Commit all intents (validate and execute)

**Does NOT:**
- Know about scenes (just has a SpatialSystem reference)
- Know about GameManager
- Handle timing or frames
- Run automatically (tick is called externally)
- Operate on multiple spatial systems
- Validate operations (that's SpatialSystem.commit())

**Boundary Test:** Could you create two GameLoops for two different spatial systems? **YES** ✓

**Key Insights:** 
- Pure orchestrator. One loop per spatial system. Stateless with respect to scenes.
- **System execution order matters** - input systems first, reactive systems second
- Systems stage intents, commit validates and executes

---

### GameRuntime
**One Job:** Real-time execution environment

**Owns:**
- GameManager (all game state)
- GameLoop (for active scene)
- Frame timer (requestAnimationFrame)
- Systems list
- Initial config (for restart)

**Provides:**
- **Lifecycle:** `start()`, `stop()`, `restart()`
- **Execution:** Fixed-timestep loop with accumulator
- **Tick:** `tick()` - executes game loop THEN pending scene transition
- **Save/Load:** `save()`, `load()` (wraps GameManager)
- **Access:** `game`, `spatial`, `activeScene`, `isRunning`, `tickCount`

**Does NOT:**
- Render graphics
- Handle input directly
- Know about specific game rules

**Boundary Test:** Could you swap GameRuntime for a different runtime (e.g., turn-based) without changing game logic? **YES** ✓

**Key Insights:** 
- Runtime environment. Drives execution but doesn't contain game logic
- **Executes queued scene transitions** at tick boundaries (after `gameLoop.tick()`)
- Recreates GameLoop when scene changes

---

## Reactive Intent-Based Architecture

### Core Pattern

The framework uses a **reactive intent-based architecture** where:

1. **Input systems** stage intents without validation (dumb)
2. **Game systems** react to intents by inspecting pending operations (smart)
3. **SpatialSystem.commit()** validates and executes all operations (gatekeeper)

### Why This Works

**Traditional (Bad):**
```
PlayerInputSystem checks isWalkable() → stages move if valid
DoorSystem checks adjacent cells every tick → unlocks if key present
```
Problems: Tight coupling, proactive checks, timing issues

**Reactive (Good):**
```
PlayerInputSystem always stages move → no validation
DoorSystem sees pending move → unlocks door if needed
SpatialSystem.commit() validates → move succeeds or fails
```
Benefits: Loose coupling, reactive behavior, natural UX

### Example Flow: Door Unlocking

```
Tick N:
1. PlayerInputSystem.update()
   → stages: spatial.move(5, 5, 6, 5, ACTORS)  [blocked by door]
   
2. DoorSystem.update()
   → const ops = spatial.getPendingOps()
   → sees player trying to move to (6, 5)
   → checks: door at (6, 5)? locked? player has key?
   → unlocks door, removes from WALLS layer
   → BLOCKING mask cleared
   
3. spatial.commit()
   → validates move to (6, 5)
   → isBlocked(cell) == false (door removed)
   → move executes successfully
```

### System Execution Order

**Critical:** Systems must run in specific order:

```typescript
// Scene loader registration order:
1. PlayerInputSystem       // Stages intents
2. DoorSystem             // Reacts to intents
3. CollectionSystem       // Reacts to overlaps
4. TeleporterSystem       // Reacts to overlaps
// Then: spatial.commit() validates and executes
```

**Why:** Reactive systems need to see intents before validation happens.

### Pending Operations API

Systems can inspect pending operations to react:

```typescript
// In any GameSystem.update()
const pendingOps = context.spatial.getPendingOps();

for (const op of pendingOps) {
  if (op.type === 'move' && op.entityId === targetId) {
    // React to this entity trying to move
    const destCell = spatial.grid.cell(op.toX, op.toY);
    // Modify world state before commit validates
  }
}
```

**Key:** Systems see intents before they're validated, allowing them to modify world state to make intents valid.

## Data Flow Examples

### Player Moves (Single Scene with Reactive Door)

```
GameRuntime.tick()
  → GameLoop.tick()
    → spatial.detectOverlaps() [reads COMMITTED state from previous tick]
    → systems.forEach(s => s.update(context)):
      
      1. PlayerInputSystem.update()
         → reads input direction
         → stages: spatial.move(5, 5, 6, 5, ACTORS) [DEFERRED - not validated yet]
      
      2. DoorSystem.update()
         → const pendingOps = spatial.getPendingOps()
         → sees: move from (5,5) to (6,5) by player
         → checks: door at (6,5)? YES. locked? YES. player has key? YES.
         → unlocks: spatial.remove(6, 5, WALLS)  [stages door removal]
         → stages: spatial.spawn('open-door', 6, 5, FLOOR)  [visual]
      
      3. [Other systems run...]
    
    → spatial.commit() [validate and execute ALL pending operations]:
      Phase 1: Execute removals (door removed, BLOCKING mask cleared)
      Phase 2: Validate moves (check isBlocked(6,5) → FALSE, move is valid!)
      Phase 3: Execute valid moves (player moves to (6,5))
      Phase 4: Execute spawns (open door visual placed)
  
  → game.executePendingTransition() [no transition queued, returns false]
```

**Flow:** Input → Systems (stage intents) → Reactive Systems (modify world) → Commit (validate & execute)

**Key:** 
- **Intents are staged** without validation
- **Systems react to intents** by modifying world state
- **Commit validates** after reactive changes applied

---

### Player Teleports (Cross-Scene)

```
Tick N (in scene1):
  GameRuntime.tick()
    → GameLoop.tick() [on scene1.spatial]
      → detect overlaps: player + teleporter [from COMMITTED state]
      → TeleporterSystem.update()
        → gameManager.movePlayerToScene('scene2', x, y, layer)
          → QUEUES transition (doesn't execute yet)
      → spatial.commit() [commits any other pending operations]
      → player STILL in scene1 (other systems can still see them)
    → game.executePendingTransition() [NOW transition executes]
      → scene1.spatial.remove(x, y, layer) + commit() [transactional]
      → scene2.spatial.spawnWithId(playerId, x, y, layer) + commit() [transactional]
      → sceneManager.setActiveScene('scene2')
      → IF target invalid: rollback with spawnWithId() in scene1
    → scene changed detected!
    → recreate GameLoop for scene2.spatial
    
Tick N+1 (now in scene2):
  GameRuntime.tick()
    → GameLoop.tick() [on scene2.spatial]
      → player now in scene2, different grid entirely
```

**Flow:** Loop → System → GameManager (queue) → Runtime → GameManager (execute) → SpatialSystem(s) → SceneManager

**Key:** 
- Scene transitions are **queued** during tick, **executed** after tick
- Uses **transactional operations** (`remove()` + `spawnWithId()` + `commit()`)
- Includes **rollback** if target scene invalid or occupied

---

### Save Game

```
Player presses Ctrl+S
  → runtime.save()
    → stops loop (if running)
    → gameManager.save()
      → gameState.serialize()
      → sceneManager.getAllSceneIds().map(id => scene.serialize())
        → scene.serialize()
          → grid cells (sparse)
          → entity store data
      → returns SaveData object
    → add runtime data (tickCount, tickRate)
    → return SaveData
  → JSON.stringify(saveData)
  → localStorage.setItem()
```

**Flow:** Runtime → GameManager → Scenes → Serialization

---

### Load Game

```
Startup
  → parse localStorage
  → GameRuntime.load(saveData, systems, tickRate)
    → GameManager.load(saveData)
      → restore GameState
      → restore all scenes
        → Scene.deserialize() for each
      → set active scene
    → create GameLoop for active scene
    → register systems
    → return new GameRuntime instance
  → runtime.start()
```

**Flow:** Deserialization → GameManager → Scenes → Runtime → Loop

---

## Dependency Graph

```
GameRuntime
└── GameManager
    ├── GameState
    └── SceneManager
        └── Scene (1..N)
            ├── LinkedGrid
            │   └── LinkedCell (M)
            ├── SpatialSystem
            └── EntityStore

GameLoop (separate)
├── SpatialSystem (reference)
└── GameSystem[] (composition)
```

**Key Relationships:**
- GameRuntime **owns** GameManager
- GameRuntime **creates** GameLoop per scene
- GameLoop **references** SpatialSystem (doesn't own)
- Scene **owns** SpatialSystem
- SpatialSystem **references** LinkedGrid (doesn't own)

---

## Critical Boundaries

### ✓ CLEAN: LinkedGrid ↔ SpatialSystem
- Grid provides storage
- Spatial interprets values as entity IDs
- Grid could be used for non-entity data
- **One-way dependency:** Spatial → Grid

### ✓ CLEAN: Scene ↔ SceneManager
- Scene is self-contained
- SceneManager just tracks them
- No cross-scene awareness in Scene
- **One-way dependency:** SceneManager → Scene

### ✓ CLEAN: GameLoop ↔ SpatialSystem
- Loop orchestrates
- Spatial stages and executes deferred operations
- Loop calls `detectOverlaps()` and `commit()` at right times
- Loop doesn't care about scenes
- **One-way dependency:** GameLoop → SpatialSystem

### ✓ CLEAN: GameRuntime ↔ GameManager
- Runtime drives execution
- Manager holds state and queues scene transitions
- Runtime calls `executePendingTransition()` after each tick
- Runtime doesn't modify state directly (goes through APIs)
- **One-way dependency:** GameRuntime → GameManager

### ✓ CLEAN: GameManager ↔ Scenes
- Manager handles cross-scene operations
- Scenes don't know about manager
- `movePlayerToScene()` queues, `executePendingTransition()` executes atomically
- Uses transactional spatial operations with rollback
- **One-way dependency:** GameManager → Scenes (via SceneManager)

---

## Anti-Patterns to Avoid

### ❌ Scene knowing about other scenes
```typescript
// BAD
class Scene {
  teleportToOtherScene(otherScene: Scene) { ... }
}
```
**Why bad:** Breaks scene isolation. Use GameManager instead.

### ❌ SpatialSystem handling cross-scene logic
```typescript
// BAD
class SpatialSystem {
  moveToOtherGrid(otherSpatial: SpatialSystem) { ... }
}
```
**Why bad:** Spatial should only know about its grid. Use GameManager instead.

### ❌ GameLoop owning GameManager
```typescript
// BAD
class GameLoop {
  constructor(gameManager: GameManager) { ... }
}
```
**Why bad:** Loop should be scene-focused, not game-focused. Pass SpatialSystem instead.

### ❌ LinkedGrid knowing about entities
```typescript
// BAD
class LinkedGrid {
  spawnEntity(type: string, x: number, y: number) { ... }
}
```
**Why bad:** Grid is pure topology. Entity logic belongs in SpatialSystem.

### ❌ GameRuntime doing game logic
```typescript
// BAD
class GameRuntime {
  processCombat() { ... }
}
```
**Why bad:** Game logic belongs in Systems. Runtime just drives execution.

---

## Validation Questions

For each component, ask:

1. **Single Responsibility?** Does it have exactly one job?
2. **Could it be reused?** In a different context or game?
3. **Testable in isolation?** Without depending on other components?
4. **Clear boundary?** No overlap with other components?
5. **One-way dependencies?** No circular dependencies?

### Results

| Component | Single Resp | Reusable | Isolated Test | Clear Boundary | One-Way Deps |
|-----------|-------------|----------|---------------|----------------|--------------|
| LinkedGrid | ✓ | ✓ | ✓ | ✓ | ✓ |
| LinkedCell | ✓ | ✓ | ✓ | ✓ | ✓ |
| SpatialSystem | ✓ | ✓ | ✓ | ✓ | ✓ |
| Scene | ✓ | ✓ | ✓ | ✓ | ✓ |
| SceneManager | ✓ | ✓ | ✓ | ✓ | ✓ |
| GameManager | ✓ | ✓ | ✓ | ✓ | ✓ |
| GameLoop | ✓ | ✓ | ✓ | ✓ | ✓ |
| GameRuntime | ✓ | ✓ | ✓ | ✓ | ✓ |

**All green!** ✓

---

## Summary

**The responsibility matrix is CRISP.**

Each component:
- Has exactly one job
- Owns specific data
- Has clear boundaries
- No overlap with other components
- Can be tested in isolation
- Could be reused in different contexts

**Recent enhancements maintain clarity:**
- **SpatialSystem** - Now handles all spatial operations consistently (deferred until commit)
- **GameManager** - Now queues scene transitions for tick-boundary execution
- **GameRuntime** - Now executes queued transitions after game loop completes

**No refactoring needed.** The architecture remains Spartan and clean.
