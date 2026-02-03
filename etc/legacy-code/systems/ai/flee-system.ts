import { System } from '@basegrid/ecs';
import { FleeComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { AIMovement } from '../../utils/ai-movement';

/**
 * Flee System - Manages fleeing NPC behavior
 * 
 * NPCs with FleeComponent run away from threats:
 * - Calm when threat is far (> safeDistance)
 * - Flee when threat gets close (< panicDistance)
 * - Pick direction that maximizes distance from threat
 * - Uses component-based collision detection (checks TypeComponent tags)
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const fleeSystem = new FleeSystem();
 * world.addSystem(fleeSystem);
 * 
 * // Create player (threat)
 * const player = world.createEntity();
 * world.addComponent(player, GridPositionComponent, { x: 12, y: 9, grid });
 * 
 * // Create fleeing NPC
 * const rabbit = world.createEntity();
 * world.addComponent(rabbit, FleeComponent, {
 *   threatEntity: player,
 *   panicDistance: 3,
 *   safeDistance: 7,
 *   state: 'calm'
 * });
 * world.addComponent(rabbit, GridPositionComponent, { x: 8, y: 4, grid });
 * 
 * // System makes NPC flee when player approaches
 * world.update(16.67);
 * ```
 */
export class FleeSystem extends System {
  /**
   * Move away from threat by checking all cardinal directions.
   * Uses component-based collision detection.
   */
  private moveAwayFrom(
    fromX: number,
    fromY: number,
    threatX: number,
    threatY: number,
    grid: any,
    excludeEntity: Entity,
    otherFleeingPositions: Array<{ x: number; y: number }>
  ): { x: number; y: number } {
    let bestX = fromX;
    let bestY = fromY;
    let bestDist = AIMovement.manhattanDistance(fromX, fromY, threatX, threatY);
    
    // Check all 4 cardinal directions
    const directions = [
      { x: 0, y: -1 },  // Up
      { x: 0, y: 1 },   // Down
      { x: -1, y: 0 },  // Left
      { x: 1, y: 0 },   // Right
    ];
    
    for (const dir of directions) {
      const newX = fromX + dir.x;
      const newY = fromY + dir.y;
      
      // Skip blocked cells (walls/impassable, using component-based collision)
      if (AIMovement.isBlocked(this.world, newX, newY, grid, excludeEntity)) continue;
      
      // Skip if another fleeing NPC is there
      const occupied = otherFleeingPositions.some(
        pos => pos.x === newX && pos.y === newY
      );
      if (occupied) continue;
      
      // Calculate distance from threat
      const dist = AIMovement.manhattanDistance(newX, newY, threatX, threatY);
      
      // Pick direction that maximizes distance
      if (dist > bestDist) {
        bestX = newX;
        bestY = newY;
        bestDist = dist;
      }
    }
    
    return { x: bestX, y: bestY };
  }
  
  /**
   * Update all fleeing NPCs
   */
  update(_dt: number): void {
    // Collect all fleeing NPC positions (to avoid collision)
    const fleeingPositions: Array<{ x: number; y: number }> = [];
    
    for (const [_, fleeComp] of this.world.query(FleeComponent)) {
      if (fleeComp.state === 'fleeing') {
        const pos = this.world.getComponent(_, GridPositionComponent);
        if (pos) {
          fleeingPositions.push({ x: pos.x, y: pos.y });
        }
      }
    }
    
    // Process each fleeing NPC
    for (const [entity, flee] of this.world.query(FleeComponent)) {
      const npcPos = this.world.getComponent(entity, GridPositionComponent);
      if (!npcPos) continue;
      
      const threatPos = this.world.getComponent(flee.threatEntity, GridPositionComponent);
      if (!threatPos) continue;
      
      // Only operate on same grid
      if (npcPos.grid !== threatPos.grid) continue;
      
      const distance = AIMovement.manhattanDistance(npcPos.x, npcPos.y, threatPos.x, threatPos.y);
      
      // State machine
      if (flee.state === 'calm') {
        // Check if should start fleeing
        if (distance <= flee.panicDistance) {
          flee.state = 'fleeing';
        }
      } else if (flee.state === 'fleeing') {
        // Check if caught
        if (distance <= 1) {
          if (flee.onCaught) {
            flee.onCaught(entity, flee.threatEntity);
          }
          // Stay fleeing (application can reset state)
        } else if (distance >= flee.safeDistance) {
          // Safe now, return to calm
          flee.state = 'calm';
        } else {
          // Continue fleeing - move away
          const newPos = this.moveAwayFrom(
            npcPos.x,
            npcPos.y,
            threatPos.x,
            threatPos.y,
            npcPos.grid,
            entity, // Exclude self from collision checks
            fleeingPositions.filter(p => p.x !== npcPos.x || p.y !== npcPos.y)
          );
          
          npcPos.x = newPos.x;
          npcPos.y = newPos.y;
        }
      }
    }
  }
}
