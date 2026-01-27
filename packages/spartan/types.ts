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
 * Spartan Framework Layer Constants
 * 
 * All games use these 8 semantic layers.
 * Each layer has a specific purpose in game design.
 * 
 * Layer meanings:
 * - BACKGROUND (0): Static background visuals, decorative elements
 * - FLOOR (1): Walkable terrain with optional gameplay effects
 * - LOGIC (2): Invisible AI helpers, spawn points, triggers (editor-only visibility)
 * - COLLECTIBLES (3): Items that can be picked up (non-blocking)
 * - WALLS (4): Static blocking elements, doors
 * - ACTORS (5): Dynamic moving entities (players, enemies, NPCs)
 * - EPHEMERALS (6): Temporary effects, projectiles, permanent decals
 * - TEXT (7): UI overlays, HUD elements (always on top)
 * 
 * @see specs/spartan-layer-rules.md for full specification
 */
export const GameLayers = {
    BACKGROUND: 0,
    FLOOR: 1,
    LOGIC: 2,
    COLLECTIBLES: 3,
    WALLS: 4,
    ACTORS: 5,
    EPHEMERALS: 6,
    TEXT: 7,
} as const;

/**
 * Type representing a valid game layer value.
 */
export type GameLayer = typeof GameLayers[keyof typeof GameLayers];

/**
 * Layers that typically block movement.
 * Used for standard blocking logic in games.
 */
export const BLOCKING_LAYERS = [
    GameLayers.WALLS,
    GameLayers.ACTORS,
] as const;

/**
 * Layers that typically block vision/line-of-sight.
 * Used for field-of-view and visibility calculations.
 */
export const VISION_BLOCKING_LAYERS = [
    GameLayers.WALLS,
] as const;

/**
 * Layers visible during gameplay.
 * LOGIC layer excluded (only visible in editor/debug mode).
 */
export const GAMEPLAY_VISIBLE_LAYERS = [
    GameLayers.BACKGROUND,
    GameLayers.FLOOR,
    GameLayers.COLLECTIBLES,
    GameLayers.WALLS,
    GameLayers.ACTORS,
    GameLayers.EPHEMERALS,
    GameLayers.TEXT,
] as const;

/**
 * All layers (for editor mode).
 */
export const ALL_LAYERS = [
    GameLayers.BACKGROUND,
    GameLayers.FLOOR,
    GameLayers.LOGIC,
    GameLayers.COLLECTIBLES,
    GameLayers.WALLS,
    GameLayers.ACTORS,
    GameLayers.EPHEMERALS,
    GameLayers.TEXT,
] as const;

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
    gameManager?: any;  // GameManager - optional for scene transitions
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
