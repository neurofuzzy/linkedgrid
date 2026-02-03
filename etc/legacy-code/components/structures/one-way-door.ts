/**
 * @component OneWayDoor
 * @icon corner-right-down
 * @description Allows passage in specific directions only (puzzles, dungeons)
 * 
 * One-Way Door Component
 * 
 * Represents a door or gate that only allows passage in specific directions.
 * Common in puzzle games, dungeons, and level design for controlled flow.
 * 
 * Examples:
 * - Zelda-style one-way doors
 * - Valve gates (water flows one way)
 * - Drop-down ledges
 * - One-way teleporters
 * 
 * @property {Direction[]} allowedDirections - Directions entities can pass through
 * @property {string[]} affectsTags - Entity types that can pass
 * @property {string[]} ignoresTags - Entity types that can ignore this door
 * @property {boolean} active - Whether the door is currently active
 * @property {boolean} blockReverse - Also blocks reverse directions actively
 */

import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { Direction } from '@basegrid/grid';

export interface OneWayDoor {
  /** Directions that entities can pass through (e.g., [Direction.UP] means can only go up) */
  allowedDirections: Direction[];
  
  /** Optional: Entity types that can pass (if undefined, affects all) */
  affectsTags?: string[];
  
  /** Optional: Entity types that can ignore this door */
  ignoresTags?: string[];
  
  /** Whether the door is currently active */
  active?: boolean;
  
  /** Optional: Callback when an entity successfully passes */
  onPass?: (entity: Entity, direction: Direction) => void;
  
  /** Optional: Callback when an entity is blocked */
  onBlocked?: (entity: Entity, direction: Direction) => void;
  
  /** Optional: If true, also blocks reverse directions actively (push-back) */
  blockReverse?: boolean;
}

export const OneWayDoorComponent = defineComponent<OneWayDoor>();
