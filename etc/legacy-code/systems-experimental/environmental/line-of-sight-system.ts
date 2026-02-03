import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { LineOfSightComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';
import { TypeComponent } from '@basegrid/ecs';

/**
 * Line of Sight System
 * 
 * Manages visibility detection for entities.
 * Uses raycasting to check line-of-sight blockage.
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const losSystem = new LineOfSightSystem();
 * world.addSystem(losSystem);
 * 
 * // Create guard with vision
 * const guard = world.createEntity();
 * world.addComponent(guard, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(guard, LineOfSightComponent, {
 *   range: 8,
 *   blockedBy: [WALL]
 * });
 * 
 * // Check visibility
 * const canSeePlayer = losSystem.canSee(guard, player);
 * ```
 */
export class LineOfSightSystem extends System {
  /**
   * Update all line-of-sight entities
   */
  update(dt: number): void {
    for (const [entity, los] of this.world.query(LineOfSightComponent)) {
      const pos = this.world.getComponent(entity, GridPositionComponent);
      if (!pos) continue;
      
      // Initialize
      if (!los.visibleEntities) {
        los.visibleEntities = new Set();
      }
      if (los.updateTimer === undefined) {
        los.updateTimer = los.updateInterval ?? 0;
      }
      
      // Update timer
      los.updateTimer -= dt;
      if (los.updateTimer > 0) continue;
      los.updateTimer = los.updateInterval ?? 0;
      
      // Find visible entities
      const previousVisible = new Set(los.visibleEntities);
      los.visibleEntities.clear();
      
      for (const [targetEntity, targetPos] of this.world.query(GridPositionComponent)) {
        if (targetEntity === entity) continue;
        if (targetPos.grid !== pos.grid) continue;
        
        // Check range
        const dx = targetPos.x - pos.x;
        const dy = targetPos.y - pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > los.range) continue;
        
        // Check vision cone
        if (los.visionAngle !== undefined && los.visionAngle < 360) {
          if (!this.isInVisionCone(dx, dy, los)) continue;
        }
        
        // Check tag filters
        if (!this.matchesFilters(targetEntity, los)) continue;
        
        // Check line of sight
        if (!this.hasLineOfSight(pos, targetPos, los)) continue;
        
        los.visibleEntities.add(targetEntity);
      }
      
      // Fire callbacks for spotted entities
      if (los.onSpotted) {
        for (const target of los.visibleEntities) {
          if (!previousVisible.has(target)) {
            los.onSpotted(entity, target);
          }
        }
      }
      
      // Fire callbacks for lost entities
      if (los.onLost) {
        for (const target of previousVisible) {
          if (!los.visibleEntities.has(target)) {
            los.onLost(entity, target);
          }
        }
      }
    }
  }
  
  /**
   * Check if target is in vision cone
   */
  private isInVisionCone(dx: number, dy: number, los: LineOfSight): boolean {
    if (!los.visionDirection || !los.visionAngle) return true;
    
    // Calculate angle to target
    const targetAngle = Math.atan2(dy, dx);
    const visionAngle = Math.atan2(los.visionDirection.y, los.visionDirection.x);
    
    // Calculate angle difference
    let angleDiff = targetAngle - visionAngle;
    
    // Normalize to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    // Check if within cone
    const halfCone = (los.visionAngle * Math.PI / 180) / 2;
    return Math.abs(angleDiff) <= halfCone;
  }
  
  /**
   * Check if there's clear line of sight
   */
  private hasLineOfSight(
    from: GridPositionComponent,
    to: GridPositionComponent,
    los: LineOfSight
  ): boolean {
    if (!los.blockedBy || los.blockedBy.length === 0) return true;
    
    // Bresenham's line algorithm
    let x0 = Math.floor(from.x);
    let y0 = Math.floor(from.y);
    const x1 = Math.floor(to.x);
    const y1 = Math.floor(to.y);
    
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    
    while (true) {
      // Don't check starting position
      if (x0 !== Math.floor(from.x) || y0 !== Math.floor(from.y)) {
        const cell = from.grid.cell(x0, y0);
        if (cell && los.blockedBy.includes(cell.value)) {
          return false;
        }
      }
      
      // Reached target
      if (x0 === x1 && y0 === y1) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
    
    return true;
  }
  
  /**
   * Check if entity matches tag filters
   */
  private matchesFilters(entity: Entity, los: LineOfSight): boolean {
    const type = this.world.getComponent(entity, TypeComponent);
    const tags = (type as any)?.tags || [];
    
    // Check ignore tags
    if (los.ignoreTags && los.ignoreTags.length > 0) {
      if (los.ignoreTags.some(tag => tags.includes(tag))) {
        return false;
      }
    }
    
    // Check target tags
    if (los.targetTags && los.targetTags.length > 0) {
      if (!los.targetTags.some(tag => tags.includes(tag))) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Check if observer can see target
   */
  canSee(observer: Entity, target: Entity): boolean {
    const los = this.world.getComponent(observer, LineOfSightComponent);
    return los?.visibleEntities?.has(target) ?? false;
  }
  
  /**
   * Get all visible entities for observer
   */
  getVisibleEntities(observer: Entity): Entity[] {
    const los = this.world.getComponent(observer, LineOfSightComponent);
    return los?.visibleEntities ? Array.from(los.visibleEntities) : [];
  }
  
  /**
   * Force immediate visibility update
   */
  forceUpdate(entity: Entity): void {
    const los = this.world.getComponent(entity, LineOfSightComponent);
    if (los) {
      los.updateTimer = 0;
    }
  }
}
