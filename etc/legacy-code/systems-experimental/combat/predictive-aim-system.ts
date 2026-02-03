import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { PredictiveAimComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';
import { VelocityComponent } from '@basegrid/ecs';

/**
 * Predictive Aim System
 * 
 * Calculates simple linear predictions for moving targets.
 * Uses target velocity to estimate future position.
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const aimSystem = new PredictiveAimSystem();
 * world.addSystem(aimSystem);
 * 
 * // Create enemy with aim prediction
 * const enemy = world.createEntity();
 * world.addComponent(enemy, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(enemy, PredictiveAimComponent, {
 *   target: player,
 *   predictionTime: 0.5
 * });
 * 
 * world.update(0.016);
 * 
 * // Get predicted aim point
 * const aim = world.getComponent(enemy, PredictiveAimComponent);
 * console.log(aim.predictedPosition); // { x: 15, y: 12 }
 * ```
 */
export class PredictiveAimSystem extends System {
  /**
   * Update all predictive aim entities
   */
  update(_dt: number): void {
    for (const [entity, aim] of this.world.query(PredictiveAimComponent)) {
      if (!aim.target) {
        aim.valid = false;
        continue;
      }
      
      this.calculatePrediction(entity, aim);
    }
  }
  
  /**
   * Calculate predicted position for target
   */
  private calculatePrediction(entity: Entity, aim: PredictiveAim): void {
    const target = aim.target;
    if (!target) {
      aim.valid = false;
      return;
    }
    
    const targetPos = this.world.getComponent(target, GridPositionComponent);
    if (!targetPos) {
      aim.valid = false;
      return;
    }
    
    // Get target velocity
    const targetVel = this.world.getComponent(target, VelocityComponent);
    const dx = targetVel?.dx ?? 0;
    const dy = targetVel?.dy ?? 0;
    
    // Calculate predicted position using linear extrapolation
    let predictedX = targetPos.x + dx * aim.predictionTime;
    let predictedY = targetPos.y + dy * aim.predictionTime;
    
    // Apply offset if specified
    if (aim.offset) {
      predictedX += aim.offset.x;
      predictedY += aim.offset.y;
    }
    
    // Update component
    aim.predictedPosition = { x: predictedX, y: predictedY };
    aim.valid = true;
    
    if (aim.onPredictionUpdate) {
      aim.onPredictionUpdate(entity, aim.predictedPosition);
    }
  }
  
  /**
   * Get predicted position for entity
   */
  getPredictedPosition(entity: Entity): { x: number; y: number } | undefined {
    const aim = this.world.getComponent(entity, PredictiveAimComponent);
    return aim?.predictedPosition;
  }
  
  /**
   * Set target for predictive aim
   */
  setTarget(entity: Entity, target: Entity): void {
    const aim = this.world.getComponent(entity, PredictiveAimComponent);
    if (!aim) return;
    
    aim.target = target;
  }
  
  /**
   * Set prediction time
   */
  setPredictionTime(entity: Entity, time: number): void {
    const aim = this.world.getComponent(entity, PredictiveAimComponent);
    if (!aim) return;
    
    aim.predictionTime = time;
  }
}
