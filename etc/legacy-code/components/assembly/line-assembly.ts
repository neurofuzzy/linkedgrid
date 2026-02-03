import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component LineAssembly
 * @icon minus
 * @description Connected structure segments (walls, fences, barriers)
 * 
 * Line Assembly Component
 * 
 * Manages static connected structures (walls, fences, barriers).
 * Unlike snakes, line assemblies don't move - they're structural elements.
 * 
 * Line assemblies form connected chains of entities where:
 * - Each segment links to previous/next segment
 * - All segments share the same lineId
 * - Can enforce alignment (horizontal, vertical, etc.)
 * - Can detect breaks and split into separate lines
 * 
 * @property {string} lineId - Unique ID for this line (all segments share same ID)
 * @property {number} segmentIndex - Position in line (0 = start)
 * @property {Entity} previousSegment - Link to previous segment (toward start)
 * @property {Entity} nextSegment - Link to next segment (toward end)
 * @property {boolean} validated - Has this line been validated?
 * @property {string} alignment - Enforce alignment (horizontal, vertical, diagonal, any)
 * @property {number} maxSegments - Maximum segments allowed
 * 
 * @example
 * ```typescript
 * // Create horizontal wall
 * const lineId = 'wall-1';
 * for (let x = 0; x < 10; x++) {
 *   const segment = world.createEntity();
 *   world.addComponent(segment, LineAssemblyComponent, {
 *     lineId,
 *     segmentIndex: x,
 *     alignment: 'horizontal'
 *   });
 *   world.addComponent(segment, GridPositionComponent, { x, y: 5, grid });
 * }
 * 
 * // Link segments
 * lineSystem.linkLineSegments(lineId);
 * ```
 * 
 * @example
 * ```typescript
 * // Detect break when segment destroyed
 * gameRules.onDeath = (entity) => {
 *   const line = world.getComponent(entity, LineAssemblyComponent);
 *   if (line) {
 *     lineSystem.handleLineBreak(entity);
 *   }
 *   return true;
 * };
 * ```
 */
export interface LineAssembly {
  /** Unique ID for this line (all segments share same ID) */
  lineId: string;
  
  /** Position in line (0 = start) */
  segmentIndex: number;
  
  /** Link to previous segment (toward start) */
  previousSegment?: Entity;
  
  /** Link to next segment (toward end) */
  nextSegment?: Entity;
  
  /** Has this line been validated? */
  validated?: boolean;
  
  /** Optional: Enforce alignment */
  alignment?: 'horizontal' | 'vertical' | 'diagonal' | 'any';
  
  /** Optional: Maximum segments allowed */
  maxSegments?: number;
  
  /** Optional: Callback when segment added to line */
  onSegmentAdded?: (entity: Entity, lineId: string) => void;
  
  /** Optional: Callback when segment removed from line */
  onSegmentRemoved?: (entity: Entity, lineId: string) => void;
  
  /** Optional: Callback when line completes */
  onLineComplete?: (lineId: string, segments: Entity[]) => void;
  
  /** Optional: Callback when line breaks */
  onLineBreak?: (lineId: string, newLines: string[]) => void;
}

export const LineAssemblyComponent = defineComponent<LineAssembly>();
