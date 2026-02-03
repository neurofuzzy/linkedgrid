import { defineComponent } from '@basegrid/ecs';

/**
 * @component Frozen
 * @icon ice
 * @description Slowed or completely frozen movement (ice status effect)
 * 
 * Frozen status effect component.
 * 
 * Entities with this component are affected by ice/cold:
 * - **Slowed**: Movement speed reduced
 * - **Frozen**: Cannot move at all
 * 
 * The severity is determined by the slowMultiplier:
 * - slowMultiplier = 2: Half speed
 * - slowMultiplier = Infinity: Completely frozen
 * 
 * @property {number} duration - Ticks remaining before thaw
 * @property {number} slowMultiplier - Movement speed multiplier (2 = half speed, Infinity = frozen)
 * @property {number} moveCounter - Ticks since last allowed move
 * 
 * @example
 * ```typescript
 * // Slow entity to half speed
 * world.addComponent(entity, FrozenComponent, {
 *   duration: 60,
 *   slowMultiplier: 2  // Moves at 1/2 speed
 * });
 * 
 * // Freeze entity completely
 * world.addComponent(entity, FrozenComponent, {
 *   duration: 30,
 *   slowMultiplier: Infinity  // Cannot move
 * });
 * 
 * // FreezeSystem will enforce movement restrictions
 * ```
 */
export interface Frozen {
  /** Ticks remaining before thaw */
  duration: number;
  
  /** Movement speed multiplier (2 = half speed, Infinity = frozen) */
  slowMultiplier: number;
  
  /** Internal: Ticks since last allowed move */
  moveCounter?: number;
}

export const FrozenComponent = defineComponent<Frozen>();
