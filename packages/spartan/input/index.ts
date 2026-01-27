/**
 * Unified input system exports.
 * 
 * Provides three separate input managers for keyboard, mouse, and gamepad.
 * Each manager is focused on a single input device with no cross-dependencies.
 */

export * from './keyboard-input-manager';
export * from './mouse-manager';
export * from './gamepad-manager';
export * from './headless-input-manager';

import type { KeyboardState } from './keyboard-input-manager';
import type { MouseState } from './mouse-manager';
import type { GamepadState } from './gamepad-manager';

/**
 * Unified input state that composes all three input managers.
 * Systems that need access to multiple input types can use this interface.
 */
export interface UnifiedInputState {
  keyboard: KeyboardState;
  mouse: MouseState;
  gamepad: GamepadState;
}
