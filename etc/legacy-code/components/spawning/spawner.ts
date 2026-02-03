import { defineComponent } from '@basegrid/ecs';

/**
 * @component Spawner
 * @icon sparkles
 * @description Creates entities at intervals, solo or synchronized in groups
 * 
 * Spawner component for entities that create other entities.
 * 
 * Spawners can work individually or in coordinated groups:
 * - **Solo spawners**: Spawn on their own timer
 * - **Group spawners**: Synchronize with others in same group
 * 
 * When grouped (via groupId), all spawners in the group spawn simultaneously
 * when the group's timer triggers.
 * 
 * @property {string} groupId - Group ID for coordinated spawning
 * @property {number} spawnInterval - Ticks between spawns
 * @property {number} timer - Current timer (counts down to 0)
 * @property {string} entityType - Type of entity to spawn
 * @property {number} maxSpawns - Maximum number of times this spawner can spawn
 * @property {number} spawnCount - Number of times this spawner has spawned
 * @property {boolean} active - Whether this spawner is active
 * @property {number} cooldownDuration - Cooldown ticks after spawning
 * @property {number} cooldownTimer - Current cooldown timer
 * 
 * @example
 * ```typescript
 * // Solo spawner
 * const spawner = world.createEntity();
 * world.addComponent(spawner, SpawnerComponent, {
 *   spawnInterval: 60,  // Spawn every 60 ticks
 *   timer: 0,
 *   entityType: 'enemy',
 *   maxSpawns: 10
 * });
 * world.addComponent(spawner, GridPositionComponent, { x: 5, y: 5, grid });
 * 
 * // Grouped spawners (coordinated)
 * for (const pos of groupPositions) {
 *   const spawner = world.createEntity();
 *   world.addComponent(spawner, SpawnerComponent, {
 *     groupId: 'boss-phase-1',  // All in group spawn together
 *     spawnInterval: 120,
 *     timer: 0,
 *     entityType: 'minion'
 *   });
 *   world.addComponent(spawner, GridPositionComponent, { x: pos.x, y: pos.y, grid });
 * }
 * ```
 */
export type CoordinationMode = 'synchronized' | 'sequential' | 'yoyo';

export interface Spawner {
  /** Optional group ID for coordinated spawning */
  groupId?: string;
  
  /** Coordination mode: 'synchronized' (all at once), 'sequential' (one by one), 'yoyo' (back and forth) */
  coordinationMode?: CoordinationMode;
  
  /** Index in sequential/yoyo spawn order (0-based) */
  spawnIndex?: number;
  
  /** Ticks between spawns */
  spawnInterval: number;
  
  /** Current timer (counts down to 0) */
  timer: number;
  
  /** Type of entity to spawn */
  entityType: string;
  
  /** Maximum number of times this spawner can spawn (undefined = infinite) */
  maxSpawns?: number;
  
  /** Number of times this spawner has spawned */
  spawnCount?: number;
  
  /** Whether this spawner is active */
  active?: boolean;
  
  /** Cooldown ticks after spawning before becoming ready again */
  cooldownDuration?: number;
  
  /** Current cooldown timer */
  cooldownTimer?: number;
  
  /** Callback to configure spawned entity (receives entity ID and spawn position) */
  onSpawn?: (spawnedEntity: number, position: { x: number; y: number; grid: any }) => void;
  
  /** Condition callback - return false to prevent spawning */
  canSpawn?: (spawnerEntity: number) => boolean;
}

export const SpawnerComponent = defineComponent<Spawner>();
