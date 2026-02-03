/**
 * NPC Movement Trait
 *
 * Defines movement behaviors for NPCs including follow, flee, pursue, and wander modes.
 * Used by NPCMovementSystem to control autonomous entity movement.
 */

export type NPCMovementMode = 'follow' | 'flee' | 'pursue' | 'wander' | 'patrol';

/**
 * HasNPCMovement - Trait for entities with autonomous movement behavior.
 *
 * Movement modes:
 * - **follow**: Maintain distance range from target (approach when far, retreat when close)
 * - **flee**: Run away from target when it gets too close
 * - **pursue**: Chase target when within trigger range, give up when too far
 * - **wander**: Move randomly to adjacent walkable cells
 * - **patrol**: Follow path nodes on LOGIC layer, reverse at dead-ends, PRNG at junctions
 *
 * Speed affects movement frequency:
 * - speed 1 = moves every tick (fast)
 * - speed 2 = moves every 2 ticks (medium)
 * - speed 4 = moves every 4 ticks (slow)
 *
 * @example
 * ```typescript
 * // Fast follower NPC that stays 2-4 cells from player
 * const follower: HasNPCMovement = {
 *   movementMode: 'follow',
 *   targetEntityId: playerId,
 *   minDistance: 2,
 *   maxDistance: 4,
 *   speed: 1, // moves every tick
 * };
 *
 * // Slow fleeing NPC that runs when player gets within 3 cells
 * const prey: HasNPCMovement = {
 *   movementMode: 'flee',
 *   targetEntityId: playerId,
 *   panicDistance: 3,
 *   safeDistance: 7,
 *   speed: 3, // moves every 3 ticks
 * };
 *
 * // Pursuing NPC that chases player when in range
 * const guard: HasNPCMovement = {
 *   movementMode: 'pursue',
 *   targetEntityId: playerId,
 *   triggerRange: 8,
 *   giveUpRange: 15,
 *   speed: 2,
 * };
 *
 * // Wandering NPC that moves randomly
 * const wanderer: HasNPCMovement = {
 *   movementMode: 'wander',
 *   speed: 4, // slow wanderer
 * };
 *
 * // Patrolling NPC that follows path nodes (must spawn on a path-node cell)
 * const guard: HasNPCMovement = {
 *   movementMode: 'patrol',
 *   speed: 2,
 * };
 * ```
 */
export interface HasNPCMovement {
  /** Movement behavior mode */
  movementMode: NPCMovementMode;

  /** Target entity ID for follow/flee/pursue modes (not needed for wander) */
  targetEntityId?: number;

  // Speed/cooldown parameters
  /** Movement speed (ticks between moves). 1 = every tick, 2 = every 2 ticks, etc. (default: 1) */
  speed?: number;

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

  // Patrol mode parameters
  /** Base movement mode to return to after interrupts (e.g., pursue gives up) */
  baseMovementMode?: NPCMovementMode;

  // Internal state (managed by system, do not set manually)
  /** Current movement state (managed by system) */
  aiMovementState?: 'idle' | 'active' | 'returning';
  /** Tick when entity last moved (managed by system) */
  lastMoveTick?: number;
  /** Home path cell - auto-set on first patrol tick (managed by system) */
  homePathCell?: { x: number; y: number };
  /** Previous path cell for no-backtrack logic (managed by system) */
  lastPathCell?: { x: number; y: number };
  /** Patrol direction: 1 = forward, -1 = reverse at dead-ends (managed by system) */
  patrolDirection?: 1 | -1;
}
