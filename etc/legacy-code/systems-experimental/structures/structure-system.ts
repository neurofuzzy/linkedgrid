import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { StructureBlockComponent } from '@basegrid/gameplay';
import { StructureComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';

/**
 * Structure System - Detects and manages connected block structures
 * 
 * Automatically groups adjacent StructureBlock entities into Structure meta-entities:
 * - Uses BFS to find connected blocks via adjacency
 * - Creates Structure entities to represent groups
 * - Updates structures when blocks added/removed
 * - Validates structure integrity
 * 
 * Blocks connect when:
 * - Adjacent (using cell.neighbors())
 * - On same grid
 * - Same blockType (if specified)
 * - Both have connectable: true
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const structureSystem = new StructureSystem();
 * world.addSystem(structureSystem);
 * 
 * // Create building blocks
 * const block1 = world.createEntity();
 * world.addComponent(block1, StructureBlockComponent, { blockType: 'stone' });
 * world.addComponent(block1, GridPositionComponent, { x: 5, y: 5, grid });
 * 
 * const block2 = world.createEntity();
 * world.addComponent(block2, StructureBlockComponent, { blockType: 'stone' });
 * world.addComponent(block2, GridPositionComponent, { x: 6, y: 5, grid });
 * 
 * // System auto-detects they're connected and creates Structure
 * world.update(16.67);
 * 
 * // Both blocks have same structureId
 * const id1 = world.getComponent(block1, StructureBlockComponent).structureId;
 * const id2 = world.getComponent(block2, StructureBlockComponent).structureId;
 * assert(id1 === id2);
 * ```
 */
export class StructureSystem extends System {
  private nextStructureId = 1;
  
  /**
   * Update structure system
   */
  update(_dt: number): void {
    // 1. Find all unassigned blocks and create structures
    this.detectNewStructures();
    
    // 2. Validate existing structures (blocks may have been removed)
    this.validateStructures();
    
    // 3. Update structure bounds
    this.updateStructureBounds();
  }
  
  /**
   * Detect new structures from unassigned blocks
   */
  private detectNewStructures(): void {
    // Find blocks without structure assignment
    const unassignedBlocks: Entity[] = [];
    
    for (const [entity, block] of this.world.query(StructureBlockComponent)) {
      if (block.structureId === undefined) {
        unassignedBlocks.push(entity);
      }
    }
    
    // Process each unassigned block
    for (const blockEntity of unassignedBlocks) {
      const block = this.world.getComponent(blockEntity, StructureBlockComponent);
      if (!block || block.structureId !== undefined) continue; // May have been assigned already
      
      // Find all connected blocks via BFS
      const connectedBlocks = this.findConnectedBlocks(blockEntity);
      
      if (connectedBlocks.size > 0) {
        // Create structure entity
        this.createStructure(connectedBlocks);
      }
    }
  }
  
  /**
   * Find all blocks connected to start block via BFS
   */
  private findConnectedBlocks(startEntity: Entity): Set<Entity> {
    const connected = new Set<Entity>();
    const queue: Entity[] = [startEntity];
    const visited = new Set<Entity>();
    
    const startBlock = this.world.getComponent(startEntity, StructureBlockComponent);
    const startPos = this.world.getComponent(startEntity, GridPositionComponent);
    if (!startBlock || !startPos) return connected;
    
    const blockType = startBlock.blockType;
    const grid = startPos.grid;
    
    while (queue.length > 0) {
      const entity = queue.shift()!;
      if (visited.has(entity)) continue;
      visited.add(entity);
      
      const block = this.world.getComponent(entity, StructureBlockComponent);
      const pos = this.world.getComponent(entity, GridPositionComponent);
      
      if (!block || !pos) continue;
      if (pos.grid !== grid) continue;
      
      // Check if connectable
      if (block.connectable === false) continue;
      
      // Check if same type (if types are specified)
      if (blockType !== undefined && block.blockType !== blockType) continue;
      
      // Add to connected set
      connected.add(entity);
      
      // Find adjacent blocks
      const cell = pos.grid.cell(pos.x, pos.y);
      if (!cell) continue;
      
      const neighbors = cell.neighbors().filter(n => n !== null);
      
      for (const neighbor of neighbors) {
        if (!neighbor) continue;
        
        // Find blocks at neighbor position
        for (const [neighborEntity, neighborBlock] of this.world.query(StructureBlockComponent)) {
          if (visited.has(neighborEntity)) continue;
          
          const neighborPos = this.world.getComponent(neighborEntity, GridPositionComponent);
          if (!neighborPos) continue;
          
          // Check if at neighbor position and same grid
          if (neighborPos.grid !== grid) continue;
          if (neighborPos.x !== neighbor.x || neighborPos.y !== neighbor.y) continue;
          
          // Add to queue
          queue.push(neighborEntity);
        }
      }
    }
    
    return connected;
  }
  
  /**
   * Create structure entity from connected blocks
   */
  private createStructure(blocks: Set<Entity>): Entity {
    const structureId = this.nextStructureId++;
    
    // Assign structure ID to all blocks
    for (const blockEntity of blocks) {
      const block = this.world.getComponent(blockEntity, StructureBlockComponent);
      if (block) {
        block.structureId = structureId;
      }
    }
    
    // Create structure meta-entity
    const structureEntity = this.world.createEntity();
    this.world.addComponent(structureEntity, StructureComponent, {
      id: structureId,
      blocks: new Set(blocks)
    });
    
    return structureEntity;
  }
  
  /**
   * Validate existing structures (remove destroyed blocks, split if disconnected)
   */
  private validateStructures(): void {
    const toRemove: Entity[] = [];
    
    for (const [structureEntity, structure] of this.world.query(StructureComponent)) {
      // Remove blocks that no longer exist
      const validBlocks = new Set<Entity>();
      
      for (const blockEntity of structure.blocks) {
        if (this.world.hasComponent(blockEntity, StructureBlockComponent)) {
          validBlocks.add(blockEntity);
        }
      }
      
      // Check if structure is empty
      if (validBlocks.size === 0) {
        toRemove.push(structureEntity);
        continue;
      }
      
      // Check if structure is still connected
      if (validBlocks.size !== structure.blocks.size) {
        // Blocks were removed - need to re-validate connectivity
        const stillConnected = this.findConnectedBlocks(Array.from(validBlocks)[0]);
        
        if (stillConnected.size < validBlocks.size) {
          // Structure split! Remove this structure and let detectNewStructures rebuild
          toRemove.push(structureEntity);
          
          // Clear structure IDs from blocks
          for (const blockEntity of validBlocks) {
            const block = this.world.getComponent(blockEntity, StructureBlockComponent);
            if (block) {
              block.structureId = undefined;
            }
          }
        } else {
          // Still connected, just update block set
          structure.blocks = stillConnected;
        }
      }
    }
    
    // Remove invalid structures
    for (const entity of toRemove) {
      this.world.destroyEntity(entity);
    }
  }
  
  /**
   * Update structure bounds
   */
  private updateStructureBounds(): void {
    for (const [_, structure] of this.world.query(StructureComponent)) {
      if (structure.blocks.size === 0) continue;
      
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let grid: any = null;
      
      for (const blockEntity of structure.blocks) {
        const pos = this.world.getComponent(blockEntity, GridPositionComponent);
        if (!pos) continue;
        
        if (!grid) grid = pos.grid;
        
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
      }
      
      structure.bounds = { minX, maxX, minY, maxY };
      structure.grid = grid;
    }
  }
}
