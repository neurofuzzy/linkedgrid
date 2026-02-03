import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { LavaHazardComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';
import { HealthComponent } from '@basegrid/ecs';
import { TypeComponent } from '@basegrid/ecs';
import { GameRulesSystem } from '@basegrid/gameplay';
import { isDamageable } from '@basegrid/ecs';

/**
 * Lava Hazard System
 * 
 * Manages environmental hazards that damage entities.
 * Handles periodic damage to entities on hazard tiles.
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const lavaSystem = new LavaHazardSystem();
 * world.addSystem(lavaSystem);
 * 
 * // Create lava pool
 * const lava = world.createEntity();
 * world.addComponent(lava, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(lava, LavaHazardComponent, {
 *   damagePerSecond: 10,
 *   damageInterval: 0.5
 * });
 * 
 * // Entities on lava take damage
 * world.update(0.016);
 * ```
 */
export class LavaHazardSystem extends System {
  /**
   * Update all lava hazards
   */
  update(dt: number): void {
    for (const [hazardEntity, hazard] of this.world.query(LavaHazardComponent)) {
      const hazardPos = this.world.getComponent(hazardEntity, GridPositionComponent);
      if (!hazardPos) continue;
      
      // Initialize tracking
      if (!hazard.entitiesInHazard) {
        hazard.entitiesInHazard = new Set();
      }
      if (hazard.damageTimer === undefined) {
        hazard.damageTimer = hazard.damageInterval ?? 1.0;
      }
      
      // Find entities at hazard position
      const currentEntities = new Set<Entity>();
      for (const [entity, pos] of this.world.query(GridPositionComponent)) {
        if (entity === hazardEntity) continue;
        if (pos.x !== hazardPos.x || pos.y !== hazardPos.y) continue;
        
        // Check if entity has health
        const health = this.world.getComponent(entity, HealthComponent);
        if (!health) continue;
        
        // Check filters
        if (!this.matchesFilters(entity, hazard)) continue;
        
        currentEntities.add(entity);
        
        // Fire onEnter for new entities
        if (!hazard.entitiesInHazard.has(entity)) {
          if (hazard.onEnter) {
            hazard.onEnter(hazardEntity, entity);
          }
        }
      }
      
      // Fire onExit for entities that left
      for (const entity of hazard.entitiesInHazard) {
        if (!currentEntities.has(entity)) {
          if (hazard.onExit) {
            hazard.onExit(hazardEntity, entity);
          }
        }
      }
      
      // Update tracked entities
      hazard.entitiesInHazard = currentEntities;
      
      // Update damage timer
      hazard.damageTimer -= dt;
      if (hazard.damageTimer <= 0) {
        // Apply damage to all entities in hazard
        for (const entity of currentEntities) {
          this.applyDamage(hazardEntity, entity, hazard);
        }
        
        // Reset timer
        hazard.damageTimer = hazard.damageInterval ?? 1.0;
      }
    }
  }
  
  /**
   * Apply hazard damage to entity.
   * Uses GameRulesSystem if available, otherwise falls back to direct damage.
   */
  private applyDamage(hazardEntity: Entity, victimEntity: Entity, hazard: LavaHazardComponent): void {
    // Calculate damage for this interval
    const interval = hazard.damageInterval ?? 1.0;
    const damage = hazard.damagePerSecond * interval;
    
    // Try to use GameRulesSystem for unified damage pipeline
    const gameRules = this.world.getSystem(GameRulesSystem);
    if (gameRules) {
      gameRules.applyDamage(victimEntity, damage, hazardEntity);
      
      // Fire hazard callback
      if (hazard.onDamage) {
        hazard.onDamage(hazardEntity, victimEntity, damage);
      }
      return;
    }
    
    // Fallback: Direct damage application
    const health = this.world.getComponent(victimEntity, HealthComponent);
    if (!health || health.invulnerable) return;
    
    health.current -= damage;
    
    // Fire callback
    if (hazard.onDamage) {
      hazard.onDamage(hazardEntity, victimEntity, damage);
    }
    
    // Check death
    if (health.current <= 0) {
      health.current = 0;
      if (health.onDeath) {
        health.onDeath(victimEntity, hazardEntity);
      }
      this.world.destroyEntity(victimEntity);
    } else if (health.onDamage) {
      health.onDamage(victimEntity, damage, hazardEntity);
    }
  }
  
  /**
   * Check if entity matches hazard filters
   */
  private matchesFilters(entity: Entity, hazard: LavaHazard): boolean {
    const type = this.world.getComponent(entity, TypeComponent);
    const tags = (type as any)?.tags || [];
    
    // Check immunity
    if (hazard.immunityTags && hazard.immunityTags.length > 0) {
      if (hazard.immunityTags.some(tag => tags.includes(tag))) {
        return false;
      }
    }
    
    // Check target tags
    if (hazard.targetTags && hazard.targetTags.length > 0) {
      if (!hazard.targetTags.some(tag => tags.includes(tag))) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Check if entity is in hazard
   */
  isInHazard(entity: Entity, hazard: Entity): boolean {
    const hazardComp = this.world.getComponent(hazard, LavaHazardComponent);
    return hazardComp?.entitiesInHazard?.has(entity) ?? false;
  }
}
