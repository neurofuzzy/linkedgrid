import { defineComponent } from '@basegrid/ecs';

/**
 * @component FireSource
 * @icon flame
 * @description Permanent fire hazard that ignites entities (tiles, torches, lava)
 * 
 * Fire source component for entities that ignite others.
 * 
 * Fire sources are environmental hazards that apply burn status:
 * - Fire tiles (permanent flames)
 * - Torches
 * - Lava pools
 * 
 * @property {number} burnDuration - Duration of burn when applied to entities
 * @property {number} burnDamage - Damage per tick when applied to entities
 * @property {number} radius - Radius of effect (0 = same cell only)
 * @property {boolean} oneTimeOnly - Whether this can only ignite each entity once
 * 
 * @example
 * ```typescript
 * // Create fire tile
 * const fire = world.createEntity();
 * world.addComponent(fire, FireSourceComponent, {
 *   burnDuration: 90,
 *   burnDamage: 2,
 *   radius: 0  // Affects only same cell
 * });
 * world.addComponent(fire, GridPositionComponent, { x: 8, y: 10, grid });
 * 
 * // BurnSystem will ignite entities standing on it
 * ```
 */
export interface FireSource {
  /** Duration of burn when applied to entities */
  burnDuration: number;
  
  /** Damage per tick when applied to entities */
  burnDamage: number;
  
  /** Radius of effect (0 = same cell only) */
  radius?: number;
  
  /** Whether this can only ignite each entity once (default: false) */
  oneTimeOnly?: boolean;
  
  /** Internal: Set of entities already ignited */
  ignitedEntities?: Set<number>;
}

export const FireSourceComponent = defineComponent<FireSource>();
