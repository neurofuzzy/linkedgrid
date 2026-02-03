import { defineComponent } from '@basegrid/ecs';

/**
 * @component Extinguisher
 * @icon droplet
 * @description Removes burn status (water tiles, rain, firefighters)
 * 
 * Extinguisher component for entities that remove burn status.
 * 
 * Extinguishers remove burning from entities:
 * - Water tiles
 * - Rain clouds
 * - Firefighter NPCs
 * 
 * @property {number} radius - Radius of extinguishing effect (0 = same cell only)
 * 
 * @example
 * ```typescript
 * // Create water tile
 * const water = world.createEntity();
 * world.addComponent(water, ExtinguisherComponent, {
 *   radius: 0  // Extinguish only on same cell
 * });
 * world.addComponent(water, GridPositionComponent, { x: 4, y: 13, grid });
 * 
 * // BurnSystem will extinguish burning entities standing on water
 * ```
 */
export interface Extinguisher {
  /** Radius of extinguishing effect (0 = same cell only) */
  radius?: number;
}

export const ExtinguisherComponent = defineComponent<Extinguisher>();
