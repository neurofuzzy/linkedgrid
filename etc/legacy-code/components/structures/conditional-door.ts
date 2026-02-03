import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * Condition type for conditional doors
 */
export type DoorConditionType = 
  | 'all-enemies-killed'
  | 'entity-count'
  | 'has-item'
  | 'entity-on-plate'
  | 'custom';

/**
 * Door condition configuration
 */
export interface DoorCondition {
  /** Type of condition */
  type: DoorConditionType;
  
  /** For 'entity-count': tag to count */
  entityTag?: string;
  
  /** For 'entity-count': required count (default: 0) */
  requiredCount?: number;
  
  /** For 'has-item': required item ID */
  requiredItem?: string;
  
  /** For 'entity-on-plate': pressure plate entity */
  pressurePlate?: Entity;
  
  /** For 'custom': custom condition function */
  customCondition?: (world: any) => boolean;
  
  /** Optional: Condition name for debugging */
  name?: string;
}

/**
 * @component ConditionalDoor
 * @icon door-closed
 * @description Door that opens when conditions met (puzzles, kill-all-enemies)
 * 
 * Conditional Door Component
 * 
 * Doors that open/close based on game conditions.
 * 
 * Use cases:
 * - "Kill all enemies" doors
 * - Puzzle doors (all switches activated)
 * - Item requirement doors
 * - Sequence doors (domino effect)
 * 
 * @property {DoorCondition[]} conditions - Array of conditions that must be met
 * @property {boolean} requireAllConditions - Whether all conditions must be met (AND) or just one (OR)
 * @property {boolean} autoOpen - Automatically open door when conditions met
 * @property {boolean} autoClose - Automatically close when conditions no longer met
 * @property {boolean} conditionsSatisfied - Whether conditions are currently satisfied
 * @property {number} checkInterval - Check interval in seconds (0 = every frame)
 * @property {number} checkTimer - Time until next check
 * 
 * @example
 * ```typescript
 * // Door that opens when all enemies are dead
 * const door = world.createEntity();
 * world.addComponent(door, GridPositionComponent, { x: 10, y: 5, grid });
 * world.addComponent(door, DoorComponent, { state: 'closed', locked: true });
 * world.addComponent(door, ConditionalDoorComponent, {
 *   conditions: [
 *     { type: 'all-enemies-killed' }
 *   ],
 *   requireAllConditions: true,
 *   autoOpen: true
 * });
 * 
 * // Door that needs 3 switches activated
 * const puzzleDoor = world.createEntity();
 * world.addComponent(puzzleDoor, ConditionalDoorComponent, {
 *   conditions: [
 *     { type: 'entity-count', entityTag: 'switch-active', requiredCount: 3 }
 *   ]
 * });
 * ```
 */
export interface ConditionalDoor {
  /** Array of conditions that must be met */
  conditions: DoorCondition[];
  
  /** Whether all conditions must be met (AND) or just one (OR) */
  requireAllConditions?: boolean;
  
  /** Automatically open door when conditions are met */
  autoOpen?: boolean;
  
  /** Automatically close door when conditions are no longer met */
  autoClose?: boolean;
  
  /** Track which conditions are currently met */
  metConditions?: Set<number>;
  
  /** Whether conditions are currently satisfied */
  conditionsSatisfied?: boolean;
  
  /** Optional: Callback when conditions become satisfied */
  onConditionsMet?: (door: Entity) => void;
  
  /** Optional: Callback when conditions are no longer satisfied */
  onConditionsLost?: (door: Entity) => void;
  
  /** Optional: Check interval in seconds (0 = every frame) */
  checkInterval?: number;
  
  /** Internal: time until next check */
  checkTimer?: number;
}

export const ConditionalDoorComponent = defineComponent<ConditionalDoor>();
