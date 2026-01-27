I think you've made the right call. Let me articulate why your instinct is sound and what makes your current approach powerful.

## Your Architecture: Systems as Interaction Resolvers

### The Core Insight

```typescript
// Your model:
tick() {
  const overlaps = spatial.detectOverlaps();  // "What's touching?"
  
  for (const system of systems) {
    system.update({ overlaps, spatial });     // "How do you respond?"
  }
  
  spatial.commit();                           // "Now make it so."
}
```

**This is elegant because:**
- The **problem space** is spatial: "entities occupy cells, cells can overlap"
- **Systems** don't push state changes; they **respond to spatial facts**
- The **grid is the source of truth**, not entity hierarchies

### Contrast with Traditional ECS

**Traditional ECS** (component-centric):
```typescript
// Problem space is "entities have components"
const movables = query([Position, Velocity]);
for (const [entity, pos, vel] of movables) {
  pos.x += vel.dx;  // Systems transform component data
}
```

**Your approach** (spatial-centric):
```typescript
// Problem space is "entities occupy space"
const overlaps = spatial.detectOverlaps();
for (const overlap of overlaps) {
  // Systems interpret spatial relationships
  if (hasPlayer(overlap) && hasTeleporter(overlap)) {
    handleTeleport(overlap);
  }
}
```

**The difference**: ECS systems **push transforms**, your systems **pull interpretations**.

---

## Why "Systems Resolve Interactions" is Spartan

### 1. **The Grid is Ground Truth**

```typescript
// Current state is always readable
const whatIsHere = spatial.getEntityIdsInCell(x, y);
const whoIsNearby = spatial.getEntityIdsInRadius(x, y, 5);

// No ambiguity about "is entity at (5,5)?"
// Either cell.values[layer] has an ID, or it doesn't.
```

**vs ECS where truth is distributed**:
```typescript
// Need to query multiple component tables
const entity = query([Position]).find(e => e.Position.x === 5 && e.Position.y === 5);
// Then check what other components it has
```

**Your way**: Grid → entities → components (spatial-first)
**ECS way**: Components → entities → position (component-first)

For grid games, **spatial-first wins**.

### 2. **Systems are Interpreters, Not Actors**

```typescript
class TeleporterSystem {
  update({ overlaps, spatial }) {
    // Read problem space
    for (const overlap of overlaps) {
      const entities = overlap.entityIds.map(id => spatial.getEntityData(id));
      const player = entities.find(e => e.type === 'player');
      const teleporter = entities.find(e => e.type === 'teleporter');
      
      // Interpret interaction
      if (player && teleporter) {
        // Stage response
        spatial.move(
          overlap.position.x, overlap.position.y,
          teleporter.destX, teleporter.destY,
          GameLayers.ACTORS
        );
      }
    }
  }
}
```

**This is declarative**:
- System doesn't mutate the grid directly
- System doesn't own entity lifecycle
- System **interprets spatial facts** and **stages responses**

**Compare to imperative**:
```typescript
// Bad: system directly manipulates state
teleporter.onPlayerEnter((player) => {
  player.x = teleporter.destX;
  player.y = teleporter.destY;
  grid[player.y][player.x] = player.id;
});
```

Your approach: **"Given this spatial configuration, what should happen?"**

### 3. **Overlap is the Universal Problem**

```typescript
// All game mechanics reduce to "what happens when X and Y occupy same cell?"

// Combat: player + enemy
// Collection: player + coin
// Teleportation: player + teleporter
// Triggers: player + pressure plate
// Damage: player + lava
// Healing: player + shrine
```

**This is profoundly Spartan.** One primitive (overlap) generates all interactions.

---

## What Makes This Work

### The Problem-Space Clarity

```
PROBLEM SPACE (Grid + Store):
┌────────────────────────────────────┐
│ Cell (5,5):                        │
│   Layer 3: ID 42 (coin)            │
│   Layer 5: ID 1 (player)           │
│                                    │
│ Overlap detected!                  │
└────────────────────────────────────┘
           ↓
    INTERPRETATION (Systems):
┌────────────────────────────────────┐
│ CoinSystem sees overlap:           │
│   "Player touched coin"            │
│   → stage removal of coin          │
│   → increment player score         │
└────────────────────────────────────┘
           ↓
      RESOLUTION (Commit):
┌────────────────────────────────────┐
│ Execute staged operations          │
│   - Remove coin from cell          │
│   - Update GameState.score         │
└────────────────────────────────────┘
```

**Key**: Problem space (grid) is **immutable during system execution**. Systems read the same snapshot, stage responses, then commit atomically.

### The Mental Model

**For a human thinking about game design:**

> "When the player steps on a teleporter, they should move to the destination."

**Translates directly to:**

```typescript
class TeleporterSystem {
  update({ overlaps }) {
    if (overlap contains player AND teleporter) {
      stage move to destination
    }
  }
}
```

**No indirection through:**
- Component composition
- Entity archetypes
- Query syntax
- System registration ordering

Just: **"What's the spatial problem? How do I respond?"**

---

## The Remaining Issues (and Solutions)

### Issue 1: Transaction Inconsistency

**Problem**: Remove/spawn immediate, move deferred

**Solution**: Make all operations deferred

```typescript
class SpatialSystem {
  private pendingOps: Operation[] = [];
  
  move(...) { this.pendingOps.push({ type: 'move', ... }); }
  remove(...) { this.pendingOps.push({ type: 'remove', ... }); }
  spawn(...) { 
    const id = this.store.createId(type, props);
    this.pendingOps.push({ type: 'spawn', id, ... });
    return id;
  }
  
  commit() {
    // Execute all in order: removes → moves → spawns
    for (const op of this.pendingOps) {
      this.executeOp(op);
    }
    this.pendingOps = [];
  }
}
```

**Benefit**: All systems see same immutable grid state throughout tick.

### Issue 2: Scene Transitions Mid-Tick

**Problem**: Teleporter changes scene, zombie systems run after

**Solution**: Detect and skip

```typescript
class GameLoop {
  tick(): void {
    const scene = this.spatial.scene;
    const overlaps = this.spatial.detectOverlaps();
    
    for (const system of this.systems) {
      // If scene changed, abort
      if (this.spatial.scene !== scene) {
        console.warn('Scene changed mid-tick, skipping remaining systems');
        break;
      }
      system.update({ overlaps, spatial: this.spatial });
    }
    
    this.spatial.commit();
  }
}
```

**OR** (cleaner): Queue scene transitions

```typescript
class GameManager {
  private pendingSceneChange?: { sceneId: string, x: number, y: number };
  
  movePlayerToScene(sceneId, x, y, layer) {
    // Don't execute now, queue for after tick
    this.pendingSceneChange = { sceneId, x, y, layer };
  }
}

class GameRuntime {
  tick() {
    this.gameLoop.tick();
    
    // After tick completes, check for queued transition
    if (gameManager.pendingSceneChange) {
      this.executeSceneChange(gameManager.pendingSceneChange);
      gameManager.pendingSceneChange = undefined;
    }
  }
}
```

**Benefit**: Scene transitions happen at tick boundaries, never mid-tick.

### Issue 3: System Ordering

**Problem**: Implicit dependencies (death must happen before AI)

**Solution**: Document and enforce

```typescript
// In docs:
/**
 * System Execution Order:
 * 
 * 1. REACT systems (respond to overlaps)
 *    - CoinSystem (pick up items)
 *    - TeleporterSystem (trigger teleports)
 *    - CombatSystem (apply damage)
 * 
 * 2. DEATH systems (remove dead entities)
 *    - DeathSystem (check hp <= 0, stage removals)
 * 
 * 3. AI systems (make decisions)
 *    - EnemyAISystem (pathfind, stage moves)
 * 
 * 4. SPAWN systems (create new entities)
 *    - SpawnerSystem (create enemies at spawn points)
 */

runtime.addSystem(new CoinSystem());
runtime.addSystem(new TeleporterSystem(gameManager));
runtime.addSystem(new CombatSystem());
runtime.addSystem(new DeathSystem());
runtime.addSystem(new EnemyAISystem());
runtime.addSystem(new SpawnerSystem());
```

**Benefit**: Explicit ordering prevents bugs.

---

## What This Enables

### Composable Game Logic

```typescript
// Add new mechanic: pressure plates open doors
class PressurePlateSystem implements GameSystem {
  update({ overlaps, spatial }) {
    for (const overlap of overlaps) {
      const entities = overlap.entityIds.map(id => spatial.getEntityData(id));
      const plate = entities.find(e => e.type === 'pressure_plate');
      const actor = entities.find(e => e.type === 'player' || e.type === 'enemy');
      
      if (plate && actor && !plate.activated) {
        // Open linked door
        const doorPos = gameState.getConnections(plate.doorKey)[0];
        spatial.remove(doorPos.x, doorPos.y, GameLayers.WALLS);
        spatial.getEntityData(plate.id).activated = true;
      }
    }
  }
}

// Just add to runtime
runtime.addSystem(new PressurePlateSystem());
```

**No changes to core framework.** Just interpret overlaps differently.

### Emergent Complexity

```typescript
// Scenario: Player pushes box onto pressure plate
// Multiple systems interact:

// 1. BoxPushSystem
//    Player + box overlapping + player moving → stage box move

// 2. PressurePlateSystem
//    Box + plate overlapping → open door

// 3. Commit
//    Box moves onto plate, door opens

// No system "knows" about the full interaction
// Each interprets local spatial facts
// Emergence from composition
```

This is **exactly** what you want in game design.

---

## The Spartan Manifesto for Your Architecture

### What You Have

1. **Problem Space**: Grid cells + entity metadata
2. **Detection**: Overlap = multiple entities per cell
3. **Interpretation**: Systems read overlaps, stage responses
4. **Resolution**: Commit executes all staged operations atomically

### What Makes It Spartan

- ✅ **One primitive**: Overlap detection
- ✅ **Discrete ticks**: Clear frame boundaries
- ✅ **Immutable reads**: Systems see snapshot
- ✅ **Staged writes**: Commit is atomic
- ✅ **Composable logic**: Add systems without changing core
- ✅ **Spatial-first**: Queries optimized for grid games

### What Needs Fixing (Minor)

- ⚠️ Defer remove/spawn (like move)
- ⚠️ Queue scene transitions (not mid-tick)
- ⚠️ Document system ordering

### What NOT to Change

- ❌ Don't add ECS (solves wrong problem)
- ❌ Don't add component queries (spatial queries are enough)
- ❌ Don't add system priorities (explicit order is clearer)
- ❌ Don't add entity hierarchies (flat is simpler)

---

## Recommendation: Solidify What You Have

### 1. Fix Transaction Semantics (1 day)

Make remove/spawn deferred. All operations execute at commit.

### 2. Add Scene Transition Queuing (2 hours)

Queue scene changes, execute at tick boundaries.

### 3. Document System Contracts (1 hour)

```markdown
## System Contract

Systems are interpreters of spatial facts.

### Input
- `overlaps`: Snapshot of multi-entity cells
- `spatial`: Query interface (getEntityData, getEntityPosition, etc.)

### Output
- Stage operations via `spatial.move()`, `spatial.remove()`, `spatial.spawn()`
- Mutate `GameState` directly (lives, score, inventory)

### Guarantees
- Overlap snapshot is immutable during system execution
- All systems see same grid state
- Staged operations execute atomically at commit
- Systems run in registration order

### Ordering Guidelines
1. React systems (respond to overlaps)
2. Death systems (remove dead entities)
3. AI systems (make movement decisions)
4. Spawn systems (create new entities)
```

### 4. Write Example Systems (4 hours)

Document 5-10 example systems showing common patterns:
- CoinSystem (collect on overlap)
- TeleporterSystem (move between scenes)
- CombatSystem (damage on overlap)
- DeathSystem (remove when hp ≤ 0)
- EnemyAISystem (pathfind toward player)
- SpawnerSystem (create enemies at intervals)
- PressurePlateSystem (trigger on overlap)
- DoorSystem (open when key overlaps)

### 5. Add Type Safety (2 hours)

Define entity type interfaces for autocomplete.

**Total effort**: ~2 days to solidify.

---

## Why This is The Right Choice

You said: **"I like the idea of a game as problem-space and systems help resolve interactions."**

This is the **correct mental model** for:
- Grid-based games
- Turn-based games
- Spatial puzzles
- Roguelikes
- Tactical games

Your architecture **embodies this model** directly:
- Problem space = grid + overlaps
- Resolution = systems + commit

ECS embodies a different model:
- Problem space = component composition
- Resolution = query + transform

**For your domain, you chose correctly.**

Keep building on what you have. You're 95% of the way to something clean, Spartan, and powerful.