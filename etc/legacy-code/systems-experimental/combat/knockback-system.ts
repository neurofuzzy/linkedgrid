import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { KnockbackSourceComponent, KnockbackableComponent } from '@basegrid/gameplay';
import { GridPositionComponent, TypeComponent, BlockedByComponent } from '@basegrid/ecs';
import { Direction } from '@basegrid/grid';

/**
 * Knockback System
 * 
 * Manages knockback mechanics for combat and collisions.
 * 
 * Features:
 * - Automatic knockback on collision
 * - Directional knockback
 * - Resistance and threshold
 * - Wall blocking
 * - Gradual pushback over time
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const knockbackSystem = new KnockbackSystem();
 * world.addSystem(knockbackSystem);
 * 
 * // Create enemy with knockback
 * const enemy = world.createEntity();
 * world.addComponent(enemy, KnockbackSourceComponent, {
 *   force: 3,
 *   affectsTags: ['player']
 * });
 * world.addComponent(enemy, GridPositionComponent, { x: 10, y: 10, grid });
 * 
 * // Create player that can be knocked back
 * const player = world.createEntity();
 * world.addComponent(player, KnockbackableComponent, {
 *   resistance: 0
 * });
 * world.addComponent(player, GridPositionComponent, { x: 10, y: 11, grid });
 * world.addComponent(player, TypeComponent, { type: 'player', tags: ['player'] });
 * 
 * // When they collide, player gets knocked back
 * ```
 */
export class KnockbackSystem extends System {
  /**
   * Update knockback system
   */
  update(_dt: number): void {
    // 1. Check for collisions and apply knockback
    this.checkCollisions();
    
    // 2. Process ongoing knockback movements
    this.processKnockback();
  }
  
  /**
   * Check for collisions between sources and knockbackable entities
   */
  private checkCollisions(): void {
    for (const [sourceEntity, source] of this.world.query(KnockbackSourceComponent)) {
      if (source.active === false) continue;
      
      const sourcePos = this.world.getComponent(sourceEntity, GridPositionComponent);
      if (!sourcePos) continue;
      
      // Find entities at same position or adjacent
      for (const [targetEntity, knockbackable] of this.world.query(KnockbackableComponent)) {
        if (targetEntity === sourceEntity) continue;
        if (knockbackable.active) continue; // Already being knocked back
        
        const targetPos = this.world.getComponent(targetEntity, GridPositionComponent);
        if (!targetPos || targetPos.grid !== sourcePos.grid) continue;
        
        // Check if at same position or adjacent
        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;
        const distance = Math.abs(dx) + Math.abs(dy);
        
        if (distance > 1) continue; // Not adjacent
        
        // Check tag filters
        if (!this.matchesFilters(targetEntity, source)) continue;
        
        // Apply knockback
        this.applyKnockback(sourceEntity, targetEntity, source, knockbackable, sourcePos, targetPos);
      }
    }
  }
  
  /**
   * Apply knockback to target entity
   */
  private applyKnockback(
    sourceEntity: Entity,
    targetEntity: Entity,
    source: KnockbackSourceComponent,
    knockbackable: KnockbackableComponent,
    sourcePos: GridPositionComponent,
    targetPos: GridPositionComponent
  ): void {
    // Calculate effective force
    const resistance = knockbackable.resistance ?? 0;
    const force = source.force * (1 - resistance);
    
    // Check if force is too weak
    if (force <= 0) {
      return;
    }
    
    // Check threshold
    if (knockbackable.threshold && force < knockbackable.threshold) {
      return;
    }
    
    // Determine knockback direction
    let direction: Direction;
    if (source.direction !== undefined) {
      direction = source.direction;
    } else {
      // Calculate direction from source to target
      const dx = targetPos.x - sourcePos.x;
      const dy = targetPos.y - sourcePos.y;
      
      if (Math.abs(dx) > Math.abs(dy)) {
        direction = dx > 0 ? Direction.RT : Direction.LT;
      } else if (Math.abs(dy) > 0) {
        direction = dy > 0 ? Direction.DN : Direction.UP;
      } else {
        // Same position, use default
        direction = Direction.RT;
      }
    }
    
    // Set knockback state
    knockbackable.active = true;
    knockbackable.remainingDistance = Math.ceil(force);
    knockbackable.direction = direction;
    
    // Callbacks
    if (knockbackable.onKnockback) {
      knockbackable.onKnockback(targetEntity, sourceEntity, force);
    }
    
    if (source.onKnockback) {
      source.onKnockback(sourceEntity, targetEntity, force);
    }
  }
  
  /**
   * Process ongoing knockback movements
   */
  private processKnockback(): void {
    for (const [entity, knockbackable] of this.world.query(KnockbackableComponent)) {
      if (!knockbackable.active) continue;
      
      // Skip processing on the first frame (knockback just applied)
      if (knockbackable.delayTimer === undefined) {
        knockbackable.delayTimer = 0;
        continue;
      }
      
      const pos = this.world.getComponent(entity, GridPositionComponent);
      if (!pos || !knockbackable.direction) {
        this.completeKnockback(entity, knockbackable);
        continue;
      }
      
      if (!knockbackable.remainingDistance || knockbackable.remainingDistance <= 0) {
        this.completeKnockback(entity, knockbackable);
        continue;
      }
      
      // Try to move one cell in knockback direction
      const cell = pos.grid.cell(pos.x, pos.y);
      if (!cell) {
        this.completeKnockback(entity, knockbackable);
        continue;
      }
      
      const nextCell = cell.move(knockbackable.direction);
      if (!nextCell) {
        // Hit wall or edge, stop knockback
        this.completeKnockback(entity, knockbackable);
        continue;
      }
      
      // Check if blocked
      const blocked = this.world.getComponent(entity, BlockedByComponent);
      if (blocked && blocked.values && blocked.values.length > 0) {
        const cellValue = nextCell.values[0];
        if (blocked.values.includes(cellValue)) {
          // Hit obstacle, stop knockback
          this.completeKnockback(entity, knockbackable);
          continue;
        }
      }
      
      // Move entity
      pos.x = nextCell.x;
      pos.y = nextCell.y;
      
      // Decrease remaining distance
      knockbackable.remainingDistance!--;
      
      // Check if completed after movement
      if (knockbackable.remainingDistance <= 0) {
        this.completeKnockback(entity, knockbackable);
      }
    }
  }
  
  /**
   * Complete knockback for entity
   */
  private completeKnockback(entity: Entity, knockbackable: KnockbackableComponent): void {
    knockbackable.active = false;
    knockbackable.remainingDistance = 0;
    knockbackable.direction = undefined;
    knockbackable.delayTimer = undefined;
    
    if (knockbackable.onKnockbackComplete) {
      knockbackable.onKnockbackComplete(entity);
    }
  }
  
  /**
   * Check if entity matches tag filters
   */
  private matchesFilters(entity: Entity, source: KnockbackSourceComponent): boolean {
    if (!source.affectsTags && !source.ignoreTags) return true;
    
    const type = this.world.getComponent(entity, TypeComponent);
    const tags = type?.tags || [];
    
    if (source.ignoreTags && source.ignoreTags.some(tag => tags.includes(tag))) {
      return false;
    }
    
    if (source.affectsTags && source.affectsTags.length > 0) {
      return source.affectsTags.some(tag => tags.includes(tag));
    }
    
    return true;
  }
  
  /**
   * Manually apply knockback to an entity
   */
  applyKnockbackManual(
    targetEntity: Entity,
    direction: Direction,
    force: number,
    sourceEntity?: Entity
  ): void {
    const knockbackable = this.world.getComponent(targetEntity, KnockbackableComponent);
    if (!knockbackable) return;
    
    const targetPos = this.world.getComponent(targetEntity, GridPositionComponent);
    if (!targetPos) return;
    
    // Calculate effective force
    const resistance = knockbackable.resistance ?? 0;
    const effectiveForce = force * (1 - resistance);
    
    // Check threshold
    if (knockbackable.threshold && effectiveForce < knockbackable.threshold) {
      return;
    }
    
    // Set knockback state
    knockbackable.active = true;
    knockbackable.remainingDistance = Math.ceil(effectiveForce);
    knockbackable.direction = direction;
    
    // Callback
    if (knockbackable.onKnockback && sourceEntity !== undefined) {
      knockbackable.onKnockback(targetEntity, sourceEntity, effectiveForce);
    }
  }
}
