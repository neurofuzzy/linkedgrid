import { defineComponent } from '@basegrid/ecs';

/**
 * @component Thawer
 * @icon sun
 * @description Melts ice and removes frozen status (fire, heat sources)
 * 
 * Thawer component for entities that remove freeze status.
 * 
 * Thawers melt ice and remove frozen status:
 * - Fire tiles
 * - Heat sources
 * - Warm zones
 * 
 * @property {number} radius - Radius of thawing effect (0 = same cell only)
 * 
 * @example
 * ```typescript
 * // Create fire that thaws frozen entities
 * const fire = world.createEntity();
 * world.addComponent(fire, ThawerComponent, {
 *   radius: 1  // Thaws adjacent cells
 * });
 * world.addComponent(fire, GridPositionComponent, { x: 10, y: 9, grid });
 * 
 * // FreezeSystem will thaw frozen entities near fire
 * ```
 */
export interface Thawer {
  /** Radius of thawing effect (0 = same cell only) */
  radius?: number;
}

export const ThawerComponent = defineComponent<Thawer>();
