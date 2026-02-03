import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component Guard
 * @icon user-check
 * @description AI that patrols, detects, and chases intruders
 * 
 * Guard component for NPCs that patrol and chase intruders.
 * 
 * Guards have a three-state behavior:
 * - **Patrol**: Walk between patrol points
 * - **Alert**: Noticed target (requires line of sight)
 * - **Chase**: Actively pursue target
 * 
 * State transitions:
 * - Patrol → Alert: Target within alertRadius with line of sight
 * - Alert → Chase: Target within chaseRange
 * - Chase/Alert → Patrol: Target out of range or line of sight lost
 * 
 * @property {Entity} targetEntity - Entity to guard against (usually the player)
 * @property {string} state - Current state (patrol, alert, chase)
 * @property {object[]} patrolPoints - Points to patrol between
 * @property {number} patrolIndex - Current index in patrol route
 * @property {number} alertRadius - Range at which guard becomes alert
 * @property {number} chaseRange - Range at which guard starts chasing
 * @property {number} alertTimer - Timer for alert state
 * @property {number} alertDuration - Duration to stay alert after losing sight
 * @property {boolean} requireLineOfSight - Whether to require line of sight for detection
 * 
 * @example
 * ```typescript
 * // Guard that patrols between points
 * const guard = world.createEntity();
 * world.addComponent(guard, GuardComponent, {
 *   targetEntity: player,
 *   patrolPoints: [
 *     { x: 15, y: 3 },
 *     { x: 15, y: 11 },
 *     { x: 15, y: 7 }
 *   ],
 *   alertRadius: 6,
 *   chaseRange: 12
 * });
 * world.addComponent(guard, GridPositionComponent, { x: 15, y: 7, grid });
 * 
 * // GuardSystem will handle patrolling and chasing
 * ```
 */
export interface Guard {
  /** Entity to guard against (usually the player) */
  targetEntity: Entity;
  
  /** Current state */
  state: 'patrol' | 'alert' | 'chase';
  
  /** Points to patrol between */
  patrolPoints: Array<{ x: number; y: number }>;
  
  /** Current index in patrol route */
  patrolIndex: number;
  
  /** Range at which guard becomes alert (with line of sight) */
  alertRadius: number;
  
  /** Range at which guard starts chasing */
  chaseRange: number;
  
  /** Timer for alert state (ticks remaining in alert) */
  alertTimer: number;
  
  /** Duration to stay alert after losing sight (default: 3 ticks) */
  alertDuration?: number;
  
  /** Optional callback when target is caught */
  onCatch?: (guard: Entity, target: Entity) => void;
  
  /** Whether to require line of sight for detection (default: true) */
  requireLineOfSight?: boolean;
}

export const GuardComponent = defineComponent<Guard>();
