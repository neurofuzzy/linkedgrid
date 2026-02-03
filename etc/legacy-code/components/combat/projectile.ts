import { defineComponent } from '@basegrid/ecs';
import type { Direction } from '@basegrid/gameplay';

/**
 * Projectile component for entities that move in a direction and expire.
 * 
 * @component Projectile
 * @category combat
 * @icon arrow-right
 * @description Autonomous moving entity that deals damage on hit (bullets, arrows, fireballs)
 * 
 * Projectiles are autonomous entities that:
 * - Move in a fixed direction each frame
 * - Have limited lifetime (expire after N ticks)
 * - Destroy on collision (walls, enemies)
 * - Deal damage on hit
 * 
 * Common use cases:
 * - Bullets, arrows, fireballs
 * - Magic missiles
 * - Tower defense projectiles
 * - Lasers, torpedoes
 * 
 * @property {Direction} direction - Direction of travel
 * @property {number} speed - Movement speed (cells per frame)
 * @property {number} lifetime - Remaining lifetime in ticks
 * @property {number} damage - Damage dealt on hit
 * @property {boolean} piercing - Whether projectile pierces through enemies
 * @property {number} maxPierces - Maximum pierce count (for piercing projectiles)
 * @property {boolean} bouncing - Whether projectile bounces off walls
 * @property {number} maxBounces - Maximum bounce count
 * 
 * @example
 * ```typescript
 * // Fire a bullet
 * const bullet = world.createEntity();
 * world.addComponent(bullet, ProjectileComponent, {
 *   direction: Direction.RT,
 *   speed: 1,        // Moves 1 cell per frame
 *   lifetime: 30,    // Lives for 30 frames
 *   damage: 1,
 *   piercing: false  // Destroys on first hit
 * });
 * world.addComponent(bullet, GridPositionComponent, { x: 5, y: 7, grid });
 * 
 * // ProjectileSystem handles movement and collision automatically
 * ```
 */
export interface Projectile {
  /** Direction of travel */
  direction: Direction;
  
  /** Movement speed (cells per frame) */
  speed: number;
  
  /** Remaining lifetime in ticks */
  lifetime: number;
  
  /** Damage dealt on hit */
  damage: number;
  
  /** Whether projectile pierces through enemies */
  piercing?: boolean;
  
  /** Maximum pierce count (for piercing projectiles) */
  maxPierces?: number;
  
  /** Entities already hit (for piercing projectiles) */
  hitEntities?: Set<number>;
  
  /** Whether projectile bounces off walls */
  bouncing?: boolean;
  
  /** Maximum bounce count */
  maxBounces?: number;
  
  /** Current bounce count */
  bounceCount?: number;
  
  /** Owner entity (to prevent hitting self) */
  owner?: number;
}

export const ProjectileComponent = defineComponent<Projectile>();
