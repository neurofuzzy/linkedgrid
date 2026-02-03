import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { PushableComponent, PusherComponent } from '@basegrid/gameplay';
import { GridPositionComponent, VisualComponent } from '@basegrid/ecs';
import { TypeComponent } from '@basegrid/ecs';
import { Direction } from '@basegrid/grid';
import { isBlockingLayer } from '@basegrid/ecs/layer-constants';

/**
 * Push System
 * 
 * Handles entity pushing mechanics.
 * 
 * Features:
 * - Push chains (push multiple objects)
 * - Push strength and weight
 * - Block detection
 * - Tag-based pushing
 * - Callbacks
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const pushSystem = new PushSystem();
 * world.addSystem(pushSystem);
 * 
 * // Try to push in a direction
 * pushSystem.tryPush(player, Direction.RT);
 * ```
 */
export class PushSystem extends System {
  /**
   * Update push system (no per-frame logic needed)
   */
  update(_dt: number): void {
    // Push system is event-driven
  }
  
  /**
   * Try to push entities in a direction from pusher position
   */
  tryPush(pusher: Entity, direction: Direction): boolean {
    const pusherComp = this.world.getComponent(pusher, PusherComponent);
    if (!pusherComp || pusherComp.canPush === false) return false;
    
    const pusherPos = this.world.getComponent(pusher, GridPositionComponent);
    if (!pusherPos) return false;
    
    // Get cell in push direction
    const cell = pusherPos.grid.cell(pusherPos.x, pusherPos.y);
    if (!cell) return false;
    
    const targetCell = cell.neighbor(direction);
    if (!targetCell) return false;
    
    // Find pushable entity at target position
    const targetEntity = this.findPushableAt(targetCell.x, targetCell.y, pusherPos.grid);
    if (!targetEntity) return false;
    
    // Try to push the entity
    const result = this.pushEntity(pusher, targetEntity, direction, pusherComp);
    
    if (result && pusherComp.onPushSuccess) {
      pusherComp.onPushSuccess(pusher, targetEntity, direction);
    } else if (!result && pusherComp.onPushFail) {
      pusherComp.onPushFail(pusher, targetEntity, direction);
    }
    
    return result;
  }
  
  /**
   * Push a specific entity in a direction
   */
  pushEntity(pusher: Entity | null, entity: Entity, direction: Direction, pusherComp?: PusherComponent): boolean {
    const pushable = this.world.getComponent(entity, PushableComponent);
    if (!pushable || pushable.pushable === false) return false;
    
    const entityPos = this.world.getComponent(entity, GridPositionComponent);
    if (!entityPos) return false;
    
    // Check pusher requirements
    if (pusher && pushable.requiredPusherTags) {
      const pusherType = this.world.getComponent(pusher, TypeComponent);
      const pusherTags = pusherType?.tags || [];
      
      const hasRequiredTag = pushable.requiredPusherTags.some(tag => 
        pusherTags.includes(tag)
      );
      
      if (!hasRequiredTag) return false;
    }
    
    // Check weight vs strength
    if (pusher && pusherComp && pushable.weight !== undefined) {
      const strength = pusherComp.pushStrength ?? 1;
      if (pushable.weight > strength) return false;
    }
    
    // Get target cell
    const cell = entityPos.grid.cell(entityPos.x, entityPos.y);
    if (!cell) return false;
    
    const targetCell = cell.neighbor(direction);
    if (!targetCell) return false;
    
    // Check if blocked by terrain OR blocking entities
    if (pushable.blockedBy) {
      const cellValue = targetCell.values[0];
      if (pushable.blockedBy.includes(cellValue)) {
        if (pushable.onPushBlocked) {
          pushable.onPushBlocked(entity, direction);
        }
        return false;
      }
      
      // CRITICAL: Also check for blocking ENTITIES at target position
      // (GridRenderSystem may not have synced entity visuals to grid yet)
      const blockingEntity = this.findBlockingEntityAt(targetCell.x, targetCell.y, entityPos.grid, pushable.blockedBy);
      if (blockingEntity) {
        if (pushable.onPushBlocked) {
          pushable.onPushBlocked(entity, direction);
        }
        return false;
      }
    }
    
    // Check for push chain (another pushable at target)
    if (pushable.canPushOthers) {
      const chainEntity = this.findPushableAt(targetCell.x, targetCell.y, entityPos.grid);
      if (chainEntity) {
        const maxChain = pushable.maxChainLength ?? 1;
        if (maxChain > 0) {
          // Try to push the chain
          const chainPushable = this.world.getComponent(chainEntity, PushableComponent);
          if (chainPushable) {
            chainPushable.maxChainLength = maxChain - 1;
            const chainResult = this.pushEntity(entity, chainEntity, direction, pusherComp);
            chainPushable.maxChainLength = maxChain; // Restore
            
            if (!chainResult) {
              if (pushable.onPushBlocked) {
                pushable.onPushBlocked(entity, direction);
              }
              return false;
            }
          }
        } else {
          if (pushable.onPushBlocked) {
            pushable.onPushBlocked(entity, direction);
          }
          return false;
        }
      }
    } else {
      // Check if target cell is occupied by another entity
      const blockingEntity = this.findEntityAt(targetCell.x, targetCell.y, entityPos.grid, entity);
      if (blockingEntity) {
        if (pushable.onPushBlocked) {
          pushable.onPushBlocked(entity, direction);
        }
        return false;
      }
    }
    
    // Perform push - just update position (GridRenderSystem will sync visual)
    entityPos.x = targetCell.x;
    entityPos.y = targetCell.y;
    
    if (pushable.onPush) {
      pushable.onPush(entity, direction, pusher ?? undefined);
    }
    
    return true;
  }
  
  /**
   * Find pushable entity at position
   */
  private findPushableAt(x: number, y: number, grid: any): Entity | null {
    for (const [entity, pushable] of this.world.query(PushableComponent)) {
      if (pushable.pushable === false) continue;
      
      const pos = this.world.getComponent(entity, GridPositionComponent);
      if (!pos || pos.grid !== grid) continue;
      if (pos.x === x && pos.y === y) {
        return entity;
      }
    }
    return null;
  }
  
  /**
   * Find blocking entity at position with specific cell values
   * 
   * This checks if there's an entity at (x,y) whose VisualComponent.cellValue
   * matches one of the blockedBy values. This is critical because GridRenderSystem
   * may not have synced entity visuals to grid cells yet.
   */
  private findBlockingEntityAt(x: number, y: number, grid: any, blockedBy: number[]): Entity | null {
    for (const [entity, visual] of this.world.query(VisualComponent)) {
      const pos = this.world.getComponent(entity, GridPositionComponent);
      if (!pos || pos.grid !== grid) continue;
      if (pos.x === x && pos.y === y) {
        // Check if this entity's cellValue is in the blockedBy list
        if (visual.cellValue !== undefined && blockedBy.includes(visual.cellValue)) {
          return entity;
        }
      }
    }
    return null;
  }
  
  /**
   * Find any blocking entity at position (excluding self and non-blocking layers)
   * 
   * Uses 8-layer runtime system for 2.5D collision:
   * - Layers 0-3 (background, floors, ai, powerups) are non-blocking
   * - Layers 4+ (moving-entities, walls) are blocking
   */
  private findEntityAt(x: number, y: number, grid: any, exclude?: Entity): Entity | null {
    for (const [entity, pos] of this.world.query(GridPositionComponent)) {
      if (entity === exclude) continue;
      if (pos.grid !== grid) continue;
      if (pos.x === x && pos.y === y) {
        // Check entity's runtime layer to determine if it blocks
        const visual = this.world.getComponent(entity, VisualComponent);
        if (visual) {
          const layer = visual.layer ?? 0;
          if (!isBlockingLayer(layer)) {
            continue; // Layers 0-3 don't block
          }
        }
        return entity; // This entity blocks
      }
    }
    return null;
  }
  
  /**
   * Check if entity can be pushed
   */
  canPush(entity: Entity): boolean {
    const pushable = this.world.getComponent(entity, PushableComponent);
    return pushable ? pushable.pushable !== false : false;
  }
}
