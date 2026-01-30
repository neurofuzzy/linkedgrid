# Spartan System Development Guide

> [!NOTE]
> This guide is for new agents and developers creating systems for the Spartan Game Engine. It enforces the **Tick-Based, Deterministic** philosophy.

## Core Philosophy: Determinism via Ticks

Spartan avoids `deltaTime` (milliseconds) in favor of **Ticks** (discrete logic updates).
1.  **Repeatability**: The same sequence of inputs over the same number of ticks always produces the same state.
2.  **Discrete Steps**: Actions happen on integer ticks. Fire spreads on tick 10, not 10.45.
3.  **Two-Phase Commit**: Systems *propose* changes during a tick; the [SpatialSystem](./packages/spartan/spatial-system.ts#150-1312) *executes* them at the end.

## The Toolkit Gap: Shared Time

Currently, [GameContext](./packages/spartan/types.ts#96-102) only provides `spatial` and `overlaps`. It **does not** yet provide a synchronized `tickCount`.
> [!IMPORTANT]
> **Current Best Practice**: Systems must maintain their own internal `currentTick` counter if they need time-based logic.
> **Future Goal**: Elevate `tickCount` to [GameContext](./packages/spartan/types.ts#96-102) to ensure all systems are perfectly synchronized.

## Anatomy of a System

Every system implements the [GameSystem](./packages/spartan/types.ts#118-121) interface.

```typescript
export interface GameSystem {
  // Configurable dependencies (optional)
  constructor(private gameManager: GameManager) {}

  // The Heartbeat: Called once per Tick
  update(context: GameContext): void;
}
```

### The Starter Template

Use this template for all new systems to ensure consistency.

```typescript
import type { GameSystem, GameContext } from '../types';

/**
 * [SystemName] - [Brief Description]
 *
 * [Detailed explanation of what this system does]
 * 
 * Dependencies:
 * - [Trait Name]: [Why it's needed]
 */
export class StarterSystem implements GameSystem {
  // Track internal time since we don't have global clock yet
  private currentTick = 0;

  update(context: GameContext): void {
    this.currentTick++;

    // 1. QUERY: Find relevant entities
    // - Use context.spatial.getAllPositions() to iterate
    // - Use context.spatial.getEntityData(id) to check traits
    // - Use context.overlaps for collision logic

    // 2. LOGIC: Make decisions based on state
    // - Check cadence (if (this.currentTick % rate === 0))
    // - Check conditions (traits, probability)

    // 3. INTENT: Stage changes
    // - context.spatial.spawn(...)
    // - context.spatial.move(...)
    // - context.spatial.remove(...)
    
    // NEVER mutate grid/cells directly!
  }

  /**
   * Reset state for testing/scene transitions
   */
  public resetState(): void {
    this.currentTick = 0;
    // Clear other internal maps/queues
  }
}
```

## Best Practices

### 1. Detect, Don't Predict
Do not try to predict where an entity *will* be.
-   **Bad**: `if (player.x + 1 === trap.x)`
-   **Good**: Read `context.spatial.getPendingOps()` to see if the player *intends* to move there.

### 2. Handle "Ghost" Entities
Entities removed during a tick are still discoverable until commit.
-   **Always**: Check `context.spatial.isAlive(entityId)` before acting on an entity found via spatial queries.

### 3. State Management
If your system needs state (e.g., "charging up attack"):
-   **Preferred**: Store it in a transient `Map<EntityId, State>` within the system.
-   **Avoid**: Polluting the global [EntityData](./packages/spartan/types.ts#26-36) with temporary system flags unless they need to be serialized/saved.

### 4. Deterministic Randomness
If using probability (e.g., fire spread):
-   All random calls happen inside [update()](./packages/spartan/systems/player-input-system.ts#35-97).
-   Ideally, use a seeded RNG (not `Math.random()`) passed via constructor (not yet standard in Spartan, but good practice).
