import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component Switch
 * @icon toggle-right
 * @description Binary on/off signal source for logic circuits
 * 
 * Switch component for entities that generate digital signals.
 * 
 * Switches are signal sources that can be toggled:
 * - Manual switches (player-activated)
 * - Pressure plates (triggered by entities)
 * - Timers (toggle automatically)
 * 
 * Acts as power source for logic circuits.
 * 
 * @property {boolean} on - Current state
 * @property {boolean} toggleable - Whether switch can be toggled
 * 
 * @example
 * ```typescript
 * // Create toggle switch
 * const switch = world.createEntity();
 * world.addComponent(switch, SwitchComponent, {
 *   on: false,
 *   toggleable: true
 * });
 * world.addComponent(switch, GridPositionComponent, { x: 3, y: 2, grid });
 * 
 * // Toggle it
 * const sw = world.getComponent(switch, SwitchComponent);
 * sw.on = !sw.on;
 * 
 * // LogicCircuitSystem propagates signal
 * world.update(16.67);
 * ```
 */
export interface Switch {
  /** Current state */
  on: boolean;
  
  /** Whether switch can be toggled (default: true) */
  toggleable?: boolean;
  
  /** Optional callback when toggled */
  onToggle?: (switchEntity: Entity, on: boolean) => void;
}

export const SwitchComponent = defineComponent<Switch>();
