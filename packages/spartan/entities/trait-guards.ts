/**
 * Type Guards for Entity Traits
 *
 * Provides runtime checks for entity traits and types.
 * Used by systems to safely narrow entity types and access trait properties.
 *
 * Design principles:
 * - Structural checking: Verify properties exist with correct types
 * - Type predicates: Enable TypeScript narrowing
 * - Trait-based: Generic checks work with any entity possessing trait
 * - Type-based: Specific checks for concrete entity archetypes
 *
 * @example
 * ```typescript
 * // Trait-based (generic) - works with any entity having the trait
 * if (hasHealth(entity)) {
 *   entity.hp -= 10; // Type-safe: entity is EntityData & HasHealth
 * }
 *
 * // Type-based (specific) - works only with player archetype
 * if (isPlayer(entity)) {
 *   entity.damage += 5; // Type-safe: entity is PlayerData
 * }
 * ```
 */

import type { EntityData } from '../types.js';
import type {
  HasHealth,
  CanDealDamage,
  HasAI,
  HasSceneLocation,
  HasTeleportTarget,
  HasInventory,
  IsLockable,
  IsCollectible,
  HasColor,
  HasFloorEffect,
} from './traits.js';
import type {
  PlayerData,
  EnemyData,
  TeleporterData,
  ItemData,
  WallData,
  DoorData,
  KeyData,
  LavaData,
  AcidData,
  MedbayData,
  IceData,
  MudData,
} from './entity-types.js';

/**
 * Trait Guards
 *
 * These check if an entity possesses a specific trait.
 * Enable generic system logic that works with any entity having the trait.
 */

/**
 * Check if entity has health trait.
 *
 * Entities with health can take damage and be destroyed.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses health trait (hp and maxHp)
 */
export function hasHealth(
  entity: EntityData
): entity is EntityData & HasHealth {
  return (
    typeof (entity as any).hp === 'number' &&
    typeof (entity as any).maxHp === 'number'
  );
}

/**
 * Check if entity can deal damage.
 *
 * Entities with damage trait can harm other entities.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses damage trait
 */
export function canDealDamage(
  entity: EntityData
): entity is EntityData & CanDealDamage {
  return typeof (entity as any).damage === 'number';
}

/**
 * Check if entity has AI trait.
 *
 * Entities with AI trait can be controlled by autonomous behavior systems.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses AI trait
 */
export function hasAI(entity: EntityData): entity is EntityData & HasAI {
  const state = (entity as any).aiState;
  return state === 'idle' || state === 'chase' || state === 'attack';
}

/**
 * Check if entity tracks scene location.
 *
 * Entities with scene location trait know which scene they belong to.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses scene location trait
 */
export function hasSceneLocation(
  entity: EntityData
): entity is EntityData & HasSceneLocation {
  return typeof (entity as any).sceneId === 'string';
}

/**
 * Check if entity has teleport target trait.
 *
 * Entities with teleport target trait are teleporters with connection keys.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses teleport target trait
 */
export function hasTeleportTarget(
  entity: EntityData
): entity is EntityData & HasTeleportTarget {
  return typeof (entity as any).targetKey === 'string';
}

/**
 * Check if entity has inventory trait.
 *
 * Entities with inventory can hold collected items.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses inventory trait
 */
export function hasInventory(
  entity: EntityData
): entity is EntityData & HasInventory {
  return Array.isArray((entity as any).inventory);
}

/**
 * Check if entity is lockable.
 *
 * Entities with lockable trait can be locked/unlocked with keys.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses lockable trait
 */
export function isLockable(
  entity: EntityData
): entity is EntityData & IsLockable {
  return (
    typeof (entity as any).isLocked === 'boolean' &&
    typeof (entity as any).requiredKey === 'string'
  );
}

/**
 * Check if entity is collectible.
 *
 * Entities with collectible trait can be picked up.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses collectible trait
 */
export function isCollectible(
  entity: EntityData
): entity is EntityData & IsCollectible {
  return (
    typeof (entity as any).collectibleType === 'string' &&
    typeof (entity as any).collectibleId === 'string'
  );
}

/**
 * Check if entity has color trait.
 *
 * Entities with color trait have a display color for rendering.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses color trait
 */
export function hasColor(
  entity: EntityData
): entity is EntityData & HasColor {
  return typeof (entity as any).color === 'string';
}

/**
 * Check if entity has floor effect trait.
 *
 * Entities with floor effect trait provide gameplay effects when entities stand on them.
 *
 * @param entity - Entity to check
 * @returns true if entity possesses floor effect trait
 */
export function hasFloorEffect(
  entity: EntityData
): entity is EntityData & HasFloorEffect {
  const effectType = (entity as any).effectType;
  return (
    effectType === 'damage' ||
    effectType === 'heal' ||
    effectType === 'slide' ||
    effectType === 'slow'
  );
}

/**
 * Entity Type Guards
 *
 * These check for specific entity archetypes and narrow to full type contracts.
 * Use when system needs the complete entity archetype definition.
 */

/**
 * Check if entity is a player.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'player'
 */
export function isPlayer(entity: EntityData): entity is PlayerData {
  return entity.type === 'player';
}

/**
 * Check if entity is an enemy.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'enemy'
 */
export function isEnemy(entity: EntityData): entity is EnemyData {
  return entity.type === 'enemy';
}

/**
 * Check if entity is a teleporter.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'teleporter'
 */
export function isTeleporter(entity: EntityData): entity is TeleporterData {
  return entity.type === 'teleporter';
}

/**
 * Check if entity is an item.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'item'
 */
export function isItem(entity: EntityData): entity is ItemData {
  return entity.type === 'item';
}

/**
 * Check if entity is a wall.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'wall'
 */
export function isWall(entity: EntityData): entity is WallData {
  return entity.type === 'wall';
}

/**
 * Check if entity is a door.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'door'
 */
export function isDoor(entity: EntityData): entity is DoorData {
  return entity.type === 'door';
}

/**
 * Check if entity is a key.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'key'
 */
export function isKey(entity: EntityData): entity is KeyData {
  return entity.type === 'key';
}

/**
 * Check if entity is lava.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'lava'
 */
export function isLava(entity: EntityData): entity is LavaData {
  return entity.type === 'lava';
}

/**
 * Check if entity is acid.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'acid'
 */
export function isAcid(entity: EntityData): entity is AcidData {
  return entity.type === 'acid';
}

/**
 * Check if entity is medbay.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'medbay'
 */
export function isMedbay(entity: EntityData): entity is MedbayData {
  return entity.type === 'medbay';
}

/**
 * Check if entity is ice.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'ice'
 */
export function isIce(entity: EntityData): entity is IceData {
  return entity.type === 'ice';
}

/**
 * Check if entity is mud.
 *
 * @param entity - Entity to check
 * @returns true if entity type is 'mud'
 */
export function isMud(entity: EntityData): entity is MudData {
  return entity.type === 'mud';
}

/**
 * Combined Trait + Type Guards
 *
 * Convenience guards that check both entity type and trait possession.
 * More strict verification - useful for critical operations.
 */

/**
 * Check if entity is a player with health trait.
 *
 * More strict than isPlayer() - also verifies health trait exists.
 *
 * @param entity - Entity to check
 * @returns true if entity is player type and possesses health trait
 */
export function isPlayerWithHealth(entity: EntityData): entity is PlayerData {
  return isPlayer(entity) && hasHealth(entity);
}

/**
 * Check if entity is an enemy with AI trait.
 *
 * More strict than isEnemy() - also verifies AI trait exists.
 *
 * @param entity - Entity to check
 * @returns true if entity is enemy type and possesses AI trait
 */
export function isEnemyWithAI(entity: EntityData): entity is EnemyData {
  return isEnemy(entity) && hasAI(entity);
}

/**
 * Check if entity is a teleporter with target trait.
 *
 * More strict than isTeleporter() - also verifies teleport target trait exists.
 *
 * @param entity - Entity to check
 * @returns true if entity is teleporter type and possesses teleport target trait
 */
export function isTeleporterWithTarget(
  entity: EntityData
): entity is TeleporterData {
  return isTeleporter(entity) && hasTeleportTarget(entity);
}
