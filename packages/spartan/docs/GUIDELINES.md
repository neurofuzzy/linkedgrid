# Spartan Development Guidelines

This document outlines the philosophy and best practices for developing with the Spartan Game Engine.

---

## Core Philosophy: Determinism via Ticks

Spartan avoids `deltaTime` (milliseconds) in favor of **Ticks** (discrete logic updates).
1.  **Repeatability**: The same sequence of inputs over the same number of ticks always produces the same state.
2.  **Discrete Steps**: Actions happen on integer ticks. Fire spreads on tick 10, not 10.45.
3.  **Two-Phase Commit**: Systems *propose* changes during a tick; the `SpatialSystem` *executes* them at the end.

---

## Entity & Trait System

Spartan uses a **Data-Oriented** approach that sits between simple confusing objects and rigid ECS components.
We use TypeScript's type system to enforce structure without runtime overhead.

### 1. Interface Composition over Class Inheritance
Entities are defined by the intersection of their traits. This makes them easy to serialize and read.

### 2. Dumb Data
Traits are **pure data interfaces**. They never contain methods or logic. Logic belongs in **Systems**.

**Good:**
```typescript
interface HasHealth {
  hp: number;
  maxHp: number;
}
```

### 3. Configure, Don't Duplicate
If two concepts share the same *logic* but have different *parameters*, use a single configurable trait.
-   **Example**: `HasFloorEffect` handles damage, sliding, and slowing via an `effectType` field.

---

## System Development

Every system should extend `BaseTickedSystem` or `BaseReactiveSystem` (from `packages/spartan/core/base-system.ts`).

### Anatomy of a System

```typescript
export class MySystem extends BaseTickedSystem {
  protected tickRate = SYSTEM_CONFIG.MySystem.tickRate;

  protected onTick(context: GameContext): void {
    // 1. QUERY: Find relevant entities via context.spatial
    // 2. LOGIC: Make decisions based on state
    // 3. INTENT: Stage changes (spawn, move, remove)
  }
}
```

### Best Practices

1.  **Detect, Don't Predict**: Do not try to predict where an entity *will* be. Read `context.spatial.getPendingOps()` to see movement intents.
2.  **Handle "Ghost" Entities**: Entities removed during a tick are still discoverable until commit. Always check `context.spatial.isAlive(entityId)` before acting.
3.  **State Management**: Store transient system state in a `Map<EntityId, State>` within the system. Avoid polluting global `EntityData` with temporary flags.
4.  **Deterministic Randomness**: All random calls should happen inside the update loop. Ideally, use a seeded RNG.

---

## Directory & Naming Conventions

-   **Systems**: `[name].system.ts` (e.g., `fire.system.ts`)
-   **Entities**: `[name].entity.ts` (e.g., `player.entity.ts`)
-   **Traits**: `[name].trait.ts` (e.g., `health.trait.ts`)
-   **Config**: `[domain].config.ts` (e.g., `systems.config.ts`)
-   **Tests**: `[name].test.ts` or `[name].spec.ts`
