import { System } from '@basegrid/ecs';
import { GridPositionComponent, VisualComponent, TypeComponent, SpatialQuerySystem } from '@basegrid/ecs';
import { InputCommandComponent } from '@basegrid/ecs';
import { Direction } from '@basegrid/grid';
import { isBlockingLayer } from '@basegrid/ecs/layer-constants';
import { PushSystem } from './push-system';
import { PushableComponent, PusherComponent } from '../../components/level-mechanics/pushable';

/**
 * Cardinal Movement System - Handles grid-based player movement with collision detection.
 * 
 * This system reads InputCommandComponent and moves entities along cardinal directions
 * (up, down, left, right) with proper collision detection using:
 * - Layer-based blocking (layers 4+ block by default)
 * - TypeComponent tags ('wall', 'impassable')
 * - PushSystem integration for pushable objects
 * 
 * **Architecture:**
 * - InputCommandComponent → CardinalMovementSystem → GridPositionComponent updates
 * - Integrates with PushSystem for Sokoban-style mechanics
 * - Supports collectible pickup via callbacks
 * 
 * @example
 * ```typescript
 * const world = new World();
 * world.addSystem(new PlayerInputSystem(inputManager));
 * world.addSystem(new CardinalMovementSystem({
 *   onCollect: (entity, collectedEntity, type) => {
 *     if (type === 'coin') {
 *       world.destroyEntity(collectedEntity);
 *       coinsCollected++;
 *     }
 *   }
 * }));
 * world.addSystem(new PushSystem());
 * world.addSystem(new GridRenderSystem(grid));
 * ```
 */

export interface CardinalMovementConfig {
  /**
   * Callback when entity collects a non-blocking item.
   * @param mover - Entity that moved
   * @param collected - Entity that was collected
   * @param type - Type from TypeComponent.type
   */
  onCollect?: (mover: number, collected: number, type: string) => void;
  
  /**
   * Whether to automatically clear input direction after processing.
   * Default: true (prevents continuous movement)
   */
  clearDirection?: boolean;
  
  /**
   * Movement mode:
   * - 'continuous': Hold key = keep moving (good for real-time games)
   * - 'tap': Each keypress = one move (good for puzzle games like Sokoban)
   * - 'propelled': Press direction once, keep moving until wall (Pac-Man style)
   * Default: 'continuous'
   */
  movementMode?: 'continuous' | 'tap' | 'propelled';
}

export class CardinalMovementSystem extends System {
  private config: CardinalMovementConfig;
  private lastDirection: Map<number, Direction> = new Map();
  private propelledDirection: Map<number, Direction> = new Map();
  
  constructor(config: CardinalMovementConfig = {}) {
    super();
    this.config = {
      clearDirection: true,
      movementMode: 'continuous',
      ...config
    };
  }
  
  update(_dt: number): void {
    // Process all entities with InputCommandComponent
    for (const [entity, cmd, pos] of this.world.queryMultiple(
      InputCommandComponent,
      GridPositionComponent
    )) {
      if (!cmd.enabled) continue;
      
      if (this.config.movementMode === 'propelled') {
        // Propelled mode: Pac-Man style automatic movement
        this.updatePropelled(entity, cmd, pos);
      } else {
        // Continuous or tap mode
        if (cmd.direction === Direction.NONE) {
          this.lastDirection.set(entity, Direction.NONE);
          continue;
        }
        
        // In tap mode, only move if direction changed
        if (this.config.movementMode === 'tap') {
          const lastDir = this.lastDirection.get(entity) ?? Direction.NONE;
          if (cmd.direction === lastDir && lastDir !== Direction.NONE) {
            continue;
          }
          this.lastDirection.set(entity, cmd.direction);
        }
        
        // Try to move in the commanded direction
        this.tryMove(entity, cmd.direction, pos);
        
        // Clear direction after processing
        if (this.config.clearDirection) {
          cmd.direction = Direction.NONE;
        }
      }
    }
  }
  
  private updatePropelled(entity: number, cmd: InputCommandComponent, pos: GridPositionComponent): void {
    // Accept new direction input
    if (cmd.direction !== Direction.NONE) {
      const currentDir = this.propelledDirection.get(entity) ?? Direction.NONE;
      if (currentDir === Direction.NONE) {
        // Not moving, start immediately
        this.propelledDirection.set(entity, cmd.direction);
      } else {
        // Moving, try to turn at junction
        const cell = pos.grid.cell(pos.x, pos.y);
        if (cell) {
          const neighbor = cell.neighbor(cmd.direction);
          if (neighbor && this.canMoveToCell(entity, neighbor.x, neighbor.y, pos.grid)) {
            // Can turn, do it now
            this.propelledDirection.set(entity, cmd.direction);
          }
        }
      }
      cmd.direction = Direction.NONE;
    }
    
    // Move in propelled direction
    const currentDir = this.propelledDirection.get(entity);
    if (currentDir && currentDir !== Direction.NONE) {
      const moved = this.tryMove(entity, currentDir, pos);
      if (!moved) {
        // Hit wall, stop
        this.propelledDirection.set(entity, Direction.NONE);
      }
    }
  }
  
  private canMoveToCell(entity: number, targetX: number, targetY: number, grid: any): boolean {
    // Use SpatialQuerySystem if available for optimized position checking
    const spatialQuery = this.world.getSystem(SpatialQuerySystem);
    if (spatialQuery) {
      return !spatialQuery.isBlocked(grid, targetX, targetY, entity);
    }
    
    // Fallback to manual check (if SpatialQuerySystem not added to world)
    for (const [otherEntity, entityPos] of this.world.query(GridPositionComponent)) {
      if (otherEntity === entity) continue;
      if (entityPos.x !== targetX || entityPos.y !== targetY || entityPos.grid !== grid) continue;
      
      const visual = this.world.getComponent(otherEntity, VisualComponent);
      if (!visual) continue;
      
      const layer = visual.layer ?? 0;
      if (!isBlockingLayer(layer)) continue;
      
      return false;
    }
    return true;
  }
  
  /**
   * Attempt to move an entity in a direction.
   * Handles collision detection, pushing, and collection.
   */
  private tryMove(entity: number, direction: Direction, pos: GridPositionComponent): boolean {
    const cell = pos.grid.cell(pos.x, pos.y);
    if (!cell) return false;
    
    // Get neighbor cell in direction
    const neighbor = cell.neighbor(direction);
    if (!neighbor) return false;
    
    const targetX = neighbor.x;
    const targetY = neighbor.y;
    
    // Check what's at target position
    const collision = this.checkCollision(entity, targetX, targetY, pos.grid);
    
    if (collision.blocked) {
      return false;  // Blocked by wall or impassable entity
    }
    
    // Handle pushable entity
    if (collision.pushable !== null) {
      const pusher = this.world.getComponent(entity, PusherComponent);
      if (pusher) {
        const pushSystem = this.world.getSystem(PushSystem);
        if (pushSystem) {
          const pushed = pushSystem.tryPush(entity, direction);
          if (!pushed) return false;  // Push failed
        } else {
          return false;  // Can't push without PushSystem
        }
      } else {
        return false;  // Entity can't push
      }
    }
    
    // Collect non-blocking entities
    if (collision.collectibles.length > 0 && this.config.onCollect) {
      for (const collectedEntity of collision.collectibles) {
        const type = this.world.getComponent(collectedEntity, TypeComponent);
        if (type) {
          this.config.onCollect(entity, collectedEntity, type.type);
        }
      }
    }
    
    // Move entity
    pos.x = targetX;
    pos.y = targetY;
    
    return true;
  }
  
  /**
   * Check collision at target position.
   * Returns what's blocking and what can be collected/pushed.
   */
  private checkCollision(
    mover: number, 
    x: number, 
    y: number, 
    grid: any
  ): {
    blocked: boolean;
    pushable: number | null;
    collectibles: number[];
  } {
    const result = {
      blocked: false,
      pushable: null as number | null,
      collectibles: [] as number[]
    };
    
    // Query all entities at target position
    for (const [entity, entityPos] of this.world.query(GridPositionComponent)) {
      // Skip self
      if (entity === mover) continue;
      
      // Skip if not at target position
      if (entityPos.x !== x || entityPos.y !== y || entityPos.grid !== grid) continue;
      
      // Get visual to check layer
      const visual = this.world.getComponent(entity, VisualComponent);
      if (!visual) continue;
      
      const layer = visual.layer ?? 0;
      
      // Non-blocking layers (0-3): collectibles, floors, etc.
      if (!isBlockingLayer(layer)) {
        result.collectibles.push(entity);
        continue;
      }
      
      // Blocking layers (4+): Check if pushable or wall
      const pushable = this.world.getComponent(entity, PushableComponent);
      if (pushable && pushable.pushable !== false) {
        result.pushable = entity;
        continue;  // Don't block yet - mover might be able to push
      }
      
      // Check if it's a permanent obstacle
      const type = this.world.getComponent(entity, TypeComponent);
      if (type?.tags?.includes('wall') || type?.tags?.includes('impassable')) {
        result.blocked = true;
        break;  // Walls always block
      }
      
      // Any other blocking entity without pushable component blocks movement
      result.blocked = true;
      break;
    }
    
    return result;
  }
}
