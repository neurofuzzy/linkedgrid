/**
 * Unified input system exports.
 *
 * Provides three separate input managers for keyboard, mouse, and gamepad.
 * Each manager is focused on a single input device with no cross-dependencies.
 */

// Runtime exports (classes only)
export { KeyboardInputManager } from './keyboard-input-manager';
export { MouseManager } from './mouse-manager';
export { GamepadManager } from './gamepad-manager';
export { HeadlessInputManager } from './headless-input-manager';
export { InputManager } from './input-manager';
export { WebInputProvider } from './web-input-provider';

// Type-only exports (interfaces and type aliases)
export type { KeyboardState, DirectionMode } from './keyboard-input-manager';
export type { MouseState } from './mouse-manager';
export type { GamepadState, StickMode } from './gamepad-manager';

// Import types for local use
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
