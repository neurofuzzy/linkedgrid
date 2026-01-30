/**
 * Direction enum for cardinal directions in the grid.
 *
 * Values start at 1 (not 0) to allow NONE = 0 as "no direction".
 * Implementation detail: Neighbor arrays use `direction - 1` as index.
 *
 * @example
 * ```typescript
 * // Basic movement
 * const cell = grid.cell(5, 5);
 * const above = cell.move(Direction.UP);
 * const right3 = cell.move(Direction.RIGHT, 3);
 *
 * // Input handling
 * if (inputState.direction !== Direction.NONE) {
 *   player.move(inputState.direction);
 * }
 *
 * // Pathfinding direction
 * const dir = entity.directionTo(targetX, targetY);
 * entity.move(dir);
 * ```
 */
export enum Direction {
  /** No direction / stationary */
  NONE = 0,
  /** Up / North (decreasing Y) */
  UP = 1,
  /** Down / South (increasing Y) */
  DN = 2,
  /** Left / West (decreasing X) */
  LT = 3,
  /** Right / East (increasing X) */
  RT = 4,
}

/**
 * Direction utility functions
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Direction {
  /**
   * Reflect a direction across an axis.
   * @param direction - The direction to reflect
   * @param axis - The axis to reflect across ('horizontal' or 'vertical')
   * @returns The reflected direction
   *
   * @example
   * Direction.reflect(Direction.UP, 'horizontal') // Returns Direction.DOWN
   * Direction.reflect(Direction.LEFT, 'vertical') // Returns Direction.RIGHT
   */
  export function reflect(
    direction: Direction,
    axis: 'horizontal' | 'vertical'
  ): Direction {
    if (axis === 'horizontal') {
      // Reflect across horizontal axis (flip vertical direction)
      if (direction === Direction.UP) return Direction.DOWN;
      if (direction === Direction.DOWN) return Direction.UP;
      return direction; // LT, RT, NONE unchanged
    } else {
      // Reflect across vertical axis (flip horizontal direction)
      if (direction === Direction.LEFT) return Direction.RIGHT;
      if (direction === Direction.RIGHT) return Direction.LEFT;
      return direction; // UP, DN, NONE unchanged
    }
  }
}
