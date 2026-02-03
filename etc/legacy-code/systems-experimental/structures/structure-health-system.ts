import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { StructureHealthComponent } from '@basegrid/gameplay';

/**
 * Structure Health System
 * 
 * Manages health for structures like walls, barrels, and crates.
 * Handles damage, destruction, and repair.
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const structureHealthSystem = new StructureHealthSystem();
 * world.addSystem(structureHealthSystem);
 * 
 * // Create destructible wall
 * const wall = world.createEntity();
 * world.addComponent(wall, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(wall, StructureHealthComponent, {
 *   current: 50,
 *   maximum: 50,
 *   onDestroy: (entity) => {
 *     console.log('Wall destroyed!');
 *     world.removeEntity(entity);
 *   }
 * });
 * 
 * // Apply damage
 * structureHealthSystem.applyDamage(wall, 30);
 * ```
 */
export class StructureHealthSystem extends System {
  /**
   * Update structure health system
   */
  update(_dt: number): void {
    // Structure health doesn't need per-frame updates
    // All logic handled in applyDamage/repair methods
  }
  
  /**
   * Apply damage to structure
   */
  applyDamage(entity: Entity, damage: number, source?: Entity): number {
    const health = this.world.getComponent(entity, StructureHealthComponent);
    if (!health) return 0;
    
    // Check invulnerability
    if (health.invulnerable) return 0;
    
    // Apply defense reduction
    let actualDamage = damage;
    if (health.defense && health.defense > 0) {
      actualDamage = Math.max(1, damage - health.defense);
    }
    
    // Apply damage
    const damageTaken = Math.min(actualDamage, health.current);
    health.current -= damageTaken;
    
    // Callback
    if (health.onDamage && damageTaken > 0) {
      health.onDamage(entity, damageTaken, source);
    }
    
    // Check if destroyed
    if (health.current <= 0) {
      health.current = 0;
      if (health.onDestroy) {
        health.onDestroy(entity, source);
      }
    }
    
    return damageTaken;
  }
  
  /**
   * Repair structure
   */
  repairStructure(entity: Entity, amount: number): void {
    const health = this.world.getComponent(entity, StructureHealthComponent);
    if (!health) return;
    
    if (health.repairable === false) return;
    if (health.current <= 0) return; // Can't repair destroyed structures
    
    const oldHealth = health.current;
    health.current = Math.min(health.maximum, health.current + amount);
    const actualRepair = health.current - oldHealth;
    
    if (actualRepair > 0 && health.onRepair) {
      health.onRepair(entity, actualRepair);
    }
  }
  
  /**
   * Fully repair structure
   */
  fullyRepairStructure(entity: Entity): void {
    const health = this.world.getComponent(entity, StructureHealthComponent);
    if (!health) return;
    
    if (health.repairable === false) return;
    if (health.current <= 0) return;
    
    const repairAmount = health.maximum - health.current;
    health.current = health.maximum;
    
    if (repairAmount > 0 && health.onRepair) {
      health.onRepair(entity, repairAmount);
    }
  }
  
  /**
   * Check if structure is destroyed
   */
  isDestroyed(entity: Entity): boolean {
    const health = this.world.getComponent(entity, StructureHealthComponent);
    return health ? health.current <= 0 : false;
  }
  
  /**
   * Set structure invulnerability
   */
  setInvulnerable(entity: Entity, invulnerable: boolean): void {
    const health = this.world.getComponent(entity, StructureHealthComponent);
    if (!health) return;
    
    health.invulnerable = invulnerable;
  }
}
