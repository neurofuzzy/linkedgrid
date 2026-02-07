/**
 * @brief Translates raw input to player intentions.
 */
import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import { InputProvider } from '../core/input-provider';
import { Direction } from '../core/grid/direction';
import type { GameManager } from '../core/game-manager';
import { hasVisualState, hasFacing } from '../traits/trait-guards';

/**
 * PlayerInputSystem - Translates player input into movement intents.
 *
 * Processes input from InputProvider to determine player movement direction.
 * Stages movement intents for the player entity each tick.
 *
 * @system
 * @reactsTo InputProvider state
 * @modifies PlayerEntity position (via spatial.move intent)
 *
 * Behavior:
 * - Gets current direction from InputProvider
 * - Validates grid bounds before staging move
 * - Tracks debug stats for input diagnostics
 *
 * Architecture Note:
 * Device-specific input handling (buffering, debouncing, tap vs continuous modes, etc.)
 * is handled at the InputProvider/InputManager layer (e.g., KeyboardInputManager).
 * This system remains platform-agnostic and simply reads from the InputProvider interface.
 *
 * @example
 * ```typescript
 * const inputSystem = new PlayerInputSystem(gameManager, inputProvider);
 * gameLoop.addSystem(inputSystem);
 * ```
 */
export class PlayerInputSystem extends BaseReactiveSystem {
  readonly executionPhase = 'input' as const;

  public debugStats = {
    lastDirection: Direction.NONE,
    movesThisTick: 0,
    blockedMoves: 0,
  };

  constructor(
    private gameManager: GameManager,
    private inputProvider: InputProvider
  ) {
    super();
  }

  update(context: GameContext): void {
    this.debugStats.movesThisTick = 0;

    const playerId = this.gameManager.gameState.playerEntityId;
    if (!playerId || playerId === 0) return;

    const pos = context.spatial.getEntityPosition(playerId);
    if (!pos) return;

    const lastDirection = this.inputProvider.getMoveDirection();

    this.debugStats.lastDirection = lastDirection;

    // Update visual state based on input
    const playerEntity = context.spatial.getEntityData(playerId);
    if (!playerEntity) return;

    if (lastDirection === Direction.NONE) {
      // No input -- revert to idle if currently walking
      if (hasVisualState(playerEntity) && playerEntity.visualState === 'walk') {
        playerEntity.visualState = 'idle';
        playerEntity.visualDirty = true;
      }
      return;
    }

    // Set facing from input direction
    if (hasFacing(playerEntity)) {
      playerEntity.facing = lastDirection;
    }

    // Set walk state
    if (hasVisualState(playerEntity) && playerEntity.visualState !== 'attack') {
      if (playerEntity.visualState !== 'walk') {
        playerEntity.visualState = 'walk';
        playerEntity.visualDirty = true;
      }
    }

    const delta = this.directionToDelta(lastDirection);
    const newX = pos.x + delta.dx;
    const newY = pos.y + delta.dy;

    const grid = context.spatial.grid;

    if (newX < 0 || newX >= grid.width || newY < 0 || newY >= grid.height) {
      return;
    }

    context.spatial.move(playerId, newX, newY);
    this.debugStats.movesThisTick++;
  }

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

  public override getDebugState() {
    return {
      systemType: 'PlayerInputSystem',
      ...this.debugStats,
    };
  }
}
