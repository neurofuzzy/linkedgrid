/**
 * Type-Safe Entity Spawn Helpers
 *
 * Provides typed helper functions for spawning entity archetypes with compile-time
 * property validation. These functions wrap SpatialSystem.spawn() with
 * strongly-typed interfaces.
 *
 * Benefits:
 * - Type safety: TypeScript enforces all required trait properties
 * - IDE autocomplete: Trait properties are discoverable
 * - Documentation: Clear contracts for each entity archetype
 * - Non-breaking: Raw spawn() still available for flexibility
 *
 * Usage:
 * - Use these helpers when entity contract is known at compile time
 * - Use raw spawn() when properties are dynamic or deserialized
 *
 * @example
 * ```typescript
 * // Type-safe spawn with compile-time validation
 * const playerId = spawnPlayer(spatial, 5, 5, {
 *   hp: 100,
 *   maxHp: 100,
 *   damage: 10,
 *   sceneId: 'room1'
 * }); // TypeScript enforces all required trait properties
 *
 * // Raw spawn still works (for flexibility)
 * const enemyId = spatial.spawn('enemy', 10, 10, GameLayers.ACTORS, {
 *   hp: 50,
 *   maxHp: 50,
 *   damage: 5,
 *   aiState: 'idle'
 * });
 * ```
 */

import type { SpatialSystem } from '../spatial-system';
import { GameLayers } from "../core/types";
import type {
  PlayerData,
  EnemyData,
  TeleporterData,
  ItemData,
  WallData,
} from './entity-types';

/**
 * Spawn a player entity with type-safe properties.
 *
 * Automatically places on ACTORS layer (layer 5).
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param props - Player properties (hp, maxHp, damage, sceneId)
 * @returns Entity ID
 *
 * @example
 * ```typescript
 * const playerId = spawnPlayer(spatial, 5, 5, {
 *   hp: 100,
 *   maxHp: 100,
 *   damage: 10,
 *   sceneId: 'room1'
 * });
 * ```
 */
export function spawnPlayer(
  spatial: SpatialSystem,
  x: number,
  y: number,
  props: Omit<PlayerData, 'id' | 'type'>
): number {
  return spatial.spawn('player', x, y, GameLayers.ACTORS, props);
}

/**
 * Spawn an enemy entity with type-safe properties.
 *
 * Automatically places on ACTORS layer (layer 5).
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param props - Enemy properties (hp, maxHp, damage, aiState)
 * @returns Entity ID
 *
 * @example
 * ```typescript
 * const enemyId = spawnEnemy(spatial, 10, 10, {
 *   hp: 50,
 *   maxHp: 50,
 *   damage: 5,
 *   aiState: 'idle'
 * });
 * ```
 */
export function spawnEnemy(
  spatial: SpatialSystem,
  x: number,
  y: number,
  props: Omit<EnemyData, 'id' | 'type'>
): number {
  return spatial.spawn('enemy', x, y, GameLayers.ACTORS, props);
}

/**
 * Spawn a teleporter entity with type-safe properties.
 *
 * Automatically places on FLOOR layer (layer 1).
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param props - Teleporter properties (targetKey, sceneId)
 * @returns Entity ID
 *
 * @example
 * ```typescript
 * const teleporterId = spawnTeleporter(spatial, 5, 7, {
 *   targetKey: 'red',
 *   sceneId: 'room1'
 * });
 * ```
 */
export function spawnTeleporter(
  spatial: SpatialSystem,
  x: number,
  y: number,
  props: Omit<TeleporterData, 'id' | 'type'>
): number {
  return spatial.spawn('teleporter', x, y, GameLayers.FLOOR, props);
}

/**
 * Spawn an item entity with type-safe properties.
 *
 * Automatically places on COLLECTIBLES layer (layer 3).
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param props - Item properties (itemType, and any additional properties)
 * @returns Entity ID
 *
 * @example
 * ```typescript
 * const itemId = spawnItem(spatial, 8, 8, {
 *   itemType: 'health_potion'
 * });
 * ```
 */
export function spawnItem(
  spatial: SpatialSystem,
  x: number,
  y: number,
  props: Omit<ItemData, 'id' | 'type'>
): number {
  return spatial.spawn('item', x, y, GameLayers.COLLECTIBLES, props);
}

/**
 * Spawn a wall entity with type-safe properties.
 *
 * Automatically places on WALLS layer (layer 4).
 *
 * @param spatial - SpatialSystem to spawn in
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param props - Optional additional wall properties
 * @returns Entity ID
 *
 * @example
 * ```typescript
 * const wallId = spawnWall(spatial, 10, 5);
 * ```
 */
export function spawnWall(
  spatial: SpatialSystem,
  x: number,
  y: number,
  props?: Omit<WallData, 'id' | 'type'>
): number {
  return spatial.spawn('wall', x, y, GameLayers.WALLS, props || {});
}

/**
 * Advanced: Spawn player with specific ID (for scene transitions).
 *
 * WARNING: Use sparingly! Only for save/load and scene transitions.
 * Normal spawning should use spawnPlayer() for proper ID management.
 *
 * @param spatial - SpatialSystem to spawn in
 * @param entityId - Specific entity ID to use
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param props - Player properties
 *
 * @example
 * ```typescript
 * // Scene transition: move player entity #42 to new scene
 * spawnPlayerWithId(spatial, 42, 10, 10, {
 *   hp: 100,
 *   maxHp: 100,
 *   damage: 10,
 *   sceneId: 'room2'
 * });
 * ```
 */
export function spawnPlayerWithId(
  spatial: SpatialSystem,
  entityId: number,
  x: number,
  y: number,
  props: Omit<PlayerData, 'id' | 'type'>
): void {
  spatial.spawnWithId(entityId, 'player', x, y, GameLayers.ACTORS, props);
}
