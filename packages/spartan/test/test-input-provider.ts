import { Direction } from '../core/grid/direction';
import { InputProvider } from '../core/input-provider';

/**
 * TestInputProvider - Mockable input provider for testing.
 *
 * Allows programmatic control of input state without DOM dependencies.
 * Useful for unit testing systems that consume input.
 */
export class TestInputProvider implements InputProvider {
  private direction: Direction = Direction.NONE;
  private action = false;
  private secondary = false;
  private start = false;
  private restart = false;

  getDirection(): Direction {
    return this.direction;
  }

  getAction(): boolean {
    return this.action;
  }

  getSecondary(): boolean {
    return this.secondary;
  }

  getStart(): boolean {
    return this.start;
  }

  getRestart(): boolean {
    return this.restart;
  }

  // Test helper methods
  setDirection(direction: Direction): void {
    this.direction = direction;
  }

  setAction(pressed: boolean): void {
    this.action = pressed;
  }

  setSecondary(pressed: boolean): void {
    this.secondary = pressed;
  }

  reset(): void {
    this.direction = Direction.NONE;
    this.action = false;
    this.secondary = false;
    this.start = false;
    this.restart = false;
  }
}
