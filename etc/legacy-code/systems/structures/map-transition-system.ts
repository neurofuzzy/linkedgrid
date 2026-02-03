import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { MapTransitionComponent } from '@basegrid/gameplay';
import { GridPositionComponent } from '@basegrid/ecs';
import { TypeComponent } from '@basegrid/ecs';
import { CollectorComponent } from '@basegrid/gameplay';

/**
 * Map Transition System
 * 
 * Manages transitions between maps and levels.
 * Handles portal activation and entity teleportation.
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const transitionSystem = new MapTransitionSystem();
 * world.addSystem(transitionSystem);
 * 
 * // Create portal
 * const portal = world.createEntity();
 * world.addComponent(portal, GridPositionComponent, { x: 10, y: 10, grid });
 * world.addComponent(portal, MapTransitionComponent, {
 *   targetMap: 'level-2',
 *   targetPosition: { x: 5, y: 5 },
 *   active: true
 * });
 * 
 * // Trigger transition
 * transitionSystem.triggerTransition(portal, player);
 * ```
 */
export class MapTransitionSystem extends System {
  /**
   * Update map transitions
   */
  update(_dt: number): void {
    // Check for entities on transition points
    for (const [portalEntity, transition] of this.world.query(MapTransitionComponent)) {
      if (!transition.active) continue;
      
      const portalPos = this.world.getComponent(portalEntity, GridPositionComponent);
      if (!portalPos) continue;
      
      // Find entities on portal
      for (const [entity, pos] of this.world.query(GridPositionComponent)) {
        if (entity === portalEntity) continue;
        if (pos.grid !== portalPos.grid) continue;
        if (pos.x !== portalPos.x || pos.y !== portalPos.y) continue;
        
        // Check if entity can use portal
        if (!this.canUseTransition(entity, transition)) continue;
        
        // Trigger transition
        this.triggerTransition(portalEntity, entity);
      }
    }
  }
  
  /**
   * Check if entity can use transition
   */
  private canUseTransition(entity: Entity, transition: MapTransition): boolean {
    // Check required tags
    if (transition.requiredTags && transition.requiredTags.length > 0) {
      const type = this.world.getComponent(entity, TypeComponent);
      const tags = (type as any)?.tags || [];
      
      if (!transition.requiredTags.some(tag => tags.includes(tag))) {
        return false;
      }
    }
    
    // Check required item
    if (transition.requiredItem) {
      const collector = this.world.getComponent(entity, CollectorComponent);
      if (!collector || !collector.inventory[transition.requiredItem]) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Trigger map transition
   */
  triggerTransition(portalEntity: Entity, travelerEntity: Entity): boolean {
    const transition = this.world.getComponent(portalEntity, MapTransitionComponent);
    if (!transition || !transition.active) return false;
    
    if (!this.canUseTransition(travelerEntity, transition)) return false;
    
    // Callback before transition
    if (transition.onTransitionStart) {
      transition.onTransitionStart(portalEntity, travelerEntity);
    }
    
    // Move entity to target position
    const pos = this.world.getComponent(travelerEntity, GridPositionComponent);
    if (pos) {
      pos.x = transition.targetPosition.x;
      pos.y = transition.targetPosition.y;
      
      // Change grid if specified
      if (transition.targetGrid) {
        pos.grid = transition.targetGrid;
      }
    }
    
    // Callback after transition
    if (transition.onTransitionComplete) {
      transition.onTransitionComplete(portalEntity, travelerEntity);
    }
    
    return true;
  }
  
  /**
   * Activate transition
   */
  activateTransition(entity: Entity): void {
    const transition = this.world.getComponent(entity, MapTransitionComponent);
    if (transition) {
      transition.active = true;
    }
  }
  
  /**
   * Deactivate transition
   */
  deactivateTransition(entity: Entity): void {
    const transition = this.world.getComponent(entity, MapTransitionComponent);
    if (transition) {
      transition.active = false;
    }
  }
  
  /**
   * Set transition target
   */
  setTransitionTarget(entity: Entity, targetMap: string, targetPosition: { x: number; y: number }): void {
    const transition = this.world.getComponent(entity, MapTransitionComponent);
    if (transition) {
      transition.targetMap = targetMap;
      transition.targetPosition = targetPosition;
    }
  }
  
  /**
   * Check if transition is active
   */
  isActive(entity: Entity): boolean {
    const transition = this.world.getComponent(entity, MapTransitionComponent);
    return transition?.active ?? false;
  }
}
