import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { BurningComponent } from '@basegrid/gameplay';
import { FireSourceComponent } from '@basegrid/gameplay';
import { ExtinguisherComponent } from '@basegrid/gameplay';
import { HealthComponent } from '@basegrid/ecs';
import { GridPositionComponent } from '@basegrid/ecs';

/**
 * Burn System - Manages burn status effects and fire spreading
 * 
 * Handles burn mechanics:
 * 1. **Burning status**: Damage over time for burning entities
 * 2. **Fire sources**: Ignite entities (fire tiles, lava)
 * 3. **Extinguishers**: Remove burn status (water, rain)
 * 4. **Fire spreading**: Burning entities can spread to terrain
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const burnSystem = new BurnSystem();
 * world.addSystem(burnSystem);
 * 
 * // Create fire tile
 * const fire = world.createEntity();
 * world.addComponent(fire, FireSourceComponent, {
 *   burnDuration: 90,
 *   burnDamage: 2
 * });
 * world.addComponent(fire, GridPositionComponent, { x: 8, y: 10, grid });
 * 
 * // Create water tile
 * const water = world.createEntity();
 * world.addComponent(water, ExtinguisherComponent, { radius: 0 });
 * world.addComponent(water, GridPositionComponent, { x: 4, y: 13, grid });
 * 
 * // System manages burning, ignition, and extinguishing
 * world.update(16.67);
 * ```
 */
export class BurnSystem extends System {
  /**
   * Calculate Manhattan distance
   */
  private manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }
  
  /**
   * Update burn system
   */
  update(_dt: number): void {
    // 1. Extinguish burning entities standing in water
    this.extinguishBurns();
    
    // 2. Apply burn damage to entities
    this.updateBurningEntities();
    
    // 3. Ignite entities from fire sources
    this.applyFireFromSources();
  }
  
  /**
   * Extinguish burning entities
   */
  private extinguishBurns(): void {
    const toRemove: Entity[] = [];
    
    for (const [burningEntity, burningPos] of this.world.query(GridPositionComponent, BurningComponent)) {
      // Check if standing on extinguisher
      for (const [extEntity, extinguisher] of this.world.query(ExtinguisherComponent)) {
        const extPos = this.world.getComponent(extEntity, GridPositionComponent);
        if (!extPos) continue;
        
        // Only same grid
        if (extPos.grid !== burningPos.grid) continue;
        
        const radius = extinguisher.radius ?? 0;
        const distance = this.manhattanDistance(
          burningPos.x,
          burningPos.y,
          extPos.x,
          extPos.y
        );
        
        if (distance <= radius) {
          toRemove.push(burningEntity);
          break;
        }
      }
    }
    
    // Remove burning from extinguished entities
    for (const entity of toRemove) {
      this.world.removeComponent(entity, BurningComponent);
    }
  }
  
  /**
   * Apply damage to burning entities
   */
  private updateBurningEntities(): void {
    const toRemove: Entity[] = [];
    
    for (const [entity, burning] of this.world.query(BurningComponent)) {
      // Initialize tick counter
      if (burning.ticksSinceLastDamage === undefined) {
        burning.ticksSinceLastDamage = 0;
      }
      
      burning.ticksSinceLastDamage++;
      const interval = burning.tickInterval || 1;
      
      // Apply damage at intervals
      if (burning.ticksSinceLastDamage >= interval) {
        const health = this.world.getComponent(entity, HealthComponent);
        if (health) {
          health.current = Math.max(0, health.current - burning.damagePerTick);
        }
        burning.ticksSinceLastDamage = 0;
      }
      
      // Decrement duration
      burning.duration--;
      
      // Remove if expired
      if (burning.duration <= 0) {
        toRemove.push(entity);
      }
    }
    
    // Remove expired burns
    for (const entity of toRemove) {
      this.world.removeComponent(entity, BurningComponent);
    }
  }
  
  /**
   * Ignite entities from fire sources
   */
  private applyFireFromSources(): void {
    for (const [sourceEntity, source] of this.world.query(FireSourceComponent)) {
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
          // Check if already ignited by this source
          if (source.oneTimeOnly) {
            if (!source.ignitedEntities) {
              source.ignitedEntities = new Set();
            }
            if (source.ignitedEntities.has(entity)) {
              continue;
            }
            source.ignitedEntities.add(entity);
          }
          
          // Apply or refresh burn
          const existingBurn = this.world.getComponent(entity, BurningComponent);
          if (existingBurn) {
            // Refresh duration if new burn is longer
            existingBurn.duration = Math.max(existingBurn.duration, source.burnDuration);
          } else {
            // Apply new burn
            this.world.addComponent(entity, BurningComponent, {
              duration: source.burnDuration,
              damagePerTick: source.burnDamage,
              tickInterval: 1
            });
          }
        }
      }
    }
  }
}
