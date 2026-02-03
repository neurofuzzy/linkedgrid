import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { OnFireComponent } from '@basegrid/gameplay';
import { FlammableComponent } from '@basegrid/gameplay';
import { GridPositionComponent, VisualComponent } from '@basegrid/ecs';

/**
 * Fire Spread System - Manages fire spreading and burnout
 * 
 * Handles fire propagation mechanics:
 * 1. **OnFire entities**: Burn for duration then become burnt
 * 2. **Flammable entities**: Can be ignited by adjacent fires
 * 3. **Fire spreading**: Fire spreads to adjacent flammables probabilistically
 * 4. **Burnout**: Fire entities turn to burnt/ash after burn time
 * 
 * Typical use case: Forest fires, burning buildings, explosive barrels
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const fireSpreadSystem = new FireSpreadSystem();
 * world.addSystem(fireSpreadSystem);
 * 
 * // Create forest of trees
 * for (let i = 0; i < 100; i++) {
 *   const tree = world.createEntity();
 *   world.addComponent(tree, FlammableComponent, {
 *     igniteChance: 0.3,
 *     burnTime: 5,
 *     spreadChance: 0.3
 *   });
 *   world.addComponent(tree, GridPositionComponent, { x, y, grid });
 * }
 * 
 * // Ignite one tree
 * world.addComponent(firstTree, OnFireComponent, {
 *   burnTime: 5,
 *   ticksBurning: 0,
 *   spreadChance: 0.3
 * });
 * 
 * // Fire spreads automatically
 * world.update(16.67);
 * ```
 */
export class FireSpreadSystem extends System {
  /**
   * Update fire spread system
   */
  update(_dt: number): void {
    // 1. Process burning entities (spread and burnout)
    this.processBurningEntities();
    
    // 2. Clean up burnt out fires
    this.cleanupBurntFires();
  }
  
  /**
   * Process burning entities (spread fire and update burn time)
   */
  private processBurningEntities(): void {
    const newFires: Array<{ entity: Entity; config: typeof OnFireComponent.prototype }> = [];
    
    for (const [fireEntity, fire] of this.world.query(OnFireComponent)) {
      const firePos = this.world.getComponent(fireEntity, GridPositionComponent);
      if (!firePos) continue;
      
      // Increment burn timer
      fire.ticksBurning++;
      
      // Skip if already burnt out (will be removed in cleanup phase)
      if (fire.ticksBurning >= fire.burnTime) {
        continue;
      }
      
      // Try to spread to neighbors
      const cell = firePos.grid.cell(firePos.x, firePos.y);
      if (!cell) continue;
      
      const neighbors = cell.neighbors().filter(n => n !== null);
      
      for (const neighbor of neighbors) {
        if (!neighbor) continue;
        
        // Find flammable entity at neighbor position
        for (const [flammableEntity, flammable] of this.world.query(FlammableComponent)) {
          // Skip if already on fire
          if (this.world.hasComponent(flammableEntity, OnFireComponent)) continue;
          
          const flammablePos = this.world.getComponent(flammableEntity, GridPositionComponent);
          if (!flammablePos) continue;
          
          // Check if at neighbor position and same grid
          if (flammablePos.grid !== firePos.grid) continue;
          if (flammablePos.x !== neighbor.x || flammablePos.y !== neighbor.y) continue;
          
          // Probabilistic ignition
          if (Math.random() < fire.spreadChance * flammable.igniteChance) {
            newFires.push({
              entity: flammableEntity,
              config: {
                burnTime: flammable.burnTime,
                ticksBurning: 0,
                spreadChance: flammable.spreadChance,
                burntValue: flammable.burntValue
              }
            });
          }
        }
      }
    }
    
    // Ignite new fires
    for (const { entity, config } of newFires) {
      this.world.addComponent(entity, OnFireComponent, config);
      
      // Update visual to show fire (GridRenderSystem will sync to grid)
      const visual = this.world.getComponent(entity, VisualComponent);
      if (visual) {
        visual.cellValue = 2; // FIRE visual (should match the orange fire sprite)
      }
    }
  }
  
  /**
   * Remove fires that have burnt out
   */
  private cleanupBurntFires(): void {
    const toBurnOut: Entity[] = [];
    
    for (const [fireEntity, fire] of this.world.query(OnFireComponent)) {
      if (fire.ticksBurning >= fire.burnTime) {
        toBurnOut.push(fireEntity);
      }
    }
    
    // Burn out fires
    for (const entity of toBurnOut) {
      const fire = this.world.getComponent(entity, OnFireComponent);
      
      // Update visual to burnt state (GridRenderSystem will sync to grid)
      const visual = this.world.getComponent(entity, VisualComponent);
      if (visual && fire) {
        visual.cellValue = fire.burntValue ?? 0;
      }
      
      // Remove fire component (keep entity if it was flammable terrain)
      this.world.removeComponent(entity, OnFireComponent);
      
      // Optionally remove flammable too (so it can't re-ignite)
      this.world.removeComponent(entity, FlammableComponent);
    }
  }
}
