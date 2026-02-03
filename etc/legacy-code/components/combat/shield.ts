import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component Shield
 * @icon shield-check
 * @description Regenerating energy shield that absorbs damage before health
 * 
 * Shield Component
 * 
 * Regenerating energy shields that absorb damage before health.
 * Common in sci-fi games, space shooters, and action games.
 * 
 * Examples:
 * - Player energy shields
 * - Enemy shields
 * - Vehicle shields
 * - Boss shields
 * 
 * @property {number} current - Current shield HP
 * @property {number} maximum - Maximum shield HP
 * @property {number} regenRate - Shield regeneration rate (HP per second)
 * @property {number} regenDelay - Delay in ticks after damage before regen starts
 * @property {number} timeSinceLastDamage - Time since last damage
 * @property {boolean} blocksAllDamage - Whether shield blocks all damage or just reduces it
 * @property {number} damagePassthrough - Percentage of damage that passes through (0-1)
 * @property {boolean} active - Whether shield is currently active/functional
 * 
 * @example
 * ```typescript
 * // Create entity with shields
 * const ship = world.createEntity();
 * world.addComponent(ship, HealthComponent, { current: 100, maximum: 100 });
 * world.addComponent(ship, ShieldComponent, {
 *   current: 50,
 *   maximum: 50,
 *   regenRate: 2,        // 2 HP per second
 *   regenDelay: 180,     // 3 seconds after damage
 *   blocksAllDamage: true
 * });
 * 
 * // Shields absorb damage first, then regenerate after delay
 * ```
 */
export interface Shield {
  /** Current shield HP */
  current: number;
  
  /** Maximum shield HP */
  maximum: number;
  
  /** Shield regeneration rate (HP per second) */
  regenRate: number;
  
  /** Delay in ticks after damage before regeneration starts */
  regenDelay: number;
  
  /** Internal: Time since last damage */
  timeSinceLastDamage?: number;
  
  /** Whether shield blocks all damage or just reduces it */
  blocksAllDamage?: boolean;
  
  /** If not blocking all, what percentage of damage passes through (0-1) */
  damagePassthrough?: number;
  
  /** Whether shield is currently active/functional */
  active?: boolean;
  
  /** Optional: Callback when shield takes damage */
  onShieldDamage?: (entity: Entity, amount: number) => void;
  
  /** Optional: Callback when shield depletes */
  onShieldDeplete?: (entity: Entity) => void;
  
  /** Optional: Callback when shield fully regenerates */
  onShieldFullyCharged?: (entity: Entity) => void;
  
  /** Optional: Callback when shield starts regenerating */
  onRegenStart?: (entity: Entity) => void;
}

export const ShieldComponent = defineComponent<Shield>();
