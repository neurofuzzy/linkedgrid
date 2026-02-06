# Game Systems

Systems implement game logic by processing the `GameContext` every tick.

## System Base Classes

| Class | Frequency | Method to Override | Use Case |
| :--- | :--- | :--- | :--- |
| `BaseReactiveSystem` | Every tick | `update(context)` | Input, immediate reactions, overlaps |
| `BaseTickedSystem` | Every N ticks | `onTick(context)` | AI, physics, environmental effects |
| `BaseSystem` | Manual | `update(context)` | Custom timing requirements |

Source: [core/base-system.ts](../core/base-system.ts)

## Core Concepts

### GameContext

- **`spatial`**: Main API for the world. Spawn, move, remove entities; query positions; access entity data.
- **`overlaps`**: List of all cells containing multiple entities (optimized for collision logic).
- **`gameManager`**: Global state access and scene transition triggers.
- **`tick`**: Current tick count.

### Execution Phases

Systems declare an `executionPhase` that determines ordering:

| Phase | Order | Purpose | Example Systems |
| :--- | :--- | :--- | :--- |
| `input` | 1st | Capture player intent | PlayerInputSystem |
| `pre-commit` | 2nd | React to intents before validation | PushSystem, DoorSystem |
| `main` | 3rd | Core game logic | FireSystem, NPCMovementSystem, SignalSystem |
| `post-commit` | 4th | React to committed state | HealthSystem, CollectionSystem, ScoreSystem |

Source: [config/systems.config.ts](../config/systems.config.ts)

### Trait Guards

Always use trait guards for type-safe property access:

```typescript
if (hasHealth(entity)) entity.hp -= 10; // TypeScript knows entity has .hp
if (hasArmor(entity)) damage = Math.max(0, damage - entity.armor);
```

### Lifecycle and State

Systems persist across scenes. **Always** override `resetState()` to clear internal collections (Maps, Arrays, Sets) to prevent memory leaks or cross-scene bugs.

```typescript
public override resetState(): void {
  super.resetState(); // Resets tick counters
  this.internalMap.clear();
  this.pendingQueue = [];
}
```

### Debug Visibility

Override `getDebugState()` to expose internal system state to the visual runner:

```typescript
public override getDebugState(): Record<string, unknown> {
  return {
    ...super.getDebugState(),
    trackedEntities: this.tracked.size,
    queueLength: this.queue.length,
  };
}
```

## All Built-in Systems (25)

### Input Phase

| System | Tick Rate | Description |
| :--- | :--- | :--- |
| **PlayerInputSystem** | 1 | Translates `InputProvider.getMoveDirection()` into `spatial.move()` intents. No validation. |

### Pre-Commit Phase

| System | Tick Rate | Description |
| :--- | :--- | :--- |
| **PushSystem** | 1 | Resolves push interactions from movement intents. Supports chain pushing. |
| **DoorSystem** | 1 | Unlocks doors when player has matching key. Inspects pending ops. |
| **NPCBrainSystem** | 1 | AI Controller: threat scanning, posture evaluation, attack/movement intent. |

### Main Phase

| System | Tick Rate | Description |
| :--- | :--- | :--- |
| **MeleeSystem** | 1 | Close-range combat via primary action. Player and NPC attacks. |
| **PlayerWeaponSystem** | 1 | Ranged weapon firing with ammo. Shotgun cone, melee fallback. |
| **NPCMovementSystem** | 2 | Autonomous NPC movement (pursue, patrol, guard, wander, follow, flee). |
| **FireSystem** | 1 | Temperature-based fire spread, burning damage, ash spawning. |
| **ExplosionSystem** | 1 | Area-of-effect explosions from entities with HasExplosion at 0 HP. |
| **LiquidSystem** | 1 | Volumetric liquid flow and depth diffusion. |
| **PoisonSystem** | 1 | Density-based gas dispersion and damage. |
| **ChainReactionSystem** | 1 | Deterministic chain link spreading. |
| **FloorEffectSystem** | 1 | Floor hazards: damage, heal, slide, slow. |
| **ProjectileSystem** | 1 | Autonomous projectiles along Bresenham paths. Bounce, pierce. |
| **TurretSystem** | 1 | Stationary shooters. Targeting: nearest, player, fixed, cardinal. |
| **SignalSystem** | 1 | Signal propagation (oscillators, switches, conductors, inverters, range sensors). |
| **GateSystem** | 1 | Signal-controlled gate open/close (WALLS <-> FLOOR layer swap). |
| **SpawningSystem** | 1 | Entity spawning from spawner entities. Supports wave mode, boundary recycling. |

### Post-Commit Phase

| System | Tick Rate | Description |
| :--- | :--- | :--- |
| **HealthSystem** | 1 | Intent-based damage/heal. Damage pipeline: vuln -> resist -> armor -> shield -> HP. Death states. |
| **CollectionSystem** | 1 | Item pickup from overlaps. Inventory management. |
| **TeleporterSystem** | 1 | Cross-scene teleportation via connectionKey matching. |
| **PowerupSystem** | 1 | Powerup collection, timed buffs, health-regen (heal-over-time). |
| **RespawnSystem** | 1 | Player death detection, checkpoint respawning, lives tracking. |
| **ScoreSystem** | 1 | Score from kills (scoreValue) and coin collection. |
| **ObjectiveSystem** | 1 | Objective tracking: collect-flag, kill-all, reach-exit, wave-clear. |

## Best Practices

1. **Two-Phase Updates**: Calculate all changes first, then apply. Prevents order-of-execution bias.
2. **Prefer Ticked Systems**: Use `BaseTickedSystem` with `tickRate > 1` for expensive logic like AI.
3. **Statelessness**: Store persistent state in entity traits. Use system-private state for transient data only.
4. **Ghost Entity Checks**: Always call `spatial.isAlive(entityId)` before acting on entities that might be pending removal.
5. **Queue Lifecycle**: Clear queues immediately after consuming them to avoid state leakage across ticks. See [specs/queue-lifecycle-patterns.md](../../../specs/queue-lifecycle-patterns.md).

## Example: Reactive Collection System

```typescript
import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import { isPlayer, isCollectible, hasInventory } from '../traits/trait-guards';

export class CollectionSystem extends BaseReactiveSystem {
  readonly executionPhase = 'post-commit' as const;

  update({ overlaps, spatial }: GameContext): void {
    for (const { entityIds } of overlaps) {
      const playerId = entityIds.find(id => {
        const d = spatial.getEntityData(id);
        return d && isPlayer(d);
      });
      const itemId = entityIds.find(id => {
        const d = spatial.getEntityData(id);
        return d && isCollectible(d);
      });

      if (playerId && itemId) {
        const playerData = spatial.getEntityData(playerId);
        const itemData = spatial.getEntityData(itemId);
        if (playerData && itemData && hasInventory(playerData)) {
          playerData.inventory.push(itemData.type);
          spatial.remove(itemId);
        }
      }
    }
  }
}
```

## See Also

- [REFERENCE.md](./REFERENCE.md) -- Full framework reference
- [core/system-registry.ts](../core/system-registry.ts) -- System factory and dependency order
- [config/systems.config.ts](../config/systems.config.ts) -- System timing configuration
- [specs/spartan-system-registration.md](../../../specs/spartan-system-registration.md) -- Registration patterns
