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
 * headlessInput.setDirection(Direction.RT);
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

import { Direction } from '../../grid/direction';

/**
 * Headless input state for a single frame.
 * Matches KeyboardState interface for compatibility.
 */
export interface HeadlessInputState {
  direction: Direction;
  action: boolean;        // Action button
  secondary: boolean;     // Secondary button
  start: boolean;         // Start button (just pressed)
  restart: boolean;       // Restart button (just pressed)
}

/**
 * HeadlessInputManager - Programmatic input control for testing.
 * 
 * Provides the same interface as KeyboardInputManager but allows
 * direct control of input state without DOM events.
 */
export class HeadlessInputManager {
  private enabled = false;
  
  // Current input state (persists across frames until changed)
  private direction: Direction = Direction.NONE;
  private action: boolean = false;
  private secondary: boolean = false;
  
  // One-shot inputs (consumed after being read once)
  private start: boolean = false;
  private restart: boolean = false;
  
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
   * Set direction input (like holding an arrow key).
   * Direction persists until changed or cleared.
   * 
   * @param direction - Direction to set (use Direction.NONE to clear)
   */
  setDirection(direction: Direction): void {
    this.direction = direction;
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
        restart: false
      };
    }
    
    // Build state
    const state: HeadlessInputState = {
      direction: this.direction,
      action: this.action,
      secondary: this.secondary,
      start: this.start,
      restart: this.restart
    };
    
    // Consume one-shot inputs
    this.start = false;
    this.restart = false;
    
    return state;
  }
  
  /**
   * Cleanup (no-op for headless, but matches interface).
   */
  cleanup(): void {
    this.disable();
  }
}
