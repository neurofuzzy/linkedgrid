# Architecture Decision Record: Entity Type Safety Improvement

**Date:** January 30, 2026  
**Status:** Proposed  
**Component:** Entity System (SparseEntityStore, Type Guards, Spawn Helpers)  
**Author:** Software Architecture Review

---

## Executive Summary

The current entity type system uses a loosely-typed approach with `[key: string]: unknown`, which defeats TypeScript's type safety guarantees. This ADR proposes migrating to a discriminated union type system that provides:

- **Compile-time type safety** for entity properties
- **Automatic type narrowing** through type guards
- **IDE autocomplete** for entity-specific properties
- **Exhaustiveness checking** for entity type handling

This change will eliminate an entire class of runtime errors while maintaining the flexibility needed for the tick-based, deterministic game engine architecture.

---

## Problem Statement

### Current Implementation

The entity data type is currently defined as:

```typescript
export type EntityData = {
  id: number;
  type: string;
  [key: string]: unknown;  // ❌ No type safety
};
```

### Issues with Current Approach

#### 1. **Zero Type Safety**

```typescript
const player = spatial.getEntityData(playerId);
// TypeScript knows: player is EntityData
// TypeScript doesn't know: player.hp exists
// TypeScript doesn't know: player.inventory is string[]

// These compile but crash at runtime:
player.hp = "not a number";  // ✓ Compiles
player.invalidProperty = 123;  // ✓ Compiles
const damage = player.damage + 5;  // ✓ Compiles, runtime error
```

#### 2. **No IDE Support**

Developers must memorize which properties belong to which entity types. There is no autocomplete, no documentation on hover, and no compiler assistance.

```typescript
const entity = spatial.getEntityData(id);

if (isPlayer(entity)) {
  entity.  // ← No autocomplete available
  // Developer must remember: hp, maxHp, damage, sceneId, inventory
}
```

#### 3. **Runtime Guards Don't Narrow Types**

Current type guards return `boolean` instead of type predicates:

```typescript
export function isPlayer(entity: EntityData): boolean {
  return entity.type === 'player';
}

// Usage:
if (isPlayer(entity)) {
  // entity is still EntityData, not PlayerEntity
  entity.inventory;  // TypeScript error: Property doesn't exist
}
```

#### 4. **Systems Require Unsafe Casts**

```typescript
// From CollectionSystem:
if (!playerData && isPlayer(entity) && hasInventory(entity)) {
  playerData = entity;  // entity is still just EntityData
  // Must cast or use 'as any' to access properties
  const inventory = (entity as any).inventory;
}
```

#### 5. **No Validation of spawn() Properties**

```typescript
// This compiles but is wrong:
spatial.spawn('player', x, y, layer, {
  hp: "not a number",      // ✓ Compiles, wrong type
  wrongProperty: true,     // ✓ Compiles, doesn't exist
  // Missing required: maxHp, damage, sceneId, inventory
});
```

### Real-World Impact

These issues have led to:

- Runtime errors from accessing undefined properties
- Bugs from passing wrong property types
- Confusion about entity contracts
- Defensive coding with excessive runtime checks
- Difficulty onboarding new developers
- Missing required properties during entity creation

---

## Proposed Solution

### Overview

Replace the loose `EntityData` type with a **discriminated union** of specific entity types, where the `type` property acts as the discriminant.

### Core Type System

```typescript
// Base entity with common properties
type BaseEntity = {
  id: number;
  type: string;
};

// Specific entity types with exact contracts
type PlayerEntity = BaseEntity & {
  type: 'player';
  hp: number;
  maxHp: number;
  damage: number;
  sceneId: string;
  inventory: string[];
};

type EnemyEntity = BaseEntity & {
  type: 'enemy';
  hp: number;
  maxHp: number;
  damage: number;
  aiState: 'idle' | 'chase' | 'attack';
};

type CollectibleEntity = BaseEntity & {
  type: 'collectible';
  collectibleId: string;
};

type DoorEntity = BaseEntity & {
  type: 'door';
  isLocked: boolean;
  requiredKey: string;
  color: string;
};

type TeleporterEntity = BaseEntity & {
  type: 'teleporter';
  targetKey: string;
  sceneId: string;
};

type ItemEntity = BaseEntity & {
  type: 'item';
  itemType: string;
};

type WallEntity = BaseEntity & {
  type: 'wall';
};

// Union type - this becomes the new EntityData
export type EntityData = 
  | PlayerEntity 
  | EnemyEntity 
  | CollectibleEntity
  | DoorEntity
  | TeleporterEntity
  | ItemEntity
  | WallEntity;
```

### Benefits Unlocked

#### 1. **Automatic Type Narrowing**

```typescript
const entity = spatial.getEntityData(id);

if (entity.type === 'player') {
  // TypeScript automatically narrows to PlayerEntity
  entity.hp;        // ✓ number
  entity.inventory; // ✓ string[]
  entity.aiState;   // ✗ TypeScript error - doesn't exist on PlayerEntity
}
```

#### 2. **Type-Safe Guards**

```typescript
export function isPlayer(entity: EntityData): entity is PlayerEntity {
  return entity.type === 'player';
}

export function isEnemy(entity: EntityData): entity is EnemyEntity {
  return entity.type === 'enemy';
}

export function isDoor(entity: EntityData): entity is DoorEntity {
  return entity.type === 'door';
}

// Usage with automatic narrowing:
if (isPlayer(entity)) {
  // entity is now PlayerEntity
  const maxHealth = entity.maxHp;  // ✓ Full type safety
}
```

#### 3. **Exhaustiveness Checking**

```typescript
function handleEntity(entity: EntityData) {
  switch (entity.type) {
    case 'player':
      return handlePlayer(entity);  // entity is PlayerEntity
    case 'enemy':
      return handleEnemy(entity);   // entity is EnemyEntity
    case 'door':
      return handleDoor(entity);    // entity is DoorEntity
    // If we add a new entity type and forget to handle it:
    // TypeScript error: "Type 'NewEntity' not handled"
  }
}
```

#### 4. **IDE Autocomplete**

```typescript
const player = spatial.getEntityData(playerId);

if (isPlayer(player)) {
  player.  // ← IDE shows: hp, maxHp, damage, sceneId, inventory
  //          ← Each with type information and documentation
}
```

---

## Implementation Changes

### 1. Entity Type Definitions

**File:** `entity-types.ts`

```typescript
// Update from:
export type PlayerData = {
  id: number;
  type: 'player';
  hp: number;
  maxHp: number;
  damage: number;
  sceneId: string;
};

// To include inventory:
export type PlayerEntity = {
  id: number;
  type: 'player';
  hp: number;
  maxHp: number;
  damage: number;
  sceneId: string;
  inventory: string[];
};

// Repeat for all entity types, then create union:
export type EntityData = 
  | PlayerEntity 
  | EnemyEntity 
  | CollectibleEntity
  | DoorEntity
  | TeleporterEntity
  | ItemEntity
  | WallEntity;
```

### 2. Type Guards

**File:** `trait-guards.ts`

```typescript
// Update all guards to use type predicates:

export function isPlayer(entity: EntityData): entity is PlayerEntity {
  return entity.type === 'player';
}

export function isEnemy(entity: EntityData): entity is EnemyEntity {
  return entity.type === 'enemy';
}

export function isCollectible(entity: EntityData): entity is CollectibleEntity {
  return entity.type === 'collectible';
}

export function isDoor(entity: EntityData): entity is DoorEntity {
  return entity.type === 'door';
}

export function isTeleporter(entity: EntityData): entity is TeleporterEntity {
  return entity.type === 'teleporter';
}

export function isItem(entity: EntityData): entity is ItemEntity {
  return entity.type === 'item';
}

export function isWall(entity: EntityData): entity is WallEntity {
  return entity.type === 'wall';
}

// Trait-based guards for shared capabilities
export function hasHealth(entity: EntityData): entity is PlayerEntity | EnemyEntity {
  return isPlayer(entity) || isEnemy(entity);
}

export function hasInventory(entity: EntityData): entity is PlayerEntity {
  return isPlayer(entity);
}
```

### 3. SparseEntityStore Enhancement

**File:** `entity-store.ts`

Add type-safe overloads:

```typescript
export class SparseEntityStore {
  // Existing implementation...

  /**
   * Get entity data by ID with optional type checking.
   * 
   * @example
   * const player = store.getData(id, 'player'); // PlayerEntity | undefined
   * const any = store.getData(id);              // EntityData | undefined
   */
  getData(id: number): EntityData | undefined;
  getData<T extends EntityData['type']>(
    id: number, 
    type: T
  ): Extract<EntityData, { type: T }> | undefined;
  getData<T extends EntityData['type']>(
    id: number, 
    type?: T
  ): EntityData | undefined {
    const entity = this.data.get(id);
    if (!entity) return undefined;
    if (type && entity.type !== type) return undefined;
    return entity;
  }

  // Usage examples:
  // const player = store.getData(playerId, 'player');
  // if (player) {
  //   player.hp; // ✓ TypeScript knows this is number
  // }
}
```

### 4. Type-Safe Spawn Helpers

**File:** `spawn-helpers.ts`

Add type mapping for spawn validation:

```typescript
type EntityTypeToProps = {
  'player': Omit<PlayerEntity, 'id' | 'type'>;
  'enemy': Omit<EnemyEntity, 'id' | 'type'>;
  'door': Omit<DoorEntity, 'id' | 'type'>;
  'collectible': Omit<CollectibleEntity, 'id' | 'type'>;
  'teleporter': Omit<TeleporterEntity, 'id' | 'type'>;
  'item': Omit<ItemEntity, 'id' | 'type'>;
  'wall': Omit<WallEntity, 'id' | 'type'>;
  'open-door': { color: string };
};

// Type-safe spawn method signature in SpatialSystem:
spawn<T extends keyof EntityTypeToProps>(
  type: T,
  x: number,
  y: number,
  layer: number,
  props: EntityTypeToProps[T]
): number;

// Now this is caught at compile time:
spatial.spawn('player', x, y, layer, {
  hp: 100,
  maxHp: 100,
  damage: 10,
  sceneId: 'room1',
  // Missing 'inventory' - TypeScript error!
});

// Correct usage:
spatial.spawn('player', x, y, layer, {
  hp: 100,
  maxHp: 100,
  damage: 10,
  sceneId: 'room1',
  inventory: []  // ✓ Required property
});
```

### 5. Entity Type Constants

**File:** `entity-types.ts`

```typescript
export const ENTITY_TYPES = {
  PLAYER: 'player',
  ENEMY: 'enemy',
  DOOR: 'door',
  COLLECTIBLE: 'collectible',
  TELEPORTER: 'teleporter',
  ITEM: 'item',
  WALL: 'wall',
  OPEN_DOOR: 'open-door',
} as const;

export type EntityType = typeof ENTITY_TYPES[keyof typeof ENTITY_TYPES];

// Prevents typos:
spawn(ENTITY_TYPES.PLAYER, ...);  // ✓ Autocomplete available
spawn('playar', ...);              // ✗ TypeScript error
```

---

## Migration Examples

### Before: CollectionSystem

```typescript
update({ overlaps, spatial }: GameContext): void {
  for (const overlap of overlaps) {
    let playerData = null;
    let collectibleData = null;

    for (const entityId of overlap.entityIds) {
      const entity = spatial.getEntityData(entityId);
      if (!entity) continue;

      // No type safety - must use guards
      if (!playerData && isPlayer(entity) && hasInventory(entity)) {
        playerData = entity;  // Still just EntityData
      }

      if (!collectibleData && isCollectible(entity)) {
        collectibleData = entity;  // Still just EntityData
      }

      if (playerData && collectibleData) break;
    }

    if (playerData && collectibleData) {
      // Must cast or use 'as any'
      const updatedInventory = [
        ...(playerData as any).inventory, 
        (collectibleData as any).collectibleId
      ];

      this.gameManager.gameState.entityStore.setData(playerData.id, {
        inventory: updatedInventory,
      });

      spatial.remove(collectibleData.id);
    }
  }
}
```

### After: CollectionSystem

```typescript
update({ overlaps, spatial }: GameContext): void {
  for (const overlap of overlaps) {
    let playerData: PlayerEntity | null = null;
    let collectibleData: CollectibleEntity | null = null;

    for (const entityId of overlap.entityIds) {
      const entity = spatial.getEntityData(entityId);
      if (!entity) continue;

      // Type guard automatically narrows
      if (!playerData && isPlayer(entity)) {
        playerData = entity;  // ✓ PlayerEntity
      }

      if (!collectibleData && isCollectible(entity)) {
        collectibleData = entity;  // ✓ CollectibleEntity
      }

      if (playerData && collectibleData) break;
    }

    if (playerData && collectibleData) {
      // Full type safety - no casts needed
      const updatedInventory = [
        ...playerData.inventory,      // ✓ TypeScript knows: string[]
        collectibleData.collectibleId // ✓ TypeScript knows: string
      ];

      this.gameManager.gameState.entityStore.setData(playerData.id, {
        inventory: updatedInventory,
      });

      spatial.remove(collectibleData.id);
    }
  }
}
```

### Before: DoorSystem

```typescript
if (doorData.isLocked && playerData.inventory.includes(doorData.requiredKey)) {
  // Properties not type-checked - runtime errors possible
  this.gameManager.gameState.entityStore.setData(doorData.id, {
    isLocked: false,
  });

  spatial.removeAt(destCell.x, destCell.y, GameLayers.WALLS);

  spatial.spawn('open-door', destCell.x, destCell.y, GameLayers.FLOOR, {
    color: doorData.color,  // No validation that this exists
  });
}
```

### After: DoorSystem

```typescript
if (doorData.isLocked && playerData.inventory.includes(doorData.requiredKey)) {
  // All properties type-checked
  this.gameManager.gameState.entityStore.setData(doorData.id, {
    isLocked: false,  // ✓ TypeScript validates boolean
  });

  spatial.removeAt(destCell.x, destCell.y, GameLayers.WALLS);

  spatial.spawn('open-door', destCell.x, destCell.y, GameLayers.FLOOR, {
    color: doorData.color,  // ✓ TypeScript validates DoorEntity has color
  });
}
```

---

## Advanced Considerations

### 1. Trait Composition Pattern

For entities sharing capabilities, consider explicit trait types:

```typescript
type HasHealth = { hp: number; maxHp: number };
type HasDamage = { damage: number };
type HasPosition = { x: number; y: number };
type HasAI = { aiState: 'idle' | 'chase' | 'attack' };

type PlayerEntity = BaseEntity & {
  type: 'player';
} & HasHealth & HasDamage & { sceneId: string; inventory: string[] };

type EnemyEntity = BaseEntity & {
  type: 'enemy';
} & HasHealth & HasDamage & HasAI;

// Trait-based guards:
export function hasHealth(entity: EntityData): entity is PlayerEntity | EnemyEntity {
  return 'hp' in entity && 'maxHp' in entity;
}
```

### 2. Two-Phase Commit for Trait Updates

Currently, systems directly mutate entity data via `entityStore.setData()`, which bypasses the two-phase commit pattern used for spatial operations.

**Consideration:** Create a trait update queue similar to spatial operations:

```typescript
class TraitUpdateQueue {
  private updates: Map<number, Partial<EntityData>> = new Map();

  stage(entityId: number, updates: Partial<EntityData>): void {
    const existing = this.updates.get(entityId) || {};
    this.updates.set(entityId, { ...existing, ...updates });
  }

  commit(store: SparseEntityStore): void {
    for (const [id, updates] of this.updates) {
      store.setData(id, updates);
    }
    this.updates.clear();
  }
}

// Usage in systems:
spatial.stageTraitUpdate(playerData.id, { inventory: updatedInventory });
// Committed after all systems update
```

This ensures complete determinism for both spatial and non-spatial entity changes.

### 3. Runtime Validation (Future Enhancement)

While TypeScript provides compile-time safety, runtime validation can catch deserialization issues:

```typescript
import { z } from 'zod';

const PlayerSchema = z.object({
  id: z.number(),
  type: z.literal('player'),
  hp: z.number().min(0),
  maxHp: z.number().min(1),
  damage: z.number().min(0),
  sceneId: z.string(),
  inventory: z.array(z.string()),
});

// Validate during deserialization:
function loadPlayer(data: unknown): PlayerEntity {
  return PlayerSchema.parse(data);
}
```

---

## Compatibility & Migration

### Breaking Changes

- **None** - This is a pure TypeScript change
- Existing JavaScript code continues to work
- Gradual migration is possible

### Migration Strategy

1. **Phase 1:** Add discriminated union types alongside existing `EntityData`
2. **Phase 2:** Update type guards to use type predicates
3. **Phase 3:** Add generic overloads to `SparseEntityStore`
4. **Phase 4:** Update systems to use narrowed types
5. **Phase 5:** Add type-safe spawn helpers
6. **Phase 6:** Remove old `EntityData` type

### Risk Assessment

- **Low Risk:** Pure TypeScript refactor, no runtime changes
- **High Benefit:** Eliminates entire class of bugs
- **Developer Experience:** Significant improvement in IDE support and compile-time feedback

---

## Decision

**Recommendation:** Approve and implement the discriminated union type system for entity data.

### Rationale

1. **Type Safety:** Eliminates runtime errors from property access
2. **Developer Experience:** IDE autocomplete and compile-time validation
3. **Maintainability:** Self-documenting entity contracts
4. **Compatibility:** No breaking changes to existing code
5. **Aligned with Philosophy:** Supports deterministic, tick-based architecture

### Success Metrics

- Zero TypeScript errors related to entity property access
- 100% of entity type guards use type predicates
- All spawn operations type-checked at compile time
- Reduction in runtime property access errors

---

## References

- **TypeScript Handbook:** Discriminated Unions
- **TypeScript Handbook:** Type Guards and Type Predicates
- **Spartan Guidelines:** `GUIDELINES.md` - Deterministic, Tick-Based Philosophy
- **Current Implementation:** `entity-types.ts`, `trait-guards.ts`, `entity-store.ts`

---

## Appendix: Complete Type System Example

```typescript
// entity-types.ts

type BaseEntity = {
  id: number;
  type: string;
};

export type PlayerEntity = BaseEntity & {
  type: 'player';
  hp: number;
  maxHp: number;
  damage: number;
  sceneId: string;
  inventory: string[];
};

export type EnemyEntity = BaseEntity & {
  type: 'enemy';
  hp: number;
  maxHp: number;
  damage: number;
  aiState: 'idle' | 'chase' | 'attack';
};

export type CollectibleEntity = BaseEntity & {
  type: 'collectible';
  collectibleId: string;
};

export type DoorEntity = BaseEntity & {
  type: 'door';
  isLocked: boolean;
  requiredKey: string;
  color: string;
};

export type TeleporterEntity = BaseEntity & {
  type: 'teleporter';
  targetKey: string;
  sceneId: string;
};

export type ItemEntity = BaseEntity & {
  type: 'item';
  itemType: string;
};

export type WallEntity = BaseEntity & {
  type: 'wall';
};

export type EntityData = 
  | PlayerEntity 
  | EnemyEntity 
  | CollectibleEntity
  | DoorEntity
  | TeleporterEntity
  | ItemEntity
  | WallEntity;

export const ENTITY_TYPES = {
  PLAYER: 'player',
  ENEMY: 'enemy',
  DOOR: 'door',
  COLLECTIBLE: 'collectible',
  TELEPORTER: 'teleporter',
  ITEM: 'item',
  WALL: 'wall',
} as const;

export type EntityType = typeof ENTITY_TYPES[keyof typeof ENTITY_TYPES];
```
