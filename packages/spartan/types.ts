/**
 * Core types for the Spartan game framework.
 *
 * Architecture B: Cell-Centric with Sparse Entities
 * - Entities stored primarily in cell.values[] layers
 * - Minimal external data for entity properties
 * - Spatial operations are first-class
 */

import type {
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
  ChainLinkData,
  FireVisualData,
} from './entities/entity-types';

/**
 * EntityData - Discriminated union of all entity types.
 *
 * This type system provides compile-time type safety through discriminated unions.
 * The `type` property acts as the discriminant, enabling TypeScript to automatically
 * narrow types when using type guards.
 *
 * Benefits:
 * - Automatic type narrowing through type guards (isPlayer, isDoor, etc.)
 * - IDE autocomplete for entity-specific properties
 * - Compile-time validation of property access
 * - Exhaustiveness checking in switch statements
 *
 * @example
 * ```typescript
 * const entity = spatial.getEntityData(id);
 * 
 * if (isPlayer(entity)) {
 *   // TypeScript automatically narrows to PlayerData
 *   entity.hp;        // ✓ number
 *   entity.inventory; // ✓ string[]
 *   entity.aiState;   // ✗ TypeScript error - doesn't exist on PlayerData
 * }
 * ```
 */
export type EntityData =
  | PlayerData
  | EnemyData
  | TeleporterData
  | ItemData
  | WallData
  | DoorData
  | KeyData
  | OpenDoorData
  | LavaData
  | AcidData
  | MedbayData
  | IceData
  | MudData
  | PoisonGasData
  | WaterData
  | AshData
  | GrassData
  | GasolineData
  | FuseData
  | TorchData
  | BarrelData
  | ExplosionVisualData
  | DestructibleWallData
  | ChainLinkData
  | FireVisualData;

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
  spatial: {
    grid: { width: number; height: number };
    spawn: (type: string, x: number, y: number, layer: number, data?: Record<string, unknown>) => number;
    move: (entityId: number, x: number, y: number) => void;
    destroy: (entityId: number) => void;
    getEntityPosition: (entityId: number) => { x: number; y: number; layer: number } | null;
    getEntitiesInCell: (x: number, y: number) => number[];
    getEntitiesInLayer: (layer: number) => number[];
    commitPendingActions: () => void;
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
}
