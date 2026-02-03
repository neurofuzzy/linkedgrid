import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { GridPositionComponent, TypeComponent } from '@basegrid/ecs';
import { WaypointComponent, WaypointNavigatorComponent } from '@basegrid/gameplay';

/**
 * Waypoint Navigation System
 * 
 * Manages entities that navigate between waypoints.
 * Entities move toward their current waypoint and automatically
 * advance to the next waypoint when reached.
 * 
 * Features:
 * - Automatic waypoint sequencing
 * - Looping routes
 * - Speed control
 * - Reach callbacks
 * 
 * @example
 * ```typescript
 * const waypointSystem = new WaypointSystem();
 * world.addSystem(waypointSystem);
 * 
 * // Create waypoints
 * const wp1 = world.createEntity();
 * world.addComponent(wp1, GridPositionComponent, { x: 10, y: 5, grid });
 * world.addComponent(wp1, WaypointComponent, { waypointId: 'wp1', nextWaypoint: 'wp2' });
 * 
 * // Create navigator
 * const entity = world.createEntity();
 * world.addComponent(entity, GridPositionComponent, { x: 0, y: 5, grid });
 * world.addComponent(entity, WaypointNavigatorComponent, {
 *   currentWaypointId: 'wp1',
 *   moveSpeed: 2
 * });
 * ```
 */
export class WaypointSystem extends System {
  /**
   * Update all waypoint navigators.
   */
  update(dt: number): void {
    for (const [entity, navigator] of this.world.query(WaypointNavigatorComponent)) {
      // Skip if not active
      if (navigator.active === false) continue;

      // Get entity position
      const pos = this.world.getComponent(entity, GridPositionComponent);
      if (!pos) continue;

      // Find current waypoint if needed
      if (navigator.currentWaypointId && !navigator.currentWaypoint) {
        navigator.currentWaypoint = this.findWaypointById(navigator.currentWaypointId, navigator.waypointTags);
      }

      // No waypoint to navigate to
      if (!navigator.currentWaypoint) continue;

      // Get waypoint position
      const waypointPos = this.world.getComponent(navigator.currentWaypoint, GridPositionComponent);
      if (!waypointPos || waypointPos.grid !== pos.grid) continue;

      // Check if reached waypoint
      if (pos.x === waypointPos.x && pos.y === waypointPos.y) {
        this.onWaypointReached(entity, navigator, navigator.currentWaypoint);
        continue;
      }

      // Move toward waypoint
      this.moveToward(entity, pos, waypointPos, navigator.moveSpeed ?? 1, dt);
    }
  }

  /**
   * Find a waypoint by ID.
   */
  private findWaypointById(waypointId: string, tags?: string[]): Entity | undefined {
    for (const [entity, waypoint] of this.world.query(WaypointComponent)) {
      if (waypoint.waypointId !== waypointId) continue;

      // Check tags if specified
      if (tags && tags.length > 0) {
        const type = this.world.getComponent(entity, TypeComponent);
        const entityTags = type?.tags || [];
        if (!tags.some(tag => entityTags.includes(tag))) continue;
      }

      return entity;
    }
    return undefined;
  }

  /**
   * Handle waypoint reached.
   */
  private onWaypointReached(entity: Entity, navigator: WaypointNavigatorComponent, waypoint: Entity): void {
    // Fire callbacks
    const waypointComp = this.world.getComponent(waypoint, WaypointComponent);
    if (waypointComp?.onReach) {
      waypointComp.onReach(entity, waypoint);
    }
    if (navigator.onWaypointReached) {
      navigator.onWaypointReached(entity, waypoint);
    }

    // Advance to next waypoint
    if (waypointComp?.nextWaypoint) {
      navigator.currentWaypointId = waypointComp.nextWaypoint;
      navigator.currentWaypoint = undefined; // Force re-lookup
    } else if (waypointComp?.terminal || !navigator.loop) {
      // Reached end
      if (navigator.onComplete) {
        navigator.onComplete(entity);
      }
      navigator.active = false;
    } else {
      // No next waypoint and no loop - stop
      navigator.active = false;
    }
  }

  /**
   * Move entity toward target position.
   */
  private moveToward(
    entity: Entity,
    pos: { x: number; y: number },
    target: { x: number; y: number },
    speed: number,
    dt: number
  ): void {
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const distance = Math.abs(dx) + Math.abs(dy);

    if (distance === 0) return;

    // Calculate movement for this frame
    const moveAmount = (speed * dt) / 1000;

    // Move one step at a time (grid-based movement)
    if (moveAmount >= 1) {
      if (Math.abs(dx) > Math.abs(dy)) {
        pos.x += Math.sign(dx);
      } else {
        pos.y += Math.sign(dy);
      }
    }
  }
}
