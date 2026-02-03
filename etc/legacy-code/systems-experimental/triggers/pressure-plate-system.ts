/**
 * Pressure Plate System
 * 
 * Manages pressure plate triggers that activate when entities step on them.
 */

import { System } from '@basegrid/ecs';
import { PressurePlateComponent } from '@basegrid/gameplay';
import { GridPositionComponent, TypeComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

export class PressurePlateSystem extends System {
  update(_dt: number): void {
    for (const [plateEntity, plate] of this.world.query(PressurePlateComponent)) {
      const platePos = this.world.getComponent(plateEntity, GridPositionComponent);
      if (!platePos) continue;

      // Initialize entities on plate set
      if (!plate.entitiesOnPlate) {
        plate.entitiesOnPlate = new Set();
      }

      // Find all entities at plate position
      const entitiesAtPosition = new Set<Entity>();
      
      for (const [entity] of this.world.query(GridPositionComponent)) {
        if (entity === plateEntity) continue;  // Don't trigger on self
        
        const entityPos = this.world.getComponent(entity, GridPositionComponent);
        if (!entityPos || entityPos.grid !== platePos.grid) continue;
        
        // Check if entity is at plate position
        if (entityPos.x === platePos.x && entityPos.y === platePos.y) {
          // Check tag filtering
          if (plate.activatorTags && plate.activatorTags.length > 0) {
            const entityType = this.world.getComponent(entity, TypeComponent);
            const entityTags = entityType?.tags || [];
            const hasMatchingTag = entityTags.some(tag => plate.activatorTags!.includes(tag));
            if (!hasMatchingTag) continue;
          }
          
          entitiesAtPosition.add(entity);
        }
      }

      // Check weight requirement
      const weightRequired = plate.weightRequired ?? 1;
      const shouldBeActive = entitiesAtPosition.size >= weightRequired;

      // Check if plate state should change
      const wasActive = plate.active;
      
      // Handle cooldown
      if (plate.cooldownTimer && plate.cooldownTimer > 0) {
        plate.cooldownTimer--;
        continue;
      }

      // Check max activations
      if (plate.maxActivations !== undefined) {
        const currentActivations = plate.activationCount ?? 0;
        if (currentActivations >= plate.maxActivations) {
          // Plate is exhausted
          continue;
        }
      }

      // Update plate state
      if (shouldBeActive && !wasActive) {
        // Activate plate
        if (!wasActive || plate.repeatable) {
          plate.active = true;
          plate.activationCount = (plate.activationCount ?? 0) + 1;
          
          // Start active timer if not toggle mode
          if (!plate.toggle && plate.activeDuration) {
            plate.activeTimer = plate.activeDuration;
          }
          
          // Callback
          if (plate.onActivate) {
            // Get first activator for callback
            const activator = entitiesAtPosition.values().next().value;
            plate.onActivate(plateEntity, activator);
          }
        }
      } else if (!shouldBeActive && wasActive && !plate.toggle) {
        // Deactivate plate (not toggle mode, entities left)
        plate.active = false;
        
        if (plate.onDeactivate) {
          plate.onDeactivate(plateEntity);
        }
        
        // Start cooldown if repeatable
        if (plate.repeatable && plate.cooldown) {
          plate.cooldownTimer = plate.cooldown;
        }
      }

      // Handle active duration timer (for non-toggle mode)
      if (plate.active && !plate.toggle && plate.activeTimer !== undefined) {
        plate.activeTimer--;
        
        if (plate.activeTimer <= 0) {
          plate.active = false;
          plate.activeTimer = undefined;
          
          if (plate.onDeactivate) {
            plate.onDeactivate(plateEntity);
          }
          
          // Start cooldown if repeatable
          if (plate.repeatable && plate.cooldown) {
            plate.cooldownTimer = plate.cooldown;
          }
        }
      }

      // Store current entities for next frame
      plate.entitiesOnPlate = entitiesAtPosition;
    }
  }
}
