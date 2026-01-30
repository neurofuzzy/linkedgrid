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
