/**
 * Melee Trait
 *
 * Defines melee attack capabilities for entities.
 * Used by MeleeSystem to process close-range combat.
 */
import type { Direction } from '../core/grid/direction';

/**
 * HasMelee - Trait for entities that can perform melee attacks.
 *
 * Melee attacks target adjacent cells (range 1 by default).
 * Attack direction can come from facing direction or explicit input.
 *
 * @example
 * ```typescript
 * const player: PlayerData & HasMelee = {
 *   type: 'player',
 *   meleeDamage: 25,
 *   meleeCooldown: 3,
 *   meleeRange: 1,
 *   // ...other properties
 * };
 * ```
 */
export interface HasMelee {
  /** Damage dealt per melee attack */
  meleeDamage: number;
  /** Ticks between attacks (cooldown) */
  meleeCooldown: number;
  /** Attack range in cells (typically 1 for adjacent) */
  meleeRange: number;
  /** Tick when last attack occurred (for cooldown tracking) */
  lastMeleeAttackTick?: number;
  /** Direction of pending/current melee attack */
  meleeDirection?: Direction;
}
