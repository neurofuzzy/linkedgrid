/**
 * Health Trait
 *
 * Defines health properties for entities that can take damage and be destroyed.
 * The HealthSystem (when implemented) will manage death states and removal.
 */

/**
 * Entity lifecycle states for health management.
 * - alive: Normal active state
 * - dying: Death animation/effect playing (entity still visible)
 * - dead: Marked for removal (processed by HealthSystem)
 */
export type HealthState = 'alive' | 'dying' | 'dead';

/**
 * HasHealth - Health trait for damageable entities.
 *
 * Entities with health can take damage, die, and be removed.
 * The optional `healthState` field enables death animations before removal.
 *
 * @example
 * ```typescript
 * const playerHealth: HasHealth = {
 *   hp: 100,
 *   maxHp: 100,
 *   healthState: 'alive',
 * };
 * ```
 */
export interface HasHealth {
  /** Current health points */
  hp: number;
  /** Maximum health points */
  maxHp: number;
  /** Entity lifecycle state (defaults to 'alive' if not set) */
  healthState?: HealthState;
  /** Ticks remaining in dying state (set by HealthSystem) */
  dyingTicks?: number;
}
