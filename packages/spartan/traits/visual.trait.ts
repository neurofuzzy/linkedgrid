/**
 * Visual Traits
 *
 * Platform-agnostic visual metadata for entities.
 * View layers read these traits to determine rendering state.
 *
 * - HasColor: Display color for rendering
 * - HasVisualState: Named visual state (maps to sprite sheet row)
 * - HasFacing: Cardinal facing direction
 * - HasAnimation: Frame-based animation within a visual state
 */

import type { Direction } from '../core/grid/direction';

/**
 * Visual state name - maps to a sprite sheet row.
 * Standard names (by convention, not enforced):
 * - 'idle' - default resting state
 * - 'walk' - moving
 * - 'attack' - melee or ranged attack in progress
 * - 'hurt' - taking damage
 * - 'die' - death animation
 * - 'special' - powerup, charge, etc.
 */
export type VisualStateName = string;

/**
 * Standard visual state names for consistent cross-entity usage.
 * Alias of VISUAL_STATE_PRESETS from config/visual.config.ts.
 */
export { VISUAL_STATE_PRESETS as VISUAL_STATES } from '../config/visual.config';

/**
 * HasColor - Display color for rendering.
 */
export interface HasColor {
  color: string;
}

/**
 * HasVisualState - Named visual state with dirty tracking.
 *
 * Systems set visualState when entity appearance should change.
 * Set visualDirty = true whenever visual representation changes.
 * VisualStateSystem clears the flag after emitting events.
 */
export interface HasVisualState {
  /** Current visual state name (maps to sprite sheet row) */
  visualState: VisualStateName;
  /** Flagged true when visual representation needs update */
  visualDirty: boolean;
}

/**
 * HasFacing - Cardinal facing direction.
 *
 * Updated automatically by VisualStateSystem on movement,
 * or explicitly by PlayerInputSystem/NPCMovementSystem.
 *
 * facingMode determines how direction maps to visual output:
 * - '2-way': Only left/right (horizontal flip)
 * - '4-way': All four cardinal directions (separate sprite rows)
 */
export interface HasFacing {
  /** Current facing direction */
  facing: Direction;
  /** '2-way' = left/right only, '4-way' = all cardinal directions */
  facingMode: '2-way' | '4-way';
}

/**
 * HasAnimation - Frame-based animation within a visual state.
 *
 * Animation is tick-based (not time-based) to keep spartan deterministic.
 * Each visual state can have multiple frames. The VisualStateSystem
 * advances currentFrame based on frameDuration and animationMode.
 *
 * Sprite sheets: rows are states, columns are frames.
 * A state with 0 extra frames reverts to frame 0 (static).
 */
export interface HasAnimation {
  /** Total frames for current state */
  frameCount: number;
  /** Current frame index (0-based) */
  currentFrame: number;
  /** Playback mode: once, repeat, or yoyo (ping-pong) */
  animationMode: 'once' | 'repeat' | 'yoyo';
  /** Ticks per frame advancement */
  frameDuration: number;
  /** Internal tick counter for frame timing */
  animationTick: number;
}
