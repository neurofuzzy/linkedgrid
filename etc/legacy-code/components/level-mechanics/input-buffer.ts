import { defineComponent } from '@basegrid/ecs';
import type { Direction } from '@basegrid/grid';

/**
 * @component InputBuffer
 * @icon keyboard
 * @description Queue input commands for smooth, responsive gameplay
 * 
 * Input Buffer Component
 * 
 * Stores queued input for responsive grid-based movement.
 * When player presses a direction that's currently invalid, the input is buffered
 * and automatically applied when the move becomes valid.
 * 
 * Critical for smooth gameplay in fast-paced grid games.
 * 
 * @property {Direction | null} bufferedDirection - Queued direction waiting to be applied
 * @property {number} bufferFrames - How long to keep buffered input (in frames)
 * @property {number} bufferTimer - Current buffer countdown
 * @property {boolean} enabled - Whether buffering is active
 * 
 * @example
 * ```typescript
 * const player = world.createEntity();
 * world.addComponent(player, GridPositionComponent, { x: 5, y: 5, grid });
 * world.addComponent(player, InputBufferComponent, {
 *   bufferedDirection: null,
 *   bufferFrames: 10,  // Keep input for 10 frames (~166ms at 60fps)
 *   bufferTimer: 0,
 *   enabled: true
 * });
 * 
 * // When player presses a key
 * const buffer = world.getComponent(player, InputBufferComponent);
 * buffer.bufferedDirection = Direction.UP;
 * buffer.bufferTimer = buffer.bufferFrames;
 * ```
 */
export interface InputBuffer {
  /** Queued direction waiting to be applied */
  bufferedDirection: Direction | null;
  
  /** How long to keep buffered input (frames) */
  bufferFrames?: number;
  
  /** Current buffer countdown */
  bufferTimer?: number;
  
  /** Whether buffering is active */
  enabled?: boolean;
}

export const InputBufferComponent = defineComponent<InputBuffer>();
