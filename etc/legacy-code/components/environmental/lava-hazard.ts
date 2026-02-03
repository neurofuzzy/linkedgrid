import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component LavaHazard
 * @icon droplet
 * @description Damaging terrain (lava, acid, spikes, electric floor)
 * 
 * Lava Hazard Component
 * 
 * Grid cell that damages entities standing on it.
 * Represents lava, acid, spikes, or other environmental hazards.
 * 
 * Examples:
 * - Lava pools
 * - Acid vats
 * - Spike traps
 * - Electric floors
 * 
 * @property {number} damagePerSecond - Damage per second
 * @property {number} damageInterval - How often to apply damage (seconds)
 * @property {number} damageTimer - Time until next damage tick
 * @property {string[]} targetTags - Tag filter for what can be damaged
 * @property {string[]} immunityTags - Immunity tags
 * @property {string} effectType - Visual effect identifier
 * 
 * @example
 * ```typescript
 * // Create lava pool
 * const lava = world.createEntity();
 * world.addComponent(lava, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(lava, LavaHazardComponent, {
 *   damagePerSecond: 10,
 *   damageInterval: 0.5  // Damage every 0.5 seconds
 * });
 * 
 * // System damages entities on lava
 * const lavaSystem = world.getSystem(LavaHazardSystem);
 * ```
 */
export interface LavaHazard {
  /** Damage per second */
  damagePerSecond: number;
  
  /** How often to apply damage (seconds) */
  damageInterval?: number;
  
  /** Internal: time until next damage tick */
  damageTimer?: number;
  
  /** Optional: Tag filter for what can be damaged */
  targetTags?: string[];
  
  /** Optional: Immunity tags */
  immunityTags?: string[];
  
  /** Optional: Visual effect identifier */
  effectType?: string;
  
  /** Optional: Callback when entity enters hazard */
  onEnter?: (hazard: Entity, victim: Entity) => void;
  
  /** Optional: Callback when entity takes damage */
  onDamage?: (hazard: Entity, victim: Entity, damage: number) => void;
  
  /** Optional: Callback when entity exits hazard */
  onExit?: (hazard: Entity, victim: Entity) => void;
  
  /** Internal: tracking entities currently in hazard */
  entitiesInHazard?: Set<Entity>;
}

export const LavaHazardComponent = defineComponent<LavaHazard>();
