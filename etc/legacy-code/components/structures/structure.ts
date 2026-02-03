import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component Structure
 * @icon box-select
 * @description Meta-entity for grouped connected blocks (buildings, platforms, ships)
 * 
 * Structure component - Meta-entity representing a group of connected blocks.
 * 
 * Structures are automatically created by StructureSystem when it detects
 * connected StructureBlock entities via adjacency.
 * 
 * A structure is a collection of connected blocks that act as a unit.
 * 
 * Use cases:
 * - Buildings (detect if structure is complete)
 * - Platforms (detect if platform is stable)
 * - Walls (detect if wall is intact)
 * - Ships (multiple connected parts)
 * 
 * @property {number} id - Unique structure ID
 * @property {object} bounds - Bounding box (minX, maxX, minY, maxY)
 * 
 * @example
 * ```typescript
 * // Check structure size
 * const structure = world.getComponent(structureEntity, StructureComponent);
 * console.log(`Structure has ${structure.blocks.size} blocks`);
 * 
 * // Check if specific block is in structure
 * if (structure.blocks.has(blockEntity)) {
 *   console.log('Block is part of structure');
 * }
 * ```
 */
export interface Structure {
  /** Unique structure ID */
  id: number;
  
  /** Set of block entities that form this structure */
  blocks: Set<Entity>;
  
  /** Bounding box (auto-calculated) */
  bounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  
  /** Grid this structure exists on */
  grid?: any;
  
  /** Optional callback when structure composition changes */
  onStructureChange?: (structure: Entity, blocks: Set<Entity>) => void;
}

export const StructureComponent = defineComponent<Structure>();
