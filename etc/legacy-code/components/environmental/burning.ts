import { defineComponent } from '@basegrid/ecs';

/**
 * @component Burning
 * @icon flame
 * @description Damage-over-time from fire (spreads to adjacent cells)
 * 
 * Burning status effect component.
 * 
 * Entities with this component are suffering from burn damage over time.
 * 
 * Effects:
 * - Deals damage each tick (damage per tick)
 * - Expires after duration ticks
 * - Can spread fire to adjacent flammable terrain
 * - Extinguished by water
 * 
 * @property {number} duration - Ticks remaining before burn expires
 * @property {number} damagePerTick - Damage dealt per tick
 * @property {number} spreadChance - Chance to spread fire to adjacent cells (0.0-1.0)
 * @property {number} tickInterval - Tick interval for damage application
 * @property {number} ticksSinceLastDamage - Ticks since last damage
 * 
 * @example
 * ```typescript
 * // Apply burn to entity
 * world.addComponent(entity, BurningComponent, {
 *   duration: 90,       // 3 seconds at 30 FPS
 *   damagePerTick: 2,   // 2 HP per tick
 *   spreadChance: 0.05  // 5% chance to spread per tick
 * });
 * 
 * // BurnSystem will apply damage and handle spreading
 * ```
 */
export interface Burning {
  /** Ticks remaining before burn expires */
  duration: number;
  
  /** Damage dealt per tick */
  damagePerTick: number;
  
  /** Chance to spread fire to adjacent cells (0.0-1.0, default: 0.05) */
  spreadChance?: number;
  
  /** Tick interval for damage application (default: 1) */
  tickInterval?: number;
  
  /** Internal: Ticks since last damage */
  ticksSinceLastDamage?: number;
}

export const BurningComponent = defineComponent<Burning>();
