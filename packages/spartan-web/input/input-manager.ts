/**
 * InputManager - Unified input system for keyboard, mouse, and gamepad.
 *
 * Provides an event-driven input state that games can read each frame/tick.
 * Handles:
 * - Keyboard (WASD, arrows, space, enter, R)
 * - Mouse (position in grid coords, buttons)
 * - Gamepad (D-pad, analog sticks, buttons)
 *
 * **Pattern**: Input state is continuously updated via event listeners.
 * Call `getState()` to read current state at any time.
 *
 * **Input mapping**:
 * - Direction: WASD, arrows, D-pad, left stick
 * - Action: Space, Enter, left click, A button
 * - Secondary: Right click, B button
 * - Start/Pause: Enter (just pressed), Start button
 *
 * **Mouse handling**: Automatically converts pixel coordinates to grid cells
 * using cellSize and cellGap from config.
 *
 * @example
 * ```typescript
 * const input = new InputManager(container, canvas, { cellSize: 32, cellGap: 2 });
 * input.enableKeyboard().enableMouse().enableGamepad();
 *
 * // In game loop
 * function tick() {
 *   const state = input.getState();
 *
 *   // Movement
 *   if (state.direction !== Direction.NONE) {
 *     player.move(state.direction);
 *   }
 *
 *   // Actions
 *   if (state.action) {
 *     player.attack();
 *   }
 *
 *   // Mouse
 *   if (state.mouse.clicked) {
 *     handleCellClick(state.mouse.x, state.mouse.y);
 *   }
 *
 *   // Gamepad analog
 *   if (Math.abs(state.gamepad.stickX) > 0.5) {
 *     // Handle analog movement
 *   }
 * }
 *
 * // Don't forget to cleanup!
 * input.destroy();
 * ```
 *
 * @example
 * ```typescript
 * // Twin-stick shooter
 * const state = input.getState();
 *
 * // Move with left stick / WASD
 * if (state.direction !== Direction.NONE) {
 *   player.move(state.direction);
 * }
 *
 * // Aim with right stick / mouse
 * if (state.gamepad.rightStickX || state.gamepad.rightStickY) {
 *   player.aimWithStick(state.gamepad.rightStickX, state.gamepad.rightStickY);
 * } else if (state.mouse.down) {
 *   player.aimAt(state.mouse.x, state.mouse.y);
 * }
 * ```
 */

import { Direction } from '../../spartan/core/grid/direction';

/**
 * Stick processing mode.
 * - 'analog': Raw stick values, no Direction conversion
 * - 'cardinal4': Convert to 4-way cardinal Direction with diagonal rejection
 */
export type StickMode = 'analog' | 'cardinal4';

/**
 * Configuration for stick processing.
 */
export interface StickConfig {
  /** Processing mode (default: 'analog') */
  mode: StickMode;
  /** Dead zone threshold (default: 0.3) */
  deadzone?: number;
  /** Diagonal rejection threshold - reject when minor axis > (1-threshold) of dominant (default: 0.3) */
  diagonalThreshold?: number;
}

/**
 * Mouse input state with both pixel and grid coordinates.
 */
export interface MouseState {
  /** X position in grid coordinates */
  x: number;
  /** Y position in grid coordinates */
  y: number;
  /** X position in canvas pixels */
  canvasX: number;
  /** Y position in canvas pixels */
  canvasY: number;
  /** Left mouse button down */
  down: boolean;
  /** Left mouse button just pressed this frame */
  clicked: boolean;
  /** Right mouse button down */
  rightDown: boolean;
  /** Mouse wheel delta X (horizontal scroll) */
  wheelDeltaX: number;
  /** Mouse wheel delta Y (vertical scroll) */
  wheelDeltaY: number;
}

/**
 * Gamepad input state with analog sticks and buttons.
 *
 * Uses standard gamepad mapping (Xbox/PlayStation layout).
 */
export interface GamepadState {
  /** D-pad or left stick converted to cardinal Direction */
  direction: Direction;
  /** Right stick converted to cardinal Direction (when mode is cardinal4) */
  rightDirection: Direction;
  /** A button (Xbox) / Cross (PS) - primary action */
  action: boolean;
  /** B button (Xbox) / Circle (PS) - secondary action */
  secondary: boolean;
  /** Start button - pause/menu */
  start: boolean;
  /** Left stick X axis (-1 = left, +1 = right) */
  stickX: number;
  /** Left stick Y axis (-1 = up, +1 = down) */
  stickY: number;
  /** Right stick X axis (-1 = left, +1 = right) - for aiming/camera */
  rightStickX: number;
  /** Right stick Y axis (-1 = up, +1 = down) - for aiming/camera */
  rightStickY: number;
}

/**
 * Unified input state from all enabled input sources.
 *
 * Combines keyboard, mouse, and gamepad inputs into a single state.
 * All inputs are processed and available simultaneously.
 */
export interface InputState {
  /** Current movement direction from any input source (WASD, arrows, D-pad, stick) */
  direction: Direction;
  /** Primary action (space, enter, left click, A button) */
  action: boolean;
  /** Secondary action (right click, B button) */
  secondary: boolean;
  /** Start/pause (Enter, Start button) */
  start: boolean;
  /** Restart/reset (R key) */
  restart: boolean;
  /** Directional shooting using WASD for twin-stick style games */
  shootDirection: Direction;
  /** Mouse state with grid and pixel coordinates */
  mouse: MouseState;
  /** Gamepad state (first connected gamepad) */
  gamepad: GamepadState;
  /** Raw key states for custom input handling */
  keys: Set<string>;
}

/**
 * Direction input mode.
 * - 'continuous': Hold key = direction stays active (default, for action games)
 * - 'tap': Each keypress = one frame of direction, then auto-clears (for puzzle games)
 */
export type DirectionMode = 'continuous' | 'tap';

/**
 * Configuration for InputManager.
 *
 * Defines how pixel coordinates are converted to grid cells.
 */
export interface InputConfig {
  /** Cell size in pixels (width/height of each grid cell) for mouse coordinate conversion (default: 32) */
  cellSize?: number;
  /** Gap between cells in pixels for mouse coordinate conversion (default: 0) */
  cellGap?: number;
  /** Enable input buffering - caches last direction input for smoother controls (default: false) */
  bufferInput?: boolean;
  /** How long to keep buffered input in milliseconds (default: 200ms) */
  bufferTimeMs?: number;
  /** Direction input mode: 'continuous' (hold key = keep direction) or 'tap' (each press = one frame) */
  directionMode?: DirectionMode;
}

/**
 * Game-level input configuration.
 *
 * Specifies which input devices a game wants to enable.
 */
export interface GameInputConfig {
  /** Enable keyboard input (default: true) */
  keyboard?: boolean;
  /** Enable mouse input (default: false) */
  mouse?: boolean;
  /** Enable gamepad input (default: false) */
  gamepad?: boolean;
}

export class InputManager {
  private container: HTMLElement | null;
  private canvas: HTMLCanvasElement | null;
  private config: InputConfig;

  // Enable flags
  private keyboardEnabled = false;
  private mouseEnabled = false;
  private gamepadEnabled = false;

  // Raw input state
  private keysDown = new Set<string>();
  private keysJustPressed = new Set<string>();
  private actionKeyPressed = false;
  private mouseDown = false;
  private mouseRightDown = false;
  private mouseClicked = false;
  private mouseX = 0;
  private mouseY = 0;
  private mouseWheelDeltaX = 0;
  private mouseWheelDeltaY = 0;

  // Gamepad polling (still needed for gamepad API)
  private gamepadPollInterval: number | null = null;

  // Stick mode configurations
  private leftStickConfig: StickConfig = {
    mode: 'analog',
    deadzone: 0.3,
    diagonalThreshold: 0.3,
  };
  private rightStickConfig: StickConfig = {
    mode: 'analog',
    deadzone: 0.3,
    diagonalThreshold: 0.3,
  };

  // Input buffering for low-framerate games
  private directionBufferInternal: Direction[] = [];
  private actionBuffer: boolean = false;
  private bufferEnabled: boolean = false;

  // Input buffering for smooth controls (legacy)
  private bufferedDirection: Direction = Direction.NONE;
  private bufferedTimestamp: number = 0;

  // Current input state (continuously updated by events)
  private state: InputState;

  // Event listener references for cleanup
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private boundMouseDown: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp: ((e: MouseEvent) => void) | null = null;
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundContextMenu: ((e: Event) => void) | null = null;
  private boundWheel: ((e: WheelEvent) => void) | null = null;
  private boundGamepadConnected: ((e: GamepadEvent) => void) | null = null;
  private boundGamepadDisconnected: ((e: GamepadEvent) => void) | null = null;

  /**
   * Create a new InputManager.
   *
   * Automatically sets up event listeners for all input types.
   * - Keyboard events are attached to document for global capture
   * - Mouse events are attached to the provided canvas
   * - Gamepad uses the Gamepad API polling
   *
   * Call enable* methods to activate specific input types.
   *
   * @param container - Container element (currently unused, kept for API compatibility)
   * @param canvas - Canvas element for mouse coordinate conversion (null for headless mode)
   * @param config - Configuration for cell size and gap
   *
   * @example
   * ```typescript
   * const input = new InputManager(container, canvas, { cellSize: 32, cellGap: 2 });
   * input.enableKeyboard().enableMouse();
   *
   * // Headless mode (for testing)
   * const input = new InputManager(null, null, { cellSize: 32, cellGap: 2 });
   * input.injectInput(Direction.RIGHT);  // Programmatic input
   * ```
   */
  constructor(
    container: HTMLElement | null,
    canvas: HTMLCanvasElement | null,
    config: InputConfig = {}
  ) {
    this.container = container;
    this.canvas = canvas;
    this.config = {
      cellSize: config.cellSize ?? 16,
      cellGap: config.cellGap ?? 2,
      bufferInput: config.bufferInput ?? false,
      bufferTimeMs: config.bufferTimeMs ?? 200,
      directionMode: config.directionMode ?? 'continuous',
    };

    this.state = this.createEmptyState();

    // Only setup DOM listeners if container/canvas provided (non-headless mode)
    if (container || canvas) {
      this.setupListeners();
    }
  }

  private createEmptyState(): InputState {
    return {
      direction: Direction.NONE,
      action: false,
      secondary: false,
      start: false,
      restart: false,
      shootDirection: Direction.NONE,
      mouse: {
        x: 0,
        y: 0,
        canvasX: 0,
        canvasY: 0,
        down: false,
        clicked: false,
        rightDown: false,
        wheelDeltaX: 0,
        wheelDeltaY: 0,
      },
      gamepad: {
        direction: Direction.NONE,
        rightDirection: Direction.NONE,
        action: false,
        secondary: false,
        start: false,
        stickX: 0,
        stickY: 0,
        rightStickX: 0,
        rightStickY: 0,
      },
      keys: new Set(),
    };
  }

  /**
   * Update configuration for mouse coordinate conversion.
   *
   * Use when cell size or gap changes (e.g., zoom, different game states).
   *
   * @param config - New cellSize and/or cellGap values
   *
   * @example
   * ```typescript
   * // Change zoom level
   * inputManager.updateConfig({ cellSize: 64, cellGap: 4 });
   * ```
   */
  updateConfig(config: InputConfig): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  // ========================================================================
  // Enable/Disable Input Types
  // ========================================================================

  /**
   * Enable keyboard input (WASD, arrows, space, enter, R).
   * @returns this for chaining
   */
  enableKeyboard(): this {
    this.keyboardEnabled = true;
    return this;
  }

  /**
   * Disable keyboard input.
   * @returns this for chaining
   */
  disableKeyboard(): this {
    this.keyboardEnabled = false;
    this.keysDown.clear();
    this.keysJustPressed.clear();
    return this;
  }

  /**
   * Enable mouse input (position, buttons).
   * @returns this for chaining
   */
  enableMouse(): this {
    this.mouseEnabled = true;
    return this;
  }

  /**
   * Disable mouse input.
   * @returns this for chaining
   */
  disableMouse(): this {
    this.mouseEnabled = false;
    return this;
  }

  /**
   * Enable gamepad input (automatically detects first connected gamepad).
   * Starts polling gamepad state since Gamepad API requires polling.
   * @returns this for chaining
   */
  enableGamepad(): this {
    this.gamepadEnabled = true;

    // Start polling gamepad state (required for Gamepad API)
    if (this.gamepadPollInterval === null) {
      this.gamepadPollInterval = window.setInterval(() => {
        if (this.gamepadEnabled) {
          this.updateGamepadState();
          this.updateStateFromEvents();
        }
      }, 16); // ~60Hz polling
    }

    return this;
  }

  /**
   * Disable gamepad input.
   * @returns this for chaining
   */
  disableGamepad(): this {
    this.gamepadEnabled = false;

    // Stop polling
    if (this.gamepadPollInterval !== null) {
      clearInterval(this.gamepadPollInterval);
      this.gamepadPollInterval = null;
    }

    return this;
  }

  /**
   * Enable all input types (keyboard, mouse, gamepad).
   * @returns this for chaining
   */
  enableAll(): this {
    return this.enableKeyboard().enableMouse().enableGamepad();
  }

  /**
   * Disable all input types.
   * @returns this for chaining
   */
  disableAll(): this {
    return this.disableKeyboard().disableMouse().disableGamepad();
  }

  // ========================================================================
  // Stick Mode Configuration
  // ========================================================================

  /**
   * Set the left stick processing mode.
   * @param mode - 'analog' for raw values, 'cardinal4' for 4-way direction with diagonal rejection
   * @param config - Optional deadzone and diagonal threshold settings
   * @returns this for chaining
   */
  setLeftStickMode(
    mode: StickMode,
    config?: Partial<Omit<StickConfig, 'mode'>>
  ): this {
    this.leftStickConfig = {
      mode,
      deadzone: config?.deadzone ?? 0.3,
      diagonalThreshold: config?.diagonalThreshold ?? 0.3,
    };
    return this;
  }

  /**
   * Set the right stick processing mode.
   * @param mode - 'analog' for raw values, 'cardinal4' for 4-way direction with diagonal rejection
   * @param config - Optional deadzone and diagonal threshold settings
   * @returns this for chaining
   */
  setRightStickMode(
    mode: StickMode,
    config?: Partial<Omit<StickConfig, 'mode'>>
  ): this {
    this.rightStickConfig = {
      mode,
      deadzone: config?.deadzone ?? 0.3,
      diagonalThreshold: config?.diagonalThreshold ?? 0.3,
    };
    return this;
  }

  /**
   * Process analog stick values to a cardinal Direction.
   * Applies deadzone and diagonal rejection based on config.
   */
  private processStickToCardinal(
    x: number,
    y: number,
    config: StickConfig
  ): Direction {
    if (config.mode === 'analog') return Direction.NONE;

    const deadzone = config.deadzone ?? 0.3;
    const diagThreshold = config.diagonalThreshold ?? 0.3;

    const absX = Math.abs(x);
    const absY = Math.abs(y);
    const dominant = Math.max(absX, absY);
    const minor = Math.min(absX, absY);

    // Must exceed deadzone
    if (dominant <= deadzone) return Direction.NONE;

    // Reject diagonals: minor must be less than (1 - threshold) of dominant
    if (minor / dominant >= 1 - diagThreshold) return Direction.NONE;

    // Return cardinal direction
    if (absY > absX) {
      return y < 0 ? Direction.UP : Direction.DOWN;
    } else {
      return x < 0 ? Direction.LEFT : Direction.RIGHT;
    }
  }

  /**
   * Get processed twin-stick input (movement from left stick, shooting from right stick).
   * Both sticks must be configured with 'cardinal4' mode for this to work properly.
   * @returns Object with moveDir and shootDir as cardinal Directions
   */
  getTwinStickInput(): { moveDir: Direction; shootDir: Direction } {
    return {
      moveDir: this.state.gamepad.direction,
      shootDir: this.state.gamepad.rightDirection,
    };
  }

  /**
   * Enable input buffering for low-framerate games.
   * Automatically captures and queues directional inputs between polls.
   *
   * @param enabled - Whether to enable buffering (default: true)
   * @returns This InputManager for chaining
   */
  enableBuffering(enabled: boolean = true): this {
    this.bufferEnabled = enabled;

    // Clear any stale buffered input when toggling modes
    this.directionBufferInternal.length = 0;
    this.actionBuffer = false;

    return this;
  }

  /**
   * Get Direction from a keyboard key.
   * Returns null if the key is not a direction key.
   */
  private getDirectionFromKey(key: string): Direction | null {
    switch (key) {
      case 'ArrowUp':
      case 'w':
        return Direction.UP;
      case 'ArrowDown':
      case 's':
        return Direction.DOWN;
      case 'ArrowLeft':
      case 'a':
        return Direction.LEFT;
      case 'ArrowRight':
      case 'd':
        return Direction.RIGHT;
      default:
        return null;
    }
  }

  // ========================================================================
  // Event Listeners Setup and Cleanup
  // ========================================================================

  private setupListeners(): void {
    // Keyboard - always attach to document for global keyboard capture
    // Container-based keyboard events don't work well for games
    this.boundKeyDown = (e: KeyboardEvent) => {
      // Prevent default for game keys FIRST (regardless of enabled state)
      // This prevents arrow keys from scrolling the page
      if (this.isGameKey(e.key)) {
        e.preventDefault();
      }

      // Only process input if keyboard is enabled
      if (!this.keyboardEnabled) return;

      // TAP MODE: Only process initial keypress, ignore held keys
      if (this.config.directionMode === 'tap' && e.repeat) {
        return; // Ignore repeated events from holding key
      }

      // Track held keys for continuous movement/actions
      this.keysDown.add(e.key);

      // Only process initial press (not OS repeats) for one-shot actions
      if (!e.repeat) {
        this.keysJustPressed.add(e.key);

        // Buffer directional inputs for low-framerate games
        if (this.bufferEnabled) {
          const directionKey = this.getDirectionFromKey(e.key);
          if (directionKey !== Direction.NONE && directionKey !== null) {
            this.directionBufferInternal.push(directionKey);
          }

          // Buffer action inputs
          if (e.key === ' ' || e.key === 'Enter') {
            this.actionBuffer = true;
          }
        }

        // Treat Enter as a one-shot "action" press to avoid OS repeats
        // Space can be held for continuous actions
        if (e.key === 'Enter') {
          this.actionKeyPressed = true;
        }
      }

      // Update state immediately
      this.updateStateFromEvents();
    };

    this.boundKeyUp = (e: KeyboardEvent) => {
      // Always clear key state, even if disabled
      this.keysDown.delete(e.key);

      // Only update state if keyboard is enabled
      if (this.keyboardEnabled) {
        this.updateStateFromEvents();
      }
    };

    document.addEventListener('keydown', this.boundKeyDown);
    document.addEventListener('keyup', this.boundKeyUp);

    // Mouse - attach to canvas if available
    if (this.canvas) {
      this.boundMouseDown = (e: MouseEvent) => {
        if (!this.mouseEnabled) return;
        if (e.button === 0) {
          this.mouseDown = true;
          this.mouseClicked = true;
        } else if (e.button === 2) {
          this.mouseRightDown = true;
        }
        this.updateStateFromEvents();
      };

      this.boundMouseUp = (e: MouseEvent) => {
        if (e.button === 0) {
          this.mouseDown = false;
        } else if (e.button === 2) {
          this.mouseRightDown = false;
        }
        this.updateStateFromEvents();
      };

      this.boundMouseMove = (e: MouseEvent) => {
        if (!this.mouseEnabled) return;
        const rect = this.canvas!.getBoundingClientRect();
        // Account for CSS scaling: convert from display size to canvas internal resolution
        const scaleX = this.canvas!.width / rect.width;
        const scaleY = this.canvas!.height / rect.height;
        this.mouseX = (e.clientX - rect.left) * scaleX;
        this.mouseY = (e.clientY - rect.top) * scaleY;
        this.updateStateFromEvents();
      };

      this.boundContextMenu = (e: Event) => {
        if (this.mouseEnabled) e.preventDefault();
      };

      this.boundWheel = (e: WheelEvent) => {
        if (!this.mouseEnabled) return;
        this.mouseWheelDeltaX += e.deltaX;
        this.mouseWheelDeltaY += e.deltaY;
        this.updateStateFromEvents();
        e.preventDefault();
      };

      this.canvas.addEventListener('mousedown', this.boundMouseDown);
      window.addEventListener('mouseup', this.boundMouseUp); // Attach to window to catch releases outside canvas
      this.canvas.addEventListener('mousemove', this.boundMouseMove);
      this.canvas.addEventListener('contextmenu', this.boundContextMenu);
      this.canvas.addEventListener('wheel', this.boundWheel);
    }

    // Gamepad - use window events for connect/disconnect
    this.boundGamepadConnected = (e: GamepadEvent) => {
      console.log('[InputManager] Gamepad connected:', e.gamepad.id);
    };

    this.boundGamepadDisconnected = (e: GamepadEvent) => {
      console.log('[InputManager] Gamepad disconnected:', e.gamepad.id);
    };

    window.addEventListener('gamepadconnected', this.boundGamepadConnected);
    window.addEventListener(
      'gamepaddisconnected',
      this.boundGamepadDisconnected
    );
  }

  /**
   * Destroy the input manager and cleanup all event listeners.
   * MUST be called when the input manager is no longer needed to prevent memory leaks.
   */
  destroy(): void {
    // Clean up keyboard listeners
    if (this.boundKeyDown) {
      document.removeEventListener('keydown', this.boundKeyDown);
      this.boundKeyDown = null;
    }
    if (this.boundKeyUp) {
      document.removeEventListener('keyup', this.boundKeyUp);
      this.boundKeyUp = null;
    }

    // Clean up mouse listeners
    if (this.canvas) {
      if (this.boundMouseDown) {
        this.canvas.removeEventListener('mousedown', this.boundMouseDown);
        this.boundMouseDown = null;
      }
      if (this.boundMouseMove) {
        this.canvas.removeEventListener('mousemove', this.boundMouseMove);
        this.boundMouseMove = null;
      }
      if (this.boundContextMenu) {
        this.canvas.removeEventListener('contextmenu', this.boundContextMenu);
        this.boundContextMenu = null;
      }
      if (this.boundWheel) {
        this.canvas.removeEventListener('wheel', this.boundWheel);
        this.boundWheel = null;
      }
    }

    // Clean up mouseup from window
    if (this.boundMouseUp) {
      window.removeEventListener('mouseup', this.boundMouseUp);
      this.boundMouseUp = null;
    }

    // Clean up gamepad listeners
    if (this.boundGamepadConnected) {
      window.removeEventListener(
        'gamepadconnected',
        this.boundGamepadConnected
      );
      this.boundGamepadConnected = null;
    }
    if (this.boundGamepadDisconnected) {
      window.removeEventListener(
        'gamepaddisconnected',
        this.boundGamepadDisconnected
      );
      this.boundGamepadDisconnected = null;
    }

    // Stop gamepad polling
    if (this.gamepadPollInterval !== null) {
      clearInterval(this.gamepadPollInterval);
      this.gamepadPollInterval = null;
    }

    // Clear all state
    this.keysDown.clear();
    this.keysJustPressed.clear();
    this.directionBufferInternal.length = 0;
    this.actionBuffer = false;
    this.bufferedDirection = Direction.NONE;
    this.bufferedTimestamp = 0;
    this.state = this.createEmptyState();
  }

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
    ];
    return gameKeys.includes(key);
  }

  // ========================================================================
  // State Management (Event-Driven)
  // ========================================================================

  /**
   * Get current input state.
   * State is continuously updated by event listeners, so this always returns current state.
   *
   * @returns Current InputState with all input information
   *
   * @example
   * ```typescript
   * // In game loop
   * function tick() {
   *   const input = inputManager.getState();
   *
   *   if (input.direction !== Direction.NONE) {
   *     player.move(input.direction);
   *   }
   *
   *   if (input.action) {
   *     player.attack();
   *   }
   * }
   * ```
   */
  getState(): InputState {
    // First, ensure the current state is up-to-date before we copy it.
    // This is crucial for tap mode, which relies on `keysJustPressed`.
    // Pass true to consume from buffer (only getState() should drain buffer)
    this.updateStateFromEvents(true);

    // Create a copy of the fully updated state to return to the caller.
    // IMPORTANT: clone nested objects so subsequent internal clears do not
    // mutate the returned snapshot.
    const result: InputState = {
      ...this.state,
      mouse: { ...this.state.mouse },
      gamepad: { ...this.state.gamepad },
      keys: new Set(this.state.keys),
    };

    // Now, clear the one-shot events from the internal state for the next frame.
    this.mouseClicked = false;
    this.mouseWheelDeltaX = 0;
    this.mouseWheelDeltaY = 0;
    this.keysJustPressed.clear();
    this.actionKeyPressed = false;

    // Update the internal state object to reflect these cleared values.
    this.state.mouse.clicked = false;
    this.state.mouse.wheelDeltaX = 0;
    this.state.mouse.wheelDeltaY = 0;

    return result;
  }

  /**
   * Update state from event-captured data.
   * Called automatically by event handlers and when getState() is called.
   *
   * @param consumeBuffer - Whether to consume from the buffer (default: false)
   */
  private updateStateFromEvents(consumeBuffer: boolean = false): void {
    // PRIORITY 1: Check buffer first (ensures quick taps aren't dropped)
    // BUT: Only consume buffer when explicitly requested (from getState())
    if (
      consumeBuffer &&
      this.bufferEnabled &&
      this.directionBufferInternal.length > 0
    ) {
      this.state.direction = this.directionBufferInternal.shift()!;
    } else {
      // PRIORITY 2: Fall back to currently held keys
      this.state.direction = this.getCurrentDirection();
    }

    // Shoot direction (WASD for twin-stick shooters)
    // Check both keysDown AND keysJustPressed to capture quick taps
    // This must be consistent with getCurrentDirection() to avoid movement bugs
    this.state.shootDirection = this.getWasdDirection();

    // Action from held keys or buffer
    // Only consume buffer when explicitly requested (from getState())
    const bufferedAction = consumeBuffer ? this.actionBuffer : false;
    this.state.action =
      this.keysDown.has(' ') || this.actionKeyPressed || bufferedAction;

    // Clear consumed action buffer only when explicitly consuming
    if (consumeBuffer && this.actionBuffer) {
      this.actionBuffer = false;
    }

    // Other buttons
    this.state.start = this.keysJustPressed.has('Enter');
    this.state.restart =
      this.keysJustPressed.has('r') || this.keysJustPressed.has('R');

    // Secondary action
    this.state.secondary = this.mouseRightDown || this.state.gamepad.secondary;

    // Mouse state
    const cellTotal = this.config.cellSize! + this.config.cellGap!;
    this.state.mouse.canvasX = this.mouseX;
    this.state.mouse.canvasY = this.mouseY;
    this.state.mouse.x = Math.floor(this.mouseX / cellTotal);
    this.state.mouse.y = Math.floor(this.mouseY / cellTotal);
    this.state.mouse.down = this.mouseDown;
    this.state.mouse.clicked = this.mouseClicked;
    this.state.mouse.rightDown = this.mouseRightDown;
    this.state.mouse.wheelDeltaX = this.mouseWheelDeltaX;
    this.state.mouse.wheelDeltaY = this.mouseWheelDeltaY;

    // Mouse click also triggers action
    if (this.mouseClicked) {
      this.state.action = true;
    }

    // Raw keys
    this.state.keys = new Set(this.keysDown);

    // Legacy input buffering: Cache direction inputs for smoother controls
    if (this.config.bufferInput) {
      const now = Date.now();

      // Update buffer if we have a new direction input
      if (this.state.direction !== Direction.NONE) {
        this.bufferedDirection = this.state.direction;
        this.bufferedTimestamp = now;
      }

      // Expire old buffered input
      const age = now - this.bufferedTimestamp;
      if (age > this.config.bufferTimeMs!) {
        this.bufferedDirection = Direction.NONE;
      }
    }
  }

  /**
   * Get current direction from held keys OR just-pressed keys.
   * This ensures we don't drop quick taps that happen between ticks.
   */
  private getCurrentDirection(): Direction {
    // In TAP MODE: Only check keysJustPressed, ignore whether key is still held
    // This captures quick taps that are released before getState() is called
    if (this.config.directionMode === 'tap') {
      for (const key of this.keysJustPressed) {
        const dir = this.getDirectionFromKey(key);
        if (dir !== Direction.NONE && dir !== null) {
          return dir;
        }
      }
      return Direction.NONE;
    }

    // CONTINUOUS MODE: Check both just-pressed and held keys
    // First check if any direction key was JUST pressed
    for (const key of this.keysJustPressed) {
      const dir = this.getDirectionFromKey(key);
      if (dir !== Direction.NONE && dir !== null) {
        // Only use just-pressed key if it's still held down
        if (this.keysDown.has(key)) {
          return dir;
        }
      }
    }

    // Fall back to currently held keys
    // Arrow keys take priority
    if (this.keysDown.has('ArrowUp')) return Direction.UP;
    if (this.keysDown.has('ArrowDown')) return Direction.DOWN;
    if (this.keysDown.has('ArrowLeft')) return Direction.LEFT;
    if (this.keysDown.has('ArrowRight')) return Direction.RIGHT;
    // WASD
    if (this.keysDown.has('w') || this.keysDown.has('W')) return Direction.UP;
    if (this.keysDown.has('s') || this.keysDown.has('S')) return Direction.DOWN;
    if (this.keysDown.has('a') || this.keysDown.has('A')) return Direction.LEFT;
    if (this.keysDown.has('d') || this.keysDown.has('D'))
      return Direction.RIGHT;
    return Direction.NONE;
  }

  /**
   * Get WASD direction from both keysDown AND keysJustPressed.
   * This must be consistent with getCurrentDirection() to avoid movement bugs
   * where a quick WASD tap gets captured by direction but not shootDirection.
   */
  private getWasdDirection(): Direction {
    // Check keysJustPressed first (for quick taps) with deterministic priority
    if (this.keysJustPressed.has('w') || this.keysJustPressed.has('W')) return Direction.UP;
    if (this.keysJustPressed.has('s') || this.keysJustPressed.has('S')) return Direction.DOWN;
    if (this.keysJustPressed.has('a') || this.keysJustPressed.has('A')) return Direction.LEFT;
    if (this.keysJustPressed.has('d') || this.keysJustPressed.has('D')) return Direction.RIGHT;

    // Fall back to keysDown (for held keys)
    if (this.keysDown.has('w') || this.keysDown.has('W')) return Direction.UP;
    if (this.keysDown.has('s') || this.keysDown.has('S')) return Direction.DOWN;
    if (this.keysDown.has('a') || this.keysDown.has('A')) return Direction.LEFT;
    if (this.keysDown.has('d') || this.keysDown.has('D')) return Direction.RIGHT;
    return Direction.NONE;
  }

  /**
   * Update gamepad state from Gamepad API.
   * Called periodically when gamepad is enabled (Gamepad API requires polling).
   */
  private updateGamepadState(): void {
    if (!this.gamepadEnabled) return;

    const gamepads = navigator.getGamepads();
    const gp = gamepads[0] ?? gamepads[1] ?? gamepads[2] ?? gamepads[3];

    if (!gp) {
      // No gamepad connected - reset state
      this.state.gamepad = {
        direction: Direction.NONE,
        rightDirection: Direction.NONE,
        action: false,
        secondary: false,
        start: false,
        stickX: 0,
        stickY: 0,
        rightStickX: 0,
        rightStickY: 0,
      };
      return;
    }

    // D-pad (buttons 12-15)
    if (gp.buttons[12]?.pressed) this.state.gamepad.direction = Direction.UP;
    else if (gp.buttons[13]?.pressed)
      this.state.gamepad.direction = Direction.DOWN;
    else if (gp.buttons[14]?.pressed)
      this.state.gamepad.direction = Direction.LEFT;
    else if (gp.buttons[15]?.pressed)
      this.state.gamepad.direction = Direction.RIGHT;
    else this.state.gamepad.direction = Direction.NONE;

    // Left stick (movement)
    const stickX = gp.axes[0] ?? 0;
    const stickY = gp.axes[1] ?? 0;
    this.state.gamepad.stickX = stickX;
    this.state.gamepad.stickY = stickY;

    // Right stick (aiming)
    const rightStickX = gp.axes[2] ?? 0;
    const rightStickY = gp.axes[3] ?? 0;
    this.state.gamepad.rightStickX = rightStickX;
    this.state.gamepad.rightStickY = rightStickY;

    // Process left stick to direction if no d-pad
    if (this.state.gamepad.direction === Direction.NONE) {
      this.state.gamepad.direction = this.processStickToCardinal(
        stickX,
        stickY,
        this.leftStickConfig
      );
    }

    // Process right stick to direction
    this.state.gamepad.rightDirection = this.processStickToCardinal(
      rightStickX,
      rightStickY,
      this.rightStickConfig
    );

    // Buttons (standard mapping)
    this.state.gamepad.action = gp.buttons[0]?.pressed ?? false; // A
    this.state.gamepad.secondary = gp.buttons[1]?.pressed ?? false; // B
    this.state.gamepad.start = gp.buttons[9]?.pressed ?? false; // Start

    // Gamepad buttons also trigger main state
    if (this.state.gamepad.action) this.state.action = true;
    if (this.state.gamepad.secondary) this.state.secondary = true;
    if (this.state.gamepad.start) this.state.start = true;

    // Merge gamepad direction into main direction if keyboard not active
    if (this.state.direction === Direction.NONE) {
      this.state.direction = this.state.gamepad.direction;
    }
  }

  // ========================================================================
  // Convenience Getters
  // ========================================================================

  get directionBuffer(): Direction[] {
    return this.directionBufferInternal;
  }

  get keysHeld(): Set<string> {
    return this.keysDown;
  }

  get direction(): Direction {
    return this.state.direction;
  }
  get action(): boolean {
    return this.state.action;
  }
  get secondary(): boolean {
    return this.state.secondary;
  }
  get start(): boolean {
    return this.state.start;
  }
  get restart(): boolean {
    return this.state.restart;
  }
  get shootDirection(): Direction {
    return this.state.shootDirection;
  }
  get mouse(): MouseState {
    return this.state.mouse;
  }
  get gamepad(): GamepadState {
    return this.state.gamepad;
  }
  get keys(): Set<string> {
    return this.state.keys;
  }

  /** Check if a specific key is down */
  isKeyDown(key: string): boolean {
    return this.keysDown.has(key);
  }

  /** Check if a key was just pressed this frame */
  wasKeyPressed(key: string): boolean {
    return this.keysJustPressed.has(key);
  }

  // ========================================================================
  // Input Buffering
  // ========================================================================

  /**
   * Get the buffered direction input.
   *
   * When input buffering is enabled, this returns the most recent direction
   * input that hasn't expired yet. Useful for "sticky" controls where you
   * want the player's input to persist until it can be executed (e.g.,
   * turning around a corner in Pac-Man).
   *
   * @returns Buffered Direction, or Direction.NONE if no buffered input
   *
   * @example
   * ```typescript
   * // Try buffered direction first (for corner turning)
   * const buffered = input.getBufferedDirection();
   * if (buffered !== Direction.NONE && canMove(buffered)) {
   *   move(buffered);
   *   input.clearBufferedDirection(); // Clear after successful use
   * } else if (input.direction !== Direction.NONE) {
   *   // Fall back to current direction
   *   move(input.direction);
   * }
   * ```
   */
  getBufferedDirection(): Direction {
    if (!this.config.bufferInput) return Direction.NONE;

    const now = Date.now();
    const age = now - this.bufferedTimestamp;

    // Check if buffer has expired
    if (age > this.config.bufferTimeMs!) {
      return Direction.NONE;
    }

    return this.bufferedDirection;
  }

  /**
   * Clear the buffered direction input.
   *
   * Call this after successfully executing a buffered input to prevent
   * it from being used again.
   *
   * @example
   * ```typescript
   * const buffered = input.getBufferedDirection();
   * if (buffered !== Direction.NONE && tryTurn(buffered)) {
   *   input.clearBufferedDirection(); // Successfully turned!
   * }
   * ```
   */
  clearBufferedDirection(): void {
    this.bufferedDirection = Direction.NONE;
    this.bufferedTimestamp = 0;
  }

  /**
   * Check if there is a valid buffered direction available.
   *
   * @returns true if there is a non-expired buffered direction
   */
  hasBufferedDirection(): boolean {
    return this.getBufferedDirection() !== Direction.NONE;
  }

  // ========================================================================
  // Programmatic Input (for testing)
  // ========================================================================

  /**
   * Inject input programmatically for testing purposes.
   *
   * Simulates user input without requiring DOM events by manipulating
   * internal key state. The injected input will be picked up by getState().
   * Useful for headless testing and automated tests.
   *
   * Note: Automatically enables keyboard input for programmatic injection.
   *
   * @param direction - Direction to inject (default: Direction.NONE)
   * @param action - Action button state (default: false)
   * @param secondary - Secondary button state (default: false)
   *
   * @example
   * ```typescript
   * // Simulate pressing right arrow
   * inputManager.injectInput(Direction.RIGHT);
   *
   * // Simulate pressing action button
   * inputManager.injectInput(Direction.NONE, true);
   *
   * // Get the injected state
   * const state = inputManager.getState();
   * expect(state.direction).toBe(Direction.RIGHT);
   * ```
   */
  injectInput(
    direction: Direction = Direction.NONE,
    action: boolean = false,
    secondary: boolean = false
  ): void {
    // Enable keyboard so getState() will read the injected keys
    if (!this.keyboardEnabled) {
      this.keyboardEnabled = true;
    }

    // Clear existing keys
    this.keysDown.clear();

    // Simulate key presses based on direction
    switch (direction) {
      case Direction.UP:
        this.keysDown.add('ArrowUp');
        break;
      case Direction.DOWN:
        this.keysDown.add('ArrowDown');
        break;
      case Direction.LEFT:
        this.keysDown.add('ArrowLeft');
        break;
      case Direction.RIGHT:
        this.keysDown.add('ArrowRight');
        break;
    }

    // Simulate action keys
    if (action) {
      this.keysDown.add(' ');
    }
    if (secondary) {
      this.keysDown.add('Shift');
    }

    // Also update buffer if enabled
    if (this.bufferEnabled && direction !== Direction.NONE) {
      this.directionBufferInternal.push(direction);
    }

    // Update state from injected input
    this.updateStateFromEvents();
  }
}
