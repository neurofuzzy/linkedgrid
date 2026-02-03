import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { FrozenComponent } from '@basegrid/gameplay';
import { IceSourceComponent } from '@basegrid/gameplay';
import { ThawerComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';

/**
 * Freeze System - Manages frozen/slowed status effects
 * 
 * Handles freeze mechanics:
 * 1. **Frozen status**: Prevents or slows entity movement
 * 2. **Ice sources**: Apply freeze to entities (ice patches, blizzards)
 * 3. **Thawers**: Remove freeze status (fire, heat)
 * 
 * Freeze severity:
 * - slowMultiplier = 2: Half speed
 * - slowMultiplier = 4: Quarter speed
 * - slowMultiplier = Infinity: Completely frozen
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const freezeSystem = new FreezeSystem();
 * world.addSystem(freezeSystem);
 * 
 * // Create ice patch
 * const ice = world.createEntity();
 * world.addComponent(ice, IceSourceComponent, {
 *   freezeDuration: 60,
 *   slowMultiplier: 2,  // Half speed
 *   radius: 0
 * });
 * world.addComponent(ice, GridPositionComponent, { x: 6, y: 5, grid });
 * 
 * // Create fire (thaws frozen entities)
 * const fire = world.createEntity();
 * world.addComponent(fire, ThawerComponent, { radius: 1 });
 * world.addComponent(fire, GridPositionComponent, { x: 10, y: 9, grid });
 * 
 * // System manages freezing and thawing
 * world.update(16.67);
 * ```
 */
export class FreezeSystem extends System {
  /**
   * Calculate Manhattan distance
   */
  private manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }
  
  /**
   * Update freeze system
   */
  update(_dt: number): void {
    // 1. Thaw frozen entities near heat sources
    this.thawEntities();
    
    // 2. Update frozen entity timers
    this.updateFrozenEntities();
    
    // 3. Apply freeze from ice sources
    this.applyFreezeFromSources();
  }
  
  /**
   * Thaw frozen entities near heat sources
   */
  private thawEntities(): void {
    const toRemove: Entity[] = [];
    
    for (const [frozenEntity, frozenPos] of this.world.query(GridPositionComponent, FrozenComponent)) {
      // Check if near thawer
      for (const [thawerEntity, thawer] of this.world.query(ThawerComponent)) {
        const thawerPos = this.world.getComponent(thawerEntity, GridPositionComponent);
        if (!thawerPos) continue;
        
        // Only same grid
        if (thawerPos.grid !== frozenPos.grid) continue;
        
        const radius = thawer.radius ?? 0;
        const distance = this.manhattanDistance(
          frozenPos.x,
          frozenPos.y,
          thawerPos.x,
          thawerPos.y
        );
        
        if (distance <= radius) {
          toRemove.push(frozenEntity);
          break;
        }
      }
    }
    
    // Thaw entities
    for (const entity of toRemove) {
      this.world.removeComponent(entity, FrozenComponent);
    }
  }
  
  /**
   * Update frozen entity durations
   */
  private updateFrozenEntities(): void {
    const toRemove: Entity[] = [];
    
    for (const [entity, frozen] of this.world.query(FrozenComponent)) {
      // Decrement duration
      frozen.duration--;
      
      // Remove if expired
      if (frozen.duration <= 0) {
        toRemove.push(entity);
      }
    }
    
    // Remove expired freezes
    for (const entity of toRemove) {
      this.world.removeComponent(entity, FrozenComponent);
    }
  }
  
  /**
   * Apply freeze from ice sources
   */
  private applyFreezeFromSources(): void {
    for (const [sourceEntity, source] of this.world.query(IceSourceComponent)) {
      const sourcePos = this.world.getComponent(sourceEntity, GridPositionComponent);
      if (!sourcePos) continue;
      
      const radius = source.radius ?? 0;
      
      // Find entities within range
      for (const [entity, entityPos] of this.world.query(GridPositionComponent)) {
        // Skip self
        if (entity === sourceEntity) continue;
        
        // Only affect same grid
        if (entityPos.grid !== sourcePos.grid) continue;
        
        // Check distance
        const distance = this.manhattanDistance(
          entityPos.x,
          entityPos.y,
          sourcePos.x,
          sourcePos.y
        );
        
        if (distance <= radius) {
          // Check if already frozen by this source
          if (source.oneTimeOnly) {
            if (!source.frozenEntities) {
              source.frozenEntities = new Set();
            }
            if (source.frozenEntities.has(entity)) {
              continue;
            }
            source.frozenEntities.add(entity);
          }
          
          // Apply or refresh freeze
          const existingFreeze = this.world.getComponent(entity, FrozenComponent);
          if (existingFreeze) {
            // Refresh duration
            existingFreeze.duration = Math.max(existingFreeze.duration, source.freezeDuration);
            // Use more severe slow
            existingFreeze.slowMultiplier = Math.max(existingFreeze.slowMultiplier, source.slowMultiplier);
          } else {
            // Apply new freeze
            this.world.addComponent(entity, FrozenComponent, {
              duration: source.freezeDuration,
              slowMultiplier: source.slowMultiplier,
              moveCounter: 0
            });
          }
        }
      }
    }
  }
  
  /**
   * Check if entity can move this tick (based on slow multiplier)
   * 
   * Call this before processing movement systems.
   * Returns false if entity is frozen or hasn't waited long enough.
   */
  canMove(entity: Entity): boolean {
    const frozen = this.world.getComponent(entity, FrozenComponent);
    if (!frozen) return true; // Not frozen, can move
    
    // Completely frozen
    if (frozen.slowMultiplier === Infinity) return false;
    
    // Initialize counter
    if (frozen.moveCounter === undefined) {
      frozen.moveCounter = 0;
    }
    
    frozen.moveCounter++;
    
    // Can move every slowMultiplier ticks
    if (frozen.moveCounter >= frozen.slowMultiplier) {
      frozen.moveCounter = 0;
      return true;
    }
    
    return false;
  }
}
