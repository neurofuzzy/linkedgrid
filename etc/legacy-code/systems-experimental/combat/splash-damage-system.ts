import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { GridPositionComponent, HealthComponent, TypeComponent, SpatialQuerySystem } from '@basegrid/ecs';
import { SplashDamageComponent } from '@basegrid/gameplay';

/**
 * Splash Damage System
 * 
 * Manages entities that deal area-of-effect damage.
 * Applies damage to entities in radius with optional falloff.
 * 
 * Features:
 * - Radial damage with falloff
 * - Tag-based filtering
 * - Trigger on destruction
 * - Damage callbacks
 * 
 * @example
 * ```typescript
 * const splashSystem = new SplashDamageSystem();
 * world.addSystem(splashSystem);
 * 
 * // Create explosion
 * const explosion = world.createEntity();
 * world.addComponent(explosion, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(explosion, SplashDamageComponent, {
 *   radius: 3,
 *   damage: 50,
 *   falloff: 0.5,
 *   triggerOnDestroy: true
 * });
 * 
 * // Trigger it
 * splashSystem.triggerSplashDamage(explosion);
 * ```
 */
export class SplashDamageSystem extends System {
  private entitiesToTrigger = new Set<Entity>();

  /**
   * Manually trigger splash damage for an entity.
   */
  triggerSplashDamage(entity: Entity): void {
    this.entitiesToTrigger.add(entity);
  }

  /**
   * Update splash damage entities.
   */
  update(_dt: number): void {
    // Get SpatialQuerySystem
    const spatialQuery = this.world.getSystem(SpatialQuerySystem);
    if (!spatialQuery) return;

    // Process triggered entities
    for (const entity of this.entitiesToTrigger) {
      if (!this.world.hasEntity(entity)) continue;

      const splash = this.world.getComponent(entity, SplashDamageComponent);
      if (!splash || splash.triggered) continue;

      this.applySplashDamage(entity, splash, spatialQuery);
      splash.triggered = true;
    }

    this.entitiesToTrigger.clear();
  }

  /**
   * Apply splash damage to entities in radius.
   */
  private applySplashDamage(source: Entity, splash: SplashDamageComponent, spatialQuery: SpatialQuerySystem): void {
    // Get source position
    const sourcePos = this.world.getComponent(source, GridPositionComponent);
    if (!sourcePos) return;

    // Find entities in radius
    const targets = spatialQuery.findInRadius(
      sourcePos.grid,
      sourcePos.x,
      sourcePos.y,
      splash.radius
    );

    for (const target of targets) {
      if (target === source) continue; // Don't damage self

      // Check tag filters
      if (!this.matchesFilters(target, splash)) continue;

      // Get target position and health
      const targetPos = this.world.getComponent(target, GridPositionComponent);
      const targetHealth = this.world.getComponent(target, HealthComponent);
      if (!targetPos || !targetHealth) continue;

      // Calculate distance
      const distance = Math.abs(targetPos.x - sourcePos.x) + Math.abs(targetPos.y - sourcePos.y);

      // Calculate damage with falloff
      let damage = splash.damage;
      if (splash.falloff !== undefined && splash.falloff < 1.0) {
        const falloffFactor = 1.0 - (distance / splash.radius) * (1.0 - splash.falloff);
        damage *= Math.max(falloffFactor, splash.falloff);
      }

      // Apply damage
      targetHealth.current = Math.max(0, targetHealth.current - damage);

      // Fire callback
      if (splash.onDamage) {
        splash.onDamage(source, target, damage);
      }
    }
  }

  /**
   * Check if entity matches tag filters.
   */
  private matchesFilters(entity: Entity, splash: SplashDamageComponent): boolean {
    if (!splash.targetTags && !splash.ignoreTags) return true;

    const type = this.world.getComponent(entity, TypeComponent);
    const tags = type?.tags || [];

    if (splash.ignoreTags && splash.ignoreTags.some(tag => tags.includes(tag))) {
      return false;
    }

    if (splash.targetTags && splash.targetTags.length > 0) {
      return splash.targetTags.some(tag => tags.includes(tag));
    }

    return true;
  }
}
