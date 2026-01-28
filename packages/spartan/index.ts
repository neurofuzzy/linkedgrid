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

// Types and layer constants
export type { EntityData, Layer, Position, GameLayer } from './types';
export { 
    GameLayers, 
    BLOCKING_LAYERS, 
    VISION_BLOCKING_LAYERS, 
    GAMEPLAY_VISIBLE_LAYERS,
    ALL_LAYERS 
} from './types';

// Capability interfaces and entity types
export type {
    HasHealth,
    CanDealDamage,
    HasAI,
    HasSceneLocation,
    HasTeleportTarget,
    PlayerData,
    EnemyData,
    TeleporterData,
    ItemData,
    WallData
} from './types';

// Type guards
export {
    hasHealth,
    canDealDamage,
    hasAI,
    hasSceneLocation,
    hasTeleportTarget,
    isPlayer,
    isEnemy,
    isTeleporter,
    isItem,
    isWall,
    isPlayerWithHealth,
    isEnemyWithAI,
    isTeleporterWithTarget
} from './capability-guards';

// Spawn helpers
export {
    spawnPlayer,
    spawnEnemy,
    spawnTeleporter,
    spawnItem,
    spawnWall,
    spawnPlayerWithId
} from './spawn-helpers';

// Blocking utilities
// Layer utilities
export { getTopmostEntity, isBlocked, blocksVision, isWalkable } from './layer-helpers';

// Game loop and runtime
export { GameLoop } from './game-loop.js';
export { GameRuntime } from './game-runtime.js';
export type { GameRuntimeConfig } from './game-runtime.js';

// Systems
export { TeleporterSystem } from './systems/teleporter-system.js';
export type { GameSystem, GameContext, Overlap } from './types.js';
