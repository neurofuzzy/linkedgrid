import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { RayWeaponComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';
import { HealthComponent } from '@basegrid/ecs';
import { TypeComponent } from '@basegrid/ecs';
import { BlockedByComponent } from '@basegrid/ecs';
import { Direction } from '@basegrid/grid';
import { GameRulesSystem } from '@basegrid/gameplay';
import { isDamageable } from '@basegrid/ecs';

/**
 * Ray Weapon System
 * 
 * Handles instant-hit ray weapons (lasers, railguns).
 * Fires in straight lines, dealing damage along the path.
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const raySystem = new RayWeaponSystem();
 * world.addSystem(raySystem);
 * 
 * // Create laser turret
 * const turret = world.createEntity();
 * world.addComponent(turret, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(turret, RayWeaponComponent, {
 *   direction: Direction.RT,
 *   damage: 25,
 *   range: 10,
 *   cooldown: 2.0,
 *   blockedByWalls: true
 * });
 * 
 * // Fire the weapon
 * raySystem.fireWeapon(turret);
 * ```
 */
export class RayWeaponSystem extends System {
  /**
   * Update ray weapon cooldowns
   */
  update(dt: number): void {
    for (const [entity, weapon] of this.world.query(RayWeaponComponent)) {
      if (weapon.cooldownRemaining === undefined) {
        weapon.cooldownRemaining = 0;
        weapon.ready = true;
      }
      
      if (weapon.cooldownRemaining > 0) {
        weapon.cooldownRemaining -= dt;
        if (weapon.cooldownRemaining <= 0) {
          weapon.cooldownRemaining = 0;
          weapon.ready = true;
        } else {
          weapon.ready = false;
        }
      }
    }
  }
  
  /**
   * Fire ray weapon
   */
  fireWeapon(entity: Entity): boolean {
    const weapon = this.world.getComponent(entity, RayWeaponComponent);
    if (!weapon) return false;
    
    // Check cooldown
    if (weapon.cooldownRemaining && weapon.cooldownRemaining > 0) {
      return false;
    }
    
    const pos = this.world.getComponent(entity, GridPositionComponent);
    if (!pos) return false;
    
    // Trace ray and collect hits
    const hits = this.traceRay(entity, pos, weapon);
    
    // Apply damage to hits
    const gameRules = this.world.getSystem(GameRulesSystem);
    for (const target of hits) {
      if (isDamageable(this.world, target)) {
        if (gameRules) {
          // Use GameRulesSystem for unified damage pipeline
          gameRules.applyDamage(target, weapon.damage, entity);
        } else {
          // Fallback: Direct damage application
          const health = this.world.getComponent(target, HealthComponent);
          if (health && !health.invulnerable) {
            health.current -= weapon.damage;
            
            // Check death
            if (health.current <= 0) {
              health.current = 0;
              if (health.onDeath) {
                health.onDeath(target, entity);
              }
              this.world.destroyEntity(target);
            } else if (health.onDamage) {
              health.onDamage(target, weapon.damage, entity);
            }
          }
        }
        
        if (weapon.onHit) {
          weapon.onHit(entity, target, weapon.damage);
        }
      }
    }
    
    // Trigger fire callback
    if (weapon.onFire) {
      weapon.onFire(entity, hits);
    }
    
    // Start cooldown
    weapon.cooldownRemaining = weapon.cooldown;
    weapon.ready = false;
    
    return true;
  }
  
  /**
   * Trace ray and find all targets along path
   */
  private traceRay(
    shooter: Entity,
    pos: GridPositionComponent,
    weapon: RayWeapon
  ): Entity[] {
    const hits: Entity[] = [];
    let currentX = pos.x;
    let currentY = pos.y;
    
    // Get direction delta
    const [dx, dy] = this.getDirectionDelta(weapon.direction);
    
    // Trace along ray
    for (let distance = 0; distance < weapon.range; distance++) {
      currentX += dx;
      currentY += dy;
      
      // Check for wall collision
      if (weapon.blockedByWalls) {
        const cell = pos.grid.cell(currentX, currentY);
        if (!cell || cell.value === 0) {
          // Hit wall or out of bounds
          break;
        }
        
        // Check if shooter is blocked by this cell value
        const blocked = this.world.getComponent(shooter, BlockedByComponent);
        if (blocked && blocked.values.includes(cell.value)) {
          break;
        }
      }
      
      // Check for entities at this position
      for (const [entity, entityPos] of this.world.query(GridPositionComponent)) {
        if (entity === shooter) continue;
        if (entityPos.x !== currentX || entityPos.y !== currentY) continue;
        
        // Check if entity has health
        const health = this.world.getComponent(entity, HealthComponent);
        if (!health) continue;
        
        // Check tag filters
        if (!this.matchesFilters(entity, weapon)) continue;
        
        // Add to hits
        hits.push(entity);
        
        // Check piercing
        if (!weapon.piercing) {
          return hits;
        }
        
        // Check max hits
        if (weapon.maxHits && hits.length >= weapon.maxHits) {
          return hits;
        }
      }
    }
    
    return hits;
  }
  
  /**
   * Get direction delta
   */
  private getDirectionDelta(direction: Direction): [number, number] {
    switch (direction) {
      case Direction.UP: return [0, -1];
      case Direction.DN: return [0, 1];
      case Direction.LT: return [-1, 0];
      case Direction.RT: return [1, 0];
      default: return [0, 0];
    }
  }
  
  /**
   * Check if entity matches tag filters
   */
  private matchesFilters(entity: Entity, weapon: RayWeapon): boolean {
    const type = this.world.getComponent(entity, TypeComponent);
    const tags = (type as any)?.tags || [];
    
    // Check target tags
    if (weapon.targetTags && weapon.targetTags.length > 0) {
      if (!weapon.targetTags.some(tag => tags.includes(tag))) {
        return false;
      }
    }
    
    // Check exclude tags
    if (weapon.excludeTags && weapon.excludeTags.length > 0) {
      if (weapon.excludeTags.some(tag => tags.includes(tag))) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Check if weapon is ready to fire
   */
  isReady(entity: Entity): boolean {
    const weapon = this.world.getComponent(entity, RayWeaponComponent);
    return weapon?.ready ?? false;
  }
  
  /**
   * Set weapon direction
   */
  setDirection(entity: Entity, direction: Direction): void {
    const weapon = this.world.getComponent(entity, RayWeaponComponent);
    if (!weapon) return;
    
    weapon.direction = direction;
  }
}
