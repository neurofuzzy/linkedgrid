/**
 * NPC Movement Trait
 *
 * Defines movement behaviors for NPCs including follow, flee, pursue, and wander modes.
 * Used by NPCMovementSystem to control autonomous entity movement.
 */

export type NPCMovementMode = 'follow' | 'flee' | 'pursue' | 'wander';

/**
 * HasNPCMovement - Trait for entities with autonomous movement behavior.
 *
 * Movement modes:
 * - **follow**: Maintain distance range from target (approach when far, retreat when close)
 * - **flee**: Run away from target when it gets too close
 * - **pursue**: Chase target when within trigger range, give up when too far
 * - **wander**: Move randomly to adjacent walkable cells
 *
 * @example
 * ```typescript
 * // Follower NPC that stays 2-4 cells from player
 * const follower: HasNPCMovement = {
 *   movementMode: 'follow',
 *   targetEntityId: playerId,
 *   minDistance: 2,
 *   maxDistance: 4,
 * };
 *
 * // Fleeing NPC that runs when player gets within 3 cells
 * const prey: HasNPCMovement = {
 *   movementMode: 'flee',
 *   targetEntityId: playerId,
 *   panicDistance: 3,
 *   safeDistance: 7,
 * };
 *
 * // Pursuing NPC that chases player when in range
 * const guard: HasNPCMovement = {
 *   movementMode: 'pursue',
 *   targetEntityId: playerId,
 *   triggerRange: 8,
 *   giveUpRange: 15,
 * };
 *
 * // Wandering NPC that moves randomly
 * const wanderer: HasNPCMovement = {
 *   movementMode: 'wander',
 * };
 * ```
 */
export interface HasNPCMovement {
  /** Movement behavior mode */
  movementMode: NPCMovementMode;

  /** Target entity ID for follow/flee/pursue modes (not needed for wander) */
  targetEntityId?: number;

  // Follow mode parameters
  /** Minimum distance to maintain from target (default: 1) */
  minDistance?: number;
  /** Maximum distance to maintain from target (default: 3) */
  maxDistance?: number;

  // Flee mode parameters
  /** Distance at which to start fleeing (default: 3) */
  panicDistance?: number;
  /** Distance at which to stop fleeing and return to idle (default: 7) */
  safeDistance?: number;

  // Pursue mode parameters
  /** Distance at which to start pursuing (default: 8) */
  triggerRange?: number;
  /** Distance at which to give up pursuit (default: 15) */
  giveUpRange?: number;

  // Shared parameters
  /** Maximum pathfinding search range (default: 20) */
  pathfindingRange?: number;

  // Internal state
  /** Current movement state (managed by system) */
  aiMovementState?: 'idle' | 'active';
}
