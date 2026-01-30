# Visual Test Timing Guide

## Overview

Visual tests in SPARTAN use `spatial.pause()` to create visualization frames and test timing-dependent behavior. Understanding tick-based timing is critical for writing reliable tests.

---

## Core Concepts

### 1. Tick-Based Timing

All game logic uses **ticks**, not real-time milliseconds:

```typescript
// Properties use ticks
{
  spreadRate: 5,      // Spread every 5 ticks
  lifetime: 20,       // Expires after 20 ticks
  cadence: 3          // Trigger every 3 ticks
}
```

### 2. Intent Lifecycle

Operations are TWO-PHASE:

```
Tick N:   spawn/move/remove → Intent staged
Tick N:   commit()          → Changes applied
Tick N+1: Queries see new state
```

**CRITICAL**: Same-tick queries see old state!

### 3. Visual Pause

`spatial.pause()` creates a visualization frame WITHOUT advancing game logic:

```typescript
gameLoop.tick();     // Game logic runs, state changes
spatial.pause();     // Create visual frame, NO logic
gameLoop.tick();     // Game logic runs again
```

---

## Test Structure Patterns

### Pattern 1: Simple State Verification

Test final state after N ticks:

```typescript
visual('fire spreads to neighbors', {
  arrange: ({ spatial }) => {
    spatial.spawn('fire', 5, 5, GameLayers.FLOOR, {
      propagationType: 'fire',
      spreadRate: 1,
      spreadProbability: 1.0,
      spreadLayer: GameLayers.FLOOR,
      spreadType: 'fire',
      maxDistance: 3,
      color: '#ff6b35',
    });
    spatial.commit();
  },
  act: ({ spatial }) => {
    const gameLoop = new GameLoop(spatial);
    const propagationSystem = new PropagationSystem();
    gameLoop.addSystem(propagationSystem);

    // Run 4 ticks with visual pauses
    for (let i = 0; i < 4; i++) {
      gameLoop.tick();
      spatial.pause();
    }
  },
  assert: ({ spatial, expect }) => {
    expect('Fire spread to adjacent cells', () => {
      const fireCount = Array.from(spatial.getAllPositions())
        .filter(([id]) => {
          const data = spatial.getEntityData(id);
          return data?.type === 'fire';
        }).length;

      if (fireCount <= 1) {
        throw new Error(`Expected fire to spread, got ${fireCount} entities`);
      }
    });
  },
});
```

### Pattern 2: Tick-By-Tick Assertions

Test state at specific ticks:

```typescript
visual('entity expires at correct tick', {
  arrange: ({ spatial }) => {
    spatial.spawn('fire', 5, 5, GameLayers.FLOOR, {
      lifetime: 3, // Expires at tick 3
      // ...
    });
    spatial.commit();
  },
  act: ({ spatial }) => {
    const gameLoop = new GameLoop(spatial);
    const system = new MySystem();
    gameLoop.addSystem(system);

    // Tick 1
    gameLoop.tick();
    spatial.pause();
    // Verify: entity exists

    // Tick 2
    gameLoop.tick();
    spatial.pause();
    // Verify: entity still exists

    // Tick 3
    gameLoop.tick();
    spatial.pause();
    // Verify: entity expired (removed at tick 3)

    // Tick 4
    gameLoop.tick();
    // Verify: replacement spawned (if queued)
  },
  assert: ({ spatial, expect }) => {
    // Final state assertions
  },
});
```

### Pattern 3: Deferred Operations

Test multi-tick operations (like ash spawning):

```typescript
visual('fire leaves ash after expiring', {
  arrange: ({ spatial }) => {
    spatial.spawn('fire', 5, 5, GameLayers.FLOOR, {
      lifetime: 3,
      // ...
    });
    spatial.commit();
  },
  act: ({ spatial }) => {
    const gameLoop = new GameLoop(spatial);
    const system = new PropagationSystem();
    gameLoop.addSystem(system);

    // Fire alive: ticks 1-3
    for (let i = 0; i < 3; i++) {
      gameLoop.tick();
      spatial.pause();
    }

    // Fire expires at tick 3, ash queued
    // Ash spawns at tick 4
    gameLoop.tick();
    spatial.pause();

    // Ash visible at tick 4+ (after commit)
  },
  assert: ({ spatial, expect }) => {
    expect('Ash exists', () => {
      const ashCount = Array.from(spatial.getAllPositions())
        .filter(([id]) => {
          const data = spatial.getEntityData(id);
          return data?.type === 'ash';
        }).length;

      if (ashCount === 0) {
        throw new Error('Expected ash after fire expires');
      }
    });
  },
});
```

---

## Common Pitfalls

### ❌ Pitfall 1: Not Accounting for Deferred Operations

```typescript
// WRONG - expects ash same tick fire is removed
gameLoop.tick(); // Tick 3: fire expires
// ash NOT visible yet!

const ashCount = getAshCount();
expect(ashCount > 0); // FAILS!
```

```typescript
// RIGHT - wait for next tick
gameLoop.tick(); // Tick 3: fire expires, ash queued
gameLoop.tick(); // Tick 4: ash spawns
// ash NOW visible!

const ashCount = getAshCount();
expect(ashCount > 0); // PASSES!
```

### ❌ Pitfall 2: Checking State Before Commit

```typescript
// WRONG - queries see pre-commit state
spatial.spawn('fire', 5, 5, FLOOR, {});
const id = spatial.getEntityIdAt(5, 5, FLOOR); // undefined!
```

```typescript
// RIGHT - commit first, then query
spatial.spawn('fire', 5, 5, FLOOR, {});
spatial.commit(); // or gameLoop.tick()
const id = spatial.getEntityIdAt(5, 5, FLOOR); // now defined!
```

### ❌ Pitfall 3: Mixing Real-Time and Tick-Based

```typescript
// WRONG - mixing milliseconds and ticks
{
  spreadRate: 1000,  // Milliseconds (OLD)
  lifetime: 20       // Ticks (NEW)
}
// These use different time bases!
```

```typescript
// RIGHT - everything in ticks
{
  spreadRate: 5,     // Ticks
  lifetime: 20,      // Ticks
  cadence: 3         // Ticks
}
```

### ❌ Pitfall 4: Off-By-One Errors

```typescript
// Entity with lifetime: 3
// Tick 1: age = 1, not expired
// Tick 2: age = 2, not expired
// Tick 3: age = 3, EXPIRED (3 >= 3)

// WRONG - expects expiration at tick 4
for (let i = 0; i < 4; i++) { tick(); }
// Entity already expired at tick 3!

// RIGHT - understand >= check
for (let i = 0; i < 3; i++) { tick(); } // Tick 3: expires
tick(); // Tick 4: replacement spawns
```

---

## Test Granularity

### ✅ DO: Test One Aspect Per Test

```typescript
visual('fire spreads to neighbors', ...);
visual('fire respects spread rate', ...);
visual('fire expires after lifetime', ...);
visual('expired fire leaves ash', ...);
visual('ash blocks fire spread', ...);
```

### ❌ DON'T: Test Everything At Once

```typescript
// AVOID - too broad, hard to debug
visual('fire system works', {
  // Tests spread, lifetime, ash, blocking all together
});
```

---

## Debugging Tips

### 1. Add Tick Counters

```typescript
act: ({ spatial }) => {
  for (let tick = 1; tick <= 5; tick++) {
    console.log(`\n=== Tick ${tick} ===`);
    gameLoop.tick();

    // Count entities
    const fireCount = Array.from(spatial.getAllPositions())
      .filter(([id]) => {
        const data = spatial.getEntityData(id);
        return data?.type === 'fire';
      }).length;
    console.log(`Fire count: ${fireCount}`);

    spatial.pause();
  }
}
```

### 2. Use System Debug State

```typescript
act: ({ spatial }) => {
  const system = new PropagationSystem();
  gameLoop.addSystem(system);

  gameLoop.tick();
  console.log('System state:', system.getDebugState());
  // Shows: currentTick, queueSize, trackedEntities, etc.
}
```

### 3. Visualize Grid State

```typescript
function printGrid(spatial, width, height) {
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const id = spatial.getEntityIdAt(x, y, GameLayers.FLOOR);
      const data = id ? spatial.getEntityData(id) : null;
      row += data ? data.type[0].toUpperCase() : '.';
      row += ' ';
    }
    console.log(row);
  }
}

// In test:
gameLoop.tick();
printGrid(spatial, 10, 10);
spatial.pause();
```

---

## Quick Reference

| Operation | When Visible | Notes |
|-----------|--------------|-------|
| `spawn()` | After `commit()` | Intent staged immediately |
| `move()` | After `commit()` | Entity still at old pos until commit |
| `remove()` | After `commit()` | Entity still on grid until commit |
| `commit()` | Same tick | Called automatically by `gameLoop.tick()` |
| `pause()` | Immediate | Visual only, no logic |
| System state | During `update()` | Before commit |
| Queries | After `commit()` | See post-commit state |

---

## Checklist for New Visual Tests

- [ ] All timing properties use ticks (not ms)
- [ ] Account for deferred operations (queues)
- [ ] Wait for commit before asserting state
- [ ] Test one aspect per test
- [ ] Add `spatial.pause()` for visualization
- [ ] Include debug logging if test is complex
- [ ] Verify off-by-one errors (>= vs >)
- [ ] Test passes reliably (run 10x)

---

## Examples Repository

See existing tests for patterns:
- `propagation.visual.test.ts` - Multi-tick propagation
- `floor-effects.visual.test.ts` - Continuous effects
- `scene-transition.visual.test.ts` - Cross-scene timing
- `teleporter-roundtrip.test.ts` - State reset timing
