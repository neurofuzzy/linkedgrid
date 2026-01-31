/**
 * Core types for the Spartan game framework.
 *
 * Architecture B: Cell-Centric with Sparse Entities
 * - Entities stored primarily in cell.values[] layers
 * - Minimal external data for entity properties
 * - Spatial operations are first-class
 */

import type { EntityData } from '../entities/entity.types';
export { EntityData };

/**
 * Entity Traits and Archetypes
 *
 * Game-specific entity patterns (traits, archetypes, guards, spawn helpers)
 * are organized in the entities/ subdirectory.
 *
 * See:
 * - entities/traits.ts - Trait interfaces (HasHealth, CanDealDamage, etc.)
 * - entities/entity-types.ts - Entity archetypes (PlayerData, EnemyData, etc.)
 * - traits/trait-guards.ts - Type guards for traits and entities
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
  spatial: {
    grid: { width: number; height: number };
    spawn: (type: string, x: number, y: number, layer: number, data?: Record<string, unknown>) => number;
    move: (entityId: number, x: number, y: number) => void;
    destroy: (entityId: number) => void;
    getEntityPosition: (entityId: number) => { x: number; y: number; layer: number } | null;
    getEntitiesInCell: (x: number, y: number) => number[];
    getEntitiesInLayer: (layer: number) => number[];
    commitPendingActions: () => void;
    commit: () => void; // Alias for commitPendingActions
  };
  sceneManager?: {
    getScene: (id: string) => unknown;
    getActiveScene: () => unknown;
  };
  gameManager?: {
    gameState: {
      playerEntityId: number;
      entityStore: {
        getData: (id: number) => EntityData | undefined;
        setData: (id: number, data: Partial<EntityData>) => void;
      };
    };
    movePlayerToScene: (sceneId: string, x: number, y: number, layer: number) => void;
  };
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
}/**
 * Spartan Framework Layer Constants
 *
 * All games use these 9 semantic layers.
 * Each layer has a specific purpose in game design.
 *
 * Layer meanings:
 * - BACKGROUND (0): Static background visuals, decorative elements
 * - FLOOR (1): Walkable terrain (grass, stone, dirt)
 * - FLOOR_EFFECTS (2): Fire, acid pools, damage zones on floor surface
 * - LOGIC (3): Invisible AI helpers, spawn points, triggers (editor-only visibility)
 * - COLLECTIBLES (4): Items that can be picked up (non-blocking)
 * - WALLS (5): Static blocking elements, doors
 * - ACTORS (6): Dynamic moving entities (players, enemies, NPCs)
 * - EPHEMERALS (7): Temporary effects, projectiles, permanent decals
 * - TEXT (8): UI overlays, HUD elements (always on top)
 *
 * @see specs/spartan-layer-rules.md for full specification
 */
export const GameLayers = {
  BACKGROUND: 0,
  FLOOR: 1,
  FLOOR_EFFECTS: 2,
  LOGIC: 3,
  COLLECTIBLES: 4,
  WALLS: 5,
  ACTORS: 6,
  EPHEMERALS: 7,
  TEXT: 8,
} as const;
/**
 * Type representing a valid game layer value.
 */

export type GameLayer = (typeof GameLayers)[keyof typeof GameLayers];
/**
 * Layers that typically block movement.
 * Note: ACTORS only block other ACTORS, not everything.
 * WALLS block all movement.
 */

export const BLOCKING_LAYERS = [GameLayers.WALLS, GameLayers.ACTORS] as const;
/**
 * Layers that typically block vision/line-of-sight.
 * Used for field-of-view and visibility calculations.
 */

export const VISION_BLOCKING_LAYERS = [GameLayers.WALLS] as const;
/**
 * Layers visible during gameplay.
 * LOGIC layer excluded (only visible in editor/debug mode).
 */

export const GAMEPLAY_VISIBLE_LAYERS = [
  GameLayers.BACKGROUND,
  GameLayers.FLOOR,
  GameLayers.FLOOR_EFFECTS,
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
  GameLayers.FLOOR_EFFECTS,
  GameLayers.LOGIC,
  GameLayers.COLLECTIBLES,
  GameLayers.WALLS,
  GameLayers.ACTORS,
  GameLayers.EPHEMERALS,
  GameLayers.TEXT,
] as const;
/**
 * Cell Mask Indices
 *
 * LinkedCell has 8 mask slots for boolean flags.
 * These indices define semantic meanings for each mask.
 *
 * Mask meanings:
 * - BLOCKING (0): Cell blocks movement (walls, closed doors, etc. - NOT actors)
 * - VISION_BLOCKING (1): Cell blocks line of sight
 * - [2-7]: Reserved for future use
 *
 * Note: Actors do NOT set the BLOCKING mask - they only block other actors.
 *
 * @see LinkedCell.getMask(), LinkedCell.setMask()
 */

export const CellMasks = {
  BLOCKING: 0,
  VISION_BLOCKING: 1,
} as const;
/**
 * Type representing a valid cell mask index.
 */

export type CellMask = (typeof CellMasks)[keyof typeof CellMasks];

