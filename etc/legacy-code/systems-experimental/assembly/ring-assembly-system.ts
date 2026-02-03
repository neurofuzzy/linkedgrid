import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { RingAssemblyComponent } from '@basegrid/gameplay';
import { LineAssemblyComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';

/**
 * Ring Assembly System
 * 
 * Manages closed loop structures that can degrade to lines.
 * 
 * Responsibilities:
 * - Validate ring closure (head → tail connection)
 * - Detect ring breaks (event-based)
 * - Convert RingAssembly → LineAssembly on break
 * - Track ring metrics (circumference, center)
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const ringSystem = new RingAssemblySystem();
 * world.addSystem(ringSystem);
 * 
 * // Create ring segments
 * const ringId = 'ring-1';
 * const positions = [...]; // Positions forming a loop
 * 
 * for (let i = 0; i < positions.length; i++) {
 *   const segment = world.createEntity();
 *   world.addComponent(segment, RingAssemblyComponent, {
 *     ringId,
 *     segmentIndex: i
 *   });
 *   world.addComponent(segment, GridPositionComponent, { ...positions[i], grid });
 * }
 * 
 * // Close and validate
 * ringSystem.closeRing(ringId);
 * ```
 */
export class RingAssemblySystem extends System {
  /**
   * Update ring assemblies
   */
  update(_dt: number): void {
    // Validate rings (check closure)
    const rings = this.groupSegmentsByRing();
    
    for (const [ringId, segments] of rings) {
      this.validateRing(ringId, segments);
    }
  }
  
  /**
   * Group segments by ringId
   */
  private groupSegmentsByRing(): Map<string, Entity[]> {
    const rings = new Map<string, Entity[]>();
    
    for (const [entity, segment] of this.world.query(RingAssemblyComponent)) {
      if (!rings.has(segment.ringId)) {
        rings.set(segment.ringId, []);
      }
      rings.get(segment.ringId)!.push(entity);
    }
    
    return rings;
  }
  
  /**
   * Validate ring as closed loop
   */
  validateRing(ringId: string, segments?: Entity[]): boolean {
    if (!segments) {
      const rings = this.groupSegmentsByRing();
      segments = rings.get(ringId) || [];
    }
    
    if (segments.length === 0) return false;
    
    // Need at least 3 segments to form a ring
    if (segments.length < 3) return false;
    
    // Check minimum segments
    const firstSeg = this.world.getComponent(segments[0], RingAssemblyComponent);
    if (firstSeg?.minSegments && segments.length < firstSeg.minSegments) {
      return false;
    }
    
    // Sort by segment index
    segments.sort((a, b) => {
      const segA = this.world.getComponent(a, RingAssemblyComponent);
      const segB = this.world.getComponent(b, RingAssemblyComponent);
      return (segA?.segmentIndex ?? 0) - (segB?.segmentIndex ?? 0);
    });
    
    // Check if ring is closed (last connects to first)
    const lastSegment = segments[segments.length - 1];
    const firstSegment = segments[0];
    
    const last = this.world.getComponent(lastSegment, RingAssemblyComponent);
    const first = this.world.getComponent(firstSegment, RingAssemblyComponent);
    
    if (!last || !first) return false;
    
    // Check closure
    if (last.nextSegment !== firstSegment || first.previousSegment !== lastSegment) {
      return false;
    }
    
    // Check all links in chain
    for (let i = 0; i < segments.length; i++) {
      const current = this.world.getComponent(segments[i], RingAssemblyComponent);
      const nextIndex = (i + 1) % segments.length;
      const next = this.world.getComponent(segments[nextIndex], RingAssemblyComponent);
      
      if (!current || !next) continue;
      
      // Check if properly linked
      if (current.nextSegment !== segments[nextIndex]) {
        return false;
      }
      if (next.previousSegment !== segments[i]) {
        return false;
      }
    }
    
    // Optional: Check radius if specified
    if (firstSeg?.radius) {
      const center = this.calculateCenter(segments);
      if (!this.validateRadius(segments, center, firstSeg.radius)) {
        return false;
      }
    }
    
    // Mark as validated
    for (const entity of segments) {
      const seg = this.world.getComponent(entity, RingAssemblyComponent);
      if (seg) {
        seg.validated = true;
      }
    }
    
    // Fire callback
    if (firstSeg?.onRingValidated) {
      firstSeg.onRingValidated(ringId, segments);
    }
    
    return true;
  }
  
  /**
   * Calculate ring center point
   */
  private calculateCenter(segments: Entity[]): { x: number; y: number } {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    
    for (const entity of segments) {
      const pos = this.world.getComponent(entity, GridPositionComponent);
      if (pos) {
        sumX += pos.x;
        sumY += pos.y;
        count++;
      }
    }
    
    return {
      x: count > 0 ? sumX / count : 0,
      y: count > 0 ? sumY / count : 0
    };
  }
  
  /**
   * Validate segments are roughly equidistant from center
   */
  private validateRadius(segments: Entity[], center: { x: number; y: number }, expectedRadius: number): boolean {
    const tolerance = expectedRadius * 0.5; // 50% tolerance for square/irregular rings
    
    for (const entity of segments) {
      const pos = this.world.getComponent(entity, GridPositionComponent);
      if (!pos) continue;
      
      const dx = pos.x - center.x;
      const dy = pos.y - center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (Math.abs(distance - expectedRadius) > tolerance) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Close ring by linking last segment to first
   */
  closeRing(ringId: string): void {
    const rings = this.groupSegmentsByRing();
    const segments = rings.get(ringId);
    
    if (!segments || segments.length === 0) return;
    
    // Sort by segment index
    segments.sort((a, b) => {
      const segA = this.world.getComponent(a, RingAssemblyComponent);
      const segB = this.world.getComponent(b, RingAssemblyComponent);
      return (segA?.segmentIndex ?? 0) - (segB?.segmentIndex ?? 0);
    });
    
    // Link all segments
    for (let i = 0; i < segments.length; i++) {
      const segment = this.world.getComponent(segments[i], RingAssemblyComponent);
      if (!segment) continue;
      
      const prevIndex = (i - 1 + segments.length) % segments.length;
      const nextIndex = (i + 1) % segments.length;
      
      segment.previousSegment = segments[prevIndex];
      segment.nextSegment = segments[nextIndex];
    }
    
    // Fire callback
    const firstSeg = this.world.getComponent(segments[0], RingAssemblyComponent);
    if (firstSeg?.onRingComplete) {
      firstSeg.onRingComplete(ringId, segments);
    }
  }
  
  /**
   * Get all segments for a ring in order
   */
  getRingSegments(ringId: string): Entity[] {
    const rings = this.groupSegmentsByRing();
    const segments = rings.get(ringId) || [];
    
    // Sort by segment index
    segments.sort((a, b) => {
      const segA = this.world.getComponent(a, RingAssemblyComponent);
      const segB = this.world.getComponent(b, RingAssemblyComponent);
      return (segA?.segmentIndex ?? 0) - (segB?.segmentIndex ?? 0);
    });
    
    return segments;
  }
  
  /**
   * Handle ring break and convert to line assembly
   */
  handleRingBreak(destroyedSegment: Entity): void {
    const segment = this.world.getComponent(destroyedSegment, RingAssemblyComponent);
    if (!segment) return;
    
    const ringId = segment.ringId;
    const prev = segment.previousSegment;
    const next = segment.nextSegment;
    
    // Get all remaining segments BEFORE removing component
    const allSegments = this.getRingSegments(ringId).filter(e => e !== destroyedSegment);
    
    // Fire callback BEFORE conversion (while ring components still exist)
    // Check all segments for callback (not just the destroyed one)
    for (const entity of allSegments) {
      const seg = this.world.getComponent(entity, RingAssemblyComponent);
      if (seg?.onRingBroken) {
        seg.onRingBroken(ringId, allSegments);
        break; // Only fire once
      }
    }
    
    // Convert remaining segments to LineAssembly
    if (allSegments.length > 0) {
      const lineId = `${ringId}-broken-${Date.now()}`;
      this.convertToLineAssembly(allSegments, lineId, prev, next);
    }
  }
  
  /**
   * Convert ring segments to line assembly
   */
  private convertToLineAssembly(segments: Entity[], lineId: string, breakPrev?: Entity, breakNext?: Entity): void {
    // Determine start point (segment after break)
    let startIndex = 0;
    if (breakNext) {
      startIndex = segments.indexOf(breakNext);
    }
    
    // Reorder segments to start after break
    const reorderedSegments = [
      ...segments.slice(startIndex),
      ...segments.slice(0, startIndex)
    ];
    
    // Convert each segment
    for (let i = 0; i < reorderedSegments.length; i++) {
      const entity = reorderedSegments[i];
      const ringSeg = this.world.getComponent(entity, RingAssemblyComponent);
      if (!ringSeg) continue;
      
      // Remove RingAssemblyComponent
      this.world.removeComponent(entity, RingAssemblyComponent);
      
      // Add LineAssemblyComponent
      this.world.addComponent(entity, LineAssemblyComponent, {
        lineId,
        segmentIndex: i,
        previousSegment: i > 0 ? reorderedSegments[i - 1] : undefined,
        nextSegment: i < reorderedSegments.length - 1 ? reorderedSegments[i + 1] : undefined,
        validated: false,
        onSegmentRemoved: ringSeg.onRingBroken ? (e, lid) => {
          // Forward to ring's onRingBroken if available
        } : undefined
      });
    }
  }
  
  /**
   * Check if ring is closed
   */
  isRingClosed(ringId: string): boolean {
    const segments = this.getRingSegments(ringId);
    if (segments.length === 0) return false;
    
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];
    
    const first = this.world.getComponent(firstSegment, RingAssemblyComponent);
    const last = this.world.getComponent(lastSegment, RingAssemblyComponent);
    
    if (!first || !last) return false;
    
    return last.nextSegment === firstSegment && first.previousSegment === lastSegment;
  }
  
  /**
   * Get ring circumference (number of segments)
   */
  getRingCircumference(ringId: string): number {
    return this.getRingSegments(ringId).length;
  }
  
  /**
   * Get ring center point
   */
  getRingCenter(ringId: string): { x: number; y: number } | null {
    const segments = this.getRingSegments(ringId);
    if (segments.length === 0) return null;
    
    return this.calculateCenter(segments);
  }
}
