# Spartan Framework - Transaction Consistency

**Problem Statement**: Systems see inconsistent state during tick execution

---

## Current Behavior

**Given** a tick is executing  
**When** System A removes an entity  
**Then** System B sees the entity is gone

**And**

**Given** a tick is executing  
**When** System A moves an entity  
**Then** System B still sees the entity at the old position

**Result**: Different operations have different visibility rules

---

## Desired Behavior

**Given** a tick is executing  
**When** System A stages any operation (move, remove, spawn)  
**Then** System B sees the pre-tick committed state  
**And** the operation executes atomically at commit

---

## Problem 1: Zombie Entities

**Given** an entity has 10 HP  
**When** ProjectileSystem reduces HP to -50 and stages removal  
**Then** the entity is still in the grid  
**And** ChainLightningSystem finds it in radius queries  
**But** players perceive this as a bug (targeting a corpse)

### Solution: Lifecycle Queries

**Given** an entity is staged for removal  
**When** a system queries for entities in radius  
**Then** the entity is excluded by default  
**But** systems can explicitly include pending removals if needed

**Example**: Necromancy system wants to find corpses
```typescript
const corpses = spatial.getEntityIdsInRadius(x, y, 5, {
  includePendingRemovals: true
});
```

---

## Problem 2: Test Breakage

**Given** 100+ tests assume immediate side effects  
**When** remove() and spawn() become deferred  
**Then** tests that do `spatial.remove(); expect(cell).toBeEmpty()` fail

### Solution: Test Fixtures

**Given** a test needs to set up initial state  
**When** using test fixture helpers  
**Then** operations auto-commit for convenience

**Example**: Test setup vs testing behavior
```typescript
// Setup: use fixture (auto-commits)
const fixture = new TestSpatialFixture(spatial);
fixture.placeEntity('player', 5, 5, GameLayers.ACTORS);
fixture.placeEntity('enemy', 6, 5, GameLayers.ACTORS);

// Test: use actual API (deferred)
spatial.remove(5, 5, GameLayers.ACTORS);
expect(spatial.isAlive(playerId)).toBe(false);  // Check pending state
spatial.commit();
expect(spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)).toBeUndefined();
```

---

## Problem 3: Debugging Staged State

**Given** a developer calls `spatial.spawn('enemy', 10, 10, layer)`  
**When** they immediately check the grid  
**Then** the cell appears empty  
**And** they think the operation failed

### Solution: Visibility

**Given** pending operations exist  
**When** viewing the spatial system  
**Then** pending operations are visible via inspection API

**Example**: Debug output
```typescript
spatial.spawn('enemy', 10, 10, GameLayers.ACTORS);
spatial.debug();

// Output:
// === SpatialSystem Debug ===
// Entities: 1
// Pending ops: 1
//   - Spawns: 1
// 
// Pending operations:
//   SPAWN: entity 13 (enemy) at (10,10) layer 5
```

**And**: Visual test runner shows ghosts

---

## Problem 4: Ghost Entities

**Given** System A stages a move for entity X  
**When** System B removes entity X  
**Then** at commit, entity X is removed from store  
**But** the move writes entity X's ID to the destination cell  
**Result**: Ghost entity in grid with no store data

### Solution: Operation Ordering

**Given** pending operations exist  
**When** commit executes  
**Then** operations execute in order: removes → moves → spawns  
**And** moves for removed entities are skipped

---

## Problem 5: Mid-Tick Scene Transitions

**Given** TeleporterSystem is registered first  
**When** player overlaps teleporter  
**Then** TeleporterSystem changes the active scene  
**And** EnemyAISystem runs in the old scene  
**And** commit happens in the old scene  
**Result**: Zombie scene state

### Solution: Queued Transitions

**Given** a system wants to change scenes  
**When** calling `gameManager.movePlayerToScene()`  
**Then** the transition is queued  
**And** executes after the tick completes  
**And** next tick starts in the new scene

---

## Implementation Phases

### Phase 0: Safety Infrastructure

**Given** we want to change transaction semantics  
**When** we first build query and visibility tools  
**Then** we can safely implement deferred operations

**Deliverables**:
- Lifecycle queries (`isAlive`, `isValidTarget`)
- Inspection API (`getPendingOps`, `debug`)
- Visual test runner updates (show ghosts)
- Test fixture helpers

### Phase 1: Deferred Operations

**Given** safety infrastructure exists  
**When** we make remove/spawn deferred  
**Then** all operations use consistent transaction model

**Deliverables**:
- Deferred remove() and spawn()
- Operation ordering in commit()
- Pending state tracking
- Cancellation API

### Phase 2: System Updates

**Given** operations are deferred  
**When** systems use lifecycle queries  
**Then** they correctly handle pending state

**Deliverables**:
- Update example systems
- Document query patterns
- Integration tests

---

## Acceptance Criteria

**Given** the transaction refactor is complete  
**Then** the following must be true:

### Consistency
- **All** operations (move, remove, spawn) are deferred until commit
- **All** systems see the same pre-tick state
- **No** temporal coupling between systems

### Correctness
- ChainLightningSystem does not target corpses
- Ghost entities cannot exist (removed entities don't move)
- Scene transitions happen at tick boundaries only

### Debuggability
- Visual test runner shows pending operations
- `spatial.debug()` prints readable state
- Developers can predict what will happen at commit

### Testability
- Test fixtures simplify setup
- Tests can verify both pending and committed state
- Migration from old API is straightforward

---

## Query Patterns

### Default: Exclude Pending Removals

**Given** a system queries for targets  
**When** using default query behavior  
**Then** entities staged for removal are excluded

```typescript
const targets = spatial.getEntityIdsInRadius(x, y, 5);
// Corpses excluded automatically
```

### Explicit: Include Pending Removals

**Given** a system needs to see all entities  
**When** explicitly including pending removals  
**Then** entities staged for removal are included

```typescript
const all = spatial.getEntityIdsInRadius(x, y, 5, {
  includePendingRemovals: true
});
// Corpses included for resurrection, etc.
```

### Check Lifecycle

**Given** an entity ID exists  
**When** checking if it's alive  
**Then** pending removals return false

```typescript
if (spatial.isAlive(entityId)) {
  // Only target living entities
}
```

---

## Edge Cases

### Resurrection

**Given** an entity is staged for removal  
**When** a system restores its HP  
**Then** the removal can be cancelled

```typescript
const data = spatial.getEntityData(corpseId);
data.hp = data.maxHp;
spatial.cancelRemoval(corpseId);
// Entity no longer removed at commit
```

### Conditional Spawning

**Given** a spawn is staged  
**When** conditions change before commit  
**Then** the spawn can be cancelled

```typescript
const id = spatial.spawn('enemy', x, y, layer);
if (playerTooClose()) {
  spatial.cancelSpawn(id);
}
// Spawn doesn't execute
```

### Complex Interactions

**Given** multiple systems affect the same entity  
**When** operations are staged  
**Then** they execute in deterministic order at commit

**Example**: Box pushed onto pressure plate
1. BoxPushSystem stages box move
2. PressurePlateSystem checks overlap (box hasn't moved yet)
3. Commit: box moves
4. Next tick: PressurePlateSystem detects overlap, opens door

---

## Non-Goals

**What we're NOT doing**:

- ❌ Making systems async
- ❌ Adding rollback/undo
- ❌ Supporting nested transactions
- ❌ Parallelizing system execution
- ❌ Adding component queries
- ❌ Changing the 8-layer system

**Principle**: Fix the transaction model, nothing else