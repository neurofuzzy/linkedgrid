# Propagation System & Ash Consumption - Retrospective

**Date**: 2026-01-27  
**Feature**: Tick-based propagation + probability + ash consumption  
**Outcome**: ✅ Working, all 186 tests passing  
**Dev Time**: ~3 hours with significant debugging

---

## What Went Wrong

### 1. **Queue Timing Bug (Root Cause)**
**Problem**: Ash spawn queue was cleared at the wrong time in the update cycle.

**Timeline**:
- ✅ Tick 3: Fire expires → ash queued  
- ❌ Tick 3 END: Queue cleared immediately  
- ❌ Tick 4 START: Empty queue → no ash spawned

**Root Cause**: Misunderstanding of the update cycle flow. I tried to keep the queue around for `canSpreadTo` checks during Phase 2, but clearing it at the end meant it was empty when Phase 0 needed it on the next tick.

**Fix**: Clear queue immediately after spawning in Phase 0, not at end of update.

```typescript
// WRONG - clears queue before next tick can use it
update() {
  // Phase 0: spawn from queue
  // ... phases 1-4 ...
  this.ashSpawnQueue = []; // ❌ Too late!
}

// RIGHT - clear after spawning, queue refills in Phase 4
update() {
  // Phase 0: spawn from queue
  for (const pos of this.ashSpawnQueue) { spawn(pos); }
  this.ashSpawnQueue = []; // ✅ Clear immediately
  // ... phases 1-4 ...
  // Phase 4 adds new items for NEXT tick
}
```

### 2. **Spread Rate Initialization Bug**
**Problem**: Changed `lastSpreadTick: 0` to `lastSpreadTick: this.currentTick` to fix spread rate for propagated entities, but this inadvertently seemed like it might break ash (it didn't, but caused confusion).

**Issue**: New fire entities were spreading immediately instead of respecting `spreadRate`.

**Fix**: Initialize all entities with `lastSpreadTick: this.currentTick` so they wait the full cadence.

### 3. **Test Coverage Gap**
**Problem**: Removed the ash consumption test when it was failing during initial development, leaving no test coverage for this critical feature.

**Impact**: The queue timing bug went undetected because there was no test exercising ash spawning.

### 4. **Intent-Based Architecture Complexity**
**Problem**: The spatial system's intent-based operations (`spawn`, `remove`, `commit`) create timing complexity:
- Operations are staged as intents
- Not committed until end of tick
- State queries (`getEntityIdAt`, `getValue`) see pre-commit state
- This creates a multi-tick delay for state changes

**Example**:
```
Tick 3: fire.remove() + ash.queue()     [intent staged]
Tick 3: commit() applies removal         [fire gone from grid]
Tick 4: ash.spawn()                      [intent staged]
Tick 4: commit() applies spawn           [ash on grid]
Tick 5: Code can finally see ash         [visible to queries]
```

This led to 50+ minutes of debugging where ash was being spawned but not visible when/where expected.

---

## Symptoms That Made Debugging Hard

1. **Silent Failures**: No errors, just missing entities
2. **Delayed Visibility**: Entities spawned but not queryable until next commit
3. **State Confusion**: `getEntityData()` returns stale data during same-tick operations
4. **No Intermediate Logging**: Hard to trace queue lifecycle without intrusive logging
5. **Test Flakiness**: Timing-dependent tests failed intermittently during development

---

## What Worked Well

1. **Tick-Based Timing**: Switching from ms to ticks eliminated flaky time-dependent tests
2. **PRNG Probability**: 60% spread chance creates organic fire patterns
3. **System-Owned State**: `ashSpawnQueue`, `spreadState`, `propagatedEntities` kept logic clean
4. **Visual Tests**: Once working, visual tests provide excellent coverage
5. **Deferred Spawning Pattern**: Queue-based approach is architecturally sound

---

## Improvements for Future Dev Cycles

### A. Testing Strategy

**1. Write Tests First (TDD)**
- ✅ Write failing test BEFORE implementing feature
- ✅ Keep test even if initially failing
- ✅ Use test to drive design decisions

**2. Test Granularity**
```typescript
// GOOD: Test one thing
test('fire expires after lifetime', ...)
test('expired fire queues ash', ...)
test('queued ash spawns next tick', ...)
test('ash blocks fire spread', ...)

// BAD: Test everything at once
test('fire consumption system works', ...) // Too broad!
```

**3. Test Timing Explicitly**
```typescript
// Add tick counter assertions
expect('Fire alive at tick 2', () => { /* check */ });
expect('Fire expired at tick 3', () => { /* check */ });
expect('Ash spawned at tick 4', () => { /* check */ });
```

### B. Debugging Tools

**1. System Inspector**
```typescript
// Add to PropagationSystem
public getDebugState() {
  return {
    currentTick: this.currentTick,
    ashQueueSize: this.ashSpawnQueue.length,
    ashQueue: this.ashSpawnQueue,
    spreadStateSize: this.spreadState.size,
    propagatedCount: this.propagatedEntities.size,
  };
}
```

**2. Entity Lifecycle Logging**
```typescript
// Optional verbose mode
if (this.debug) {
  console.log(`[Tick ${tick}] Entity ${id} state change: ${old} → ${new}`);
}
```

**3. Queue Visualization**
```typescript
// Visual test helper to show queue state
spatial.debugQueues(); // Shows: ashSpawn=3, moveIntents=5, etc.
```

### C. Architecture Patterns

**1. Document Intent Lifecycle**
```typescript
/**
 * INTENT LIFECYCLE:
 * 1. Call spawn/move/remove (intent staged)
 * 2. System update runs (reads pre-commit state)
 * 3. commit() applies intents (state changes)
 * 4. Next update sees new state
 * 
 * IMPORTANT: Same-tick queries see OLD state!
 */
```

**2. Queue Patterns**
```typescript
/**
 * DEFERRED OPERATION PATTERN:
 * - Tick N: Detect condition → queue operation
 * - Tick N: Clear queue AFTER using it
 * - Tick N+1: Execute queued operations
 * 
 * CRITICAL: Clear queue IMMEDIATELY after use, not at end!
 */
```

**3. Naming Conventions**
```typescript
// Make timing explicit in names
private ashSpawnQueueForNextTick: Position[];
private lastSpreadTickStartTime: number;
private currentTickNumber: number;
```

### D. Development Workflow

**1. Incremental Development**
- ✅ Implement one phase at a time
- ✅ Add logging, test, verify, remove logging
- ✅ Commit after each working phase

**2. Debug Workflow**
```
1. Add targeted logging (not everywhere)
2. Run single failing test
3. Check console output
4. Fix root cause
5. Remove logging
6. Run full suite
7. Commit
```

**3. Visual Test Workflow**
```
1. Write test with spatial.pause() for visualization
2. Run with visual runner
3. Watch entities spawn/move/die
4. Adjust timing based on visual feedback
5. Assert final state
```

### E. Code Review Checklist

Before merging features like this:

- [ ] All tests passing (not just "most")
- [ ] No console.log statements left behind
- [ ] No commented-out code from debugging
- [ ] Queue lifecycle documented
- [ ] Timing assumptions explicit
- [ ] Edge cases tested (empty queue, expired immediately, etc.)

---

## Key Learnings

### 1. Intent-Based Systems Need Special Attention
- State changes aren't immediate
- Queries see stale data within same tick
- Multi-tick delays are normal, not bugs
- Document this prominently!

### 2. Queue Timing Is Critical
- Clear queues immediately after consuming
- Document when queue is populated vs. consumed
- Don't try to be clever with queue lifecycle

### 3. Test Coverage Prevents Regressions
- Never remove failing tests - fix them
- One test per feature aspect
- Tests should run fast (<30ms each)

### 4. Logging Strategy Matters
- Add logging strategically, not everywhere
- Remove logging before committing
- Consider a debug flag for production troubleshooting

### 5. Visual Tests Are Powerful
- Great for understanding timing
- Excellent for spotting visual bugs
- But need automated assertions too

---

## Action Items

- [ ] Add `getDebugState()` to all systems
- [ ] Document intent lifecycle in spatial-system.ts
- [ ] Create visual test guide with timing best practices
- [ ] Add queue lifecycle patterns to dev guide
- [ ] Consider automated queue state assertions in test framework

---

## Conclusion

The ash consumption feature works correctly, but took 3x longer than expected due to:
1. Queue timing bug (30min to find)
2. Intent lifecycle confusion (50min debugging)
3. Missing test coverage (15min to recreate test)

**If we had**: Written the test first, understood queue timing, and had debug tools → 30min implementation.

**Actual time**: 3 hours

**Future estimate with improvements**: 45-60min for similar features
