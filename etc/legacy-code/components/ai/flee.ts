import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component Flee
 * @icon user-x
 * @description AI behavior to run away from threats
 * 
 * Flee component for NPCs that run away from threats.
 * 
 * Fleeing NPCs have two states:
 * - **Calm**: Normal behavior, stay in place
 * - **Fleeing**: Actively running away from threat
 * 
 * State transitions:
 * - Calm → Fleeing: Threat within panicDistance
 * - Fleeing → Calm: Threat exceeds safeDistance
 * 
 * Movement strategy:
 * - Check all cardinal directions
 * - Pick the direction that maximizes distance from threat
 * - Avoid walls and other fleeing NPCs
 * 
 * @property {Entity} threatEntity - Entity to flee from
 * @property {string} state - Current state (calm, fleeing)
 * @property {number} panicDistance - Distance at which to start fleeing
 * @property {number} safeDistance - Distance at which to stop fleeing
 * 
 * @example
 * ```typescript
 * // Timid NPC that flees from player
 * const rabbit = world.createEntity();
 * world.addComponent(rabbit, FleeComponent, {
 *   threatEntity: player,
 *   panicDistance: 3,
 *   safeDistance: 7
 * });
 * world.addComponent(rabbit, GridPositionComponent, { x: 8, y: 4, grid });
 * 
 * // FleeSystem will make it run when player gets close
 * ```
 */
export interface Flee {
  /** Entity to flee from (usually the player) */
  threatEntity: Entity;
  
  /** Current state */
  state: 'calm' | 'fleeing';
  
  /** Distance at which to start fleeing */
  panicDistance: number;
  
  /** Distance at which to stop fleeing and return to calm */
  safeDistance: number;
  
  /** Optional callback when caught (distance <= 1) */
  onCaught?: (fleeingEntity: Entity, threat: Entity) => void;
}

export const FleeComponent = defineComponent<Flee>();
