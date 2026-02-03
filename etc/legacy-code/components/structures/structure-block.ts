import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component StructureBlock
 * @icon square
 * @description Building block that connects to adjacent blocks (walls, platforms)
 * 
 * Structure block component for entities that form connected structures.
 * 
 * Structure blocks automatically detect and group with adjacent blocks:
 * - Building blocks, walls, platforms
 * - Connect to adjacent blocks to form structures
 * - System assigns structure ID to connected groups
 * 
 * Blocks can have types - only same-type blocks connect (optional).
 * 
 * @property {number} structureId - Which structure this block belongs to (assigned by system)
 * @property {string} blockType - Block type (only connects to same type)
 * @property {boolean} connectable - Whether this block can connect to others
 * 
 * @example
 * ```typescript
 * // Create building block
 * const block = world.createEntity();
 * world.addComponent(block, StructureBlockComponent, {
 *   blockType: 'stone'
 * });
 * world.addComponent(block, GridPositionComponent, { x: 5, y: 5, grid });
 * 
 * // StructureSystem will auto-detect connections
 * ```
 */
export interface StructureBlock {
  /** Which structure this block belongs to (assigned by system) */
  structureId?: number;
  
  /** Optional block type (only connects to same type) */
  blockType?: string;
  
  /** Whether this block can connect to others (default: true) */
  connectable?: boolean;
}

export const StructureBlockComponent = defineComponent<StructureBlock>();
