import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import { InputManager } from '../input/input-manager';
import { Direction } from '../core/grid/direction';
import type { GameManager } from '../core/game-manager';

export class PlayerInputSystem extends BaseReactiveSystem {
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
  ) {
    super();
  }

  update(context: GameContext): void {
    this.debugStats.movesThisTick = 0;

    const bufferState = this.inputManager.directionBuffer;
    const keysHeld = this.inputManager.keysHeld;

    this.inputManager.getState();
    this.debugStats.bufferSize = bufferState.length;
    this.debugStats.keysHeld = keysHeld.size;

    const playerId = this.gameManager.gameState.playerEntityId;
    if (!playerId || playerId === 0) return;

    const pos = context.spatial.getEntityPosition(playerId);
    if (!pos) return;

    let lastDirection = Direction.NONE;

    while (bufferState.length > 0) {
      const input = this.inputManager.getState();
      if (input.direction !== Direction.NONE) {
        lastDirection = input.direction;
      }
    }

    if (lastDirection === Direction.NONE) {
      const input = this.inputManager.getState();
      lastDirection = input.direction;
    }

    this.debugStats.lastDirection = lastDirection;

    if (lastDirection === Direction.NONE) return;

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
