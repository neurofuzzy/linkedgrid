import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component StructureHealth
 * @icon activity
 * @description Health for structures (destructible walls, barrels, crates)
 * 
 * Structure Health Component
 * 
 * Gives structures (walls, barrels, crates) health and destructibility.
 * Works with StructureComponent and StructureBlockComponent.
 * 
 * Examples:
 * - Destructible walls
 * - Explosive barrels
 * - Breakable crates
 * - Building damage
 * 
 * @property {number} current - Current health
 * @property {number} maximum - Maximum health
 * @property {boolean} invulnerable - Whether structure is invulnerable
 * @property {number} defense - Armor/defense rating (reduces damage)
 * @property {boolean} repairable - Whether structure can be repaired
 * 
 * @example
 * ```typescript
 * // Create destructible wall block
 * const wall = world.createEntity();
 * world.addComponent(wall, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(wall, StructureBlockComponent, { blockType: 'wall' });
 * world.addComponent(wall, StructureHealthComponent, {
 *   current: 50,
 *   maximum: 50,
 *   onDestroy: (entity) => {
 *     // Remove wall, trigger effects
 *     world.removeEntity(entity);
 *   }
 * });
 * ```
 */
export interface StructureHealth {
  /** Current health */
  current: number;
  
  /** Maximum health */
  maximum: number;
  
  /** Whether structure is invulnerable */
  invulnerable?: boolean;
  
  /** Optional: Armor/defense rating (reduces damage) */
  defense?: number;
  
  /** Optional: Callback when structure takes damage */
  onDamage?: (entity: Entity, amount: number, source?: Entity) => void;
  
  /** Optional: Callback when structure is destroyed */
  onDestroy?: (entity: Entity, killer?: Entity) => void;
  
  /** Optional: Callback when structure is repaired */
  onRepair?: (entity: Entity, amount: number) => void;
  
  /** Whether structure can be repaired */
  repairable?: boolean;
}

export const StructureHealthComponent = defineComponent<StructureHealth>();
