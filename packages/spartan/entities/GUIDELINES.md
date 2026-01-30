# Entity System Guidelines

> [!NOTE]
> This document outlines the philosophy and best practices for extending the Entity/Trait system in Spartan.
> **Core Principle**: Interface Composition over Class Inheritance.

## The Philosophy: "The Sweet Spot"

Spartan uses a **Data-Oriented** approach that sits between simple confusing objects and rigid ECS components.
We use TypeScript's type system to enforce structure without runtime overhead.

### 1. Dumb Data
Traits are **pure data interfaces**. They never contain methods or logic.
Logic belongs in **Systems**.

**Good:**
```typescript
interface HasHealth {
  hp: number;
  maxHp: number;
}
```

**Bad:**
```typescript
class HealthComponent {
  takeDamage(amount: number) { this.hp -= amount; } // LOGIC! BAD!
}
```

### 2. Explicit Contracts
Entities are defined by the intersection of their traits. This makes them:
- **Serializable**: easy to save/load.
- **Readable**: `PlayerData = EntityData & HasHealth & HasInventory` tells you exactly what a player is.
- **Type-Safe**: Use discriminated unions (`type: 'player'`) and intersection types (`&`).

## Managing Complexity

### Preventing Trait Explosion
*Rule of Thumb*: **Configure, Don't Duplicate.**

If two concepts share the same *logic* but have different *parameters*, use a single configurable trait.

**Example: `HasFloorEffect`**
Instead of creating `HasLava`, `HasIce`, `HasMud`:
1.  Create one `HasFloorEffect` trait.
2.  Add an `effectType` field (`'damage' | 'slide' | 'slow'`).
3.  Add configuration fields (`damageAmount`, `slideSpeed`).

**When to create a New Trait:**
Only when the *logic* required to process it is fundamentally different.
-   `HasTeleportTarget` needs completely different system logic than `HasHealth`. -> **New Trait**.

### Preventing Fragmentation
*Rule of Thumb*: **Atomic is Good.**

It is okay to have small, specific traits.
-   `HasHealth`: "I have HP".
-   `HasDamageable`: "I have a damage threshold (hardness)".

These are distinct concepts. Merging them into a "Mega-Health" trait would force walls to have HP and players to have hardness, which might not make sense.
**Duplication of data definitions is cheap. Duplication of System Logic is expensive.**

## Creating a New Entity Type

1.  **Define Traits**: Check `traits.ts` first. If needed, add a new one following the rules above.
2.  ** Compose Type**: In `entity-types.ts`:
    ```typescript
    export type MyNewEntity = EntityData & {
      type: 'my-entity';
    } & HasTraitA & HasTraitB;
    ```
3.  **Add Type Guard**: In `trait-guards.ts` (if needed for runtime checks).
