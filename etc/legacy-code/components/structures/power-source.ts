import { defineComponent } from '@basegrid/ecs';

/**
 * @component PowerSource
 * @icon battery-charging
 * @description Generates electricity for conductor networks
 * 
 * Power source component for entities that generate electricity.
 * 
 * Power sources are the origin of electrical networks:
 * - Generators, batteries, power plants
 * - Emit power that propagates through conductors
 * - Can be toggled on/off
 * 
 * @property {boolean} active - Whether source is currently active
 * @property {number} powerLevel - Output power level (default: 100)
 * 
 * @example
 * ```typescript
 * // Create power generator
 * const generator = world.createEntity();
 * world.addComponent(generator, PowerSourceComponent, {
 *   active: true,
 *   powerLevel: 100
 * });
 * world.addComponent(generator, GridPositionComponent, { x: 5, y: 7, grid });
 * 
 * // ElectricitySystem will propagate power from this source
 * ```
 */
export interface PowerSource {
  /** Whether source is currently active */
  active: boolean;
  
  /** Output power level (default: 100) */
  powerLevel?: number;
}

export const PowerSourceComponent = defineComponent<PowerSource>();
