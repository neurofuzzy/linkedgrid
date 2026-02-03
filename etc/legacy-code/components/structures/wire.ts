import { defineComponent } from '@basegrid/ecs';

/**
 * @component Wire
 * @icon git-merge
 * @description Conducts boolean signals through circuit networks
 * 
 * Wire component for entities that conduct digital signals.
 * 
 * Wires propagate boolean signals (on/off) through connected networks:
 * - Connect adjacent wires
 * - Transmit signals from switches to gates to devices
 * - Similar to Conductor but for digital (boolean) signals
 * 
 * @property {boolean} signal - Current signal state (on/off)
 * @property {number} strength - Signal strength for visualization (0.0-1.0)
 * 
 * @example
 * ```typescript
 * // Create wire segment
 * const wire = world.createEntity();
 * world.addComponent(wire, WireComponent, {
 *   signal: false
 * });
 * world.addComponent(wire, GridPositionComponent, { x: 5, y: 7, grid });
 * 
 * // LogicCircuitSystem will propagate signals through it
 * ```
 */
export interface Wire {
  /** Current signal state (on/off) */
  signal: boolean;
  
  /** Optional signal strength for visualization (0.0-1.0) */
  strength?: number;
}

export const WireComponent = defineComponent<Wire>();
