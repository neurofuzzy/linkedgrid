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
 */
export interface ILinkedGrid<C = unknown> {
    readonly width: number;
    readonly height: number;
    readonly cells: C[];
    cell(x: number, y: number): C | null;
}

/**
 * Minimal interface for a cell that LinkedGrid can reference.
 * Used for neighbor linking and coordinate storage.
 * All values are constrained to numbers.
 */
export interface ILinkedCell {
    /** Grid coordinates */
    x: number;
    y: number;

    /** Numeric game state values, one per layer */
    values: number[];

    /** Numeric values for distance fields, pathfinding costs, etc. */
    distances: number[];

    /** Boolean masks for collision, visibility, etc. */
    masks: boolean[];

    /** Set a neighbor in a direction */
    setNeighbor(dir: Direction, cell: ILinkedCell | null): this;

    /** Get a neighbor in a direction */
    neighbor(dir: Direction): ILinkedCell | null;

    /** Set value at layer */
    setValue(layer: number, val: number): this;
}
