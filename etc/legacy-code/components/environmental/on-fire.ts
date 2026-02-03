import { defineComponent } from '@basegrid/ecs';

/**
 * On Fire component for entities/terrain currently burning.
 * 
 * @component OnFire
 * @category environmental
 * @icon flame
 * @description Entity is currently on fire, burns for duration then turns to ash
 * 
 * Different from BurningComponent (which is a status effect on entities):
 * - OnFireComponent is for terrain/objects that are on fire
 * - Burns for a duration then turns to burnt/ash
 * - Spreads to adjacent flammable entities
 * 
 * @property {number} burnTime - Ticks before burning out
 * @property {number} ticksBurning - Current tick count
 * @property {number} spreadChance - Chance to spread to adjacent flammable entities (0.0-1.0)
 * @property {number} burntValue - Cell value to set when burnt out (default: 0)
 * 
 * @example
 * ```typescript
 * // Tree catches fire
 * const tree = world.createEntity();
 * world.addComponent(tree, FlammableComponent, {
 *   igniteChance: 0.3,
 *   burnTime: 5
 * });
 * world.addComponent(tree, GridPositionComponent, { x: 10, y: 10, grid });
 * 
 * // Ignite it
 * world.addComponent(tree, OnFireComponent, {
 *   burnTime: 5,
 *   spreadChance: 0.3
 * });
 * 
 * // FireSpreadSystem will handle spreading and burnout
 * ```
 */
export interface OnFire {
  /** Ticks before burning out */
  burnTime: number;
  
  /** Current tick count */
  ticksBurning: number;
  
  /** Chance to spread to adjacent flammable entities (0.0-1.0) */
  spreadChance: number;
  
  /** Cell value to set when burnt out (default: 0) */
  burntValue?: number;
}

export const OnFireComponent = defineComponent<OnFire>();
