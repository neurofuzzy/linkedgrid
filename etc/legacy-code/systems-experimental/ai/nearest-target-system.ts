import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { GridPositionComponent, TypeComponent, SpatialQuerySystem } from '@basegrid/ecs';
import { NearestTargetComponent } from '@basegrid/gameplay';

/**
 * Nearest Target System
 * 
 * Manages entities with NearestTargetComponent, tracking the nearest matching entity.
 * Leverages SpatialQuerySystem.findNearest() for efficient queries.
 * 
 * Features:
 * - Automatic nearest target tracking
 * - Tag-based filtering
 * - Acquire/change/lost callbacks
 * - Configurable max range
 * - Custom distance functions
 * - Uses existing SpatialQuerySystem infrastructure
 * 
 * @example
 * ```typescript
 * const nearestTargetSystem = new NearestTargetSystem();
 * world.addSystem(nearestTargetSystem);
 * 
 * // Create homing missile
 * const missile = world.createEntity();
 * world.addComponent(missile, GridPositionComponent, { x: 5, y: 5, grid });
 * world.addComponent(missile, NearestTargetComponent, {
 *   targetTags: ['enemy'],
 *   maxRange: 15,
 *   onAcquire: (entity, target) => {
 *     console.log('Missile locked on');
 *   }
 * });
 * ```
 */
export class NearestTargetSystem extends System {
  /**
   * Update all nearest target trackers.
   */
  update(dt: number): void {
    // Get SpatialQuerySystem
    const spatialQuery = this.world.getSystem(SpatialQuerySystem);
    if (!spatialQuery) return;

    for (const [entity, tracker] of this.world.query(NearestTargetComponent)) {
      // Get position
      const pos = this.world.getComponent(entity, GridPositionComponent);
      if (!pos) continue;

      // Handle cooldown
      if (tracker.updateCooldown && tracker.updateCooldown > 0) {
        tracker.updateTimer = (tracker.updateTimer ?? 0) + dt;
        if (tracker.updateTimer < tracker.updateCooldown) continue;
        tracker.updateTimer = 0;
      }

      // Skip if not continuous and already has target
      if (tracker.continuous === false && tracker.currentTarget !== undefined) continue;

      // Build filter function
      const filterFn = (target: Entity): boolean => {
        if (target === entity) return false; // Skip self

        // Check if entity still exists
        if (!this.world.hasEntity(target)) return false;

        // Check tag filters
        if (tracker.targetTags || tracker.ignoreTags) {
          const type = this.world.getComponent(target, TypeComponent);
          const tags = type?.tags || [];

          if (tracker.ignoreTags && tracker.ignoreTags.some(tag => tags.includes(tag))) {
            return false;
          }

          if (tracker.targetTags && !tracker.targetTags.some(tag => tags.includes(tag))) {
            return false;
          }
        }

        return true;
      };

      // Use custom distance function or default Manhattan distance
      const distanceFn = tracker.distanceFn || ((x1: number, y1: number, x2: number, y2: number) => {
        return Math.abs(x2 - x1) + Math.abs(y2 - y1);
      });

      // Find nearest entity using SpatialQuerySystem
      const nearest = spatialQuery.findNearest(pos.grid, pos.x, pos.y, filterFn);

      // Calculate distance
      let distance = Infinity;
      if (nearest) {
        const nearestPos = this.world.getComponent(nearest, GridPositionComponent);
        if (nearestPos) {
          distance = distanceFn(pos.x, pos.y, nearestPos.x, nearestPos.y);
        }
      }

      // Check max range
      const maxRange = tracker.maxRange ?? Infinity;
      const validTarget = nearest && distance <= maxRange ? nearest : undefined;

      // Handle target changes
      const previousTarget = tracker.currentTarget;

      if (validTarget !== previousTarget) {
        if (validTarget) {
          // New target acquired
          tracker.currentTarget = validTarget;
          tracker.currentDistance = distance;

          if (!previousTarget && tracker.onAcquire) {
            tracker.onAcquire(entity, validTarget, distance);
          } else if (previousTarget && tracker.onChange) {
            tracker.onChange(entity, validTarget, previousTarget);
          }
        } else {
          // Lost target
          if (previousTarget) {
            if (tracker.onLost) {
              tracker.onLost(entity, previousTarget);
            }
          }
          tracker.currentTarget = undefined;
          tracker.currentDistance = undefined;
        }
      } else if (validTarget) {
        // Same target, update distance
        tracker.currentDistance = distance;
      }
    }
  }
}
