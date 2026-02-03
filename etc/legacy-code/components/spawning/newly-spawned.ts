/**
 * @component NewlySpawned
 * @icon hourglass
 * @description Marks entities as newly spawned with a grace period
 * 
 * Newly Spawned Component
 * 
 * Prevents other systems from acting on newly spawned entities immediately.
 * Common use: prevent movement/AI systems from acting before entity is visible.
 * 
 * @property {number} gracePeriod - Ticks to wait before entity becomes "active"
 * @property {number} timer - Internal countdown timer
 */

import { defineComponent } from '@basegrid/ecs';

export interface NewlySpawned {
  /** Ticks to wait before entity becomes "active" */
  gracePeriod: number;
  
  /** Internal: Countdown timer */
  timer?: number;
}

export const NewlySpawnedComponent = defineComponent<NewlySpawned>();
