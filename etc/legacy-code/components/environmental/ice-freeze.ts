import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component IceFreeze
 * @icon snowflake
 * @description Status effect that slows or freezes entities
 * 
 * Ice Freeze Component
 * 
 * Status effect that slows or completely freezes entities.
 * Can accumulate to full freeze, and thaws over time.
 * 
 * Examples:
 * - Ice attacks
 * - Freeze traps
 * - Blizzard hazards
 * - Cryogenic weapons
 * 
 * @property {number} freezeAmount - Freeze amount (0-1, where 1 is fully frozen)
 * @property {number} duration - Duration of freeze (seconds)
 * @property {number} timeRemaining - Remaining time
 * @property {number} thawRate - Rate freeze thaws (per second)
 * @property {boolean} frozen - Whether entity is completely frozen
 * @property {boolean} preventActions - Whether freeze prevents all actions
 * 
 * @example
 * ```typescript
 * // Apply freeze to entity
 * const enemy = world.createEntity();
 * world.addComponent(enemy, IceFreezeComponent, {
 *   freezeAmount: 0.5,  // 50% slowed
 *   duration: 5.0,
 *   thawRate: 0.1       // Thaws 10% per second
 * });
 * 
 * // System reduces movement speed
 * const freeze = world.getComponent(enemy, IceFreezeComponent);
 * const speedMultiplier = 1.0 - freeze.freezeAmount;
 * ```
 */
export interface IceFreeze {
  /** Freeze amount (0-1, where 1 is fully frozen) */
  freezeAmount: number;
  
  /** Duration of freeze (seconds) */
  duration: number;
  
  /** Remaining time */
  timeRemaining?: number;
  
  /** Rate freeze thaws (per second) */
  thawRate?: number;
  
  /** Whether entity is completely frozen (can't move/act) */
  frozen?: boolean;
  
  /** Whether freeze prevents all actions */
  preventActions?: boolean;
  
  /** Optional: Callback when entity becomes frozen */
  onFreeze?: (entity: Entity) => void;
  
  /** Optional: Callback when entity thaws */
  onThaw?: (entity: Entity) => void;
  
  /** Optional: Callback when freeze amount changes */
  onFreezeChange?: (entity: Entity, amount: number) => void;
}

export const IceFreezeComponent = defineComponent<IceFreeze>();
