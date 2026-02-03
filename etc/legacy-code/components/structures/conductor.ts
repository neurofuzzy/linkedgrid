import { defineComponent } from '@basegrid/ecs';

/**
 * @component Conductor
 * @icon git-commit
 * @description Conducts electricity through networks (wires, cables)
 * 
 * Conductor component for entities that conduct electricity.
 * 
 * Conductors form networks that transmit power:
 * - Wires, cables, metal conduits
 * - Connect adjacent conductors
 * - Transmit power from sources to devices
 * 
 * Power propagates through connected conductors automatically.
 * 
 * @property {boolean} conductive - Whether this conductor is active
 * @property {number} resistance - Resistance level (higher = more power loss)
 * 
 * @example
 * ```typescript
 * // Create wire segment
 * const wire = world.createEntity();
 * world.addComponent(wire, ConductorComponent, {
 *   conductive: true,
 *   resistance: 0
 * });
 * world.addComponent(wire, GridPositionComponent, { x: 5, y: 7, grid });
 * 
 * // ElectricitySystem will propagate power through it
 * ```
 */
export interface Conductor {
  /** Whether this conductor is active (can conduct power) */
  conductive: boolean;
  
  /** Resistance level (higher = more power loss, default: 0) */
  resistance?: number;
}

export const ConductorComponent = defineComponent<Conductor>();
