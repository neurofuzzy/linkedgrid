/**
 * Unified input system exports.
 *
 * Provides three separate input managers for keyboard, mouse, and gamepad.
 * Each manager is focused on a single input device with no cross-dependencies.
 */

// Re-export all named exports without duplicates
export {
  KeyboardInputManager,
  KeyboardState,
  DirectionMode
} from './keyboard-input-manager';
export {
  MouseManager,
  MouseState
} from './mouse-manager';
export {
  GamepadManager,
  GamepadState,
  StickMode
} from './gamepad-manager';
export { HeadlessInputManager } from './headless-input-manager';
export { InputManager } from './input-manager';

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
