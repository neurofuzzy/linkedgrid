/**
 * Slide System
 * 
 * Handles multi-step movement where entities slide until hitting an obstacle.
 * Used for ice-sliding puzzles, dashing, knockback, etc.
 */

import { System, GridPositionComponent, TypeComponent } from '@basegrid/ecs';
import { SlideComponent } from '../../components/level-mechanics/slide';

/**
 * SlideSystem
 * 
 * Processes entities with SlideComponent, moving them multiple cells
 * in one direction until they hit an obstacle.
 * 
 * Features:
 * - Slides until hitting walls or specified obstacles
 * - Configurable max slide distance
 * - Slide completion callbacks
 * - Supports both grid cell values and entity tags as obstacles
 * 
 * @example
 * ```typescript
 * const slideSystem = new SlideSystem();
 * world.addSystem(slideSystem);
 * 
 * // Create sliding entity
 * const player = world.createEntity();
 * world.addComponent(player, GridPositionComponent, { x: 5, y: 5, grid });
 * world.addComponent(player, SlideComponent, {
 *   slideDirection: Direction.RT,
 *   maxSteps: 20,
 *   stopValues: [1],
 *   stopTags: ['wall']
 * });
 * ```
 */
export class SlideSystem extends System {
  /**
   * Update all sliding entities
   */
  update(_dt: number): void {
    for (const [entity, slide, pos] of this.world.queryMultiple(
      SlideComponent,
      GridPositionComponent
    )) {
      // Skip if not currently sliding
      if (!slide.slideDirection) continue;
      
      const grid = pos.grid;
      const maxSteps = slide.maxSteps ?? 20;
      const stopValues = slide.stopValues ?? [];
      const stopTags = slide.stopTags ?? [];
      
      let steps = 0;
      let currentCell = grid.cell(pos.x, pos.y);
      let shouldStop = false;
      
      // Slide until hitting obstacle or max steps
      while (steps < maxSteps && currentCell && !shouldStop) {
        const neighbor = currentCell.neighbor(slide.slideDirection);
        if (!neighbor) break;
        
        // Check if grid cell value stops slide (walls block entry)
        const cellValue = neighbor.values[0];
        if (stopValues.includes(cellValue)) break;
        
        // Check if a wall-type entity blocks entry
        let wallBlocked = false;
        for (const [otherEntity, otherPos, otherType] of this.world.queryMultiple(
          GridPositionComponent,
          TypeComponent
        )) {
          if (otherEntity === entity) continue;
          if (otherPos.grid !== grid) continue;
          if (otherPos.x !== neighbor.x || otherPos.y !== neighbor.y) continue;
          
          // Only walls block entry - other stopTags (like goals) allow entry but stop after
          if (otherType.tags?.includes('wall')) {
            wallBlocked = true;
            break;
          }
        }
        
        if (wallBlocked) break;
        
        // Move to next cell
        currentCell = neighbor;
        steps++;
        
        // After moving, check if we landed on a stop entity (like a goal)
        for (const [otherEntity, otherPos, otherType] of this.world.queryMultiple(
          GridPositionComponent,
          TypeComponent
        )) {
          if (otherEntity === entity) continue;
          if (otherPos.grid !== grid) continue;
          if (otherPos.x !== currentCell.x || otherPos.y !== currentCell.y) continue;
          
          // Check if entity has a non-wall stopping tag (e.g., goal)
          if (otherType.tags) {
            for (const tag of stopTags) {
              if (tag !== 'wall' && otherType.tags.includes(tag)) {
                shouldStop = true;
                break;
              }
            }
          }
          
          if (shouldStop) break;
        }
      }
      
      // Update position if we moved
      if (steps > 0) {
        pos.x = currentCell!.x;
        pos.y = currentCell!.y;
      }
      
      // Complete the slide
      slide.slideDirection = null;
      
      // Trigger callback
      if (slide.onSlideComplete) {
        slide.onSlideComplete(entity, steps);
      }
    }
  }
}
