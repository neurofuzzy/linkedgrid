import { defineComponent } from '@basegrid/ecs';

/**
 * @component Explosion
 * @icon boom
 * @description Short-lived explosion visual effect
 * 
 * Explosion component for visual explosion effects.
 * 
 * Created when explosives detonate.
 * Short-lived visual effect.
 * 
 * @property {number} lifetime - Ticks remaining before removal
 * @property {number} radius - Visual radius (for rendering)
 * 
 * @example
 * ```typescript
 * // Create explosion effect
 * const explosion = world.createEntity();
 * world.addComponent(explosion, ExplosionComponent, {
 *   lifetime: 10,  // Lasts 10 ticks
 *   radius: 3
 * });
 * world.addComponent(explosion, GridPositionComponent, { x: 9, y: 7, grid });
 * 
 * // FuseSystem will remove after lifetime
 * ```
 */
export interface Explosion {
  /** Ticks remaining before removal */
  lifetime: number;
  
  /** Visual radius (for rendering) */
  radius: number;
}

export const ExplosionComponent = defineComponent<Explosion>();
