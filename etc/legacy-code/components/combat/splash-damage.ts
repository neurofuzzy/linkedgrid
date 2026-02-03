import { defineComponent, type Entity } from '@basegrid/ecs';

/**
 * @component SplashDamage
 * @icon target
 * @description Area-of-effect damage in radius (explosions, rockets)
 * 
 * Splash Damage Component
 * 
 * When an entity with this component deals damage or dies, it applies
 * splash damage to entities in a radius.
 * 
 * @property {number} radius - Radius of splash effect (Manhattan distance)
 * @property {number} damage - Base damage amount
 * @property {number} falloff - Damage falloff (0-1, where 1 = full damage at edge)
 * @property {boolean} triggerOnDestroy - Whether to trigger on entity destruction
 * @property {string[]} targetTags - Tags to affect (empty = all entities)
 * @property {string[]} ignoreTags - Tags to ignore
 * @property {boolean} triggered - Whether already triggered (one-shot)
 * 
 * @example
 * ```typescript
 * const rocket = world.createEntity();
 * world.addComponent(rocket, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(rocket, SplashDamageComponent, {
 *   radius: 3,
 *   damage: 50,
 *   falloff: 0.5, // 50% damage at edge
 *   triggerOnDestroy: true
 * });
 * ```
 */
export interface SplashDamage {
  /** Radius of splash effect (Manhattan distance) */
  radius: number;
  
  /** Base damage amount */
  damage: number;
  
  /** Damage falloff (0-1, where 1 = full damage at edge) */
  falloff?: number;
  
  /** Whether to trigger on entity destruction */
  triggerOnDestroy?: boolean;
  
  /** Tags to affect (empty = all entities) */
  targetTags?: string[];
  
  /** Tags to ignore */
  ignoreTags?: string[];
  
  /** Whether already triggered (for one-shot effects) */
  triggered?: boolean;
  
  /** Callback when damage is applied */
  onDamage?: (source: Entity, target: Entity, damage: number) => void;
}

export const SplashDamageComponent = defineComponent<SplashDamage>();
