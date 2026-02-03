import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { GridPositionComponent } from '@basegrid/ecs';
import { PatrolComponent, applyAxisConstraint } from '@basegrid/gameplay';

/**
 * Patrol System
 * 
 * Manages entities that patrol between waypoints.
 * Supports looping and reversing patrol routes.
 * 
 * Features:
 * - Loop or reverse at endpoints
 * - Pause at waypoints
 * - Speed control
 * - Waypoint callbacks
 * 
 * @example
 * ```typescript
 * const patrolSystem = new PatrolSystem();
 * world.addSystem(patrolSystem);
 * 
 * const guard = world.createEntity();
 * world.addComponent(guard, GridPositionComponent, { x: 0, y: 0, grid });
 * world.addComponent(guard, PatrolComponent, {
 *   waypoints: [
 *     { x: 0, y: 0 },
 *     { x: 10, y: 0 },
 *     { x: 10, y: 10 }
 *   ],
 *   loop: true,
 *   moveSpeed: 2
 * });
 * ```
 */
export class PatrolSystem extends System {
  /**
   * Update all patrolling entities.
   */
  update(dt: number): void {
    for (const [entity, patrol] of this.world.query(PatrolComponent)) {
      // Skip if not active
      if (patrol.active === false) continue;

      // Initialize defaults
      if (patrol.currentIndex === undefined) patrol.currentIndex = 0;
      if (patrol.direction === undefined) patrol.direction = 1;
      if (patrol.moveSpeed === undefined) patrol.moveSpeed = 1;

      // No waypoints
      if (!patrol.waypoints || patrol.waypoints.length === 0) continue;

      // Get entity position
      const pos = this.world.getComponent(entity, GridPositionComponent);
      if (!pos) continue;

      // Get current waypoint
      const currentWaypoint = patrol.waypoints[patrol.currentIndex];
      if (!currentWaypoint) continue;

      // Handle pause
      if (patrol.pauseTimer !== undefined && patrol.pauseTimer > 0) {
        patrol.pauseTimer -= dt;
        continue;
      }

      // Check if reached waypoint
      if (pos.x === currentWaypoint.x && pos.y === currentWaypoint.y) {
        this.onWaypointReached(entity, patrol);
        continue;
      }

      // Move toward waypoint
      this.moveToward(entity, pos, currentWaypoint, patrol.moveSpeed, dt);
    }
  }

  /**
   * Handle waypoint reached.
   */
  private onWaypointReached(entity: Entity, patrol: PatrolComponent): void {
    const currentWaypoint = patrol.waypoints[patrol.currentIndex!];

    // Fire callback
    if (patrol.onWaypointReached) {
      patrol.onWaypointReached(entity, patrol.currentIndex!);
    }

    // Set pause timer if specified
    if (currentWaypoint.pauseDuration) {
      patrol.pauseTimer = currentWaypoint.pauseDuration;
    }

    // Advance to next waypoint
    const nextIndex = patrol.currentIndex! + patrol.direction!;

    if (nextIndex >= patrol.waypoints.length) {
      // Reached end
      if (patrol.loop) {
        // Loop back to start
        patrol.currentIndex = 0;
        if (patrol.onCycleComplete) {
          patrol.onCycleComplete(entity);
        }
      } else {
        // Reverse direction
        patrol.direction = -1;
        patrol.currentIndex = patrol.waypoints.length - 2;
        if (patrol.onCycleComplete) {
          patrol.onCycleComplete(entity);
        }
      }
    } else if (nextIndex < 0) {
      // Reached start (reversing)
      patrol.direction = 1;
      patrol.currentIndex = 1;
      if (patrol.onCycleComplete) {
        patrol.onCycleComplete(entity);
      }
    } else {
      // Normal advancement
      patrol.currentIndex = nextIndex;
    }
  }

  /**
   * Move entity toward target position.
   * Respects axis constraints if present.
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
      // Calculate target position
      let targetX = pos.x;
      let targetY = pos.y;
      
      if (Math.abs(dx) > Math.abs(dy)) {
        targetX += Math.sign(dx);
      } else {
        targetY += Math.sign(dy);
      }
      
      // Apply axis constraints
      const constrained = applyAxisConstraint(this.world, entity, targetX, targetY);
      pos.x = constrained.x;
      pos.y = constrained.y;
    }
  }
}
