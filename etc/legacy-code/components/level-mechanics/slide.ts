import { defineComponent } from '@basegrid/ecs';
import type { Direction } from '@basegrid/grid';

/**
 * @component Slide
 * @icon wind
 * @description Multi-step movement that continues until hitting an obstacle
 * 
 * Slide Component
 * 
 * Allows entities to slide multiple cells in one direction until hitting an obstacle.
 * Used for ice-sliding puzzles, dashing, knockback, etc.
 * 
 * @property {Direction | null} slideDirection - Current slide direction (null if not sliding)
 * @property {number} maxSteps - Maximum cells to slide in one direction
 * @property {number[]} stopValues - Grid cell values that stop sliding
 * @property {string[]} stopTags - Entity tags that stop sliding
 * @property {(entity: number, steps: number) => void} onSlideComplete - Callback when slide finishes
 * 
 * @example
 * ```typescript
 * const player = world.createEntity();
 * world.addComponent(player, GridPositionComponent, { x: 5, y: 5, grid });
 * world.addComponent(player, SlideComponent, {
 *   slideDirection: null,
 *   maxSteps: 20,
 *   stopValues: [1],  // Stop at walls (value 1)
 *   stopTags: ['wall'],  // Stop at wall entities
 *   onSlideComplete: (entity, steps) => {
 *     console.log(`Slid ${steps} cells`);
 *   }
 * });
 * 
 * // Initiate slide
 * const slide = world.getComponent(player, SlideComponent);
 * slide.slideDirection = Direction.RT;  // Slide right
 * ```
 */
export interface Slide {
  /** Current slide direction (null if not sliding) */
  slideDirection: Direction | null;
  
  /** Maximum cells to slide in one direction */
  maxSteps?: number;
  
  /** Grid cell values that stop sliding (e.g., walls) */
  stopValues?: number[];
  
  /** Entity tags that stop sliding (e.g., ['wall']) */
  stopTags?: string[];
  
  /** Callback when slide completes */
  onSlideComplete?: (entity: number, steps: number) => void;
}

export const SlideComponent = defineComponent<Slide>();
