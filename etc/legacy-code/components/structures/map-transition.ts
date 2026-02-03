import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import type { LinkedGrid } from '@basegrid/grid';

/**
 * @component MapTransition
 * @icon log-out
 * @description Transitions to different maps/levels (portals, stairs, exits)
 * 
 * Map Transition Component
 * 
 * Triggers transition to different maps/levels.
 * Handles portals, exits, stairs, and level changes.
 * 
 * Examples:
 * - Level exits
 * - Dungeon stairs
 * - Teleport portals
 * - World map transitions
 * 
 * @property {string} targetMap - Target map/level identifier
 * @property {object} targetPosition - Target position in new map
 * @property {string} transitionType - Type of transition (portal, stairs-up, stairs-down, door, teleport)
 * @property {boolean} active - Whether transition is currently active
 * @property {string[]} requiredTags - Tags required to use transition
 * @property {string} requiredItem - Item required to use transition
 * @property {number} transitionDuration - Fade/animation duration (seconds)
 * 
 * @example
 * ```typescript
 * // Create level exit
 * const exit = world.createEntity();
 * world.addComponent(exit, GridPositionComponent, { x: 50, y: 50, grid });
 * world.addComponent(exit, MapTransitionComponent, {
 *   targetMap: 'level-2',
 *   targetPosition: { x: 5, y: 5 },
 *   transitionType: 'stairs-down'
 * });
 * ```
 */
export interface MapTransition {
  /** Target map/level identifier */
  targetMap: string;
  
  /** Target position in new map */
  targetPosition: { x: number; y: number };
  
  /** Optional: Target grid (if different from current) */
  targetGrid?: LinkedGrid;
  
  /** Type of transition */
  transitionType?: 'portal' | 'stairs-up' | 'stairs-down' | 'door' | 'teleport';
  
  /** Whether transition is currently active */
  active?: boolean;
  
  /** Optional: Tags required to use transition */
  requiredTags?: string[];
  
  /** Optional: Item required to use transition */
  requiredItem?: string;
  
  /** Optional: Fade/animation duration (seconds) */
  transitionDuration?: number;
  
  /** Optional: Callback before transition */
  onTransitionStart?: (portal: Entity, traveler: Entity) => void;
  
  /** Optional: Callback after transition */
  onTransitionComplete?: (portal: Entity, traveler: Entity) => void;
}

export const MapTransitionComponent = defineComponent<MapTransition>();
