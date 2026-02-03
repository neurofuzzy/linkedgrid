import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { BuffComponent } from '../../components/environmental/buff';
import { BuffZoneComponent } from '../../components/environmental/buff-zone';
import { GridPositionComponent } from '@basegrid/ecs';

/**
 * Buff System - Manages buff/debuff status effects
 * 
 * Handles buff mechanics:
 * 1. **Buff status**: Temporary stat modifiers (speed, defense, attack)
 * 2. **Buff zones**: Environmental entities that grant buffs
 * 
 * Stat modifications:
 * - Speed: Affects movement rate (use with FreezeSystem or movement systems)
 * - Defense: Reduces damage taken (checked by combat systems)
 * - Attack: Increases damage dealt (checked by combat systems)
 * - Weakness: Reduces damage dealt (debuff)
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const buffSystem = new BuffSystem();
 * world.addSystem(buffSystem);
 * 
 * // Create speed boost zone
 * const boost = world.createEntity();
 * world.addComponent(boost, BuffZoneComponent, {
 *   buffType: 'speed',
 *   buffDuration: 180,
 *   buffMultiplier: 2.0
 * });
 * world.addComponent(boost, GridPositionComponent, { x: 5, y: 4, grid });
 * 
 * // System applies buff when entities enter zone
 * world.update(16.67);
 * ```
 */
export class BuffSystem extends System {
  /**
   * Calculate Manhattan distance
   */
  private manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }
  
  /**
   * Get multiplier for a specific buff type
   */
  getMultiplier(entity: Entity, buffType: 'speed' | 'defense' | 'attack' | 'weakness'): number {
    let multiplier = 1.0;
    
    // Query all buffs on entity
    // Note: Entities can have multiple BuffComponents of different types
    for (const [ent, buff] of this.world.query(BuffComponent)) {
      if (ent !== entity) continue;
      if (buff.type !== buffType) continue;
      
      multiplier *= buff.multiplier;
    }
    
    return multiplier;
  }
  
  /**
   * Update buff system
   */
  update(_dt: number): void {
    // 1. Update buff durations
    this.updateBuffDurations();
    
    // 2. Apply buffs from zones
    this.applyBuffsFromZones();
  }
  
  /**
   * Update buff durations and remove expired buffs
   */
  private updateBuffDurations(): void {
    const toRemove: Array<{ entity: Entity; component: typeof BuffComponent }> = [];
    
    for (const [entity, buff] of this.world.query(BuffComponent)) {
      buff.duration--;
      
      if (buff.duration <= 0) {
        toRemove.push({ entity, component: BuffComponent });
      }
    }
    
    // Remove expired buffs
    for (const { entity, component } of toRemove) {
      this.world.removeComponent(entity, component);
    }
  }
  
  /**
   * Apply buffs from buff zones to entities
   */
  private applyBuffsFromZones(): void {
    for (const [zoneEntity, zone] of this.world.query(BuffZoneComponent)) {
      const zonePos = this.world.getComponent(zoneEntity, GridPositionComponent);
      if (!zonePos) continue;
      
      const radius = zone.radius ?? 0;
      
      // Find entities within range
      for (const [entity, entityPos] of this.world.query(GridPositionComponent)) {
        // Skip self
        if (entity === zoneEntity) continue;
        
        // Only affect same grid
        if (entityPos.grid !== zonePos.grid) continue;
        
        // Check distance
        const distance = this.manhattanDistance(
          entityPos.x,
          entityPos.y,
          zonePos.x,
          zonePos.y
        );
        
        if (distance <= radius) {
          // Check if already buffed by this zone
          if (zone.oneTimeOnly) {
            if (!zone.buffedEntities) {
              zone.buffedEntities = new Set();
            }
            if (zone.buffedEntities.has(entity)) {
              continue;
            }
            zone.buffedEntities.add(entity);
          }
          
          // Check if already has this buff type
          let existingBuff: any = null;
          for (const [ent, buff] of this.world.query(BuffComponent)) {
            if (ent === entity && buff.type === zone.buffType) {
              existingBuff = buff;
              break;
            }
          }
          
          if (existingBuff) {
            // Refresh duration
            existingBuff.duration = Math.max(existingBuff.duration, zone.buffDuration);
          } else {
            // Apply new buff (need to add as new entity-component pair)
            // Note: World.addComponent handles multiple components of same type
            this.world.addComponent(entity, BuffComponent, {
              type: zone.buffType,
              duration: zone.buffDuration,
              multiplier: zone.buffMultiplier
            });
          }
        }
      }
    }
  }
}
