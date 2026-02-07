/**
 * Turret Trait
 *
 * Defines properties for stationary entities that fire projectiles or rays.
 * Turrets can target the player, nearest enemy, or fire in a fixed direction.
 *
 * Used by TurretSystem to handle targeting, cooldowns, and firing.
 */

import type { Direction } from '../core/grid/direction';

/**
 * Weapon type for turrets.
 * - projectile: Spawns a moving projectile entity
 * - ray: Instant-hit raycast (like a laser)
 */
export type TurretWeaponType = 'projectile' | 'ray';

/**
 * Targeting mode for turrets.
 * - nearest: Target nearest entity with health (within range)
 * - player: Target the player entity specifically
 * - fixed: Fire in a fixed direction (no targeting)
 * - cardinal: Auto-detect open directions and cycle through them
 */
export type TurretTargeting = 'nearest' | 'player' | 'fixed' | 'cardinal';

/**
 * HasTurret - Trait for stationary shooting entities.
 *
 * Turrets:
 * - Fire projectiles or instant rays
 * - Have configurable targeting (nearest, player, fixed direction)
 * - Operate on cooldown timers
 * - Respect range limits
 *
 * @example
 * ```typescript
 * // Projectile turret that targets nearest enemy
 * const turretData: HasTurret = {
 *   weaponType: 'projectile',
 *   targeting: 'nearest',
 *   cooldown: 5,
 *   range: 10,
 *   projectileDamage: 20,
 *   projectileSpeed: 2,
 *   projectileLifetime: 20,
 * };
 *
 * // Laser turret that fires at player
 * const laserData: HasTurret = {
 *   weaponType: 'ray',
 *   targeting: 'player',
 *   cooldown: 10,
 *   range: 15,
 *   rayDamage: 35,
 *   rayPiercing: false,
 * };
 *
 * // Fixed direction turret (trap)
 * const trapData: HasTurret = {
 *   weaponType: 'ray',
 *   targeting: 'fixed',
 *   fixedDirection: Direction.RIGHT,
 *   cooldown: 3,
 *   range: 8,
 *   rayDamage: 15,
 * };
 * ```
 */
export interface HasTurret {
  // ========== Core Config ==========
  /** Type of weapon: projectile (moving entity) or ray (instant hit) */
  weaponType: TurretWeaponType;
  /** How turret selects targets */
  targeting: TurretTargeting;

  // ========== Timing ==========
  /** Ticks between shots */
  cooldown: number;
  /** Tick when turret last fired (managed by system) */
  lastFireTick?: number;

  // ========== Range ==========
  /** Maximum detection/firing range in cells */
  range: number;

  // ========== Fixed Direction (for targeting: 'fixed') ==========
  /** Direction to fire when using fixed targeting */
  fixedDirection?: Direction;

  // ========== Projectile Config (for weaponType: 'projectile') ==========
  /** Damage for spawned projectiles */
  projectileDamage?: number;
  /** Speed for spawned projectiles (cells per tick) */
  projectileSpeed?: number;
  /** Lifetime for spawned projectiles (ticks) */
  projectileLifetime?: number;
  /** Whether spawned projectiles pierce targets */
  projectilePiercing?: boolean;
  /** Whether spawned projectiles home toward the target */
  projectileHoming?: boolean;
  /** Homing turn rate for spawned projectiles (0-1, default: 1.0) */
  projectileHomingStrength?: number;

  // ========== Ray Config (for weaponType: 'ray') ==========
  /** Damage for ray hits */
  rayDamage?: number;
  /** Whether ray pierces through targets */
  rayPiercing?: boolean;

  // ========== Team Filtering ==========
  /** Team that turret belongs to (won't target same team) */
  team?: 'player' | 'enemy' | 'neutral';

  // ========== Cardinal Mode State (managed by system) ==========
  /** Open directions for cardinal mode (computed on first tick) */
  cardinalDirections?: Direction[];
  /** Current index in cardinalDirections array */
  cardinalIndex?: number;
}
