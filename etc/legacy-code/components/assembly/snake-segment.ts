import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import type { Direction } from '@basegrid/gameplay';

/**
 * @component SnakeSegment
 * @icon link
 * @description Segment in a snake-like chain (head or body)
 * 
 * Snake segment component for entities that form connected chains.
 * 
 * Snakes are chains of entities where:
 * - **Head**: The leading segment (segmentIndex: 0)
 * - **Body**: Following segments (segmentIndex: 1+)
 * 
 * The head controls direction, body segments follow the head's path automatically.
 * 
 * All segments in a snake share the same snakeId.
 * 
 * @property {string} snakeId - Unique ID for this snake (all segments share same ID)
 * @property {number} segmentIndex - Position in snake (0 = head, 1+ = body)
 * @property {Direction} direction - Direction of movement (only used by head)
 * @property {Entity} previousSegment - Previous segment (toward head)
 * @property {Entity} nextSegment - Next segment (toward tail)
 * @property {boolean} active - Whether this snake is actively moving
 * @property {number} moveInterval - Movement speed in ticks (lower = faster)
 * @property {number} moveTicks - Ticks since last move
 * 
 * @example
 * ```typescript
 * const snakeId = 'snake-1';
 * 
 * // Create head
 * const head = world.createEntity();
 * world.addComponent(head, SnakeSegmentComponent, {
 *   snakeId,
 *   segmentIndex: 0,
 *   direction: Direction.RT,
 *   nextSegment: body1
 * });
 * world.addComponent(head, GridPositionComponent, { x: 10, y: 7, grid });
 * 
 * // Create body segments
 * const body1 = world.createEntity();
 * world.addComponent(body1, SnakeSegmentComponent, {
 *   snakeId,
 *   segmentIndex: 1,
 *   previousSegment: head,
 *   nextSegment: body2
 * });
 * world.addComponent(body1, GridPositionComponent, { x: 9, y: 7, grid });
 * 
 * // SnakeAssemblySystem moves head, body follows automatically
 * ```
 */
export interface SnakeSegment {
  /** Unique ID for this snake (all segments share same ID) */
  snakeId: string;
  
  /** Position in snake (0 = head, 1+ = body) */
  segmentIndex: number;
  
  /** Direction of movement (only used by head) */
  direction?: Direction;
  
  /** Previous segment (toward head) */
  previousSegment?: Entity;
  
  /** Next segment (toward tail) */
  nextSegment?: Entity;
  
  /** Whether this snake is actively moving */
  active?: boolean;
  
  /** Movement speed in ticks (lower = faster) */
  moveInterval?: number;
  
  /** Internal: Ticks since last move */
  moveTicks?: number;
}

export const SnakeSegmentComponent = defineComponent<SnakeSegment>();
