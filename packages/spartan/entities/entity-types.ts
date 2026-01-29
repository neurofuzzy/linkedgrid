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
  HasFloorEffect,
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

/**
 * OpenDoorData - Visual representation of an unlocked door.
 *
 * Spawned when a locked door is unlocked, placed on FLOOR layer for visual feedback.
 * Does not block movement (unlike locked DoorData on WALLS layer).
 *
 * Traits:
 * - HasColor: Display color matching the original door
 *
 * @example
 * ```typescript
 * // Spawned by DoorSystem when door unlocked
 * spatial.spawn('open-door', x, y, GameLayers.FLOOR, {
 *   color: doorData.color
 * });
 * ```
 */
export type OpenDoorData = EntityData & {
  type: 'open-door';
} & HasColor;

/**
 * LavaData - Damaging floor hazard.
 *
 * Traits:
 * - HasFloorEffect - Applies damage over time
 * - HasColor - Visual color for rendering
 *
 * Typical usage:
 * - Lava pools
 * - Fire pits
 * - Hazardous terrain
 *
 * @example
 * ```typescript
 * const lavaId = spatial.spawn('lava', 5, 5, GameLayers.FLOOR, {
 *   effectType: 'damage',
 *   damage: 10,
 *   cadence: 1000,  // Damage every 1 second
 *   color: '#ff6b35'
 * });
 * ```
 */
export type LavaData = EntityData & {
  type: 'lava';
} & HasFloorEffect & HasColor;

/**
 * AcidData - Corrosive floor hazard.
 *
 * Traits:
 * - HasFloorEffect - Applies damage over time
 * - HasColor - Visual color for rendering
 *
 * Typical usage:
 * - Acid pools
 * - Toxic waste
 * - Chemical spills
 *
 * @example
 * ```typescript
 * const acidId = spatial.spawn('acid', 8, 3, GameLayers.FLOOR, {
 *   effectType: 'damage',
 *   damage: 5,
 *   cadence: 500,  // Damage every 0.5 seconds (faster than lava)
 *   color: '#7dce82'
 * });
 * ```
 */
export type AcidData = EntityData & {
  type: 'acid';
} & HasFloorEffect & HasColor;

/**
 * MedbayData - Healing floor effect.
 *
 * Traits:
 * - HasFloorEffect - Restores health over time
 * - HasColor - Visual color for rendering
 *
 * Typical usage:
 * - Healing pads
 * - Medbay stations
 * - Regeneration zones
 *
 * @example
 * ```typescript
 * const medbayId = spatial.spawn('medbay', 2, 2, GameLayers.FLOOR, {
 *   effectType: 'heal',
 *   healRate: 5,
 *   cadence: 1000,  // Heal every 1 second
 *   cooldown: 3000,  // 3 second cooldown between heal applications
 *   color: '#4ec9b0'
 * });
 * ```
 */
export type MedbayData = EntityData & {
  type: 'medbay';
} & HasFloorEffect & HasColor;

/**
 * IceData - Slippery floor that causes sliding.
 *
 * Traits:
 * - HasFloorEffect - Modifies movement (slide)
 * - HasColor - Visual color for rendering
 *
 * Typical usage:
 * - Ice patches
 * - Slippery surfaces
 * - Momentum puzzles
 *
 * @example
 * ```typescript
 * const iceId = spatial.spawn('ice', 10, 10, GameLayers.FLOOR, {
 *   effectType: 'slide',
 *   slideDistance: 2,  // Continue moving 2 cells in same direction
 *   color: '#9cdcfe'
 * });
 * ```
 */
export type IceData = EntityData & {
  type: 'ice';
} & HasFloorEffect & HasColor;

/**
 * MudData - Sticky floor that slows movement.
 *
 * Traits:
 * - HasFloorEffect - Modifies movement (slow)
 * - HasColor - Visual color for rendering
 *
 * Typical usage:
 * - Mud patches
 * - Quicksand
 * - Sticky terrain
 *
 * @example
 * ```typescript
 * const mudId = spatial.spawn('mud', 7, 7, GameLayers.FLOOR, {
 *   effectType: 'slow',
 *   slowFactor: 0.5,  // 50% chance to move (or skip every other move)
 *   color: '#8b6914'
 * });
 * ```
 */
export type MudData = EntityData & {
  type: 'mud';
} & HasFloorEffect & HasColor;
