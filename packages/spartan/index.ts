/**
 * Spartan Framework - Cell-centric game framework built on LinkedGrid
 * 
 * Architecture B: Sparse entity system with spatial-first operations.
 * 
 * Core principles:
 * - Entities stored primarily in cell layers
 * - Minimal external metadata storage
 * - Spatial queries are first-class
 * - Rule-based entity interactions
 * 
 * @example
 * ```typescript
 * import { LinkedGrid } from '../grid';
 * import { SparseEntityStore, SpatialSystem } from '@spartan';
 * 
 * const grid = new LinkedGrid(20, 20);
 * const store = new SparseEntityStore();
 * const spatial = new SpatialSystem(grid, store);
 * 
 * // Spawn entities
 * const player = spatial.spawn('player', 10, 10, 1, { hp: 100 });
 * const enemy = spatial.spawn('enemy', 15, 10, 2, { hp: 50 });
 * 
 * // Move entities
 * spatial.move(10, 10, 11, 10, 1);
 * 
 * // Spatial queries
 * const nearby = spatial.getEntityIdsInRadius(11, 10, 5);
 * ```
 */

export { SparseEntityStore } from './entity-store';
export { SpatialSystem } from './spatial-system';
export type { EntityData, Layer, Position } from './types';
