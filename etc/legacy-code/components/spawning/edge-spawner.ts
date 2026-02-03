import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import type { LinkedGrid } from '@basegrid/gameplay';

/**
 * @component EdgeSpawner
 * @icon corner-down-right
 * @description Spawns entities from grid edges (offscreen enemies, traffic)
 * 
 * Edge Spawner Component
 * 
 * Spawns entities at the edges of a grid.
 * Useful for enemies entering from offscreen, traffic simulation, etc.
 * 
 * @property {number} spawnRate - Spawn interval in seconds
 * @property {number} spawnTimer - Time until next spawn
 * @property {string[]} edges - Which edges to spawn from (top, bottom, left, right)
 * @property {number} maxEntities - Maximum number of active spawned entities
 * @property {number} edgeOffset - Spawn offset from edge
 * @property {boolean} active - Enable/disable spawning
 * 
 * @example
 * ```typescript
 * // Create edge spawner
 * const spawner = world.createEntity();
 * world.addComponent(spawner, EdgeSpawnerComponent, {
 *   grid,
 *   spawnRate: 2.0, // seconds
 *   edges: ['top', 'left', 'right'], // spawn from 3 edges
 *   entityFactory: () => createEnemy(),
 *   maxEntities: 10
 * });
 * ```
 */
export interface EdgeSpawner {
  /** Grid to spawn entities on */
  grid: LinkedGrid<number>;
  
  /** Spawn interval in seconds */
  spawnRate: number;
  
  /** Time until next spawn (internal) */
  spawnTimer?: number;
  
  /** Which edges to spawn from */
  edges: Array<'top' | 'bottom' | 'left' | 'right'>;
  
  /** Factory function to create entity */
  entityFactory: () => Entity;
  
  /** Maximum number of active spawned entities */
  maxEntities?: number;
  
  /** Track spawned entities */
  spawnedEntities?: Set<Entity>;
  
  /** Optional: Spawn offset from edge (for safety margin) */
  edgeOffset?: number;
  
  /** Optional: Callback when entity spawns */
  onSpawn?: (spawner: Entity, spawned: Entity, edge: string, x: number, y: number) => void;
  
  /** Optional: Enable/disable spawning */
  active?: boolean;
  
  /** Optional: Weighted spawn probability per edge */
  edgeWeights?: Record<string, number>;
}

export const EdgeSpawnerComponent = defineComponent<EdgeSpawner>();
