/**
 * @brief Programmatic input for testing.
 */
/**
 * HeadlessInputManager - Programmatic input for testing and headless environments.
 *
 * Provides the same interface as KeyboardInputManager but allows direct
 * programmatic control instead of listening to DOM events.
 *
 * **Use cases:**
 * - Automated testing
 * - Headless game simulations
 * - Replays/demos
 * - AI/bot control
 *
 * @example
 * ```typescript
 * const headlessInput = new HeadlessInputManager();
 * headlessInput.enable();
 *
 * // Simulate pressing right arrow
 * headlessInput.setDirection(Direction.RIGHT);
 *
 * // In game loop
 * function tick() {
 *   const state = headlessInput.getState();
 *   if (state.direction !== Direction.NONE) {
 *     player.move(state.direction);
 *   }
 * }
 *
 * // Clear input (like releasing key)
 * headlessInput.clearInput();
 * ```
 */

import { Direction } from '../../spartan/core/grid/direction';
import { InputProvider, InputPreset } from '../../spartan/core/input-provider';

/**
 * Headless input state for a single frame.
 * Matches KeyboardState interface for compatibility.
 */
export interface HeadlessInputState {
  direction: Direction;
  action: boolean; // Action button
  secondary: boolean; // Secondary button
  start: boolean; // Start button (just pressed)
  restart: boolean; // Restart button (just pressed)
  // New fields for preset-based input
  moveDirection: Direction;
  aimDirection: Direction;
}

/**
 * HeadlessInputManager - Programmatic input control for testing.
 *
 * Provides the same interface as KeyboardInputManager but allows
 * direct control of input state without DOM events.
 */
export class HeadlessInputManager {
  private enabled = false;
  private preset: InputPreset = 'classic';

  // Current input state (persists across frames until changed)
  private direction: Direction = Direction.NONE;
  private action: boolean = false;
  private secondary: boolean = false;

  // Separated input channels
  private moveDirection: Direction = Direction.NONE;
  private aimDirection: Direction = Direction.NONE;

  // One-shot inputs (consumed after being read once)
  private start: boolean = false;
  private restart: boolean = false;

  // Track last move direction for classic mode aim
  private lastMoveDirection: Direction = Direction.NONE;

  /**
   * Create a new HeadlessInputManager.
   */
  constructor() {
    // No DOM setup needed
  }

  /**
   * Enable the input manager.
   * Always succeeds (no DOM required).
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable the input manager.
   * Clears all input state.
   */
  disable(): void {
    this.enabled = false;
    this.clearInput();
  }

  /**
   * Check if input manager is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set the input preset for mapping.
   */
  setPreset(preset: InputPreset): void {
    this.preset = preset;
    this.lastMoveDirection = Direction.NONE;
  }

  /**
   * Get the current input preset.
   */
  getPreset(): InputPreset {
    return this.preset;
  }

  /**
   * Set direction input (like holding an arrow key).
   * Direction persists until changed or cleared.
   * In classic mode, this sets both move and aim direction.
   *
   * @param direction - Direction to set (use Direction.NONE to clear)
   */
  setDirection(direction: Direction): void {
    this.direction = direction;

    // In classic mode, direction controls movement
    if (this.preset === 'classic') {
      this.moveDirection = direction;
      if (direction !== Direction.NONE) {
        this.lastMoveDirection = direction;
        this.aimDirection = direction;
      }
    }
  }

  /**
   * Set movement direction explicitly.
   * Used for twin-stick and separated modes where move != aim.
   *
   * @param direction - Direction to move
   */
  setMoveDirection(direction: Direction): void {
    this.moveDirection = direction;
    this.direction = direction; // For backwards compatibility

    // Update last move direction and aim in classic mode
    if (direction !== Direction.NONE) {
      this.lastMoveDirection = direction;
      if (this.preset === 'classic') {
        this.aimDirection = direction;
      }
    }
  }

  /**
   * Set aim/attack direction explicitly.
   * Used for twin-stick and separated modes.
   *
   * @param direction - Direction to aim/attack
   */
  setAimDirection(direction: Direction): void {
    this.aimDirection = direction;
  }

  /**
   * Set action button state (like holding space bar).
   * State persists until changed or cleared.
   *
   * @param pressed - Whether action button is pressed
   */
  setAction(pressed: boolean): void {
    this.action = pressed;
  }

  /**
   * Set secondary button state (like holding shift).
   * State persists until changed or cleared.
   *
   * @param pressed - Whether secondary button is pressed
   */
  setSecondary(pressed: boolean): void {
    this.secondary = pressed;
  }

  /**
   * Press start button for one frame (like tapping enter).
   * This is consumed after one getState() call.
   */
  pressStart(): void {
    this.start = true;
  }

  /**
   * Press restart button for one frame (like tapping 'R').
   * This is consumed after one getState() call.
   */
  pressRestart(): void {
    this.restart = true;
  }

  /**
   * Clear all input (like releasing all keys).
   */
  clearInput(): void {
    this.direction = Direction.NONE;
    this.action = false;
    this.secondary = false;
    this.start = false;
    this.restart = false;
    this.moveDirection = Direction.NONE;
    this.aimDirection = Direction.NONE;
  }

  /**
   * Get current input state.
   * One-shot inputs (start, restart) are consumed after being read.
   *
   * @returns Current input state
   */
  getState(): HeadlessInputState {
    if (!this.enabled) {
      return {
        direction: Direction.NONE,
        action: false,
        secondary: false,
        start: false,
        restart: false,
        moveDirection: Direction.NONE,
        aimDirection: Direction.NONE,
      };
    }

    // Compute aim direction based on preset
    let computedAimDirection = this.aimDirection;
    if (this.preset === 'classic' && computedAimDirection === Direction.NONE) {
      computedAimDirection = this.lastMoveDirection;
    }

    // Build state
    const state: HeadlessInputState = {
      direction: this.direction,
      action: this.action,
      secondary: this.secondary,
      start: this.start,
      restart: this.restart,
      moveDirection: this.moveDirection,
      aimDirection: computedAimDirection,
    };

    // Consume one-shot inputs
    this.start = false;
    this.restart = false;

    return state;
  }

  /**
   * Get an InputProvider interface for this manager.
   * Useful for passing to game systems that expect the InputProvider interface.
   *
   * The returned InputProvider caches state per frame to prevent
   * multiple getState() calls from draining one-shot events.
   *
   * @returns InputProvider interface wrapping this manager
   */
  asInputProvider(): InputProvider {
    let cachedState: HeadlessInputState | null = null;

    const getFrameState = (): HeadlessInputState => {
      if (cachedState === null) {
        cachedState = this.getState();
      }
      return cachedState;
    };

    return {
      beginFrame: () => {
        cachedState = this.getState();
      },
      getMoveDirection: () => getFrameState().moveDirection,
      getAimDirection: () => getFrameState().aimDirection,
      getPrimaryAction: () => getFrameState().action,
      getSecondaryAction: () => getFrameState().secondary,
      getStart: () => getFrameState().start,
      getRestart: () => getFrameState().restart,
      isAiming: () => {
        // Twin-stick and separated modes: aiming when aim direction is set
        // This allows WASD to auto-fire in the pressed direction
        if (this.preset === 'twin-stick' || this.preset === 'separated') {
          return getFrameState().aimDirection !== Direction.NONE;
        }
        return false;
      },
    };
  }

  /**
   * Cleanup (no-op for headless, but matches interface).
   */
  cleanup(): void {
    this.disable();
  }
}
