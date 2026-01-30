/**
 * Spartan Framework - Cell-centric game framework built on LinkedGrid
 *
 * Architecture B: Sparse entity system with spatial-first operations.
 *
 * Core principles:
 * - Entities stored primarily in cell layers
 * - Minimal external metadata storage
 * - Spatial queries are first-class
 * - Rule-based entity interactions
 *
 * @example
 * ```typescript
 * import { LinkedGrid } from '../grid';
 * import { SparseEntityStore, SpatialSystem } from '@spartan';
 *
 * const grid = new LinkedGrid(20, 20);
 * const store = new SparseEntityStore();
 * const spatial = new SpatialSystem(grid, store);
 *
 * // Spawn entities
 * const player = spatial.spawn('player', 10, 10, 1, { hp: 100 });
 * const enemy = spatial.spawn('enemy', 15, 10, 2, { hp: 50 });
 *
 * // Move entities
 * const entityId = spatial.getEntityIdAt(10, 10, 1);
 * if (entityId) spatial.move(entityId, 11, 10);
 *
 * // Spatial queries
 * const nearby = spatial.getEntityIdsInRadius(11, 10, 5);
 * ```
 */

// Core framework
export { SparseEntityStore } from './entity-store';
export { SpatialSystem } from './spatial-system';
export { GameState } from './game-state';
export { Scene } from './scene';
export { SceneManager } from './scene-manager';
export { GameManager } from './game-manager';

// Core framework types
export type { EntityData, Layer, Position } from './types';
export {
  GameLayer,
  GameLayers,
  BLOCKING_LAYERS,
  VISION_BLOCKING_LAYERS,
  GAMEPLAY_VISIBLE_LAYERS,
  ALL_LAYERS,
  CellMask,
  CellMasks,
} from './layers/types';

// Layers

/**
 * Entity Traits and Archetypes
 *
 * Trait-based entity system for composable, type-safe entity patterns.
 *
 * - Traits: Passive data contracts (HasHealth, CanDealDamage, etc.)
 * - Entities: Archetypes composed of traits (PlayerData, EnemyData, etc.)
 * - Guards: Runtime type guards for traits and entity types
 * - Helpers: Type-safe spawn functions for entity archetypes
 *
 * See entities/README.md for full documentation.
 */

// Entity traits (passive data contracts)
export type {
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
} from './entities/traits';

// Entity archetypes (example patterns)
export type {
  PlayerData,
  EnemyData,
  TeleporterData,
  ItemData,
  WallData,
  DoorData,
  KeyData,
  OpenDoorData,
  LavaData,
  AcidData,
  MedbayData,
  IceData,
  MudData,
  FireData,
  PoisonGasData,
  WaterData,
  AshData,
  GrassData,
  GasolineData,
  FuseData,
  TorchData,
  BarrelData,
  ExplosionVisualData,
  DestructibleWallData,
} from './entities/entity-types';

// Trait guards (runtime checks)
export {
  hasHealth,
  canDealDamage,
  hasAI,
  hasSceneLocation,
  hasTeleportTarget,
  hasInventory,
  isLockable,
  isCollectible,
  hasColor,
  hasFloorEffect,
  hasPropagation,
  hasFlammability,
  hasExplosion,
  hasDamageable,
  isPlayer,
  isEnemy,
  isTeleporter,
  isItem,
  isWall,
  isDoor,
  isKey,
  isLava,
  isAcid,
  isMedbay,
  isIce,
  isMud,
  isFire,
  isPoisonGas,
  isWater,
  isAsh,
  isGrass,
  isGasoline,
  isFuse,
  isTorch,
  isBarrel,
  isExplosionVisual,
  isDestructibleWall,
  isPlayerWithHealth,
  isEnemyWithAI,
  isTeleporterWithTarget,
} from './entities/trait-guards';

// Spawn helpers (type-safe entity creation)
export {
  spawnPlayer,
  spawnEnemy,
  spawnTeleporter,
  spawnItem,
  spawnWall,
  spawnPlayerWithId,
} from './entities/spawn-helpers';

// Layer utilities (for visual/rendering helpers)
// For spatial queries, use SpatialSystem methods: spatial.isBlocked(), spatial.blocksVision(), spatial.isWalkable()
export { getTopmostEntity } from './layers/layer-helpers';

// Game loop and runtime
export { GameLoop } from './game-loop';
export { GameRuntime } from './game-runtime';
export type { GameRuntimeConfig } from './game-runtime';

// Systems
export { TeleporterSystem } from './systems/teleporter-system';
export { CollectionSystem } from './systems/collection-system';
export { DoorSystem } from './systems/door-system';
export { PlayerInputSystem } from './systems/player-input-system';
export { FloorEffectSystem } from './systems/floor-effect-system';
export { PropagationSystem } from './systems/propagation-system';
export { ExplosionSystem } from './systems/explosion-system';
export type { GameSystem, GameContext, Overlap } from './types';
