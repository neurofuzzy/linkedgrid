/**
 * Core types for the Spartan game framework.
 *
 * Architecture B: Cell-Centric with Sparse Entities
 * - Entities stored primarily in cell.values[] layers
 * - Minimal external data for entity properties
 * - Spatial operations are first-class
 */

/**
 * Minimal entity data stored externally in SparseEntityStore.
 *
 * The ID is stored in cell.values[layer] for spatial operations.
 * This object holds non-spatial metadata about the entity.
 *
 * @example
 * ```typescript
 * const entityData: EntityData = {
 *   id: 1,
 *   type: 'player',
 *   hp: 100,
 *   damage: 10
 * };
 * ```
 */
export type EntityData = {
  /** Unique numeric ID (auto-generated) */
  id: number;

  /** Entity type identifier (e.g., 'player', 'enemy', 'projectile') */
  type: string;

  /** Extensible properties for game-specific data */
  [key: string]: unknown;
};

/**
 * Entity Traits and Archetypes
 *
 * Game-specific entity patterns (traits, archetypes, guards, spawn helpers)
 * are organized in the entities/ subdirectory.
 *
 * See:
 * - entities/traits.ts - Trait interfaces (HasHealth, CanDealDamage, etc.)
 * - entities/entity-types.ts - Entity archetypes (PlayerData, EnemyData, etc.)
 * - entities/trait-guards.ts - Type guards for traits and entities
 * - entities/spawn-helpers.ts - Type-safe spawn functions
 * - entities/README.md - Full documentation on the trait system
 */

/**
 * Layer index in cell arrays.
 *
 * The Spartan Framework uses a fixed 8-layer architecture with semantic meaning.
 * See GameLayers constant for the standard layer assignments.
 *
 * Conceptually, higher layer indexes are "on top of" lower ones (Rule 8).
 *
 * Cell array usage:
 * - cell.values[] - Static terrain/state data
 * - cell.values[] - Entity IDs (Architecture B pattern)
 * - cell.masks[] - Boolean flags (walkability, vision blocking)
 * - cell.distances[] - Pathfinding/influence maps
 */
export type Layer = number;

/**
 * Grid position coordinates.
 *
 * 0-indexed (x, y) coordinates in the grid.
 * - x: column index (0 to width-1)
 * - y: row index (0 to height-1)
 */
export type Position = {
  x: number;
  y: number;
};

/**
 * Overlap - Position where multiple entities exist.
 *
 * Used by overlap detection to identify cells with 2+ entities
 * across all layers (e.g., player on teleporter pad).
 */
export interface Overlap {
  position: { x: number; y: number };
  entityIds: number[];
}

/**
 * GameContext - Context passed to systems each tick.
 *
 * Provides systems with overlap data and spatial access.
 * Optional references for cross-scene operations.
 */
export interface GameContext {
  overlaps: Overlap[];
  spatial: any; // SpatialSystem - avoid circular import
  sceneManager?: any; // SceneManager - optional for cross-scene operations
  gameManager?: any; // GameManager - optional for scene transitions
}

/**
 * GameSystem - Interface for game logic systems.
 *
 * Systems implement game rules by responding to overlaps and
 * staging movement intents each tick.
 *
 * @example
 * ```typescript
 * class EnemyAISystem implements GameSystem {
 *   update(context: GameContext): void {
 *     // Read overlaps, stage moves via context.spatial.move()
 *   }
 * }
 * ```
 */
export interface GameSystem {
  update(context: GameContext): void;
}
