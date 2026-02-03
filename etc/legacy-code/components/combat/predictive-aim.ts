import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component PredictiveAim
 * @icon target
 * @description Simple linear prediction for moving targets (fast turrets, AI)
 * 
 * Predictive Aim Component
 * 
 * Simple linear prediction for aiming at moving targets.
 * Estimates where target will be after a fixed time delay.
 * Lighter weight than full lead-targeting ballistics.
 * 
 * Examples:
 * - Fast turrets
 * - Simple enemy AI
 * - Burst-fire weapons
 * - Prediction overlays
 * 
 * @property {Entity} target - Target entity to predict
 * @property {number} predictionTime - Time to predict ahead (seconds)
 * @property {object} predictedPosition - Predicted target position
 * @property {object} offset - Offset to add to prediction
 * @property {boolean} valid - Whether prediction is currently valid
 * 
 * @example
 * ```typescript
 * // Create enemy with predictive aim
 * const enemy = world.createEntity();
 * world.addComponent(enemy, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(enemy, PredictiveAimComponent, {
 *   target: player,
 *   predictionTime: 0.5 // Predict 0.5 seconds ahead
 * });
 * 
 * // System calculates predicted position
 * const aim = world.getComponent(enemy, PredictiveAimComponent);
 * console.log(aim.predictedPosition); // { x: 12, y: 15 }
 * ```
 */
export interface PredictiveAim {
  /** Target entity to predict */
  target?: Entity;
  
  /** Time to predict ahead (seconds) */
  predictionTime: number;
  
  /** Predicted target position */
  predictedPosition?: { x: number; y: number };
  
  /** Offset to add to prediction (for leading/trailing) */
  offset?: { x: number; y: number };
  
  /** Optional: Whether prediction is currently valid */
  valid?: boolean;
  
  /** Optional: Callback when prediction updates */
  onPredictionUpdate?: (entity: Entity, position: { x: number; y: number }) => void;
}

export const PredictiveAimComponent = defineComponent<PredictiveAim>();
