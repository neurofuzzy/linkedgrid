import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { ArmorComponent } from '@basegrid/gameplay';
import { HealthComponent } from '@basegrid/ecs';

/**
 * Armor System
 * 
 * Manages degrading armor that absorbs damage but loses durability.
 * Unlike shields, armor doesn't regenerate automatically.
 * 
 * Features:
 * - Damage absorption with degradation
 * - Flat or percentage-based degradation
 * - Armor breaking when durability depletes
 * - Manual repair capability
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const armorSystem = new ArmorSystem();
 * world.addSystem(armorSystem);
 * 
 * // Create armored entity
 * const entity = world.createEntity();
 * world.addComponent(entity, HealthComponent, { current: 100, maximum: 100 });
 * world.addComponent(entity, ArmorComponent, {
 *   durability: 50,
 *   maximum: 50,
 *   absorption: 0.5,
 *   degradePerHit: 5
 * });
 * 
 * // Apply damage
 * armorSystem.applyDamage(entity, 20);
 * // Armor absorbs 10 damage (50%), health takes 10
 * // Armor degrades by 5 durability
 * ```
 */
export class ArmorSystem extends System {
  /**
   * Update armor system
   */
  update(_dt: number): void {
    // Armor doesn't have per-frame updates (no regeneration)
    // All logic handled in applyDamage
  }
  
  /**
   * Apply damage to entity with armor
   * 
   * Armor absorbs a percentage of damage and degrades.
   * Returns the amount of damage that went through armor.
   */
  applyDamage(entity: Entity, damage: number, source?: Entity): number {
    const armor = this.world.getComponent(entity, ArmorComponent);
    
    if (!armor || armor.active === false || armor.durability <= 0) {
      // No armor or armor broken, apply full damage to health
      return this.applyHealthDamage(entity, damage, source);
    }
    
    // Calculate damage absorbed by armor
    const damageAbsorbed = damage * armor.absorption;
    const damageToHealth = damage - damageAbsorbed;
    
    // Calculate armor degradation
    let durabilityLost = 0;
    
    if (armor.degradePerHit !== undefined) {
      durabilityLost += armor.degradePerHit;
    }
    
    if (armor.degradeFromDamage !== undefined) {
      durabilityLost += damageAbsorbed * armor.degradeFromDamage;
    }
    
    // Apply degradation to armor
    armor.durability = Math.max(0, armor.durability - durabilityLost);
    
    // Callback for armor damage
    if (armor.onArmorDamage && (damageAbsorbed > 0 || durabilityLost > 0)) {
      armor.onArmorDamage(entity, damageAbsorbed, durabilityLost);
    }
    
    // Check if armor broke
    if (armor.durability <= 0) {
      if (armor.onArmorBreak) {
        armor.onArmorBreak(entity);
      }
    }
    
    // Apply remaining damage to health
    if (damageToHealth > 0) {
      return this.applyHealthDamage(entity, damageToHealth, source);
    }
    
    return damageToHealth;
  }
  
  /**
   * Apply damage directly to health (bypassing armor)
   */
  private applyHealthDamage(entity: Entity, damage: number, source?: Entity): number {
    const health = this.world.getComponent(entity, HealthComponent);
    if (!health) return 0;
    
    // Check invulnerability
    if (health.invulnerable) return 0;
    if ((health.invulnerabilityTimer ?? 0) > 0) return 0;
    
    const actualDamage = Math.min(damage, health.current);
    health.current -= actualDamage;
    
    if (health.onDamage) {
      health.onDamage(entity, actualDamage, source);
    }
    
    if (health.current <= 0 && health.onDeath) {
      health.onDeath(entity, source);
    }
    
    return actualDamage;
  }
  
  /**
   * Repair armor
   */
  repairArmor(entity: Entity, amount: number): void {
    const armor = this.world.getComponent(entity, ArmorComponent);
    if (!armor) return;
    
    if (armor.repairable === false) return;
    
    const oldDurability = armor.durability;
    armor.durability = Math.min(armor.maximum, armor.durability + amount);
    const actualRepair = armor.durability - oldDurability;
    
    if (actualRepair > 0 && armor.onArmorRepair) {
      armor.onArmorRepair(entity, actualRepair);
    }
  }
  
  /**
   * Fully repair armor
   */
  fullyRepairArmor(entity: Entity): void {
    const armor = this.world.getComponent(entity, ArmorComponent);
    if (!armor) return;
    
    if (armor.repairable === false) return;
    
    const repairAmount = armor.maximum - armor.durability;
    armor.durability = armor.maximum;
    
    if (repairAmount > 0 && armor.onArmorRepair) {
      armor.onArmorRepair(entity, repairAmount);
    }
  }
  
  /**
   * Disable armor
   */
  disableArmor(entity: Entity): void {
    const armor = this.world.getComponent(entity, ArmorComponent);
    if (!armor) return;
    
    armor.active = false;
  }
  
  /**
   * Enable armor
   */
  enableArmor(entity: Entity): void {
    const armor = this.world.getComponent(entity, ArmorComponent);
    if (!armor) return;
    
    armor.active = true;
  }
}
