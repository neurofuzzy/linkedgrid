import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { FogOfWarComponent, FogVisionComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';

// Fog states
const UNEXPLORED = 0;
const EXPLORED = 1;
const VISIBLE = 2;

/**
 * Fog of War System
 * 
 * Manages map visibility and exploration.
 * Tracks unexplored, explored, and visible areas.
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const fogSystem = new FogOfWarSystem();
 * world.addSystem(fogSystem);
 * 
 * // Create fog tracker
 * const fog = world.createEntity();
 * world.addComponent(fog, FogOfWarComponent, {
 *   width: 50,
 *   height: 50,
 *   shroudExplored: true
 * });
 * 
 * // Give player vision
 * world.addComponent(player, FogVisionComponent, {
 *   radius: 8,
 *   active: true
 * });
 * ```
 */
export class FogOfWarSystem extends System {
  /**
   * Update fog of war
   */
  update(dt: number): void {
    for (const [fogEntity, fog] of this.world.query(FogOfWarComponent)) {
      // Initialize fog grid
      if (!fog.fogGrid) {
        fog.fogGrid = new Uint8Array(fog.width * fog.height);
      }
      
      // Initialize timer
      if (fog.updateTimer === undefined) {
        fog.updateTimer = fog.updateInterval ?? 0;
      }
      
      // Update timer
      fog.updateTimer -= dt;
      if (fog.updateTimer > 0) continue;
      fog.updateTimer = fog.updateInterval ?? 0;
      
      // Clear visible state if shroud is enabled
      if (fog.shroudExplored) {
        for (let i = 0; i < fog.fogGrid.length; i++) {
          if (fog.fogGrid[i] === VISIBLE) {
            fog.fogGrid[i] = EXPLORED;
          }
        }
      }
      
      // Update vision from all vision providers
      for (const [visionEntity, vision] of this.world.query(FogVisionComponent)) {
        if (!vision.active) continue;
        
        const pos = this.world.getComponent(visionEntity, GridPositionComponent);
        if (!pos) continue;
        
        this.revealCircle(fog, pos.x, pos.y, vision.radius);
      }
    }
  }
  
  /**
   * Reveal circular area around position
   */
  private revealCircle(fog: FogOfWar, centerX: number, centerY: number, radius: number): void {
    if (!fog.fogGrid) return;
    
    const radiusSq = radius * radius;
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(fog.width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(fog.height - 1, Math.ceil(centerY + radius));
    
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distSq = dx * dx + dy * dy;
        
        if (distSq <= radiusSq) {
          const index = y * fog.width + x;
          fog.fogGrid[index] = VISIBLE;
        }
      }
    }
  }
  
  /**
   * Reveal area around entity
   */
  revealAround(entity: Entity, radius: number): void {
    const pos = this.world.getComponent(entity, GridPositionComponent);
    if (!pos) return;
    
    for (const [_fogEntity, fog] of this.world.query(FogOfWarComponent)) {
      this.revealCircle(fog, pos.x, pos.y, radius);
    }
  }
  
  /**
   * Check if cell is visible
   */
  isVisible(fogEntity: Entity, x: number, y: number): boolean {
    const fog = this.world.getComponent(fogEntity, FogOfWarComponent);
    if (!fog || !fog.fogGrid) return false;
    
    if (x < 0 || x >= fog.width || y < 0 || y >= fog.height) return false;
    
    const index = y * fog.width + x;
    return fog.fogGrid[index] === VISIBLE;
  }
  
  /**
   * Check if cell is explored
   */
  isExplored(fogEntity: Entity, x: number, y: number): boolean {
    const fog = this.world.getComponent(fogEntity, FogOfWarComponent);
    if (!fog || !fog.fogGrid) return false;
    
    if (x < 0 || x >= fog.width || y < 0 || y >= fog.height) return false;
    
    const index = y * fog.width + x;
    return fog.fogGrid[index] >= EXPLORED;
  }
  
  /**
   * Get fog state at position
   */
  getFogState(fogEntity: Entity, x: number, y: number): 'unexplored' | 'explored' | 'visible' {
    const fog = this.world.getComponent(fogEntity, FogOfWarComponent);
    if (!fog || !fog.fogGrid) return 'unexplored';
    
    if (x < 0 || x >= fog.width || y < 0 || y >= fog.height) return 'unexplored';
    
    const index = y * fog.width + x;
    const state = fog.fogGrid[index];
    
    if (state === VISIBLE) return 'visible';
    if (state === EXPLORED) return 'explored';
    return 'unexplored';
  }
  
  /**
   * Clear all fog (reveal entire map)
   */
  clearAllFog(fogEntity: Entity): void {
    const fog = this.world.getComponent(fogEntity, FogOfWarComponent);
    if (!fog || !fog.fogGrid) return;
    
    fog.fogGrid.fill(VISIBLE);
  }
  
  /**
   * Reset all fog (hide entire map)
   */
  resetAllFog(fogEntity: Entity): void {
    const fog = this.world.getComponent(fogEntity, FogOfWarComponent);
    if (!fog || !fog.fogGrid) return;
    
    fog.fogGrid.fill(UNEXPLORED);
  }
}
