import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * Follower component for NPCs that maintain distance from a target.
 * 
 * @component Follower
 * @category ai
 * @icon target
 * @description Makes entity maintain distance from target, moving toward when far and away when close
 * 
 * Followers stay within a distance range:
 * - Too close (< minDistance): Move away
 * - Too far (> maxDistance): Move toward
 * - In range: Stay put
 * 
 * Uses pathfinding to navigate around obstacles.
 * 
 * @property {Entity} targetEntity - Entity to follow (usually the player)
 * @property {number} minDistance - Minimum distance to maintain (moves away if closer)
 * @property {number} maxDistance - Maximum distance to maintain (moves toward if farther)
 * @property {number} pathfindingLimit - Maximum pathfinding search distance (default: 20)
 * 
 * @example
 * ```typescript
 * // Create a follower that stays 2-4 cells from player
 * const follower = world.createEntity();
 * world.addComponent(follower, FollowerComponent, {
 *   targetEntity: playerEntity,
 *   minDistance: 2,
 *   maxDistance: 4
 * });
 * world.addComponent(follower, GridPositionComponent, { x: 5, y: 5, grid });
 * 
 * // FollowSystem will automatically maintain distance
 * ```
 */
export interface Follower {
  /** Entity to follow (usually the player) */
  targetEntity: Entity;
  
  /** Minimum distance to maintain (moves away if closer) */
  minDistance: number;
  
  /** Maximum distance to maintain (moves toward if farther) */
  maxDistance: number;
  
  /** Maximum pathfinding search distance (default: 20) */
  pathfindingLimit?: number;
}

export const FollowerComponent = defineComponent<Follower>();
