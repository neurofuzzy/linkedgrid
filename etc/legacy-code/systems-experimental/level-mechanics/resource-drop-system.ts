/**
 * Resource Drop System
 * 
 * Manages item drops when entities die or are destroyed.
 * Works in conjunction with HealthComponent to detect deaths.
 * 
 * Usage:
 * 1. Add ResourceDropComponent to entities that drop items
 * 2. When entity dies (health <= 0), system creates drop entities
 * 3. Drop entities are created at the dead entity's position
 */

import { System } from '@basegrid/ecs';
import { ResourceDropComponent } from '@basegrid/gameplay';
import { GridPositionComponent, HealthComponent, TypeComponent, SpriteComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

export class ResourceDropSystem extends System {
  /**
   * Manually trigger drops for an entity
   * (useful for non-health-based destruction like breaking crates)
   */
  triggerDrop(entity: Entity, killer?: Entity): void {
    const dropComp = this.world.getComponent(entity, ResourceDropComponent);
    const pos = this.world.getComponent(entity, GridPositionComponent);
    
    if (!dropComp || !pos || dropComp.dropped) return;

    // Check if delay is needed
    if (dropComp.dropDelay && dropComp.dropDelay > 0) {
      dropComp.dropTimer = dropComp.dropDelay;
      return;
    }

    this.performDrop(entity, killer);
  }

  /**
   * Actually create the drop entities
   */
  private performDrop(entity: Entity, killer?: Entity): void {
    const dropComp = this.world.getComponent(entity, ResourceDropComponent);
    const pos = this.world.getComponent(entity, GridPositionComponent);
    
    if (!dropComp || !pos || dropComp.dropped) return;

    // Check killer tag requirements
    if (dropComp.requireKillerTags && killer) {
      const killerType = this.world.getComponent(killer, TypeComponent);
      const killerTags = killerType?.tags || [];
      const hasRequiredTag = killerTags.some(tag => dropComp.requireKillerTags!.includes(tag));
      if (!hasRequiredTag) {
        dropComp.dropped = true;
        return; // Killer doesn't meet requirements
      }
    }

    // Determine which items to drop
    const itemsToDrop = this.selectDrops(dropComp);
    
    // Create drop entities
    const droppedEntities: Entity[] = [];
    
    for (const item of itemsToDrop) {
      const quantity = item.quantity || 1;
      
      for (let i = 0; i < quantity; i++) {
        // Calculate drop position with scatter
        let dropX = pos.x;
        let dropY = pos.y;
        
        if (dropComp.scatterRadius && dropComp.scatterRadius > 0) {
          dropX += Math.floor(Math.random() * (dropComp.scatterRadius * 2 + 1)) - dropComp.scatterRadius;
          dropY += Math.floor(Math.random() * (dropComp.scatterRadius * 2 + 1)) - dropComp.scatterRadius;
          
          // Clamp to grid bounds
          dropX = Math.max(0, Math.min(pos.grid.width - 1, dropX));
          dropY = Math.max(0, Math.min(pos.grid.height - 1, dropY));
        }
        
        // Create drop entity
        const dropEntity = this.world.createEntity();
        
        // Add position
        this.world.addComponent(dropEntity, GridPositionComponent, {
          grid: pos.grid,
          x: dropX,
          y: dropY
        });
        
        // Add type tag
        this.world.addComponent(dropEntity, TypeComponent, {
          tags: ['pickup', 'drop', item.itemType]
        });
        
        // Add sprite if specified
        if (item.sprite !== undefined) {
          this.world.addComponent(dropEntity, SpriteComponent, {
            value: item.sprite,
            layer: 0
          });
        }
        
        // Store custom data in entity metadata (could add a DataComponent if needed)
        if (item.data) {
          // For now, we'll just track it in TypeComponent or a future DataComponent
        }
        
        droppedEntities.push(dropEntity);
      }
    }

    // Mark as dropped
    dropComp.dropped = true;
    dropComp.dropTimer = undefined;

    // Callback
    if (dropComp.onDrop) {
      dropComp.onDrop(droppedEntities, killer);
    }
  }

  /**
   * Select which items to drop based on dropAll, maxDrops, and dropChance
   */
  private selectDrops(dropComp: ResourceDrop): typeof dropComp.items {
    const selected: typeof dropComp.items = [];
    
    if (dropComp.dropAll) {
      // Drop all items that pass their drop chance
      for (const item of dropComp.items) {
        const chance = item.dropChance ?? 1.0;
        if (Math.random() <= chance) {
          selected.push(item);
        }
      }
    } else {
      // Pick random items up to maxDrops
      const maxDrops = dropComp.maxDrops ?? 1;
      const available = [...dropComp.items];
      
      for (let i = 0; i < maxDrops && available.length > 0; i++) {
        // Pick random item
        const index = Math.floor(Math.random() * available.length);
        const item = available[index];
        
        // Check drop chance
        const chance = item.dropChance ?? 1.0;
        if (Math.random() <= chance) {
          selected.push(item);
        }
        
        // Remove from available (don't pick same item twice)
        available.splice(index, 1);
      }
    }
    
    return selected;
  }

  update(_dt: number): void {
    // Check for entities that died and have drops
    for (const [entity, dropComp] of this.world.query(ResourceDropComponent)) {
      if (dropComp.dropped) continue;

      const health = this.world.getComponent(entity, HealthComponent);
      
      // Check if entity died
      if (health && health.current <= 0) {
        // Extract killer from health component if available
        const killer = undefined; // Would need to track this in HealthComponent
        this.triggerDrop(entity, killer);
      }

      // Handle delayed drops
      if (dropComp.dropTimer !== undefined && dropComp.dropTimer > 0) {
        dropComp.dropTimer--;
        
        if (dropComp.dropTimer <= 0) {
          this.performDrop(entity, undefined);
        }
      }
    }
  }
}
