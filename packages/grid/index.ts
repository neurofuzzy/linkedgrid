/**
 * Grid Package - LinkedGrid Data Structures
 * 
 * Core data structures for grid-based games:
 * - LinkedGrid with O(1) neighbor navigation
 * - Pathfinding, raycasting, field-of-view
 * - Distance fields for AI
 * 
 * All values are constrained to numbers for simplicity.
 */

export { Direction } from './direction';
export { LinkedCell } from './linked-cell';
export { LinkedGrid } from './linked-grid';
export { LinkedValue } from './linked-value';
export { LinkedCellUtils } from './linked-cell-utils';
export type { ILinkedGrid, ILinkedCell } from './interfaces';
