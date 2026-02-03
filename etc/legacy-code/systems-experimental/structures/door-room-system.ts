import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { DoorComponent, RoomComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';
import { CollectorComponent } from '@basegrid/gameplay';

/**
 * Door Room System
 * 
 * Manages doors and room transitions.
 * Handles door states, unlocking, and room tracking.
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const doorSystem = new DoorRoomSystem();
 * world.addSystem(doorSystem);
 * 
 * // Create room
 * const room = world.createEntity();
 * world.addComponent(room, RoomComponent, {
 *   id: 'entrance',
 *   bounds: { x: 0, y: 0, width: 10, height: 10 }
 * });
 * 
 * // Create door
 * const door = world.createEntity();
 * world.addComponent(door, GridPositionComponent, { x: 5, y: 5, grid });
 * world.addComponent(door, DoorComponent, {
 *   state: 'closed',
 *   locked: true,
 *   requiredKey: 'key-1'
 * });
 * ```
 */
export class DoorRoomSystem extends System {
  /**
   * Update doors and rooms
   */
  update(dt: number): void {
    this.updateDoors(dt);
    this.updateRooms();
  }
  
  /**
   * Update door states and timers
   */
  private updateDoors(dt: number): void {
    for (const [entity, door] of this.world.query(DoorComponent)) {
      // Handle animation
      if (door.state === 'opening' || door.state === 'closing') {
        if (door.animationTimer === undefined) {
          door.animationTimer = door.animationDuration ?? 0.5;
        }
        
        door.animationTimer -= dt;
        if (door.animationTimer <= 0) {
          // Animation complete
          if (door.state === 'opening') {
            door.state = 'open';
            if (door.onOpen) {
              door.onOpen(entity);
            }
          } else {
            door.state = 'closed';
            if (door.onClose) {
              door.onClose(entity);
            }
          }
          door.animationTimer = undefined;
        }
      }
      
      // Handle auto-close
      if (door.state === 'open' && door.autoCloseDelay && door.autoCloseDelay > 0) {
        if (door.autoCloseTimer === undefined) {
          door.autoCloseTimer = door.autoCloseDelay;
        }
        
        door.autoCloseTimer -= dt;
        if (door.autoCloseTimer <= 0) {
          this.closeDoor(entity);
          door.autoCloseTimer = undefined;
        }
      }
    }
  }
  
  /**
   * Update room entity tracking
   */
  private updateRooms(): void {
    for (const [roomEntity, room] of this.world.query(RoomComponent)) {
      if (!room.active) continue;
      
      // Initialize tracking
      if (!room.entitiesInRoom) {
        room.entitiesInRoom = new Set();
      }
      
      // Find entities in room bounds
      const previousEntities = new Set(room.entitiesInRoom);
      room.entitiesInRoom.clear();
      
      for (const [entity, pos] of this.world.query(GridPositionComponent)) {
        if (entity === roomEntity) continue;
        
        // Check if in bounds
        if (this.isInBounds(pos.x, pos.y, room.bounds)) {
          room.entitiesInRoom.add(entity);
        }
      }
      
      // Fire enter callbacks
      if (room.onEnter) {
        for (const entity of room.entitiesInRoom) {
          if (!previousEntities.has(entity)) {
            room.onEnter(roomEntity, entity);
          }
        }
      }
      
      // Fire exit callbacks
      if (room.onExit) {
        for (const entity of previousEntities) {
          if (!room.entitiesInRoom.has(entity)) {
            room.onExit(roomEntity, entity);
          }
        }
      }
    }
  }
  
  /**
   * Check if point is in bounds
   */
  private isInBounds(x: number, y: number, bounds: { x: number; y: number; width: number; height: number }): boolean {
    return x >= bounds.x && x < bounds.x + bounds.width &&
           y >= bounds.y && y < bounds.y + bounds.height;
  }
  
  /**
   * Open door
   */
  openDoor(entity: Entity, opener?: Entity): boolean {
    const door = this.world.getComponent(entity, DoorComponent);
    if (!door) return false;
    
    // Check if locked
    if (door.locked) {
      // Check if opener has key
      if (opener && door.requiredKey) {
        const collector = this.world.getComponent(opener, CollectorComponent);
        if (collector && collector.inventory[door.requiredKey]) {
          // Has key, unlock
          door.locked = false;
          if (door.onUnlock) {
            door.onUnlock(entity, opener);
          }
        } else {
          return false;
        }
      } else {
        return false;
      }
    }
    
    // Open door
    if (door.state === 'closed') {
      door.state = 'opening';
      door.animationTimer = door.animationDuration ?? 0.5;
      door.autoCloseTimer = undefined;
      return true;
    }
    
    return false;
  }
  
  /**
   * Close door
   */
  closeDoor(entity: Entity): boolean {
    const door = this.world.getComponent(entity, DoorComponent);
    if (!door) return false;
    
    if (door.state === 'open') {
      door.state = 'closing';
      door.animationTimer = door.animationDuration ?? 0.5;
      return true;
    }
    
    return false;
  }
  
  /**
   * Toggle door state
   */
  toggleDoor(entity: Entity, opener?: Entity): boolean {
    const door = this.world.getComponent(entity, DoorComponent);
    if (!door) return false;
    
    if (door.state === 'closed') {
      return this.openDoor(entity, opener);
    } else if (door.state === 'open') {
      return this.closeDoor(entity);
    }
    
    return false;
  }
  
  /**
   * Unlock door
   */
  unlockDoor(entity: Entity, unlocker: Entity): boolean {
    const door = this.world.getComponent(entity, DoorComponent);
    if (!door || !door.locked) return false;
    
    // Check for key
    if (door.requiredKey) {
      const collector = this.world.getComponent(unlocker, CollectorComponent);
      if (!collector || !collector.inventory[door.requiredKey]) {
        return false;
      }
    }
    
    door.locked = false;
    if (door.onUnlock) {
      door.onUnlock(entity, unlocker);
    }
    
    return true;
  }
  
  /**
   * Get room for entity
   */
  getRoomForEntity(entity: Entity): Entity | undefined {
    const pos = this.world.getComponent(entity, GridPositionComponent);
    if (!pos) return undefined;
    
    for (const [roomEntity, room] of this.world.query(RoomComponent)) {
      if (room.active && this.isInBounds(pos.x, pos.y, room.bounds)) {
        return roomEntity;
      }
    }
    
    return undefined;
  }
  
  /**
   * Get entities in room
   */
  getEntitiesInRoom(roomEntity: Entity): Entity[] {
    const room = this.world.getComponent(roomEntity, RoomComponent);
    return room?.entitiesInRoom ? Array.from(room.entitiesInRoom) : [];
  }
  
  /**
   * Check if door is open
   */
  isDoorOpen(entity: Entity): boolean {
    const door = this.world.getComponent(entity, DoorComponent);
    return door?.state === 'open';
  }
}
