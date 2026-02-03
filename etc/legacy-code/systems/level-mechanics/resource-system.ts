/**
 * Resource System
 * 
 * Manages renewable and depletable resources with harvesting.
 * 
 * Features:
 * - Multiple harvests per resource
 * - Harvest cooldowns
 * - Renewable resources (regenerate over time)
 * - Depletion states (for visual feedback)
 * - Tag-based filtering
 * - Inventory tracking
 */

import { System } from '@basegrid/ecs';
import { ResourceComponent, HarvesterComponent } from '@basegrid/gameplay';
import { GridPositionComponent, TypeComponent, VisualComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

export class ResourceSystem extends System {
  update(_dt: number): void {
    // Update resource cooldowns and regeneration
    for (const [resourceEntity, resource] of this.world.query(ResourceComponent)) {
      // Handle harvest cooldown
      if (resource.cooldownTimer !== undefined && resource.cooldownTimer > 0) {
        resource.cooldownTimer--;
      }

      // Handle regeneration
      if (resource.renewable && resource.yieldsRemaining < resource.maxYields) {
        if (resource.regenTimer === undefined && resource.regenTime) {
          resource.regenTimer = resource.regenTime;
        }
        
        if (resource.regenTimer !== undefined && resource.regenTimer > 0) {
          resource.regenTimer--;
          
          if (resource.regenTimer === 0) {
            // Regenerate one yield
            resource.yieldsRemaining = Math.min(resource.yieldsRemaining + 1, resource.maxYields);
            this.updateDepletionState(resourceEntity, resource);
            
            // Reset timer for next regeneration
            if (resource.yieldsRemaining < resource.maxYields && resource.regenTime) {
              resource.regenTimer = resource.regenTime;
            }
            
            // Callback
            if (resource.onRegenerate) {
              resource.onRegenerate(resourceEntity);
            }
          }
        }
      }

      // Check for harvesters
      if (resource.yieldsRemaining > 0 && (resource.cooldownTimer === undefined || resource.cooldownTimer === 0)) {
        this.checkHarvesting(resourceEntity);
      }
    }
  }

  /**
   * Check if any harvesters can harvest this resource
   */
  private checkHarvesting(resourceEntity: Entity): void {
    const resource = this.world.getComponent(resourceEntity, ResourceComponent);
    if (!resource || resource.yieldsRemaining <= 0) return;

    const resourcePos = this.world.getComponent(resourceEntity, GridPositionComponent);
    if (!resourcePos) return;

    // Check for harvesters
    for (const [harvesterEntity, harvester] of this.world.query(HarvesterComponent)) {
      if (harvester.active === false) continue;

      const harvesterPos = this.world.getComponent(harvesterEntity, GridPositionComponent);
      if (!harvesterPos) continue;

      // Check grid isolation
      if (harvesterPos.grid !== resourcePos.grid) continue;

      // Calculate distance
      const dx = Math.abs(harvesterPos.x - resourcePos.x);
      const dy = Math.abs(harvesterPos.y - resourcePos.y);
      const distance = dx + dy; // Manhattan distance

      // Check if in range
      const harvestRadius = harvester.harvestRadius ?? 0;
      
      if (distance <= harvestRadius) {
        // Check tag filtering
        if (this.canHarvest(harvesterEntity, resourceEntity)) {
          this.harvestResource(harvesterEntity, resourceEntity);
          return; // Only one harvester per update
        }
      }
    }
  }

  /**
   * Check if harvester can harvest this resource based on tags
   */
  private canHarvest(harvester: Entity, resource: Entity): boolean {
    const harvesterComp = this.world.getComponent(harvester, HarvesterComponent);
    const resourceComp = this.world.getComponent(resource, ResourceComponent);
    
    if (!harvesterComp || !resourceComp) return false;

    // Check if resource restricts harvesters
    if (resourceComp.harvesterTags && resourceComp.harvesterTags.length > 0) {
      const harvesterType = this.world.getComponent(harvester, TypeComponent);
      const harvesterTags = harvesterType?.tags || [];
      
      const hasMatchingTag = harvesterTags.some(tag => 
        resourceComp.harvesterTags!.includes(tag)
      );
      
      if (!hasMatchingTag) return false;
    }

    // Check if harvester restricts resources
    if (harvesterComp.harvestsTags && harvesterComp.harvestsTags.length > 0) {
      const resourceType = this.world.getComponent(resource, TypeComponent);
      const resourceTags = resourceType?.tags || [];
      
      const hasMatchingTag = resourceTags.some(tag => 
        harvesterComp.harvestsTags!.includes(tag)
      );
      
      if (!hasMatchingTag) return false;
    }

    return true;
  }

  /**
   * Harvest from a resource
   */
  private harvestResource(harvester: Entity, resource: Entity): void {
    const harvesterComp = this.world.getComponent(harvester, HarvesterComponent);
    const resourceComp = this.world.getComponent(resource, ResourceComponent);
    
    if (!harvesterComp || !resourceComp || resourceComp.yieldsRemaining <= 0) return;

    // Reduce yields
    resourceComp.yieldsRemaining--;
    
    // Set cooldown
    resourceComp.cooldownTimer = resourceComp.harvestCooldown;
    
    // Update depletion state
    this.updateDepletionState(resource, resourceComp);

    // Update inventory
    const amount = resourceComp.yieldValue || 1;
    if (harvesterComp.inventory) {
      const current = harvesterComp.inventory.get(resourceComp.resourceType) || 0;
      harvesterComp.inventory.set(resourceComp.resourceType, current + amount);
    }

    // Callbacks
    if (resourceComp.onHarvest) {
      resourceComp.onHarvest(harvester, resource, amount);
    }

    if (harvesterComp.onHarvest) {
      harvesterComp.onHarvest(harvester, resource, resourceComp.resourceType, amount);
    }

    // Check if depleted
    if (resourceComp.yieldsRemaining === 0 && resourceComp.onDepleted) {
      resourceComp.onDepleted(resource);
    }
  }

  /**
   * Update depletion state based on yields remaining
   */
  private updateDepletionState(resourceEntity: Entity, resource: ResourceComponent): void {
    const ratio = resource.yieldsRemaining / resource.maxYields;
    
    // Calculate depletion state (0=full, 1-3=partial, 4=depleted)
    if (ratio === 1) {
      resource.depletionState = 0; // Full
    } else if (ratio > 0.66) {
      resource.depletionState = 1; // Slightly depleted
    } else if (ratio > 0.33) {
      resource.depletionState = 2; // Half depleted
    } else if (ratio > 0) {
      resource.depletionState = 3; // Mostly depleted
    } else {
      resource.depletionState = 4; // Fully depleted
    }
  }

  /**
   * Manually trigger harvest (for testing or special cases)
   */
  harvest(harvester: Entity, resource: Entity): boolean {
    if (!this.canHarvest(harvester, resource)) {
      return false;
    }

    const resourceComp = this.world.getComponent(resource, ResourceComponent);
    if (!resourceComp || resourceComp.yieldsRemaining <= 0) {
      return false;
    }

    if (resourceComp.cooldownTimer && resourceComp.cooldownTimer > 0) {
      return false; // Still on cooldown
    }

    this.harvestResource(harvester, resource);
    return true;
  }
}
