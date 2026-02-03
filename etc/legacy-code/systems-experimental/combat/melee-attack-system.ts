import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { MeleeAttackComponent, MeleeTargetComponent } from '@basegrid/gameplay';
import { GridPositionComponent, TypeComponent, HealthComponent } from '@basegrid/ecs';
import { KnockbackSystem } from './knockback-system';
import { KnockbackableComponent } from '@basegrid/gameplay';
import { Direction } from '@basegrid/grid';
import { GameRulesSystem } from '@basegrid/gameplay';

/**
 * Melee Attack System
 * 
 * Manages close-range combat attacks.
 * 
 * Features:
 * - Wind-up time before damage
 * - Attack duration/hitbox timing
 * - Directional attacks
 * - Piercing vs single-hit
 * - Knockback integration
 * - Tag-based filtering
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const meleeSystem = new MeleeAttackSystem();
 * world.addSystem(meleeSystem);
 * 
 * // Create player with melee attack
 * const player = world.createEntity();
 * world.addComponent(player, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(player, MeleeAttackComponent, {
 *   damage: 5,
 *   cooldown: 30,
 *   windupTime: 5,
 *   knockbackForce: 2,
 *   affectsTags: ['enemy']
 * });
 * 
 * // Trigger attack
 * const melee = world.getComponent(player, MeleeAttackComponent)!;
 * melee.attacking = true;
 * melee.attackDirection = Direction.RT;
 * ```
 */
export class MeleeAttackSystem extends System {
  /**
   * Update melee attack system
   */
  update(_dt: number): void {
    // 1. Update cooldown timers
    this.updateCooldowns();
    
    // 2. Process active attacks
    this.processAttacks();
  }
  
  /**
   * Update cooldown timers
   */
  private updateCooldowns(): void {
    for (const [_, melee] of this.world.query(MeleeAttackComponent)) {
      if (melee.cooldownTimer && melee.cooldownTimer > 0) {
        melee.cooldownTimer--;
      }
    }
  }
  
  /**
   * Process active attacks
   */
  private processAttacks(): void {
    for (const [entity, melee] of this.world.query(MeleeAttackComponent)) {
      if (!melee.attacking) continue;
      
      const pos = this.world.getComponent(entity, GridPositionComponent);
      if (!pos) {
        this.completeAttack(entity, melee);
        continue;
      }
      
      // Handle wind-up
      if (melee.windupTime && melee.windupTime > 0) {
        if (melee.windupTimer === undefined) {
          melee.windupTimer = melee.windupTime;
          if (melee.onAttackStart) {
            melee.onAttackStart(entity);
          }
        }
        
        if (melee.windupTimer > 0) {
          melee.windupTimer--;
          continue; // Still winding up
        }
      }
      
      // Initialize attack duration
      if (melee.durationTimer === undefined) {
        const duration = melee.attackDuration ?? 1;
        melee.durationTimer = duration;
        melee.hitEntities = new Set();
        
        // If no wind-up, trigger start callback here
        if (!melee.windupTime && melee.onAttackStart) {
          melee.onAttackStart(entity);
        }
      }
      
      // Process attack hitbox
      if (melee.durationTimer && melee.durationTimer > 0) {
        this.processHitDetection(entity, melee, pos);
        melee.durationTimer--;
        
        if (melee.durationTimer <= 0) {
          this.completeAttack(entity, melee);
        }
      }
    }
  }
  
  /**
   * Process hit detection for active attack
   */
  private processHitDetection(
    attacker: Entity,
    melee: MeleeAttackComponent,
    attackerPos: GridPositionComponent
  ): void {
    const range = melee.range ?? 1;
    const direction = melee.attackDirection;
    
    // Get cells in attack range
    const targetCells: Array<{x: number, y: number}> = [];
    
    if (direction) {
      // Directional attack
      const cell = attackerPos.grid.cell(attackerPos.x, attackerPos.y);
      if (cell) {
        let currentCell = cell;
        for (let i = 0; i < range; i++) {
          currentCell = currentCell.move(direction);
          if (!currentCell) break;
          targetCells.push({ x: currentCell.x, y: currentCell.y });
        }
      }
    } else {
      // Omnidirectional attack (hit adjacent cells)
      for (let dx = -range; dx <= range; dx++) {
        for (let dy = -range; dy <= range; dy++) {
          if (dx === 0 && dy === 0) continue;
          const dist = Math.abs(dx) + Math.abs(dy);
          if (dist <= range) {
            targetCells.push({ 
              x: attackerPos.x + dx, 
              y: attackerPos.y + dy 
            });
          }
        }
      }
    }
    
    // Check for targets at each cell
    for (const cellPos of targetCells) {
      for (const [targetEntity, targetComp] of this.world.query(MeleeTargetComponent)) {
        if (targetEntity === attacker) continue;
        if (melee.hitEntities && melee.hitEntities.has(targetEntity)) continue;
        if (targetComp.vulnerable === false) continue;
        
        const targetPos = this.world.getComponent(targetEntity, GridPositionComponent);
        if (!targetPos || targetPos.grid !== attackerPos.grid) continue;
        if (targetPos.x !== cellPos.x || targetPos.y !== cellPos.y) continue;
        
        // Check tag filtering
        if (!this.matchesFilters(targetEntity, melee)) continue;
        
        // Hit!
        this.applyHit(attacker, targetEntity, melee, direction);
        
        // Track hit entity
        if (!melee.hitEntities) {
          melee.hitEntities = new Set();
        }
        melee.hitEntities.add(targetEntity);
        
        // Stop if not piercing
        if (!melee.piercing) {
          this.completeAttack(attacker, melee);
          return;
        }
      }
    }
  }
  
  /**
   * Apply hit to target.
   * Uses GameRulesSystem if available, otherwise falls back to direct damage.
   */
  private applyHit(
    attacker: Entity,
    target: Entity,
    melee: MeleeAttackComponent,
    direction?: Direction
  ): void {
    // Apply damage through GameRulesSystem (if available) or fallback
    const gameRules = this.world.getSystem(GameRulesSystem);
    if (gameRules) {
      gameRules.applyDamage(target, melee.damage, attacker);
    } else {
      // Fallback: Direct damage application
      const health = this.world.getComponent(target, HealthComponent);
      if (health) {
        health.current -= melee.damage;
        
        if (health.onDamage) {
          health.onDamage(target, melee.damage, attacker);
        }
        
        if (health.current <= 0) {
          if (health.onDeath) {
            health.onDeath(target, attacker);
          }
          this.world.destroyEntity(target);
        }
      }
    }
    
    // Apply knockback
    if (melee.knockbackForce && melee.knockbackForce > 0) {
      const knockbackable = this.world.getComponent(target, KnockbackableComponent);
      if (knockbackable) {
        const knockbackSystem = this.world.getSystem(KnockbackSystem);
        if (knockbackSystem && direction) {
          knockbackSystem.applyKnockbackManual(target, direction, melee.knockbackForce, attacker);
        }
      }
    }
    
    // Callbacks
    if (melee.onHit) {
      melee.onHit(attacker, target, melee.damage);
    }
    
    const targetComp = this.world.getComponent(target, MeleeTargetComponent);
    if (targetComp && targetComp.onMeleeHit) {
      targetComp.onMeleeHit(target, attacker, melee.damage);
    }
  }
  
  /**
   * Check if entity matches tag filters
   */
  private matchesFilters(entity: Entity, melee: MeleeAttackComponent): boolean {
    if (!melee.affectsTags && !melee.ignoreTags) return true;
    
    const type = this.world.getComponent(entity, TypeComponent);
    const tags = type?.tags || [];
    
    if (melee.ignoreTags && melee.ignoreTags.some(tag => tags.includes(tag))) {
      return false;
    }
    
    if (melee.affectsTags && melee.affectsTags.length > 0) {
      return melee.affectsTags.some(tag => tags.includes(tag));
    }
    
    return true;
  }
  
  /**
   * Complete attack and reset state
   */
  private completeAttack(entity: Entity, melee: MeleeAttackComponent): void {
    melee.attacking = false;
    melee.windupTimer = undefined;
    melee.durationTimer = undefined;
    melee.hitEntities = undefined;
    melee.cooldownTimer = melee.cooldown;
    
    if (melee.onAttackComplete) {
      melee.onAttackComplete(entity);
    }
  }
  
  /**
   * Manually trigger attack
   */
  triggerAttack(entity: Entity, direction?: Direction): boolean {
    const melee = this.world.getComponent(entity, MeleeAttackComponent);
    if (!melee) return false;
    
    // Check cooldown
    if (melee.cooldownTimer && melee.cooldownTimer > 0) {
      return false;
    }
    
    // Check if already attacking
    if (melee.attacking) {
      return false;
    }
    
    // Trigger attack
    melee.attacking = true;
    melee.attackDirection = direction;
    
    return true;
  }
}
