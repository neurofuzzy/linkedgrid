import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { CollisionDamageComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';
import { HealthComponent } from '@basegrid/ecs';
import { TypeComponent } from '@basegrid/ecs';
import { GameRulesSystem } from '@basegrid/gameplay';
import { isDamageable } from '@basegrid/gameplay';

/**
 * CollisionDamage System - Handles passive contact damage
 * 
 * Manages entities that damage others on contact:
 * - Checks for overlapping positions each frame
 * - Applies damage based on interval and tags
 * - Tracks damage timing per entity
 * - Supports one-time or continuous damage
 * - Optional knockback
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const collisionSystem = new CollisionDamageSystem();
 * world.addSystem(collisionSystem);
 * 
 * // Create spike trap
 * const spike = world.createEntity();
 * world.addComponent(spike, CollisionDamageComponent, {
 *   damage: 3,
 *   damageInterval: 30,  // 0.5s between hits
 *   affectsTags: ['player']
 * });
 * world.addComponent(spike, GridPositionComponent, { x: 10, y: 5, grid });
 * 
 * // Create player
 * const player = world.createEntity();
 * world.addComponent(player, HealthComponent, { current: 10, maximum: 10 });
 * world.addComponent(player, GridPositionComponent, { x: 10, y: 5, grid });
 * world.addComponent(player, TypeComponent, { type: 'player' });
 * 
 * // System automatically:
 * // - Detects player on spike cell
 * // - Applies 3 damage
 * // - Waits 30 ticks before next damage
 * ```
 */
export class CollisionDamageSystem extends System {
  private currentTick = 0;
  
  /**
   * Update collision damage
   */
  update(_dt: number): void {
    this.currentTick++;
    
    // Check each entity with collision damage
    for (const [damageEntity, damageComp] of this.world.query(CollisionDamageComponent)) {
      // Skip if inactive
      if (damageComp.active === false) continue;
      
      const damagePos = this.world.getComponent(damageEntity, GridPositionComponent);
      if (!damagePos) continue;
      
      // Initialize tracking maps if needed
      if (!damageComp.lastDamageTime) {
        damageComp.lastDamageTime = new Map();
      }
      if (damageComp.damageOnce && !damageComp.damagedEntities) {
        damageComp.damagedEntities = new Set();
      }
      
      // Find entities at same position
      for (const [targetEntity, targetPos] of this.world.query(GridPositionComponent)) {
        // Skip self
        if (targetEntity === damageEntity) continue;
        
        // Skip if different grids
        if (targetPos.grid !== damagePos.grid) continue;
        
        // Skip if not at same position
        if (targetPos.x !== damagePos.x || targetPos.y !== damagePos.y) continue;
        
        // Skip if can't take damage
        if (!isDamageable(this.world, targetEntity)) continue;
        
        // Check if already damaged (for damageOnce mode)
        if (damageComp.damageOnce && damageComp.damagedEntities?.has(targetEntity)) {
          continue;
        }
        
        // Check type filtering
        if (!this.canDamageTarget(damageEntity, targetEntity, damageComp)) {
          continue;
        }
        
        // Check damage interval (allow first damage)
        const lastDamage = damageComp.lastDamageTime.get(targetEntity);
        if (lastDamage !== undefined && this.currentTick - lastDamage < damageComp.damageInterval) {
          continue;
        }
        
        // Apply damage
        this.applyDamage(damageEntity, targetEntity, damageComp);
        
        // Update tracking
        damageComp.lastDamageTime.set(targetEntity, this.currentTick);
        if (damageComp.damageOnce) {
          damageComp.damagedEntities?.add(targetEntity);
        }
      }
    }
  }
  
  /**
   * Check if damage entity can affect target based on tags
   */
  private canDamageTarget(
    damageEntity: Entity,
    targetEntity: Entity,
    damageComp: CollisionDamageComponent
  ): boolean {
    const targetType = this.world.getComponent(targetEntity, TypeComponent);
    const targetTag = targetType?.type;
    
    // If no type, allow damage (unless ignoresTags prevents it)
    if (!targetTag) {
      return true;
    }
    
    // Check ignoresTags first
    if (damageComp.ignoresTags?.includes(targetTag)) {
      return false;
    }
    
    // Check affectsTags
    if (damageComp.affectsTags && damageComp.affectsTags.length > 0) {
      return damageComp.affectsTags.includes(targetTag);
    }
    
    // No restrictions, allow damage
    return true;
  }
  
  /**
   * Apply damage to target.
   * Uses GameRulesSystem if available, otherwise falls back to direct damage.
   */
  private applyDamage(
    damageEntity: Entity,
    targetEntity: Entity,
    damageComp: CollisionDamageComponent
  ): void {
    // Try to use GameRulesSystem for unified damage pipeline
    const gameRules = this.world.getSystem(GameRulesSystem);
    if (gameRules) {
      gameRules.applyDamage(targetEntity, damageComp.damage, damageEntity);
      
      // Trigger damage source callback
      if (damageComp.onDamageDealt) {
        damageComp.onDamageDealt(damageEntity, targetEntity, damageComp.damage);
      }
      return;
    }
    
    // Fallback: Direct damage application (for games not using GameRulesSystem)
    const targetHealth = this.world.getComponent(targetEntity, HealthComponent);
    if (!targetHealth) return;
    
    // Check invulnerability
    if (targetHealth.invulnerable) return;
    if ((targetHealth.invulnerabilityTimer ?? 0) > 0) return;
    
    // Apply damage
    targetHealth.current -= damageComp.damage;
    
    // Trigger callback
    if (damageComp.onDamageDealt) {
      damageComp.onDamageDealt(damageEntity, targetEntity, damageComp.damage);
    }
    
    // Trigger health callback
    if (targetHealth.onDamage) {
      targetHealth.onDamage(targetEntity, damageComp.damage, damageEntity);
    }
    
    // Handle death
    if (targetHealth.current <= 0) {
      targetHealth.current = 0;
      if (targetHealth.onDeath) {
        targetHealth.onDeath(targetEntity, damageEntity);
      }
      this.world.destroyEntity(targetEntity);
    }
  }
}
