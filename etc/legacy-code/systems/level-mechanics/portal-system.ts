import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { PortalComponent, PortalCooldownComponent, CollectorComponent } from '@basegrid/gameplay';
import { GridPositionComponent, VisualComponent } from '@basegrid/ecs';
import { TypeComponent } from '@basegrid/ecs';
import type { LinkedGrid } from '@basegrid/grid';

/**
 * Portal System - Unified system for intra-scene and inter-scene teleportation
 * 
 * Manages both teleport pads (floor-based, walkable) and doors (wall-based, blocking):
 * - Intra-scene: Teleport pads with direct coordinates
 * - Inter-scene: Doors with scene references and color pairing
 * - Key-based locking for progression gates
 * - Cooldowns to prevent teleport loops
 * - Type filtering for selective teleportation
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const portalSystem = new PortalSystem();
 * world.addSystem(portalSystem);
 * 
 * // Register scenes for inter-scene portals
 * portalSystem.registerScene('forest', 'guid-123', forestGrid);
 * portalSystem.registerScene('cave', 'guid-456', caveGrid);
 * 
 * // Create intra-scene teleport pad
 * const pad = world.createEntity();
 * world.addComponent(pad, PortalComponent, {
 *   color: 'red',
 *   portalType: 'floor-pad',
 *   destinationX: 25,
 *   destinationY: 15,
 *   cooldown: 30
 * });
 * 
 * // Create inter-scene door (locked with key)
 * const door = world.createEntity();
 * world.addComponent(door, PortalComponent, {
 *   color: 'blue',
 *   portalType: 'door',
 *   targetSceneName: 'cave',
 *   spawnAtPairedPortal: true,
 *   locked: true,
 *   requiredKeyColor: 'blue'
 * });
 * ```
 */
export class PortalSystem extends System {
  // Scene registry for inter-scene portals
  private sceneRegistry: Map<string, string> = new Map();  // name -> guid
  private gridRegistry: Map<string, LinkedGrid<number>> = new Map();  // guid -> grid
  
  /**
   * Register a scene for inter-scene portal transitions
   */
  registerScene(name: string, guid: string, grid: LinkedGrid<number>): void {
    this.sceneRegistry.set(name, guid);
    this.gridRegistry.set(guid, grid);
  }
  
  /**
   * Update portals and cooldowns
   */
  update(_dt: number): void {
    // Update cooldowns first
    this.updateCooldowns();
    
    // Check for unlocking (key-based)
    this.checkPortalUnlocking();
    
    // Check for teleportation/transition
    this.checkPortals();
  }
  
  /**
   * Update cooldown timers
   */
  private updateCooldowns(): void {
    for (const [entity, cooldown] of this.world.query(PortalCooldownComponent)) {
      cooldown.remaining--;
      
      // Remove cooldown when it goes BELOW zero (not at zero)
      // This ensures the last frame of cooldown still blocks teleportation
      if (cooldown.remaining < 0) {
        this.world.removeComponent(entity, PortalCooldownComponent);
      }
    }
  }
  
  /**
   * Check if collectors have keys that unlock portals
   */
  private checkPortalUnlocking(): void {
    // Check if any collector has keys that unlock portals
    for (const [collectorEntity, collector] of this.world.query(CollectorComponent)) {
      if (!collector.inventory) continue;
      
      // Check each portal
      for (const [portalEntity, portal] of this.world.query(PortalComponent)) {
        if (!portal.locked) continue;
        
        const keyColor = portal.requiredKeyColor || portal.color;
        const keyName = `key-${keyColor}`;
        
        if (collector.inventory.get(keyName)! > 0) {
          // Unlock portal
          portal.locked = false;
          
          // Update visual layer (door becomes walkable)
          if (portal.portalType === 'door') {
            const visual = this.world.getComponent(portalEntity, VisualComponent);
            if (visual) {
              visual.layer = 3;  // POWERUPS (walkable)
            }
            
            // Update type tags
            const type = this.world.getComponent(portalEntity, TypeComponent);
            if (type) {
              type.tags = ['portal', 'door', 'walkable'];
            }
          }
          
          // Callback
          if (portal.onUnlock) {
            portal.onUnlock(portalEntity, collectorEntity);
          }
        }
      }
    }
  }
  
  /**
   * Check for entities on portals
   */
  private checkPortals(): void {
    for (const [portalEntity, portal] of this.world.query(PortalComponent)) {
      // Skip if inactive
      if (portal.active === false) continue;
      
      // Skip if locked
      if (portal.locked) continue;
      
      // Check if max uses reached
      if (portal.maxUses !== undefined) {
        if ((portal.useCount ?? 0) >= portal.maxUses) {
          continue;
        }
      }
      
      const portalPos = this.world.getComponent(portalEntity, GridPositionComponent);
      if (!portalPos) continue;
      
      // Find entities at portal position
      for (const [entity, pos] of this.world.query(GridPositionComponent)) {
        // Skip self
        if (entity === portalEntity) continue;
        
        // Skip if different grids
        if (pos.grid !== portalPos.grid) continue;
        
        // Skip if not at same position
        if (pos.x !== portalPos.x || pos.y !== portalPos.y) continue;
        
        // Skip if on cooldown
        if (this.world.hasComponent(entity, PortalCooldownComponent)) {
          continue;
        }
        
        // Check type filtering
        if (!this.canTeleportTarget(entity, portal)) {
          continue;
        }
        
        // Determine destination
        const dest = this.getDestination(portal, portalPos.grid);
        if (!dest) {
          // Locked portal was attempted
          if (portal.onLocked) {
            portal.onLocked(portalEntity, entity);
          }
          continue;
        }
        
        // Teleport!
        this.teleportEntity(portalEntity, entity, portal, pos, dest);
      }
    }
  }
  
  /**
   * Check if portal can affect target based on tags
   */
  private canTeleportTarget(
    targetEntity: Entity,
    portal: PortalComponent
  ): boolean {
    const targetType = this.world.getComponent(targetEntity, TypeComponent);
    
    // Get all target tags
    const targetTags = targetType?.tags || [];
    const targetTag = targetType?.type;
    
    // Check ignoresTags
    if (portal.ignoresTags) {
      if (targetTag && portal.ignoresTags.includes(targetTag)) {
        return false;
      }
      for (const tag of targetTags) {
        if (portal.ignoresTags.includes(tag)) {
          return false;
        }
      }
    }
    
    // Check affectsTags
    if (portal.affectsTags && portal.affectsTags.length > 0) {
      if (targetTag && portal.affectsTags.includes(targetTag)) {
        return true;
      }
      for (const tag of targetTags) {
        if (portal.affectsTags.includes(tag)) {
          return true;
        }
      }
      return false;  // Has restrictions but no match
    }
    
    // No restrictions, allow teleport
    return true;
  }
  
  /**
   * Get destination for portal (intra-scene or inter-scene)
   */
  private getDestination(portal: PortalComponent, currentGrid: LinkedGrid<number>) {
    // Intra-scene (direct coordinates)
    if (portal.destinationX !== undefined && portal.destinationY !== undefined) {
      return {
        grid: portal.destinationGrid || currentGrid,
        x: portal.destinationX,
        y: portal.destinationY
      };
    }
    
    // Inter-scene (scene reference + pairing)
    if (portal.targetSceneName || portal.targetSceneGuid) {
      const targetGuid = portal.targetSceneGuid || this.sceneRegistry.get(portal.targetSceneName!);
      if (!targetGuid) {
        console.warn(`Portal target scene not found: ${portal.targetSceneName}`);
        return null;
      }
      
      const targetGrid = this.gridRegistry.get(targetGuid);
      if (!targetGrid) {
        console.warn(`Portal target grid not found for GUID: ${targetGuid}`);
        return null;
      }
      
      // Find paired portal
      if (portal.spawnAtPairedPortal) {
        const paired = this.findPairedPortal(targetGrid, portal.color);
        if (paired) {
          return { grid: targetGrid, x: paired.x, y: paired.y };
        }
      }
      
      // Fallback to origin
      return { grid: targetGrid, x: 0, y: 0 };
    }
    
    return null;
  }
  
  /**
   * Find paired portal in target grid with matching color
   */
  private findPairedPortal(grid: LinkedGrid<number>, color: string) {
    for (const [entity, portal] of this.world.query(PortalComponent)) {
      if (portal.color !== color) continue;
      
      const pos = this.world.getComponent(entity, GridPositionComponent);
      if (pos?.grid === grid) {
        return { x: pos.x, y: pos.y };
      }
    }
    return null;
  }
  
  /**
   * Teleport entity to destination
   */
  private teleportEntity(
    portalEntity: Entity,
    entity: Entity,
    portal: PortalComponent,
    pos: GridPositionComponent,
    dest: { grid: LinkedGrid<number>, x: number, y: number }
  ): void {
    const oldX = pos.x;
    const oldY = pos.y;
    
    // Teleport
    pos.grid = dest.grid;
    pos.x = dest.x;
    pos.y = dest.y;
    
    // Add cooldown
    if (portal.cooldown) {
      this.world.addComponent(entity, PortalCooldownComponent, {
        remaining: portal.cooldown
      });
    }
    
    // Increment use count
    if (portal.maxUses !== undefined) {
      portal.useCount = (portal.useCount ?? 0) + 1;
      
      // Deactivate if max uses reached
      if (portal.useCount >= portal.maxUses) {
        portal.active = false;
      }
    }
    
    // Callback
    if (portal.onTeleport) {
      portal.onTeleport(entity, oldX, oldY, dest.x, dest.y);
    }
  }
}

// Legacy export for backwards compatibility
export const TeleporterSystem = PortalSystem;
