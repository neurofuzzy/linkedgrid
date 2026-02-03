import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { IceFreezeComponent } from '@basegrid/gameplay';

/**
 * Ice Freeze System
 * 
 * Manages freezing status effects on entities.
 * Handles freeze accumulation, thawing, and duration.
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const iceSystem = new IceFreezeSystem();
 * world.addSystem(iceSystem);
 * 
 * // Apply freeze
 * const enemy = world.createEntity();
 * world.addComponent(enemy, IceFreezeComponent, {
 *   freezeAmount: 0.7,
 *   duration: 3.0,
 *   thawRate: 0.2
 * });
 * 
 * // Check if frozen
 * const isFrozen = iceSystem.isFrozen(enemy);
 * 
 * // Get speed multiplier
 * const speedMult = iceSystem.getSpeedMultiplier(enemy);
 * ```
 */
export class IceFreezeSystem extends System {
  /**
   * Update all frozen entities
   */
  update(dt: number): void {
    const toRemove: Entity[] = [];
    
    for (const [entity, freeze] of this.world.query(IceFreezeComponent)) {
      // Initialize time remaining
      if (freeze.timeRemaining === undefined) {
        freeze.timeRemaining = freeze.duration;
      }
      
      // Update duration
      freeze.timeRemaining -= dt;
      
      // Apply thawing
      if (freeze.thawRate && freeze.thawRate > 0) {
        const oldAmount = freeze.freezeAmount;
        freeze.freezeAmount = Math.max(0, freeze.freezeAmount - freeze.thawRate * dt);
        
        if (freeze.freezeAmount !== oldAmount && freeze.onFreezeChange) {
          freeze.onFreezeChange(entity, freeze.freezeAmount);
        }
      }
      
      // Check if fully frozen
      const wasFrozen = freeze.frozen;
      freeze.frozen = freeze.freezeAmount >= 1.0;
      
      if (freeze.frozen && !wasFrozen && freeze.onFreeze) {
        freeze.onFreeze(entity);
      }
      
      // Check if thawed or expired
      if (freeze.timeRemaining <= 0 || freeze.freezeAmount <= 0) {
        if (freeze.onThaw) {
          freeze.onThaw(entity);
        }
        toRemove.push(entity);
      }
    }
    
    // Remove expired freeze effects
    for (const entity of toRemove) {
      this.world.removeComponent(entity, IceFreezeComponent);
    }
  }
  
  /**
   * Apply freeze to entity (or increase existing freeze)
   */
  applyFreeze(entity: Entity, amount: number, duration: number, thawRate?: number): void {
    const existing = this.world.getComponent(entity, IceFreezeComponent);
    
    if (existing) {
      // Add to existing freeze
      const oldAmount = existing.freezeAmount;
      existing.freezeAmount = Math.min(1.0, existing.freezeAmount + amount);
      existing.timeRemaining = Math.max(existing.timeRemaining!, duration);
      
      if (existing.onFreezeChange && existing.freezeAmount !== oldAmount) {
        existing.onFreezeChange(entity, existing.freezeAmount);
      }
      
      // Check if now fully frozen
      if (existing.freezeAmount >= 1.0 && !existing.frozen) {
        existing.frozen = true;
        if (existing.onFreeze) {
          existing.onFreeze(entity);
        }
      }
    } else {
      // Apply new freeze
      this.world.addComponent(entity, IceFreezeComponent, {
        freezeAmount: Math.min(1.0, amount),
        duration,
        timeRemaining: duration,
        thawRate: thawRate ?? 0.1,
        frozen: amount >= 1.0
      });
      
      const freeze = this.world.getComponent(entity, IceFreezeComponent)!;
      if (freeze.frozen && freeze.onFreeze) {
        freeze.onFreeze(entity);
      }
    }
  }
  
  /**
   * Remove freeze from entity
   */
  removeFreeze(entity: Entity): void {
    const freeze = this.world.getComponent(entity, IceFreezeComponent);
    if (freeze && freeze.onThaw) {
      freeze.onThaw(entity);
    }
    this.world.removeComponent(entity, IceFreezeComponent);
  }
  
  /**
   * Check if entity is frozen
   */
  isFrozen(entity: Entity): boolean {
    const freeze = this.world.getComponent(entity, IceFreezeComponent);
    return freeze?.frozen ?? false;
  }
  
  /**
   * Get speed multiplier based on freeze amount
   */
  getSpeedMultiplier(entity: Entity): number {
    const freeze = this.world.getComponent(entity, IceFreezeComponent);
    if (!freeze) return 1.0;
    
    return 1.0 - freeze.freezeAmount;
  }
  
  /**
   * Get freeze amount (0-1)
   */
  getFreezeAmount(entity: Entity): number {
    const freeze = this.world.getComponent(entity, IceFreezeComponent);
    return freeze?.freezeAmount ?? 0;
  }
}
