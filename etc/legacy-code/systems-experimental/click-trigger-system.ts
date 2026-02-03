import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { InputCommandComponent, GridPositionComponent } from '@basegrid/ecs';
import type { LinkedGrid } from '@basegrid/grid';

/**
 * Click Trigger System
 * 
 * Responds to mouse clicks by triggering systems that support position-based activation.
 * 
 * This system reads mouse input from InputCommandComponent and delegates to other
 * systems via their triggerAt/infectAt/activateAt methods. This keeps demos declarative
 * and allows click-to-trigger functionality in real games.
 * 
 * Pattern:
 * 1. PlayerInputSystem writes mouseX, mouseY, mouseClicked to InputCommandComponent
 * 2. ClickTriggerSystem reads clicks and calls registered trigger handlers
 * 3. Other systems (ChainReaction, VirusSpreading, etc.) handle the actual logic
 * 
 * This decouples UI clicks from game logic and makes everything testable.
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const chainSystem = new ChainReactionSystem();
 * const virusSystem = new VirusSpreadingSystem();
 * const clickSystem = new ClickTriggerSystem();
 * 
 * // Register systems that respond to clicks
 * clickSystem.registerTrigger('chain', (x, y, grid) => chainSystem.triggerAt(x, y, grid));
 * clickSystem.registerTrigger('virus', (x, y, grid) => virusSystem.infectAt(x, y, grid));
 * 
 * world.addSystem(new PlayerInputSystem(inputManager));
 * world.addSystem(clickSystem);
 * world.addSystem(chainSystem);
 * world.addSystem(virusSystem);
 * 
 * // Player entity needs InputCommandComponent
 * const player = world.createEntity();
 * world.addComponent(player, InputCommandComponent, { ... });
 * world.addComponent(player, GridPositionComponent, { x: 10, y: 10, grid });
 * 
 * // Now clicks are handled automatically!
 * ```
 */
export class ClickTriggerSystem extends System {
  private triggers: Map<string, (x: number, y: number, grid: LinkedGrid<number>) => boolean> = new Map();
  
  /**
   * Register a trigger handler for click events
   * @param name - Unique name for this trigger
   * @param handler - Function that handles clicks at (x, y, grid), returns true if handled
   */
  registerTrigger(name: string, handler: (x: number, y: number, grid: LinkedGrid<number>) => boolean): void {
    this.triggers.set(name, handler);
  }
  
  /**
   * Unregister a trigger handler
   */
  unregisterTrigger(name: string): void {
    this.triggers.delete(name);
  }
  
  /**
   * Clear all trigger handlers
   */
  clearTriggers(): void {
    this.triggers.clear();
  }
  
  /**
   * Update - process click events from InputCommandComponent
   */
  update(_dt: number): void {
    // Find entity with input command (typically player)
    for (const [entity, cmd, pos] of this.world.queryMultiple(
      InputCommandComponent,
      GridPositionComponent
    )) {
      // Skip if input disabled or no click
      if (!cmd.enabled || !cmd.mouseClicked) continue;
      
      const clickX = cmd.mouseX;
      const clickY = cmd.mouseY;
      const grid = pos.grid;
      
      // Try each registered trigger until one handles it
      for (const [name, handler] of this.triggers) {
        if (handler(clickX, clickY, grid)) {
          // Trigger handled the click, stop processing
          break;
        }
      }
      
      // Clear mouseClicked flag (edge-triggered)
      cmd.mouseClicked = false;
    }
  }
}
