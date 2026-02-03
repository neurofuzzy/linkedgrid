import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component CollisionDamage
 * @icon skull
 * @description Damages entities on contact (spikes, lava, enemy touch)
 * 
 * CollisionDamage component for entities that damage others on contact.
 * 
 * Unlike projectiles which move and destroy on hit, collision damage
 * is passive - just occupying the same cell causes damage.
 * 
 * Common use cases:
 * - Spikes, lava, hazards
 * - Enemy contact damage (classic Zelda/RPG style)
 * - Thorns, poison puddles
 * - Electric fences
 * 
 * @property {number} damage - Damage dealt on contact
 * @property {number} damageInterval - Minimum time between damage applications (ticks)
 * @property {string[]} affectsTags - Tags that this entity can damage
 * @property {string[]} ignoresTags - Tags that this entity ignores
 * @property {boolean} active - Whether this entity is currently active
 * @property {boolean} damageOnce - Whether to damage only once per entity
 * @property {boolean} knockback - Whether to push entities away on damage
 * @property {number} knockbackDistance - Knockback distance in cells
 * 
 * @example
 * ```typescript
 * // Create spike trap
 * const spike = world.createEntity();
 * world.addComponent(spike, CollisionDamageComponent, {
 *   damage: 2,
 *   damageInterval: 30,  // Damage every 30 ticks (0.5s)
 *   affectsTags: ['player', 'enemy']  // Damages both
 * });
 * world.addComponent(spike, GridPositionComponent, { x: 10, y: 5, grid });
 * 
 * // Create enemy with contact damage
 * const enemy = world.createEntity();
 * world.addComponent(enemy, CollisionDamageComponent, {
 *   damage: 1,
 *   damageInterval: 60,  // Once per second
 *   affectsTags: ['player'],  // Only damages player
 *   onDamageDealt: (source, target) => {
 *     console.log('Enemy touched player!');
 *   }
 * });
 * world.addComponent(enemy, GridPositionComponent, { x: 8, y: 7, grid });
 * world.addComponent(enemy, TypeComponent, { type: 'enemy' });
 * ```
 */
export interface CollisionDamage {
  /** Damage dealt on contact */
  damage: number;
  
  /** Minimum time between damage applications (ticks) */
  damageInterval: number;
  
  /** Tags that this entity can damage (e.g., ['player', 'enemy']) */
  affectsTags?: string[];
  
  /** Tags that this entity ignores (e.g., ['ally']) */
  ignoresTags?: string[];
  
  /** Whether this entity is currently active (can be toggled) */
  active?: boolean;
  
  /** Callback when damage is dealt */
  onDamageDealt?: (source: Entity, target: Entity, damage: number) => void;
  
  /** Map of entity -> last damage time (for interval tracking) */
  lastDamageTime?: Map<Entity, number>;
  
  /** Whether to damage only once per entity (vs continuous) */
  damageOnce?: boolean;
  
  /** Set of entities already damaged (for damageOnce mode) */
  damagedEntities?: Set<Entity>;
  
  /** Whether to push entities away on damage */
  knockback?: boolean;
  
  /** Knockback distance in cells */
  knockbackDistance?: number;
}

export const CollisionDamageComponent = defineComponent<CollisionDamage>();
