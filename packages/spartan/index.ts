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
 * spatial.move(10, 10, 11, 10, 1);
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
  isPlayer,
  isEnemy,
  isTeleporter,
  isItem,
  isWall,
  isDoor,
  isKey,
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
export { GameLoop } from './game-loop.js';
export { GameRuntime } from './game-runtime.js';
export type { GameRuntimeConfig } from './game-runtime.js';

// Systems
export { TeleporterSystem } from './systems/teleporter-system.js';
export { CollectionSystem } from './systems/collection-system.js';
export { DoorSystem } from './systems/door-system.js';
export { PlayerInputSystem } from './systems/player-input-system.js';
export type { GameSystem, GameContext, Overlap } from './types.js';
