/**
 * Gradient Follower Component
 * 
 * Makes an entity follow distance field gradients toward goals.
 */

import { defineComponent } from '@basegrid/ecs';

export interface GradientFollower {
  /** Distance layer to follow (default: 0) */
  distanceLayer?: number;
  
  /** Movement speed in ticks (move every N ticks, default: 10) */
  moveInterval?: number;
  
  /** Current tick counter */
  moveTick?: number;
  
  /** Whether this follower is active */
  active?: boolean;
  
  /** Callback when reaching goal */
  onReachGoal?: (entity: number) => void;
  
  /** What cell values represent goals */
  goalValues?: number[];
}

export const GradientFollowerComponent = defineComponent<GradientFollower>();
