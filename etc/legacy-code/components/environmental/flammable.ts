import { defineComponent } from '@basegrid/ecs';

/**
 * Flammable component for entities/terrain that can catch fire.
 * 
 * @component Flammable
 * @category environmental
 * @icon flame
 * @description Entity can catch fire and burn, spreading to adjacent flammable entities
 * 
 * Flammable entities can be ignited by:
 * - Adjacent OnFire entities
 * - Fire sources
 * - Explicit ignition
 * 
 * @property {number} igniteChance - Chance to ignite when exposed to fire (0.0-1.0)
 * @property {number} burnTime - How long to burn before burning out
 * @property {number} spreadChance - Chance to spread fire to adjacent flammables (0.0-1.0)
 * @property {number} burntValue - Cell value when burnt out (default: 0 for EMPTY)
 * 
 * @example
 * ```typescript
 * // Create tree that can burn
 * const tree = world.createEntity();
 * world.addComponent(tree, FlammableComponent, {
 *   igniteChance: 0.3,  // 30% chance when exposed to fire
 *   burnTime: 5,         // Burns for 5 ticks
 *   spreadChance: 0.3,   // 30% chance to spread
 *   burntValue: 3        // Becomes BURNT when done
 * });
 * world.addComponent(tree, GridPositionComponent, { x: 10, y: 10, grid });
 * 
 * // FireSpreadSystem will handle ignition
 * ```
 */
export interface Flammable {
  /** Chance to ignite when exposed to fire (0.0-1.0) */
  igniteChance: number;
  
  /** How long to burn before burning out */
  burnTime: number;
  
  /** Chance to spread fire to adjacent flammables (0.0-1.0) */
  spreadChance: number;
  
  /** Cell value when burnt out (default: 0 for EMPTY) */
  burntValue?: number;
}

export const FlammableComponent = defineComponent<Flammable>();
