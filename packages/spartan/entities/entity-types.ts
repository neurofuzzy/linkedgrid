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

import type { EntityData } from '../types';
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
  HasPropagation,
  HasFlammability,
  HasExplosion,
  HasDamageable,
} from './traits';

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
 *   triggerMode: 'continuous',  // Optional - inferred from effectType if omitted
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
 *   triggerMode: 'continuous',  // Optional - inferred from effectType if omitted
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
 *   triggerMode: 'continuous',  // Optional - inferred from effectType if omitted
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
 *   triggerMode: 'on-entry',  // Optional - inferred from effectType if omitted
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
 *   triggerMode: 'on-entry',  // Optional - inferred from effectType if omitted
 *   color: '#8b6914'
 * });
 * ```
 */
export type MudData = EntityData & {
  type: 'mud';
} & HasFloorEffect & HasColor;

/**
 * FireData - Spreading fire that damages entities.
 *
 * Traits:
 * - HasPropagation - Spreads probabilistically to adjacent cells
 * - HasFloorEffect - Deals damage over time
 * - HasColor - Visual color for rendering
 *
 * Typical usage:
 * - Fire spreading through areas (consuming effect)
 * - Burning terrain
 * - Temporary hazards that expire
 *
 * @example
 * ```typescript
 * const fireId = spatial.spawn('fire', 10, 10, GameLayers.FLOOR_EFFECTS, {
 *   propagationType: 'fire',
 *   spreadRate: 2,                 // Spread every 2 ticks
 *   spreadProbability: 0.6,        // 60% chance per neighbor (realistic consuming)
 *   spreadLayer: GameLayers.FLOOR_EFFECTS,
 *   spreadType: 'fire',
 *   // No maxDistance - fire spread is limited by flammable materials
 *   lifetime: 20,                  // Burns for 20 ticks
 *   blockedByLayers: [GameLayers.WALLS],
 *   effectType: 'damage',
 *   triggerMode: 'continuous',
 *   damage: 5,
 *   cadence: 2,                    // Damage every 2 ticks
 *   color: '#ff6b35'
 * });
 * ```
 */
export type FireData = EntityData & {
  type: 'fire';
} & HasPropagation & HasFloorEffect & HasColor;

/**
 * PoisonGasData - Expanding poison gas cloud.
 *
 * Traits:
 * - HasPropagation - Spreads to adjacent cells (deterministic)
 * - HasFloorEffect - Deals damage over time
 * - HasColor - Visual color for rendering
 *
 * Typical usage:
 * - Poison gas attacks
 * - Environmental hazards
 * - Area denial effects
 *
 * @example
 * ```typescript
 * const gasId = spatial.spawn('poison-gas', 5, 5, GameLayers.EPHEMERALS, {
 *   propagationType: 'gas',
 *   spreadRate: 1,                      // Spread every tick (fast)
 *   spreadLayer: GameLayers.EPHEMERALS,
 *   spreadType: 'poison-gas',
 *   maxDistance: 8,
 *   lifetime: 15,                       // Dissipates after 15 ticks
 *   blockedByLayers: [GameLayers.WALLS],
 *   effectType: 'damage',
 *   triggerMode: 'continuous',
 *   damage: 2,
 *   cadence: 3,                         // Damage every 3 ticks
 *   color: '#9acd32'
 * });
 * ```
 */
export type PoisonGasData = EntityData & {
  type: 'poison-gas';
} & HasPropagation & HasFloorEffect & HasColor;

/**
 * WaterData - Flowing liquid.
 *
 * Traits:
 * - HasPropagation - Spreads to adjacent cells (deterministic)
 * - HasColor - Visual color for rendering
 *
 * Typical usage:
 * - Water flow simulation
 * - Liquid hazards
 * - Environmental effects
 *
 * @example
 * ```typescript
 * const waterId = spatial.spawn('water', 7, 3, GameLayers.FLOOR, {
 *   propagationType: 'liquid',
 *   spreadRate: 1,                   // Flows every tick
 *   spreadLayer: GameLayers.FLOOR,
 *   spreadType: 'water',
 *   maxDistance: 10,
 *   blockedByLayers: [GameLayers.WALLS],
 *   color: '#4a90e2'
 *   // No lifetime - water persists
 *   // No spreadProbability - always spreads (deterministic)
 *   // No floor effect - just visual/spreading
 * });
 * ```
 */
export type WaterData = EntityData & {
  type: 'water';
} & HasPropagation & HasColor;

/**
 * AshData - Remains of consumed fire.
 *
 * Traits:
 * - HasColor - Visual color for rendering
 *
 * Typical usage:
 * - Left behind after fire burns out
 * - Prevents fire from spreading to consumed cells
 * - Visual indicator of fire damage
 *
 * @example
 * ```typescript
 * const ashId = spatial.spawn('ash', 10, 5, GameLayers.FLOOR_EFFECTS, {
 *   color: '#4a4a4a'
 * });
 * ```
 */
export type AshData = EntityData & {
  type: 'ash';
} & HasColor;

/**
 * GrassData - Flammable terrain.
 *
 * Traits:
 * - HasFlammability - Can catch fire and burn
 * - HasColor - Visual color for rendering
 *
 * Typical usage:
 * - Flammable ground cover
 * - Fire spreading through fields
 * - Environmental hazards
 *
 * @example
 * ```typescript
 * const grassId = spatial.spawn('grass', 7, 3, GameLayers.FLOOR, {
 *   flammability: 0.8,  // Highly flammable
 *   color: '#7cba00'
 * });
 * ```
 */
export type GrassData = EntityData & {
  type: 'grass';
} & HasFlammability & HasColor;

/**
 * GasolineData - Highly flammable liquid spill.
 *
 * Traits:
 * - HasFlammability - Can catch fire and burn
 * - HasColor - Visual color for rendering
 *
 * Typical usage:
 * - Explosive hazards
 * - Fast-burning trails
 * - Tactical fire spreading
 *
 * @example
 * ```typescript
 * const gasolineId = spatial.spawn('gasoline', 5, 5, GameLayers.COLLECTIBLES, {
 *   flammability: 0.95,  // Extremely flammable
 *   color: '#d4af37'
 * });
 * ```
 */
export type GasolineData = EntityData & {
  type: 'gasoline';
} & HasFlammability & HasColor;

/**
 * FuseData - Designed to burn in sequence.
 *
 * Traits:
 * - HasFlammability - Can catch fire and burn
 * - HasColor - Visual color for rendering
 *
 * Typical usage:
 * - Timed explosions
 * - Puzzle mechanics
 * - Sequential fire spreading
 *
 * @example
 * ```typescript
 * const fuseId = spatial.spawn('fuse', 10, 10, GameLayers.COLLECTIBLES, {
 *   flammability: 0.99,  // Nearly guaranteed to ignite
 *   color: '#ff4500'
 * });
 * ```
 */
export type FuseData = EntityData & {
  type: 'fuse';
} & HasFlammability & HasColor;

/**
 * TorchData - Static ignition source.
 *
 * Traits:
 * - HasColor - Visual color for rendering
 *
 * Typical usage:
 * - Fire starting points
 * - Environmental lighting
 * - Ignition sources for flammable materials
 *
 * @example
 * ```typescript
 * const torchId = spatial.spawn('torch', 3, 3, GameLayers.WALLS, {
 *   color: '#ff6b35'
 * });
 * ```
 */
export type TorchData = EntityData & {
  type: 'torch';
} & HasColor;

/**
 * BarrelData - Explosive container.
 *
 * Traits:
 * - HasHealth - Can take damage and be destroyed
 * - HasExplosion - Explodes when triggered
 * - HasFlammability - Can catch fire
 *
 * Typical usage:
 * - Destructible explosive hazards
 * - Chain reaction triggers
 * - Environmental traps
 *
 * @example
 * ```typescript
 * const barrelId = spatial.spawn('barrel', 10, 10, GameLayers.COLLECTIBLES, {
 *   hp: 20,
 *   maxHp: 20,
 *   explosionDamage: 30,
 *   explosionRadius: 4,
 *   triggerCondition: 'on-death',  // Explodes when destroyed
 *   flammability: 0.7,  // Can also catch fire and explode
 *   color: '#8B4513'
 * });
 * ```
 */
export type BarrelData = EntityData & {
  type: 'barrel';
} & HasHealth & HasExplosion & HasFlammability & HasColor;

/**
 * ExplosionVisualData - Temporary explosion visual effect.
 *
 * Traits:
 * - HasColor - Visual color for rendering
 *
 * Typical usage:
 * - Visual feedback for explosions
 * - Brief flash at explosion epicenter
 * - Auto-despawns after lifetime
 *
 * @example
 * ```typescript
 * const visualId = spatial.spawn('explosion-visual', 8, 8, GameLayers.EPHEMERALS, {
 *   lifetime: 2,  // Lasts 2 ticks
 *   color: '#ff6600'
 * });
 * ```
 */
export type ExplosionVisualData = EntityData & {
  type: 'explosion-visual';
  lifetime: number;  // Ticks before auto-despawn
} & HasColor;

/**
 * DestructibleWallData - Wall that can be damaged and destroyed.
 *
 * Traits:
 * - HasHealth - Can take damage and be destroyed
 * - HasDamageable - Requires minimum damage threshold
 * - HasColor - Visual color for rendering
 *
 * Typical usage:
 * - Walls that break from explosions
 * - Secret passages revealed by damage
 * - Environmental destruction
 *
 * @example
 * ```typescript
 * const wallId = spatial.spawn('destructible-wall', 5, 5, GameLayers.WALLS, {
 *   hp: 50,
 *   maxHp: 50,
 *   hardness: 20,  // Immune to weak attacks, vulnerable to explosions
 *   color: '#8b7355'
 * });
 * ```
 */
export type DestructibleWallData = EntityData & {
  type: 'destructible-wall';
} & HasHealth & HasDamageable & HasColor;
