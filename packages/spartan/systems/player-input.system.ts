import type { GameSystem, GameContext } from '../core/types';
import { InputManager } from '../input/input-manager';
import { Direction } from '../core/grid/direction';
import type { GameManager } from '../core/game-manager';

/**
 * PlayerInputSystem - Bridges InputManager to player movement.
 *
 * Reads from InputManager each tick and stages player moves.
 * Uses double-buffered input for smooth controls even at low tick rates.
 *
 * @example
 * ```typescript
 * const inputManager = new InputManager(null, null);
 * inputManager.enableKeyboard().enableBuffering();
 *
 * const playerInput = new PlayerInputSystem(gameManager, inputManager);
 * gameLoop.addSystem(playerInput);
 * ```
 */
export class PlayerInputSystem implements GameSystem {
  // Debug stats
  public debugStats = {
    bufferSize: 0,
    keysHeld: 0,
    lastDirection: Direction.NONE,
    movesThisTick: 0,
    blockedMoves: 0,
  };

  constructor(
    private gameManager: GameManager,
    private inputManager: InputManager
  ) {}

  /**
   * Update called by GameLoop each tick.
   *
   * Drains entire input buffer and processes most recent input.
   */
  update(context: GameContext): void {
    // Reset tick stats
    this.debugStats.movesThisTick = 0;

    // Capture buffer state before consuming
    const bufferState = this.inputManager.directionBuffer;
    const keysHeld = this.inputManager.keysHeld;

    // Get input for this frame (this drains the buffer in InputManager)
    const input = this.inputManager.getState();
    this.debugStats.bufferSize = bufferState.length;
    this.debugStats.keysHeld = keysHeld.size;

    // Get player entity ID
    const playerId = this.gameManager.gameState.playerEntityId;
    if (!playerId || playerId === 0) return;

    // Get player position
    const pos = context.spatial.getEntityPosition(playerId);
    if (!pos) return;

    // Drain entire buffer, keeping only the LAST direction for responsiveness
    let lastDirection = Direction.NONE;

    while (bufferState.length > 0) {
      const input = this.inputManager.getState();
      if (input.direction !== Direction.NONE) {
        lastDirection = input.direction;
      }
    }

    // If buffer was empty, check held keys once
    if (lastDirection === Direction.NONE) {
      const input = this.inputManager.getState();
      lastDirection = input.direction;
    }

    this.debugStats.lastDirection = lastDirection;

    // No direction input
    if (lastDirection === Direction.NONE) return;

    // Convert direction to delta
    const delta = this.directionToDelta(lastDirection);
    const newX = pos.x + delta.dx;
    const newY = pos.y + delta.dy;

    // Get grid dimensions
    const grid = context.spatial.grid;

    // Bounds check
    if (newX < 0 || newX >= grid.width || newY < 0 || newY >= grid.height) {
      return;
    }

    // Always register move intent - SpatialSystem will validate during commit
    // This allows other systems (like DoorSystem) to see intents and react
    context.spatial.move(playerId, newX, newY);
    this.debugStats.movesThisTick++;
  }

  /**
   * Convert Direction enum to delta coordinates.
   */
  private directionToDelta(dir: Direction): { dx: number; dy: number } {
    switch (dir) {
      case Direction.UP:
        return { dx: 0, dy: -1 };
      case Direction.DOWN:
        return { dx: 0, dy: 1 };
      case Direction.LEFT:
        return { dx: -1, dy: 0 };
      case Direction.RIGHT:
        return { dx: 1, dy: 0 };
      default:
        return { dx: 0, dy: 0 };
    }
  }

  /**
   * Get debug state for troubleshooting.
   * Useful for understanding system state during development.
   */
  public getDebugState() {
    const inputManagerInternal = this.inputManager as unknown as {
      keyboardManager: unknown;
      mouseManager: unknown;
      gamepadManager: unknown;
    };
    return {
      systemType: 'PlayerInputSystem',
      inputManager: {
        hasKeyboard: inputManagerInternal.keyboardManager !== null,
        hasMouse: inputManagerInternal.mouseManager !== null,
        hasGamepad: inputManagerInternal.gamepadManager !== null,
      },
      ...this.debugStats,
    };
  }
}
