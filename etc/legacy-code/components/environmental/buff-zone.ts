import { defineComponent } from '@basegrid/ecs';

/**
 * @component BuffZone
 * @icon circle-plus
 * @description Environmental buff area (power-ups, shrines, auras)
 * 
 * Buff zone component for entities that grant buffs.
 * 
 * Buff zones are environmental entities that apply buffs to entities within range:
 * - Power-up pickups (speed boost, shield)
 * - Aura zones (healing circle, strength zone)
 * - Shrines and altars
 * 
 * @property {string} buffType - Type of buff to apply (speed, defense, attack, weakness)
 * @property {number} buffDuration - Duration of buff when applied
 * @property {number} buffMultiplier - Multiplier of buff
 * @property {number} radius - Radius of effect (0 = same cell only)
 * @property {boolean} oneTimeOnly - Whether this can only buff each entity once
 * 
 * @example
 * ```typescript
 * // Create speed boost power-up
 * const speedBoost = world.createEntity();
 * world.addComponent(speedBoost, BuffZoneComponent, {
 *   buffType: 'speed',
 *   buffDuration: 180,
 *   buffMultiplier: 2.0,
 *   radius: 0  // Pickup (same cell)
 * });
 * world.addComponent(speedBoost, GridPositionComponent, { x: 5, y: 4, grid });
 * 
 * // BuffSystem will apply speed buff when entity enters
 * ```
 */
export interface BuffZone {
  /** Type of buff to apply */
  buffType: 'speed' | 'defense' | 'attack' | 'weakness';
  
  /** Duration of buff when applied */
  buffDuration: number;
  
  /** Multiplier of buff */
  buffMultiplier: number;
  
  /** Radius of effect (0 = same cell only) */
  radius?: number;
  
  /** Whether this can only buff each entity once (default: false) */
  oneTimeOnly?: boolean;
  
  /** Internal: Set of entities already buffed */
  buffedEntities?: Set<number>;
}

export const BuffZoneComponent = defineComponent<BuffZone>();
