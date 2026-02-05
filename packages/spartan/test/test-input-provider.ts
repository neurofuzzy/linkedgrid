import { Direction } from '../core/grid/direction';
import type { InputProvider, InputPreset } from '../core/input-provider';

/**
 * TestInputProvider - Mockable input provider for testing.
 *
 * Allows programmatic control of input state without DOM dependencies.
 * Useful for unit testing systems that consume input.
 *
 * Supports the new InputProvider interface with presets.
 */
export class TestInputProvider implements InputProvider {
  private preset: InputPreset = 'classic';
  private moveDirection: Direction = Direction.NONE;
  private aimDirection: Direction = Direction.NONE;
  private primaryAction = false;
  private secondaryAction = false;
  private start = false;
  private restart = false;

  // For classic mode: track last movement direction
  private lastMoveDirection: Direction = Direction.NONE;

  getMoveDirection(): Direction {
    return this.moveDirection;
  }

  getAimDirection(): Direction {
    // In classic mode, aim follows last move direction
    if (this.preset === 'classic') {
      return this.lastMoveDirection;
    }
    return this.aimDirection;
  }

  getPrimaryAction(): boolean {
    return this.primaryAction;
  }

  getSecondaryAction(): boolean {
    return this.secondaryAction;
  }

  getStart(): boolean {
    const was = this.start;
    this.start = false; // Consume one-shot
    return was;
  }

  getRestart(): boolean {
    const was = this.restart;
    this.restart = false; // Consume one-shot
    return was;
  }

  isAiming(): boolean {
    // Twin-stick mode: aiming when aim direction is set
    if (this.preset === 'twin-stick') {
      return this.aimDirection !== Direction.NONE;
    }
    return false;
  }

  // === Test helper methods ===

  /**
   * Set the input preset.
   */
  setPreset(preset: InputPreset): void {
    this.preset = preset;
    this.lastMoveDirection = Direction.NONE;
  }

  /**
   * Get the current preset.
   */
  getPreset(): InputPreset {
    return this.preset;
  }

  /**
   * Set direction (legacy - sets both move and aim for classic mode).
   */
  setDirection(direction: Direction): void {
    this.moveDirection = direction;
    if (this.preset === 'classic') {
      if (direction !== Direction.NONE) {
        this.lastMoveDirection = direction;
      }
    } else {
      this.aimDirection = direction;
    }
  }

  /**
   * Set movement direction explicitly.
   */
  setMoveDirection(direction: Direction): void {
    this.moveDirection = direction;
    if (direction !== Direction.NONE) {
      this.lastMoveDirection = direction;
    }
  }

  /**
   * Set aim direction explicitly.
   */
  setAimDirection(direction: Direction): void {
    this.aimDirection = direction;
  }

  /**
   * Set action button state (legacy - maps to primary action).
   */
  setAction(pressed: boolean): void {
    this.primaryAction = pressed;
  }

  /**
   * Set primary action button state.
   */
  setPrimaryAction(pressed: boolean): void {
    this.primaryAction = pressed;
  }

  /**
   * Set secondary button state (legacy - maps to secondary action).
   */
  setSecondary(pressed: boolean): void {
    this.secondaryAction = pressed;
  }

  /**
   * Set secondary action button state.
   */
  setSecondaryAction(pressed: boolean): void {
    this.secondaryAction = pressed;
  }

  /**
   * Press start button (one-shot).
   */
  pressStart(): void {
    this.start = true;
  }

  /**
   * Press restart button (one-shot).
   */
  pressRestart(): void {
    this.restart = true;
  }

  /**
   * Reset all input state.
   */
  reset(): void {
    this.moveDirection = Direction.NONE;
    this.aimDirection = Direction.NONE;
    this.lastMoveDirection = Direction.NONE;
    this.primaryAction = false;
    this.secondaryAction = false;
    this.start = false;
    this.restart = false;
  }
}
