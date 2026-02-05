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
  /** Type of projectile to spawn */
  projectileType: string;
  /** Ticks between shots (cooldown) */
  fireRate: number;
  /** Ammo consumed per shot */
  ammoCost: number;
  /** Maximum range in cells (optional, for raycast weapons) */
  range?: number;
  /** Projectile movement speed in cells per tick */
  projectileSpeed?: number;
  /** Color for projectile visual */
  projectileColor?: string;
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
    fireRate: 5,
    ammoCost: 1,
    range: 15,
    projectileSpeed: 2,
    projectileColor: '#ffff00',
  },
  shotgun: {
    name: 'shotgun',
    damage: 30,
    projectileType: 'pellet',
    fireRate: 12,
    ammoCost: 1,
    range: 6,
    projectileSpeed: 3,
    projectileColor: '#ff8800',
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
};
