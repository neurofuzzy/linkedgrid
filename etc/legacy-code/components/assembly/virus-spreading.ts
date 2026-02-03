import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component VirusSpreading
 * @icon activity
 * @description Infectious spreading (zombies, disease, corruption, plague)
 * 
 * Virus Spreading Component
 * 
 * Entities with this component can infect and be infected by neighbors,
 * creating cascading infection spread across the grid.
 * 
 * Similar to ChainReactive but with key differences:
 * - Persistent infection (doesn't reset between frames)
 * - Radius-based spreading (not just adjacent)
 * - Can cure infection
 * - Optional damage over time
 * - Contagious flag controls spreading
 * 
 * Use cases:
 * - Zombie infection
 * - Disease spreading
 * - Corruption/corruption spreading
 * - Magical plague
 * 
 * @property {boolean} infected - Is this entity currently infected?
 * @property {number} infectionTimer - Time until spreading to neighbors (ms)
 * @property {number} infectionDelay - Delay before spreading after becoming infected (ms)
 * @property {number} spreadRadius - How far infection spreads (Manhattan distance)
 * @property {string} infectType - Only infect/be infected by matching types
 * @property {boolean} contagious - Can this entity spread infection to others?
 * @property {boolean} curable - Can this entity be cured?
 * @property {boolean} immune - Immunity prevents infection
 * @property {number} damagePerTick - Damage dealt per update while infected
 * @property {number} timeInfected - Time infected (for statistics)
 * 
 * @example
 * ```typescript
 * // Create population
 * for (let i = 0; i < 10; i++) {
 *   const entity = world.createEntity();
 *   world.addComponent(entity, VirusSpreadingComponent, {
 *     infected: false,
 *     infectionDelay: 100,
 *     spreadRadius: 1,
 *     contagious: true,
 *     curable: true
 *   });
 *   world.addComponent(entity, GridPositionComponent, { x: i, y: 5, grid });
 * }
 * 
 * // Patient zero
 * const firstEntity = world.query(VirusSpreadingComponent)[0][0];
 * virusSystem.infectEntity(firstEntity);
 * 
 * // Watch infection spread!
 * ```
 * 
 * @example
 * ```typescript
 * // Infection with damage over time
 * world.addComponent(entity, VirusSpreadingComponent, {
 *   infected: false,
 *   infectionDelay: 50,
 *   spreadRadius: 2,
 *   contagious: true,
 *   curable: false,
 *   damagePerTick: 1  // Lose 1 HP per update
 * });
 * ```
 */
export interface VirusSpreading {
  /** Is this entity currently infected? */
  infected: boolean;
  
  /** Time until spreading to neighbors (ms) */
  infectionTimer: number;
  
  /** Delay before spreading after becoming infected (ms) */
  infectionDelay: number;
  
  /** How far infection spreads (Manhattan distance) */
  spreadRadius: number;
  
  /** Optional: Only infect/be infected by matching types */
  infectType?: string;
  
  /** Can this entity spread infection to others? */
  contagious: boolean;
  
  /** Can this entity be cured? */
  curable: boolean;
  
  /** Optional: Immunity prevents infection */
  immune?: boolean;
  
  /** Optional: Callback when entity becomes infected */
  onInfect?: (entity: Entity) => void;
  
  /** Optional: Callback when entity spreads to another */
  onSpread?: (source: Entity, target: Entity) => void;
  
  /** Optional: Callback when entity is cured */
  onCure?: (entity: Entity) => void;
  
  /** Optional: Damage dealt per update while infected */
  damagePerTick?: number;
  
  /** Internal: Time infected (for statistics) */
  timeInfected?: number;
}

export const VirusSpreadingComponent = defineComponent<VirusSpreading>();
