import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { LineAssemblyComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';

/**
 * Line Assembly System
 * 
 * Manages static connected structures (walls, fences, barriers).
 * 
 * Responsibilities:
 * - Validate line integrity (connectivity, alignment)
 * - Detect breaks when segments destroyed
 * - Split lines on break
 * - Track line metrics (length, endpoints)
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const lineSystem = new LineAssemblySystem();
 * world.addSystem(lineSystem);
 * 
 * // Create line segments
 * const lineId = 'wall-1';
 * for (let x = 0; x < 10; x++) {
 *   const segment = world.createEntity();
 *   world.addComponent(segment, LineAssemblyComponent, {
 *     lineId,
 *     segmentIndex: x
 *   });
 *   world.addComponent(segment, GridPositionComponent, { x, y: 5, grid });
 * }
 * 
 * // Link segments
 * lineSystem.linkLineSegments(lineId);
 * ```
 */
export class LineAssemblySystem extends System {
  /**
   * Update line assemblies
   */
  update(_dt: number): void {
    // Validate lines (check connectivity, alignment)
    const lines = this.groupSegmentsByLine();
    
    for (const [lineId, segments] of lines) {
      this.validateLine(lineId, segments);
    }
  }
  
  /**
   * Group segments by lineId
   */
  private groupSegmentsByLine(): Map<string, Entity[]> {
    const lines = new Map<string, Entity[]>();
    
    for (const [entity, segment] of this.world.query(LineAssemblyComponent)) {
      if (!lines.has(segment.lineId)) {
        lines.set(segment.lineId, []);
      }
      lines.get(segment.lineId)!.push(entity);
    }
    
    return lines;
  }
  
  /**
   * Validate line integrity
   */
  validateLine(lineId: string, segments?: Entity[]): boolean {
    if (!segments) {
      const lines = this.groupSegmentsByLine();
      segments = lines.get(lineId) || [];
    }
    
    if (segments.length === 0) return false;
    
    // Sort by segment index
    segments.sort((a, b) => {
      const segA = this.world.getComponent(a, LineAssemblyComponent);
      const segB = this.world.getComponent(b, LineAssemblyComponent);
      return (segA?.segmentIndex ?? 0) - (segB?.segmentIndex ?? 0);
    });
    
    // Check connectivity
    for (let i = 0; i < segments.length - 1; i++) {
      const current = this.world.getComponent(segments[i], LineAssemblyComponent);
      const next = this.world.getComponent(segments[i + 1], LineAssemblyComponent);
      
      if (!current || !next) continue;
      
      // Check if linked
      if (current.nextSegment !== segments[i + 1]) {
        return false;
      }
      if (next.previousSegment !== segments[i]) {
        return false;
      }
    }
    
    // Check alignment if specified
    if (segments.length > 1) {
      const firstSeg = this.world.getComponent(segments[0], LineAssemblyComponent);
      if (firstSeg?.alignment && firstSeg.alignment !== 'any') {
        if (!this.checkAlignment(segments, firstSeg.alignment)) {
          return false;
        }
      }
    }
    
    // Mark as validated
    for (const entity of segments) {
      const seg = this.world.getComponent(entity, LineAssemblyComponent);
      if (seg) {
        seg.validated = true;
      }
    }
    
    return true;
  }
  
  /**
   * Check if segments follow alignment constraint
   */
  private checkAlignment(segments: Entity[], alignment: 'horizontal' | 'vertical' | 'diagonal'): boolean {
    if (segments.length < 2) return true;
    
    for (let i = 0; i < segments.length - 1; i++) {
      const pos1 = this.world.getComponent(segments[i], GridPositionComponent);
      const pos2 = this.world.getComponent(segments[i + 1], GridPositionComponent);
      
      if (!pos1 || !pos2) continue;
      
      const dx = Math.abs(pos2.x - pos1.x);
      const dy = Math.abs(pos2.y - pos1.y);
      
      switch (alignment) {
        case 'horizontal':
          if (dy !== 0) return false;
          break;
        case 'vertical':
          if (dx !== 0) return false;
          break;
        case 'diagonal':
          if (dx !== dy) return false;
          break;
      }
    }
    
    return true;
  }
  
  /**
   * Link line segments together
   */
  linkLineSegments(lineId: string): void {
    const lines = this.groupSegmentsByLine();
    const segments = lines.get(lineId);
    
    if (!segments || segments.length === 0) return;
    
    // Sort by segment index
    segments.sort((a, b) => {
      const segA = this.world.getComponent(a, LineAssemblyComponent);
      const segB = this.world.getComponent(b, LineAssemblyComponent);
      return (segA?.segmentIndex ?? 0) - (segB?.segmentIndex ?? 0);
    });
    
    // Link segments
    for (let i = 0; i < segments.length; i++) {
      const segment = this.world.getComponent(segments[i], LineAssemblyComponent);
      if (!segment) continue;
      
      segment.previousSegment = i > 0 ? segments[i - 1] : undefined;
      segment.nextSegment = i < segments.length - 1 ? segments[i + 1] : undefined;
    }
  }
  
  /**
   * Get all segments for a line in order
   */
  getLineSegments(lineId: string): Entity[] {
    const lines = this.groupSegmentsByLine();
    const segments = lines.get(lineId) || [];
    
    // Sort by segment index
    segments.sort((a, b) => {
      const segA = this.world.getComponent(a, LineAssemblyComponent);
      const segB = this.world.getComponent(b, LineAssemblyComponent);
      return (segA?.segmentIndex ?? 0) - (segB?.segmentIndex ?? 0);
    });
    
    return segments;
  }
  
  /**
   * Handle line break when segment is destroyed
   */
  handleLineBreak(destroyedSegment: Entity): void {
    const segment = this.world.getComponent(destroyedSegment, LineAssemblyComponent);
    if (!segment) return;
    
    const lineId = segment.lineId;
    const prev = segment.previousSegment;
    const next = segment.nextSegment;
    
    // Fire callback
    if (segment.onSegmentRemoved) {
      segment.onSegmentRemoved(destroyedSegment, lineId);
    }
    
    // If segment has both prev and next, split into two lines
    if (prev && next) {
      const newLineIds = this.splitLine(lineId, destroyedSegment);
      
      if (segment.onLineBreak && newLineIds.length > 0) {
        segment.onLineBreak(lineId, newLineIds);
      }
    } else {
      // Just unlink from neighbors
      if (prev) {
        const prevSeg = this.world.getComponent(prev, LineAssemblyComponent);
        if (prevSeg) {
          prevSeg.nextSegment = undefined;
        }
      }
      if (next) {
        const nextSeg = this.world.getComponent(next, LineAssemblyComponent);
        if (nextSeg) {
          nextSeg.previousSegment = undefined;
        }
      }
    }
  }
  
  /**
   * Split line into two lines at break point
   */
  splitLine(lineId: string, breakEntity: Entity): string[] {
    const segment = this.world.getComponent(breakEntity, LineAssemblyComponent);
    if (!segment) return [];
    
    const allSegments = this.getLineSegments(lineId);
    const breakIndex = allSegments.indexOf(breakEntity);
    
    if (breakIndex === -1) return [];
    
    const beforeBreak = allSegments.slice(0, breakIndex);
    const afterBreak = allSegments.slice(breakIndex + 1);
    
    const newLineIds: string[] = [];
    
    // Create new line for "before break" segments
    if (beforeBreak.length > 0) {
      const newLineId1 = `${lineId}-1-${Date.now()}`;
      this.reassignLineId(beforeBreak, newLineId1);
      newLineIds.push(newLineId1);
    }
    
    // Create new line for "after break" segments
    if (afterBreak.length > 0) {
      const newLineId2 = `${lineId}-2-${Date.now()}`;
      this.reassignLineId(afterBreak, newLineId2);
      newLineIds.push(newLineId2);
    }
    
    return newLineIds;
  }
  
  /**
   * Reassign segments to new lineId and reindex
   */
  private reassignLineId(segments: Entity[], newLineId: string): void {
    for (let i = 0; i < segments.length; i++) {
      const seg = this.world.getComponent(segments[i], LineAssemblyComponent);
      if (seg) {
        seg.lineId = newLineId;
        seg.segmentIndex = i;
        seg.validated = false;
        
        // Update links
        seg.previousSegment = i > 0 ? segments[i - 1] : undefined;
        seg.nextSegment = i < segments.length - 1 ? segments[i + 1] : undefined;
      }
    }
  }
  
  /**
   * Get line length (number of segments)
   */
  getLineLength(lineId: string): number {
    return this.getLineSegments(lineId).length;
  }
  
  /**
   * Get line endpoints (first and last segment)
   */
  getLineEndpoints(lineId: string): { start?: Entity; end?: Entity } {
    const segments = this.getLineSegments(lineId);
    return {
      start: segments[0],
      end: segments[segments.length - 1]
    };
  }
}
