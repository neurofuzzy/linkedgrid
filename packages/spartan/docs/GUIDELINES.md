# Spartan Development Guidelines

This document outlines the philosophy and best practices for developing with the Spartan Game Engine.

---

## Core Philosophy: Determinism via Ticks

Spartan avoids `deltaTime` (milliseconds) in favor of **Ticks** (discrete logic updates).

1. **Repeatability**: The same sequence of inputs over the same number of ticks always produces the same state.
2. **Discrete Steps**: Actions happen on integer ticks. Fire spreads on tick 10, not 10.45.
3. **Two-Phase Commit**: Systems *propose* changes during a tick; the `SpatialSystem` *executes* them at the end.

---

## Entity and Trait System

Spartan uses a **Data-Oriented** approach. TypeScript's type system enforces structure without runtime overhead.

### 1. Interface Composition over Class Inheritance

Entities are defined by the intersection of their traits. This makes them serializable and readable.

### 2. Dumb Data

Traits are **pure data interfaces**. They never contain methods or logic. Logic belongs in **Systems**.

```typescript
interface HasHealth {
  hp: number;
  maxHp: number;
  healthState: 'alive' | 'dying' | 'dead';
}
```

### 3. Configure, Don't Duplicate

If two concepts share the same *logic* but have different *parameters*, use a single configurable trait.

- **Example**: `HasFloorEffect` handles damage, sliding, and slowing via an `effectType` field.
- **Example**: `CharacterPersona` presets bundle stats for different NPC tiers.

---

## System Development

Every system should extend `BaseTickedSystem` or `BaseReactiveSystem` (from `core/base-system.ts`).

### Anatomy of a System

```typescript
export class MySystem extends BaseTickedSystem {
  protected tickRate = SYSTEM_CONFIG.MySystem.tickRate;
  readonly executionPhase = 'main' as const;

  protected onTick(context: GameContext): void {
    // 1. QUERY: Find relevant entities via context.spatial
    // 2. LOGIC: Make decisions based on state
    // 3. INTENT: Stage changes (spawn, move, remove)
  }

  public override resetState(): void {
    super.resetState();
    // Clear all internal collections
  }

  public override getDebugState(): Record<string, unknown> {
    return { ...super.getDebugState(), /* system-specific state */ };
  }
}
```

### Best Practices

1. **Detect, Don't Predict**: Do not predict where an entity *will* be. Read `context.spatial.getPendingOps()` to see movement intents.
2. **Handle "Ghost" Entities**: Entities removed during a tick are still discoverable until commit. Always check `context.spatial.isAlive(entityId)` before acting.
3. **State Management**: Store transient system state in a `Map<EntityId, State>` within the system. Avoid polluting entity data with temporary flags.
4. **Queue Lifecycle**: Clear queues immediately after consuming them. Never let queue state leak across ticks. See [specs/queue-lifecycle-patterns.md](../../../specs/queue-lifecycle-patterns.md).
5. **resetState()**: Always implement. Systems persist across scene transitions. All Maps, Sets, Arrays, and counters must be cleared.
6. **getDebugState()**: Always implement. Expose internal counters and queue sizes for the visual runner.

---

## Reactive Intent-Based Architecture

The core execution pattern:

```
1. PlayerInputSystem  ->  stages move intent (no validation)
2. PushSystem/DoorSystem  ->  react to intents, modify world
3. spatial.commit()  ->  validates and executes all operations
4. Post-commit systems  ->  react to committed state (overlaps, deaths)
```

**Input systems are dumb**: Always stage intents, even into walls.
**Game systems are reactive**: Inspect `getPendingOps()` to respond to intents.
**Commit is the gatekeeper**: Validates blocking, occupancy, and conflicts.

---

## Directory and Naming Conventions

- **Systems**: `[name].system.ts` (e.g., `fire.system.ts`)
- **Entities**: `[name].entity.ts` (e.g., `player.entity.ts`)
- **Traits**: `[name].trait.ts` (e.g., `health.trait.ts`)
- **Config**: `[domain].config.ts` (e.g., `systems.config.ts`)
- **Tests**: `[name].test.ts` or `[name].visual.test.ts`

### Class Naming

- **Systems**: `[Name]System` (e.g., `FireSystem`, `DoorSystem`)
- **Base Classes**: `Base[Name]` (e.g., `BaseSystem`, `BaseTickedSystem`)

### Constants

```typescript
// SCREAMING_SNAKE_CASE for timing/numeric constants
export const FIRE_DAMAGE_RATE = 5;
export const TEMPERATURE_INCREASE = 50;

// PascalCase for enum-like objects
export const GameLayers = { FLOOR: 1, WALLS: 5, ACTORS: 6 } as const;
```

---

## Testing Rules

1. All tests must use **AAA pattern** (Arrange, Act, Assert).
2. Tests must support both **headless** (Vitest) and **visual runner** execution.
3. Use `spatial.pause()` to create visualization frames in visual tests.
4. All timing uses **ticks**, never milliseconds.
5. Account for **deferred operations**: query after `commit()`, not before.
6. Test **one aspect per test**. Avoid monolithic test cases.

---

## Spartan Review Checklist

When modifying code, ask:

- Does this follow Spartan principles? (minimal, explicit, testable, deterministic)
- Are entities kept dumb with logic in systems?
- Should this be a trait, entity type, or system?
- Are operations staged then committed?
- Is system execution order correct?
- Are pending operations used for reactive behavior?
- Will this work in both Vitest and visual runner?
- Is `resetState()` implemented properly?
- Is the queue lifecycle correct (consume then clear)?

---

## See Also

- [REFERENCE.md](./REFERENCE.md) -- Full framework reference
- [ENTITIES.md](./ENTITIES.md) -- Entity trait system
- [SYSTEMS.md](./SYSTEMS.md) -- Systems reference
- [HOWTO_SPATIAL.md](./HOWTO_SPATIAL.md) -- Spatial queries and updates
- [specs/spartan-dev-rules.md](../../../specs/spartan-dev-rules.md) -- Core development principles
- [specs/spartan-review-rules.md](../../../specs/spartan-review-rules.md) -- Code review rules
