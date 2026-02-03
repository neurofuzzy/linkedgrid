/**
 * Defense Traits
 *
 * Defines armor, shields, and damage reduction properties.
 * Used by HealthSystem to calculate final damage after mitigation.
 */

/**
 * HasArmor - Flat damage reduction.
 *
 * Armor reduces incoming damage by a flat amount.
 * Damage cannot be reduced below 1 (minimum damage).
 *
 * @example
 * ```typescript
 * const armoredEnemy: HasArmor = {
 *   armor: 5, // Reduces all damage by 5
 * };
 * ```
 */
export interface HasArmor {
  /** Flat damage reduction (minimum 0) */
  armor: number;
}

/**
 * HasShield - Separate HP pool that absorbs damage first.
 *
 * Shields take damage before health. When depleted, excess
 * damage applies to health. Shields can regenerate.
 *
 * @example
 * ```typescript
 * const shieldedEntity: HasShield = {
 *   shield: 50,
 *   maxShield: 50,
 *   shieldRegenRate: 2, // Regenerates 2 shield per tick
 *   shieldRegenDelay: 10, // Wait 10 ticks after taking damage before regen
 * };
 * ```
 */
export interface HasShield {
  /** Current shield points */
  shield: number;
  /** Maximum shield points */
  maxShield: number;
  /** Shield regeneration per tick (default: 0) */
  shieldRegenRate?: number;
  /** Ticks to wait after taking damage before regeneration starts (default: 0) */
  shieldRegenDelay?: number;
  /** Tick when shield was last damaged (managed by system) */
  lastShieldDamageTick?: number;
}

/**
 * HasResistance - Percentage damage reduction.
 *
 * Applied after armor, reduces remaining damage by percentage.
 * Stack multiplicatively if entity has multiple resistances.
 *
 * @example
 * ```typescript
 * const resistantEntity: HasResistance = {
 *   resistance: 0.25, // 25% damage reduction
 * };
 * ```
 */
export interface HasResistance {
  /** Damage reduction as decimal (0.25 = 25% reduction) */
  resistance: number;
}

/**
 * HasVulnerability - Damage type weaknesses.
 *
 * Increases damage from specific sources.
 * Not commonly used but available for special mechanics.
 *
 * @example
 * ```typescript
 * const vulnerableEntity: HasVulnerability = {
 *   vulnerabilities: {
 *     fire: 1.5, // 50% more fire damage
 *     ice: 0.5, // 50% less ice damage (resistance)
 *   },
 * };
 * ```
 */
export interface HasVulnerability {
  /** Damage multipliers by type (1.0 = normal, >1 = vulnerable, <1 = resistant) */
  vulnerabilities: Record<string, number>;
}
