import { defineComponent } from '@basegrid/ecs';

/**
 * @component PoisonCloud
 * @icon cloud
 * @description Spreading poison gas that damages entities over time
 * 
 * Poison cloud component for spreading poison entities.
 * 
 * Poison clouds:
 * - Have limited lifetime (expire after N ticks)
 * - Spread to adjacent cells occasionally
 * - Apply poison to entities standing on them
 * 
 * @property {number} lifetime - Ticks remaining before cloud dissipates
 * @property {number} spreadChance - Chance to spread to adjacent cell (0.0-1.0)
 * @property {number} spreadInterval - How often to attempt spreading (ticks)
 * @property {number} ticksSinceSpread - Ticks since last spread attempt
 * @property {number} poisonDuration - Duration of poison when applied to entities
 * @property {number} poisonDamage - Damage per tick when applied to entities
 * @property {number} tickInterval - How often damage is applied (every N ticks, default: 1)
 * 
 * @example
 * ```typescript
 * // Create poison cloud
 * const cloud = world.createEntity();
 * world.addComponent(cloud, PoisonCloudComponent, {
 *   lifetime: 40,
 *   spreadChance: 0.3,
 *   spreadInterval: 10,
 *   poisonDuration: 120,
 *   poisonDamage: 2,
 *   tickInterval: 10  // Damage every 10 ticks instead of every tick
 * });
 * world.addComponent(cloud, GridPositionComponent, { x: 5, y: 5, grid });
 * 
 * // PoisonSystem will handle spreading and application
 * ```
 */
export interface PoisonCloud {
  /** Ticks remaining before cloud dissipates */
  lifetime: number;
  
  /** Chance to spread to adjacent cell (0.0-1.0, default: 0.3) */
  spreadChance?: number;
  
  /** How often to attempt spreading (every N ticks, default: 10) */
  spreadInterval?: number;
  
  /** Internal: Ticks since last spread attempt */
  ticksSinceSpread?: number;
  
  /** Duration of poison when applied to entities */
  poisonDuration: number;
  
  /** Damage per tick when applied to entities */
  poisonDamage: number;
  
  /** How often damage is applied (every N ticks, default: 1) */
  tickInterval?: number;
}

export const PoisonCloudComponent = defineComponent<PoisonCloud>();
