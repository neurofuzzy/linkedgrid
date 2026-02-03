import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import type { Direction } from '@basegrid/grid';

/**
 * @component LeadTargeting
 * @icon crosshair
 * @description Calculates aim to intercept moving targets (turrets, missiles)
 * 
 * Lead Targeting Component
 * 
 * Calculates aim points to intercept moving targets.
 * Predicts where target will be when projectile arrives.
 * 
 * Examples:
 * - Turrets leading shots
 * - Smart missiles
 * - AI aiming at moving players
 * - Anti-aircraft fire
 * 
 * @property {Entity} target - Target entity to aim at
 * @property {number} projectileSpeed - Speed of projectile (cells/second)
 * @property {number} maxPredictionTime - Maximum prediction time (seconds)
 * @property {object} leadAimPoint - Calculated lead aim point (x, y)
 * @property {Direction} leadDirection - Calculated lead direction
 * @property {number} interceptTime - Time to intercept (seconds)
 * @property {boolean} canIntercept - Whether target is within range
 * @property {number} maxRange - Maximum range to consider
 * 
 * @example
 * ```typescript
 * // Create turret with lead targeting
 * const turret = world.createEntity();
 * world.addComponent(turret, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(turret, LeadTargetingComponent, {
 *   projectileSpeed: 5,
 *   maxPredictionTime: 2.0,
 *   target: playerEntity
 * });
 * 
 * // System calculates lead aim point
 * const leadSystem = world.getSystem(LeadTargetingSystem);
 * const aimPoint = leadSystem.getLeadAimPoint(turret);
 * ```
 */
export interface LeadTargeting {
  /** Target entity to aim at */
  target?: Entity;
  
  /** Speed of projectile (cells/second) */
  projectileSpeed: number;
  
  /** Maximum prediction time (seconds) */
  maxPredictionTime?: number;
  
  /** Calculated lead aim point (x, y) */
  leadAimPoint?: { x: number; y: number };
  
  /** Calculated lead direction */
  leadDirection?: Direction;
  
  /** Time to intercept (seconds) */
  interceptTime?: number;
  
  /** Whether target is within range */
  canIntercept?: boolean;
  
  /** Optional: Maximum range to consider */
  maxRange?: number;
  
  /** Optional: Callback when aim point updated */
  onAimUpdate?: (entity: Entity, aimPoint: { x: number; y: number }) => void;
}

export const LeadTargetingComponent = defineComponent<LeadTargeting>();
