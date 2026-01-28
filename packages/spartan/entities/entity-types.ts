/**
 * Entity Type Archetypes
 *
 * Entity types are compositions of traits that define specific game archetypes.
 * These serve as examples and starting templates for common entity patterns.
 *
 * Design:
 * - Entity = base EntityData + trait compositions
 * - Type field is literal string for discrimination
 * - Each entity type documents its purpose and trait composition
 *
 * Game developers can:
 * - Use these archetypes as-is
 * - Extend them with additional traits
 * - Define completely custom entity types
 *
 * @example
 * ```typescript
 * // Use archetype as-is
 * import { PlayerData } from './entities/entity-types';
 * const player: PlayerData = {
 *   id: 1,
 *   type: 'player',
 *   hp: 100,
 *   maxHp: 100,
 *   damage: 10,
 *   sceneId: 'room1'
 * };
 *
 * // Define custom entity type
 * import { HasHealth, CanDealDamage } from './entities/traits';
 * type BossData = EntityData & {
 *   type: 'boss';
 * } & HasHealth & CanDealDamage & {
 *   phase: number;
 *   enraged: boolean;
 * };
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
} from './traits.js';

/**
 * PlayerData - Player-controlled entity.
 *
 * Traits:
 * - HasHealth - Can take damage and be destroyed
 * - CanDealDamage - Can damage other entities
 * - HasSceneLocation - Tracks which scene player is in
 * - HasInventory - Can collect and hold items
 *
 * Typical usage:
 * - Player character in action/adventure games
 * - Controllable unit in strategy games
 * - Avatar in RPGs
 *
 * @example
 * ```typescript
 * const playerId = spawnPlayer(spatial, 5, 5, {
 *   hp: 100,
 *   maxHp: 100,
 *   damage: 10,
 *   sceneId: 'room1',
 *   inventory: []
 * });
 * ```
 */
export type PlayerData = EntityData & {
  type: 'player';
} & HasHealth &
  CanDealDamage &
  HasSceneLocation &
  HasInventory;

/**
 * EnemyData - AI-controlled hostile entity.
 *
 * Traits:
 * - HasHealth - Can take damage and be destroyed
 * - CanDealDamage - Can damage player
 * - HasAI - Autonomous behavior state
 *
 * Typical usage:
 * - Enemies in action games
 * - Monsters in RPGs
 * - AI units in strategy games
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
export type EnemyData = EntityData & {
  type: 'enemy';
} & HasHealth &
  CanDealDamage &
  HasAI;

/**
 * TeleporterData - Portal entity for scene transitions.
 *
 * Traits:
 * - HasTeleportTarget - Connection key for destination lookup
 * - HasSceneLocation - Tracks which scene teleporter is in
 *
 * Additional properties:
 * - destination - Target scene and coordinates for teleportation
 * - teleporterState - State tracking for preventing bounce-back (optional)
 *
 * Typical usage:
 * - Portals between rooms
 * - Warp pads
 * - Scene transition triggers
 *
 * @example
 * ```typescript
 * const teleporterId = spawnTeleporter(spatial, 5, 7, {
 *   targetKey: 'red_portal',
 *   sceneId: 'room1',
 *   destination: {
 *     sceneId: 'room2',
 *     x: 3,
 *     y: 3,
 *     layer: GameLayers.ACTORS
 *   }
 * });
 * ```
 */
export type TeleporterData = EntityData & {
  type: 'teleporter';
  destination?: {
    sceneId: string;
    x: number;
    y: number;
    layer: number;
  };
  teleporterState?: 'ready' | 'inactive';
} & HasTeleportTarget &
  HasSceneLocation;

/**
 * ItemData - Collectible or interactive object.
 *
 * Additional properties:
 * - itemType - Specific item identifier (e.g., 'health_potion', 'key')
 *
 * Typical usage:
 * - Collectibles
 * - Power-ups
 * - Keys and quest items
 * - Interactable objects
 *
 * @example
 * ```typescript
 * const itemId = spawnItem(spatial, 11, 11, {
 *   itemType: 'health_potion'
 * });
 *
 * // Can extend with custom properties
 * const keyId = spatial.spawn('item', 5, 5, GameLayers.COLLECTIBLES, {
 *   itemType: 'key',
 *   keyColor: 'red',
 *   unlocks: 'red_door'
 * });
 * ```
 */
export type ItemData = EntityData & {
  type: 'item';
  itemType: string;
};

/**
 * WallData - Static blocking terrain.
 *
 * Minimal entity - just ID and type tag.
 *
 * Typical usage:
 * - Walls and barriers
 * - Blocking obstacles
 *
 * @example
 * ```typescript
 * const wallId = spawnWall(spatial, 10, 5);
 * ```
 */
export type WallData = EntityData & {
  type: 'wall';
};

/**
 * DoorData - Lockable door entity.
 *
 * Traits:
 * - IsLockable - Can be locked/unlocked with a key
 * - HasColor - Visual color for rendering
 *
 * Typical usage:
 * - Locked doors requiring keys
 * - Puzzle barriers
 * - Gated areas
 *
 * @example
 * ```typescript
 * const doorId = spatial.spawn('door', 10, 10, GameLayers.WALLS, {
 *   color: 'red',
 *   isLocked: true,
 *   requiredKey: 'red-key'
 * });
 * ```
 */
export type DoorData = EntityData & {
  type: 'door';
} & IsLockable &
  HasColor;

/**
 * KeyData - Collectible key entity.
 *
 * Traits:
 * - IsCollectible - Can be picked up and added to inventory
 * - HasColor - Visual color for rendering
 *
 * Typical usage:
 * - Keys for locked doors
 * - Collectible items
 * - Puzzle pieces
 *
 * @example
 * ```typescript
 * const keyId = spatial.spawn('key', 5, 5, GameLayers.COLLECTIBLES, {
 *   color: 'red',
 *   collectibleType: 'key',
 *   collectibleId: 'red-key'
 * });
 * ```
 */
export type KeyData = EntityData & {
  type: 'key';
} & IsCollectible &
  HasColor;
