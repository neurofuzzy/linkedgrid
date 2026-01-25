/**
 * Interfaces for LinkedGrid library.
 * 
 * These interfaces break circular dependencies between LinkedCell and LinkedGrid
 * by defining the minimal contract each needs from the other.
 */

import { Direction } from './direction';

/**
 * Minimal interface for a grid that LinkedCell can reference.
 * LinkedCell only needs cell lookup and dimensions.
 * 
 * C is the cell type (allows LinkedCell to know it gets LinkedCell back)
 * T is the value type stored in cells
 */
export interface ILinkedGrid<_T, C = unknown> {
    readonly width: number;
    readonly height: number;
    readonly cells: C[];
    cell(x: number, y: number): C | null;
}

/**
 * Minimal interface for a cell that LinkedGrid can reference.
 * Used for neighbor linking and coordinate storage.
 */
export interface ILinkedCell<T> {
    /** Grid coordinates */
    x: number;
    y: number;

    /** Typed game state values, one per layer */
    values: T[];

    /** Numeric values for distance fields, pathfinding costs, etc. */
    distances: number[];

    /** Boolean masks for collision, visibility, etc. */
    masks: boolean[];

    /** Set a neighbor in a direction */
    setNeighbor(dir: Direction, cell: ILinkedCell<T> | null): this;

    /** Get a neighbor in a direction */
    neighbor(dir: Direction): ILinkedCell<T> | null;

    /** Set value at layer */
    setValue(layer: number, val: T): this;
}

/**
 * Minimal interface for LinkedGridView.
 * Used for coordinate conversion and cell access.
 */
export interface ILinkedGridView<T> {
    readonly width: number;
    readonly height: number;
    readonly offsetX: number;
    readonly offsetY: number;

    cell(vx: number, vy: number): ILinkedCell<T> | null;
    setOffset(x: number, y: number): this;
    centerOn(x: number, y: number): this;
    toViewport(wx: number, wy: number): { vx: number; vy: number } | null;
    toWorld(vx: number, vy: number): { wx: number; wy: number };
}

/**
 * Interface for entities that live on a LinkedGrid.
 * Entities are dynamic game objects (players, enemies, projectiles)
 * that can move between cells.
 * 
 * @deprecated Use the new ECS system instead (`packages/ecs`).
 * 
 * The ECS architecture provides:
 * - Better composability via components instead of inheritance
 * - Efficient queries and spatial lookups via `SpatialQuerySystem`
 * - Serialization support for save/load
 * - Entity scoping (global/scene/mode) for proper lifecycle management
 * - Integration with `EventBus` for lifecycle events
 * 
 * See `packages/ecs/MIGRATION.md` for migration guide.
 * See `packages/ecs/SPEC.md` for full ECS documentation.
 * 
 * @typeParam T - Entity type identifier (e.g., 'player' | 'enemy')
 */
export interface ILinkedEntity<T = unknown> {
    /** Unique entity ID */
    readonly id: number;

    /** Current grid position */
    x: number;
    y: number;

    /** Entity type identifier */
    readonly type: T;

    /** Whether the entity is active */
    active: boolean;

    /**
     * Move in a direction if not blocked.
     * @returns true if movement succeeded
     */
    move(dir: Direction): boolean;

    /**
     * Move to specific coordinates if not blocked.
     * @returns true if movement succeeded
     */
    moveTo(x: number, y: number): boolean;

    /** Get the cell at current position */
    cell(): ILinkedCell<unknown> | null;

    /** Spawn at a position */
    spawn(x: number, y: number): void;

    /** Mark entity as inactive */
    destroy(): void;
}
