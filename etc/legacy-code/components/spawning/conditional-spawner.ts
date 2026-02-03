/**
 * @component ConditionalSpawner
 * @icon git-branch
 * @description Spawns entities only when conditions are met (health, count, timer)
 * 
 * Conditional Spawner Component
 * 
 * Extends SpawnerComponent with conditional logic.
 * Spawns entities only when specific conditions are met.
 * 
 * Examples:
 * - Spawn enemies when player has few items
 * - Spawn power-ups when player health is low
 * - Spawn waves based on enemy count
 * - Dynamic difficulty adjustment
 * 
 * @property {SpawnCondition[]} conditions - Conditions that must be met to spawn
 * @property {boolean} requireAll - Whether ALL conditions must be met (AND) or ANY (OR)
 * @property {number} checkCooldown - Cooldown between condition checks (ticks)
 * @property {number} checkTimer - Cooldown timer
 */

import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import type { Spawner } from './spawner';

export type SpawnConditionType = 
  | 'entity_count'      // Count entities with specific tags
  | 'timer'             // Time-based spawning
  | 'player_health'     // Based on player health
  | 'custom';           // Custom callback function

export interface SpawnCondition {
  /** Type of condition */
  type: SpawnConditionType;
  
  /** For entity_count: tags to count */
  tags?: string[];
  
  /** For entity_count: comparison operator */
  operator?: '<' | '>' | '==' | '<=' | '>=';
  
  /** Comparison value */
  threshold?: number;
  
  /** For timer: elapsed time */
  elapsed?: number;
  
  /** Custom condition function */
  check?: (spawner: Entity) => boolean;
}

export interface ConditionalSpawner extends Spawner {
  /** Conditions that must be met to spawn */
  conditions: SpawnCondition[];
  
  /** Whether ALL conditions must be met (AND) or ANY (OR) */
  requireAll?: boolean;
  
  /** Optional: Cooldown between condition checks (in ticks) */
  checkCooldown?: number;
  
  /** Internal: Cooldown timer */
  checkTimer?: number;
}

export const ConditionalSpawnerComponent = defineComponent<ConditionalSpawner>();
