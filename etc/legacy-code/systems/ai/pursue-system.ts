import { System } from '@basegrid/ecs';
import { PursuerComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';
import { AIMovement } from '../../utils/ai-movement';

/**
 * Pursue System - Manages pursuer NPC behavior
 * 
 * Pursuers conditionally chase targets with a state machine:
 * - **Idle**: Wait for trigger condition
 * - **Chase**: Move toward target using pathfinding
 * 
 * State transitions:
 * - Trigger chase when target within range AND condition met
 * - Give up chase when target exceeds give-up range
 * - Catch target when adjacent (distance <= 1)
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const pursueSystem = new PursueSystem();
 * world.addSystem(pursueSystem);
 * 
 * // Create player
 * const player = world.createEntity();
 * world.addComponent(player, GridPositionComponent, { x: 3, y: 3, grid });
 * 
 * // Create pursuer (guard)
 * const guard = world.createEntity();
 * world.addComponent(guard, PursuerComponent, {
 *   targetEntity: player,
 *   triggerRange: 8,
 *   giveUpRange: 15,
 *   state: 'idle',
 *   triggerCondition: () => playerStoleItem
 * });
 * world.addComponent(guard, GridPositionComponent, { x: 20, y: 9, grid });
 * 
 * // System updates pursuer behavior each tick
 * world.update(16.67);
 * ```
 */
export class PursueSystem extends System {
  /**
   * Move pursuer toward target using pathfinding with layer-based collision
   */
  private moveToward(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    grid: any,
    pathfindingLimit: number
  ): { x: number; y: number } {
    const fromCell = grid.cell(fromX, fromY);
    const toCell = grid.cell(toX, toY);
    
    if (!fromCell || !toCell) {
      return { x: fromX, y: fromY };
    }
    
    // Find path using layer-based collision detection
    const path = fromCell.findPath(
      (c: any) => !this.isBlocked(c.x, c.y, grid),  // LAW: WALLS layer (5) = blocked
      (c: any) => c === toCell,
      pathfindingLimit
    );
    
    // Move to next step - path[0] is the next cell (path excludes origin)
    if (path && path.length > 0) {
      return { x: path[0].x, y: path[0].y };
    }
    
    return { x: fromX, y: fromY };
  }
  
  /**
   * Check if a cell is blocked using layer-based collision detection
   * LAW: Anything on the WALLS layer (layer 5) is blocking
   */
  private isBlocked(x: number, y: number, grid: any): boolean {
    const cell = grid.cell(x, y);
    if (!cell) return true; // Off grid = blocked
    
    // Check WALLS layer (layer 5) - if anything is there, it's blocked
    const WALLS_LAYER = 5; // GRID_LAYERS.WALLS
    return cell.values[WALLS_LAYER] !== undefined && cell.values[WALLS_LAYER] !== 0;
  }
  
  /**
   * Update all pursuers
   */
  update(_dt: number): void {
    // Process each pursuer
    for (const [entity, pursuer] of this.world.query(PursuerComponent)) {
      const pursuerPos = this.world.getComponent(entity, GridPositionComponent);
      if (!pursuerPos) continue;
      
      // Get target position
      const targetPos = this.world.getComponent(pursuer.targetEntity, GridPositionComponent);
      if (!targetPos) continue;
      
      // Only pursue if on same grid
      if (pursuerPos.grid !== targetPos.grid) continue;
      
      // Calculate distance to target
      const distance = AIMovement.manhattanDistance(
        pursuerPos.x,
        pursuerPos.y,
        targetPos.x,
        targetPos.y
      );
      
      // State machine
      if (pursuer.state === 'idle') {
        // Check if should start chasing
        const conditionMet = pursuer.triggerCondition ? pursuer.triggerCondition() : true;
        
        if (conditionMet && distance <= pursuer.triggerRange) {
          pursuer.state = 'chase';
        }
      } else if (pursuer.state === 'chase') {
        // Check if should give up
        if (distance > pursuer.giveUpRange) {
          pursuer.state = 'idle';
        } else if (distance <= 1) {
          // Caught the target!
          if (pursuer.onCatch) {
            pursuer.onCatch(entity, pursuer.targetEntity);
          }
          // Return to idle (application can reset state as needed)
          pursuer.state = 'idle';
        } else {
          // Continue chasing - move toward target
          const limit = pursuer.pathfindingLimit || 20;
          const newPos = this.moveToward(
            pursuerPos.x,
            pursuerPos.y,
            targetPos.x,
            targetPos.y,
            pursuerPos.grid,
            limit
          );
          
          pursuerPos.x = newPos.x;
          pursuerPos.y = newPos.y;
        }
      }
    }
  }
}
