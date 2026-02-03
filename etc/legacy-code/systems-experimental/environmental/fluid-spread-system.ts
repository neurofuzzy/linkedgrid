import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { FluidSpreadComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';

/**
 * Fluid Spread System
 * 
 * Manages spreading fluids (acid, lava, poison).
 * Handles gradual spread to adjacent cells.
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const fluidSystem = new FluidSpreadSystem();
 * world.addSystem(fluidSystem);
 * 
 * // Create acid source
 * const acid = world.createEntity();
 * world.addComponent(acid, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(acid, FluidSpreadComponent, {
 *   spreadRate: 2.0,
 *   maxCells: 15,
 *   lifetime: 10.0
 * });
 * 
 * // Acid spreads to adjacent cells
 * world.update(0.016);
 * ```
 */
export class FluidSpreadSystem extends System {
  /**
   * Update all spreading fluids
   */
  update(dt: number): void {
    const toRemove: Entity[] = [];
    
    for (const [entity, fluid] of this.world.query(FluidSpreadComponent)) {
      const pos = this.world.getComponent(entity, GridPositionComponent);
      if (!pos) {
        toRemove.push(entity);
        continue;
      }
      
      // Initialize
      if (fluid.spreadTimer === undefined) {
        fluid.spreadTimer = 1.0 / fluid.spreadRate;
        fluid.isSource = fluid.isSource ?? true;
        fluid.spreadCells = fluid.spreadCells ?? new Set();
        fluid.parentEntity = fluid.parentEntity ?? entity;
      }
      
      // Handle lifetime for non-source cells
      if (!fluid.isSource && fluid.lifetime !== undefined) {
        fluid.lifetime -= dt;
        if (fluid.lifetime <= 0) {
          if (fluid.onDie) {
            fluid.onDie(entity);
          }
          toRemove.push(entity);
          continue;
        }
      }
      
      // Only sources spread
      if (!fluid.isSource) continue;
      
      // Update spread timer
      fluid.spreadTimer -= dt;
      if (fluid.spreadTimer <= 0) {
        // Attempt to spread
        this.spreadFluid(entity, fluid, pos);
        
        // Reset timer
        fluid.spreadTimer = 1.0 / fluid.spreadRate;
      }
    }
    
    // Remove expired fluids
    for (const entity of toRemove) {
      this.world.destroyEntity(entity);
    }
  }
  
  /**
   * Spread fluid to adjacent cell
   */
  private spreadFluid(sourceEntity: Entity, fluid: FluidSpread, pos: GridPositionComponent): void {
    // Check max cells limit
    if (fluid.maxCells !== undefined && fluid.spreadCells!.size >= fluid.maxCells) {
      return;
    }
    
    // Get adjacent cells
    const adjacent = [
      { x: pos.x + 1, y: pos.y },
      { x: pos.x - 1, y: pos.y },
      { x: pos.x, y: pos.y + 1 },
      { x: pos.x, y: pos.y - 1 }
    ];
    
    // Shuffle for random spread direction
    for (let i = adjacent.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [adjacent[i], adjacent[j]] = [adjacent[j], adjacent[i]];
    }
    
    // Try to spread to an adjacent cell
    for (const target of adjacent) {
      const cellKey = `${target.x},${target.y}`;
      
      // Check if already spread to this cell
      if (fluid.spreadCells!.has(cellKey)) continue;
      
      // Check if cell is valid
      const cell = pos.grid.cell(target.x, target.y);
      if (!cell) continue;
      
      // Check if blocked
      if (fluid.blockedBy && fluid.blockedBy.includes(cell.value)) continue;
      
      // Check if another entity is already at this position
      let occupied = false;
      for (const [otherEntity, otherPos] of this.world.query(GridPositionComponent)) {
        if (otherEntity === sourceEntity) continue;
        if (otherPos.x === target.x && otherPos.y === target.y) {
          const otherFluid = this.world.getComponent(otherEntity, FluidSpreadComponent);
          if (otherFluid) {
            occupied = true;
            break;
          }
        }
      }
      
      if (occupied) continue;
      
      // Create new fluid entity at target position
      const newFluid = this.world.createEntity();
      this.world.addComponent(newFluid, GridPositionComponent, {
        x: target.x,
        y: target.y,
        grid: pos.grid
      });
      
      this.world.addComponent(newFluid, FluidSpreadComponent, {
        spreadRate: fluid.spreadRate,
        maxCells: fluid.maxCells,
        damage: fluid.damage,
        lifetime: fluid.lifetime,
        parentEntity: sourceEntity,
        isSource: false,
        blockedBy: fluid.blockedBy,
        onSpread: fluid.onSpread,
        onDie: fluid.onDie
      });
      
      // Track spread
      fluid.spreadCells!.add(cellKey);
      
      // Callback
      if (fluid.onSpread) {
        fluid.onSpread(sourceEntity, target);
      }
      
      // Only spread to one cell per tick
      break;
    }
  }
  
  /**
   * Get number of cells fluid has spread to
   */
  getSpreadCount(entity: Entity): number {
    const fluid = this.world.getComponent(entity, FluidSpreadComponent);
    return fluid?.spreadCells?.size ?? 0;
  }
  
  /**
   * Check if fluid can spread further
   */
  canSpread(entity: Entity): boolean {
    const fluid = this.world.getComponent(entity, FluidSpreadComponent);
    if (!fluid || !fluid.isSource) return false;
    
    if (fluid.maxCells !== undefined) {
      return (fluid.spreadCells?.size ?? 0) < fluid.maxCells;
    }
    
    return true;
  }
}
