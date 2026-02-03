import { defineComponent, type Entity } from '@basegrid/ecs';

/**
 * @component Patrol
 * @icon route
 * @description AI patrol route with multiple waypoints and looping
 * 
 * Patrol Route Component
 * 
 * Defines a patrol route with multiple waypoints.
 * Entities follow the route, optionally reversing at endpoints.
 * 
 * @property {PatrolWaypoint[]} waypoints - Array of waypoint positions
 * @property {number} currentIndex - Current waypoint index
 * @property {number} moveSpeed - Movement speed (cells per second)
 * @property {boolean} loop - Whether to loop (true) or reverse (false) at endpoints
 * @property {number} direction - Direction of patrol (1 = forward, -1 = backward)
 * @property {boolean} active - Whether currently active
 * @property {number} pauseTimer - Current pause timer (ms)
 * 
 * @example
 * ```typescript
 * const guard = world.createEntity();
 * world.addComponent(guard, GridPositionComponent, { x: 5, y: 5, grid });
 * world.addComponent(guard, PatrolComponent, {
 *   waypoints: [
 *     { x: 5, y: 5 },
 *     { x: 10, y: 5 },
 *     { x: 10, y: 10 },
 *     { x: 5, y: 10 }
 *   ],
 *   loop: true,
 *   moveSpeed: 2
 * });
 * ```
 */
export interface PatrolWaypoint {
  x: number;
  y: number;
  /** Optional pause duration at this waypoint (ms) */
  pauseDuration?: number;
}

export interface Patrol {
  /** Array of waypoint positions */
  waypoints: PatrolWaypoint[];
  
  /** Current waypoint index */
  currentIndex?: number;
  
  /** Movement speed (cells per second) */
  moveSpeed?: number;
  
  /** Whether to loop (true) or reverse (false) at endpoints */
  loop?: boolean;
  
  /** Direction of patrol (1 = forward, -1 = backward) */
  direction?: number;
  
  /** Whether currently active */
  active?: boolean;
  
  /** Current pause timer (ms) */
  pauseTimer?: number;
  
  /** Callback when reaching a waypoint */
  onWaypointReached?: (entity: Entity, waypointIndex: number) => void;
  
  /** Callback when completing a full patrol cycle */
  onCycleComplete?: (entity: Entity) => void;
}

export const PatrolComponent = defineComponent<Patrol>();
