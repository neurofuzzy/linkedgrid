import { defineComponent } from '@basegrid/ecs';

/**
 * @component IceSource
 * @icon snowflake
 * @description Permanent ice hazard that freezes/slows entities (patches, blizzards)
 * 
 * Ice source component for entities that freeze others.
 * 
 * Ice sources apply frozen/slowed status:
 * - Ice patches (slow movement)
 * - Blizzard zones (freeze completely)
 * - Frost traps
 * 
 * @property {number} freezeDuration - Duration of freeze when applied
 * @property {number} slowMultiplier - Speed multiplier (2 = half speed, Infinity = frozen)
 * @property {number} radius - Radius of effect (0 = same cell only)
 * @property {boolean} oneTimeOnly - Whether this can only freeze each entity once
 * 
 * @example
 * ```typescript
 * // Create ice patch that slows entities
 * const ice = world.createEntity();
 * world.addComponent(ice, IceSourceComponent, {
 *   freezeDuration: 60,
 *   slowMultiplier: 2,  // Half speed
 *   radius: 0
 * });
 * world.addComponent(ice, GridPositionComponent, { x: 6, y: 5, grid });
 * 
 * // FreezeSystem will slow entities standing on ice
 * ```
 */
export interface IceSource {
  /** Duration of freeze when applied */
  freezeDuration: number;
  
  /** Speed multiplier (2 = half speed, Infinity = frozen) */
  slowMultiplier: number;
  
  /** Radius of effect (0 = same cell only) */
  radius?: number;
  
  /** Whether this can only freeze each entity once (default: false) */
  oneTimeOnly?: boolean;
  
  /** Internal: Set of entities already frozen */
  frozenEntities?: Set<number>;
}

export const IceSourceComponent = defineComponent<IceSource>();
