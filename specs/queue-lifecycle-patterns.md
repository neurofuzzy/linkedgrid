# Queue Lifecycle Patterns

## Overview

Queues are used throughout SPARTAN for deferred operations - operations that should happen on the NEXT tick after some condition is met. Understanding queue lifecycle is critical for avoiding bugs.

**The Golden Rule**: Clear queues IMMEDIATELY after consuming them, not at the end of the update cycle.

---

## The Problem

When working with intent-based systems, you often need to defer operations until the next tick because:

1. State changes aren't visible until after `commit()`
2. You want to replace an entity (must remove first, spawn second)
3. You need operations to happen in a specific order

**Common Bug**: Clearing queue at wrong time means it's empty when you need it!

---

## Pattern: Deferred Spawning Queue

### ✅ Correct Implementation

```typescript
class PropagationSystem implements GameSystem {
  private ashSpawnQueue: Position[] = [];

  update(context: GameContext): void {
    this.currentTick++;

    // PHASE 0: Spawn from queue (from PREVIOUS tick)
    for (const pos of this.ashSpawnQueue) {
      context.spatial.spawn('ash', pos.x, pos.y, GameLayers.FLOOR, {
        color: '#4a4a4a',
      });
    }
    this.ashSpawnQueue = []; // ✅ Clear IMMEDIATELY after use

    // ... other phases ...

    // PHASE 4: Queue operations for NEXT tick
    for (const {id, pos, wasFire} of expiredEntities) {
      context.spatial.remove(id);
      if (wasFire) {
        this.ashSpawnQueue.push(pos); // Queue for next tick
      }
    }
  } // ✅ Queue persists to next tick
}
```

**Timeline**:
```
Tick 3: Fire expires → ash queued → queue size = 1
Tick 4 START: Spawn ash from queue → clear queue → queue size = 0
Tick 4: ...other logic...
Tick 4 END: Queue still size = 0 (ready for new items)
```

### ❌ Wrong Implementation

```typescript
class PropagationSystem implements GameSystem {
  private ashSpawnQueue: Position[] = [];

  update(context: GameContext): void {
    this.currentTick++;

    // PHASE 0: Spawn from queue
    for (const pos of this.ashSpawnQueue) {
      context.spatial.spawn('ash', pos.x, pos.y, GameLayers.FLOOR, {
        color: '#4a4a4a',
      });
    }
    // ❌ DON'T clear yet - need for canSpreadTo() check?

    // ... other phases ...

    // PHASE 4: Queue operations for NEXT tick
    for (const {id, pos, wasFire} of expiredEntities) {
      context.spatial.remove(id);
      if (wasFire) {
        this.ashSpawnQueue.push(pos);
      }
    }

    this.ashSpawnQueue = []; // ❌ WRONG! Clears items for next tick
  }
}
```

**Timeline**:
```
Tick 3: Fire expires → ash queued → queue size = 1
Tick 3 END: Clear queue → queue size = 0 ❌
Tick 4 START: Try to spawn ash → queue is EMPTY → nothing spawns ❌
```

---

## Pattern: Multi-Queue System

For systems with multiple deferred operations:

```typescript
class ComplexSystem implements GameSystem {
  private spawnQueue: Array<{type: string, x: number, y: number}> = [];
  private removeQueue: number[] = [];
  private effectQueue: Array<{id: number, effect: string}> = [];

  update(context: GameContext): void {
    // PHASE 0: Process ALL queues from previous tick
    this.processSpawnQueue(context);
    this.processRemoveQueue(context);
    this.processEffectQueue(context);

    // PHASE 1-N: Game logic that populates queues
    this.detectConditions(context);
    this.queueOperations(context);
  }

  private processSpawnQueue(context: GameContext): void {
    for (const item of this.spawnQueue) {
      context.spatial.spawn(item.type, item.x, item.y, ...);
    }
    this.spawnQueue = []; // Clear immediately
  }

  private processRemoveQueue(context: GameContext): void {
    for (const id of this.removeQueue) {
      context.spatial.remove(id);
    }
    this.removeQueue = []; // Clear immediately
  }

  private processEffectQueue(context: GameContext): void {
    for (const {id, effect} of this.effectQueue) {
      this.applyEffect(id, effect);
    }
    this.effectQueue = []; // Clear immediately
  }
}
```

---

## Pattern: Conditional Queue Processing

Sometimes you need to check the queue during processing:

```typescript
class PropagationSystem implements GameSystem {
  private ashSpawnQueue: Position[] = [];

  update(context: GameContext): void {
    // PHASE 0: Spawn and clear
    for (const pos of this.ashSpawnQueue) {
      context.spatial.spawn('ash', pos.x, pos.y, GameLayers.FLOOR, {});
    }
    this.ashSpawnQueue = [];

    // PHASE 2: Spread check
    // ✅ Queue is clear - no confusion about pending ash
    if (this.canSpreadTo(cell, config, context)) {
      // Spread fire
    }

    // PHASE 4: Queue new ash
    // ✅ Queue starts empty, only contains NEW items for next tick
    if (fireExpired) {
      this.ashSpawnQueue.push(pos);
    }
  }

  private canSpreadTo(cell: any, config: any, context: GameContext): boolean {
    // Check if ash already exists (from PREVIOUS spawns)
    const floorValue = cell.getValue(GameLayers.FLOOR);
    if (floorValue !== undefined) {
      const floorEntity = context.spatial.getEntityData(floorValue);
      if (floorEntity && isAsh(floorEntity)) {
        return false; // Blocked by ash
      }
    }

    // ✅ No need to check ashSpawnQueue - it's already spawned or cleared
    return true;
  }
}
```

---

## Anti-Pattern: Using Queue as In-Flight State

### ❌ Don't Do This

```typescript
// BAD - using queue to track pending operations during same tick
private ashSpawnQueue: Position[] = [];

update(context: GameContext): void {
  // Phase 0: Spawn from queue
  for (const pos of this.ashSpawnQueue) {
    context.spatial.spawn('ash', pos.x, pos.y, FLOOR, {});
  }
  // Keep queue around for checks

  // Phase 2: Check queue to see what's pending
  if (this.ashSpawnQueue.some(p => p.x === cell.x && p.y === cell.y)) {
    // ❌ This is fragile! Queue has old + new items mixed together
    return false;
  }

  // Phase 4: Add more to queue
  this.ashSpawnQueue.push(newPos);

  // Phase 5: Clear queue
  this.ashSpawnQueue = []; // Now next tick has nothing!
}
```

### ✅ Do This Instead

```typescript
// GOOD - use separate tracking for in-flight state
private ashSpawnedThisTick = new Set<string>(); // "x:y" keys

update(context: GameContext): void {
  this.ashSpawnedThisTick.clear(); // Clear each tick

  // Phase 0: Spawn from queue and track
  for (const pos of this.ashSpawnQueue) {
    context.spatial.spawn('ash', pos.x, pos.y, FLOOR, {});
    this.ashSpawnedThisTick.add(`${pos.x}:${pos.y}`);
  }
  this.ashSpawnQueue = [];

  // Phase 2: Check in-flight spawns
  const key = `${cell.x}:${cell.y}`;
  if (this.ashSpawnedThisTick.has(key)) {
    return false; // Blocked by pending ash spawn
  }

  // Phase 4: Queue for next tick
  this.ashSpawnQueue.push(newPos);
}
```

---

## Pattern: Queue with Deduplication

Avoid duplicates when multiple sources queue the same operation:

```typescript
class EffectSystem implements GameSystem {
  private spawnQueue = new Map<string, {type: string, x: number, y: number}>();

  update(context: GameContext): void {
    // Phase 0: Spawn from queue
    for (const [key, item] of this.spawnQueue) {
      context.spatial.spawn(item.type, item.x, item.y, ...);
    }
    this.spawnQueue.clear();

    // ... logic ...

    // Phase N: Queue with deduplication
    const key = `${x}:${y}`;
    if (!this.spawnQueue.has(key)) {
      this.spawnQueue.set(key, {type: 'effect', x, y});
    }
  }
}
```

---

## Pattern: Priority Queue

Process items in specific order:

```typescript
class OrderedSystem implements GameSystem {
  private actionQueue: Array<{priority: number, action: () => void}> = [];

  update(context: GameContext): void {
    // Phase 0: Process in priority order
    this.actionQueue.sort((a, b) => b.priority - a.priority);
    for (const item of this.actionQueue) {
      item.action();
    }
    this.actionQueue = [];

    // ... logic queues actions with priority ...
  }
}
```

---

## Debugging Queues

### Add Queue State to getDebugState()

```typescript
public getDebugState() {
  return {
    currentTick: this.currentTick,
    queueSizes: {
      ashSpawn: this.ashSpawnQueue.length,
      entityRemove: this.removeQueue.length,
    },
    queuedAshPositions: [...this.ashSpawnQueue],
    queuedRemovals: [...this.removeQueue],
  };
}
```

### Log Queue Lifecycle

```typescript
update(context: GameContext): void {
  console.log(`[Tick ${this.currentTick}] Queue size at start: ${this.ashSpawnQueue.length}`);

  for (const pos of this.ashSpawnQueue) {
    context.spatial.spawn('ash', pos.x, pos.y, FLOOR, {});
    console.log(`  Spawned ash at (${pos.x}, ${pos.y})`);
  }
  this.ashSpawnQueue = [];

  console.log(`[Tick ${this.currentTick}] Queue cleared, size: ${this.ashSpawnQueue.length}`);

  // ... logic ...

  if (shouldQueue) {
    this.ashSpawnQueue.push(pos);
    console.log(`[Tick ${this.currentTick}] Queued ash for (${pos.x}, ${pos.y}), size: ${this.ashSpawnQueue.length}`);
  }

  console.log(`[Tick ${this.currentTick}] Queue size at end: ${this.ashSpawnQueue.length}`);
}
```

---

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Clear queue at end of update | Queue empty when needed next tick | Clear immediately after processing |
| Check queue mid-update | Wrong items in queue | Use separate tracking set |
| Forget to clear queue | Queue grows forever, duplicates spawn | Clear after processing |
| Clear queue before processing | Nothing spawns | Swap order: process THEN clear |
| Use queue for in-tick state | Stale data, race conditions | Use separate state for same-tick tracking |

---

## Checklist for Queue Implementation

- [ ] Queue cleared IMMEDIATELY after processing
- [ ] Queue populated in LAST phase of update
- [ ] No mid-update queue checks (use separate tracking)
- [ ] Queue size included in `getDebugState()`
- [ ] Deduplication if needed (use Map or Set)
- [ ] Queue reset in `resetState()` method
- [ ] Comments explain queue timing
- [ ] Tests verify queue persists to next tick

---

## Summary

**The Golden Rules**:

1. **Process queue FIRST** in update cycle
2. **Clear queue IMMEDIATELY** after processing
3. **Populate queue LAST** in update cycle
4. **Never check queue** mid-update (use separate state)
5. **Document queue timing** in comments

**Timeline**:
```
Tick N-1: Condition met → item queued → queue size = 1
Tick N START: Process queue → clear queue → queue size = 0
Tick N: ...other logic... → new condition → new item queued → queue size = 1
Tick N+1 START: Process queue → ...
```

This pattern ensures queues work correctly with the intent-based spatial system!
