import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { SnakeSegmentComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';
import { Direction } from '@basegrid/grid';

/**
 * Snake Assembly System - Manages chain movement where body follows head
 * 
 * Snakes are chains of entities where:
 * - The head (segmentIndex: 0) controls direction
 * - Body segments automatically follow the head's path
 * 
 * Movement pattern:
 * 1. Head moves to next cell in its direction
 * 2. Each body segment moves to where the previous segment was
 * 3. Result: Body perfectly follows head's path
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const snakeSystem = new SnakeAssemblySystem();
 * world.addSystem(snakeSystem);
 * 
 * // Create snake
 * const snakeId = 'snake-1';
 * const segments: Entity[] = [];
 * 
 * // Head
 * const head = world.createEntity();
 * world.addComponent(head, SnakeSegmentComponent, {
 *   snakeId,
 *   segmentIndex: 0,
 *   direction: Direction.RT,
 *   active: true,
 *   moveInterval: 5
 * });
 * world.addComponent(head, GridPositionComponent, { x: 10, y: 7, grid });
 * segments.push(head);
 * 
 * // Body segments
 * for (let i = 1; i <= 3; i++) {
 *   const segment = world.createEntity();
 *   world.addComponent(segment, SnakeSegmentComponent, {
 *     snakeId,
 *     segmentIndex: i,
 *     active: true
 *   });
 *   world.addComponent(segment, GridPositionComponent, { x: 10 - i, y: 7, grid });
 *   segments.push(segment);
 *   
 *   // Link segments
 *   const prevSegComp = world.getComponent(segments[i - 1], SnakeSegmentComponent)!;
 *   prevSegComp.nextSegment = segment;
 *   world.getComponent(segment, SnakeSegmentComponent)!.previousSegment = segments[i - 1];
 * }
 * 
 * // Snake moves automatically, body follows head
 * ```
 */
export class SnakeAssemblySystem extends System {
  /**
   * Update snake movement
   */
  update(_dt: number): void {
    // Group segments by snakeId
    const snakes = new Map<string, Entity[]>();
    
    for (const [entity, segment] of this.world.query(SnakeSegmentComponent)) {
      if (segment.active === false) continue;
      
      if (!snakes.has(segment.snakeId)) {
        snakes.set(segment.snakeId, []);
      }
      snakes.get(segment.snakeId)!.push(entity);
    }
    
    // Move each snake
    for (const [snakeId, segments] of snakes) {
      this.moveSnake(snakeId, segments);
    }
  }
  
  /**
   * Move a snake (head + body)
   */
  private moveSnake(snakeId: string, segments: Entity[]): void {
    // Sort by segment index (head first)
    segments.sort((a, b) => {
      const segA = this.world.getComponent(a, SnakeSegmentComponent);
      const segB = this.world.getComponent(b, SnakeSegmentComponent);
      return (segA?.segmentIndex ?? 0) - (segB?.segmentIndex ?? 0);
    });
    
    const head = segments[0];
    if (!head) return;
    
    const headSeg = this.world.getComponent(head, SnakeSegmentComponent);
    if (!headSeg) return;
    
    // Update move timer
    if (headSeg.moveInterval !== undefined) {
      headSeg.moveTicks = (headSeg.moveTicks ?? 0) + 1;
      if (headSeg.moveTicks < headSeg.moveInterval) {
        return; // Not time to move yet
      }
      headSeg.moveTicks = 0;
    }
    
    // Store old positions for body to follow
    const oldPositions: Array<{ x: number; y: number; grid: any }> = [];
    for (const segment of segments) {
      const pos = this.world.getComponent(segment, GridPositionComponent);
      if (pos) {
        oldPositions.push({ x: pos.x, y: pos.y, grid: pos.grid });
      }
    }
    
    // Move head
    const headMoved = this.moveHead(head, headSeg);
    
    if (headMoved) {
      // Move body segments to follow (each moves to previous segment's old position)
      for (let i = 1; i < segments.length; i++) {
        const segment = segments[i];
        const pos = this.world.getComponent(segment, GridPositionComponent);
        const oldPos = oldPositions[i - 1]; // Previous segment's old position
        
        if (pos && oldPos) {
          pos.x = oldPos.x;
          pos.y = oldPos.y;
          pos.grid = oldPos.grid;
        }
      }
    }
  }
  
  /**
   * Move the head segment
   * Returns true if head moved successfully
   */
  private moveHead(head: Entity, headSeg: SnakeSegmentComponent): boolean {
    const headPos = this.world.getComponent(head, GridPositionComponent);
    if (!headPos || !headSeg.direction) return false;
    
    const cell = headPos.grid.cell(headPos.x, headPos.y);
    if (!cell) return false;
    
    // Get next cell in direction
    const nextCell = cell.neighbor(headSeg.direction);
    
    // Check if blocked
    if (!nextCell || this.isBlocked(nextCell, headPos.grid)) {
      // Try to turn (prefer perpendicular directions)
      const turned = this.tryTurn(headSeg, cell, headPos.grid);
      if (!turned) {
        // If can't turn, reverse
        headSeg.direction = this.oppositeDirection(headSeg.direction);
        const reverseCell = cell.neighbor(headSeg.direction);
        if (reverseCell && !this.isBlocked(reverseCell, headPos.grid)) {
          headPos.x = reverseCell.x;
          headPos.y = reverseCell.y;
          return true;
        }
        return false; // Trapped
      }
      
      // Successfully turned, get new next cell
      const newNextCell = cell.neighbor(headSeg.direction);
      if (newNextCell && !this.isBlocked(newNextCell, headPos.grid)) {
        headPos.x = newNextCell.x;
        headPos.y = newNextCell.y;
        return true;
      }
      return false;
    }
    
    // Move to next cell
    headPos.x = nextCell.x;
    headPos.y = nextCell.y;
    return true;
  }
  
  /**
   * Try to turn in a perpendicular direction
   */
  private tryTurn(headSeg: SnakeSegmentComponent, cell: any, grid: any): boolean {
    const perpendicular = this.getPerpendicularDirections(headSeg.direction!);
    
    for (const dir of perpendicular) {
      const turnCell = cell.neighbor(dir);
      if (turnCell && !this.isBlocked(turnCell, grid)) {
        headSeg.direction = dir;
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get perpendicular directions
   */
  private getPerpendicularDirections(dir: Direction): Direction[] {
    if (dir === Direction.UP || dir === Direction.DN) {
      return [Direction.LT, Direction.RT];
    } else {
      return [Direction.UP, Direction.DN];
    }
  }
  
  /**
   * Get opposite direction
   */
  private oppositeDirection(dir: Direction): Direction {
    switch (dir) {
      case Direction.UP: return Direction.DN;
      case Direction.DN: return Direction.UP;
      case Direction.LT: return Direction.RT;
      case Direction.RT: return Direction.LT;
      default: return Direction.RT;
    }
  }
  
  /**
   * Check if a cell is blocked
   */
  private isBlocked(cell: any, grid: any): boolean {
    // Check for walls (cell value 1)
    if (cell.values && cell.values[0] === 1) return true;
    
    // Check if any entity occupies this cell (including other snake segments)
    for (const [entity, pos] of this.world.query(GridPositionComponent)) {
      if (pos.grid === grid && pos.x === cell.x && pos.y === cell.y) {
        // Check if it's a snake segment
        const seg = this.world.getComponent(entity, SnakeSegmentComponent);
        if (seg) {
          return true; // Snake collision
        }
      }
    }
    
    return false;
  }
  
  /**
   * Handle snake split when segment is destroyed
   * 
   * When a middle segment is destroyed, splits snake into two independent snakes:
   * - Head section keeps original snakeId
   * - Tail section gets new snakeId and new head
   * 
   * @param destroyedSegment - The segment that was destroyed
   */
  handleSnakeSplit(destroyedSegment: Entity): void {
    const segment = this.world.getComponent(destroyedSegment, SnakeSegmentComponent);
    if (!segment) return;
    
    // Don't split if it's the head (segment index 0)
    if (segment.segmentIndex === 0) {
      // Just unlink from next segment
      if (segment.nextSegment) {
        const next = this.world.getComponent(segment.nextSegment, SnakeSegmentComponent);
        if (next) {
          next.previousSegment = undefined;
        }
      }
      return;
    }
    
    // Get segments before and after the break
    const headSection = this.getSegmentsBeforeBreak(destroyedSegment, segment);
    const tailSection = this.getSegmentsAfterBreak(destroyedSegment, segment);
    
    // If either section is empty, no split needed (just unlinking)
    if (headSection.length === 0) {
      // Only tail section remains, it becomes a new snake
      if (tailSection.length > 0) {
        const newSnakeId = `${segment.snakeId}-split-${Date.now()}`;
        this.convertToNewSnake(tailSection, newSnakeId);
      }
      return;
    }
    
    if (tailSection.length === 0) {
      // Only head section remains, keep original snake
      this.reindexSegments(headSection, segment.snakeId);
      return;
    }
    
    // Both sections exist - split into two snakes
    // Head section keeps original snakeId
    this.reindexSegments(headSection, segment.snakeId);
    
    // Tail section becomes new snake with new head
    const newSnakeId = `${segment.snakeId}-split-${Date.now()}`;
    this.convertToNewSnake(tailSection, newSnakeId);
  }
  
  /**
   * Get all segments before the break point
   */
  private getSegmentsBeforeBreak(breakSegment: Entity, breakSegComp: SnakeSegmentComponent): Entity[] {
    const segments: Entity[] = [];
    let current = breakSegComp.previousSegment;
    
    while (current) {
      segments.unshift(current); // Add to front
      const seg = this.world.getComponent(current, SnakeSegmentComponent);
      if (!seg || !seg.previousSegment) break;
      current = seg.previousSegment;
    }
    
    return segments;
  }
  
  /**
   * Get all segments after the break point
   */
  private getSegmentsAfterBreak(breakSegment: Entity, breakSegComp: SnakeSegmentComponent): Entity[] {
    const segments: Entity[] = [];
    let current = breakSegComp.nextSegment;
    
    while (current) {
      segments.push(current);
      const seg = this.world.getComponent(current, SnakeSegmentComponent);
      if (!seg || !seg.nextSegment) break;
      current = seg.nextSegment;
    }
    
    return segments;
  }
  
  /**
   * Reindex segments and update links
   */
  private reindexSegments(segments: Entity[], snakeId: string): void {
    for (let i = 0; i < segments.length; i++) {
      const seg = this.world.getComponent(segments[i], SnakeSegmentComponent);
      if (!seg) continue;
      
      seg.snakeId = snakeId;
      seg.segmentIndex = i;
      seg.previousSegment = i > 0 ? segments[i - 1] : undefined;
      seg.nextSegment = i < segments.length - 1 ? segments[i + 1] : undefined;
      
      // Preserve head's direction
      if (i === 0 && seg.direction === undefined) {
        // If new head doesn't have direction, give it one
        seg.direction = Direction.RT; // Default direction
      }
    }
  }
  
  /**
   * Convert segments to new snake with new head
   */
  private convertToNewSnake(segments: Entity[], newSnakeId: string): void {
    for (let i = 0; i < segments.length; i++) {
      const seg = this.world.getComponent(segments[i], SnakeSegmentComponent);
      if (!seg) continue;
      
      seg.snakeId = newSnakeId;
      seg.segmentIndex = i;
      seg.previousSegment = i > 0 ? segments[i - 1] : undefined;
      seg.nextSegment = i < segments.length - 1 ? segments[i + 1] : undefined;
      
      // First segment becomes new head
      if (i === 0) {
        seg.direction = Direction.RT; // New head gets a direction
      } else {
        seg.direction = undefined; // Body segments don't have direction
      }
    }
  }
}
