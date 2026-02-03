import { System } from '@basegrid/ecs';
import { GridPositionComponent } from '@basegrid/ecs';
import { InputCommandComponent } from '@basegrid/ecs';
import { Direction } from '@basegrid/grid';

/**
 * Click-to-Move System - Converts mouse clicks to movement directions.
 * 
 * This system reads mouse input from InputCommandComponent and converts
 * clicked grid positions into cardinal movement directions. It's useful for:
 * - Touch/mobile interfaces
 * - Browser demos with mouse interaction
 * - Accessibility (click instead of keyboard)
 * 
 * **Architecture:**
 * - Reads InputCommandComponent.mouseClicked, mouseX, mouseY
 * - Calculates direction from entity position to clicked cell
 * - Sets InputCommandComponent.direction
 * - CardinalMovementSystem handles the actual movement
 * 
 * **Behavior:**
 * - Clicking adjacent cells = move one step in that direction
 * - Clicking distant cells = move toward them (one step at a time)
 * - Uses primary axis (largest dx/dy) for direction
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const inputManager = new InputManager(canvas);
 * 
 * world.addSystem(new PlayerInputSystem(inputManager));
 * world.addSystem(new ClickToMoveSystem()); // Converts clicks to directions
 * world.addSystem(new CardinalMovementSystem()); // Processes movement
 * world.addSystem(new GridRenderSystem(grid));
 * 
 * // Player needs InputCommandComponent
 * const player = world.createEntity();
 * world.addComponent(player, GridPositionComponent, { x: 5, y: 5, grid });
 * world.addComponent(player, InputCommandComponent, {
 *   direction: Direction.NONE,
 *   mouseX: 0, mouseY: 0, mouseClicked: false,
 *   // ... other fields
 * });
 * ```
 */
export class ClickToMoveSystem extends System {
  /**
   * Process mouse clicks for all entities with InputCommandComponent.
   */
  update(_dt: number): void {
    for (const [entity, cmd, pos] of this.world.queryMultiple(
      InputCommandComponent,
      GridPositionComponent
    )) {
      // Skip if input disabled or no click
      if (!cmd.enabled || !cmd.mouseClicked) continue;
      
      // Calculate direction from entity to clicked cell
      const direction = this.calculateDirection(pos.x, pos.y, cmd.mouseX, cmd.mouseY);
      
      if (direction !== Direction.NONE) {
        cmd.direction = direction;
      }
    }
  }
  
  /**
   * Calculate cardinal direction from entity position to target position.
   * Uses primary axis (largest delta) to determine direction.
   */
  private calculateDirection(fromX: number, fromY: number, toX: number, toY: number): Direction {
    const dx = toX - fromX;
    const dy = toY - fromY;
    
    // No movement if clicked on self
    if (dx === 0 && dy === 0) {
      return Direction.NONE;
    }
    
    // Use primary axis (largest delta)
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? Direction.RT : Direction.LT;
    } else {
      return dy > 0 ? Direction.DN : Direction.UP;
    }
  }
}
