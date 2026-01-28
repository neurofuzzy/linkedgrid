/**
 * Type Guards for Entity Capabilities
 * 
 * Provides runtime checks for entity capabilities and types.
 * Used by systems to safely narrow entity types and access properties.
 * 
 * Design principles:
 * - Structural checking: Verify properties exist with correct types
 * - Type predicates: Enable TypeScript narrowing
 * - Capability-based: Generic checks work with any entity
 * - Type-based: Specific checks for concrete entity types
 * 
 * @example
 * ```typescript
 * // Capability-based (generic)
 * if (hasHealth(entity)) {
 *   entity.hp -= 10; // Type-safe: entity is EntityData & HasHealth
 * }
 * 
 * // Type-based (specific)
 * if (isPlayer(entity)) {
 *   entity.damage += 5; // Type-safe: entity is PlayerData
 * }
 * ```
 */

import type {
    EntityData,
    HasHealth,
    CanDealDamage,
    HasAI,
    HasSceneLocation,
    HasTeleportTarget,
    PlayerData,
    EnemyData,
    TeleporterData,
    ItemData,
    WallData,
} from './types.js';

/**
 * Capability Type Guards
 * 
 * These check for specific capabilities regardless of entity type.
 * Enables generic system logic that works with any entity.
 */

/**
 * Check if entity has health capability.
 * 
 * Entities with health can take damage and be destroyed.
 * 
 * @param entity - Entity to check
 * @returns true if entity has hp and maxHp properties
 */
export function hasHealth(entity: EntityData): entity is EntityData & HasHealth {
    return (
        typeof (entity as any).hp === 'number' &&
        typeof (entity as any).maxHp === 'number'
    );
}

/**
 * Check if entity can deal damage.
 * 
 * Entities with damage capability can harm other entities.
 * 
 * @param entity - Entity to check
 * @returns true if entity has damage property
 */
export function canDealDamage(entity: EntityData): entity is EntityData & CanDealDamage {
    return typeof (entity as any).damage === 'number';
}

/**
 * Check if entity has AI state.
 * 
 * Entities with AI can be controlled by autonomous behavior systems.
 * 
 * @param entity - Entity to check
 * @returns true if entity has aiState property
 */
export function hasAI(entity: EntityData): entity is EntityData & HasAI {
    const state = (entity as any).aiState;
    return state === 'idle' || state === 'chase' || state === 'attack';
}

/**
 * Check if entity tracks scene location.
 * 
 * Entities with scene location know which scene they belong to.
 * 
 * @param entity - Entity to check
 * @returns true if entity has sceneId property
 */
export function hasSceneLocation(entity: EntityData): entity is EntityData & HasSceneLocation {
    return typeof (entity as any).sceneId === 'string';
}

/**
 * Check if entity has teleport target.
 * 
 * Entities with teleport target are teleporters with connection keys.
 * 
 * @param entity - Entity to check
 * @returns true if entity has targetKey property
 */
export function hasTeleportTarget(entity: EntityData): entity is EntityData & HasTeleportTarget {
    return typeof (entity as any).targetKey === 'string';
}

/**
 * Entity Type Guards
 * 
 * These check for specific entity types and narrow to full type contracts.
 * Use when system needs the complete entity type definition.
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
 * Combined Type Guards
 * 
 * Convenience guards that check both type and capabilities.
 * Useful for systems that need specific entity types with verified capabilities.
 */

/**
 * Check if entity is a player with health.
 * 
 * More strict than isPlayer() - also verifies health properties exist.
 * 
 * @param entity - Entity to check
 * @returns true if entity is player type with health capability
 */
export function isPlayerWithHealth(entity: EntityData): entity is PlayerData {
    return isPlayer(entity) && hasHealth(entity);
}

/**
 * Check if entity is an enemy with AI.
 * 
 * More strict than isEnemy() - also verifies AI state exists.
 * 
 * @param entity - Entity to check
 * @returns true if entity is enemy type with AI capability
 */
export function isEnemyWithAI(entity: EntityData): entity is EnemyData {
    return isEnemy(entity) && hasAI(entity);
}

/**
 * Check if entity is a teleporter with target.
 * 
 * More strict than isTeleporter() - also verifies target key exists.
 * 
 * @param entity - Entity to check
 * @returns true if entity is teleporter type with teleport target capability
 */
export function isTeleporterWithTarget(entity: EntityData): entity is TeleporterData {
    return isTeleporter(entity) && hasTeleportTarget(entity);
}
