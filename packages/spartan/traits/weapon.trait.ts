/**
 * Weapon Trait
 *
 * Defines ranged weapon capabilities for entities.
 * Used by PlayerWeaponSystem to process shooting and ammo management.
 */
import type { Direction } from '../core/grid/direction';

/**
 * WeaponConfig - Configuration for a weapon type.
 *
 * Defines the properties of a weapon that can be equipped.
 *
 * @example
 * ```typescript
 * const pistol: WeaponConfig = {
 *   name: 'pistol',
 *   damage: 15,
 *   projectileType: 'bullet',
 *   fireRate: 5,
 *   ammoCost: 1,
 *   range: 10,
 *   projectileSpeed: 2,
 * };
 * ```
 */
export interface WeaponConfig {
  /** Unique weapon identifier */
  name: string;
  /** Damage dealt per hit */
  damage: number;
  /** Type of projectile to spawn ('none' for cone-based weapons like shotgun) */
  projectileType: string;
  /** Ticks between shots (cooldown) */
  fireRate: number;
  /** Ammo consumed per shot */
  ammoCost: number;
  /** Maximum range in cells (for projectile weapons or cone range for shotgun) */
  range?: number;
  /** Projectile movement speed in cells per tick */
  projectileSpeed?: number;
  /** Color for projectile visual */
  projectileColor?: string;
  /** Cone spread in radians (for cone-based weapons like shotgun) */
  coneSpread?: number;
  /** Damage type override (defaults to weapon name). Used for special effects like 'freeze'. */
  damageType?: string;
}

/**
 * HasWeapon - Trait for entities that can use ranged weapons.
 *
 * Tracks equipped weapon and ammunition.
 * When out of ammo, systems can fall back to melee attacks.
 *
 * @example
 * ```typescript
 * const player: PlayerData & HasWeapon = {
 *   type: 'player',
 *   equippedWeapon: 'pistol',
 *   ammo: { pistol: 20, shotgun: 8 },
 *   // ...other properties
 * };
 * ```
 */
export interface HasWeapon {
  /** Currently equipped weapon name (references WeaponConfig) */
  equippedWeapon: string;
  /** Ammo count per weapon type */
  ammo: Record<string, number>;
  /** If true, weapon has infinite ammo */
  unlimitedAmmo?: boolean;
  /** Tick when last shot was fired (for cooldown tracking) */
  lastFireTick?: number;
  /** Direction to fire (set by input or AI) */
  fireDirection?: Direction;
}

/**
 * Built-in weapon configurations.
 *
 * Games can define their own weapons or use these defaults.
 */
export const DEFAULT_WEAPONS: Record<string, WeaponConfig> = {
  pistol: {
    name: 'pistol',
    damage: 15,
    projectileType: 'bullet',
    fireRate: 8, // cooldown 8 ticks per roadmap
    ammoCost: 1,
    range: 15,
    projectileSpeed: 2,
    projectileColor: '#ffff00',
  },
  'machine-gun': {
    name: 'machine-gun',
    damage: 8,
    projectileType: 'bullet',
    fireRate: 2, // cooldown 2 ticks per roadmap
    ammoCost: 1,
    range: 12,
    projectileSpeed: 3,
    projectileColor: '#ff6600',
  },
  shotgun: {
    name: 'shotgun',
    damage: 30,
    projectileType: 'none', // cone-based, no projectile per roadmap
    fireRate: 16, // cooldown 16 ticks per roadmap
    ammoCost: 1,
    range: 4, // cone range
    coneSpread: Math.PI / 4, // 45 degree cone spread
  },
  rifle: {
    name: 'rifle',
    damage: 40,
    projectileType: 'rifle-bullet',
    fireRate: 8,
    ammoCost: 1,
    range: 20,
    projectileSpeed: 4,
    projectileColor: '#ff0000',
  },
  'freeze-gun': {
    name: 'freeze-gun',
    damage: 5,
    projectileType: 'freeze-bolt',
    fireRate: 10,
    ammoCost: 1,
    range: 15,
    projectileSpeed: 2,
    projectileColor: '#88ccff',
    damageType: 'freeze',
  },
};
