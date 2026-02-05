import { Direction } from '../../spartan/core/grid/direction';
import { InputProvider, InputPreset } from '../../spartan/core/input-provider';
import { InputManager, InputConfig } from './input-manager';

/**
 * Web-based implementation of InputProvider.
 *
 * Wraps InputManager to provide the InputProvider interface for game systems.
 * This is a thin adapter that maps the InputManager's state to the InputProvider interface.
 *
 * IMPORTANT: This provider calls getState() once per frame via beginFrame().
 * All getter methods read from the cached state to ensure consistency within a frame.
 */
export class WebInputProvider implements InputProvider {
  readonly manager: InputManager;
  private ownsManager: boolean;
  private preset: InputPreset = 'classic';

  /** Last non-NONE movement direction for aim tracking in classic mode */
  private lastMoveDirection: Direction = Direction.NONE;

  /** Cached state for current frame */
  private frameState: {
    direction: Direction;
    shootDirection: Direction;
    action: boolean;
    secondary: boolean;
    start: boolean;
    restart: boolean;
  } | null = null;

  /**
   * Create a WebInputProvider with an existing InputManager (for dependency injection).
   * @param manager - Existing InputManager instance
   */
  constructor(manager: InputManager);

  /**
   * Create a WebInputProvider with a new InputManager.
   * @param container - DOM container for input
   * @param canvas - Canvas element for mouse input
   * @param config - Input configuration
   */
  constructor(container: HTMLElement | null, canvas: HTMLCanvasElement | null, config?: InputConfig);

  constructor(
    managerOrContainer: InputManager | HTMLElement | null,
    canvas?: HTMLCanvasElement | null,
    config?: InputConfig
  ) {
    // Use duck typing to check if this is an InputManager
    // (instanceof can fail in test environments due to module loading)
    if (managerOrContainer && typeof (managerOrContainer as InputManager).getState === 'function') {
      // Dependency injection: use existing manager
      this.manager = managerOrContainer as InputManager;
      this.ownsManager = false;
    } else {
      // Create new manager with container (can be null for headless)
      this.manager = new InputManager(
        managerOrContainer as HTMLElement | null,
        canvas ?? null,
        config
      );
      this.ownsManager = true;
      // Auto-enable keyboard for better usability
      this.manager.enableKeyboard();
    }
  }

  // === Frame Management ===

  /**
   * Begin a new input frame. Call this at the start of each game tick.
   * Consumes the input state from the manager and caches it for this frame.
   */
  beginFrame(): void {
    const state = this.manager.getState();
    this.frameState = {
      direction: state.direction,
      shootDirection: state.shootDirection,
      action: state.action,
      secondary: state.secondary,
      start: state.start,
      restart: state.restart,
    };

    // Track last movement direction for classic mode aim
    if (this.frameState.direction !== Direction.NONE) {
      this.lastMoveDirection = this.frameState.direction;
    }
  }

  /**
   * Get frame state, calling beginFrame() if needed.
   */
  private getFrame() {
    if (this.frameState === null) {
      this.beginFrame();
    }
    return this.frameState!;
  }

  // === InputProvider Interface ===

  /**
   * Get the movement direction.
   * - Classic: Uses combined direction (arrows + WASD)
   * - Twin-stick/Separated: Uses arrow keys only (direction minus WASD)
   */
  getMoveDirection(): Direction {
    const frame = this.getFrame();

    if (this.preset === 'classic') {
      return frame.direction;
    }

    // For twin-stick and separated: arrows = movement, WASD = aim/fire
    // shootDirection is ONLY set from WASD keys (keysDown)
    // If shootDirection matches direction, it means WASD was pressed (not arrows)
    // If shootDirection is NONE but direction is set, it could be arrows OR
    // a WASD key that was released (in keysJustPressed but not keysDown)
    //
    // The safest heuristic: only move if direction differs from shootDirection
    // OR if both are NONE (no input)
    if (frame.shootDirection !== Direction.NONE) {
      // WASD is being held - check if direction differs (arrows also pressed)
      if (frame.direction !== frame.shootDirection) {
        // Both arrows and WASD pressed with different directions - arrows win for movement
        return frame.direction;
      }
      // direction == shootDirection: only WASD pressed, no movement
      return Direction.NONE;
    }

    // shootDirection is NONE - no WASD held currently
    // But direction might still be from a WASD key in keysJustPressed (released same frame)
    // We can't distinguish this reliably, but we can check if the raw key state
    // indicates WASD was the source. Since we don't have access to raw keys here,
    // we assume if shootDirection is NONE, direction came from arrows.
    // This is safe because shootDirection uses keysDown which persists while held.
    return frame.direction;
  }

  /**
   * Get the aiming/attack direction.
   * - Classic: Last movement direction
   * - Twin-stick/Separated: WASD direction (shootDirection)
   */
  getAimDirection(): Direction {
    const frame = this.getFrame();

    if (this.preset === 'classic') {
      return this.lastMoveDirection;
    }

    // Twin-stick and separated use shootDirection (WASD)
    return frame.shootDirection;
  }

  /**
   * Check if primary action button is pressed.
   */
  getPrimaryAction(): boolean {
    return this.getFrame().action;
  }

  /**
   * Check if secondary action button is pressed.
   */
  getSecondaryAction(): boolean {
    return this.getFrame().secondary;
  }

  /**
   * Check if start/pause button is pressed.
   */
  getStart(): boolean {
    return this.getFrame().start;
  }

  /**
   * Check if restart button is pressed.
   */
  getRestart(): boolean {
    return this.getFrame().restart;
  }

  /**
   * Check if player is actively aiming.
   * In twin-stick and separated modes, returns true when aim direction is set.
   */
  isAiming(): boolean {
    if (this.preset === 'twin-stick' || this.preset === 'separated') {
      return this.getAimDirection() !== Direction.NONE;
    }
    return false;
  }

  // === Preset Management ===

  /**
   * Set the input preset for this provider.
   */
  setPreset(preset: InputPreset): this {
    this.preset = preset;
    this.lastMoveDirection = Direction.NONE;
    return this;
  }

  /**
   * Get the current input preset.
   */
  getPreset(): InputPreset {
    return this.preset;
  }

  // === Lifecycle ===

  destroy(): void {
    if (this.ownsManager) {
      this.manager.destroy();
    }
  }
}
