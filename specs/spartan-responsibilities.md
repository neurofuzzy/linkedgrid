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
- **Movement:** `move()` (stage), `commit()` (execute all), `clearIntents()`
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

**Boundary Test:** Could you have two SpatialSystems operating on different grids independently? **YES** ✓

**Key Insights:** 
- Each scene has its own SpatialSystem. They don't talk to each other.
- **All operations are deferred** - nothing happens until `commit()`
- **Lifecycle queries** prevent interaction with "zombie entities" (pending removals)

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

### GameLoop
**One Job:** Execute one game tick for ONE spatial system

**Owns:**
- `systems: GameSystem[]` - registered systems
- Reference to ONE SpatialSystem

**Provides:**
- `addSystem(system)` - register systems
- `tick()` - execute one game tick:
  1. Detect overlaps in this spatial system
  2. Run all systems (they stage intents)
  3. Commit all intents

**Does NOT:**
- Know about scenes (just has a SpatialSystem reference)
- Know about GameManager
- Handle timing or frames
- Run automatically (tick is called externally)
- Operate on multiple spatial systems

**Boundary Test:** Could you create two GameLoops for two different spatial systems? **YES** ✓

**Key Insight:** Pure orchestrator. One loop per spatial system. Stateless with respect to scenes.

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

## Data Flow Examples

### Player Moves (Single Scene)

```
Input Handler
  → stages: spatial.move(x1, y1, x2, y2, layer) [DEFERRED - not visible yet]
GameRuntime.tick()
  → GameLoop.tick()
    → spatial.detectOverlaps() [reads COMMITTED state from previous tick]
    → systems.forEach(s => s.update(context)) [systems stage more operations]
    → spatial.commit() [execute ALL pending operations atomically: removals → moves → spawns]
  → game.executePendingTransition() [no transition queued, returns false]
```

**Flow:** Input → Runtime → Loop → Spatial

**Key:** All operations are **deferred** until `commit()`. Systems see the same immutable state during the entire tick.

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
