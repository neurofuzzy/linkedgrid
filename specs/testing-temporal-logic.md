# Testing Temporal Logic in Tick-Based Systems

**Date:** January 30, 2026  
**Component:** Testing Strategy for Spartan Game Engine  
**Author:** Software Architecture Review

---

## The Problem: Temporal Causality is Opaque

Deterministic tick-based systems are excellent for testing, but temporal tests are difficult to understand because causality is often hidden behind magic numbers (`tick(); tick(); tick();`).

**Goal:** Make temporal behavior **explicit** so both LLMs and humans can understand *why* events happen when they do.

---

## Strategy 1: Constants from System Config

Instead of magic numbers, use the centralized `systems.config.ts` (defined in [Framework Conventions](framework-conventions.md)) as the source of truth for tick rates.

### Before
```typescript
test('fire spreads', () => {
  gameLoop.tick();
  gameLoop.tick();
  gameLoop.tick(); // Why 3?
  expect(fireCount).toBe(2);
});
```

### After
```typescript
import { SYSTEM_CONFIG } from '../config/systems.config';

test('fire spreads after configured delay', () => {
  // Clear intent: waiting for specific system behavior
  gameLoop.tickN(SYSTEM_CONFIG.Fire.tickRate);
  expect(fireCount).toBe(2);
});
```

---

## Strategy 2: Semantic Helper Functions

Encapsulate temporal logic in descriptive helper functions. This decouples test intent from implementation details.

### Implementation (`helpers/test-helpers.ts`)

```typescript
export function advanceUntilFireSpreads(gameLoop: GameLoop): void {
  gameLoop.tickN(SYSTEM_CONFIG.Fire.tickRate);
}

export function advanceUntilPoisonDamage(gameLoop: GameLoop): void {
  gameLoop.tickN(SYSTEM_CONFIG.Poison.tickRate);
}

// For multi-cycle events
export function advanceSpreadCycles(gameLoop: GameLoop, cycles: number = 1): void {
  const rate = SYSTEM_CONFIG.Fire.tickRate;
  gameLoop.tickN(rate * cycles);
}
```

### Usage

```typescript
test('fire spreads in multiple waves', () => {
  spawnFire(spatial, 5, 5);
  
  advanceSpreadCycles(gameLoop, 1); // First wave
  expect(countEntitiesOfType('fire')).toBeGreaterThan(1);
  
  advanceSpreadCycles(gameLoop, 2); // Two more waves
  expect(countEntitiesOfType('fire')).toBeGreaterThan(5);
});
```

---

## Strategy 3: Explicit State Snapshots

Document the expected state transition *before* asserting it. This explains the "story" of the test.

```typescript
test('player unlocks door', () => {
  // SETUP: Player at (0,0), Key at (1,0), Door at (2,0)
  
  // TICK 1: Player collects key
  playerInput.move('right');
  gameLoop.tick();
  // → PlayerInput: moves to (1,0)
  // → Collection: adds key to inventory
  
  // VERIFY: Key collected
  expect(player.inventory).toContain('key');
  
  // TICK 2: Player moves to locked door
  playerInput.move('right');
  gameLoop.tick();
  // → DoorSystem: detects move + key, unlocks door
  // → Spatial: allows move to (2,0)
  
  // VERIFY: Door unlocked and player moved
  expect(spatial.getEntityAt(2, 0, GameLayers.WALLS)).toBeUndefined();
  expect(player.pos).toEqual({ x: 2, y: 0 });
});
```

---

## Strategy 4: Executable Specifications (DSL)

For complex scenarios, use a fluent API to make tests read like requirements. This matches our `visual()` test pattern.

```typescript
test('fire spreads to adjacent grass', () => {
  scenario(gameLoop)
    .withEntities([
      { type: 'fire', x: 5, y: 5 },
      { type: 'grass', x: 6, y: 5 }
    ])
    .advanceUntil('fire-spreads')
    .expectEntityCount('fire', 2);
});
```

---

## Summary

1.  **Use `SYSTEM_CONFIG`** for tick rates (Single Source of Truth).
2.  **Use Semantic Helpers** (`advanceUntil...`) to hide loop mechanics.
3.  **Document State Transitions** within the test to show causality.

**Rule of Thumb:** If you write `gameLoop.tick()`, add a comment explaining *what* system is expected to act. If you write a loop, extract it to a helper.