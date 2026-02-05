/**
 * Powerup entity definitions.
 *
 * Defines collectible powerup items that apply effects to players.
 */
import type { BaseEntityData } from './base.entity';
import type { HasColor, IsCollectible } from '../traits';

/**
 * HealthPackData - Instant health restoration powerup.
 *
 * When collected, immediately heals the collector.
 *
 * Placed on COLLECTIBLES layer.
 */
export type HealthPackData = BaseEntityData & {
  type: 'health-pack';
  /** Amount of HP to restore */
  healAmount: number;
} & IsCollectible &
  HasColor;

/**
 * ShieldPackData - Shield restoration or temporary shield powerup.
 *
 * Can either restore existing shield or grant temporary shields.
 *
 * Placed on COLLECTIBLES layer.
 */
export type ShieldPackData = BaseEntityData & {
  type: 'shield-pack';
  /** Amount of shield to grant */
  shieldAmount: number;
  /** Duration in ticks (undefined = permanent until depleted) */
  duration?: number;
} & IsCollectible &
  HasColor;

/**
 * SpeedBoostData - Temporary speed increase powerup.
 *
 * Increases movement speed for a duration.
 *
 * Placed on COLLECTIBLES layer.
 */
export type SpeedBoostData = BaseEntityData & {
  type: 'speed-boost';
  /** Speed multiplier (e.g., 1.5 = 50% faster) */
  speedMultiplier: number;
  /** Duration in ticks */
  duration: number;
} & IsCollectible &
  HasColor;

/**
 * DamageBoostData - Temporary damage increase powerup.
 *
 * Increases damage dealt for a duration.
 *
 * Placed on COLLECTIBLES layer.
 */
export type DamageBoostData = BaseEntityData & {
  type: 'damage-boost';
  /** Damage multiplier (e.g., 2.0 = double damage) */
  damageMultiplier: number;
  /** Duration in ticks */
  duration: number;
} & IsCollectible &
  HasColor;

/**
 * InvincibilityData - Temporary invincibility powerup.
 *
 * Makes the collector immune to damage for a duration.
 *
 * Placed on COLLECTIBLES layer.
 */
export type InvincibilityData = BaseEntityData & {
  type: 'invincibility';
  /** Duration in ticks */
  duration: number;
} & IsCollectible &
  HasColor;

/**
 * AmmoPackData - Ammunition pickup.
 *
 * Restores ammunition for a specific weapon type.
 *
 * Placed on COLLECTIBLES layer.
 */
export type AmmoPackData = BaseEntityData & {
  type: 'ammo-pack';
  /** Weapon type this ammo is for */
  weaponType: string;
  /** Amount of ammo to add */
  ammoAmount: number;
} & IsCollectible &
  HasColor;

/**
 * WeaponPickupData - Weapon pickup entity.
 *
 * Gives the player a weapon and starting ammo when collected.
 * Switches player's equipped weapon to the picked-up type.
 *
 * Placed on COLLECTIBLES layer.
 */
export type WeaponPickupData = BaseEntityData & {
  type: 'weapon-pickup';
  /** Weapon type to grant (e.g., 'pistol', 'machine-gun', 'shotgun') */
  weaponType: string;
  /** Starting ammo amount when picked up */
  ammoAmount: number;
} & IsCollectible &
  HasColor;
