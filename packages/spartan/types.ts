/**
 * Core types for the Spartan game framework.
 * 
 * Architecture B: Cell-Centric with Sparse Entities
 * - Entities stored primarily in cell.items[] layers
 * - Minimal external data for entity properties
 * - Spatial operations are first-class
 */

/**
 * Minimal entity data stored externally in SparseEntityStore.
 * 
 * The ID is stored in cell.items[layer] for spatial operations.
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
 * Layer index in cell arrays.
 * 
 * Layers are dynamic - no hardcoded meanings in the core framework.
 * Games should establish their own layer conventions.
 * 
 * Conceptually, higher layer indexes are "on top of" lower ones (Rule 8).
 * 
 * Recommended usage:
 * - cell.values[] - Static terrain/state data
 * - cell.items[] - Entity IDs (Architecture B pattern)
 * - cell.masks[] - Boolean flags (walkability, vision blocking)
 * - cell.distances[] - Pathfinding/influence maps
 * 
 * @example
 * ```typescript
 * const TERRAIN_LAYER = 0;
 * const PLAYER_LAYER = 1;
 * const ENEMY_LAYER = 2;
 * const PROJECTILE_LAYER = 3;
 * ```
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
