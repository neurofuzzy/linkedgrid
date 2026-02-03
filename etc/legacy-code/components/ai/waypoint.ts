import { defineComponent, type Entity } from '@basegrid/ecs';

/**
 * @component Waypoint
 * @icon map-pin
 * @description Single point in a navigation path sequence
 * 
 * Waypoint Component
 * 
 * Defines a single waypoint in a navigation path.
 * 
 * @property {string} waypointId - Unique identifier for this waypoint
 * @property {string} nextWaypoint - ID of next waypoint in sequence
 * @property {boolean} terminal - Whether this is a terminal waypoint
 * 
 * @example
 * ```typescript
 * const waypoint = world.createEntity();
 * world.addComponent(waypoint, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(waypoint, WaypointComponent, {
 *   waypointId: 'checkpoint-1',
 *   nextWaypoint: 'checkpoint-2'
 * });
 * ```
 */
export interface Waypoint {
  /** Unique identifier for this waypoint */
  waypointId: string;
  
  /** ID of next waypoint in sequence (optional) */
  nextWaypoint?: string;
  
  /** Whether this is a terminal waypoint */
  terminal?: boolean;
  
  /** Callback when entity reaches this waypoint */
  onReach?: (entity: Entity, waypoint: Entity) => void;
}

export const WaypointComponent = defineComponent<Waypoint>();

/**
 * @component WaypointNavigator
 * @icon navigation
 * @description Follows a sequence of waypoints
 * 
 * Waypoint Navigator Component
 * 
 * Entities with this component follow a sequence of waypoints.
 * 
 * @property {string} currentWaypointId - Current waypoint ID being navigated to
 * @property {Entity} currentWaypoint - Current waypoint entity reference
 * @property {number} moveSpeed - Movement speed (cells per second)
 * @property {boolean} loop - Whether to loop back to first waypoint
 * @property {boolean} active - Whether currently active
 * @property {string[]} waypointTags - Tags to filter waypoints
 * 
 * @example
 * ```typescript
 * const enemy = world.createEntity();
 * world.addComponent(enemy, GridPositionComponent, { x: 0, y: 0, grid });
 * world.addComponent(enemy, WaypointNavigatorComponent, {
 *   currentWaypointId: 'start',
 *   moveSpeed: 1,
 *   onComplete: (entity) => {
 *     console.log('Enemy reached end of path');
 *   }
 * });
 * ```
 */
export interface WaypointNavigator {
  /** Current waypoint ID being navigated to */
  currentWaypointId?: string;
  
  /** Current waypoint entity reference (cached) */
  currentWaypoint?: Entity;
  
  /** Movement speed (cells per second) */
  moveSpeed?: number;
  
  /** Whether to loop back to first waypoint */
  loop?: boolean;
  
  /** Whether currently active */
  active?: boolean;
  
  /** Callback when reaching a waypoint */
  onWaypointReached?: (entity: Entity, waypoint: Entity) => void;
  
  /** Callback when completing entire path */
  onComplete?: (entity: Entity) => void;
  
  /** Tags to filter waypoints (optional) */
  waypointTags?: string[];
}

export const WaypointNavigatorComponent = defineComponent<WaypointNavigator>();
