import { Direction } from './grid/direction.js';

/**
 * Input preset types for different game styles.
 *
 * - 'classic': Standard arcade - Arrows+WASD for movement, last move direction for aim
 * - 'twin-stick': Twin-stick shooter - Arrows/LStick for move, WASD/RStick for aim (auto-fires)
 * - 'separated': Attack direction mode - Arrows for move, WASD for attack direction
 */
export type InputPreset = 'classic' | 'twin-stick' | 'separated';

/**
 * InputProvider - Interface for game input abstraction.
 *
 * Provides a clean API for game systems to read player input without
 * coupling to specific input devices (keyboard, gamepad, touch, etc.).
 *
 * The interface supports different input presets:
 * - classic: Traditional arcade style (move with any direction keys, action buttons for combat)
 * - twin-stick: One set of keys for movement, another for aiming (auto-fires when aiming)
 * - separated: Movement keys separate from attack direction keys
 *
 * @example
 * ```typescript
 * // In a game system
 * update(context: GameContext) {
 *   const moveDir = this.inputProvider.getMoveDirection();
 *   if (moveDir !== Direction.NONE) {
 *     // Move player
 *   }
 *
 *   // Twin-stick auto-fire
 *   if (this.inputProvider.isAiming()) {
 *     const aimDir = this.inputProvider.getAimDirection();
 *     // Fire in aim direction
 *   }
 * }
 * ```
 */
export interface InputProvider {
  /**
   * Get the movement direction.
   *
   * Used by PlayerInputSystem to move the player entity.
   * - classic/separated: Arrow keys or left stick
   * - twin-stick: Arrow keys or left stick
   *
   * @returns Direction for movement, or Direction.NONE if no movement input
   */
  getMoveDirection(): Direction;

  /**
   * Get the aiming/attack direction.
   *
   * Used by combat systems (MeleeSystem, PlayerWeaponSystem) for attack direction.
   * - classic: Returns last movement direction (face where you moved)
   * - twin-stick: WASD keys or right stick
   * - separated: WASD keys (attack in this direction)
   *
   * @returns Direction for aiming/attacking, or Direction.NONE if no aim input
   */
  getAimDirection(): Direction;

  /**
   * Check if primary action button is pressed.
   *
   * Used for melee attacks and interactions.
   * Typically: Space bar, Enter, or gamepad A button.
   *
   * @returns true if primary action is active
   */
  getPrimaryAction(): boolean;

  /**
   * Check if secondary action button is pressed.
   *
   * Used for ranged attacks and special abilities.
   * Typically: Shift, right-click, or gamepad B button.
   *
   * @returns true if secondary action is active
   */
  getSecondaryAction(): boolean;

  /**
   * Check if start/pause button is pressed.
   *
   * @returns true if start is pressed this frame
   */
  getStart(): boolean;

  /**
   * Check if restart button is pressed.
   *
   * @returns true if restart is pressed this frame
   */
  getRestart(): boolean;

  /**
   * Check if player is actively aiming.
   *
   * In twin-stick mode, this returns true when the aim direction is set,
   * which triggers auto-fire behavior in combat systems.
   *
   * In classic/separated modes, this typically returns false
   * (use action buttons instead).
   *
   * @returns true if actively aiming (for auto-fire in twin-stick mode)
   */
  isAiming(): boolean;
}
