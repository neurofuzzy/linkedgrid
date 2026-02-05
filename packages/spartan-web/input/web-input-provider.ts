import { Direction } from '../../spartan/core/grid/direction';
import { InputProvider, InputPreset } from '../../spartan/core/input-provider';
import { InputManager, InputConfig } from './input-manager';

/**
 * Web-based implementation of InputProvider.
 *
 * Wraps InputManager to provide the InputProvider interface for game systems.
 * Supports preset-based input mapping (classic, twin-stick, separated).
 */
export class WebInputProvider implements InputProvider {
  readonly manager: InputManager;
  private ownsManager: boolean;

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

  // === New InputProvider Interface ===

  /**
   * Get the movement direction.
   * Uses preset-based mapping from InputManager.
   */
  getMoveDirection(): Direction {
    return this.manager.getState().moveDirection;
  }

  /**
   * Get the aiming/attack direction.
   * Uses preset-based mapping from InputManager.
   */
  getAimDirection(): Direction {
    return this.manager.getState().aimDirection;
  }

  /**
   * Check if primary action button is pressed.
   * Maps to: Space, Enter, left click, gamepad A button.
   */
  getPrimaryAction(): boolean {
    return this.manager.getState().action;
  }

  /**
   * Check if secondary action button is pressed.
   * Maps to: Shift, right-click, gamepad B button.
   */
  getSecondaryAction(): boolean {
    return this.manager.getState().secondary;
  }

  /**
   * Check if start/pause button is pressed.
   */
  getStart(): boolean {
    return this.manager.getState().start;
  }

  /**
   * Check if restart button is pressed.
   */
  getRestart(): boolean {
    return this.manager.getState().restart;
  }

  /**
   * Check if player is actively aiming.
   *
   * In twin-stick mode, this returns true when aim direction is set,
   * which triggers auto-fire behavior in combat systems.
   *
   * In classic/separated modes, this returns false (use action buttons instead).
   */
  isAiming(): boolean {
    const preset = this.manager.getPreset();

    // Twin-stick mode: aiming when aim direction is set
    if (preset === 'twin-stick') {
      return this.manager.getState().aimDirection !== Direction.NONE;
    }

    // Classic/separated modes: not auto-aiming (use action buttons)
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
