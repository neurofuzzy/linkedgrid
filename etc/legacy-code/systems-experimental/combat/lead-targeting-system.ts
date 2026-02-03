import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { LeadTargetingComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';
import { VelocityComponent } from '@basegrid/ecs';
import { Direction } from '@basegrid/grid';

/**
 * Lead Targeting System
 * 
 * Calculates intercept points for moving targets.
 * Uses target velocity and projectile speed to predict aim point.
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const leadSystem = new LeadTargetingSystem();
 * world.addSystem(leadSystem);
 * 
 * // Create turret
 * const turret = world.createEntity();
 * world.addComponent(turret, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(turret, LeadTargetingComponent, {
 *   projectileSpeed: 5,
 *   target: enemy
 * });
 * 
 * world.update(0.016);
 * 
 * // Get calculated aim point
 * const lead = world.getComponent(turret, LeadTargetingComponent);
 * console.log(lead.leadAimPoint); // { x: 15, y: 12 }
 * ```
 */
export class LeadTargetingSystem extends System {
  /**
   * Calculate direction from one point to another
   */
  private getDirectionTo(x1: number, y1: number, x2: number, y2: number): Direction {
    const dx = x2 - x1;
    const dy = y2 - y1;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? Direction.RT : Direction.LT;
    } else if (Math.abs(dy) > 0.001) {
      return dy > 0 ? Direction.DN : Direction.UP;
    }
    return Direction.NONE;
  }
  
  /**
   * Update all lead targeting entities
   */
  update(_dt: number): void {
    for (const [entity, lead] of this.world.query(LeadTargetingComponent)) {
      if (!lead.target) continue;
      
      this.calculateLeadAimPoint(entity, lead);
    }
  }
  
  /**
   * Calculate lead aim point for entity
   */
  private calculateLeadAimPoint(entity: Entity, lead: LeadTargeting): void {
    const pos = this.world.getComponent(entity, GridPositionComponent);
    const target = lead.target;
    if (!pos || !target) return;
    
    const targetPos = this.world.getComponent(target, GridPositionComponent);
    if (!targetPos) return;
    
    // Get target velocity
    const targetVel = this.world.getComponent(target, VelocityComponent);
    const dx = targetVel?.dx ?? 0;
    const dy = targetVel?.dy ?? 0;
    
    // If target not moving, aim directly at it
    if (dx === 0 && dy === 0) {
      lead.leadAimPoint = { x: targetPos.x, y: targetPos.y };
      lead.interceptTime = 0;
      lead.canIntercept = true;
      lead.leadDirection = this.getDirectionTo(pos.x, pos.y, targetPos.x, targetPos.y);
      return;
    }
    
    // Calculate intercept point
    const result = this.calculateIntercept(
      pos.x, pos.y,
      targetPos.x, targetPos.y,
      dx, dy,
      lead.projectileSpeed,
      lead.maxPredictionTime,
      lead.maxRange
    );
    
    // Update component
    lead.leadAimPoint = result.aimPoint;
    lead.interceptTime = result.interceptTime;
    lead.canIntercept = result.canIntercept;
    lead.leadDirection = result.direction;
    
    if (result.canIntercept && lead.onAimUpdate) {
      lead.onAimUpdate(entity, result.aimPoint);
    }
  }
  
  /**
   * Calculate intercept point for moving target
   * Uses quadratic formula to solve for intercept time
   */
  private calculateIntercept(
    shooterX: number,
    shooterY: number,
    targetX: number,
    targetY: number,
    targetDx: number,
    targetDy: number,
    projectileSpeed: number,
    maxPredictionTime = 10,
    maxRange?: number
  ): {
    aimPoint: { x: number; y: number };
    interceptTime: number;
    canIntercept: boolean;
    direction: any;
  } {
    // Relative position
    const rx = targetX - shooterX;
    const ry = targetY - shooterY;
    
    // Solve quadratic: (targetVel^2 - projectileSpeed^2) * t^2 + 2 * (r · targetVel) * t + r^2 = 0
    const a = targetDx * targetDx + targetDy * targetDy - projectileSpeed * projectileSpeed;
    const b = 2 * (rx * targetDx + ry * targetDy);
    const c = rx * rx + ry * ry;
    
    let interceptTime = 0;
    
    // If a is near zero, target and projectile have same speed
    if (Math.abs(a) < 0.001) {
      // Linear solution: t = -c / b
      if (Math.abs(b) > 0.001) {
        interceptTime = -c / b;
      } else {
        interceptTime = 0;
      }
    } else {
      // Quadratic solution
      const discriminant = b * b - 4 * a * c;
      
      if (discriminant < 0) {
        // No solution - can't intercept
        return {
          aimPoint: { x: targetX, y: targetY },
          interceptTime: 0,
          canIntercept: false,
          direction: this.getDirectionTo(shooterX, shooterY, targetX, targetY)
        };
      }
      
      const sqrtDisc = Math.sqrt(discriminant);
      const t1 = (-b + sqrtDisc) / (2 * a);
      const t2 = (-b - sqrtDisc) / (2 * a);
      
      // Pick smallest positive time
      if (t1 >= 0 && t2 >= 0) {
        interceptTime = Math.min(t1, t2);
      } else if (t1 >= 0) {
        interceptTime = t1;
      } else if (t2 >= 0) {
        interceptTime = t2;
      } else {
        // Both negative - can't intercept
        return {
          aimPoint: { x: targetX, y: targetY },
          interceptTime: 0,
          canIntercept: false,
          direction: this.getDirectionTo(shooterX, shooterY, targetX, targetY)
        };
      }
    }
    
    // Check prediction time limit
    if (interceptTime > maxPredictionTime) {
      return {
        aimPoint: { x: targetX, y: targetY },
        interceptTime,
        canIntercept: false,
        direction: this.getDirectionTo(shooterX, shooterY, targetX, targetY)
      };
    }
    
    // Calculate aim point
    const aimX = targetX + targetDx * interceptTime;
    const aimY = targetY + targetDy * interceptTime;
    
    // Check range limit
    if (maxRange !== undefined) {
      const distance = Math.sqrt((aimX - shooterX) ** 2 + (aimY - shooterY) ** 2);
      if (distance > maxRange) {
        return {
          aimPoint: { x: targetX, y: targetY },
          interceptTime,
          canIntercept: false,
          direction: this.getDirectionTo(shooterX, shooterY, targetX, targetY)
        };
      }
    }
    
    return {
      aimPoint: { x: aimX, y: aimY },
      interceptTime,
      canIntercept: true,
      direction: this.getDirectionTo(shooterX, shooterY, aimX, aimY)
    };
  }
  
  /**
   * Get lead aim point for entity
   */
  getLeadAimPoint(entity: Entity): { x: number; y: number } | undefined {
    const lead = this.world.getComponent(entity, LeadTargetingComponent);
    return lead?.leadAimPoint;
  }
  
  /**
   * Get lead direction for entity
   */
  getLeadDirection(entity: Entity): any {
    const lead = this.world.getComponent(entity, LeadTargetingComponent);
    return lead?.leadDirection;
  }
  
  /**
   * Set target for lead targeting
   */
  setTarget(entity: Entity, target: Entity): void {
    const lead = this.world.getComponent(entity, LeadTargetingComponent);
    if (!lead) return;
    
    lead.target = target;
  }
}
