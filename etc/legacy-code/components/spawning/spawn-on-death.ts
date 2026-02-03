import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component SpawnOnDeath
 * @icon split
 * @description Spawns entities when dying (splits, loot, boss phases)
 * 
 * Spawn On Death Component
 * 
 * Spawns entities when this entity dies.
 * 
 * Use cases:
 * - Split enemies (asteroids, slimes)
 * - Multi-phase bosses
 * - Death effects (explosions)
 * - Loot drops
 * - Enemy reinforcements
 * 
 * @property {number} count - Number of entities to spawn
 * @property {boolean} inheritPosition - Inherit position from dying entity
 * @property {number} offsetRadius - Random offset radius from dying entity position
 * @property {number} minOffsetRadius - Minimum offset radius (ring patterns)
 * @property {number} spawnChance - Spawn probability (0-1)
 * @property {boolean} inheritVelocity - Inherit velocity from dying entity
 * @property {number} velocityMultiplier - Velocity multiplier
 * @property {number} randomVelocity - Add random velocity
 * @property {boolean} inheritTeam - Inherit team/faction
 * @property {number} spawnDelay - Delay before spawning (seconds)
 * @property {number} spawnInterval - Spread spawns over time
 * 
 * @example
 * ```typescript
 * // Asteroid that splits
 * const asteroid = world.createEntity();
 * world.addComponent(asteroid, SpawnOnDeathComponent, {
 *   count: 3,
 *   entityFactory: () => createSmallerAsteroid(),
 *   offsetRadius: 2
 * });
 * 
 * // Boss with second phase
 * const boss = world.createEntity();
 * world.addComponent(boss, SpawnOnDeathComponent, {
 *   count: 1,
 *   entityFactory: () => createBossPhase2(),
 *   inheritPosition: true
 * });
 * ```
 */
export interface SpawnOnDeath {
  /** Number of entities to spawn */
  count: number;
  
  /** Factory function to create entities */
  entityFactory: () => Entity;
  
  /** Inherit position from dying entity */
  inheritPosition?: boolean;
  
  /** Random offset radius from dying entity position */
  offsetRadius?: number;
  
  /** Minimum offset radius (for creating ring patterns) */
  minOffsetRadius?: number;
  
  /** Optional: Spawn probability (0-1) */
  spawnChance?: number;
  
  /** Optional: Inherit velocity from dying entity */
  inheritVelocity?: boolean;
  
  /** Optional: Velocity multiplier */
  velocityMultiplier?: number;
  
  /** Optional: Add random velocity */
  randomVelocity?: number;
  
  /** Optional: Inherit team/faction */
  inheritTeam?: boolean;
  
  /** Optional: Callback when spawns trigger */
  onSpawn?: (parent: Entity, spawned: Entity[]) => void;
  
  /** Optional: Delay before spawning (seconds) */
  spawnDelay?: number;
  
  /** Optional: Spread spawns over time */
  spawnInterval?: number;
}

export const SpawnOnDeathComponent = defineComponent<SpawnOnDeath>();
