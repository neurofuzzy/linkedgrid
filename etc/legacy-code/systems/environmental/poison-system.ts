import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { PoisonedComponent } from '@basegrid/gameplay';
import { PoisonCloudComponent } from '@basegrid/gameplay';
import { PoisonSourceComponent } from '@basegrid/gameplay';
import { HealthComponent } from '@basegrid/ecs';
import { GridPositionComponent } from '@basegrid/ecs';
import { VisualComponent } from '@basegrid/ecs';

/**
 * Poison System - Manages poison status effects
 * 
 * Handles three poison mechanics:
 * 1. **Poisoned status**: Damage over time (DOT) for affected entities
 * 2. **Poison clouds**: Spreading cloud entities with limited lifetime
 * 3. **Poison sources**: Permanent environmental hazards (pools, zones)
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const poisonSystem = new PoisonSystem();
 * world.addSystem(poisonSystem);
 * 
 * // Create poison pool
 * const pool = world.createEntity();
 * world.addComponent(pool, PoisonSourceComponent, {
 *   poisonDuration: 120,
 *   poisonDamage: 2
 * });
 * world.addComponent(pool, GridPositionComponent, { x: 6, y: 6, grid });
 * 
 * // Create player
 * const player = world.createEntity();
 * world.addComponent(player, HealthComponent, { current: 100, max: 100 });
 * world.addComponent(player, GridPositionComponent, { x: 6, y: 6, grid });
 * 
 * // System will apply poison when player steps on pool
 * world.update(16.67);
 * ```
 */
export class PoisonSystem extends System {
  /**
   * Calculate Manhattan distance
   */
  private manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }
  
  /**
   * Update poison system
   */
  update(_dt: number): void {
    // 1. Apply damage from Poisoned status
    this.updatePoisonedEntities();
    
    // 2. Update poison clouds (spread and lifetime)
    this.updatePoisonClouds();
    
    // 3. Apply poison from sources to nearby entities
    this.applyPoisonFromSources();
    
    // 4. Apply poison from clouds to entities
    this.applyPoisonFromClouds();
  }
  
  /**
   * Apply damage to poisoned entities
   */
  private updatePoisonedEntities(): void {
    const toRemove: Entity[] = [];
    
    for (const [entity, poisoned] of this.world.query(PoisonedComponent)) {
      // Initialize tick counter
      if (poisoned.ticksSinceLastDamage === undefined) {
        poisoned.ticksSinceLastDamage = 0;
      }
      
      poisoned.ticksSinceLastDamage++;
      const interval = poisoned.tickInterval || 1;
      
      // Apply damage at intervals
      if (poisoned.ticksSinceLastDamage >= interval) {
        const health = this.world.getComponent(entity, HealthComponent);
        if (health) {
          health.current = Math.max(0, health.current - poisoned.damagePerTick);
        }
        poisoned.ticksSinceLastDamage = 0;
      }
      
      // Decrement duration
      poisoned.duration--;
      
      // Remove if expired
      if (poisoned.duration <= 0) {
        toRemove.push(entity);
      }
    }
    
    // Remove expired poison
    for (const entity of toRemove) {
      this.world.removeComponent(entity, PoisonedComponent);
    }
  }
  
  /**
   * Update poison clouds (spread and lifetime)
   */
  private updatePoisonClouds(): void {
    const toRemove: Entity[] = [];
    const newClouds: Array<{ x: number; y: number; cloud: typeof PoisonCloudComponent.prototype; visual?: typeof VisualComponent.prototype }> = [];
    
    for (const [entity, cloud] of this.world.query(PoisonCloudComponent)) {
      const cloudPos = this.world.getComponent(entity, GridPositionComponent);
      if (!cloudPos) continue;
      
      // Get visual component for copying to spread clouds
      const visual = this.world.getComponent(entity, VisualComponent);
      
      // Decrement lifetime
      cloud.lifetime--;
      
      if (cloud.lifetime <= 0) {
        toRemove.push(entity);
        continue;
      }
      
      // Handle spreading
      if (cloud.ticksSinceSpread === undefined) {
        cloud.ticksSinceSpread = 0;
      }
      
      cloud.ticksSinceSpread++;
      const spreadInterval = cloud.spreadInterval || 10;
      
      if (cloud.ticksSinceSpread >= spreadInterval) {
        cloud.ticksSinceSpread = 0;
        
        const spreadChance = cloud.spreadChance ?? 0.3;
        if (Math.random() < spreadChance) {
          // Try to spread to a neighbor
          const cell = cloudPos.grid.cell(cloudPos.x, cloudPos.y);
          if (cell) {
            const neighbors = cell.neighbors().filter(n => n !== null);
            
            // Find empty neighbor without existing cloud
            const validNeighbor = neighbors.find(n => {
              const val = n!.values[0];
              if (val !== 0) return false; // Not empty
              
              // Check if cloud already exists here
              for (const [_, otherCloudPos] of this.world.query(GridPositionComponent, PoisonCloudComponent)) {
                if (otherCloudPos.grid === cloudPos.grid && 
                    otherCloudPos.x === n!.x && 
                    otherCloudPos.y === n!.y) {
                  return false;
                }
              }
              
              return true;
            });
            
            if (validNeighbor) {
              // Create new cloud at neighbor
              newClouds.push({
                x: validNeighbor.x,
                y: validNeighbor.y,
                cloud: {
                  lifetime: 40,
                  spreadChance: cloud.spreadChance,
                  spreadInterval: cloud.spreadInterval,
                  poisonDuration: cloud.poisonDuration,
                  poisonDamage: cloud.poisonDamage
                },
                visual: visual ? {
                  cellValue: visual.cellValue,
                  layer: visual.layer
                } : undefined
              });
            }
          }
        }
      }
    }
    
    // Remove expired clouds
    for (const entity of toRemove) {
      this.world.destroyEntity(entity);
    }
    
    // Create new spread clouds
    for (const { x, y, cloud, visual } of newClouds) {
      // Get a reference position for the grid (use first cloud position)
      let gridRef: any = null;
      for (const [_, cloudPos] of this.world.query(GridPositionComponent, PoisonCloudComponent)) {
        gridRef = cloudPos.grid;
        break;
      }
      
      if (gridRef) {
        const newCloud = this.world.createEntity();
        this.world.addComponent(newCloud, PoisonCloudComponent, cloud);
        this.world.addComponent(newCloud, GridPositionComponent, { 
          x, 
          y, 
          grid: gridRef
        });
        
        // Copy visual properties from parent cloud
        if (visual) {
          this.world.addComponent(newCloud, VisualComponent, visual);
        }
      }
    }
  }
  
  /**
   * Apply poison from sources to entities
   */
  private applyPoisonFromSources(): void {
    for (const [sourceEntity, source] of this.world.query(PoisonSourceComponent)) {
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
          // Check if already poisoned by this source
          if (source.oneTimeOnly) {
            if (!source.poisonedEntities) {
              source.poisonedEntities = new Set();
            }
            if (source.poisonedEntities.has(entity)) {
              continue;
            }
            source.poisonedEntities.add(entity);
          }
          
          // Apply or refresh poison
          const existingPoison = this.world.getComponent(entity, PoisonedComponent);
          if (existingPoison) {
            // Refresh duration if new poison is stronger/longer
            existingPoison.duration = Math.max(existingPoison.duration, source.poisonDuration);
          } else {
            // Apply new poison
            this.world.addComponent(entity, PoisonedComponent, {
              duration: source.poisonDuration,
              damagePerTick: source.poisonDamage,
              tickInterval: source.tickInterval || 1
            });
          }
        }
      }
    }
  }
  
  /**
   * Apply poison from clouds to entities
   */
  private applyPoisonFromClouds(): void {
    for (const [cloudEntity, cloud] of this.world.query(PoisonCloudComponent)) {
      const cloudPos = this.world.getComponent(cloudEntity, GridPositionComponent);
      if (!cloudPos) continue;
      
      // Find entities at same position
      for (const [entity, entityPos] of this.world.query(GridPositionComponent)) {
        // Skip self
        if (entity === cloudEntity) continue;
        
        // Only affect same grid and position
        if (entityPos.grid !== cloudPos.grid) continue;
        if (entityPos.x !== cloudPos.x || entityPos.y !== cloudPos.y) continue;
        
        // Apply poison
        const existingPoison = this.world.getComponent(entity, PoisonedComponent);
        if (!existingPoison) {
          this.world.addComponent(entity, PoisonedComponent, {
            duration: cloud.poisonDuration,
            damagePerTick: cloud.poisonDamage,
            tickInterval: cloud.tickInterval || 1
          });
        }
      }
    }
  }
}
