/**
 * KeyboardInputManager - Simplified keyboard input handling.
 *
 * **Design principles**:
 * - Only tracks keys pressed in the current frame
 * - No keyup handlers (eliminates race conditions)
 * - Uses event.repeat to distinguish tap vs continuous modes
 * - Time-based input buffering for low-FPS games
 *
 * **Tap mode**: Only accepts initial keypress (event.repeat = false)
 * **Continuous mode**: Accepts all keypresses including repeats
 *
 * @example
 * ```typescript
 * const keyboard = new KeyboardInputManager({ directionMode: 'tap' });
 * keyboard.enable();
 *
 * // In game loop
 * function tick() {
 *   const state = keyboard.getState();
 *   if (state.direction !== Direction.NONE) {
 *     player.move(state.direction);
 *   }
 * }
 * ```
 */

import { Direction } from '../core/grid/direction';

/**
 * Direction input mode.
 * - 'continuous': Hold key = direction stays active (default, for action games)
 * - 'tap': Each keypress = one frame of direction (for puzzle games, uses event.repeat filtering)
 */
export type DirectionMode = 'continuous' | 'tap';

/**
 * Configuration for KeyboardInputManager.
 */
export interface KeyboardInputConfig {
  /** Direction input mode: 'continuous' (hold key) or 'tap' (each press) */
  directionMode?: DirectionMode;
  /** Enable input buffering for low-framerate games (default: false) */
  bufferInput?: boolean;
  /** Max buffer size - slower tick rates need smaller buffers (default: 10) */
  bufferMaxLength?: number;
  /** Time window for buffered inputs in milliseconds (default: 200ms) */
  bufferTimeWindowMs?: number;
  /** Headless mode for testing - don't attach DOM listeners (default: false) */
  headless?: boolean;
}

/**
 * Input event with timestamp for buffering.
 */
export interface InputEvent {
  key: string;
  timestamp: number;
}

/**
 * Keyboard input state for a single frame.
 */
export interface KeyboardState {
  direction: Direction;
  action: boolean; // Space key
  secondary: boolean; // Shift key
  start: boolean; // Enter key (just pressed)
  restart: boolean; // R key (just pressed)
}

/**
 * KeyboardInputManager - Handles keyboard input with frame-based state.
 *
 * Only tracks keys pressed in the current frame. State is cleared after
 * each getState() call, eliminating race conditions and stuck inputs.
 */
export class KeyboardInputManager {
  private config: KeyboardInputConfig;
  private enabled = false;

  // Frame-based state - cleared after each read
  private keysThisFrame = new Set<string>();

  // Input buffering for low-FPS games
  private inputBuffer: InputEvent[] = [];

  // Event listener
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;

  /**
   * Create a new KeyboardInputManager.
   *
   * @param config - Configuration options
   */
  constructor(config: KeyboardInputConfig = {}) {
    this.config = {
      directionMode: config.directionMode ?? 'continuous',
      bufferInput: config.bufferInput ?? false,
      bufferMaxLength: config.bufferMaxLength ?? 10,
      bufferTimeWindowMs: config.bufferTimeWindowMs ?? 200,
      headless: config.headless ?? false,
    };

    // Only setup DOM listeners if not in headless mode
    if (!this.config.headless) {
      this.setupListener();
    }
  }

  /**
   * Setup keyboard event listener.
   * Only listens to keydown events - no keyup needed.
   */
  private setupListener(): void {
    this.boundKeyDown = (e: KeyboardEvent) => {
      if (!this.enabled) return;
      // Prevent default for game keys only when enabled
      if (this.isGameKey(e.key)) {
        e.preventDefault();
      }

      // TAP MODE: Only accept initial keypress, ignore held keys
      // This uses the browser's event.repeat property to filter out
      // repeated keydown events when a key is held down
      if (this.config.directionMode === 'tap' && e.repeat) {
        return;
      }

      // Track key pressed in this frame
      this.keysThisFrame.add(e.key);

      // Buffer inputs if enabled
      if (this.config.bufferInput) {
        const event: InputEvent = {
          key: e.key,
          timestamp: performance.now(),
        };

        this.inputBuffer.push(event);

        // Enforce max buffer length
        if (this.inputBuffer.length > this.config.bufferMaxLength!) {
          this.inputBuffer.shift(); // Remove oldest
        }
      }
    };

    document.addEventListener('keydown', this.boundKeyDown);
  }

  /**
   * Get current keyboard state.
   *
   * Reads all keys pressed in the current frame, then clears the state.
   * If buffering is enabled and no current input, consumes oldest buffered input.
   *
   * @returns KeyboardState with direction and button states
   */
  getState(): KeyboardState {
    const direction = this.getDirection();

    const state: KeyboardState = {
      direction,
      action: this.keysThisFrame.has(' '),
      secondary: this.keysThisFrame.has('Shift'),
      start: this.keysThisFrame.has('Enter'),
      restart: this.keysThisFrame.has('r') || this.keysThisFrame.has('R'),
    };

    // Clear frame state (consumed)
    this.keysThisFrame.clear();

    // If buffering enabled and no current input, try to use buffered input
    if (this.config.bufferInput && state.direction === Direction.NONE) {
      const bufferedDirection = this.consumeBufferedDirection();
      if (bufferedDirection !== Direction.NONE) {
        state.direction = bufferedDirection;
      }
    }

    return state;
  }

  /**
   * Get direction from keys pressed this frame.
   * Priority: Arrow keys > WASD
   */
  private getDirection(): Direction {
    // Arrow keys take priority
    if (this.keysThisFrame.has('ArrowUp')) return Direction.UP;
    if (this.keysThisFrame.has('ArrowDown')) return Direction.DOWN;
    if (this.keysThisFrame.has('ArrowLeft')) return Direction.LEFT;
    if (this.keysThisFrame.has('ArrowRight')) return Direction.RIGHT;

    // WASD fallback
    if (this.keysThisFrame.has('w') || this.keysThisFrame.has('W'))
      return Direction.UP;
    if (this.keysThisFrame.has('s') || this.keysThisFrame.has('S'))
      return Direction.DOWN;
    if (this.keysThisFrame.has('a') || this.keysThisFrame.has('A'))
      return Direction.LEFT;
    if (this.keysThisFrame.has('d') || this.keysThisFrame.has('D'))
      return Direction.RIGHT;

    return Direction.NONE;
  }

  /**
   * Consume oldest buffered direction input within time window.
   * Expires inputs older than bufferTimeWindowMs.
   */
  private consumeBufferedDirection(): Direction {
    if (this.inputBuffer.length === 0) {
      return Direction.NONE;
    }

    const now = performance.now();
    const timeWindow = this.config.bufferTimeWindowMs!;

    // Remove expired inputs
    while (this.inputBuffer.length > 0) {
      const oldest = this.inputBuffer[0];
      const age = now - oldest.timestamp;

      if (age > timeWindow) {
        this.inputBuffer.shift(); // Expired, remove it
      } else {
        break; // Rest are still valid
      }
    }

    // Try to find a direction key in the buffer
    for (let i = 0; i < this.inputBuffer.length; i++) {
      const event = this.inputBuffer[i];
      const dir = this.getDirectionFromKey(event.key);

      if (dir !== Direction.NONE) {
        // Found a direction, consume it
        this.inputBuffer.splice(i, 1);
        return dir;
      }
    }

    return Direction.NONE;
  }

  /**
   * Convert a key string to a Direction.
   */
  private getDirectionFromKey(key: string): Direction {
    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        return Direction.UP;
      case 'ArrowDown':
      case 's':
      case 'S':
        return Direction.DOWN;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        return Direction.LEFT;
      case 'ArrowRight':
      case 'd':
      case 'D':
        return Direction.RIGHT;
      default:
        return Direction.NONE;
    }
  }

  /**
   * Check if a key is a game key that should preventDefault.
   */
  private isGameKey(key: string): boolean {
    const gameKeys = [
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'w',
      'W',
      'a',
      'A',
      's',
      'S',
      'd',
      'D',
      ' ',
      'Enter',
      'r',
      'R',
      'Shift',
    ];
    return gameKeys.includes(key);
  }

  /**
   * Enable keyboard input.
   */
  enable(): this {
    this.enabled = true;
    return this;
  }

  /**
   * Disable keyboard input.
   */
  disable(): this {
    this.enabled = false;
    return this;
  }

  /**
   * Cleanup and remove event listeners.
   */
  destroy(): void {
    if (this.boundKeyDown) {
      document.removeEventListener('keydown', this.boundKeyDown);
      this.boundKeyDown = null;
    }
    this.keysThisFrame.clear();
    this.inputBuffer = [];
  }

  /**
   * Test helper: Inject a key press programmatically.
   * Useful for testing without DOM events.
   */
  injectKey(key: string): void {
    this.keysThisFrame.add(key);
    if (this.config.bufferInput) {
      const event: InputEvent = { key, timestamp: performance.now() };
      this.inputBuffer.push(event);
      if (this.inputBuffer.length > this.config.bufferMaxLength!) {
        this.inputBuffer.shift();
      }
    }
  }
}
