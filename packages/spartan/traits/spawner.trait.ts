/**
 * Spawner Trait
 *
 * Defines properties for entities that spawn other entities.
 * Spawners can spawn NPCs, projectiles, or other entity types.
 *
 * Used by SpawningSystem to manage spawn timing, limits, and coordination.
 */

/**
 * HasSpawner - Trait for entities that spawn other entities.
 *
 * Spawners:
 * - Spawn entities in open adjacent cells (cycling cardinal directions)
 * - Have configurable spawn limits (max concurrent living spawned entities)
 * - Operate on cooldown timers
 * - Activate based on player proximity + LOS or sleep-wake zone signals
 * - Can be grouped with adjacent spawners for coordinated spawning
 *
 * @example
 * ```typescript
 * // Enemy spawner that activates when player is within 8 cells
 * const spawnerData: HasSpawner = {
 *   spawnType: 'enemy',
 *   spawnLimit: 3,
 *   cooldown: 20,
 *   activationRange: 8,
 *   requiresLineOfSight: true,
 *   spawnLayer: GameLayers.ACTORS,
 * };
 *
 * // Missile spawner (homing missiles)
 * const missileSpawner: HasSpawner = {
 *   spawnType: 'homing-missile',
 *   spawnLimit: 2,
 *   cooldown: 30,
 *   activationRange: 10,
 *   requiresLineOfSight: true,
 *   spawnLayer: GameLayers.EPHEMERALS,
 * };
 *
 * // Spawner that activates via sleep-wake zone signal
 * const zoneSpawner: HasSpawner = {
 *   spawnType: 'enemy',
 *   spawnLimit: 5,
 *   cooldown: 15,
 *   activationRange: 0,  // No proximity activation
 *   requiresLineOfSight: false,
 *   spawnLayer: GameLayers.ACTORS,
 * };
 * ```
 */
export interface HasSpawner {
  // ========== Core Config ==========
  /** Entity type to spawn (e.g., 'enemy', 'homing-missile') */
  spawnType: string;

  /** Maximum number of concurrently living spawned entities */
  spawnLimit: number;

  /** Ticks between spawns */
  cooldown: number;

  /** Layer to spawn entities on */
  spawnLayer: number;

  // ========== Activation ==========
  /** Player must be within this range to trigger spawning (0 = no proximity activation) */
  activationRange: number;

  /** Whether to require line of sight to player for activation (default: true) */
  requiresLineOfSight?: boolean;

  // ========== Optional: Spawn Properties ==========
  /** Additional properties to pass to spawned entities */
  spawnProps?: Record<string, unknown>;

  // ========== Optional: Damageable Spawner ==========
  /** If set, spawner has health and can be destroyed */
  hp?: number;

  /** Maximum health (for damageable spawners) */
  maxHp?: number;

  // ========== Internal State (managed by system) ==========
  /** IDs of living entities spawned by this spawner (filtered each tick) */
  spawnedEntityIds?: number[];

  /** Tick when this spawner (or its group) last spawned */
  lastSpawnTick?: number;

  /** Current direction index for cycling (0=UP, 1=RIGHT, 2=DOWN, 3=LEFT) */
  currentDirection?: number;

  /** Group ID for coordinated spawners (set by system, do not set manually) */
  spawnerGroupId?: number;
}
