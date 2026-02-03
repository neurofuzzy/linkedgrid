import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { PlayerComponent, TypeComponent, HealthComponent } from '@basegrid/ecs';
import { getDamageable, isDamageable, ShieldComponent, StructureHealthComponent, ArmorComponent } from '@basegrid/gameplay';

/**
 * Game Rules System
 * 
 * Central authority for core game mechanics:
 * - Unified damage pipeline (Shield → Armor → Health)
 * - Automatic death handling (health ≤ 0 → destroy entity)
 * - Centralized invulnerability checks
 * - Player identification
 * - Extensibility hooks for custom rules
 * 
 * Features:
 * - **Strict Laws**: Death always destroys entity (unless overridden)
 * - **Damage Pipeline**: Shields absorb first, then armor, then health
 * - **DRY**: No more duplicated invulnerability checks
 * - **Extensible**: Hooks for custom damage modifiers and death behavior
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const gameRules = new GameRulesSystem();
 * world.addSystem(gameRules);
 * 
 * // Apply damage (automatically goes through shield/armor pipeline)
 * gameRules.applyDamage(enemy, 50, player);
 * 
 * // Custom damage modifier
 * gameRules.onBeforeDamage = (entity, damage) => {
 *   const powerup = world.getComponent(entity, PowerupComponent);
 *   if (powerup?.invincible) return 0;
 *   return damage * (powerup?.damageMultiplier ?? 1.0);
 * };
 * 
 * // Custom death behavior (e.g., respawn instead of destroy)
 * gameRules.onDeath = (entity, killer) => {
 *   const respawn = world.getComponent(entity, RespawnableComponent);
 *   if (respawn) {
 *     // Move to respawn point
 *     return false; // Prevent default destruction
 *   }
 *   return true; // Allow default destruction
 * };
 * ```
 */
export class GameRulesSystem extends System {
  /**
   * Optional: Hook called before damage is applied.
   * Can modify damage amount or cancel damage entirely.
   * Return modified damage amount (return 0 to cancel).
   */
  onBeforeDamage?: (entity: Entity, damage: number, source?: Entity) => number;
  
  /**
   * Optional: Hook called after damage is applied.
   * Useful for visual effects, sounds, etc.
   */
  onAfterDamage?: (entity: Entity, actualDamage: number, source?: Entity) => void;
  
  /**
   * Optional: Hook called when entity dies/is destroyed.
   * Return false to prevent default entity destruction.
   * Return true or undefined to allow destruction.
   */
  onDeath?: (entity: Entity, killer?: Entity) => boolean | void;
  
  /**
   * Update game rules system.
   * Currently handles invulnerability timers.
   */
  update(dt: number): void {
    // Update invulnerability timers for entities with health
    for (const [entity] of this.world.query(ShieldComponent)) {
      const damageable = getDamageable(this.world, entity);
      if (damageable && damageable.invulnerabilityTimer !== undefined && damageable.invulnerabilityTimer > 0) {
        damageable.invulnerabilityTimer -= dt;
        if (damageable.invulnerabilityTimer < 0) {
          damageable.invulnerabilityTimer = 0;
        }
      }
    }
  }
  
  /**
   * Apply damage to entity through unified pipeline.
   * 
   * Damage flows through:
   * 1. Before-damage hook (can modify or cancel)
   * 2. Invulnerability check
   * 3. Shield absorption (if ShieldComponent present)
   * 4. Armor absorption (if ArmorComponent present)
   * 5. Health damage (HealthComponent or StructureHealthComponent)
   * 6. Death check (health ≤ 0 → destroy entity)
   * 7. After-damage hook
   * 
   * @param entity - Entity to damage
   * @param damage - Amount of damage to apply
   * @param source - Optional: Entity that caused the damage
   * @returns Actual damage dealt to health (after shields/armor)
   */
  applyDamage(entity: Entity, damage: number, source?: Entity): number {
    // 1. Before-damage hook
    let modifiedDamage = damage;
    if (this.onBeforeDamage) {
      modifiedDamage = this.onBeforeDamage(entity, damage, source);
      if (modifiedDamage <= 0) {
        return 0; // Damage cancelled
      }
    }
    
    // 2. Check invulnerability
    const damageable = getDamageable(this.world, entity);
    if (!damageable) {
      return 0; // Entity can't take damage
    }
    
    if (damageable.invulnerable) {
      return 0; // Entity is invulnerable
    }
    
    if (damageable.invulnerabilityTimer !== undefined && damageable.invulnerabilityTimer > 0) {
      return 0; // Entity has active invulnerability timer
    }
    
    // 3. Shield absorption
    let remainingDamage = modifiedDamage;
    const shield = this.world.getComponent(entity, ShieldComponent);
    if (shield && shield.active !== false && shield.current > 0) {
      const damageToShield = Math.min(remainingDamage, shield.current);
      shield.current -= damageToShield;
      remainingDamage -= damageToShield;
      
      // Reset shield regen delay
      if (shield.timeSinceLastDamage !== undefined) {
        shield.timeSinceLastDamage = 0;
      }
      
      // Shield damage callback
      if (shield.onShieldDamage && damageToShield > 0) {
        shield.onShieldDamage(entity, damageToShield);
      }
      
      // Shield depleted callback
      if (shield.current <= 0 && shield.onShieldDeplete) {
        shield.onShieldDeplete(entity);
      }
      
      // Check if shield blocks all remaining damage
      if (remainingDamage > 0 && shield.blocksAllDamage) {
        remainingDamage = 0;
      }
      
      // Apply damage passthrough modifier
      if (remainingDamage > 0 && shield.damagePassthrough !== undefined) {
        remainingDamage *= shield.damagePassthrough;
      }
    }
    
    // 4. Armor absorption
    if (remainingDamage > 0) {
      const armor = this.world.getComponent(entity, ArmorComponent);
      if (armor && armor.active !== false && armor.durability > 0) {
        const damageAbsorbed = remainingDamage * armor.absorption;
        const damageToHealth = remainingDamage - damageAbsorbed;
        
        // Calculate armor degradation
        let durabilityLost = 0;
        if (armor.degradePerHit !== undefined) {
          durabilityLost += armor.degradePerHit;
        }
        if (armor.degradeFromDamage !== undefined) {
          durabilityLost += damageAbsorbed * armor.degradeFromDamage;
        }
        
        // Apply degradation
        armor.durability = Math.max(0, armor.durability - durabilityLost);
        
        // Armor damage callback
        if (armor.onArmorDamage && (damageAbsorbed > 0 || durabilityLost > 0)) {
          armor.onArmorDamage(entity, damageAbsorbed, durabilityLost);
        }
        
        // Armor break callback
        if (armor.durability <= 0 && armor.onArmorBreak) {
          armor.onArmorBreak(entity);
        }
        
        remainingDamage = damageToHealth;
      }
    }
    
    // 5. Apply remaining damage to health
    let actualHealthDamage = 0;
    if (remainingDamage > 0) {
      actualHealthDamage = Math.min(remainingDamage, damageable.current);
      damageable.current -= actualHealthDamage;
      
      // Health damage callback
      if (damageable.onDamage) {
        damageable.onDamage(entity, actualHealthDamage, source);
      }
    }
    
    // 6. Check death condition
    if (damageable.current <= 0) {
      this.handleDeath(entity, source);
    }
    
    // 7. After-damage hook
    if (this.onAfterDamage && actualHealthDamage > 0) {
      this.onAfterDamage(entity, actualHealthDamage, source);
    }
    
    return actualHealthDamage;
  }
  
  /**
   * Handle entity death/destruction.
   * 
   * Called automatically when health reaches 0.
   * Triggers death callbacks and destroys entity (unless overridden).
   * 
   * @param entity - Entity that died
   * @param killer - Optional: Entity that caused the death
   */
  private handleDeath(entity: Entity, killer?: Entity): void {
    // Trigger death callbacks (checking both Health and StructureHealth)
    const health = this.world.getComponent(entity, HealthComponent);
    if (health?.onDeath) {
      health.onDeath(entity, killer);
    }
    
    const structureHealth = this.world.getComponent(entity, StructureHealthComponent);
    if (structureHealth?.onDestroy) {
      structureHealth.onDestroy(entity, killer);
    }
    
    // Trigger custom death hook
    let shouldDestroy = true;
    if (this.onDeath) {
      const result = this.onDeath(entity, killer);
      if (result === false) {
        shouldDestroy = false; // Custom hook prevented destruction
      }
    }
    
    // Destroy entity (unless prevented by hook)
    if (shouldDestroy) {
      this.world.destroyEntity(entity);
    }
  }
  
  /**
   * Check if entity is a player.
   * 
   * @param entity - Entity to check
   * @returns true if entity is a player
   */
  isPlayer(entity: Entity): boolean {
    // Check PlayerComponent first
    if (this.world.hasComponent(entity, PlayerComponent)) {
      return true;
    }
    
    // Check TypeComponent.isPlayer
    const type = this.world.getComponent(entity, TypeComponent);
    if (type?.isPlayer) {
      return true;
    }
    
    // Check TypeComponent.type === 'player'
    if (type?.type === 'player') {
      return true;
    }
    
    return false;
  }
  
  /**
   * Get all player entities.
   * 
   * @returns Array of player entities
   */
  getPlayers(): Entity[] {
    const players: Entity[] = [];
    
    // Check PlayerComponent
    for (const [entity] of this.world.query(PlayerComponent)) {
      players.push(entity);
    }
    
    // Check TypeComponent.isPlayer or type === 'player'
    for (const [entity, type] of this.world.query(TypeComponent)) {
      if (!players.includes(entity)) {
        if (type.isPlayer || type.type === 'player') {
          players.push(entity);
        }
      }
    }
    
    return players;
  }
  
  /**
   * Check if entity can take damage.
   * 
   * @param entity - Entity to check
   * @returns true if entity has health/structure health
   */
  canTakeDamage(entity: Entity): boolean {
    return isDamageable(this.world, entity);
  }
}
