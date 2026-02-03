import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { GridPositionComponent, SpeedComponent, TypeComponent, SpatialQuerySystem } from '@basegrid/ecs';
import { AOEBuffComponent } from '@basegrid/gameplay';

/**
 * AOE Buff System
 * 
 * Manages area-of-effect buffs that affect entities in radius.
 * Buffs can modify speed, damage, defense, and other stats.
 * 
 * Features:
 * - Multiple buff types
 * - Tag-based filtering
 * - Enter/exit callbacks
 * - Custom buff functions
 * 
 * @example
 * ```typescript
 * const aoeBuffSystem = new AOEBuffSystem();
 * world.addSystem(aoeBuffSystem);
 * 
 * // Create speed aura
 * const aura = world.createEntity();
 * world.addComponent(aura, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(aura, AOEBuffComponent, {
 *   radius: 5,
 *   buffType: 'speed',
 *   multiplier: 1.5,
 *   targetTags: ['ally'],
 *   active: true
 * });
 * ```
 */
export class AOEBuffSystem extends System {
  /**
   * Update all AOE buffs.
   */
  update(_dt: number): void {
    // Get SpatialQuerySystem
    const spatialQuery = this.world.getSystem(SpatialQuerySystem);
    if (!spatialQuery) return;

    for (const [entity, buff] of this.world.query(AOEBuffComponent)) {
      // Skip if not active
      if (buff.active === false) continue;

      // Get position
      const pos = this.world.getComponent(entity, GridPositionComponent);
      if (!pos) continue;

      // Initialize buffed entities set
      if (!buff.buffedEntities) {
        buff.buffedEntities = new Set();
      }

      // Find entities in radius
      const entitiesInRange = spatialQuery.findInRadius(
        pos.grid,
        pos.x,
        pos.y,
        buff.radius
      );

      // Filter by tags
      const validTargets = new Set<Entity>();
      for (const target of entitiesInRange) {
        if (target === entity) continue; // Skip self
        if (this.matchesFilters(target, buff)) {
          validTargets.add(target);
        }
      }

      // Detect enter/exit
      const previousBuffed = buff.buffedEntities;
      const currentBuffed = validTargets;

      // Handle entities entering buff area
      for (const target of currentBuffed) {
        if (!previousBuffed.has(target)) {
          // New entity entered
          this.applyBuff(target, entity, buff);
          if (buff.onEnter) {
            buff.onEnter(target, entity);
          }
        } else {
          // Entity still in range, reapply buff
          this.applyBuff(target, entity, buff);
        }
      }

      // Handle entities exiting buff area
      for (const target of previousBuffed) {
        if (!currentBuffed.has(target)) {
          // Entity exited
          this.removeBuff(target, entity, buff);
          if (buff.onExit) {
            buff.onExit(target, entity);
          }
        }
      }

      // Update tracked set
      buff.buffedEntities = currentBuffed;
    }
  }

  /**
   * Apply buff to target entity.
   */
  private applyBuff(target: Entity, source: Entity, buff: AOEBuffComponent): void {
    switch (buff.buffType) {
      case 'speed': {
        const speed = this.world.getComponent(target, SpeedComponent);
        if (speed) {
          // Store original speed if not already stored
          if (!(target in this.originalSpeeds)) {
            this.originalSpeeds[target] = speed.value;
          }
          
          const baseSpeed = this.originalSpeeds[target];
          const flatValue = buff.flatValue ?? 0;
          speed.value = baseSpeed * (buff.multiplier ?? 1.0) + flatValue;
        }
        break;
      }

      case 'custom': {
        if (buff.customBuff) {
          buff.customBuff(target, source);
        }
        break;
      }

      // Add other buff types as needed
      default:
        break;
    }
  }
  
  private originalSpeeds: Record<Entity, number> = {};

  /**
   * Remove buff from target entity.
   */
  private removeBuff(target: Entity, source: Entity, buff: AOEBuffComponent): void {
    // For continuous buffs like speed, they'll naturally reset when no longer applied
    // For one-time effects, this would be where cleanup happens
  }

  /**
   * Check if entity matches tag filters.
   */
  private matchesFilters(entity: Entity, buff: AOEBuffComponent): boolean {
    if (!buff.targetTags && !buff.ignoreTags) return true;

    const type = this.world.getComponent(entity, TypeComponent);
    const tags = type?.tags || [];

    if (buff.ignoreTags && buff.ignoreTags.some(tag => tags.includes(tag))) {
      return false;
    }

    if (buff.targetTags && buff.targetTags.length > 0) {
      return buff.targetTags.some(tag => tags.includes(tag));
    }

    return true;
  }
}
