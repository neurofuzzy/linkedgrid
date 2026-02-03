/**
 * One-Way Door System
 * 
 * Manages one-way door entities that restrict movement based on direction.
 * Works by checking if entities are attempting to move into door cells from
 * invalid directions and blocking that movement.
 * 
 * Note: This system provides a helper method `canPass` that movement systems
 * should call to check if movement is allowed. It does not directly move entities.
 */

import { System } from '@basegrid/ecs';
import { OneWayDoorComponent } from '@basegrid/gameplay';
import { GridPositionComponent, TypeComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { Direction } from '@basegrid/grid';

export class OneWayDoorSystem extends System {
  /**
   * Check if an entity can pass through a door at the target position
   * from the given direction.
   * 
   * @param entity - The entity attempting to move
   * @param targetX - Target X position
   * @param targetY - Target Y position
   * @param direction - Direction of movement
   * @returns true if movement is allowed, false if blocked
   */
  canPass(entity: Entity, targetX: number, targetY: number, direction: Direction): boolean {
    // Get entity's tags for filtering
    const entityType = this.world.getComponent(entity, TypeComponent);
    const entityTags = entityType?.tags || [];

    // Get entity's grid for isolation checking
    const entityPos = this.world.getComponent(entity, GridPositionComponent);
    const entityGrid = entityPos?.grid;

    // Find all doors at the target position
    for (const [doorEntity, doorComp] of this.world.query(OneWayDoorComponent)) {
      const doorPos = this.world.getComponent(doorEntity, GridPositionComponent);
      
      // Check position and grid isolation
      if (!doorPos || doorPos.x !== targetX || doorPos.y !== targetY) {
        continue;
      }

      // Enforce grid isolation
      if (entityGrid && doorPos.grid !== entityGrid) {
        continue;
      }

      // Skip inactive doors
      if (doorComp.active === false) {
        continue;
      }

      // Check if this entity should be affected by this door
      if (doorComp.affectsTags && doorComp.affectsTags.length > 0) {
        const hasMatchingTag = entityTags.some(tag => doorComp.affectsTags!.includes(tag));
        if (!hasMatchingTag) {
          continue; // This door doesn't affect this entity
        }
      }

      // Check if this entity should ignore this door
      if (doorComp.ignoresTags && doorComp.ignoresTags.length > 0) {
        const hasIgnoreTag = entityTags.some(tag => doorComp.ignoresTags!.includes(tag));
        if (hasIgnoreTag) {
          continue; // This entity ignores this door
        }
      }

      // Check if the movement direction is allowed
      const allowed = doorComp.allowedDirections.includes(direction);
      
      if (!allowed) {
        // Movement blocked
        if (doorComp.onBlocked) {
          doorComp.onBlocked(entity, direction);
        }
        return false;
      } else {
        // Movement allowed
        if (doorComp.onPass) {
          doorComp.onPass(entity, direction);
        }
      }
    }

    return true;
  }

  /**
   * Get the reverse of a direction
   */
  private reverseDirection(dir: Direction): Direction {
    switch (dir) {
      case Direction.UP: return Direction.DN;
      case Direction.DN: return Direction.UP;
      case Direction.LT: return Direction.RT;
      case Direction.RT: return Direction.LT;
      default: return dir;
    }
  }

  /**
   * Check if an entity at a door position should be pushed back
   * (for doors with blockReverse enabled)
   */
  shouldPushBack(entity: Entity, currentX: number, currentY: number): Direction | null {
    const entityType = this.world.getComponent(entity, TypeComponent);
    const entityTags = entityType?.tags || [];

    for (const [_, doorComp] of this.world.query(OneWayDoorComponent)) {
      const doorPos = this.world.getComponent(_, GridPositionComponent);
      
      if (!doorPos || doorPos.x !== currentX || doorPos.y !== currentY) {
        continue;
      }

      if (doorComp.active === false || !doorComp.blockReverse) {
        continue;
      }

      // Check entity filtering
      if (doorComp.affectsTags && doorComp.affectsTags.length > 0) {
        const hasMatchingTag = entityTags.some(tag => doorComp.affectsTags!.includes(tag));
        if (!hasMatchingTag) continue;
      }

      if (doorComp.ignoresTags && doorComp.ignoresTags.length > 0) {
        const hasIgnoreTag = entityTags.some(tag => doorComp.ignoresTags!.includes(tag));
        if (hasIgnoreTag) continue;
      }

      // Return the push direction (reverse of allowed directions)
      if (doorComp.allowedDirections.length > 0) {
        return doorComp.allowedDirections[0];
      }
    }

    return null;
  }

  update(_dt: number): void {
    // This system is primarily used via its helper methods
    // No per-frame logic needed unless implementing push-back
  }
}
