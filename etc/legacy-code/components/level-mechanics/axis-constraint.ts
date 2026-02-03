import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import type { World } from '@basegrid/ecs';
import { GridPositionComponent } from '@basegrid/ecs';

/**
 * @component AxisConstraint
 * @icon maximize-2
 * @description Locks movement to axes or boundaries (paddles, rails)
 * 
 * Axis Constraint Component
 * 
 * Constrains entity movement to specific axes and/or boundaries.
 * 
 * Works with any movement system (player input, patrol, AI, etc.) by
 * providing a utility function that systems call to enforce constraints.
 * 
 * @property {boolean} lockX - Prevent horizontal (X-axis) movement
 * @property {boolean} lockY - Prevent vertical (Y-axis) movement
 * @property {number} minX - Minimum X boundary
 * @property {number} maxX - Maximum X boundary
 * @property {number} minY - Minimum Y boundary
 * @property {number} maxY - Maximum Y boundary
 * 
 * @example
 * ```typescript
 * // Horizontal paddle (can only move left/right)
 * world.addComponent(paddle, AxisConstraintComponent, {
 *   lockX: false,  // Can move horizontally
 *   lockY: true,   // Cannot move vertically
 *   minX: 0,
 *   maxX: gridWidth - paddleWidth
 * });
 * 
 * // In movement system:
 * const { x, y } = applyAxisConstraint(world, entity, targetX, targetY);
 * pos.x = x;
 * pos.y = y;
 * ```
 * 
 * @example
 * ```typescript
 * // Vertical yoyo obstacle (can only move up/down)
 * world.addComponent(obstacle, PatrolComponent, {
 *   waypoints: [{ x: 5, y: 0 }, { x: 5, y: 10 }],
 *   loop: true
 * });
 * world.addComponent(obstacle, AxisConstraintComponent, {
 *   lockX: true,   // Cannot move horizontally
 *   lockY: false,  // Can move vertically
 *   minY: 0,
 *   maxY: 10
 * });
 * ```
 */
export interface AxisConstraint {
  /** Prevent horizontal (X-axis) movement */
  lockX: boolean;
  
  /** Prevent vertical (Y-axis) movement */
  lockY: boolean;
  
  /** Minimum X boundary (optional) */
  minX?: number;
  
  /** Maximum X boundary (optional) */
  maxX?: number;
  
  /** Minimum Y boundary (optional) */
  minY?: number;
  
  /** Maximum Y boundary (optional) */
  maxY?: number;
}

export const AxisConstraintComponent = defineComponent<AxisConstraint>();

/**
 * Apply axis constraints to a target position.
 * 
 * This utility function should be called by movement systems before
 * updating an entity's position. It checks for AxisConstraintComponent
 * and enforces any specified axis locks and boundary constraints.
 * 
 * @param world - The ECS world
 * @param entity - The entity to check constraints for
 * @param targetX - The desired X position
 * @param targetY - The desired Y position
 * @returns The constrained position { x, y }
 * 
 * @example
 * ```typescript
 * // In a movement system
 * const targetX = pos.x + 1;
 * const targetY = pos.y;
 * 
 * const { x, y } = applyAxisConstraint(this.world, entity, targetX, targetY);
 * pos.x = x;
 * pos.y = y;
 * ```
 */
export function applyAxisConstraint(
  world: World,
  entity: Entity,
  targetX: number,
  targetY: number
): { x: number; y: number } {
  // Check if entity has constraint component
  const constraint = world.getComponent(entity, AxisConstraintComponent);
  
  // No constraint = no restrictions
  if (!constraint) {
    return { x: targetX, y: targetY };
  }
  
  // Get current position (needed for locked axes)
  const pos = world.getComponent(entity, GridPositionComponent);
  if (!pos) {
    // No position component = can't constrain
    return { x: targetX, y: targetY };
  }
  
  // Apply axis locks (preserve current position on locked axes)
  let finalX = constraint.lockX ? pos.x : targetX;
  let finalY = constraint.lockY ? pos.y : targetY;
  
  // Apply boundary constraints
  if (constraint.minX !== undefined) {
    finalX = Math.max(finalX, constraint.minX);
  }
  if (constraint.maxX !== undefined) {
    finalX = Math.min(finalX, constraint.maxX);
  }
  
  if (constraint.minY !== undefined) {
    finalY = Math.max(finalY, constraint.minY);
  }
  if (constraint.maxY !== undefined) {
    finalY = Math.min(finalY, constraint.maxY);
  }
  
  return { x: finalX, y: finalY };
}
