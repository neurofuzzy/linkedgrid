import { defineComponent } from '@basegrid/ecs';

/**
 * @component SpeedTier
 * @icon gauge
 * @description Multiple speed modes (walk, run, sprint) with easy switching
 * 
 * Speed Tier Component
 * 
 * Defines movement speed tiers for entities.
 * Allows easy switching between different speed modes (walk, run, sprint, etc.).
 * 
 * @property {object} tiers - Map of tier names to speeds (cells per second)
 * @property {string} currentTier - Current active tier
 * @property {number} multiplier - Speed multiplier (default: 1.0)
 * @property {boolean} enabled - Whether speed changes are enabled
 * 
 * @example
 * ```typescript
 * const player = world.createEntity();
 * world.addComponent(player, GridPositionComponent, { x: 0, y: 0, grid });
 * world.addComponent(player, SpeedTierComponent, {
 *   tiers: {
 *     walk: 1,
 *     run: 2,
 *     sprint: 4
 *   },
 *   currentTier: 'walk'
 * });
 * ```
 */
export interface SpeedTier {
  /** Map of tier names to speeds (cells per second) */
  tiers: Record<string, number>;
  
  /** Current active tier */
  currentTier: string;
  
  /** Speed multiplier (default: 1.0) */
  multiplier?: number;
  
  /** Whether speed changes are enabled */
  enabled?: boolean;
}

export const SpeedTierComponent = defineComponent<SpeedTier>();
