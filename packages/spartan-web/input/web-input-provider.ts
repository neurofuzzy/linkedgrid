import { Direction } from '../../spartan/core/grid/direction';
import { InputProvider, InputPreset } from '../../spartan/core/input-provider';
import { InputManager, InputConfig, InputState } from './input-manager';

/**
 * Web-based implementation of InputProvider.
 *
 * Wraps InputManager to provide the InputProvider interface for game systems.
 * Supports preset-based input mapping (classic, twin-stick, separated).
 *
 * IMPORTANT: Caches getState() per tick to prevent multiple calls from
 * draining one-shot events (like keypresses). Call beginFrame() at the
 * start of each game tick to refresh the cache.
 */
export class WebInputProvider implements InputProvider {
  readonly manager: InputManager;
  private ownsManager: boolean;

  /** Cached input state for current frame - prevents multiple getState() calls from draining events */
  private cachedState: InputState | null = null;

  /**
   * Create a WebInputProvider with an existing InputManager (for dependency injection).
   * @param manager - Existing InputManager instance
   */
  constructor(manager: InputManager);

  /**
   * Create a WebInputProvider with a new InputManager.
   * @param container - DOM container for input
   * @param canvas - Canvas element for mouse input
   * @param config - Input configuration (including preset)
   */
  constructor(container: HTMLElement | null, canvas: HTMLCanvasElement | null, config?: InputConfig);

  constructor(
    managerOrContainer: InputManager | HTMLElement | null,
    canvas?: HTMLCanvasElement | null,
    config?: InputConfig
  ) {
    if (managerOrContainer instanceof InputManager) {
      // Dependency injection: use existing manager
      this.manager = managerOrContainer;
      this.ownsManager = false;
    } else {
      // Create new manager
      this.manager = new InputManager(managerOrContainer, canvas ?? null, config);
      this.ownsManager = true;
      // Auto-enable all input listeners for better usability
      this.manager.enableKeyboard().enableMouse().enableGamepad();
    }
  }

  // === Frame Management ===

  /**
   * Begin a new input frame. Call this at the start of each game tick.
   * Consumes the input state from the manager and caches it for this frame.
   *
   * This should be called once per tick, before any systems run.
   * It uses getState() which properly consumes buffers and one-shot events.
   */
  beginFrame(): void {
    // Consume state once per frame using getState()
    this.cachedState = this.manager.getState();
  }

  /**
   * Get the cached input state for this frame.
   *
   * If beginFrame() hasn't been called yet, uses peekState() which
   * reads current state without consuming one-shot events.
   */
  private getFrameState(): InputState {
    if (this.cachedState === null) {
      // Fallback if beginFrame() wasn't called - use peekState to avoid draining
      this.cachedState = this.manager.peekState();
    }
    return this.cachedState;
  }

  // === New InputProvider Interface ===

  /**
   * Get the movement direction.
   * Uses preset-based mapping from InputManager.
   */
  getMoveDirection(): Direction {
    return this.getFrameState().moveDirection;
  }

  /**
   * Get the aiming/attack direction.
   * Uses preset-based mapping from InputManager.
   */
  getAimDirection(): Direction {
    return this.getFrameState().aimDirection;
  }

  /**
   * Check if primary action button is pressed.
   * Maps to: Space, Enter, left click, gamepad A button.
   */
  getPrimaryAction(): boolean {
    return this.getFrameState().action;
  }

  /**
   * Check if secondary action button is pressed.
   * Maps to: Shift, right-click, gamepad B button.
   */
  getSecondaryAction(): boolean {
    return this.getFrameState().secondary;
  }

  /**
   * Check if start/pause button is pressed.
   */
  getStart(): boolean {
    return this.getFrameState().start;
  }

  /**
   * Check if restart button is pressed.
   */
  getRestart(): boolean {
    return this.getFrameState().restart;
  }

  /**
   * Check if player is actively aiming.
   *
   * In twin-stick and separated modes, this returns true when aim direction is set,
   * which triggers auto-fire behavior in combat systems.
   * - Twin-stick: WASD sets aim direction, auto-fires while aiming
   * - Separated: WASD fires in that direction immediately (W fires up, etc.)
   *
   * In classic mode, this returns false (movement controls aiming).
   */
  isAiming(): boolean {
    const preset = this.manager.getPreset();

    // Twin-stick and separated modes: aiming when aim direction is set
    // This allows WASD to auto-fire in the pressed direction
    if (preset === 'twin-stick' || preset === 'separated') {
      return this.getFrameState().aimDirection !== Direction.NONE;
    }

    // Classic mode: not auto-aiming (aim follows movement)
    return false;
  }

  // === Preset Management ===

  /**
   * Set the input preset for this provider.
   */
  setPreset(preset: InputPreset): this {
    this.manager.setPreset(preset);
    return this;
  }

  /**
   * Get the current input preset.
   */
  getPreset(): InputPreset {
    return this.manager.getPreset();
  }

  // === Lifecycle ===

  destroy(): void {
    // Only destroy the manager if we own it
    if (this.ownsManager) {
      this.manager.destroy();
    }
  }
}
