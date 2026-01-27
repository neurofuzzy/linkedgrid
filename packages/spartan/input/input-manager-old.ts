/**
 * InputManager - Unified input system for keyboard, mouse, and gamepad.
 * 
 * Provides a single polling-based input state that games can read each frame/tick.
 * Handles:
 * - Keyboard (WASD, arrows, space, enter, R)
 * - Mouse (position in grid coords, buttons)
 * - Gamepad (D-pad, analog sticks, buttons)
 * 
 * **Pattern**: Call `poll()` once per frame to get current InputState.
 * All inputs are unified into a single state object.
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
 * const input = new InputManager(canvas, { cellSize: 32, cellGap: 2 });
 * input.enableKeyboard().enableMouse().enableGamepad();
 * 
 * // In game loop
 * function tick() {
 *   const state = input.poll();
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
 * ```
 * 
 * @example
 * ```typescript
 * // Twin-stick shooter
 * const state = input.poll();
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

import { Direction } from '../../grid/direction';

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
    private canvas: HTMLCanvasElement;
    private config: InputConfig;

    // Enable flags
    private keyboardEnabled = false;
    private mouseEnabled = false;
    private gamepadEnabled = false;

    // Raw input state
    private keysDown = new Set<string>();
    private keysJustPressed = new Set<string>();
    private actionKeyPressed = false; // True when Space/Enter keydown fires, consumed on poll()
    private mouseDown = false;
    private mouseRightDown = false;
    private mouseClicked = false;
    private mouseX = 0;
    private mouseY = 0;
    private mouseWheelDeltaX = 0;
    private mouseWheelDeltaY = 0;

    // Gamepad dead zone
    private deadZone = 0.3;

    // Stick mode configurations
    private leftStickConfig: StickConfig = { mode: 'analog', deadzone: 0.3, diagonalThreshold: 0.3 };
    private rightStickConfig: StickConfig = { mode: 'analog', deadzone: 0.3, diagonalThreshold: 0.3 };

    // Input buffering for low-framerate games (automatic for games with tickMs > 50)
    private directionBuffer: Direction[] = [];
    private actionBuffer: boolean = false;
    private bufferEnabled: boolean = false;

    // Input buffering for smooth controls (legacy)
    private bufferedDirection: Direction = Direction.NONE;
    private bufferedTimestamp: number = 0;

    // Current input state (updated by poll())
    private state: InputState;

    /**
     * Create a new InputManager.
     * 
     * Automatically sets up event listeners for all input types.
     * Call enable* methods to activate specific input types.
     * 
     * @param canvas - Canvas element for mouse coordinate conversion
     * @param config - Configuration for cell size and gap
     * 
     * @example
     * ```typescript
     * const input = new InputManager(canvas, { cellSize: 32, cellGap: 2 });
     * input.enableKeyboard().enableMouse();
     * ```
     */
    constructor(canvas: HTMLCanvasElement, config: InputConfig = {}) {
        this.canvas = canvas;
        this.config = {
            cellSize: config.cellSize ?? 16,
            cellGap: config.cellGap ?? 2,
            bufferInput: config.bufferInput ?? false,
            bufferTimeMs: config.bufferTimeMs ?? 200,
        };

        this.state = this.createEmptyState();
        this.setupListeners();
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
                x: 0, y: 0,
                canvasX: 0, canvasY: 0,
                down: false, clicked: false, rightDown: false,
                wheelDeltaX: 0, wheelDeltaY: 0
            },
            gamepad: {
                direction: Direction.NONE,
                rightDirection: Direction.NONE,
                action: false, secondary: false, start: false,
                stickX: 0, stickY: 0,
                rightStickX: 0, rightStickY: 0
            },
            keys: new Set()
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
            ...config
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
     * @returns this for chaining
     */
    enableGamepad(): this {
        this.gamepadEnabled = true;
        return this;
    }

    /**
     * Disable gamepad input.
     * @returns this for chaining
     */
    disableGamepad(): this {
        this.gamepadEnabled = false;
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
    setLeftStickMode(mode: StickMode, config?: Partial<Omit<StickConfig, 'mode'>>): this {
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
    setRightStickMode(mode: StickMode, config?: Partial<Omit<StickConfig, 'mode'>>): this {
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
    private processStickToCardinal(x: number, y: number, config: StickConfig): Direction {
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
        if (minor / dominant >= (1 - diagThreshold)) return Direction.NONE;

        // Return cardinal direction
        if (absY > absX) {
            return y < 0 ? Direction.UP : Direction.DN;
        } else {
            return x < 0 ? Direction.LT : Direction.RT;
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
        this.directionBuffer.length = 0;
        this.actionBuffer = false;
        
        return this;
    }

    /**
     * Get Direction from a keyboard key.
     * Returns null if the key is not a direction key.
     */
    private getDirectionFromKey(key: string): Direction | null {
        switch (key) {
            case 'ArrowUp': return Direction.UP;
            case 'ArrowDown': return Direction.DN;
            case 'ArrowLeft': return Direction.LT;
            case 'ArrowRight': return Direction.RT;
            default: return null;
        }
    }

    // ========================================================================
    // Event Listeners
    // ========================================================================

    private setupListeners(): void {
        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (!this.keyboardEnabled) return;
            
            // Always track held keys for continuous movement/actions
            this.keysDown.add(e.key);
            
            // Only process initial press (not OS repeats) for one-shot actions
            if (!e.repeat) {
                this.keysJustPressed.add(e.key);
                
                // Buffer directional inputs for low-framerate games
                if (this.bufferEnabled) {
                    const directionKey = this.getDirectionFromKey(e.key);
                    if (directionKey !== Direction.NONE && directionKey !== null) {
                        this.directionBuffer.push(directionKey);
                    }
                    
                    // Buffer action inputs
                    if (e.key === ' ' || e.key === 'Enter') {
                        this.actionBuffer = true;
                    }
                }
                
                // Treat Enter as a one-shot "action" press to avoid OS repeats
                // Space can be held for continuous actions (handled in pollKeyboard)
                if (e.key === 'Enter') {
                    this.actionKeyPressed = true;
                }
            }

            // Prevent default for game keys
            if (this.isGameKey(e.key)) {
                e.preventDefault();
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keysDown.delete(e.key);
        });

        // Mouse
        this.canvas.addEventListener('mousedown', (e) => {
            if (!this.mouseEnabled) return;
            if (e.button === 0) {
                this.mouseDown = true;
                this.mouseClicked = true;
            } else if (e.button === 2) {
                this.mouseRightDown = true;
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.mouseDown = false;
            } else if (e.button === 2) {
                this.mouseRightDown = false;
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.mouseEnabled) return;
            const rect = this.canvas.getBoundingClientRect();
            // Account for CSS scaling: convert from display size to canvas internal resolution
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            this.mouseX = (e.clientX - rect.left) * scaleX;
            this.mouseY = (e.clientY - rect.top) * scaleY;
        });

        // Prevent context menu on canvas
        this.canvas.addEventListener('contextmenu', (e) => {
            if (this.mouseEnabled) e.preventDefault();
        });

        // Mouse wheel
        this.canvas.addEventListener('wheel', (e) => {
            if (!this.mouseEnabled) return;
            this.mouseWheelDeltaX += e.deltaX;
            this.mouseWheelDeltaY += e.deltaY;
            e.preventDefault();
        });
    }

    private isGameKey(key: string): boolean {
        const gameKeys = [
            'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
            'w', 'W', 'a', 'A', 's', 'S', 'd', 'D',
            ' ', 'Enter', 'r', 'R'
        ];
        return gameKeys.includes(key);
    }

    // ========================================================================
    // Polling
    // ========================================================================

    /**
     * Poll all input sources and return current InputState.
     * 
     * Call once per frame/tick before reading input state.
     * Processes keyboard, mouse, and gamepad inputs into unified state.
     * 
     * **Frame-based state**: Some states are cleared after poll (clicked, just pressed keys).
     * 
     * **Priority**: Keyboard direction overrides gamepad direction if both active.
     * 
     * **Input Buffering**: When enabled, caches the last direction input for smooth
     * corner turning and responsive controls. The buffered direction persists until
     * it expires (based on bufferTimeMs config).
     * 
     * @returns Current InputState with all input information
     * 
     * @example
     * ```typescript
     * // In game loop
     * function tick() {
     *   const input = inputManager.poll();
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
     * 
     * @example
     * ```typescript
     * // Enable input buffering for smoother controls (e.g., Pac-Man style games)
     * const input = new InputManager(canvas, { 
     *   bufferInput: true, 
     *   bufferTimeMs: 200 
     * });
     * ```
     */
    poll(): InputState {
        this.state = this.createEmptyState();

        if (this.keyboardEnabled) {
            this.pollKeyboard();
        }

        if (this.mouseEnabled) {
            this.pollMouse();
        }

        if (this.gamepadEnabled) {
            this.pollGamepad();
        }

        // Merge directions (keyboard takes priority, then gamepad)
        if (this.state.direction === Direction.NONE) {
            this.state.direction = this.state.gamepad.direction;
        }

        // New input buffering: Consume buffered inputs for low-framerate games
        if (this.bufferEnabled) {
            // Clear buffered directions that match currently held keys (prevents duplicates)
            if (this.state.direction !== Direction.NONE) {
                // Remove any buffered inputs that match the current held direction
                this.directionBuffer = this.directionBuffer.filter(d => d !== this.state.direction);
            }
            
            // If we have buffered directions and no current input, use the oldest one (FIFO)
            if (this.directionBuffer.length > 0 && this.state.direction === Direction.NONE) {
                this.state.direction = this.directionBuffer.shift()!;
            }
            
            // If we have a buffered action, apply it (or clear it if action is already active)
            if (this.actionBuffer) {
                if (!this.state.action) {
                    this.state.action = true;
                }
                this.actionBuffer = false;  // Always clear to prevent leaking
            }
        }

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

        // Clear frame-based states
        this.keysJustPressed.clear();
        this.actionKeyPressed = false; // Consume action keydown event
        this.mouseClicked = false;
        this.mouseWheelDeltaX = 0;
        this.mouseWheelDeltaY = 0;

        return this.state;
    }

    private pollKeyboard(): void {
        // Direction (arrow keys OR WASD)
        // Arrow keys take priority for backwards compatibility
        if (this.keysDown.has('ArrowUp')) this.state.direction = Direction.UP;
        else if (this.keysDown.has('ArrowDown')) this.state.direction = Direction.DN;
        else if (this.keysDown.has('ArrowLeft')) this.state.direction = Direction.LT;
        else if (this.keysDown.has('ArrowRight')) this.state.direction = Direction.RT;
        // WASD also sets direction for movement (if no arrow keys pressed)
        else if (this.keysDown.has('w') || this.keysDown.has('W')) this.state.direction = Direction.UP;
        else if (this.keysDown.has('s') || this.keysDown.has('S')) this.state.direction = Direction.DN;
        else if (this.keysDown.has('a') || this.keysDown.has('A')) this.state.direction = Direction.LT;
        else if (this.keysDown.has('d') || this.keysDown.has('D')) this.state.direction = Direction.RT;

        // Shoot direction (WASD for twin-stick shooters)
        // Also set shootDirection so twin-stick games can use WASD for aiming
        if (this.keysDown.has('w') || this.keysDown.has('W')) {
            this.state.shootDirection = Direction.UP;
        } else if (this.keysDown.has('s') || this.keysDown.has('S')) {
            this.state.shootDirection = Direction.DN;
        } else if (this.keysDown.has('a') || this.keysDown.has('A')) {
            this.state.shootDirection = Direction.LT;
        } else if (this.keysDown.has('d') || this.keysDown.has('D')) {
            this.state.shootDirection = Direction.RT;
        }

        // Buttons (Enter is edge-triggered; Space can be held for continuous actions)
        this.state.action = this.actionKeyPressed || this.keysDown.has(' ');
        this.state.start = this.keysJustPressed.has('Enter');
        this.state.restart = this.keysJustPressed.has('r') || this.keysJustPressed.has('R');

        // Raw keys
        this.state.keys = new Set(this.keysDown);
    }

    private pollMouse(): void {
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

        // Mouse click (edge-triggered, not hold)
        if (this.mouseClicked) {
            this.state.action = true;
        }
    }

    private pollGamepad(): void {
        const gamepads = navigator.getGamepads();
        const gp = gamepads[0] ?? gamepads[1] ?? gamepads[2] ?? gamepads[3];

        if (!gp) return;

        // D-pad (buttons 12-15)
        if (gp.buttons[12]?.pressed) this.state.gamepad.direction = Direction.UP;
        else if (gp.buttons[13]?.pressed) this.state.gamepad.direction = Direction.DN;
        else if (gp.buttons[14]?.pressed) this.state.gamepad.direction = Direction.LT;
        else if (gp.buttons[15]?.pressed) this.state.gamepad.direction = Direction.RT;

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
            this.state.gamepad.direction = this.processStickToCardinal(stickX, stickY, this.leftStickConfig);
        }

        // Process right stick to direction
        this.state.gamepad.rightDirection = this.processStickToCardinal(rightStickX, rightStickY, this.rightStickConfig);

        // Buttons (standard mapping)
        this.state.gamepad.action = gp.buttons[0]?.pressed ?? false;     // A
        this.state.gamepad.secondary = gp.buttons[1]?.pressed ?? false;  // B
        this.state.gamepad.start = gp.buttons[9]?.pressed ?? false;      // Start

        // Gamepad buttons also trigger state
        if (this.state.gamepad.action) this.state.action = true;
        if (this.state.gamepad.secondary) this.state.secondary = true;
        if (this.state.gamepad.start) this.state.start = true;
    }

    // ========================================================================
    // Convenience Getters
    // ========================================================================

    get direction(): Direction { return this.state.direction; }
    get action(): boolean { return this.state.action; }
    get secondary(): boolean { return this.state.secondary; }
    get start(): boolean { return this.state.start; }
    get restart(): boolean { return this.state.restart; }
    get shootDirection(): Direction { return this.state.shootDirection; }
    get mouse(): MouseState { return this.state.mouse; }
    get gamepad(): GamepadState { return this.state.gamepad; }
    get keys(): Set<string> { return this.state.keys; }

    /** Get the last polled state */
    getState(): InputState { return this.state; }

    /** Check if a specific key is down */
    isKeyDown(key: string): boolean { return this.keysDown.has(key); }

    /** Check if a key was just pressed this frame */
    wasKeyPressed(key: string): boolean { return this.keysJustPressed.has(key); }

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
}
