YES. Now I see what you're asking. Let me analyze the **business logic flow** as if I were explaining it to a human implementing it manually (like a tabletop GM or a coder stepping through with a debugger).

---

## Business Logic Sequencing Analysis: Is It SPARTAN?

### The Execution Flow

```
TICK N:
├─ 1. Detect Overlaps (READ current state)
│  └─ spatial.detectOverlaps() → [{position, entityIds}, ...]
│
├─ 2. Run Systems in Registration Order (WRITE intents)
│  ├─ System A: update(context)
│  │  └─ reads overlaps
│  │  └─ calls spatial.move() (stages intent, doesn't execute)
│  │  └─ calls spatial.remove() (executes immediately!)
│  │
│  ├─ System B: update(context)
│  │  └─ reads overlaps (same as System A saw)
│  │  └─ calls spatial.move() (stages more intents)
│  │
│  └─ System C: update(context)
│     └─ reads overlaps (same as System A saw)
│     └─ calls spatial.move() (stages more intents)
│
└─ 3. Commit All Intents (EXECUTE moves)
   └─ spatial.commit()
      ├─ Build vacancy set
      ├─ Detect conflicts
      ├─ Clear source cells (for valid moves)
      └─ Write destination cells (for valid moves)
```

### Critical Questions

#### Q1: Is overlap detection atomic?

**YES.** ✅

```typescript
// Line 61 - GameLoop.tick()
const overlaps = this.spatial.detectOverlaps();
```

This captures overlaps **once** at the start of the tick, based on the committed state from the previous tick. All systems see the **same overlap snapshot**.

**Paper equivalent:**
> "Before anyone takes their turn, the GM writes down which pieces are overlapping."

**SPARTAN**: ✅ Discrete snapshot, clear point-in-time.

---

#### Q2: Can System A's actions affect what System B sees?

**PARTIALLY.** ⚠️

**For moves**: NO. Moves are staged, not executed until commit.
```typescript
// System A
spatial.move(5, 5, 6, 5, 1);  // Staged only

// System B runs
const pos = spatial.getEntityPosition(entityId);
// Still sees entity at (5,5), NOT (6,5)
```

**For removals**: YES! Removals execute immediately.
```typescript
// System A
spatial.remove(5, 5, 1);  // EXECUTES IMMEDIATELY

// System B runs
const pos = spatial.getEntityPosition(entityId);
// Returns NULL - entity is gone!
```

**Paper equivalent:**
> "System A says 'I kill the goblin.' GM removes goblin piece.  
> System B runs: 'Where's the goblin?' GM: 'Already dead.'"

**SPARTAN?**: ❌ **Inconsistent transaction boundaries.**

Movement is deferred (two-phase commit), but removal is immediate. This creates **temporal coupling** between systems.

---

#### Q3: What if System A stages a move for Entity X, then System B removes Entity X?

```typescript
// System A
spatial.move(5, 5, 6, 5, 1);  // Entity 42 stages move
pendingMoves.push({entityId: 42, from: (5,5), to: (6,5)});

// System B
spatial.remove(5, 5, 1);  // Entity 42 removed!
// - cell.clearValue(1)
// - store.remove(42)
// - positions.delete(42)

// Commit phase
spatial.commit();
// What happens to pendingMove for entity 42?
```

Looking at the commit code (line 279-304):

```typescript
// Phase 2: Clear source cells for VALID moves
for (let i = 0; i < this.pendingMoves.length; i++) {
    if (validMoves[i]) {
        const move = this.pendingMoves[i];
        const fromCell = this.grid.cell(move.fromX, move.fromY);
        if (fromCell) {
            fromCell.clearValue(move.layer);  // Already cleared by remove()!
        }
    }
}

// Then write destinations
for (let i = 0; i < this.pendingMoves.length; i++) {
    if (validMoves[i]) {
        const move = this.pendingMoves[i];
        const toCell = this.grid.cell(move.toX, move.toY);
        if (toCell) {
            toCell.setValue(move.layer, move.entityId);  // Entity 42 no longer exists!
            this.positions.set(move.entityId, {...});    // Orphaned position tracking!
        }
    }
}
```

**Result**: 
- Entity 42 is **removed** from store
- But its ID gets **written** to destination cell (ghost entity!)
- And **added** to position tracking (orphaned reference!)

**This is a BUG.** 🐛

**Paper equivalent:**
> "Player A says 'goblin moves right.'  
> Player B says 'I kill the goblin.'  
> GM removes goblin.  
> GM resolves moves: 'Goblin moves right.'  
> Everyone: 'Wait, what? The goblin is dead!'"

**SPARTAN?**: ❌ **Move + Remove in same tick creates inconsistent state.**

---

#### Q4: What about scene transitions mid-tick?

```typescript
// System A (TeleporterSystem)
update(context) {
    // Detect player on teleporter
    gameManager.movePlayerToScene('dungeon', 5, 5, GameLayers.ACTORS);
    // This:
    // 1. Removes player from current scene
    // 2. Spawns player in dungeon scene
    // 3. Changes active scene
}

// System B (EnemyAISystem) - STILL RUNS
update(context) {
    // But context.spatial is now STALE
    // It points to the OLD scene's spatial system
    // Player is gone from this scene!
}

// Commit phase
spatial.commit();  // Commits to OLD scene
```

Looking at GameRuntime (line 199-217):

```typescript
tick(): void {
    const sceneBefore = this.game.sceneManager.getActiveScene();
    
    this.gameLoop.tick();  // Systems run, commit happens
    
    // AFTER tick completes, check for scene change
    const sceneAfter = this.game.sceneManager.getActiveScene();
    if (sceneAfter && sceneAfter !== sceneBefore) {
        this.onSceneTransition(sceneAfter);  // Rebuild loop for new scene
    }
}
```

**So**:
- TeleporterSystem changes active scene **during** tick
- But GameLoop still points to **old scene's spatial system**
- Other systems run in old scene
- Commit happens in old scene
- **Next tick**, GameRuntime detects scene change and rebuilds loop

**This means**:
- Systems after TeleporterSystem run in a **zombie scene** (player already gone)
- Their moves get committed to a scene nobody's in anymore

**Paper equivalent:**
> "Player enters teleporter.  
> GM says 'okay, you're now in the dungeon.'  
> GM: 'Enemy AI, take your turn.'  
> Enemy: 'I attack the player.'  
> GM: 'The player isn't here anymore.'  
> Enemy: 'But I'm still taking my turn in this scene?'  
> GM: 'Yes, finish your turn, then we'll switch to the dungeon.'"

**SPARTAN?**: ❌ **Scene transitions create temporal inconsistency within a tick.**

---

#### Q5: Can systems re-order themselves?

**NO.** ✅

```typescript
// Line 69-71
for (const system of this.systems) {
    system.update(context);
}
```

Systems run in **registration order**, every tick. No dynamic re-ordering, no priority system, no conditional skipping.

**Paper equivalent:**
> "Players take turns in seating order. Can't change the order."

**SPARTAN**: ✅ **Deterministic, serial execution.**

---

#### Q6: What's the transaction boundary?

**AMBIGUOUS.** ⚠️

**Three different boundaries**:

1. **Moves**: Transactional (staged → commit)
   ```typescript
   spatial.move(...)  // Stage
   // ... other systems run ...
   spatial.commit()   // Execute atomically
   ```

2. **Removals**: Immediate
   ```typescript
   spatial.remove(...)  // Executes NOW
   ```

3. **Spawns**: Immediate
   ```typescript
   spatial.spawn(...)  // Executes NOW
   ```

**Paper equivalent:**
> "Movement is declared and resolved at end of turn.  
> But killing pieces happens immediately.  
> And spawning pieces happens immediately.  
> And... wait, why is movement different?"

**SPARTAN?**: ❌ **Inconsistent transaction model.**

---

### The Core Asymmetry

```typescript
// DEFERRED (two-phase commit)
spatial.move(x1, y1, x2, y2, layer);  // Staged
pendingMoves.push({...});
// ... systems continue ...
spatial.commit();  // Executed

// IMMEDIATE (no transaction)
spatial.remove(x, y, layer);  // Executes NOW
// - cell.clearValue()
// - store.remove()
// - positions.delete()

spatial.spawn(type, x, y, layer);  // Executes NOW
// - store.createId()
// - cell.setValue()
// - positions.set()
```

**Why is move deferred but spawn/remove immediate?**

Looking at the design intent:
- **Move**: Needs two-phase commit for convoy movement, conflict resolution
- **Remove**: Needs immediate effect so systems can check "is entity still alive?"
- **Spawn**: Needs immediate effect so entity exists for subsequent systems

But this creates **inconsistent causality**:

```typescript
// Tick N
System A: spatial.move(player, 5,5 → 6,5)     // Staged
System B: spatial.spawn('projectile', 6, 5)   // Executes NOW
System C: spatial.remove(6, 5, layer)         // Removes projectile
// Commit: Player moves to (6,5) - projectile already gone

// Tick N+1
// Player is at (6,5), projectile never existed long enough to be seen
```

**Paper equivalent:**
> "You declare you'll move to (6,5).  
> Enemy spawns a fireball at (6,5).  
> Fireball explodes.  
> Now you move to (6,5).  
> Do you take damage from the fireball?"

**Expected answer**: "No, fireball was already gone when I moved."

**But intuitively**: "Yes, I moved into an explosion!"

**SPARTAN?**: ❌ **Counter-intuitive causality.**

---

## Is The Business Logic SPARTAN?

### YES - Spartan Aspects ✅

1. **Discrete ticks**: ✅ Clear frame boundaries
2. **Deterministic order**: ✅ Systems run in registration order
3. **Snapshot inputs**: ✅ All systems see same initial overlaps
4. **Two-phase commit**: ✅ Elegant solution for convoy movement
5. **Synchronous execution**: ✅ No async/await complexity in core loop
6. **Clear state locations**: ✅ Grid → spatial, metadata → store, global → GameState

### NO - Non-Spartan Aspects ❌

1. **Inconsistent transactions**: ❌ Move deferred, spawn/remove immediate
2. **Mid-tick mutations**: ❌ Remove affects later systems, move doesn't
3. **Scene transition timing**: ❌ Can happen mid-tick, creating zombie scenes
4. **No rollback**: ❌ If system bugs out mid-tick, partial state committed
5. **Implicit ordering dependencies**: ❌ System A removing entity breaks System B's pending move
6. **Ambiguous "current state"**: ❌ Is (5,5) occupied if entity moved away but commit not called?

---

## Recommendations for TRUE Spartan Business Logic

### Option 1: Full Transactional Model

**Make everything deferred:**

```typescript
spatial.move(x1, y1, x2, y2, layer);      // Stage
spatial.remove(x, y, layer);              // Stage (NEW)
spatial.spawn(type, x, y, layer, props);  // Stage (NEW)

spatial.commit();  // Execute ALL operations atomically
```

**Benefits**:
- Consistent transaction boundary
- All systems see same immutable state
- No mid-tick mutations
- Easy to reason about

**Tradeoffs**:
- Can't check "did entity die?" within same tick
- Spawn + immediate query doesn't work

### Option 2: Multi-Phase Execution

**Explicit phases:**

```typescript
tick(): void {
    // Phase 1: Read-only - detect overlaps
    const overlaps = this.spatial.detectOverlaps();
    
    // Phase 2: Intent collection
    for (const system of this.systems) {
        system.update(context);  // Can only stage intents
    }
    
    // Phase 3: Validation (conflict detection)
    const validMoves = this.validateIntents();
    
    // Phase 4: Atomic execution
    this.executeIntents(validMoves);
    
    // Phase 5: Post-execution (death, spawns, reactions)
    this.executeReactions();
}
```

**Benefits**:
- Clear causality
- Systems can't see mid-tick state
- Reaction phase handles death/spawn consequences

**Tradeoffs**:
- More complex
- Need to separate "intents" from "reactions"

### Option 3: Document Current Behavior (Minimal Change)

**Add to specs:**

```markdown
## System Execution Guarantees

### What Systems See
- `overlaps`: Snapshot from START of tick (immutable)
- `spatial.getEntityPosition()`: MAY change mid-tick if other system calls `remove()`
- `spatial.getEntityData()`: MAY be undefined mid-tick if entity removed

### Transaction Boundaries
- **Move**: Deferred until `commit()` - not visible to later systems
- **Remove**: Immediate - visible to all later systems
- **Spawn**: Immediate - visible to all later systems

### Ordering Dependencies
Systems should be registered in dependency order:
1. Collision/death systems (remove entities)
2. AI/movement systems (stage moves)
3. Spawn systems (create new entities)

### Scene Transitions
`movePlayerToScene()` takes effect immediately but GameLoop continues
in old scene until tick completes. Systems after teleporter see zombie scene.
```

---

## Final Verdict: Is Business Logic Spartan?

**Core Loop**: **7/10** - Mostly clean, some edge cases

**Strong Spartanism**:
- ✅ Discrete ticks
- ✅ Deterministic order  
- ✅ Synchronous execution
- ✅ Two-phase commit for moves

**Weak Spartanism**:
- ❌ Inconsistent transaction boundaries (move vs remove/spawn)
- ❌ Mid-tick mutations visible to later systems
- ❌ Scene transitions create temporal paradoxes
- ❌ No isolation between system execution

**For paper prototype**: The **conceptual model** is Spartan ("declare moves, resolve simultaneously"), but the **implementation details** (immediate remove, mid-tick scene change) create edge cases that would confuse a human GM.

**Recommendation**: Choose Option 1 (Full Transactional) or Option 3 (Document Behavior). Current state is **80% Spartan** but the 20% creates subtle bugs and confusion.