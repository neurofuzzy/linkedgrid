/**
 * Respawn System
 * 
 * Manages respawnable entities and respawn points.
 * 
 * Features:
 * - Activate checkpoints by touching them
 * - Respawn entities at their assigned respawn points
 * - Handle delayed respawns
 * - Support priority-based checkpoint selection
 */

import { System } from '@basegrid/ecs';
import { RespawnPointComponent, RespawnableComponent } from '@basegrid/gameplay';
import { GridPositionComponent, TypeComponent, HealthComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

export class RespawnSystem extends System {
  /**
   * Manually trigger a respawn for an entity
   */
  respawnEntity(entity: Entity): void {
    const respawnable = this.world.getComponent(entity, RespawnableComponent);
    if (!respawnable) return;

    // If there's a delay, start the timer
    if (respawnable.respawnDelay && respawnable.respawnDelay > 0) {
      respawnable.respawnTimer = respawnable.respawnDelay;
      return;
    }

    // Otherwise, respawn immediately
    this.performRespawn(entity);
  }

  /**
   * Actually move the entity to its respawn location
   */
  private performRespawn(entity: Entity): void {
    const respawnable = this.world.getComponent(entity, RespawnableComponent);
    const pos = this.world.getComponent(entity, GridPositionComponent);
    
    if (!respawnable || !pos) return;

    // Find the respawn point
    let targetX = respawnable.homeX;
    let targetY = respawnable.homeY;

    if (respawnable.respawnPointId) {
      // Look for respawn point with matching ID
      for (const [_, respawnComp] of this.world.query(RespawnPointComponent)) {
        if (respawnComp.id === respawnable.respawnPointId && respawnComp.active !== false) {
          // Check if respawn point has uses remaining
          if (respawnComp.maxUses !== undefined) {
            const currentUses = respawnComp.useCount || 0;
            if (currentUses >= respawnComp.maxUses) {
              continue; // This respawn point is exhausted
            }
            respawnComp.useCount = currentUses + 1;
          }

          targetX = respawnComp.x;
          targetY = respawnComp.y;
          
          if (respawnComp.onRespawn) {
            respawnComp.onRespawn(entity);
          }
          
          break;
        }
      }
    }

    // Move entity to respawn location
    pos.x = targetX;
    pos.y = targetY;

    // Restore health if requested
    if (respawnable.restoreHealthOnRespawn) {
      const health = this.world.getComponent(entity, HealthComponent);
      if (health) {
        health.current = health.maximum;
      }
    }

    // Clear respawn timer
    respawnable.respawnTimer = undefined;

    // Callback
    if (respawnable.onRespawnComplete) {
      respawnable.onRespawnComplete(entity, targetX, targetY);
    }
  }

  /**
   * Activate a checkpoint for an entity
   */
  activateCheckpoint(entity: Entity, checkpointEntity: Entity): void {
    const respawnable = this.world.getComponent(entity, RespawnableComponent);
    const checkpoint = this.world.getComponent(checkpointEntity, RespawnPointComponent);
    
    if (!respawnable || !checkpoint || !checkpoint.isCheckpoint) return;

    // Check tag filtering
    if (checkpoint.affectsTags && checkpoint.affectsTags.length > 0) {
      const entityType = this.world.getComponent(entity, TypeComponent);
      const entityTags = entityType?.tags || [];
      const hasMatchingTag = entityTags.some(tag => checkpoint.affectsTags!.includes(tag));
      if (!hasMatchingTag) return;
    }

    // Set this as the respawn point
    if (checkpoint.id) {
      respawnable.respawnPointId = checkpoint.id;
    } else {
      // If no ID, update home position directly
      respawnable.homeX = checkpoint.x;
      respawnable.homeY = checkpoint.y;
    }

    // Activate checkpoint
    checkpoint.active = true;

    // Callback
    if (checkpoint.onActivate) {
      checkpoint.onActivate(entity);
    }
  }

  update(dt: number): void {
    // Check for checkpoint activation (entity touching checkpoint)
    for (const [entity, respawnable] of this.world.query(RespawnableComponent)) {
      const pos = this.world.getComponent(entity, GridPositionComponent);
      if (!pos) continue;

      // Check if entity is on a checkpoint
      for (const [checkpointEntity, checkpoint] of this.world.query(RespawnPointComponent)) {
        if (!checkpoint.isCheckpoint) continue;

        const checkpointPos = this.world.getComponent(checkpointEntity, GridPositionComponent);
        if (!checkpointPos) continue;

        // Check if same grid (isolation)
        if (checkpointPos.grid !== pos.grid) continue;

        // Check if same position
        if (checkpointPos.x === pos.x && checkpointPos.y === pos.y) {
          this.activateCheckpoint(entity, checkpointEntity);
        }
      }

      // Handle delayed respawns
      if (respawnable.respawnTimer !== undefined && respawnable.respawnTimer > 0) {
        respawnable.respawnTimer--;
        
        if (respawnable.respawnTimer <= 0) {
          this.performRespawn(entity);
        }
      }
    }
  }
}
