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
} from './traits.js';

/**
 * PlayerData - Player-controlled entity.
 * 
 * Traits:
 * - HasHealth - Can take damage and be destroyed
 * - CanDealDamage - Can damage other entities
 * - HasSceneLocation - Tracks which scene player is in
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
 *   sceneId: 'room1'
 * });
 * ```
 */
export type PlayerData = EntityData & {
    type: 'player';
} & HasHealth & CanDealDamage & HasSceneLocation;

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
} & HasHealth & CanDealDamage & HasAI;

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
} & HasTeleportTarget & HasSceneLocation;

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
 * - Doors (can extend with door-specific properties)
 * - Blocking obstacles
 * 
 * @example
 * ```typescript
 * const wallId = spawnWall(spatial, 10, 5);
 * 
 * // Can extend with custom properties
 * const doorId = spatial.spawn('wall', 8, 8, GameLayers.WALLS, {
 *   doorType: 'locked',
 *   requiredKey: 'red'
 * });
 * ```
 */
export type WallData = EntityData & {
    type: 'wall';
};
