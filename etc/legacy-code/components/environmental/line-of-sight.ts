import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component LineOfSight
 * @icon eye
 * @description Vision system with range and blocking (guards, turrets, stealth)
 * 
 * Line of Sight Component
 * 
 * Tracks what entities can see in their field of view.
 * Handles vision blocking, range, and visibility detection.
 * 
 * Examples:
 * - Enemy vision cones
 * - Stealth detection
 * - Fog of war reveal
 * - Turret targeting
 * 
 * @property {number} range - Maximum vision range (cells)
 * @property {number[]} blockedBy - Cell values that block vision
 * @property {string[]} targetTags - Tag filter for what to detect
 * @property {string[]} ignoreTags - Ignore certain tags
 * @property {number} visionAngle - Vision cone angle (degrees, 360 = full circle)
 * @property {object} visionDirection - Direction of vision cone
 * @property {number} updateInterval - Update rate (seconds, 0 = every frame)
 * @property {number} updateTimer - Time until next update
 * 
 * @example
 * ```typescript
 * // Create guard with vision
 * const guard = world.createEntity();
 * world.addComponent(guard, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(guard, LineOfSightComponent, {
 *   range: 8,
 *   blockedBy: [WALL],
 *   targetTags: ['player']
 * });
 * 
 * // System updates visible entities
 * const losSystem = world.getSystem(LineOfSightSystem);
 * const canSee = losSystem.canSee(guard, player);
 * ```
 */
export interface LineOfSight {
  /** Maximum vision range (cells) */
  range: number;
  
  /** Cell values that block vision */
  blockedBy?: number[];
  
  /** Current set of visible entities */
  visibleEntities?: Set<Entity>;
  
  /** Optional: Tag filter for what to detect */
  targetTags?: string[];
  
  /** Optional: Ignore certain tags */
  ignoreTags?: string[];
  
  /** Optional: Vision cone angle (degrees, 360 = full circle) */
  visionAngle?: number;
  
  /** Optional: Direction of vision cone */
  visionDirection?: { x: number; y: number };
  
  /** Optional: Update rate (seconds, 0 = every frame) */
  updateInterval?: number;
  
  /** Internal: time until next update */
  updateTimer?: number;
  
  /** Optional: Callback when entity enters sight */
  onSpotted?: (observer: Entity, target: Entity) => void;
  
  /** Optional: Callback when entity leaves sight */
  onLost?: (observer: Entity, target: Entity) => void;
}

export const LineOfSightComponent = defineComponent<LineOfSight>();
