import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component Pursuer
 * @icon radar
 * @description AI that chases target when triggered, gives up at range
 * 
 * Pursuer component for NPCs that chase targets conditionally.
 * 
 * Pursuers have a two-state behavior:
 * - **Idle**: Wait until trigger condition met
 * - **Chase**: Actively pursue target using pathfinding
 * 
 * State transitions:
 * - Idle → Chase: When triggerCondition true AND distance <= triggerRange
 * - Chase → Idle: When distance > giveUpRange
 * - Chase: Catch target when distance <= 1
 * 
 * @property {Entity} targetEntity - Entity to pursue (usually the player)
 * @property {string} state - Current state (idle, chase)
 * @property {number} triggerRange - Range at which to start chasing (if condition met)
 * @property {number} giveUpRange - Range at which to give up chase and return to idle
 * @property {number} pathfindingLimit - Maximum pathfinding search distance
 * 
 * @example
 * ```typescript
 * // Guard that chases thieves
 * const guard = world.createEntity();
 * world.addComponent(guard, PursuerComponent, {
 *   targetEntity: player,
 *   triggerRange: 8,
 *   giveUpRange: 15,
 *   triggerCondition: () => playerHasStolen
 * });
 * world.addComponent(guard, GridPositionComponent, { x: 20, y: 9, grid });
 * 
 * // PursueSystem will handle state transitions and movement
 * ```
 */
export interface Pursuer {
  /** Entity to pursue (usually the player) */
  targetEntity: Entity;
  
  /** Current state */
  state: 'idle' | 'chase';
  
  /** Range at which to start chasing (if condition met) */
  triggerRange: number;
  
  /** Range at which to give up chase and return to idle */
  giveUpRange: number;
  
  /** Optional condition that must be true to trigger chase (e.g., player has treasure) */
  triggerCondition?: () => boolean;
  
  /** Optional callback when target is caught */
  onCatch?: (pursuer: Entity, target: Entity) => void;
  
  /** Maximum pathfinding search distance (default: 20) */
  pathfindingLimit?: number;
}

export const PursuerComponent = defineComponent<Pursuer>();
