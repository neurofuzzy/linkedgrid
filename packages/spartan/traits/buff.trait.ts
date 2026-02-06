/**
 * Buff Trait
 *
 * Tracks temporary status effects on entities.
 * Used by PowerupSystem to manage buff application and expiration.
 */

/**
 * Buff - A temporary status effect applied to an entity.
 *
 * Buffs have a type (determines effect), magnitude, and expiration.
 * When a buff expires, its effects are removed.
 */
export interface Buff {
  /** Buff type identifier */
  type: 'health' | 'health-regen' | 'shield' | 'speed' | 'damage' | 'invincibility';
  /** Effect magnitude (e.g., +50 health, +25% speed, HP per tick for health-regen) */
  magnitude: number;
  /** Tick when this buff expires (-1 for permanent) */
  expirationTick: number;
  /** Optional: Source entity ID that applied the buff */
  sourceId?: number;
}

/**
 * HasBuff - Trait for entities that can have status effects.
 *
 * Buffs are temporary modifiers applied by powerups, abilities, or effects.
 * The PowerupSystem manages buff lifecycle (application, expiration).
 *
 * @example
 * ```typescript
 * const player: PlayerData & HasBuff = {
 *   type: 'player',
 *   activeBuffs: [
 *     { type: 'speed', magnitude: 1.5, expirationTick: 100 },
 *     { type: 'shield', magnitude: 50, expirationTick: 200 },
 *   ],
 *   // ...other properties
 * };
 * ```
 */
export interface HasBuff {
  /** Currently active buffs */
  activeBuffs: Buff[];
}

/**
 * PowerupType - Types of powerups that can be collected.
 */
export type PowerupType = 'health-pack' | 'health-potion' | 'shield-pack' | 'speed-boost' | 'damage-boost' | 'invincibility';
