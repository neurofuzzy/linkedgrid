import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { ShieldComponent } from '@basegrid/gameplay';
import { HealthComponent } from '@basegrid/ecs';

/**
 * Shield System
 * 
 * Manages regenerating energy shields that absorb damage.
 * 
 * Features:
 * - Damage absorption before health
 * - Automatic regeneration after delay
 * - Configurable passthrough damage
 * - Shield depletion handling
 * 
 * Integration:
 * - Automatically hooks into damage application
 * - Must be added before damage-dealing systems
 * - Works with HealthComponent
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const shieldSystem = new ShieldSystem();
 * world.addSystem(shieldSystem);
 * 
 * // Create shielded entity
 * const entity = world.createEntity();
 * world.addComponent(entity, HealthComponent, { current: 100, maximum: 100 });
 * world.addComponent(entity, ShieldComponent, {
 *   current: 50,
 *   maximum: 50,
 *   regenRate: 2,
 *   regenDelay: 180
 * });
 * 
 * // Apply damage through system
 * shieldSystem.applyDamage(entity, 30);
 * // Shields take 30 damage, health untouched
 * ```
 */
export class ShieldSystem extends System {
  /**
   * Update shield system
   */
  update(dt: number): void {
    for (const [entity, shield] of this.world.query(ShieldComponent)) {
      if (shield.active === false) continue;
      
      // Initialize time since last damage
      if (shield.timeSinceLastDamage === undefined) {
        shield.timeSinceLastDamage = shield.regenDelay;
      }
      
      // Update time since last damage
      if (shield.timeSinceLastDamage < shield.regenDelay) {
        shield.timeSinceLastDamage += dt;
      }
      
      // Check if we can start regenerating
      if (shield.timeSinceLastDamage >= shield.regenDelay && shield.current < shield.maximum) {
        // First tick of regeneration
        if (shield.timeSinceLastDamage === shield.regenDelay) {
          if (shield.onRegenStart) {
            shield.onRegenStart(entity);
          }
        }
        
        // Regenerate shields
        const regenPerTick = (shield.regenRate * dt) / 1000;
        const oldCurrent = shield.current;
        shield.current = Math.min(shield.maximum, shield.current + regenPerTick);
        
        // Check if fully charged
        if (oldCurrent < shield.maximum && shield.current >= shield.maximum) {
          if (shield.onShieldFullyCharged) {
            shield.onShieldFullyCharged(entity);
          }
        }
      }
    }
  }
  
  /**
   * Apply damage to entity with shields
   * 
   * Shields absorb damage first, then excess goes to health.
   * Returns the amount of damage that went through shields.
   */
  applyDamage(entity: Entity, damage: number, source?: Entity): number {
    const shield = this.world.getComponent(entity, ShieldComponent);
    
    if (!shield || shield.active === false || shield.current <= 0) {
      // No shields or shields depleted, apply full damage to health
      return this.applyHealthDamage(entity, damage, source);
    }
    
    const damageToShield = Math.min(damage, shield.current);
    const damageRemaining = damage - damageToShield;
    
    // Apply damage to shield
    shield.current -= damageToShield;
    shield.timeSinceLastDamage = 0; // Reset regen delay
    
    // Callback for shield damage
    if (shield.onShieldDamage && damageToShield > 0) {
      shield.onShieldDamage(entity, damageToShield);
    }
    
    // Check if shield depleted
    if (shield.current <= 0) {
      shield.current = 0;
      if (shield.onShieldDeplete) {
        shield.onShieldDeplete(entity);
      }
    }
    
    // Handle remaining damage
    if (damageRemaining > 0) {
      if (shield.blocksAllDamage) {
        // Shield blocks everything even when depleted (until it breaks)
        return 0;
      } else {
        // Apply remaining damage to health
        const passthrough = shield.damagePassthrough ?? 1.0;
        const healthDamage = damageRemaining * passthrough;
        return this.applyHealthDamage(entity, healthDamage, source);
      }
    }
    
    return 0;
  }
  
  /**
   * Apply damage directly to health (bypassing shields)
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
   * Recharge shield to full instantly
   */
  rechargeShield(entity: Entity): void {
    const shield = this.world.getComponent(entity, ShieldComponent);
    if (!shield) return;
    
    const wasNotFull = shield.current < shield.maximum;
    shield.current = shield.maximum;
    
    if (wasNotFull && shield.onShieldFullyCharged) {
      shield.onShieldFullyCharged(entity);
    }
  }
  
  /**
   * Disable shield
   */
  disableShield(entity: Entity): void {
    const shield = this.world.getComponent(entity, ShieldComponent);
    if (!shield) return;
    
    shield.active = false;
  }
  
  /**
   * Enable shield
   */
  enableShield(entity: Entity): void {
    const shield = this.world.getComponent(entity, ShieldComponent);
    if (!shield) return;
    
    shield.active = true;
  }
}
