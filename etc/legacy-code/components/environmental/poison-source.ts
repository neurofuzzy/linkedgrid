import { defineComponent } from '@basegrid/ecs';

/**
 * @component PoisonSource
 * @icon droplet
 * @description Permanent poison hazard (pools, toxic waste, venomous plants)
 * 
 * Poison source component for permanent poison pools/zones.
 * 
 * Unlike PoisonCloudComponent (which expires), poison sources are permanent
 * environmental hazards that continuously apply poison to entities.
 * 
 * Examples: Poison pools, toxic waste, venomous plants
 * 
 * @property {number} poisonDuration - Duration of poison when applied to entities
 * @property {number} poisonDamage - Damage per tick when applied to entities
 * @property {number} tickInterval - How often damage is applied (every N ticks, default: 1)
 * @property {number} radius - Radius of effect (0 = same cell only)
 * @property {boolean} oneTimeOnly - Whether source can only poison once per entity
 * 
 * @example
 * ```typescript
 * // Create permanent poison pool
 * const pool = world.createEntity();
 * world.addComponent(pool, PoisonSourceComponent, {
 *   poisonDuration: 120,
 *   poisonDamage: 2,
 *   tickInterval: 10,  // Damage every 10 ticks instead of every tick
 *   radius: 0  // Affects only same cell
 * });
 * world.addComponent(pool, GridPositionComponent, { x: 6, y: 6, grid });
 * 
 * // PoisonSystem will apply poison to entities standing on it
 * ```
 */
export interface PoisonSource {
  /** Duration of poison when applied to entities */
  poisonDuration: number;
  
  /** Damage per tick when applied to entities */
  poisonDamage: number;
  
  /** How often damage is applied (every N ticks, default: 1) */
  tickInterval?: number;
  
  /** Radius of effect (0 = same cell only, 1 = adjacent cells, etc.) */
  radius?: number;
  
  /** Whether this source can only poison once per entity (default: false) */
  oneTimeOnly?: boolean;
  
  /** Internal: Set of entities already poisoned (for oneTimeOnly) */
  poisonedEntities?: Set<number>;
}

export const PoisonSourceComponent = defineComponent<PoisonSource>();
