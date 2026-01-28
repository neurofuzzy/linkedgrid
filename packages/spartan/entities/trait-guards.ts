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
} from './traits.js';
import type {
  PlayerData,
  EnemyData,
  TeleporterData,
  ItemData,
  WallData,
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
