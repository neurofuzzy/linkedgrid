import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component Armor
 * @icon shield
 * @description Degrading protection that absorbs damage (doesn't regenerate)
 * 
 * Armor Component
 * 
 * Degrading physical protection that absorbs damage but loses durability.
 * Different from shields - armor doesn't regenerate automatically.
 * 
 * Examples:
 * - Medieval armor
 * - Vehicle armor plating
 * - Destructible armor
 * - Equipment durability
 * 
 * @property {number} durability - Current armor durability
 * @property {number} maximum - Maximum armor durability
 * @property {number} absorption - Damage absorption (0-1, where 1 = blocks 100%)
 * @property {number} degradePerHit - Flat amount of armor lost per hit
 * @property {number} degradeFromDamage - Percentage of damage that degrades armor
 * @property {boolean} repairable - Whether armor can be repaired
 * @property {boolean} active - Whether armor is currently functional
 * 
 * @example
 * ```typescript
 * // Create armored entity
 * const knight = world.createEntity();
 * world.addComponent(knight, HealthComponent, { current: 100, maximum: 100 });
 * world.addComponent(knight, ArmorComponent, {
 *   durability: 50,
 *   maximum: 50,
 *   absorption: 0.5,       // Blocks 50% of damage
 *   degradePerHit: 5       // Loses 5 durability per hit
 * });
 * ```
 */
export interface Armor {
  /** Current armor durability */
  durability: number;
  
  /** Maximum armor durability */
  maximum: number;
  
  /** Damage absorption (0-1, where 1 = blocks 100% of damage) */
  absorption: number;
  
  /** Flat amount of armor lost per hit (optional) */
  degradePerHit?: number;
  
  /** Percentage of damage that degrades armor (optional, default: 0) */
  degradeFromDamage?: number;
  
  /** Whether armor can be repaired */
  repairable?: boolean;
  
  /** Whether armor is currently functional */
  active?: boolean;
  
  /** Optional: Callback when armor takes damage */
  onArmorDamage?: (entity: Entity, damageAmount: number, durabilityLost: number) => void;
  
  /** Optional: Callback when armor breaks */
  onArmorBreak?: (entity: Entity) => void;
  
  /** Optional: Callback when armor is repaired */
  onArmorRepair?: (entity: Entity, amount: number) => void;
}

export const ArmorComponent = defineComponent<Armor>();
