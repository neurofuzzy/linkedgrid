/**
 * Pickup System
 * 
 * Manages collectible items and collectors.
 * 
 * Features:
 * - Automatic collection when collector touches pickup
 * - Magnetic attraction (pull items toward collector)
 * - Tag-based filtering
 * - Inventory tracking
 * - Lifetime expiration
 * - Spawn delays
 */

import { System } from '@basegrid/ecs';
import { PickupComponent, CollectorComponent } from '@basegrid/gameplay';
import { GridPositionComponent, TypeComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

export class PickupSystem extends System {
  update(_dt: number): void {
    // Update pickup lifetimes and spawn delays
    for (const [pickupEntity, pickup] of this.world.query(PickupComponent)) {
      // Handle spawn delay
      if (pickup.spawnTimer !== undefined && pickup.spawnTimer > 0) {
        pickup.spawnTimer--;
        if (pickup.spawnTimer === 0) {
          pickup.collectible = true;
        }
        continue; // Skip collection check while spawning
      }

      // Handle lifetime expiration
      if (pickup.lifetime !== undefined) {
        if (pickup.lifetimeTimer === undefined) {
          pickup.lifetimeTimer = pickup.lifetime;
        }
        
        pickup.lifetimeTimer--;
        
        if (pickup.lifetimeTimer <= 0) {
          this.world.destroyEntity(pickupEntity);
          continue;
        }
      }

      // Skip non-collectible pickups
      if (pickup.collectible === false) continue;

      const pickupPos = this.world.getComponent(pickupEntity, GridPositionComponent);
      if (!pickupPos) continue;

      // Check for collectors
      for (const [collectorEntity, collector] of this.world.query(CollectorComponent)) {
        if (collector.active === false) continue;

        const collectorPos = this.world.getComponent(collectorEntity, GridPositionComponent);
        if (!collectorPos) continue;

        // Check grid isolation
        if (collectorPos.grid !== pickupPos.grid) continue;

        // Calculate distance
        const dx = Math.abs(collectorPos.x - pickupPos.x);
        const dy = Math.abs(collectorPos.y - pickupPos.y);
        const distance = dx + dy; // Manhattan distance

        // Check if in range
        const collectRadius = collector.collectRadius ?? 0;
        const magnetRadius = pickup.magnetRadius ?? 0;
        
        // Magnet pull (if within magnet radius but not touching)
        if (magnetRadius > 0 && distance <= magnetRadius && distance > 0) {
          this.pullPickupTowardCollector(pickupEntity, collectorEntity);
        }

        // Collection check (must be touching or within collect radius)
        if (distance <= collectRadius) {
          // Check tag filtering
          if (!this.canCollect(collectorEntity, pickupEntity)) {
            continue;
          }

          // Collect the item
          this.collectPickup(collectorEntity, pickupEntity);
        }
      }
    }
  }

  /**
   * Check if collector can collect this pickup based on tags
   */
  private canCollect(collector: Entity, pickup: Entity): boolean {
    const collectorComp = this.world.getComponent(collector, CollectorComponent);
    const pickupComp = this.world.getComponent(pickup, PickupComponent);
    
    if (!collectorComp || !pickupComp) return false;

    // Check if pickup restricts collectors
    if (pickupComp.collectorTags && pickupComp.collectorTags.length > 0) {
      const collectorType = this.world.getComponent(collector, TypeComponent);
      const collectorTags = collectorType?.tags || [];
      
      const hasMatchingTag = collectorTags.some(tag => 
        pickupComp.collectorTags!.includes(tag)
      );
      
      if (!hasMatchingTag) return false;
    }

    // Check if collector restricts pickups
    if (collectorComp.collectsTags && collectorComp.collectsTags.length > 0) {
      const pickupType = this.world.getComponent(pickup, TypeComponent);
      const pickupTags = pickupType?.tags || [];
      
      const hasMatchingTag = pickupTags.some(tag => 
        collectorComp.collectsTags!.includes(tag)
      );
      
      if (!hasMatchingTag) return false;
    }

    return true;
  }

  /**
   * Pull pickup toward collector (magnetic attraction)
   */
  private pullPickupTowardCollector(pickup: Entity, collector: Entity): void {
    const pickupPos = this.world.getComponent(pickup, GridPositionComponent);
    const collectorPos = this.world.getComponent(collector, GridPositionComponent);
    
    if (!pickupPos || !collectorPos) return;

    // Move one step toward collector
    const dx = collectorPos.x - pickupPos.x;
    const dy = collectorPos.y - pickupPos.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Move horizontally
      pickupPos.x += Math.sign(dx);
    } else if (dy !== 0) {
      // Move vertically
      pickupPos.y += Math.sign(dy);
    }
  }

  /**
   * Collect a pickup
   */
  private collectPickup(collector: Entity, pickup: Entity): void {
    const collectorComp = this.world.getComponent(collector, CollectorComponent);
    const pickupComp = this.world.getComponent(pickup, PickupComponent);
    
    if (!collectorComp || !pickupComp) return;

    // Update inventory
    if (collectorComp.inventory) {
      const current = collectorComp.inventory.get(pickupComp.itemType) || 0;
      const value = pickupComp.value || 1;
      collectorComp.inventory.set(pickupComp.itemType, current + value);
    }

    // Callbacks
    if (pickupComp.onCollect) {
      pickupComp.onCollect(collector, pickup);
    }

    if (collectorComp.onCollect) {
      const value = pickupComp.value || 1;
      collectorComp.onCollect(collector, pickup, pickupComp.itemType, value);
    }

    // Remove pickup (GridRenderSystem will clear the visual automatically)
    this.world.destroyEntity(pickup);
  }

  /**
   * Manually trigger collection (for testing or special cases)
   */
  collect(collector: Entity, pickup: Entity): boolean {
    if (!this.canCollect(collector, pickup)) {
      return false;
    }

    this.collectPickup(collector, pickup);
    return true;
  }
}
