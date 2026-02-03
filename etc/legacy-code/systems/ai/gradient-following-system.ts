/**
 * Gradient Following System
 * 
 * Moves entities along distance field gradients toward goals.
 */

import { System, GridPositionComponent, VisualComponent, TypeComponent } from '@basegrid/ecs';
import { GradientFollowerComponent } from '../../components/ai/gradient-follower';

export class GradientFollowingSystem extends System {
  update(_dt: number): void {
    for (const [entity, follower, pos, visual] of this.world.queryMultiple(
      GradientFollowerComponent,
      GridPositionComponent,
      VisualComponent
    )) {
      if (follower.active === false) continue;
      
      // Update movement tick counter
      const moveInterval = follower.moveInterval ?? 10;
      follower.moveTick = (follower.moveTick ?? 0) + 1;
      
      if (follower.moveTick < moveInterval) continue;
      
      // Reset tick counter
      follower.moveTick = 0;
      
      // Try to move toward goal
      this.moveTowardGoal(entity, follower, pos, visual);
    }
  }
  
  private moveTowardGoal(
    entity: number,
    follower: GradientFollowerComponent,
    pos: GridPositionComponent,
    visual: VisualComponent
  ): void {
    const cell = pos.grid.cell(pos.x, pos.y);
    if (!cell) return;
    
    const distanceLayer = follower.distanceLayer ?? 0;
    const currentDist = cell.distances[distanceLayer];
    if (currentDist === undefined || currentDist < 0) return;
    
    // Find neighbor with lowest distance
    let bestNeighbor = null;
    let bestDist = currentDist;
    
    const neighbors = cell.neighbors().filter(n => n !== null);
    for (const neighbor of neighbors) {
      // Check if this neighbor has entity blocking it
      let blocked = false;
      for (const [otherEntity, otherPos, otherType] of this.world.queryMultiple(GridPositionComponent, TypeComponent)) {
        if (otherPos.grid === pos.grid && otherPos.x === neighbor.x && otherPos.y === neighbor.y) {
          // Allow moving to goals
          if (otherType.tags?.includes('goal')) {
            continue;
          }
          
          // Check if it's a wall or another follower (don't allow)
          const otherFollower = this.world.getComponent(otherEntity, GradientFollowerComponent);
          if (!otherFollower || otherType.tags?.includes('wall')) {
            blocked = true;
            break;
          }
        }
      }
      
      if (blocked) continue;
      
      const dist = neighbor.distances[distanceLayer];
      if (dist !== undefined && dist >= 0 && dist < bestDist) {
        bestDist = dist;
        bestNeighbor = neighbor;
      }
    }
    
    // Move to best neighbor
    if (bestNeighbor) {
      pos.x = bestNeighbor.x;
      pos.y = bestNeighbor.y;
      
      // Check if reached goal (either by cell value or by entity at position)
      let reachedGoal = false;
      
      // Check cell value
      if (follower.goalValues && follower.goalValues.includes(bestNeighbor.values[0])) {
        reachedGoal = true;
      }
      
      // Check if there's a goal entity at this position
      for (const [_, goalPos, goalType] of this.world.queryMultiple(GridPositionComponent, TypeComponent)) {
        if (goalPos.grid === pos.grid && goalPos.x === pos.x && goalPos.y === pos.y) {
          if (goalType.tags?.includes('goal')) {
            reachedGoal = true;
            break;
          }
        }
      }
      
      if (reachedGoal && follower.onReachGoal) {
        follower.onReachGoal(entity);
      }
    }
  }
}
