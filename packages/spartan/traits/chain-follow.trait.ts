/**
 * Chain Follow Trait
 *
 * Defines properties for entities that form linked chains (snakes, centipedes, trains).
 * Each segment is an independent entity occupying a single cell. The head moves via
 * normal NPC movement; followers replay the head's position history with a delay.
 *
 * Used by ChainFollowSystem to coordinate chain movement and handle death.
 */

/**
 * HasChainFollow - Trait for entities that are part of a linked chain.
 *
 * Chain structure:
 * - Head: isChainHead=true, moves via NPCMovementSystem normally
 * - Followers: isChainHead=false, moved by ChainFollowSystem
 *
 * When a segment dies:
 * - If head dies: next segment is promoted to head (gets NPC movement)
 * - If middle segment dies: followers behind it close the gap
 *
 * @example
 * ```typescript
 * // Chain head (snake head) - moves normally, ChainFollowSystem tracks its position
 * const head: HasChainFollow = {
 *   chainId: 'snake-1',
 *   isChainHead: true,
 *   chainIndex: 0,
 *   chainDelay: 1,
 * };
 *
 * // First follower - follows head with 1-tick delay
 * const segment1: HasChainFollow = {
 *   chainId: 'snake-1',
 *   isChainHead: false,
 *   chainFollowTargetId: headEntityId,
 *   chainIndex: 1,
 *   chainDelay: 1,
 * };
 * ```
 */
export interface HasChainFollow {
  /** Shared chain identifier (all segments in a chain share this) */
  chainId: string;
  /** Whether this segment is the chain head (moves via NPC movement) */
  isChainHead: boolean;
  /** Entity ID of the segment this one follows (undefined for head) */
  chainFollowTargetId?: number;
  /** Position index in the chain (0 = head, 1 = first follower, etc.) */
  chainIndex: number;
  /** Ticks of delay behind the followed target (default: 1) */
  chainDelay: number;
}
