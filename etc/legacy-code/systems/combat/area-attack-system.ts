/**
 * Area Attack System
 * 
 * Handles area-of-effect attacks using AreaQueryComponent.
 * Provides helper method for triggering attacks from click handlers.
 * Uses ExplosionComponent for automatic cleanup.
 */

import { System } from '@basegrid/ecs';
import type { Entity, World } from '@basegrid/ecs';
import { GridPositionComponent, AreaQueryComponent, HealthComponent, TypeComponent, VisualComponent } from '@basegrid/ecs';
import { ExplosionComponent } from '@basegrid/gameplay';
import type { LinkedGrid } from '@basegrid/grid';

export class AreaAttackSystem extends System {
  /**
   * Trigger an area attack at the specified position.
   * Creates a sensor entity with AreaQueryComponent for damage,
   * and visual entities with ExplosionComponent for each cell in the blast radius.
   * ExplosionComponent handles automatic cleanup after lifetime expires.
   * 
   * @param x - X position of attack center
   * @param y - Y position of attack center
   * @param grid - Grid reference
   * @param radius - Attack radius
   * @param explosionValue - Visual cell value for explosion
   * @param explosionLayer - Layer for explosion visual
   * @param lifetime - Explosion lifetime in ticks (default: 10)
   * @returns Array of created visual entity IDs (including sensor)
   */
  triggerAttack(
    x: number,
    y: number,
    grid: LinkedGrid<number>,
    radius: number,
    explosionValue: number,
    explosionLayer: number,
    lifetime: number = 10
  ): Entity[] {
    const entities: Entity[] = [];
    
    // Get all cells in radius using LinkedCell.getCircle
    const centerCell = grid.cell(x, y);
    if (!centerCell) return entities;
    
    const affectedCells = centerCell.getCircle(radius);
    
    // Create sensor entity at attack center for damage query
    const sensor = this.world.createEntity();
    this.world.addComponent(sensor, GridPositionComponent, { x, y, grid });
    this.world.addComponent(sensor, VisualComponent, { 
      cellValue: explosionValue, 
      layer: explosionLayer 
    });
    this.world.addComponent(sensor, ExplosionComponent, {
      lifetime,
      radius
    });
    
    // Add area query component for damage
    this.world.addComponent(sensor, AreaQueryComponent, {
      type: 'circle',
      radius,
      targetTags: ['enemy'],
      continuous: false, // One-shot query
      onEnter: (_owner, target) => {
        // Damage enemy
        const health = this.world.getComponent(target, HealthComponent);
        if (health) {
          health.current--;
          
          if (health.current <= 0) {
            // Destroy enemy
            this.world.destroyEntity(target);
          }
        }
      }
    });
    
    entities.push(sensor);
    
    // Create visual entities for entire blast radius
    for (const cell of affectedCells) {
      // Skip center (already has sensor)
      if (cell.x === x && cell.y === y) continue;
      
      // Create visual explosion entity with ExplosionComponent
      const visual = this.world.createEntity();
      this.world.addComponent(visual, GridPositionComponent, { x: cell.x, y: cell.y, grid });
      this.world.addComponent(visual, VisualComponent, { 
        cellValue: explosionValue, 
        layer: explosionLayer 
      });
      this.world.addComponent(visual, ExplosionComponent, {
        lifetime,
        radius: 0 // Visual entities don't need radius
      });
      entities.push(visual);
    }
    
    return entities;
  }
  
  /**
   * Update area attack system.
   * Handles explosion lifetime countdown and cleanup.
   */
  update(_dt: number): void {
    // Update explosion lifetimes and remove expired ones
    const toRemove: Entity[] = [];
    
    for (const [entity, explosion] of this.world.query(ExplosionComponent)) {
      explosion.lifetime--;
      
      if (explosion.lifetime <= 0) {
        toRemove.push(entity);
      }
    }
    
    // Remove expired explosions
    for (const entity of toRemove) {
      this.world.destroyEntity(entity);
    }
  }
}
