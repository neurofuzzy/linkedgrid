/**
 * Guard System
 * 
 * Handles guard NPC behavior: patrol routes, threat detection, alert state, and chase.
 */

import { System } from '@basegrid/ecs';
import { GuardComponent, GridPositionComponent, VisualComponent, TypeComponent } from '@basegrid/ecs';
import { LinkedGrid } from '@basegrid/core';
import { AIMovement } from '../../utils/ai-movement';

export interface GuardSystemConfig {
  /** Update frequency in ticks (e.g., 10 = update every 10 ticks) */
  updateInterval?: number;
  
  /** Cell value for patrol state visual */
  patrolCellValue?: number;
  
  /** Cell value for alert/chase state visual */
  alertCellValue?: number;
}

export class GuardSystem extends System {
  private config: Required<GuardSystemConfig>;
  private tickCount: number = 0;
  private grid: LinkedGrid<number> | null = null;

  constructor(grid: LinkedGrid<number>, config: GuardSystemConfig = {}) {
    super();
    this.grid = grid;
    this.config = {
      updateInterval: 10,
      patrolCellValue: 3,
      alertCellValue: 4,
      ...config
    };
  }

  update(_dt: number): void {
    this.tickCount++;
    
    // Only update guards at specified interval
    if (this.tickCount % this.config.updateInterval !== 0) {
      return;
    }

    for (const [entity, guard, pos, visual] of this.world.queryMultiple(
      GuardComponent,
      GridPositionComponent,
      VisualComponent
    )) {
      this.updateGuard(entity, guard, pos, visual);
    }
  }

  private updateGuard(
    entity: number,
    guard: GuardComponent,
    pos: GridPositionComponent,
    visual: VisualComponent
  ): void {
    // Find player entity (tagged as 'player')
    const playerPos = this.findPlayer();
    
    if (!playerPos || playerPos.grid !== pos.grid) {
      // No player or player on different grid, just patrol
      this.patrolBehavior(guard, pos);
      this.updateVisual(guard, visual);
      return;
    }

    const distToPlayer = AIMovement.manhattanDistance(pos.x, pos.y, playerPos.x, playerPos.y);

    switch (guard.state) {
      case 'patrol':
        this.patrolBehavior(guard, pos);
        
        // Check for player detection
        const hasLOS = guard.requireLineOfSight === false || this.hasLineOfSight(pos.x, pos.y, playerPos.x, playerPos.y);
        if (distToPlayer <= guard.alertRadius && hasLOS) {
          guard.state = 'alert';
          guard.alertTimer = guard.alertDuration;
        }
        break;

      case 'alert':
        // Alert state - spotted player, evaluate next action
        // If player is close (within alert radius) and in chase range, start chasing
        if (distToPlayer <= guard.alertRadius && distToPlayer <= guard.chaseRange) {
          guard.state = 'chase';
        } else {
          // Player not close enough or out of range, decrement alert timer
          guard.alertTimer = (guard.alertTimer || 0) - 1;
          
          if (guard.alertTimer <= 0) {
            // Timer expired - only chase if player is still within alert radius
            if (distToPlayer <= guard.alertRadius && distToPlayer <= guard.chaseRange) {
              guard.state = 'chase';
            } else {
              // Player too far, return to patrol
              guard.state = 'patrol';
            }
          }
        }
        break;

      case 'chase':
        // Check if caught player
        if (distToPlayer <= 1) {
          if (guard.onCatch) {
            guard.onCatch();
          }
          guard.state = 'patrol';
          break;
        }
        
        // Chase the player
        if (distToPlayer > guard.chaseRange) {
          // Player escaped, return to alert
          guard.state = 'alert';
          guard.alertTimer = guard.alertDuration || 30;
        } else if (distToPlayer > 1) {
          // Move toward player
          this.moveToward(guard, pos, playerPos.x, playerPos.y);
        }
        break;
    }

    this.updateVisual(guard, visual);
  }

  private patrolBehavior(guard: GuardComponent, pos: GridPositionComponent): void {
    if (guard.patrolPoints.length === 0) return;

    let target = guard.patrolPoints[guard.patrolIndex];
    
    if (pos.x === target.x && pos.y === target.y) {
      // Reached patrol point, move to next
      guard.patrolIndex = (guard.patrolIndex + 1) % guard.patrolPoints.length;
      target = guard.patrolPoints[guard.patrolIndex];
    }
    
    // Move toward current patrol point (either continuing or toward new point after cycling)
    if (pos.x !== target.x || pos.y !== target.y) {
      this.moveToward(guard, pos, target.x, target.y);
    }
  }

  private moveToward(
    guard: GuardComponent,
    pos: GridPositionComponent,
    targetX: number,
    targetY: number
  ): void {
    if (!this.grid) return;

    const dx = targetX - pos.x;
    const dy = targetY - pos.y;
    
    let newX = pos.x;
    let newY = pos.y;
    
    // Prefer moving on the axis with greater distance
    if (Math.abs(dx) > Math.abs(dy)) {
      newX = pos.x + Math.sign(dx);
    } else if (dy !== 0) {
      newY = pos.y + Math.sign(dy);
    }
    
    // Check if move is valid
    if (this.canMove(newX, newY)) {
      pos.x = newX;
      pos.y = newY;
      return;
    }
    
    // Try alternate axis
    if (Math.abs(dx) > Math.abs(dy)) {
      newY = pos.y + Math.sign(dy);
      newX = pos.x;
    } else {
      newX = pos.x + Math.sign(dx);
      newY = pos.y;
    }
    
    if (this.canMove(newX, newY)) {
      pos.x = newX;
      pos.y = newY;
    }
  }

  private canMove(x: number, y: number): boolean {
    if (!this.grid) return false;
    
    // Check grid bounds
    const cell = this.grid.cell(x, y);
    if (!cell) return false;

    // Check for walls using component-based collision
    for (const [_, type, gridPos] of this.world.queryMultiple(TypeComponent, GridPositionComponent)) {
      if (gridPos.x === x && gridPos.y === y) {
        if (type.tags?.includes('wall') || type.tags?.includes('impassable')) {
          return false;
        }
      }
    }

    return true;
  }

  private hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
    if (!this.grid) return false;

    const dx = Math.sign(x2 - x1);
    const dy = Math.sign(y2 - y1);
    
    let x = x1;
    let y = y1;
    
    while (x !== x2 || y !== y2) {
      if (Math.abs(x2 - x) > Math.abs(y2 - y)) {
        x += dx;
      } else {
        y += dy;
      }
      
      // Check grid cell value for walls (non-zero means blocked)
      const cell = this.grid.cell(x, y);
      if (cell && cell.values[0] !== 0) {
        return false;
      }
      
      // Also check for entities with wall tag
      for (const [_, type, gridPos] of this.world.queryMultiple(TypeComponent, GridPositionComponent)) {
        if (gridPos.x === x && gridPos.y === y) {
          if (type.tags?.includes('wall')) {
            return false;
          }
        }
      }
    }

    return true;
  }

  private findPlayer(): GridPositionComponent | null {
    for (const [_, type, pos] of this.world.queryMultiple(TypeComponent, GridPositionComponent)) {
      if (type.tags?.includes('player')) {
        return pos;
      }
    }
    return null;
  }


  private updateVisual(guard: GuardComponent, visual?: VisualComponent): void {
    if (!visual) return; // Skip if no visual component
    
    if (guard.state === 'patrol') {
      visual.cellValue = this.config.patrolCellValue;
    } else {
      // Both alert and chase use alertCellValue
      visual.cellValue = this.config.alertCellValue;
    }
  }
}
