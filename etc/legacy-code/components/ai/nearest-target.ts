import { defineComponent, type Entity } from '@basegrid/ecs';

/**
 * @component NearestTarget
 * @icon crosshair
 * @description Automatically tracks nearest entity matching criteria
 * 
 * Nearest Target Component
 * 
 * Entities with this component track the nearest entity matching criteria.
 * Updates automatically each frame and fires callbacks on target change.
 * 
 * @property {string[]} targetTags - Only consider entities with these tags
 * @property {string[]} ignoreTags - Ignore entities with these tags
 * @property {number} maxRange - Maximum range to search
 * @property {Entity} currentTarget - Current nearest target
 * @property {number} currentDistance - Distance to current target
 * @property {boolean} continuous - Whether to continuously update each frame
 * @property {number} updateCooldown - Update cooldown in ms
 * @property {number} updateTimer - Internal update timer
 * 
 * @example
 * ```typescript
 * // Enemy that tracks nearest player
 * const enemy = world.createEntity();
 * world.addComponent(enemy, GridPositionComponent, { x: 5, y: 5, grid });
 * world.addComponent(enemy, NearestTargetComponent, {
 *   targetTags: ['player'],
 *   maxRange: 10,
 *   onAcquire: (entity, target) => {
 *     console.log(`Enemy acquired target: ${target}`);
 *   },
 *   onLost: (entity) => {
 *     console.log('Enemy lost target');
 *   }
 * });
 * ```
 */

export interface NearestTarget {
  /** Only consider entities with these tags (optional) */
  targetTags?: string[];
  
  /** Ignore entities with these tags (optional) */
  ignoreTags?: string[];
  
  /** Maximum range to search (default: Infinity) */
  maxRange?: number;
  
  /** Current nearest target (updated by system) */
  currentTarget?: Entity;
  
  /** Distance to current target (updated by system) */
  currentDistance?: number;
  
  /** Callback when acquiring a new target */
  onAcquire?: (owner: Entity, target: Entity, distance: number) => void;
  
  /** Callback when target changes (different entity) */
  onChange?: (owner: Entity, newTarget: Entity, oldTarget: Entity) => void;
  
  /** Callback when losing target (out of range or destroyed) */
  onLost?: (owner: Entity, previousTarget: Entity) => void;
  
  /** Whether to continuously update each frame (default: true) */
  continuous?: boolean;
  
  /** Update cooldown in ms (default: 0 = every frame) */
  updateCooldown?: number;
  
  /** Internal update timer */
  updateTimer?: number;
  
  /** Custom distance function (default: Manhattan distance) */
  distanceFn?: (x1: number, y1: number, x2: number, y2: number) => number;
}

export const NearestTargetComponent = defineComponent<NearestTarget>();
