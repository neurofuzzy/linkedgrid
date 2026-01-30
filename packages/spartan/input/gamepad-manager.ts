/**
 * GamepadManager - Simplified gamepad input handling.
 *
 * **Design principles**:
 * - Polling-based (required by Gamepad API)
 * - Supports D-pad and analog sticks
 * - Optional analog stick to cardinal direction conversion
 * - Simple button mapping
 *
 * @example
 * ```typescript
 * const gamepad = new GamepadManager({ leftStickMode: 'cardinal4' });
 * gamepad.enable();
 *
 * // In game loop
 * function tick() {
 *   const state = gamepad.getState();
 *   if (state.connected && state.leftStickDirection !== Direction.NONE) {
 *     player.move(state.leftStickDirection);
 *   }
 * }
 * ```
 */

import { Direction } from '../../grid/direction';

/**
 * Stick processing mode.
 * - 'analog': Raw stick values, no Direction conversion
 * - 'cardinal4': Convert stick to 4-way cardinal Direction
 */
export type StickMode = 'analog' | 'cardinal4';

/**
 * Configuration for GamepadManager.
 */
export interface GamepadConfig {
  /** Left stick processing mode (default: 'analog') */
  leftStickMode?: StickMode;
  /** Right stick processing mode (default: 'analog') */
  rightStickMode?: StickMode;
  /** Dead zone threshold for stick input (default: 0.3) */
  deadzone?: number;
  /** Polling interval in milliseconds (default: 16ms ~60Hz) */
  pollIntervalMs?: number;
}

/**
 * Gamepad state for a single frame.
 */
export interface GamepadState {
  /** Is a gamepad connected */
  connected: boolean;

  /** D-pad direction */
  dpadDirection: Direction;

  /** Left stick X axis (-1 to 1) */
  leftStickX: number;
  /** Left stick Y axis (-1 to 1) */
  leftStickY: number;
  /** Left stick as cardinal direction (if mode is cardinal4) */
  leftStickDirection: Direction;

  /** Right stick X axis (-1 to 1) */
  rightStickX: number;
  /** Right stick Y axis (-1 to 1) */
  rightStickY: number;
  /** Right stick as cardinal direction (if mode is cardinal4) */
  rightStickDirection: Direction;

  /** A button (primary action) */
  actionButton: boolean;
  /** B button (secondary action) */
  secondaryButton: boolean;
  /** Start button */
  startButton: boolean;
}

/**
 * GamepadManager - Handles gamepad input with polling.
 *
 * Uses the Gamepad API which requires polling (no events).
 * Supports D-pad, analog sticks, and button mapping.
 */
export class GamepadManager {
  private config: GamepadConfig;
  private enabled = false;
  private pollInterval: number | null = null;

  // Current state
  private state: GamepadState;

  /**
   * Create a new GamepadManager.
   *
   * @param config - Configuration options
   */
  constructor(config: GamepadConfig = {}) {
    this.config = {
      leftStickMode: config.leftStickMode ?? 'analog',
      rightStickMode: config.rightStickMode ?? 'analog',
      deadzone: config.deadzone ?? 0.3,
      pollIntervalMs: config.pollIntervalMs ?? 16,
    };

    this.state = this.createEmptyState();
  }

  /**
   * Create an empty gamepad state (no gamepad connected).
   */
  private createEmptyState(): GamepadState {
    return {
      connected: false,
      dpadDirection: Direction.NONE,
      leftStickX: 0,
      leftStickY: 0,
      leftStickDirection: Direction.NONE,
      rightStickX: 0,
      rightStickY: 0,
      rightStickDirection: Direction.NONE,
      actionButton: false,
      secondaryButton: false,
      startButton: false,
    };
  }

  /**
   * Enable gamepad input and start polling.
   */
  enable(): this {
    this.enabled = true;

    // Start polling (Gamepad API requires polling, no events)
    this.pollInterval = window.setInterval(() => {
      this.poll();
    }, this.config.pollIntervalMs);

    return this;
  }

  /**
   * Disable gamepad input and stop polling.
   */
  disable(): this {
    this.enabled = false;

    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    return this;
  }

  /**
   * Poll gamepad state from Gamepad API.
   * Called periodically by polling interval.
   *
   * @param gamepadIndex - The index of the gamepad to poll (default: 0)
   */
  private poll(gamepadIndex = 0): void {
    if (!this.enabled) return;

    // Get specific gamepad
    const gamepads = navigator.getGamepads();
    const gp = gamepads[gamepadIndex];

    if (!gp) {
      this.state = this.createEmptyState();
      return;
    }

    this.state.connected = true;

    // D-pad (buttons 12-15 in standard mapping)
    if (gp.buttons[12]?.pressed) {
      this.state.dpadDirection = Direction.UP;
    } else if (gp.buttons[13]?.pressed) {
      this.state.dpadDirection = Direction.DOWN;
    } else if (gp.buttons[14]?.pressed) {
      this.state.dpadDirection = Direction.LEFT;
    } else if (gp.buttons[15]?.pressed) {
      this.state.dpadDirection = Direction.RIGHT;
    } else {
      this.state.dpadDirection = Direction.NONE;
    }

    // Left stick (axes 0, 1)
    const leftX = this.applyDeadzone(gp.axes[0] ?? 0);
    const leftY = this.applyDeadzone(gp.axes[1] ?? 0);
    this.state.leftStickX = leftX;
    this.state.leftStickY = leftY;

    if (this.config.leftStickMode === 'cardinal4') {
      this.state.leftStickDirection = this.stickToCardinal(leftX, leftY);
    } else {
      this.state.leftStickDirection = Direction.NONE;
    }

    // Right stick (axes 2, 3)
    const rightX = this.applyDeadzone(gp.axes[2] ?? 0);
    const rightY = this.applyDeadzone(gp.axes[3] ?? 0);
    this.state.rightStickX = rightX;
    this.state.rightStickY = rightY;

    if (this.config.rightStickMode === 'cardinal4') {
      this.state.rightStickDirection = this.stickToCardinal(rightX, rightY);
    } else {
      this.state.rightStickDirection = Direction.NONE;
    }

    // Buttons (standard mapping)
    this.state.actionButton = gp.buttons[0]?.pressed ?? false; // A
    this.state.secondaryButton = gp.buttons[1]?.pressed ?? false; // B
    this.state.startButton = gp.buttons[9]?.pressed ?? false; // Start
  }

  /**
   * Apply deadzone to stick axis value.
   * Values within deadzone threshold are clamped to 0.
   */
  private applyDeadzone(value: number): number {
    return Math.abs(value) < this.config.deadzone! ? 0 : value;
  }

  /**
   * Convert analog stick values to cardinal direction.
   * Uses dominant axis (ignores diagonals).
   */
  private stickToCardinal(x: number, y: number): Direction {
    // Both axes near zero = no input
    if (Math.abs(x) < 0.1 && Math.abs(y) < 0.1) {
      return Direction.NONE;
    }

    // Use dominant axis
    if (Math.abs(x) > Math.abs(y)) {
      return x > 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      return y > 0 ? Direction.DOWN : Direction.UP;
    }
  }

  /**
   * Get current gamepad state.
   *
   * @param gamepadIndex - The index of the gamepad to get state for (default: 0)
   * @returns GamepadState with stick values, buttons, and directions
   */
  getState(gamepadIndex = 0): GamepadState {
    // In a polling-based system, poll just before returning state
    // to ensure it's the most recent.
    this.poll(gamepadIndex);
    // Return a copy to prevent external mutation
    return { ...this.state };
  }

  /**
   * Cleanup and stop polling.
   */
  destroy(): void {
    this.disable();
  }
}
