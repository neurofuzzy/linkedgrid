import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import type { Direction } from '@basegrid/gameplay';

/**
 * @component RayWeapon
 * @icon zap
 * @description Instant-hit beam weapon (laser, railgun, lightning)
 * 
 * Ray Weapon Component
 * 
 * Instant-hit laser/railgun weapons that fire in a straight line.
 * No travel time - instant damage along a beam path.
 * 
 * Examples:
 * - Lasers
 * - Railguns
 * - Energy beams
 * - Lightning weapons
 * 
 * @property {Direction} direction - Direction to fire
 * @property {number} damage - Damage per hit
 * @property {number} range - Maximum range (cells)
 * @property {number} cooldown - Cooldown time (seconds)
 * @property {number} cooldownRemaining - Current cooldown remaining
 * @property {boolean} piercing - Whether ray pierces through enemies
 * @property {number} maxHits - Maximum number of enemies to hit (if piercing)
 * @property {boolean} blockedByWalls - Whether ray stops at walls
 * @property {string[]} targetTags - Tag filter for targets
 * @property {string[]} excludeTags - Tag filter exclusion
 * @property {boolean} ready - Whether weapon is ready to fire
 * 
 * @example
 * ```typescript
 * // Create entity with ray weapon
 * const turret = world.createEntity();
 * world.addComponent(turret, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(turret, RayWeaponComponent, {
 *   direction: Direction.RT,
 *   damage: 25,
 *   range: 10,
 *   cooldown: 2.0
 * });
 * 
 * // System fires ray weapon
 * const raySystem = world.getSystem(RayWeaponSystem);
 * raySystem.fireWeapon(turret);
 * ```
 */
export interface RayWeapon {
  /** Direction to fire */
  direction: Direction;
  
  /** Damage per hit */
  damage: number;
  
  /** Maximum range (cells) */
  range: number;
  
  /** Cooldown time (seconds) */
  cooldown: number;
  
  /** Current cooldown remaining */
  cooldownRemaining?: number;
  
  /** Whether ray pierces through enemies */
  piercing?: boolean;
  
  /** Maximum number of enemies to hit (if piercing) */
  maxHits?: number;
  
  /** Whether ray stops at walls */
  blockedByWalls?: boolean;
  
  /** Optional: Tag filter for targets */
  targetTags?: string[];
  
  /** Optional: Tag filter exclusion */
  excludeTags?: string[];
  
  /** Optional: Callback when ray fires */
  onFire?: (entity: Entity, hits: Entity[]) => void;
  
  /** Optional: Callback for each hit */
  onHit?: (entity: Entity, target: Entity, damage: number) => void;
  
  /** Whether weapon is ready to fire */
  ready?: boolean;
}

export const RayWeaponComponent = defineComponent<RayWeapon>();
