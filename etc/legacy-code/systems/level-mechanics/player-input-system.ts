import { System } from '@basegrid/ecs';
import { PlayerComponent } from '@basegrid/ecs';
import { InputCommandComponent } from '@basegrid/ecs';
import { Direction } from '@basegrid/grid';
import type { KeyboardInputManager, MouseManager, GamepadManager } from '@basegrid/engine';

/**
 * Player Input System - Bridges input managers to ECS InputCommandComponent.
 * 
 * This system polls the input managers once per frame and maps input to player
 * entities based on their control scheme. It populates InputCommandComponent
 * which other systems (movement, combat, etc.) can read.
 * 
 * **Architecture:**
 * - Input Managers (engine-level) → PlayerInputSystem → InputCommandComponent → Game Systems
 * - Keeps ECS systems pure and testable
 * - Enables multiplayer with different control schemes
 * - Allows AI/network to inject commands using same component
 * 
 * **Control Scheme Mapping:**
 * - `undefined` or `'keyboard'` - Uses keyboard input
 * - `'gamepad'` or `'gamepad0'` - Uses first gamepad
 * - `'gamepad1'`, `'gamepad2'`, etc. - Uses specific gamepad index
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const keyboard = new KeyboardInputManager();
 * const mouse = new MouseManager(canvas);
 * const gamepad = new GamepadManager();
 * 
 * const playerInputSystem = new PlayerInputSystem();
 * playerInputSystem.setInputManagers(keyboard, mouse, gamepad);
 * world.addSystem(playerInputSystem);
 * 
 * // Create player with input
 * const player = world.createEntity();
 * world.addComponent(player, PlayerComponent, { 
 *   playerIndex: 0,
 *   controlScheme: 'keyboard'
 * });
 * world.addComponent(player, InputCommandComponent, {
 *   direction: Direction.NONE,
 *   action: false,
 *   // ... other fields
 * });
 * 
 * // Each frame, PlayerInputSystem updates InputCommandComponent
 * world.update(dt);
 * ```
 */
export class PlayerInputSystem extends System {
  private keyboardInput: KeyboardInputManager | null = null;
  private mouseInput: MouseManager | null = null;
  private gamepadInput: GamepadManager | null = null;
  private lastActionState: Map<number, boolean> = new Map();

  constructor() {
    super();
  }

  /**
   * Set the input managers to use.
   * Called by GameRuntime after creating all managers.
   */
  setInputManagers(
    keyboard: KeyboardInputManager,
    mouse: MouseManager,
    gamepad: GamepadManager
  ): void {
    this.keyboardInput = keyboard;
    this.mouseInput = mouse;
    this.gamepadInput = gamepad;
  }

  update(_dt: number): void {
    if (!this.keyboardInput) return;
    
    // Get input states from all managers
    const keyboardState = this.keyboardInput.getState();
    const mouseState = this.mouseInput?.getState();
    const gamepadState = this.gamepadInput?.getState();
    
    // Map input to all player entities
    for (const [entity, player] of this.world.query(PlayerComponent)) {
      const cmd = this.world.getComponent(entity, InputCommandComponent);
      
      // Skip if entity doesn't have input command component
      if (!cmd) continue;
      
      // Skip if input is disabled for this entity
      if (!cmd.enabled) continue;

      // Determine which input source to use based on control scheme
      const scheme = player.controlScheme || 'keyboard';
      
      if (this.isKeyboardScheme(scheme)) {
        this.mapKeyboardInput(entity, cmd, keyboardState, mouseState);
      } else if (this.isGamepadScheme(scheme)) {
        const gamepadIndex = this.getGamepadIndex(scheme);
        this.mapGamepadInput(entity, cmd, gamepadState, gamepadIndex);
      }
    }
  }

  private isKeyboardScheme(scheme: string): boolean {
    return scheme === 'keyboard' || scheme === 'mouse' || scheme === 'kb';
  }

  private isGamepadScheme(scheme: string): boolean {
    return scheme.startsWith('gamepad') || scheme.startsWith('gp');
  }

  private getGamepadIndex(scheme: string): number {
    // Extract gamepad index from scheme string
    // 'gamepad' or 'gamepad0' -> 0
    // 'gamepad1' -> 1, etc.
    const match = scheme.match(/\d+$/);
    return match ? parseInt(match[0], 10) : 0;
  }

  private mapKeyboardInput(
    entity: number,
    cmd: InputCommandComponent,
    keyboardState: any,
    mouseState: any
  ): void {
    // Track action just pressed (edge detection)
    const wasActionDown = this.lastActionState.get(entity) ?? false;
    const isActionDown = keyboardState.action || (mouseState?.leftClicked ?? false);
    
    cmd.direction = keyboardState.direction;
    cmd.action = isActionDown;
    cmd.actionJustPressed = isActionDown && !wasActionDown;
    cmd.secondary = keyboardState.secondary;
    cmd.start = keyboardState.start;
    cmd.restart = keyboardState.restart;
    
    // No shoot direction in keyboard state (was for twin-stick)
    cmd.shootDirection = Direction.NONE;
    
    // Mouse (if available)
    if (mouseState) {
      cmd.mouseX = mouseState.gridX;
      cmd.mouseY = mouseState.gridY;
      cmd.mouseClicked = mouseState.leftClicked;
    } else {
      cmd.mouseX = 0;
      cmd.mouseY = 0;
      cmd.mouseClicked = false;
    }
    
    // No analog input from keyboard
    cmd.analogX = 0;
    cmd.analogY = 0;
    cmd.aimX = 0;
    cmd.aimY = 0;
    
    this.lastActionState.set(entity, isActionDown);
  }

  private mapGamepadInput(
    entity: number, 
    cmd: InputCommandComponent, 
    gamepadState: any, 
    _gamepadIndex: number
  ): void {
    if (!gamepadState || !gamepadState.connected) {
      // No gamepad connected, clear input
      cmd.direction = Direction.NONE;
      cmd.action = false;
      cmd.actionJustPressed = false;
      return;
    }
    
    // Track action just pressed (edge detection)
    const wasActionDown = this.lastActionState.get(entity) ?? false;
    const isActionDown = gamepadState.actionButton;
    
    // Use gamepad direction (D-pad or left stick processed to cardinal)
    const direction = gamepadState.dpadDirection !== Direction.NONE 
      ? gamepadState.dpadDirection 
      : gamepadState.leftStickDirection;
    
    cmd.direction = direction;
    cmd.action = isActionDown;
    cmd.actionJustPressed = isActionDown && !wasActionDown;
    cmd.secondary = gamepadState.secondaryButton;
    cmd.start = gamepadState.startButton;
    cmd.restart = false; // No restart on gamepad by default
    
    // Right stick for shooting direction
    cmd.shootDirection = gamepadState.rightStickDirection;
    
    // No mouse on gamepad
    cmd.mouseX = 0;
    cmd.mouseY = 0;
    cmd.mouseClicked = false;
    
    // Analog sticks
    cmd.analogX = gamepadState.leftStickX;
    cmd.analogY = gamepadState.leftStickY;
    cmd.aimX = gamepadState.rightStickX;
    cmd.aimY = gamepadState.rightStickY;
    
    this.lastActionState.set(entity, isActionDown);
  }

  /**
   * Enable input for a specific entity.
   * Useful for temporarily disabling player control (cutscenes, menus, etc.)
   */
  enableInput(entity: number): void {
    const cmd = this.world.getComponent(entity, InputCommandComponent);
    if (cmd) {
      cmd.enabled = true;
    }
  }

  /**
   * Disable input for a specific entity.
   */
  disableInput(entity: number): void {
    const cmd = this.world.getComponent(entity, InputCommandComponent);
    if (cmd) {
      cmd.enabled = false;
    }
  }

  /**
   * Clear all input commands for an entity.
   * Useful for resetting state.
   */
  clearInput(entity: number): void {
    const cmd = this.world.getComponent(entity, InputCommandComponent);
    if (cmd) {
      cmd.direction = Direction.NONE;
      cmd.action = false;
      cmd.actionJustPressed = false;
      cmd.secondary = false;
      cmd.start = false;
      cmd.restart = false;
      cmd.shootDirection = Direction.NONE;
      cmd.mouseX = 0;
      cmd.mouseY = 0;
      cmd.mouseClicked = false;
      cmd.analogX = 0;
      cmd.analogY = 0;
      cmd.aimX = 0;
      cmd.aimY = 0;
    }
  }
}
