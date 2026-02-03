import { defineComponent } from '@basegrid/ecs';

/**
 * @component Poisoned
 * @icon biohazard
 * @description Damage-over-time from poison (stacks/refreshes)
 * 
 * Poisoned status effect component.
 * 
 * Entities with this component are suffering from poison damage over time.
 * 
 * Effects:
 * - Deals damage each tick (damage per tick)
 * - Expires after duration ticks
 * - Can stack or refresh duration
 * 
 * @property {number} duration - Ticks remaining before poison expires
 * @property {number} damagePerTick - Damage dealt per tick
 * @property {number} tickInterval - How often to apply damage (every N ticks)
 * @property {number} ticksSinceLastDamage - Ticks since last damage application
 * 
 * @example
 * ```typescript
 * // Apply poison to entity
 * world.addComponent(entity, PoisonedComponent, {
 *   duration: 120,      // 4 seconds at 30 FPS
 *   damagePerTick: 2,   // 2 HP per tick
 *   tickInterval: 1     // Apply every tick
 * });
 * 
 * // PoisonSystem will reduce duration and apply damage
 * ```
 */
export interface Poisoned {
  /** Ticks remaining before poison expires */
  duration: number;
  
  /** Damage dealt per tick */
  damagePerTick: number;
  
  /** How often to apply damage (every N ticks, default: 1) */
  tickInterval?: number;
  
  /** Internal: Ticks since last damage application */
  ticksSinceLastDamage?: number;
}

export const PoisonedComponent = defineComponent<Poisoned>();
