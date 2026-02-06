/**
 * Core types for the Spartan game framework.
 *
 * Architecture B: Cell-Centric with Sparse Entities
 * - Entities stored primarily in cell.values[] layers
 * - Minimal external data for entity properties
 * - Spatial operations are first-class
 */

import type { EntityData } from '../entities/entity.types';
import type { ExecutionPhase } from '../config/systems.config';
import { LinkedCell, LinkedGrid } from './grid';
export type { EntityData, ExecutionPhase };

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
 * See GameLayers constant in config/layers.config.ts for standard assignments.
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
 * Pending operation types for unified transaction model.
 */
export interface PendingOperation {
  type: 'move' | 'remove' | 'spawn';
  entityId?: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  x?: number;
  y?: number;
  layer: Layer;
  blockFn?: (cell: LinkedCell | null) => boolean;
  typeStr?: string;
  props?: object;
}

/**
 * SpawnIntent - Request to spawn an entity from a source.
 *
 * Used by SpawningSystem to validate and process spawn requests.
 * Prevents runaway spawning by tracking source, deduping by cell+layer+tick,
 * and rejecting intents from dead sources.
 */
export interface SpawnIntent {
  /** Entity ID requesting the spawn (must be alive) */
  sourceId: number;
  /** Type of entity to spawn (e.g., 'enemy', 'homing-missile') */
  entityType: string;
  /** Layer to spawn on */
  layer: Layer;
  /** Optional entity properties */
  props?: Record<string, unknown>;
  /** Optional preferred spawn location */
  preferredCell?: { x: number; y: number };
}

/**
 * EntityLifecycleEvent - Event emitted when entities are spawned or removed.
 *
 * Used by systems that need to react to entity lifecycle changes.
 * Ephemeral entities (projectiles, visual effects) skip these events for performance.
 */
export interface EntityLifecycleEvent {
  /** Entity ID that was spawned or removed */
  entityId: number;
  /** Entity type (e.g., 'enemy', 'spawner') */
  type: string;
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
  /** Layer the entity was on */
  layer: Layer;
}

/**
 * LifecycleCallback - Function signature for lifecycle event handlers.
 */
export type LifecycleCallback = (event: EntityLifecycleEvent) => void;

/**
 * GameContext - Context passed to systems each tick.
 *
 * Provides systems with overlap data and spatial access.
 * Optional references for cross-scene operations.
 */
export interface GameContext {
  /** Current tick count (increments each game loop iteration) */
  tick?: number;
  overlaps: Overlap[];
  spatial: {
    grid: {
      width: number;
      height: number;
      cell: (x: number, y: number) => LinkedCell | null;
      isValid: (x: number, y: number) => boolean;
    };
    spawn: (
      type: string,
      x: number,
      y: number,
      layer: number,
      data?: Record<string, unknown>
    ) => number;
    spawnWithId: (
      entityId: number,
      type: string,
      x: number,
      y: number,
      layer: number,
      data?: Record<string, unknown>
    ) => boolean;
    move: (entityId: number, x: number, y: number) => void;
    remove: (entityId: number) => void;
    removeAt: (x: number, y: number, layer: number) => boolean;
    getEntityPosition: (
      entityId: number
    ) => { x: number; y: number; layer: number } | null;
    getEntityIdsInCell: (x: number, y: number) => number[];
    commit: () => void;
    getEntityData: (entityId: number) => EntityData | undefined;
    getEntityIdAt: (x: number, y: number, layer: number) => number | undefined;
    getAllPositions: () => IterableIterator<
      [number, { x: number; y: number; layer: number }]
    >;
    getEntityIdsInRadius: (x: number, y: number, radius: number) => number[];
    isBlocked: (cell: LinkedCell | null) => boolean;
    blocksVision: (cell: LinkedCell | null) => boolean;
    isWalkable: (cell: LinkedCell | null) => boolean;
    isAlive: (entityId: number) => boolean;
    getPendingOps: () => ReadonlyArray<PendingOperation>;
    cancelMove: (entityId: number) => void;
    onSpawn: (callback: LifecycleCallback) => () => void;
    onRemove: (callback: LifecycleCallback) => () => void;
    getPosition: (id: number) => { x: number; y: number; layer: number } | null;
    getGrid: () => LinkedGrid;
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
    movePlayerToScene: (
      sceneId: string,
      x: number,
      y: number,
      layer: number
    ) => void;
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
  /**
   * Execution phase for automatic ordering.
   * Systems are sorted by phase before execution:
   * - 'input': Runs first (e.g., PlayerInputSystem)
   * - 'pre-commit': Reacts to intents before validation (e.g., PushSystem, DoorSystem)
   * - 'main': Core game logic (e.g., FireSystem, ExplosionSystem)
   * - 'post-commit': Reacts to committed changes (e.g., CollectionSystem, TeleporterSystem)
   *
   * Systems without this property default to 'main' phase.
   */
  readonly executionPhase?: ExecutionPhase;
}
