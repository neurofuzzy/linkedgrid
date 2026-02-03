import { defineComponent } from '@basegrid/ecs';

/**
 * @component Buff
 * @icon trending-up
 * @description Temporary stat modifier (speed, defense, attack, weakness)
 * 
 * Buff/Debuff status effect component.
 * 
 * Buffs modify entity stats temporarily:
 * - **Speed**: Movement speed multiplier
 * - **Defense**: Damage reduction multiplier
 * - **Attack**: Damage increase multiplier
 * - **Weakness**: Attack reduction (debuff)
 * 
 * Multiplier examples:
 * - 2.0 = double speed/attack
 * - 0.5 = half speed/attack
 * - 1.5 = 50% increase
 * 
 * @property {string} type - Buff type (speed, defense, attack, weakness)
 * @property {number} duration - Ticks remaining before buff expires
 * @property {number} multiplier - Stat multiplier (> 1.0 = buff, < 1.0 = debuff)
 * 
 * @example
 * ```typescript
 * // Apply speed buff
 * world.addComponent(entity, BuffComponent, {
 *   type: 'speed',
 *   duration: 180,     // 6 seconds at 30 FPS
 *   multiplier: 2.0    // Double speed
 * });
 * 
 * // Apply defense buff
 * world.addComponent(entity, BuffComponent, {
 *   type: 'defense',
 *   duration: 120,
 *   multiplier: 0.5    // Half damage taken
 * });
 * 
 * // BuffSystem will apply stat modifiers
 * ```
 */
export interface Buff {
  /** Buff type */
  type: 'speed' | 'defense' | 'attack' | 'weakness';
  
  /** Ticks remaining before buff expires */
  duration: number;
  
  /** Stat multiplier (> 1.0 = buff, < 1.0 = debuff) */
  multiplier: number;
}

export const BuffComponent = defineComponent<Buff>();
