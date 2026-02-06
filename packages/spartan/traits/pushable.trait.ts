/**
 * Traits for pushable entities and entities that can push.
 */


/**
 * HasPushable - Entity can be pushed by other entities.
 * 
 * Used by:
 * - Crates / Boxes
 * - Boulders
 * - Sliding Ice Blocks
 */
export interface HasPushable {
    /** Whether the entity is currently pushable */
    isPushable: boolean;

    /** 
     * Weight of the object.
     * Compare against Pusher's pushStrength.
     * Default: 1
     */
    weight?: number;
}

/**
 * HasPusher - Entity can push other entities.
 * 
 * Used by:
 * - Player
 * - Strong enemies (maybe)
 * - Moving platforms
 */
export interface HasPusher {
    /** 
     * Strength of pushing.
     * Can push objects with weight <= pushStrength.
     * Default: 1
     */
    pushStrength?: number;
}
