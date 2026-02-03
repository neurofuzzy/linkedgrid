import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component Explosive
 * @icon bomb
 * @description Detonates when triggered (fuse, explosion, damage)
 * 
 * Explosive component for entities that explode.
 * 
 * Explosives detonate when triggered:
 * - Fuse reaches them
 * - Adjacent explosion
 * - Damage threshold exceeded
 * 
 * @property {number} explosionRadius - Radius of explosion (Manhattan distance)
 * @property {number} damage - Damage dealt to entities in radius
 * @property {boolean} chainReaction - Whether explosion triggers other explosives
 * @property {boolean} detonated - Whether already detonated
 * 
 * @example
 * ```typescript
 * // Create bomb
 * const bomb = world.createEntity();
 * world.addComponent(bomb, ExplosiveComponent, {
 *   explosionRadius: 3,
 *   damage: 50,
 *   chainReaction: true
 * });
 * world.addComponent(bomb, GridPositionComponent, { x: 9, y: 7, grid });
 * 
 * // FuseSystem will detonate when fuse reaches it
 * ```
 */
export interface Explosive {
  /** Radius of explosion (Manhattan distance) */
  explosionRadius: number;
  
  /** Damage dealt to entities in radius */
  damage?: number;
  
  /** Whether explosion triggers other explosives (default: true) */
  chainReaction?: boolean;
  
  /** Whether already detonated (prevent double-detonation) */
  detonated?: boolean;
  
  /** Optional callback when detonated */
  onDetonate?: (explosive: Entity) => void;
}

export const ExplosiveComponent = defineComponent<Explosive>();
