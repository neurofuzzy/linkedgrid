# Entity Trait System

Spartan uses a trait-based system: entities are **dumb data containers** composed of **traits**, while logic lives exclusively in **systems**.

## Core Architecture

| Concept | Responsibility | Example |
| :--- | :--- | :--- |
| **Trait** | Passive data contract (Interface) | `HasHealth { hp: number }` |
| **Entity** | Composition of traits (Type) | `Player = EntityData & HasHealth` |
| **System** | Logic operating on traits | `if (hasHealth(e)) e.hp -= 10` |

**Data Flow:** Systems read traits → Modify data → Update EntityStore.

## Working with Entities

### 1. Defining & Spawning
Use **spawn helpers** for type safety, or raw `spawn()` for dynamic loading.

```typescript
// packages/spartan/entities/spawn-helpers.ts
export function spawnPlayer(spatial: SpatialSystem, x: number, y: number, props: PlayerData) {
  // TypeScript enforces required traits
  return spatial.spawn('player', x, y, GameLayers.ACTORS, props);
}
```

### 2. Accessing Data (Trait Guards)
Systems should generally operate on **Traits** (generic), not **Entity Types** (specific).

```typescript
import { hasHealth, canDealDamage } from '../traits/trait-guards';

// ✅ Good: Generic logic (works on Players, Enemies, Walls)
if (hasHealth(entity) && canDealDamage(attacker)) {
  entity.hp -= attacker.damage;
}

// ⚠️ Specific: Use only when logic is unique to one archetype
if (isPlayer(entity)) {
  // Access player-specific traits
}
```

## Extending the System

To add custom gameplay elements, follow this 3-step pattern in your game code:

```typescript
// 1. Define Trait (Data Contract)
interface HasMana { mana: number; maxMana: number; }

// 2. Create Type Guard (Runtime Check)
function hasMana(e: EntityData): e is EntityData & HasMana {
  return typeof (e as any).mana === 'number';
}

// 3. Compose Entity (Archetype)
type Mage = EntityData & HasHealth & HasMana;
```

## Built-in Reference

### Common Traits
| Trait | Properties | Usage |
| :--- | :--- | :--- |
| `HasHealth` | `hp`, `maxHp` | Combat, destructibles |
| `CanDealDamage` | `damage` | Weapons, hazards |
| `HasAI` | `aiState` | Enemy behavior |
| `HasSceneLocation` | `sceneId` | Persisting across rooms |

### Common Archetypes
| Entity | Composition |
| :--- | :--- |
| `PlayerData` | `HasHealth` + `CanDealDamage` + `HasSceneLocation` |
| `EnemyData` | `HasHealth` + `CanDealDamage` + `HasAI` |
| `TeleporterData` | `HasTeleportTarget` + `HasSceneLocation` |

## Best Practices
*   **Keep Entities Dumb**: No methods on entity types. Pure data only.
*   **Composition over Inheritance**: Entities *have* traits, they don't inherit them.
*   **Independent Traits**: Traits should not depend on other traits.
*   **Use Guards**: Always use type guards (`hasHealth`) before accessing properties.

## FAQ
*   **Why not ECS?** Components add lifecycle overhead. Traits are zero-cost data interfaces.
*   **Can I add dynamic props?** Yes, `EntityData` allows arbitrary keys. Archetypes just enforce the "happy path".