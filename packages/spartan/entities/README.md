# Entity Trait System

The Spartan framework uses a trait-based entity system that keeps entities **dumb** (pure data) while enabling systems to work with **generic, reusable logic**.

## Core Concepts

### Traits

**Traits are passive data contracts** that entities can possess. They define what properties an entity has, not what it can do.

```typescript
// Example trait
export interface HasHealth {
  hp: number;
  maxHp: number;
}
```

Key principles:
- Traits are **passive** (just data, no methods)
- Traits are **composable** (entities can have multiple traits)
- Traits are **reusable** (any entity can have any trait)
- Systems operate on traits, not entity types

### Entities

**Entities are compositions of traits** that define specific archetypes.

```typescript
// Player entity = base + multiple traits
export type PlayerData = EntityData & {
  type: 'player';
} & HasHealth & CanDealDamage & HasSceneLocation;
```

Key principles:
- Entities are **dumb** (no methods, just data)
- Entities **have** traits (composition, not inheritance)
- Entity types are **examples** (you can define your own)
- Entity type field is a **string tag** for identification

### Systems

**Systems contain all logic** and operate on traits, not entity types.

```typescript
// System works with ANY entity that has health trait
class HealthSystem implements GameSystem {
  update(context: GameContext): void {
    for (const pos of context.spatial.getAllPositions()) {
      const entity = context.spatial.getEntityData(pos.entityId);
      
      // Check for trait, not entity type
      if (hasHealth(entity)) {
        if (entity.hp <= 0) {
          context.spatial.removeEntity(pos.entityId);
        }
      }
    }
  }
}
```

Key principles:
- Systems **understand traits** (generic logic)
- Systems **don't care about entity types** (flexible)
- Systems use **type guards** to check for traits

## Architecture

```
Entity (Dumb Data)
  ├── id: number
  ├── type: string (tag)
  └── traits: { hp, damage, aiState, ... } (passive properties)

System (Smart Logic)
  └── operates on traits → modifies entity data
```

**Data flows one way**: Systems read traits, modify data, update entity store.

## File Organization

```
packages/spartan/entities/
├── traits.ts           # Trait interfaces (HasHealth, CanDealDamage, etc.)
├── entity-types.ts     # Entity archetypes (PlayerData, EnemyData, etc.)
├── trait-guards.ts     # Type guards for traits and entities
├── spawn-helpers.ts    # Type-safe spawn functions
└── README.md           # This file
```

## Usage Patterns

### Pattern 1: Type-Safe Spawning

```typescript
import { spawnPlayer, spawnEnemy } from './entities/spawn-helpers';

// TypeScript enforces all required trait properties
const playerId = spawnPlayer(spatial, 5, 5, {
  hp: 100,
  maxHp: 100,
  damage: 10,
  sceneId: 'room1'
  // ✅ TypeScript error if any required property is missing
});

const enemyId = spawnEnemy(spatial, 10, 10, {
  hp: 50,
  maxHp: 50,
  damage: 5,
  aiState: 'idle'
});
```

### Pattern 2: Generic System Logic (Trait-Based)

```typescript
import { hasHealth, canDealDamage } from './traits/trait-guards';

class DamageSystem implements GameSystem {
  update(context: GameContext): void {
    for (const overlap of context.overlaps) {
      const [id1, id2] = overlap.entityIds;
      const e1 = context.spatial.getEntityData(id1);
      const e2 = context.spatial.getEntityData(id2);
      
      // Works with ANY entity that has these traits
      if (canDealDamage(e1) && hasHealth(e2)) {
        e2.hp -= e1.damage; // Type-safe!
        context.spatial.setEntityData(id2, { hp: e2.hp });
      }
    }
  }
}
```

### Pattern 3: Specific System Logic (Type-Based)

```typescript
import { isPlayer, isTeleporter } from './traits/trait-guards';

class TeleporterSystem implements GameSystem {
  update(context: GameContext): void {
    for (const overlap of context.overlaps) {
      let player = null;
      let teleporter = null;
      
      for (const id of overlap.entityIds) {
        const entity = context.spatial.getEntityData(id);
        
        if (isPlayer(entity)) player = { id, data: entity };
        if (isTeleporter(entity)) teleporter = { id, data: entity };
      }
      
      if (player && teleporter) {
        // Type-safe: player.data is PlayerData, teleporter.data is TeleporterData
        this.handleTeleport(player, teleporter);
      }
    }
  }
}
```

### Pattern 4: Raw Spawning (Dynamic Properties)

```typescript
// When you need flexibility (e.g., deserialization)
const entityId = spatial.spawn('custom_entity', x, y, layer, {
  customProp1: 'value',
  customProp2: 42,
  // Any properties allowed
});
```

## Defining Custom Traits

Game developers can define their own traits following this pattern:

### Step 1: Define Trait Interface

```typescript
// my-game/traits.ts
export interface HasInventory {
  inventory: Map<string, number>;
}

export interface HasMana {
  mana: number;
  maxMana: number;
  manaRegen: number;
}

export interface HasFaction {
  faction: 'ally' | 'enemy' | 'neutral';
}
```

### Step 2: Create Type Guards

```typescript
// my-game/trait-guards.ts
import type { EntityData } from '@spartan';
import type { HasInventory, HasMana, HasFaction } from './traits';

export function hasInventory(e: EntityData): e is EntityData & HasInventory {
  return (e as any).inventory instanceof Map;
}

export function hasMana(e: EntityData): e is EntityData & HasMana {
  return typeof (e as any).mana === 'number' &&
         typeof (e as any).maxMana === 'number' &&
         typeof (e as any).manaRegen === 'number';
}

export function hasFaction(e: EntityData): e is EntityData & HasFaction {
  const faction = (e as any).faction;
  return faction === 'ally' || faction === 'enemy' || faction === 'neutral';
}
```

### Step 3: Define Entity Archetypes

```typescript
// my-game/entity-types.ts
import type { EntityData } from '@spartan';
import type { HasHealth, CanDealDamage } from '@spartan';
import type { HasInventory, HasMana, HasFaction } from './traits';

// Compose traits into archetypes
export type MageData = EntityData & {
  type: 'mage';
} & HasHealth & CanDealDamage & HasMana & HasInventory & HasFaction;

export type WarriorData = EntityData & {
  type: 'warrior';
} & HasHealth & CanDealDamage & HasInventory & HasFaction;
```

### Step 4: Create Systems Using Traits

```typescript
// my-game/systems/mana-system.ts
import type { GameSystem, GameContext } from '@spartan';
import { hasMana } from '../trait-guards';

export class ManaSystem implements GameSystem {
  update(context: GameContext): void {
    // Works with ANY entity that has mana trait
    for (const pos of context.spatial.getAllPositions()) {
      const entity = context.spatial.getEntityData(pos.entityId);
      
      if (hasMana(entity)) {
        // Regenerate mana each tick
        entity.mana = Math.min(entity.maxMana, entity.mana + entity.manaRegen);
        context.spatial.setEntityData(pos.entityId, { mana: entity.mana });
      }
    }
  }
}
```

## Built-in Traits

The framework provides common trait examples in `traits.ts`:

| Trait | Properties | Used By |
|-------|-----------|---------|
| `HasHealth` | hp, maxHp | Health systems, damage systems, UI |
| `CanDealDamage` | damage | Damage systems, combat systems |
| `HasAI` | aiState | AI systems, behavior trees |
| `HasSceneLocation` | sceneId | Scene management, save/load |
| `HasTeleportTarget` | targetKey | Teleporter systems, portal systems |

## Built-in Entity Archetypes

The framework provides example archetypes in `entity-types.ts`:

| Entity | Traits | Typical Usage |
|--------|--------|---------------|
| `PlayerData` | HasHealth + CanDealDamage + HasSceneLocation | Player character |
| `EnemyData` | HasHealth + CanDealDamage + HasAI | AI enemies |
| `TeleporterData` | HasTeleportTarget + HasSceneLocation | Scene transitions |
| `ItemData` | itemType property | Collectibles, power-ups |
| `WallData` | Minimal (id + type) | Blocking terrain |

**These are examples!** You can:
- Use them as-is for prototyping
- Extend them with additional traits
- Define completely custom entity archetypes

## Design Philosophy

### Why Traits Instead of Components?

**Components** (ECS pattern):
- Active objects with lifecycle
- Separate storage and management
- Component managers, iteration systems
- More indirection, more complexity

**Traits** (Spartan pattern):
- Passive data contracts
- Stored directly on entity
- Simple type guards for checking
- Minimal, explicit, direct

### Why Dumb Entities?

**Dumb entities** = entities have no methods, just data.

Benefits:
- Testable: Pure data in, pure data out
- Serializable: Just JSON
- Debuggable: Inspect properties directly
- Flexible: Any property combination allowed
- Spartan: No hidden behavior

All intelligence lives in **systems**, not entities.

### Trait vs Entity Type

Use **trait guards** when:
- System works with any entity having the trait
- Generic, reusable logic
- Flexibility is key

Use **entity type guards** when:
- System needs specific entity archetype
- Accessing multiple traits together
- Type safety for full contract

```typescript
// Generic (trait-based)
if (hasHealth(entity)) {
  entity.hp -= 10; // Works with players, enemies, destructible walls, etc.
}

// Specific (type-based)
if (isPlayer(entity)) {
  entity.damage += 5; // Only works with players
  entity.sceneId = 'newRoom'; // Access all player traits
}
```

## Best Practices

### ✅ DO

- Define traits for reusable concepts (health, damage, inventory)
- Compose entity archetypes from multiple traits
- Use trait guards in systems for generic logic
- Keep entities dumb (no methods)
- Put all logic in systems

### ❌ DON'T

- Add methods to entity types (violates dumb entity principle)
- Make traits depend on each other (keep them independent)
- Use inheritance (use composition via intersection types)
- Put game logic in entity definitions (belongs in systems)
- Nest traits inside entity types (define traits separately)

## Examples

### Example 1: Health System (Generic)

```typescript
import { hasHealth } from './traits/trait-guards';

class HealthSystem implements GameSystem {
  update(context: GameContext): void {
    // Works with ANY entity that has health
    for (const pos of context.spatial.getAllPositions()) {
      const entity = context.spatial.getEntityData(pos.entityId);
      
      if (hasHealth(entity)) {
        if (entity.hp <= 0) {
          context.spatial.removeEntity(pos.entityId);
        }
      }
    }
  }
}
```

### Example 2: Damage System (Trait Combination)

```typescript
import { hasHealth, canDealDamage } from './traits/trait-guards';

class DamageSystem implements GameSystem {
  update(context: GameContext): void {
    for (const overlap of context.overlaps) {
      if (overlap.entityIds.length < 2) continue;
      
      for (const id1 of overlap.entityIds) {
        for (const id2 of overlap.entityIds) {
          if (id1 === id2) continue;
          
          const attacker = context.spatial.getEntityData(id1);
          const target = context.spatial.getEntityData(id2);
          
          if (canDealDamage(attacker) && hasHealth(target)) {
            target.hp -= attacker.damage;
            context.spatial.setEntityData(id2, { hp: target.hp });
          }
        }
      }
    }
  }
}
```

### Example 3: Player-Specific System (Type-Based)

```typescript
import { isPlayer } from './traits/trait-guards';

class PlayerInputSystem implements GameSystem {
  update(context: GameContext): void {
    const input = getPlayerInput(); // Your input handler
    
    for (const pos of context.spatial.getAllPositions()) {
      const entity = context.spatial.getEntityData(pos.entityId);
      
      // Only works with player entities
      if (isPlayer(entity)) {
        if (input.attack) {
          entity.damage += 5; // Type-safe: knows player has damage
        }
      }
    }
  }
}
```

## Extending the System

To add new game-specific traits:

1. **Define trait interface** in your game code
2. **Create type guard** for runtime checking
3. **Compose entity types** using your traits
4. **Write systems** that operate on your traits

You don't need to modify the Spartan framework - extend it in your game code!

```typescript
// my-game/traits/stealth-trait.ts
export interface HasStealth {
  stealthLevel: number;
  isHidden: boolean;
}

// my-game/guards/stealth-guards.ts
export function hasStealth(e: EntityData): e is EntityData & HasStealth {
  return typeof (e as any).stealthLevel === 'number' &&
         typeof (e as any).isHidden === 'boolean';
}

// my-game/entities/rogue.ts
export type RogueData = EntityData & {
  type: 'rogue';
} & HasHealth & CanDealDamage & HasStealth;

// my-game/systems/stealth-system.ts
export class StealthSystem implements GameSystem {
  update(context: GameContext): void {
    for (const pos of context.spatial.getAllPositions()) {
      const entity = context.spatial.getEntityData(pos.entityId);
      
      if (hasStealth(entity)) {
        // Stealth logic here
      }
    }
  }
}
```

## FAQ

### Q: Why not use an ECS (Entity Component System)?

**A:** ECS components are active objects with lifecycle and management overhead. Spartan traits are passive data contracts with zero runtime cost. ECS violates the "minimal" principle.

### Q: Can an entity have traits not in its archetype?

**A:** Yes! The base EntityData type allows arbitrary properties via `[key: string]: unknown`. Archetypes define recommended patterns, but entities can extend beyond them.

```typescript
// Archetype defines common traits
const playerId = spawnPlayer(spatial, 5, 5, {
  hp: 100,
  maxHp: 100,
  damage: 10,
  sceneId: 'room1'
});

// Can add custom properties dynamically
const playerData = spatial.getEntityData(playerId);
spatial.setEntityData(playerId, { 
  ...playerData,
  customProp: 'value',
  questProgress: 5
});
```

### Q: How do I know what traits an entity has at runtime?

**A:** Use type guards! They check for trait possession structurally.

```typescript
const entity = spatial.getEntityData(entityId);

if (hasHealth(entity)) {
  // Now TypeScript knows entity has hp and maxHp
  console.log(`HP: ${entity.hp}/${entity.maxHp}`);
}
```

### Q: Should I always use spawn helpers?

**A:** No! Spawn helpers are for convenience and type safety. Use them when:
- Entity contract is known at compile time
- You want IDE autocomplete
- You want TypeScript validation

Use raw `spatial.spawn()` when:
- Deserializing saved games
- Properties are dynamic
- You need flexibility

### Q: Can traits depend on other traits?

**A:** Traits should be independent! This keeps them composable and reusable. If you find traits depending on each other, consider:
- Combining them into one trait
- Creating a composite entity archetype
- Rethinking the abstraction

## Benefits

**Type Safety**: Compile-time checking prevents typos and missing properties

**Organization**: Traits group related properties, systems focus on specific concerns

**Flexibility**: Mix and match traits freely, define custom combinations

**Reusability**: Generic system logic works with any entity having the trait

**Maintainability**: Self-documenting interfaces, IDE autocomplete, clear contracts

**Spartan**: Zero runtime overhead, minimal abstractions, explicit checks

## Summary

The trait system enables **composition over inheritance** with **passive data contracts**.

- Entities are **dumb** (just property bags with traits)
- Traits are **passive** (data contracts, no behavior)
- Systems are **smart** (all logic, operates on traits)
- Type guards are **explicit** (runtime structural checks)

This keeps the Spartan framework **minimal** while providing **type safety** and **organizational clarity**.
