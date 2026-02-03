import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { ProjectileComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';
import { HealthComponent } from '@basegrid/ecs';
import { Direction } from '@basegrid/grid';
import { GameRulesSystem } from '@basegrid/gameplay';
import { isDamageable } from '@basegrid/ecs';

/**
 * Projectile System - Handles autonomous projectile movement and collision
 * 
 * Projectiles move in a fixed direction each frame and:
 * - Move to next cell based on direction
 * - Check for collisions (walls, entities with health)
 * - Apply damage on hit
 * - Expire after lifetime or collision
 * - Support piercing (multiple hits)
 * - Support bouncing (reflect off walls)
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const projectileSystem = new ProjectileSystem();
 * world.addSystem(projectileSystem);
 * 
 * // Fire a bullet from player
 * const bullet = world.createEntity();
 * world.addComponent(bullet, ProjectileComponent, {
 *   direction: Direction.RT,
 *   speed: 1,
 *   lifetime: 30,
 *   damage: 5,
 *   owner: playerEntity // Don't hit self
 * });
 * world.addComponent(bullet, GridPositionComponent, { x: playerX, y: playerY, grid });
 * 
 * // System automatically:
 * // - Moves bullet each frame
 * // - Checks for walls and enemies
 * // - Applies damage on hit
 * // - Destroys bullet on collision or expiration
 * ```
 */
export class ProjectileSystem extends System {
  /**
   * Update all projectiles
   */
  update(_dt: number): void {
    const toDestroy: Entity[] = [];
    
    for (const [entity, projectile] of this.world.query(ProjectileComponent)) {
      const pos = this.world.getComponent(entity, GridPositionComponent);
      if (!pos) {
        toDestroy.push(entity);
        continue;
      }
      
      // Decrement lifetime
      projectile.lifetime--;
      if (projectile.lifetime <= 0) {
        toDestroy.push(entity);
        continue;
      }
      
      // Move projectile
      const destroyed = this.moveProjectile(entity, projectile, pos);
      if (destroyed) {
        toDestroy.push(entity);
      }
    }
    
    // Clean up destroyed projectiles
    for (const entity of toDestroy) {
      this.world.destroyEntity(entity);
    }
  }
  
  /**
   * Move a projectile and check for collisions
   * Returns true if projectile should be destroyed
   */
  private moveProjectile(
    entity: Entity,
    projectile: ProjectileComponent,
    pos: GridPositionComponent
  ): boolean {
    const cell = pos.grid.cell(pos.x, pos.y);
    if (!cell) return true; // Off grid
    
    // Get next cell
    const nextCell = cell.neighbor(projectile.direction);
    
    // Check wall collision
    if (!nextCell || nextCell.values[0] === 1) { // 1 = WALL
      if (projectile.bouncing && (projectile.bounceCount ?? 0) < (projectile.maxBounces ?? 0)) {
        // Bounce off wall
        projectile.direction = this.reverseDirection(projectile.direction);
        projectile.bounceCount = (projectile.bounceCount ?? 0) + 1;
        return false; // Continue moving
      }
      return true; // Destroy on wall hit
    }
    
    // Move to next cell
    pos.x = nextCell.x;
    pos.y = nextCell.y;
    
    // Check for entity collisions at new position
    const hitEntity = this.checkEntityCollision(entity, projectile, pos);
    if (hitEntity) {
      // Apply damage through GameRulesSystem (if available) or fallback
      if (isDamageable(this.world, hitEntity)) {
        this.applyDamage(hitEntity, projectile.damage, entity);
      }
      
      // Check if should destroy projectile
      if (projectile.piercing) {
        // Track hit entity
        if (!projectile.hitEntities) {
          projectile.hitEntities = new Set();
        }
        projectile.hitEntities.add(hitEntity);
        
        // Check pierce limit
        if (projectile.maxPierces !== undefined) {
          if (projectile.hitEntities.size >= projectile.maxPierces) {
            return true; // Destroy after max pierces
          }
        }
        return false; // Continue for piercing projectile
      } else {
        return true; // Destroy on hit for normal projectile
      }
    }
    
    return false; // Continue moving
  }
  
  /**
   * Check for entity collision at position
   */
  private checkEntityCollision(
    projectileEntity: Entity,
    projectile: ProjectileComponent,
    pos: GridPositionComponent
  ): Entity | null {
    for (const [entity, otherPos] of this.world.query(GridPositionComponent)) {
      if (entity === projectileEntity) continue; // Skip self
      if (entity === projectile.owner) continue; // Skip owner
      if (otherPos.grid !== pos.grid) continue; // Different grids
      
      // Check if at same position
      if (otherPos.x === pos.x && otherPos.y === pos.y) {
        // Check if entity has health (damageable)
        if (this.world.hasComponent(entity, HealthComponent)) {
          // Skip if already hit (for piercing)
          if (projectile.hitEntities?.has(entity)) continue;
          return entity;
        }
      }
    }
    return null;
  }
  
  /**
   * Apply damage to entity.
   * Uses GameRulesSystem if available, otherwise falls back to direct damage.
   */
  private applyDamage(
    entity: Entity,
    damage: number,
    source: Entity
  ): void {
    // Try to use GameRulesSystem for unified damage pipeline
    const gameRules = this.world.getSystem(GameRulesSystem);
    if (gameRules) {
      gameRules.applyDamage(entity, damage, source);
      return;
    }
    
    // Fallback: Direct damage application (for games not using GameRulesSystem)
    const health = this.world.getComponent(entity, HealthComponent);
    if (!health) return;
    
    // Check invulnerability
    if (health.invulnerable) return;
    if ((health.invulnerabilityTimer ?? 0) > 0) return;
    
    // Apply damage
    health.current -= damage;
    
    // Callback
    if (health.onDamage) {
      health.onDamage(entity, damage, source);
    }
    
    // Check death
    if (health.current <= 0) {
      health.current = 0;
      if (health.onDeath) {
        health.onDeath(entity, source);
      }
      this.world.destroyEntity(entity);
    }
  }
  
  /**
   * Reverse direction (for bouncing)
   */
  private reverseDirection(dir: Direction): Direction {
    switch (dir) {
      case Direction.UP: return Direction.DN;
      case Direction.DN: return Direction.UP;
      case Direction.LT: return Direction.RT;
      case Direction.RT: return Direction.LT;
      default: return dir;
    }
  }
}
