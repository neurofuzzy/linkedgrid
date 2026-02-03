/**
 * Projectile Trait
 *
 * Defines properties for moving damage-dealing entities like bullets, arrows, fireballs.
 * Projectiles move along a Bresenham path toward a target position.
 *
 * Used by ProjectileSystem to handle movement, collision, and damage.
 */

/**
 * HasProjectile - Trait for autonomous moving projectile entities.
 *
 * Projectiles:
 * - Move along a precomputed Bresenham path toward target
 * - Deal damage on collision with entities that have health
 * - Can pierce through multiple targets
 * - Can bounce off walls
 * - Expire after lifetime or reaching target
 *
 * @example
 * ```typescript
 * // Fire a bullet toward position (15, 10)
 * spatial.spawn('projectile', 5, 10, GameLayers.PROJECTILES, {
 *   targetX: 15,
 *   targetY: 10,
 *   damage: 25,
 *   speed: 2,
 *   lifetime: 30,
 *   ownerId: playerId,
 * });
 *
 * // Piercing arrow that passes through enemies
 * spatial.spawn('projectile', 5, 5, GameLayers.PROJECTILES, {
 *   targetX: 5,
 *   targetY: 15,
 *   damage: 15,
 *   piercing: true,
 *   maxPierces: 3,
 * });
 *
 * // Bouncing fireball
 * spatial.spawn('projectile', 10, 10, GameLayers.PROJECTILES, {
 *   targetX: 20,
 *   targetY: 10,
 *   damage: 30,
 *   damageType: 'fire',
 *   bouncing: true,
 *   maxBounces: 2,
 * });
 * ```
 */
export interface HasProjectile {
  // ========== Movement ==========
  /** Target X position (Bresenham endpoint) */
  targetX: number;
  /** Target Y position (Bresenham endpoint) */
  targetY: number;
  /** Movement speed in cells per tick (default: 1) */
  speed?: number;

  // ========== Combat ==========
  /** Damage dealt on hit */
  damage: number;
  /** Damage type for vulnerability calculations (e.g., 'fire', 'ice') */
  damageType?: string;
  /** Owner entity ID - projectile won't hit its owner */
  ownerId?: number;

  // ========== Behavior ==========
  /** Maximum ticks before projectile expires (default: 100) */
  lifetime?: number;
  /** Whether projectile passes through targets instead of stopping */
  piercing?: boolean;
  /** Maximum number of targets to pierce (for piercing projectiles) */
  maxPierces?: number;
  /** Entity IDs already hit by this projectile (managed by system) */
  hitEntityIds?: number[];

  // ========== Bouncing ==========
  /** Whether projectile bounces off walls */
  bouncing?: boolean;
  /** Maximum number of bounces allowed */
  maxBounces?: number;
  /** Current bounce count (managed by system) */
  bounceCount?: number;

  // ========== Internal State (managed by system) ==========
  /** Current index in the precomputed path */
  pathIndex?: number;
  /** Precomputed Bresenham path from start to target */
  path?: Array<{ x: number; y: number }>;
  /** Tick when projectile was spawned */
  spawnTick?: number;
}
