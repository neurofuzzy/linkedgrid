import { System } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';
import { ConditionalDoorComponent, type DoorCondition } from '@basegrid/gameplay';
import { DoorComponent } from '@basegrid/gameplay';
import { TypeComponent } from '@basegrid/ecs';
import { CollectorComponent } from '@basegrid/gameplay';
import { DoorRoomSystem } from './door-room-system';

/**
 * Conditional Door System
 * 
 * Manages doors that open/close based on conditions.
 * 
 * Features:
 * - Multiple condition types
 * - AND/OR logic
 * - Auto-open/close
 * - Periodic checking
 * - Custom conditions
 * 
 * @example
 * ```typescript
 * const world = new World();
 * const doorSystem = new DoorRoomSystem();
 * const conditionalDoorSystem = new ConditionalDoorSystem();
 * world.addSystem(doorSystem);
 * world.addSystem(conditionalDoorSystem);
 * 
 * // Create boss door
 * const bossDoor = world.createEntity();
 * world.addComponent(bossDoor, DoorComponent, { state: 'closed', locked: true });
 * world.addComponent(bossDoor, ConditionalDoorComponent, {
 *   conditions: [
 *     { type: 'all-enemies-killed' }
 *   ],
 *   autoOpen: true
 * });
 * ```
 */
export class ConditionalDoorSystem extends System {
  /**
   * Update conditional door system
   */
  update(dt: number): void {
    for (const [doorEntity, conditional] of this.world.query(ConditionalDoorComponent)) {
      // Initialize
      if (conditional.metConditions === undefined) {
        conditional.metConditions = new Set();
        conditional.conditionsSatisfied = false;
      }
      
      // Check interval
      if (conditional.checkInterval !== undefined && conditional.checkInterval > 0) {
        if (conditional.checkTimer === undefined) {
          conditional.checkTimer = conditional.checkInterval * 1000;
        }
        
        conditional.checkTimer -= dt;
        if (conditional.checkTimer > 0) {
          continue;
        }
        
        conditional.checkTimer = conditional.checkInterval * 1000;
      }
      
      // Check all conditions
      const previouslySatisfied = conditional.conditionsSatisfied;
      conditional.metConditions.clear();
      
      for (let i = 0; i < conditional.conditions.length; i++) {
        const condition = conditional.conditions[i];
        if (this.checkCondition(condition)) {
          conditional.metConditions.add(i);
        }
      }
      
      // Determine if satisfied
      const allConditions = conditional.conditions.length;
      const metConditions = conditional.metConditions.size;
      
      if (conditional.requireAllConditions !== false) {
        // AND logic
        conditional.conditionsSatisfied = metConditions === allConditions;
      } else {
        // OR logic
        conditional.conditionsSatisfied = metConditions > 0;
      }
      
      // Handle state changes
      if (conditional.conditionsSatisfied && !previouslySatisfied) {
        this.onConditionsMet(doorEntity, conditional);
      } else if (!conditional.conditionsSatisfied && previouslySatisfied) {
        this.onConditionsLost(doorEntity, conditional);
      }
    }
  }
  
  /**
   * Check if a condition is met
   */
  private checkCondition(condition: DoorCondition): boolean {
    switch (condition.type) {
      case 'all-enemies-killed':
        return this.checkAllEnemiesKilled();
      
      case 'entity-count':
        return this.checkEntityCount(condition);
      
      case 'has-item':
        return this.checkHasItem(condition);
      
      case 'entity-on-plate':
        return this.checkEntityOnPlate(condition);
      
      case 'custom':
        return condition.customCondition ? condition.customCondition(this.world) : false;
      
      default:
        return false;
    }
  }
  
  /**
   * Check if all enemies are killed
   */
  private checkAllEnemiesKilled(): boolean {
    for (const [_, type] of this.world.query(TypeComponent)) {
      if (type.type === 'enemy' || type.tags?.includes('enemy')) {
        return false; // Found an enemy
      }
    }
    return true; // No enemies found
  }
  
  /**
   * Check entity count condition
   */
  private checkEntityCount(condition: DoorCondition): boolean {
    if (!condition.entityTag) return false;
    
    let count = 0;
    for (const [_, type] of this.world.query(TypeComponent)) {
      if (type.type === condition.entityTag || type.tags?.includes(condition.entityTag)) {
        count++;
      }
    }
    
    const required = condition.requiredCount ?? 0;
    return count === required;
  }
  
  /**
   * Check has item condition (player inventory)
   */
  private checkHasItem(condition: DoorCondition): boolean {
    if (!condition.requiredItem) return false;
    
    // Check all collectors (player inventories)
    for (const [_, collector] of this.world.query(CollectorComponent)) {
      if (collector.inventory && collector.inventory.includes(condition.requiredItem)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check entity on pressure plate
   */
  private checkEntityOnPlate(condition: DoorCondition): boolean {
    if (!condition.pressurePlate) return false;
    
    // This would integrate with PressurePlateComponent
    // For now, just check if the entity exists
    return this.world.hasEntity(condition.pressurePlate);
  }
  
  /**
   * Handle conditions met
   */
  private onConditionsMet(doorEntity: Entity, conditional: ConditionalDoorComponent): void {
    if (conditional.onConditionsMet) {
      conditional.onConditionsMet(doorEntity);
    }
    
    if (conditional.autoOpen) {
      const door = this.world.getComponent(doorEntity, DoorComponent);
      if (door && door.state === 'closed') {
        door.locked = false;
        
        const doorSystem = this.world.getSystem(DoorRoomSystem);
        if (doorSystem) {
          doorSystem.openDoor(doorEntity);
        }
      }
    }
  }
  
  /**
   * Handle conditions lost
   */
  private onConditionsLost(doorEntity: Entity, conditional: ConditionalDoorComponent): void {
    if (conditional.onConditionsLost) {
      conditional.onConditionsLost(doorEntity);
    }
    
    if (conditional.autoClose) {
      const doorSystem = this.world.getSystem(DoorRoomSystem);
      if (doorSystem) {
        doorSystem.closeDoor(doorEntity);
      }
    }
  }
  
  /**
   * Check if door conditions are satisfied
   */
  areConditionsMet(doorEntity: Entity): boolean {
    const conditional = this.world.getComponent(doorEntity, ConditionalDoorComponent);
    return conditional?.conditionsSatisfied ?? false;
  }
  
  /**
   * Force recheck of conditions
   */
  forceCheck(doorEntity: Entity): void {
    const conditional = this.world.getComponent(doorEntity, ConditionalDoorComponent);
    if (conditional) {
      conditional.checkTimer = 0;
    }
  }
}
