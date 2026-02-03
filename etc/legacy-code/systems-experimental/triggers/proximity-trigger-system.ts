/**
 * Proximity Trigger System
 * 
 * Manages proximity-based triggers that activate when entities enter detection radius.
 */

import { System } from '@basegrid/ecs';
import { ProximityTriggerComponent } from '@basegrid/gameplay';
import { GridPositionComponent, TypeComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

export class ProximityTriggerSystem extends System {
  update(_dt: number): void {
    for (const [triggerEntity, trigger] of this.world.query(ProximityTriggerComponent)) {
      const triggerPos = this.world.getComponent(triggerEntity, GridPositionComponent);
      if (!triggerPos) continue;

      // Initialize entities in range set
      if (!trigger.entitiesInRange) {
        trigger.entitiesInRange = new Set();
      }

      const previousInRange = new Set(trigger.entitiesInRange);
      trigger.entitiesInRange.clear();

      // Find all entities within radius
      for (const [entity] of this.world.query(GridPositionComponent)) {
        if (entity === triggerEntity) continue;  // Don't trigger on self
        
        const entityPos = this.world.getComponent(entity, GridPositionComponent);
        if (!entityPos || entityPos.grid !== triggerPos.grid) continue;
        
        // Calculate distance (Manhattan distance)
        const distance = Math.abs(entityPos.x - triggerPos.x) + Math.abs(entityPos.y - triggerPos.y);
        
        if (distance <= trigger.radius) {
          // Check tag filtering
          if (trigger.activatorTags && trigger.activatorTags.length > 0) {
            const entityType = this.world.getComponent(entity, TypeComponent);
            const entityTags = entityType?.tags || [];
            const hasMatchingTag = entityTags.some(tag => trigger.activatorTags!.includes(tag));
            if (!hasMatchingTag) continue;
          }
          
          trigger.entitiesInRange.add(entity);
        }
      }

      const hasEntities = trigger.entitiesInRange.size > 0;
      const hadEntities = previousInRange.size > 0;

      // Handle cooldown
      if (trigger.cooldownTimer && trigger.cooldownTimer > 0) {
        trigger.cooldownTimer--;
        if (trigger.cooldownTimer === 0 && !hasEntities) {
          // Cooldown ended with no entities in range
          trigger.active = false;
        }
        continue;
      }

      // Check max activations
      if (trigger.maxActivations !== undefined) {
        const currentActivations = trigger.activationCount ?? 0;
        if (currentActivations >= trigger.maxActivations) {
          continue;
        }
      }

      // Continuous mode: trigger every frame while entities in range
      if (trigger.continuous && hasEntities) {
        if (!trigger.active || trigger.repeatable) {
          trigger.active = true;
          
          if (!hadEntities) {
            // New activation
            trigger.activationCount = (trigger.activationCount ?? 0) + 1;
            
            if (trigger.onActivate) {
              const activator = trigger.entitiesInRange.values().next().value;
              trigger.onActivate(triggerEntity, activator);
            }
          }
        }
      } else {
        // Standard mode: trigger once when entities enter
        if (hasEntities && !hadEntities) {
          // Entities entered range
          if (!trigger.active || trigger.repeatable) {
            trigger.active = true;
            trigger.activationCount = (trigger.activationCount ?? 0) + 1;
            
            // Start active timer if not toggle mode
            if (!trigger.toggle && trigger.activeDuration) {
              trigger.activeTimer = trigger.activeDuration;
            }
            
            if (trigger.onActivate) {
              const activator = trigger.entitiesInRange.values().next().value;
              trigger.onActivate(triggerEntity, activator);
            }
          }
        } else if (!hasEntities && hadEntities && !trigger.toggle) {
          // Entities left range
          trigger.active = false;
          
          if (trigger.onDeactivate) {
            trigger.onDeactivate(triggerEntity);
          }
          
          // Start cooldown if repeatable
          if (trigger.repeatable && trigger.cooldown) {
            trigger.cooldownTimer = trigger.cooldown;
          }
        }
      }

      // Handle active duration timer (for non-toggle mode)
      if (trigger.active && !trigger.toggle && trigger.activeTimer !== undefined) {
        trigger.activeTimer--;
        
        if (trigger.activeTimer <= 0) {
          trigger.active = false;
          trigger.activeTimer = undefined;
          
          if (trigger.onDeactivate) {
            trigger.onDeactivate(triggerEntity);
          }
          
          // Start cooldown if repeatable
          if (trigger.repeatable && trigger.cooldown) {
            trigger.cooldownTimer = trigger.cooldown;
          }
        }
      }
    }
  }
}
