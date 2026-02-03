import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { ChainReactiveComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';

/**
 * Chain Reaction System - Manages cascading triggers through adjacent entities
 * 
 * When a chain reactive entity is triggered, it waits for its delay,
 * then triggers adjacent chain reactive entities, creating a cascade.
 * 
 * Pattern (same as FuseSystem but more generic):
 * 1. Entity becomes triggered
 * 2. After delay, trigger adjacent chain reactive entities
 * 3. Those entities trigger their neighbors
 * 4. Cascade spreads through connected network
 * 
 * Use cases:
 * - Domino effects
 * - Virus spreading
 * - Alarm cascades
 * - Telegraph relay
 * - Magical chain lightning
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const chainSystem = new ChainReactionSystem();
 * world.addSystem(chainSystem);
 * 
 * // Create chain of reactive blocks
 * for (let x = 5; x <= 15; x++) {
 *   const block = world.createEntity();
 *   world.addComponent(block, ChainReactiveComponent, {
 *     triggered: false,
 *     triggerDelay: 3,
 *     remainTriggered: true,
 *     onTrigger: (entity) => {
 *       console.log('Block', entity, 'triggered!');
 *     }
 *   });
 *   world.addComponent(block, GridPositionComponent, { x, y: 7, grid });
 * }
 * 
 * // Manually trigger first block - watch cascade!
 * const firstBlock = world.query(ChainReactiveComponent)[0][0];
 * world.getComponent(firstBlock, ChainReactiveComponent)!.triggered = true;
 * ```
 */
export class ChainReactionSystem extends System {
  /**
   * Update chain reactions
   */
  update(_dt: number): void {
    const toTrigger: Entity[] = [];
    
    // Process all triggered entities
    for (const [entity, reactive] of this.world.query(ChainReactiveComponent)) {
      if (!reactive.triggered) continue;
      if (reactive.canTrigger === false) continue;
      
      // Initialize delay timer if needed
      if (reactive.delayTimer === undefined) {
        reactive.delayTimer = reactive.triggerDelay;
        
        // Call onTrigger callback
        if (reactive.onTrigger) {
          reactive.onTrigger(entity);
        }
      }
      
      // Decrement delay timer
      if (reactive.delayTimer > 0) {
        reactive.delayTimer--;
      }
      
      // When delay reaches 0, trigger neighbors
      if (reactive.delayTimer === 0) {
        this.triggerNeighbors(entity, reactive);
        
        // Reset or disable based on remainTriggered
        if (reactive.remainTriggered !== false) {
          // Stay triggered, set delay to -1 to prevent re-triggering
          reactive.delayTimer = -1;
        } else {
          // Reset for next trigger
          reactive.triggered = false;
          reactive.delayTimer = undefined;
        }
      }
    }
  }
  
  /**
   * Trigger entity at grid position (convenience method for UI/triggers)
   * @returns true if entity was triggered, false if no untriggered entity found
   */
  triggerAt(x: number, y: number, grid: any): boolean {
    for (const [entity, reactive, pos] of this.world.queryMultiple(
      ChainReactiveComponent,
      GridPositionComponent
    )) {
      if (pos.x === x && pos.y === y && pos.grid === grid) {
        if (!reactive.triggered && reactive.canTrigger !== false) {
          reactive.triggered = true;
          return true;
        }
      }
    }
    return false;
  }
  
  /**
   * Trigger adjacent chain reactive entities
   */
  private triggerNeighbors(entity: Entity, reactive: ChainReactiveComponent): void {
    const pos = this.world.getComponent(entity, GridPositionComponent);
    if (!pos) return;
    
    const cell = pos.grid.cell(pos.x, pos.y);
    if (!cell) return;
    
    // Get neighbors
    const neighbors = cell.neighbors().filter(n => n !== null);
    
    for (const neighbor of neighbors) {
      if (!neighbor) continue;
      
      // Find chain reactive entities at neighbor position
      for (const [neighborEntity, neighborReactive] of this.world.query(ChainReactiveComponent)) {
        if (neighborEntity === entity) continue; // Skip self
        
        const neighborPos = this.world.getComponent(neighborEntity, GridPositionComponent);
        if (!neighborPos) continue;
        
        // Check if at neighbor position and same grid
        if (neighborPos.grid !== pos.grid) continue;
        if (neighborPos.x !== neighbor.x || neighborPos.y !== neighbor.y) continue;
        
        // Check if already triggered
        if (neighborReactive.triggered) continue;
        
        // Check if can trigger
        if (neighborReactive.canTrigger === false) continue;
        
        // Check type matching if specified
        if (reactive.triggerType && neighborReactive.triggerType) {
          if (reactive.triggerType !== neighborReactive.triggerType) {
            continue;
          }
        }
        
        // Trigger the neighbor!
        neighborReactive.triggered = true;
        neighborReactive.delayTimer = undefined; // Will be initialized on next update
        
        // Call onPropagate callback
        if (reactive.onPropagate) {
          reactive.onPropagate(entity, neighborEntity);
        }
      }
    }
  }
}
