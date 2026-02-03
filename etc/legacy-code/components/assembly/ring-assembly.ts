import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

/**
 * @component RingAssembly
 * @icon circle
 * @description Closed loop structure that validates circular shape
 * 
 * Ring Assembly Component
 * 
 * Manages closed loop structures that can degrade to lines when broken.
 * 
 * Ring assemblies form complete circles where:
 * - All segments link to previous/next segment
 * - Head connects back to tail (forming loop)
 * - All segments share the same ringId
 * - Can validate circular shape
 * - Degrades to LineAssembly when ring breaks
 * 
 * @property {string} ringId - Unique ID for this ring (all segments share same ID)
 * @property {number} segmentIndex - Position in ring (0 to n-1)
 * @property {Entity} previousSegment - Link to previous segment (forms loop)
 * @property {Entity} nextSegment - Link to next segment (forms loop)
 * @property {boolean} validated - Has ring been validated as closed loop?
 * @property {number} radius - Expected radius for validation
 * @property {number} minSegments - Minimum segments to form valid ring
 * 
 * @example
 * ```typescript
 * // Create ring (square loop)
 * const ringId = 'ring-1';
 * const positions = [
 *   { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 },
 *   { x: 7, y: 6 }, { x: 7, y: 7 },
 *   { x: 6, y: 7 }, { x: 5, y: 7 },
 *   { x: 5, y: 6 }
 * ];
 * 
 * for (let i = 0; i < positions.length; i++) {
 *   const segment = world.createEntity();
 *   world.addComponent(segment, RingAssemblyComponent, {
 *     ringId,
 *     segmentIndex: i,
 *     minSegments: 4
 *   });
 *   world.addComponent(segment, GridPositionComponent, { ...positions[i], grid });
 * }
 * 
 * // Close the ring
 * ringSystem.closeRing(ringId);
 * ```
 * 
 * @example
 * ```typescript
 * // Detect break and convert to line
 * gameRules.onDeath = (entity) => {
 *   const ring = world.getComponent(entity, RingAssemblyComponent);
 *   if (ring) {
 *     ringSystem.handleRingBreak(entity);
 *   }
 *   return true;
 * };
 * ```
 */
export interface RingAssembly {
  /** Unique ID for this ring (all segments share same ID) */
  ringId: string;
  
  /** Position in ring (0 to n-1) */
  segmentIndex: number;
  
  /** Link to previous segment (forms loop with last → first) */
  previousSegment?: Entity;
  
  /** Link to next segment (forms loop with first → last) */
  nextSegment?: Entity;
  
  /** Has this ring been validated as closed loop? */
  validated?: boolean;
  
  /** Optional: Expected radius for validation */
  radius?: number;
  
  /** Optional: Minimum segments to form valid ring */
  minSegments?: number;
  
  /** Optional: Callback when ring completes (closes) */
  onRingComplete?: (ringId: string, segments: Entity[]) => void;
  
  /** Optional: Callback when ring breaks */
  onRingBroken?: (ringId: string, remainingSegments: Entity[]) => void;
  
  /** Optional: Callback when ring validates successfully */
  onRingValidated?: (ringId: string, segments: Entity[]) => void;
}

export const RingAssemblyComponent = defineComponent<RingAssembly>();
