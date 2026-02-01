# Game Systems

Systems implement game logic by processing the `GameContext` every tick.

## System Base Classes

| Class | Frequency | Method to Override | Use Case |
| :--- | :--- | :--- | :--- |
| `BaseReactiveSystem` | Every tick | `update(context)` | Input, immediate reactions, overlaps |
| `BaseTickedSystem` | Every N ticks | `onTick(context)` | AI, physics, environmental effects |
| `BaseSystem` | Manual | `update(context)` | Custom timing requirements |

## Core Concepts

### GameContext
- **`spatial`**: Main API for the world. Spawn, move, remove entities; query positions; access entity data.
- **`overlaps`**: List of all cells containing multiple entities (optimized for collision logic).
- **`gameManager`**: Global state access and scene transition triggers.

### Trait Guards
Always use trait guards for type-safe property access:
```typescript
if (hasHealth(entity)) entity.hp -= 10; // TypeScript now knows entity has .hp
```

### Lifecycle & State
Systems persist across scenes. **Always** override `resetState()` to clear internal collections (Maps, Arrays, etc.) to prevent memory leaks or cross-scene bugs.

```typescript
public override resetState(): void {
  super.resetState(); // Resets tick counters
  this.internalMap.clear();
}
```

## Best Practices

1. **Two-Phase Updates**: Calculate all changes first, then apply them. This prevents "order-of-execution" bugs where the first processed entity has an unfair advantage.
2. **Prefer Ticked Systems**: Use `BaseTickedSystem` with a `tickRate > 1` for performance-heavy logic like AI or spread mechanics.
3. **Statelessness**: Try to store state in Entity traits rather than private System variables when possible.
4. **Debug Visibility**: Override `getDebugState()` to expose internal system counters to the visual runner.

## Example: Reactive Collection System

```typescript
import { BaseReactiveSystem, GameContext, isPlayer, isCollectible } from '../core';

export class CollectionSystem extends BaseReactiveSystem {
  update({ overlaps, spatial }: GameContext): void {
    for (const { entityIds } of overlaps) {
      const player = entityIds.find(id => isPlayer(spatial.getEntityData(id)));
      const item = entityIds.find(id => isCollectible(spatial.getEntityData(id)));

      if (player && item) {
        // Logic: Add to inventory (via traits) and remove from world
        spatial.remove(item);
      }
    }
  }
}
```

## See Also
- [System Registration](../../../specs/spartan-system-registration.md)
- [Trait Guards](../traits/trait-guards.ts)