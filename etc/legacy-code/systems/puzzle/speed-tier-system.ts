import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { SpeedComponent } from '@basegrid/ecs';
import { SpeedTierComponent } from '@basegrid/gameplay';


/**
 * Speed Tier System
 * 
 * Manages entities with speed tiers.
 * Automatically updates SpeedComponent based on current tier.
 * 
 * Features:
 * - Multiple named speed tiers
 * - Speed multipliers
 * - Enable/disable control
 * 
 * @example
 * ```typescript
 * const speedTierSystem = new SpeedTierSystem();
 * world.addSystem(speedTierSystem);
 * 
 * const player = world.createEntity();
 * world.addComponent(player, SpeedComponent, { value: 1 });
 * world.addComponent(player, SpeedTierComponent, {
 *   tiers: {
 *     walk: 1,
 *     run: 2,
 *     sprint: 4
 *   },
 *   currentTier: 'walk'
 * });
 * 
 * // Change tier
 * const speedTier = world.getComponent(player, SpeedTierComponent);
 * if (speedTier) speedTier.currentTier = 'run';
 * ```
 */
export class SpeedTierSystem extends System {
  /**
   * Update all entities with speed tiers.
   */
  update(_dt: number): void {
    for (const [entity, speedTier] of this.world.query(SpeedTierComponent)) {
      // Skip if disabled
      if (speedTier.enabled === false) continue;

      // Get speed component
      const speed = this.world.getComponent(entity, SpeedComponent);
      if (!speed) continue;

      // Get tier speed
      const tierSpeed = speedTier.tiers[speedTier.currentTier];
      if (tierSpeed === undefined) continue;

      // Apply multiplier
      const multiplier = speedTier.multiplier ?? 1.0;
      speed.value = tierSpeed * multiplier;
    }
  }
}
