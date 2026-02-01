import { Direction } from '../../spartan/core/grid/direction';
import { InputProvider } from '../../spartan/core/input-provider';
import { InputManager, InputConfig } from './input-manager';

export class WebInputProvider implements InputProvider {
  private manager: InputManager;
  
  constructor(container: HTMLElement | null, canvas: HTMLCanvasElement | null, config?: InputConfig) {
    this.manager = new InputManager(container, canvas, config);
  }
  
  getDirection(): Direction { return this.manager.getState().direction; }
  getAction(): boolean { return this.manager.getState().action; }
  getSecondary(): boolean { return this.manager.getState().secondary; }
  getStart(): boolean { return this.manager.getState().start; }
  getRestart(): boolean { return this.manager.getState().restart; }
  destroy(): void { this.manager.destroy(); }
}
