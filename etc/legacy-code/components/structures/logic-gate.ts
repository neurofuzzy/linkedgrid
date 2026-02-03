import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import type { Direction } from '@basegrid/gameplay';

/**
 * @component LogicGate
 * @icon cpu
 * @description Boolean logic operation (AND, OR, NOT, XOR, NAND, NOR)
 * 
 * Logic gate component for entities that perform boolean logic operations.
 * 
 * Gates read signals from input directions and output result:
 * - **AND**: Output true if ALL inputs are true
 * - **OR**: Output true if ANY input is true
 * - **NOT**: Output opposite of input
 * - **XOR**: Output true if inputs differ
 * - **NAND**: NOT AND
 * - **NOR**: NOT OR
 * 
 * Gates have directional inputs and outputs for grid-based circuits.
 * 
 * @property {string} type - Gate type (AND, OR, NOT, XOR, NAND, NOR)
 * @property {Direction[]} inputDirections - Directions to read input signals from
 * @property {Direction} outputDirection - Direction to output signal to
 * @property {boolean} output - Current output state
 * 
 * @example
 * ```typescript
 * // Create AND gate with inputs from UP and DOWN, output to RIGHT
 * const gate = world.createEntity();
 * world.addComponent(gate, LogicGateComponent, {
 *   type: 'AND',
 *   inputDirections: [Direction.UP, Direction.DN],
 *   outputDirection: Direction.RT,
 *   output: false
 * });
 * world.addComponent(gate, GridPositionComponent, { x: 7, y: 4, grid });
 * 
 * // LogicCircuitSystem evaluates and propagates output
 * ```
 */
export interface LogicGate {
  /** Gate type */
  type: 'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND' | 'NOR';
  
  /** Directions to read input signals from */
  inputDirections: Direction[];
  
  /** Direction to output signal to */
  outputDirection: Direction;
  
  /** Current output state */
  output: boolean;
  
  /** Optional callback when output changes */
  onOutputChange?: (gate: Entity, output: boolean) => void;
}

export const LogicGateComponent = defineComponent<LogicGate>();
