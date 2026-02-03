import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component FluidSpread
 * @icon waves
 * @description Spreads to adjacent cells (acid, lava, water, gas)
 * 
 * Fluid Spread Component
 * 
 * Entities that spread to adjacent cells over time.
 * Represents acid, lava, poison, or other spreading hazards.
 * 
 * Examples:
 * - Acid pools spreading
 * - Lava flows
 * - Poison gas clouds
 * - Water flooding
 * 
 * @property {number} spreadRate - Rate of spread (cells per second)
 * @property {number} maxCells - Maximum number of cells to spread to
 * @property {number} damage - Damage per tick (if applicable)
 * @property {number} lifetime - Lifetime of each fluid cell (seconds)
 * @property {number} spreadTimer - Time until next spread
 * @property {boolean} isSource - Whether this is a source or spread cell
 * @property {number[]} blockedBy - Cell values that block spread
 * 
 * @example
 * ```typescript
 * // Create spreading acid
 * const acid = world.createEntity();
 * world.addComponent(acid, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(acid, FluidSpreadComponent, {
 *   spreadRate: 1.0,       // Spread to 1 adjacent cell per second
 *   maxCells: 20,          // Maximum cells to spread to
 *   damage: 5              // Damage per tick
 * });
 * ```
 */
export interface FluidSpread {
  /** Rate of spread (cells per second) */
  spreadRate: number;
  
  /** Maximum number of cells to spread to */
  maxCells?: number;
  
  /** Damage per tick (if applicable) */
  damage?: number;
  
  /** Lifetime of each fluid cell (seconds) */
  lifetime?: number;
  
  /** Internal: time until next spread */
  spreadTimer?: number;
  
  /** Internal: cells this fluid has spread to */
  spreadCells?: Set<string>;
  
  /** Internal: parent entity (source) */
  parentEntity?: Entity;
  
  /** Whether this is a source or spread cell */
  isSource?: boolean;
  
  /** Optional: Cell values that block spread */
  blockedBy?: number[];
  
  /** Optional: Callback when fluid spreads */
  onSpread?: (source: Entity, newCell: { x: number; y: number }) => void;
  
  /** Optional: Callback when fluid cell dies */
  onDie?: (entity: Entity) => void;
}

export const FluidSpreadComponent = defineComponent<FluidSpread>();
