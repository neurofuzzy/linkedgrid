import { Direction } from '../../spartan/core/grid/direction';
import { InputProvider } from '../../spartan/core/input-provider';
import { InputManager, InputConfig } from './input-manager';

export class WebInputProvider implements InputProvider {
  private manager: InputManager;
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
   * @param config - Input configuration
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

  getDirection(): Direction { return this.manager.getState().direction; }
  getAction(): boolean { return this.manager.getState().action; }
  getSecondary(): boolean { return this.manager.getState().secondary; }
  getStart(): boolean { return this.manager.getState().start; }
  getRestart(): boolean { return this.manager.getState().restart; }

  destroy(): void {
    // Only destroy the manager if we own it
    if (this.ownsManager) {
      this.manager.destroy();
    }
  }
}
