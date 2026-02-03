import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component PoweredDevice
 * @icon lightbulb
 * @description Activates when powered (lights, machines, doors, traps)
 * 
 * Powered device component for entities that activate when powered.
 * 
 * Devices consume electricity and activate when power level meets threshold:
 * - Lights, machines, doors, traps
 * - Require minimum power level to activate
 * - Can trigger callbacks on state changes
 * 
 * The ElectricitySystem checks if the entity has PoweredComponent
 * and updates the device's active state accordingly.
 * 
 * @property {number} powerThreshold - Minimum power level needed to activate
 * @property {boolean} active - Whether device is currently active
 * 
 * @example
 * ```typescript
 * // Create light that turns on when powered
 * const light = world.createEntity();
 * world.addComponent(light, PoweredDeviceComponent, {
 *   powerThreshold: 10,
 *   active: false,
 *   onStateChange: (device, active) => {
 *     console.log(`Light ${active ? 'ON' : 'OFF'}`);
 *   }
 * });
 * world.addComponent(light, GridPositionComponent, { x: 11, y: 4, grid });
 * 
 * // ElectricitySystem will activate when power reaches it
 * ```
 */
export interface PoweredDevice {
  /** Minimum power level needed to activate */
  powerThreshold: number;
  
  /** Whether device is currently active */
  active: boolean;
  
  /** Optional callback when state changes */
  onStateChange?: (device: Entity, active: boolean) => void;
}

export const PoweredDeviceComponent = defineComponent<PoweredDevice>();
