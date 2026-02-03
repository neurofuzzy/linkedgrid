import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { FollowerComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';
import { AIMovement } from '../../utils/ai-movement';

/**
 * Follow System - Manages follower NPC behavior
 * 
 * Updates follower entities to maintain distance from their target:
 * - When too close (< minDistance): Moves away
 * - When too far (> maxDistance): Moves toward using pathfinding
 * - When in range: Stays in place
 * 
 * Uses **component-based collision detection** (checking for entities with
 * blocking layers and wall/impassable tags) instead of hardcoded cell values.
 * This allows followers to navigate around any blocking entity regardless of
 * visual appearance.
 * 
 * Followers navigate around obstacles using LinkedGrid pathfinding with
 * proper collision detection via TypeComponent tags and layer checking.
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const followSystem = new FollowSystem();
 * world.addSystem(followSystem);
 * 
 * // Create player
 * const player = world.createEntity();
 * world.addComponent(player, GridPositionComponent, { x: 10, y: 10, grid });
 * 
 * // Create follower
 * const follower = world.createEntity();
 * world.addComponent(follower, FollowerComponent, {
 *   targetEntity: player,
 *   minDistance: 2,
 *   maxDistance: 4
 * });
 * world.addComponent(follower, GridPositionComponent, { x: 5, y: 5, grid });
 * 
 * // System will update follower position each tick
 * world.update(16.67);
 * ```
 */
export class FollowSystem extends System {
  /**
   * Move follower toward target using pathfinding
   */
  private moveToward(
    followerEntity: Entity,
    followerX: number,
    followerY: number,
    targetX: number,
    targetY: number,
    grid: any,
    pathfindingLimit: number
  ): { x: number; y: number } {
    const fromCell = grid.cell(followerX, followerY);
    const toCell = grid.cell(targetX, targetY);
    
    if (!fromCell || !toCell) {
      return { x: followerX, y: followerY };
    }
    
    // Find path using component-based collision (not hardcoded cell values!)
    const path = fromCell.findPath(
      (c: any) => {
        if (!c) return false;
        // Check if this cell is blocked using proper collision detection
        return !AIMovement.isBlocked(this.world, c.x, c.y, grid, followerEntity);
      },
      (c: any) => c === toCell,
      pathfindingLimit
    );
    
    // Move to next step (skip index 0, which is the current cell)
    if (path && path.length > 0) {
      return { x: path[0].x, y: path[0].y };
    }
    
    return { x: followerX, y: followerY };
  }
  
  /**
   * Move follower away from target
   */
  private moveAway(
    followerEntity: Entity,
    followerX: number,
    followerY: number,
    targetX: number,
    targetY: number,
    grid: any
  ): { x: number; y: number } {
    const dx = followerX - targetX;
    const dy = followerY - targetY;
    
    let newX = followerX;
    let newY = followerY;
    
    // Try to increase distance (prioritize larger delta)
    if (Math.abs(dx) > Math.abs(dy)) {
      newX = followerX + Math.sign(dx);
    } else if (dy !== 0) {
      newY = followerY + Math.sign(dy);
    } else {
      newX = followerX + Math.sign(dx);
    }
    
    // Check if new position is valid using component-based collision
    const cell = grid.cell(newX, newY);
    if (cell && !AIMovement.isBlocked(this.world, newX, newY, grid, followerEntity)) {
      return { x: newX, y: newY };
    }
    
    // Try alternate axis
    if (Math.abs(dx) > Math.abs(dy)) {
      newY = followerY + Math.sign(dy);
      newX = followerX;
    } else {
      newX = followerX + Math.sign(dx);
      newY = followerY;
    }
    
    const altCell = grid.cell(newX, newY);
    if (altCell && !AIMovement.isBlocked(this.world, newX, newY, grid, followerEntity)) {
      return { x: newX, y: newY };
    }
    
    // Stuck, don't move
    return { x: followerX, y: followerY };
  }
  
  /**
   * Update all followers
   */
  update(_dt: number): void {
    // Process each follower
    for (const [entity, follower] of this.world.query(FollowerComponent)) {
      const followerPos = this.world.getComponent(entity, GridPositionComponent);
      if (!followerPos) continue;
      
      // Get target position
      const targetPos = this.world.getComponent(follower.targetEntity, GridPositionComponent);
      if (!targetPos) continue;
      
      // Only follow if on same grid
      if (followerPos.grid !== targetPos.grid) continue;
      
      // Calculate distance
      const distance = AIMovement.manhattanDistance(
        followerPos.x,
        followerPos.y,
        targetPos.x,
        targetPos.y
      );
      
      // Determine action based on distance
      let newPos = { x: followerPos.x, y: followerPos.y };
      
      if (distance < follower.minDistance) {
        // Too close - move away
        newPos = this.moveAway(
          entity,
          followerPos.x,
          followerPos.y,
          targetPos.x,
          targetPos.y,
          followerPos.grid
        );
      } else if (distance > follower.maxDistance) {
        // Too far - move toward using pathfinding
        const limit = follower.pathfindingLimit || 20;
        newPos = this.moveToward(
          entity,
          followerPos.x,
          followerPos.y,
          targetPos.x,
          targetPos.y,
          followerPos.grid,
          limit
        );
      }
      // else: in range, don't move
      
      // Update position
      followerPos.x = newPos.x;
      followerPos.y = newPos.y;
    }
  }
}
